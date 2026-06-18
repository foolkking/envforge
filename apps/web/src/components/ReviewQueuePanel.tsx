import React, { useEffect, useMemo, useState } from "react";
import {
  fetchMigrationCandidates,
  fetchMigrationReviewQueue,
  generateCatalogDraft,
  saveMigrationDecision,
  saveMigrationDecisionsBulk,
  type MigrationCandidate,
  type MigrationCandidateReport,
  type MigrationReviewQueueItem,
  type ReviewDecision
} from "../api";
import type { Locale } from "../lib/types";

/**
 * ReviewQueuePanel — independent Unknown Review Queue workbench.
 *
 * Migrate Mode collects evidence about every candidate item on the source
 * host, but unknown / low-confidence items must not silently disappear nor
 * silently migrate. This panel pulls them out of the migration plan and gives
 * the operator a focused workspace to:
 *
 *  1. inspect every candidate's evidence (source, version, reasons, risks);
 *  2. select one or many candidates;
 *  3. apply a decision: ignore / record-only / migrate-artifact /
 *     create-catalog-draft / add-to-plan / needs-manual-instruction /
 *     approved / skipped;
 *  4. immediately produce a catalog draft when the operator picks
 *     `create-catalog-draft` so contributors can fill in the rule template.
 *
 * The component is self-contained; it does not depend on MigrationPlanPanel
 * and can be embedded in MachinePage or any other page that has an active
 * connection.
 */
