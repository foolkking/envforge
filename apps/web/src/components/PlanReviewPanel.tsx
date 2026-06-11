import React, { useMemo, useState } from "react";
import {
  applyEnvironmentPlan,
  reviewEnvironmentPlan,
  type ApplyGateRefusal,
  type EnvironmentPlan,
  type PlanRequiredApproval,
  type PlanReviewConflict
} from "../api";
import type { Locale } from "../lib/types";

/**
 * PlanReviewPanel — Catalog Audit Enforcement-phase Plan Review UI.
 *
 * Renders three gates:
 *
 *   1. Conflicts (block + warn) — surfaced from `plan.review.conflicts`.
 *      Block-severity conflicts cannot be acknowledged; the operator must
 *      pick a resolution that removes one capability before approve.
 *      Warn-severity conflicts must be ticked.
 *
 *   2. Risk callouts — `item.audit.remainingRisks` per item. Operator
 *      ticks each risk; the apply gate refuses non-dry apply otherwise.
 *
 *   3. Approval gates — `plan.review.approvalsRequired` (aggregated from
 *      each item's `requiredApprovals`). Each gate has a typed kind and
 *      a long-form prompt the operator must read before ticking.
 *
 * The panel calls `/api/plans/:id/review` to persist acknowledgements
 * and request approval, and `/api/plans/:id/apply` (dryRun=false) to run
 * the plan. Both calls forward the gathered acknowledgements so the
 * server-side gate (`evaluateApplyGate`) can confirm them.
 */
