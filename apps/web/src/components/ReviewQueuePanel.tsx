import { Button } from "./ui/Button";
import { FilterPill } from "./ui/FilterPill";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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

const REVIEW_LABEL_KEYS = {
  all: "reviewQueue.decisions.all",
  pending: "reviewQueue.decisions.pending",
  approved: "reviewQueue.decisions.approved",
  skipped: "reviewQueue.decisions.skipped",
  ignore: "reviewQueue.decisions.ignore",
  "record-only": "reviewQueue.decisions.recordOnly",
  "migrate-artifact": "reviewQueue.decisions.migrateArtifact",
  "create-catalog-draft": "reviewQueue.decisions.createCatalogDraft",
  "add-to-plan": "reviewQueue.decisions.addToPlan",
  "needs-manual-instruction": "reviewQueue.decisions.needsManualInstruction"
} as const satisfies Record<ReviewDecision | "all", string>;

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
  const { t } = useTranslation();
  const labelFor = (value: ReviewDecision | "all") => t(REVIEW_LABEL_KEYS[value]);
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
      setError(err instanceof Error ? err.message : t("reviewQueue.errors.load"));
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
      setError(err instanceof Error ? err.message : t("reviewQueue.errors.save"));
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
      setError(err instanceof Error ? err.message : t("reviewQueue.errors.bulk"));
    } finally {
      setBulkSaving(false);
    }
  }

  return (
    <section className="panel-large review-queue-panel" style={{ padding: 16 }}>
      <div className="panel-heading" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>{t("reviewQueue.title")}</h2>
        <span className="panel-count">{filteredCandidates.length} / {candidates.length}</span>
      </div>
      <p style={{ margin: "8px 0", color: "var(--ef-muted)", fontSize: 13 }}>{t("reviewQueue.intro")}</p>

      <div className="review-queue-toolbar" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
        {(["all", "pending", "approved", "ignore", "record-only", "migrate-artifact", "add-to-plan", "create-catalog-draft", "needs-manual-instruction", "skipped"] as const).map((value) => (
          <FilterPill
            key={value}
            active={filter === value}
            onClick={() => setFilter(value)}
          >
            {labelFor(value)}
          </FilterPill>
        ))}
        <span style={{ flex: 1 }} />
        <Button variant="connectionGhost" type="button"  onClick={() => void loadAll()} disabled={loading}>
          {loading ? t("reviewQueue.refreshing") : t("reviewQueue.refresh")}
        </Button>
      </div>

      {selected.size > 0 ? (
        <div className="review-queue-bulk" style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: 10, background: "var(--ef-surface-soft)", borderRadius: 6, marginBottom: 12 }}>
          <strong style={{ marginRight: 8, fontSize: 13 }}>
            {t("reviewQueue.selected", { count: selected.size })}
          </strong>
          {(["add-to-plan", "ignore", "record-only", "migrate-artifact", "needs-manual-instruction", "skipped"] as ReviewDecision[]).map((decision) => (
            <Button variant="connectionGhost" key={decision} type="button"  onClick={() => void applyBulk(decision)} disabled={bulkSaving}>
              {labelFor(decision)}
            </Button>
          ))}
          <Button variant="connectionGhost" type="button"  onClick={() => setSelected(new Set())}>
            {t("reviewQueue.clearSelection")}
          </Button>
        </div>
      ) : null}

      <div className="review-queue-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 12 }}>
        <div className="review-queue-list" style={{ display: "grid", gap: 8, maxHeight: 540, overflow: "auto" }}>
          {filteredCandidates.length === 0 ? (
            <div className="filter-status">
              {t("reviewQueue.empty")}
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
                    {labelFor(decision)}
                  </span>
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: "var(--ef-muted)" }}>
                  {t("reviewQueue.confidence")}: {Math.round(candidate.confidence * 100)}% · band {candidate.band}
                </div>
              </div>
            );
          })}
        </div>

        <aside className="review-queue-detail" style={{ padding: 12, border: "1px solid var(--ef-border)", borderRadius: 6, background: "#fafafa", maxHeight: 540, overflow: "auto" }}>
          {!active ? (
            <p style={{ color: "var(--ef-muted)", fontSize: 13 }}>
              {t("reviewQueue.selectPrompt")}
            </p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <header>
                <strong style={{ fontSize: 16 }}>{active.name}</strong>
                <div style={{ color: "var(--ef-muted)", fontSize: 12 }}>{active.source} · {active.version || "-"}</div>
              </header>
              <Section title={t("reviewQueue.migrationClass")}>
                <code>{active.migrationClass}</code>
              </Section>
              {active.catalogRuleId ? (
                <Section title={t("reviewQueue.catalogRule")}>
                  <code>{active.catalogRuleId}</code> {active.catalogRuleName ? `(${active.catalogRuleName})` : ""}
                </Section>
              ) : null}
              <Section title={t("reviewQueue.evidence")}>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--ef-text)" }}>
                  {active.reasons.map((reason, idx) => <li key={`reason-${idx}`}>{reason}</li>)}
                </ul>
              </Section>
              {active.risks.length ? (
                <Section title={t("reviewQueue.risks")}>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#7c2d12" }}>
                    {active.risks.map((risk, idx) => <li key={`risk-${idx}`}>{risk}</li>)}
                  </ul>
                </Section>
              ) : null}
              {active.recommendedActions.length ? (
                <Section title={t("reviewQueue.recommendedActions")}>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--ef-text)" }}>
                    {active.recommendedActions.map((action, idx) => <li key={`act-${idx}`}>{action}</li>)}
                  </ul>
                </Section>
              ) : null}

              <Section title={t("reviewQueue.applyDecision")}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {(["approved", "add-to-plan", "migrate-artifact", "ignore", "record-only", "create-catalog-draft", "needs-manual-instruction", "skipped"] as ReviewDecision[]).map((decision) => (
                    <Button variant="connectionGhost"
                      key={decision}
                      type="button"

                      onClick={() => void applyDecision(active.id, decision)}
                      disabled={savingId === active.id}
                    >
                      {labelFor(decision)}
                    </Button>
                  ))}
                </div>
              </Section>

              {draftFor?.id === active.id && draftYaml ? (
                <Section title={t("reviewQueue.catalogDraft")}>
                  <textarea
                    readOnly
                    value={draftYaml}
                    style={{ width: "100%", minHeight: 220, fontFamily: "monospace", fontSize: 12 }}
                  />
                  <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                    <Button variant="connectionGhost" type="button"  onClick={() => void navigator.clipboard.writeText(draftYaml)}>
                      {t("reviewQueue.copyYaml")}
                    </Button>
                    <Button variant="connectionGhost" type="button"  onClick={() => downloadAsFile(`${active.id}.catalog-draft.yaml`, draftYaml)}>
                      {t("reviewQueue.download")}
                    </Button>
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