export function ReviewQueuePanel({
  authToken,
  connectionId,
  locale,
  pushLog,
  onRefreshPlan,
  onCatalogDraft,
  onPendingCountChange
}: {
  authToken: string;
  connectionId: string;
  locale: Locale;
  pushLog?: (type: "info" | "success" | "error" | "cmd", text: string) => void;
  /** Caller is notified after a decision changes so the migration plan can refresh. */
  onRefreshPlan?: () => void;
  /** Caller receives the generated catalog draft YAML (when supported). */
  onCatalogDraft?: (draft: { id: string; yaml: string; candidate: MigrationCandidate }) => void;
  /** Caller is told how many candidates still have a `pending` decision so
   *  workflow steppers can light up the right state. */
  onPendingCountChange?: (count: number) => void;
}) {
  const [report, setReport] = useState<MigrationCandidateReport | null>(null);
  const [queue, setQueue] = useState<MigrationReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | ReviewDecision>("all");
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [draftYaml, setDraftYaml] = useState<string>("");
  const [draftFor, setDraftFor] = useState<MigrationCandidate | null>(null);

  useEffect(() => { void loadAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [authToken, connectionId]);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [r, q] = await Promise.all([
        fetchMigrationCandidates(authToken, connectionId),
        fetchMigrationReviewQueue(authToken, connectionId).catch(() => [])
      ]);
      setReport(r);
      setQueue(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load review queue.");
    } finally {
      setLoading(false);
    }
  }

  const candidates = useMemo<MigrationCandidate[]>(() => {
    // Prefer the explicit review queue; fall back to medium/low/unknown candidates
    // when the queue endpoint returned nothing (older servers or empty queue).
    if (queue.length > 0) return queue.map((item) => item.candidate);
    if (!report) return [];
    return report.candidates.filter((c) => c.band === "low" || c.band === "ignore" || c.migrationClass === "unknown-review" || c.migrationClass === "manual-install");
  }, [queue, report]);

  const decisionMap = useMemo<Record<string, ReviewDecision>>(() => {
    const map: Record<string, ReviewDecision> = {};
    for (const item of queue) map[item.candidate.id] = item.decision;
    return map;
  }, [queue]);

  // Notify the parent how many candidates still need a decision so it can
  // drive the Migrate Mode workflow stepper.
  useEffect(() => {
    if (!onPendingCountChange) return;
    const pending = candidates.filter((c) => (decisionMap[c.id] ?? "pending") === "pending").length;
    onPendingCountChange(pending);
  }, [candidates, decisionMap, onPendingCountChange]);

  const filteredCandidates = useMemo(() => {
    if (filter === "all") return candidates;
    if (filter === "pending") return candidates.filter((c) => (decisionMap[c.id] ?? "pending") === "pending");
    return candidates.filter((c) => decisionMap[c.id] === filter);
  }, [candidates, filter, decisionMap]);

  const active = activeId ? candidates.find((c) => c.id === activeId) ?? null : null;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function applyDecision(candidateId: string, decision: ReviewDecision) {
    setSavingId(candidateId);
    setError("");
    try {
      if (decision === "create-catalog-draft") {
        const candidate = candidates.find((c) => c.id === candidateId);
        if (candidate) {
          // Prefer the server's draft generator (it knows config paths,
          // validate commands, and data paths); fall back to the local
          // template only when the server is unreachable.
          try {
            const draft = await generateCatalogDraft(authToken, connectionId, candidate.id);
            setDraftYaml(draft.yaml);
            setDraftFor(candidate);
            onCatalogDraft?.({ id: draft.id, yaml: draft.yaml, candidate });
          } catch {
            const yaml = buildCatalogDraftYaml(candidate);
            setDraftYaml(yaml);
            setDraftFor(candidate);
            onCatalogDraft?.({ id: candidate.id, yaml, candidate });
          }
        }
      }
      await saveMigrationDecision(authToken, connectionId, candidateId, decision);
      pushLog?.("success", `decision: ${candidateId} -> ${decision}`);
      await loadAll();
      onRefreshPlan?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save decision failed.");
    } finally {
      setSavingId(null);
    }
  }

  async function applyBulk(decision: ReviewDecision) {
    if (selected.size === 0) return;
    setBulkSaving(true);
    setError("");
    try {
      await saveMigrationDecisionsBulk(authToken, connectionId, Array.from(selected), decision);
      pushLog?.("success", `bulk decision: ${selected.size} -> ${decision}`);
      setSelected(new Set());
      await loadAll();
      onRefreshPlan?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk save failed.");
    } finally {
      setBulkSaving(false);
    }
  }

  return (
    <section className="panel-large review-queue-panel" style={{ padding: 16 }}>
      <div className="panel-heading" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>{locale === "zh" ? "审查队列工作台" : "Review Queue Workbench"}</h2>
        <span className="panel-count">{filteredCandidates.length} / {candidates.length}</span>
      </div>
      <p style={{ margin: "8px 0", color: "var(--ef-muted)", fontSize: 13 }}>
        {locale === "zh"
          ? "未知或低置信度的迁移候选不会被自动忽略，也不会自动迁移。请审查证据，选择决策，必要时生成 catalog 草稿。"
          : "Unknown or low-confidence candidates are neither silently ignored nor silently migrated. Inspect evidence, pick a decision, and generate a catalog draft when needed."}
      </p>

      <div className="review-queue-toolbar" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
        {(["all", "pending", "approved", "ignore", "record-only", "migrate-artifact", "add-to-plan", "create-catalog-draft", "needs-manual-instruction", "skipped"] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={`filter-pill ${filter === value ? "active" : ""}`}
            onClick={() => setFilter(value)}
          >
            {labelFor(value, locale)}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <button type="button" className="conn-btn conn-btn-ghost" onClick={() => void loadAll()} disabled={loading}>
          {loading ? (locale === "zh" ? "刷新中..." : "Refreshing…") : (locale === "zh" ? "刷新" : "Refresh")}
        </button>
      </div>

      {selected.size > 0 ? (
        <div className="review-queue-bulk" style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: 10, background: "var(--ef-surface-soft)", borderRadius: 6, marginBottom: 12 }}>
          <strong style={{ marginRight: 8, fontSize: 13 }}>
            {locale === "zh" ? `已选 ${selected.size} 项` : `${selected.size} selected`}
          </strong>
          {(["add-to-plan", "ignore", "record-only", "migrate-artifact", "needs-manual-instruction", "skipped"] as ReviewDecision[]).map((decision) => (
            <button key={decision} type="button" className="conn-btn conn-btn-ghost" onClick={() => void applyBulk(decision)} disabled={bulkSaving}>
              {labelFor(decision, locale)}
            </button>
          ))}
          <button type="button" className="conn-btn conn-btn-ghost" onClick={() => setSelected(new Set())}>
            {locale === "zh" ? "取消选择" : "Clear selection"}
          </button>
        </div>
      ) : null}

      <div className="review-queue-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 12 }}>
        <div className="review-queue-list" style={{ display: "grid", gap: 8, maxHeight: 540, overflow: "auto" }}>
          {filteredCandidates.length === 0 ? (
            <div className="filter-status">
              {locale === "zh" ? "当前筛选下没有候选项。" : "No candidates match the current filter."}
            </div>
          ) : null}
          {filteredCandidates.map((candidate) => {
            const decision = decisionMap[candidate.id] ?? "pending";
            const isActive = candidate.id === activeId;
            return (
              <div
                key={candidate.id}
                className={`review-queue-card ${isActive ? "active" : ""}`}
                style={{
                  padding: 10,
                  border: `1px solid ${isActive ? "#0ea5e9" : "var(--ef-border)"}`,
                  borderRadius: 6,
                  cursor: "pointer",
                  background: "var(--ef-surface)"
                }}
                onClick={() => setActiveId(candidate.id)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={selected.has(candidate.id)}
                    onClick={(event) => event.stopPropagation()}
                    onChange={() => toggleSelect(candidate.id)}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ display: "block" }}>{candidate.name}</strong>
                    <small style={{ color: "var(--ef-muted)" }}>{candidate.source} · {candidate.version || "-"} · {candidate.migrationClass}</small>
                  </div>
                  <span className="review-queue-decision-tag" style={{ background: decisionTone(decision), color: "var(--ef-surface)", fontSize: 11, padding: "2px 8px", borderRadius: 999 }}>
                    {labelFor(decision, locale)}
                  </span>
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: "var(--ef-muted)" }}>
                  {locale === "zh" ? "置信度" : "Confidence"}: {Math.round(candidate.confidence * 100)}% · band {candidate.band}
                </div>
              </div>
            );
          })}
        </div>

        <aside className="review-queue-detail" style={{ padding: 12, border: "1px solid var(--ef-border)", borderRadius: 6, background: "#fafafa", maxHeight: 540, overflow: "auto" }}>
          {!active ? (
            <p style={{ color: "var(--ef-muted)", fontSize: 13 }}>
              {locale === "zh" ? "选择左侧候选项以查看证据和决策选项。" : "Pick a candidate on the left to inspect evidence and decisions."}
            </p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <header>
                <strong style={{ fontSize: 16 }}>{active.name}</strong>
                <div style={{ color: "var(--ef-muted)", fontSize: 12 }}>{active.source} · {active.version || "-"}</div>
              </header>
              <Section title={locale === "zh" ? "迁移分类" : "Migration class"}>
                <code>{active.migrationClass}</code>
              </Section>
              {active.catalogRuleId ? (
                <Section title={locale === "zh" ? "规则库规则" : "Catalog rule"}>
                  <code>{active.catalogRuleId}</code> {active.catalogRuleName ? `(${active.catalogRuleName})` : ""}
                </Section>
              ) : null}
              <Section title={locale === "zh" ? "证据" : "Evidence"}>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--ef-text)" }}>
                  {active.reasons.map((reason, idx) => <li key={`reason-${idx}`}>{reason}</li>)}
                </ul>
              </Section>
              {active.risks.length ? (
                <Section title={locale === "zh" ? "风险" : "Risks"}>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#7c2d12" }}>
                    {active.risks.map((risk, idx) => <li key={`risk-${idx}`}>{risk}</li>)}
                  </ul>
                </Section>
              ) : null}
              {active.recommendedActions.length ? (
                <Section title={locale === "zh" ? "建议操作" : "Recommended actions"}>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--ef-text)" }}>
                    {active.recommendedActions.map((action, idx) => <li key={`act-${idx}`}>{action}</li>)}
                  </ul>
                </Section>
              ) : null}

              <Section title={locale === "zh" ? "应用决策" : "Apply decision"}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {(["approved", "add-to-plan", "migrate-artifact", "ignore", "record-only", "create-catalog-draft", "needs-manual-instruction", "skipped"] as ReviewDecision[]).map((decision) => (
                    <button
                      key={decision}
                      type="button"
                      className="conn-btn conn-btn-ghost"
                      onClick={() => void applyDecision(active.id, decision)}
                      disabled={savingId === active.id}
                    >
                      {labelFor(decision, locale)}
                    </button>
                  ))}
                </div>
              </Section>

              {draftFor?.id === active.id && draftYaml ? (
                <Section title={locale === "zh" ? "规则库草稿（能力规则 v2）" : "Catalog draft (capability rule v2)"}>
                  <textarea
                    readOnly
                    value={draftYaml}
                    style={{ width: "100%", minHeight: 220, fontFamily: "monospace", fontSize: 12 }}
                  />
                  <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                    <button type="button" className="conn-btn conn-btn-ghost" onClick={() => void navigator.clipboard.writeText(draftYaml)}>
                      {locale === "zh" ? "复制 YAML" : "Copy YAML"}
                    </button>
                    <button type="button" className="conn-btn conn-btn-ghost" onClick={() => downloadAsFile(`${active.id}.catalog-draft.yaml`, draftYaml)}>
                      {locale === "zh" ? "下载" : "Download"}
                    </button>
                  </div>
                </Section>
              ) : null}
            </div>
          )}
        </aside>
      </div>

      {error ? <div style={{ color: "var(--ef-danger)", fontSize: 13, marginTop: 8 }}>{error}</div> : null}
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--ef-muted)", marginBottom: 4 }}>{title}</div>
      <div>{children}</div>
    </div>
  );
}