export function PlanReviewPanel({
  authToken,
  plan,
  locale,
  onChanged
}: {
  authToken: string;
  plan: EnvironmentPlan;
  locale: Locale;
  onChanged?: (plan: EnvironmentPlan) => void;
}) {
  const [riskAcks, setRiskAcks] = useState<Record<string, Set<string>>>(() => seedRiskAcks(plan));
  const [conflictAcks, setConflictAcks] = useState<Record<string, string | true>>(() => seedConflictAcks(plan));
  const [approvalAcks, setApprovalAcks] = useState<Set<string>>(() => seedApprovalAcks(plan));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [gateRefusal, setGateRefusal] = useState<ApplyGateRefusal | null>(null);

  const conflicts = plan.review.conflicts ?? [];
  const blockingConflicts = useMemo(() => conflicts.filter((c) => c.severity === "block"), [conflicts]);
  const warnConflicts = useMemo(() => conflicts.filter((c) => c.severity === "warn"), [conflicts]);
  const approvalsRequired = plan.review.approvalsRequired ?? [];

  const allRisksAcked = useMemo(() => {
    for (const item of plan.items) {
      const remaining = item.audit?.remainingRisks ?? [];
      if (remaining.length === 0) continue;
      const acked = riskAcks[item.id] ?? new Set<string>();
      for (const risk of remaining) {
        if (!acked.has(risk)) return false;
      }
    }
    return true;
  }, [plan.items, riskAcks]);

  const allWarnConflictsAcked = useMemo(
    () => warnConflicts.every((c) => Boolean(conflictAcks[c.id])),
    [warnConflicts, conflictAcks]
  );

  const allApprovalsAcked = useMemo(
    () => approvalsRequired.every((gate) => approvalAcks.has(approvalKey(gate.itemId, gate.id))),
    [approvalsRequired, approvalAcks]
  );

  const canApprove = blockingConflicts.length === 0 && allRisksAcked && allWarnConflictsAcked && allApprovalsAcked;

  function toggleRisk(itemId: string, risk: string) {
    setRiskAcks((current) => {
      const next = { ...current };
      const set = new Set(next[itemId] ?? []);
      if (set.has(risk)) set.delete(risk);
      else set.add(risk);
      next[itemId] = set;
      return next;
    });
  }

  function toggleConflict(conflictId: string, resolutionId?: string) {
    setConflictAcks((current) => {
      const next = { ...current };
      if (next[conflictId]) {
        delete next[conflictId];
      } else {
        next[conflictId] = resolutionId ?? true;
      }
      return next;
    });
  }

  function toggleApproval(itemId: string, gateId: string) {
    const key = approvalKey(itemId, gateId);
    setApprovalAcks((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleApprove() {
    setBusy(true);
    setError("");
    setGateRefusal(null);
    try {
      const result = await reviewEnvironmentPlan(authToken, plan, {
        decision: "approved",
        acknowledgedRisks: Object.entries(riskAcks).map(([itemId, set]) => ({ itemId, risks: [...set] })),
        acknowledgedConflicts: Object.entries(conflictAcks).map(([conflictId, value]) => ({
          conflictId,
          resolutionId: typeof value === "string" ? value : undefined
        })),
        acknowledgedApprovals: [...approvalAcks].map((key) => {
          const [itemId, gateId] = splitApprovalKey(key);
          return { itemId, gateId };
        })
      });
      onChanged?.(result.plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleApply() {
    setBusy(true);
    setError("");
    setGateRefusal(null);
    try {
      const result = await applyEnvironmentPlan(authToken, plan, false, plan.status !== "approved", {
        acknowledgedRisks: Object.entries(riskAcks).map(([itemId, set]) => ({ itemId, risks: [...set] })),
        acknowledgedConflicts: Object.entries(conflictAcks).map(([conflictId, value]) => ({
          conflictId,
          resolutionId: typeof value === "string" ? value : undefined
        })),
        acknowledgedApprovals: [...approvalAcks].map((key) => {
          const [itemId, gateId] = splitApprovalKey(key);
          return { itemId, gateId };
        })
      });
      if (result.gate) {
        setGateRefusal(result.gate);
      } else {
        onChanged?.(result.plan);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Apply failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="plan-review-panel"
      style={{
        padding: 16,
        background: "#fff",
        borderRadius: 8,
        border: "1px solid #e2e8f0",
        display: "grid",
        gap: 16
      }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>{locale === "zh" ? "计划审查" : "Plan Review"}</h2>
        <span style={{ fontSize: 12, color: "#64748b" }}>
          {plan.type} · {plan.status} · {plan.summary.totalActions} actions · {plan.summary.highRisk} high risk
        </span>
      </header>

      {/* Conflicts section */}
      {conflicts.length > 0 ? (
        <div>
          <h3 style={{ margin: "0 0 8px 0", fontSize: 14 }}>
            {locale === "zh" ? "冲突" : "Conflicts"}
          </h3>
          {blockingConflicts.map((conflict) => (
            <ConflictCard
              key={conflict.id}
              conflict={conflict}
              locale={locale}
              acked={conflictAcks[conflict.id]}
              onPickResolution={undefined /* block-severity has no ack */}
            />
          ))}
          {warnConflicts.map((conflict) => (
            <ConflictCard
              key={conflict.id}
              conflict={conflict}
              locale={locale}
              acked={conflictAcks[conflict.id]}
              onPickResolution={(resolutionId) => toggleConflict(conflict.id, resolutionId)}
            />
          ))}
        </div>
      ) : null}

      {/* Per-item risk callouts */}
      {plan.items.some((item) => (item.audit?.remainingRisks ?? []).length > 0) ? (
        <div>
          <h3 style={{ margin: "0 0 8px 0", fontSize: 14 }}>
            {locale === "zh" ? "审计剩余风险" : "Audit Remaining Risks"}
          </h3>
          {plan.items
            .filter((item) => (item.audit?.remainingRisks ?? []).length > 0)
            .map((item) => (
              <RiskCallout
                key={item.id}
                itemId={item.id}
                itemName={item.name}
                risks={item.audit?.remainingRisks ?? []}
                acked={riskAcks[item.id] ?? new Set()}
                onToggle={(risk) => toggleRisk(item.id, risk)}
                locale={locale}
              />
            ))}
        </div>
      ) : null}

      {/* Approval gates */}
      {approvalsRequired.length > 0 ? (
        <div>
          <h3 style={{ margin: "0 0 8px 0", fontSize: 14 }}>
            {locale === "zh" ? "必需审批" : "Required Approvals"}
          </h3>
          {approvalsRequired.map((gate) => (
            <ApprovalGate
              key={`${gate.itemId}:${gate.id}`}
              gate={gate}
              acked={approvalAcks.has(approvalKey(gate.itemId, gate.id))}
              onToggle={() => toggleApproval(gate.itemId, gate.id)}
              locale={locale}
            />
          ))}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          type="button"
          className="conn-btn conn-btn-ghost"
          onClick={() => void handleApprove()}
          disabled={busy || !canApprove}
          title={!canApprove ? (locale === "zh" ? "请先确认所有风险/冲突/审批门" : "Acknowledge all risks/conflicts/approval gates first") : undefined}
        >
          {busy ? (locale === "zh" ? "处理中..." : "Working…") : (locale === "zh" ? "标记为已批准" : "Mark Approved")}
        </button>
        <button
          type="button"
          className="conn-btn"
          onClick={() => void handleApply()}
          disabled={busy || !canApprove}
        >
          {locale === "zh" ? "执行计划" : "Apply Plan"}
        </button>
      </div>

      {error ? <div style={{ color: "#b91c1c", fontSize: 13 }}>{error}</div> : null}

      {gateRefusal ? (
        <div style={{ background: "#fee2e2", color: "#991b1b", padding: 12, borderRadius: 6, fontSize: 13 }}>
          <strong>{locale === "zh" ? "执行门禁拒绝：" : "Apply gate refused:"}</strong>
          <ul style={{ margin: "6px 0 0 18px" }}>
            {gateRefusal.reasons.map((reason, idx) => (
              <li key={idx}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function ConflictCard({
  conflict,
  locale,
  acked,
  onPickResolution
}: {
  conflict: PlanReviewConflict;
  locale: Locale;
  acked: string | true | undefined;
  onPickResolution?: (resolutionId?: string) => void;
}) {
  const isBlock = conflict.severity === "block";
  return (
    <div
      style={{
        padding: 12,
        marginBottom: 8,
        background: isBlock ? "#fee2e2" : "#fef3c7",
        border: `1px solid ${isBlock ? "#fca5a5" : "#fcd34d"}`,
        borderRadius: 6
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontSize: 11,
            background: isBlock ? "#991b1b" : "#92400e",
            color: "#fff",
            padding: "1px 8px",
            borderRadius: 999,
            textTransform: "uppercase"
          }}
        >
          {conflict.severity}
        </span>
        <strong>{conflict.id}</strong>
        <span style={{ color: "#475569", fontSize: 12 }}>({conflict.type})</span>
      </div>
      <p style={{ margin: "6px 0 8px 0", fontSize: 13 }}>{conflict.reason}</p>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
        {locale === "zh" ? "涉及能力：" : "Capabilities involved: "}
        <code>{conflict.capabilityKeys.join(" / ")}</code>
      </div>
      {isBlock ? (
        <div style={{ fontSize: 12, color: "#991b1b" }}>
          {locale === "zh"
            ? "这是阻塞冲突。请编辑 Plan 移除其中一个能力，然后重新审阅。"
            : "This is a blocking conflict. Edit the plan to drop one capability before review."}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 4 }}>
          {conflict.resolutionOptions.map((option) => (
            <label key={option.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <input
                type="radio"
                name={`conflict-${conflict.id}`}
                checked={acked === option.id}
                onChange={() => onPickResolution?.(option.id)}
              />
              {option.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function RiskCallout({
  itemId,
  itemName,
  risks,
  acked,
  onToggle,
  locale
}: {
  itemId: string;
  itemName: string;
  risks: string[];
  acked: Set<string>;
  onToggle: (risk: string) => void;
  locale: Locale;
}) {
  return (
    <div
      style={{
        padding: 12,
        marginBottom: 8,
        background: "#fffbeb",
        border: "1px solid #fde68a",
        borderRadius: 6
      }}
    >
      <div style={{ fontSize: 13, marginBottom: 6 }}>
        <strong>{itemName}</strong>{" "}
        <span style={{ color: "#64748b", fontSize: 11 }}>({itemId})</span>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
        {risks.map((risk) => (
          <li key={risk} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={acked.has(risk)}
              onChange={() => onToggle(risk)}
              style={{ marginTop: 3 }}
            />
            <span>{risk}</span>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 6, fontSize: 11, color: "#92400e" }}>
        {locale === "zh"
          ? `${acked.size}/${risks.length} 风险已确认`
          : `${acked.size}/${risks.length} risks acknowledged`}
      </div>
    </div>
  );
}

/**
 * Approval kinds the UI must surface as "dangerous" — the operator
 * cannot tick the checkbox alone, they must type a confirmation phrase
 * before the gate is recorded as acknowledged.
 *
 * Mirrors the SSH hardening contract in docs/validation.md.
 */
const DANGEROUS_APPROVAL_KINDS = new Set<PlanRequiredApproval["kind"]>([
  "ssh-lockout-confirm",
  "firewall-lockout-confirm"
]);

function ApprovalGate({
  gate,
  acked,
  onToggle,
  locale
}: {
  gate: PlanRequiredApproval;
  acked: boolean;
  onToggle: () => void;
  locale: Locale;
}) {
  const dangerous = DANGEROUS_APPROVAL_KINDS.has(gate.kind);
  const expectedPhrase = dangerous ? `CONFIRM ${gate.kind.toUpperCase()}` : "";
  const [phrase, setPhrase] = React.useState("");
  const phraseOk = !dangerous || phrase.trim().toUpperCase() === expectedPhrase;

  function handleToggle() {
    if (dangerous && !acked && !phraseOk) return;
    onToggle();
    if (acked) setPhrase("");
  }

  return (
    <div
      style={{
        padding: 12,
        marginBottom: 8,
        background: acked ? "#ecfdf5" : dangerous ? "#fef2f2" : "#f1f5f9",
        border: `1px solid ${acked ? "#86efac" : dangerous ? "#fca5a5" : "#cbd5e1"}`,
        borderRadius: 6
      }}
    >
      <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={acked}
          onChange={handleToggle}
          disabled={dangerous && !acked && !phraseOk}
          style={{ marginTop: 3 }}
        />
        <div>
          <div style={{ fontSize: 13 }}>
            <strong>{gate.label}</strong>{" "}
            <span style={{ background: dangerous ? "#991b1b" : "#475569", color: "#fff", padding: "1px 6px", borderRadius: 4, fontSize: 10, marginLeft: 4 }}>
              {dangerous ? "DANGEROUS · " : ""}{gate.kind}
            </span>
          </div>
          <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#475569" }}>{gate.prompt}</p>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
            {locale === "zh" ? "归属项目: " : "Item: "}
            <code>{gate.itemId}</code>
          </div>
          {dangerous && !acked ? (
            <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
              <span style={{ fontSize: 11, color: "#991b1b" }}>
                {locale === "zh"
                  ? `输入 "${expectedPhrase}" 二次确认（高风险门）`
                  : `Type "${expectedPhrase}" to second-confirm (dangerous gate).`}
              </span>
              <input
                type="text"
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                placeholder={expectedPhrase}
                style={{ fontSize: 12, padding: 4, border: `1px solid ${phraseOk ? "#86efac" : "#fca5a5"}`, borderRadius: 4 }}
              />
            </div>
          ) : null}
        </div>
      </label>
    </div>
  );
}

function approvalKey(itemId: string, gateId: string): string {
  return `${itemId}::${gateId}`;
}

function splitApprovalKey(key: string): [string, string] {
  const idx = key.indexOf("::");
  if (idx < 0) return [key, ""];
  return [key.slice(0, idx), key.slice(idx + 2)];
}

function seedRiskAcks(plan: EnvironmentPlan): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {};
  for (const [itemId, risks] of Object.entries(plan.approvals?.risks ?? {})) {
    out[itemId] = new Set(risks);
  }
  return out;
}

function seedConflictAcks(plan: EnvironmentPlan): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (const entry of plan.approvals?.conflicts ?? []) {
    out[entry.conflictId] = entry.resolutionId ?? true;
  }
  return out;
}

function seedApprovalAcks(plan: EnvironmentPlan): Set<string> {
  const out = new Set<string>();
  for (const entry of plan.approvals?.approvals ?? []) {
    out.add(approvalKey(entry.itemId, entry.gateId));
  }
  return out;
}
