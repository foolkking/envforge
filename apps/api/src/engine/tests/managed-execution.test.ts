/**
 * managed-execution.test.ts — exercises runManagedAction through its
 * complete lifecycle using a mock adapter (no SSH involved).
 *
 * Covers the Managed Execution Hardening contract:
 *   - happy path (snapshot → apply → verify → succeeded).
 *   - apply failure rolls back.
 *   - verify failure rolls back.
 *   - rollback failure surfaces rollback-failed.
 *   - detect-only items short-circuit to manual-required.
 *   - non-mutating actions (review / validate) short-circuit to skipped.
 *   - secret redaction is applied to apply / verify / rollback / error.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { runManagedAction, type ManagedExecutionAdapter } from "../../managed-execution.js";
import type {
  ActionApplyResult,
  ActionRollbackResult,
  ActionVerifyResult
} from "../../action-runs.js";
import type {
  EnvironmentPlan,
  EnvironmentPlanAction,
  EnvironmentPlanItem
} from "../../environment-plan.js";

function plan(overrides: Partial<EnvironmentPlan> = {}): EnvironmentPlan {
  return {
    id: "plan-1",
    type: "rebuild",
    status: "approved",
    name: "Rebuild Plan",
    targetConnectionId: "conn-1",
    generatedAt: new Date().toISOString(),
    summary: { totalItems: 1, totalActions: 1, highRisk: 0, requiresSudo: 1, rollbackable: 1 },
    review: { required: false, reasons: [] },
    items: [],
    ...overrides
  };
}

function item(overrides: Partial<EnvironmentPlanItem> = {}): EnvironmentPlanItem {
  return {
    id: "capability:nginx-web-service",
    name: "Nginx",
    type: "capability",
    capabilityKey: "web-server.nginx",
    supportLevel: "full-migration",
    audit: { supportLevel: "full-migration" },
    risks: [],
    evidence: [],
    actions: [],
    userDecision: "approved",
    ...overrides
  };
}

function action(overrides: Partial<EnvironmentPlanAction> = {}): EnvironmentPlanAction {
  return {
    id: "install",
    kind: "installPackage",
    label: "Install nginx",
    packageNames: ["nginx"],
    requiresSudo: true,
    changesTarget: true,
    canRollback: true,
    risk: "review",
    ...overrides
  };
}

function ok(): ActionApplyResult { return { ok: true, message: "applied", steps: [{ label: "step", ok: true }] }; }
function fail(message: string): ActionApplyResult { return { ok: false, message, steps: [{ label: "step", ok: false, message }] }; }
function vok(): ActionVerifyResult { return { ok: true, message: "verified", checks: [{ command: "true", ok: true, output: "" }] }; }
function vfail(message: string): ActionVerifyResult { return { ok: false, message, checks: [{ command: "false", ok: false, output: message }] }; }
function rok(): ActionRollbackResult { return { ok: true, message: "rolled-back", steps: [{ label: "restore", ok: true }] }; }
function rfail(message: string): ActionRollbackResult { return { ok: false, message, steps: [{ label: "restore", ok: false, message }] }; }

function adapter(custom: Partial<ManagedExecutionAdapter> = {}): ManagedExecutionAdapter {
  return {
    snapshot: async () => ({ kind: "config-file", capturedAt: new Date().toISOString() }),
    apply: async () => ok(),
    verify: async () => vok(),
    rollback: async () => rok(),
    ...custom
  };
}

// ───────────────────────────────────────────────────────────────────

test("managed-execution: happy path runs snapshot → apply → verify → succeeded", async () => {
  const a = action();
  const i = item({ actions: [a] });
  const p = plan({ items: [i] });
  const result = await runManagedAction({ plan: p, item: i, action: a, adapter: adapter() });
  assert.equal(result.status, "succeeded");
  assert.ok(result.snapshot);
  assert.ok(result.applyResult?.ok);
  assert.ok(result.verifyResult?.ok);
  assert.ok(!result.error);
  assert.ok(result.endedAt);
});

test("managed-execution: apply failure → failed → rolling-back → rolled-back", async () => {
  const a = action();
  const i = item({ actions: [a] });
  const p = plan({ items: [i] });
  const result = await runManagedAction({
    plan: p,
    item: i,
    action: a,
    adapter: adapter({ apply: async () => fail("boom") })
  });
  assert.equal(result.status, "rolled-back");
  assert.ok(result.rollbackResult?.ok);
  assert.match(result.error ?? "", /\[apply\]/);
});

test("managed-execution: verify failure rolls back", async () => {
  const a = action();
  const i = item({ actions: [a] });
  const p = plan({ items: [i] });
  const result = await runManagedAction({
    plan: p,
    item: i,
    action: a,
    adapter: adapter({ verify: async () => vfail("syntax error") })
  });
  assert.equal(result.status, "rolled-back");
  assert.match(result.error ?? "", /\[verify\]/);
});

test("managed-execution: rollback failure surfaces rollback-failed", async () => {
  const a = action();
  const i = item({ actions: [a] });
  const p = plan({ items: [i] });
  const result = await runManagedAction({
    plan: p,
    item: i,
    action: a,
    adapter: adapter({ apply: async () => fail("apply broke"), rollback: async () => rfail("backup missing") })
  });
  assert.equal(result.status, "rollback-failed");
  assert.equal(result.rollbackResult?.ok, false);
});

test("managed-execution: rollback throws → rollback-failed (defensive path)", async () => {
  const a = action();
  const i = item({ actions: [a] });
  const p = plan({ items: [i] });
  const result = await runManagedAction({
    plan: p,
    item: i,
    action: a,
    adapter: adapter({
      apply: async () => fail("apply broke"),
      rollback: async () => {
        throw new Error("rollback exploded");
      }
    })
  });
  assert.equal(result.status, "rollback-failed");
  assert.match(result.rollbackResult?.message ?? "", /rollback exploded/);
});

test("managed-execution: detect-only items go directly to manual-required", async () => {
  const a = action({ kind: "review" });
  const i = item({
    audit: { supportLevel: "detect-only" },
    supportLevel: "detect-only",
    actions: [a]
  });
  const p = plan({ items: [i] });
  const result = await runManagedAction({ plan: p, item: i, action: a, adapter: adapter() });
  assert.equal(result.status, "manual-required");
  assert.match(result.error ?? "", /Detect-only/);
});

test("managed-execution: non-mutating actions (review/validate) short-circuit to skipped", async () => {
  for (const kind of ["review", "validate", "manualStep"] as const) {
    const a = action({ kind, canRollback: false });
    const i = item({ actions: [a] });
    const p = plan({ items: [i] });
    const result = await runManagedAction({ plan: p, item: i, action: a, adapter: adapter() });
    assert.equal(result.status, "skipped", `kind=${kind} should skip`);
  }
});

test("managed-execution: action with canRollback=false stays at failed (no rollback attempt)", async () => {
  const a = action({ canRollback: false });
  const i = item({ actions: [a] });
  const p = plan({ items: [i] });
  const result = await runManagedAction({
    plan: p,
    item: i,
    action: a,
    adapter: adapter({ apply: async () => fail("permission denied") })
  });
  assert.equal(result.status, "failed");
  assert.equal(result.rollbackResult, undefined);
});

test("managed-execution: stdout/stderr captured via drainOutput is redacted", async () => {
  const a = action();
  const i = item({ actions: [a] });
  const p = plan({ items: [i] });
  let drained = false;
  const result = await runManagedAction({
    plan: p,
    item: i,
    action: a,
    adapter: adapter({
      drainOutput: () => {
        if (drained) return { stdout: "", stderr: "" };
        drained = true;
        return {
          stdout: "API_KEY=sk-real-secret-token-here-xx ok",
          stderr: "Authorization: Bearer abc123def456ghi789"
        };
      }
    })
  });
  assert.equal(result.status, "succeeded");
  assert.equal(result.redacted, true);
  assert.doesNotMatch(result.stdoutPreview ?? "", /sk-real-secret-token/);
  assert.doesNotMatch(result.stderrPreview ?? "", /abc123def456ghi789/);
});

test("managed-execution: apply error message is redacted before storage", async () => {
  const a = action();
  const i = item({ actions: [a] });
  const p = plan({ items: [i] });
  const result = await runManagedAction({
    plan: p,
    item: i,
    action: a,
    adapter: adapter({
      apply: async () => {
        throw new Error("apt failed: API_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz0123456789");
      }
    })
  });
  assert.equal(result.status, "rolled-back");
  assert.doesNotMatch(result.error ?? "", /ghp_abcdefghijklmnopqrstuvwxyz/);
  assert.match(result.error ?? "", /REDACTED-GH-TOKEN/);
});

test("managed-execution: verify checks output is redacted", async () => {
  const a = action();
  const i = item({ actions: [a] });
  const p = plan({ items: [i] });
  const result = await runManagedAction({
    plan: p,
    item: i,
    action: a,
    adapter: adapter({
      verify: async () => ({
        ok: true,
        message: "ok",
        checks: [
          {
            command: "cat /etc/secrets",
            ok: true,
            output: "PASSWORD=mysupersecretvalue"
          }
        ]
      })
    })
  });
  assert.equal(result.status, "succeeded");
  assert.doesNotMatch(result.verifyResult?.checks?.[0]?.output ?? "", /mysupersecretvalue/);
});