function labelFor(value: ReviewDecision | "all" | "pending", locale: Locale): string {
  const zh: Record<string, string> = {
    all: "全部",
    pending: "待定",
    approved: "批准",
    skipped: "跳过",
    ignore: "忽略",
    "record-only": "仅记录",
    "migrate-artifact": "迁移为 artifact",
    "create-catalog-draft": "生成 catalog 草稿",
    "add-to-plan": "加入计划",
    "needs-manual-instruction": "需手动指引"
  };
  const en: Record<string, string> = {
    all: "All",
    pending: "Pending",
    approved: "Approved",
    skipped: "Skipped",
    ignore: "Ignore",
    "record-only": "Record only",
    "migrate-artifact": "Migrate as artifact",
    "create-catalog-draft": "Create catalog draft",
    "add-to-plan": "Add to plan",
    "needs-manual-instruction": "Needs manual instruction"
  };
  return locale === "zh" ? zh[value] ?? value : en[value] ?? value;
}

function decisionTone(decision: ReviewDecision): string {
  const map: Record<ReviewDecision, string> = {
    pending: "var(--ef-muted-2)",
    approved: "var(--ef-success)",
    "add-to-plan": "var(--ef-info)",
    "migrate-artifact": "#0ea5e9",
    "create-catalog-draft": "#7c3aed",
    "needs-manual-instruction": "#ea580c",
    "record-only": "var(--ef-muted)",
    skipped: "var(--ef-muted)",
    ignore: "var(--ef-muted)"
  };
  return map[decision] ?? "var(--ef-muted-2)";
}

function downloadAsFile(name: string, content: string) {
  const blob = new Blob([content], { type: "text/yaml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Build a Capability Catalog v2 YAML draft for a candidate.
 *
 * The draft pre-fills: id (slugified candidate id), kind, displayName,
 * capability key (best-effort guess), supportLevel detect-only (the safe
 * default for unknown software), detect signals derived from package
 * manager + binaries + ports, plus stub sections for configs / data /
 * validate / rollback / security so contributors can finish the rule
 * without starting from scratch.
 */
function buildCatalogDraftYaml(candidate: MigrationCandidate): string {
  const id = slugify(candidate.id || candidate.name);
  const lines: string[] = [];
  lines.push(`# EnvForge Capability Catalog draft — review and complete before submission.`);
  lines.push(`# Source: ${candidate.source}; Version: ${candidate.version || "unknown"}.`);
  lines.push(`# Migration class: ${candidate.migrationClass}; confidence: ${Math.round(candidate.confidence * 100)}%.`);
  lines.push("");
  lines.push(`id: ${id}`);
  lines.push(`kind: software`);
  lines.push(`name: ${escapeYaml(candidate.name)}`);
  lines.push(`capabilityKey: ${escapeYaml(`unknown.${id}`)}`);
  lines.push(`capability: ${escapeYaml(`unknown.${id}`)}`);
  lines.push(`supportLevel: detect-only`);
  lines.push(``);
  lines.push(`detect:`);
  lines.push(`  packages:`);
  lines.push(`    ${candidate.source}:`);
  lines.push(`      - ${candidate.name}`);
  lines.push(`  binaries: []`);
  lines.push(`  systemd: []`);
  lines.push(`  ports: []`);
  lines.push(``);
  lines.push(`intentSignals:`);
  lines.push(`  high: []`);
  lines.push(`  medium: []`);
  lines.push(`  low: []`);
  lines.push(``);
  lines.push(`configs:`);
  lines.push(`  files: []`);
  lines.push(`  globs: []`);
  lines.push(`  sensitivity: review`);
  lines.push(``);
  lines.push(`data:`);
  lines.push(`  paths: []`);
  lines.push(``);
  lines.push(`validate:`);
  lines.push(`  preApply: []`);
  lines.push(`  postApply: []`);
  lines.push(``);
  lines.push(`rollback:`);
  lines.push(`  backupPaths: []`);
  lines.push(`  restartServices: []`);
  lines.push(``);
  lines.push(`security:`);
  lines.push(`  risk: review`);
  lines.push(`  notes:`);
  for (const risk of candidate.risks) lines.push(`    - ${escapeYaml(risk)}`);
  if (candidate.risks.length === 0) lines.push(`    - "Confirm whether this software is part of the user environment."`);
  lines.push(``);
  lines.push(`crossDistro:`);
  lines.push(`  notes: "Fill in distro-specific package names and config paths before raising support level."`);
  return lines.join("\n");
}

function slugify(value: string): string {
  return value.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "draft";
}

function escapeYaml(value: string): string {
  return JSON.stringify(value);
}
