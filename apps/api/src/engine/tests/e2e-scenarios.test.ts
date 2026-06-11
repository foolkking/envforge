/**
 * e2e-scenarios.test.ts
 *
 * End-to-End Scenario Validation for the EnvForge Catalog Audit
 * Enforcement phase.
 *
 * Each scenario in `docs/validation.md` has at least one
 * test below. The tests exercise the full **server-side** decision
 * pipeline:
 *
 *   capability-selection → buildRebuildPlan → conflicts/approvals →
 *     evaluateApplyGate (block recompute + resolutionId validation +
 *     detect-only check) → buildPlanReport
 *
 * The tests intentionally use the catalog loaded via
 * `listCatalogFromDatabase` (the merged + audited catalog) so they cover
 * the actual production behaviour, not synthetic stubs.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  attachConflictsAndApprovalAggregate,
  buildPlanReport,
  buildRebuildPlan,
  computeEffectiveSupportLevel,
  evaluateApplyGate,
  planReportToMarkdown,
  type EnvironmentPlan
} from "../../environment-plan.js";
import { listCatalogFromDatabase } from "../../database.js";
import type { CatalogItem } from "../../catalog.js";

async function loadItems(...ids: string[]): Promise<CatalogItem[]> {
  const all = await listCatalogFromDatabase();
  return ids
    .map((id) => all.find((item) => item.id === id))
    .filter((item): item is CatalogItem => Boolean(item));
}

function fullAck(plan: EnvironmentPlan): {
  risks: Record<string, string[]>;
  conflicts: Array<{ conflictId: string; resolutionId?: string }>;
  approvals: Array<{ itemId: string; gateId: string }>;
} {
  const risks: Record<string, string[]> = {};
  for (const item of plan.items) {
    const remaining = item.audit?.remainingRisks ?? [];
    if (remaining.length > 0) risks[item.id] = [...remaining];
  }
  const approvals = (plan.review.approvalsRequired ?? []).map((gate) => ({
    itemId: gate.itemId,
    gateId: gate.id
  }));
  return { risks, conflicts: [], approvals };
}

// ───────────────────────────────────────────────────────────────────
// Scenario 1: Build Nginx + Docker (no conflict)
// ───────────────────────────────────────────────────────────────────

test("e2e scenario 1: nginx + docker rebuild has no block conflict and surfaces only safe approvals", async () => {
  const items = await loadItems("nginx-web-service", "docker-host-profile");
  assert.equal(items.length, 2);
  const plan = buildRebuildPlan(items, "conn-1");
  assert.equal(plan.type, "rebuild");
  assert.equal(plan.summary.totalItems, 2);
  // No block conflicts
  const conflicts = plan.review.conflicts ?? [];
  assert.equal(
    conflicts.filter((c) => c.severity === "block").length,
    0,
    "no block conflicts expected"
  );
  // Apply gate should pass once risks/approvals are acked.
  const ack = fullAck(plan);
  const verdict = evaluateApplyGate(plan, ack);
  assert.equal(verdict.ok, true, `gate refused: ${verdict.reasons.join("; ")}`);
});

// ───────────────────────────────────────────────────────────────────
// Scenario 2: Build Nginx + Caddy (block conflict)
// ───────────────────────────────────────────────────────────────────

test("e2e scenario 2: nginx + caddy produces http-frontend block conflict and refuses approve/apply", async () => {
  const items = await loadItems("nginx-web-service", "caddy-server");
  assert.equal(items.length, 2, "both items must be in the catalog");
  const plan = buildRebuildPlan(items, "conn-2");
  const block = (plan.review.conflicts ?? []).find((c) => c.id === "http-frontend");
  assert.ok(block, "http-frontend conflict must trigger");
  assert.equal(block?.severity, "block");
  // Even with forged acknowledgements, gate must refuse.
  const verdict = evaluateApplyGate(plan, {
    risks: {},
    conflicts: [{ conflictId: "http-frontend", resolutionId: "keep-nginx" }],
    approvals: []
  });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.blockingConflicts.length, 1);
  assert.equal(verdict.blockingConflicts[0].id, "http-frontend");
});

test("e2e scenario 2b: server-side recomputes block conflicts even if plan.review.conflicts was tampered with", async () => {
  const items = await loadItems("nginx-web-service", "caddy-server");
  const plan = buildRebuildPlan(items, "conn-2b");
  // Simulate a malicious client wiping plan.review.conflicts.
  const tampered: EnvironmentPlan = {
    ...plan,
    review: { ...plan.review, conflicts: [] }
  };
  const verdict = evaluateApplyGate(tampered, {});
  assert.equal(verdict.ok, false);
  // The block conflict is still detected because we recompute from
  // plan.items[*].capabilityKey.
  assert.equal(verdict.blockingConflicts.length, 1);
  assert.equal(verdict.blockingConflicts[0].id, "http-frontend");
});

// ───────────────────────────────────────────────────────────────────
// Scenario 3: Build Keycloak + Authelia (warn conflict)
// ───────────────────────────────────────────────────────────────────

test("e2e scenario 3: keycloak + authelia warn conflict can be acked with a valid resolutionId", async () => {
  const items = await loadItems("keycloak", "authelia");
  assert.equal(items.length, 2);
  const plan = buildRebuildPlan(items, "conn-3");
  const idp = (plan.review.conflicts ?? []).find((c) => c.id === "identity-provider");
  assert.ok(idp);
  assert.equal(idp?.severity, "warn");
  // Build a complete ack set for risks + approvals, plus a valid
  // conflict resolution.
  const ack = fullAck(plan);
  ack.conflicts = [{ conflictId: "identity-provider", resolutionId: "ack-multi-idp" }];
  const verdict = evaluateApplyGate(plan, ack);
  assert.equal(verdict.ok, true, `gate refused: ${verdict.reasons.join("; ")}`);
});

test("e2e scenario 3b: invalid resolutionId on a warn conflict is rejected", async () => {
  const items = await loadItems("keycloak", "authelia");
  const plan = buildRebuildPlan(items, "conn-3b");
  const ack = fullAck(plan);
  ack.conflicts = [{ conflictId: "identity-provider", resolutionId: "bogus-resolution" }];
  const verdict = evaluateApplyGate(plan, ack);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.invalidResolutionIds.length, 1);
  assert.equal(verdict.invalidResolutionIds[0].resolutionId, "bogus-resolution");
});

// ───────────────────────────────────────────────────────────────────
// Scenario 4: SSH hardening (remainingRisks + ssh-lockout-confirm)
// ───────────────────────────────────────────────────────────────────

test("e2e scenario 4: ssh-hardening apply refuses without remainingRisks and ssh-lockout gates", async () => {
  const items = await loadItems("ssh-hardening");
  assert.equal(items.length, 1);
  const plan = buildRebuildPlan(items, "conn-4");
  const item = plan.items[0];
  assert.ok((item.audit?.remainingRisks ?? []).length > 0, "ssh-hardening must carry remainingRisks");
  const sshLockout = (plan.review.approvalsRequired ?? []).find(
    (gate) => gate.kind === "ssh-lockout-confirm"
  );
  assert.ok(sshLockout, "ssh-lockout-confirm gate must be aggregated onto plan.review.approvalsRequired");

  // Without acks, gate refuses.
  const refusal = evaluateApplyGate(plan, {});
  assert.equal(refusal.ok, false);
  assert.ok(refusal.missingRiskAcks.length > 0);
  assert.ok(refusal.missingApprovalGates.length > 0);
});

test("e2e scenario 4b: ssh-hardening apply gate passes once all gates are acked", async () => {
  const items = await loadItems("ssh-hardening");
  const plan = buildRebuildPlan(items, "conn-4b");
  const ack = fullAck(plan);
  const verdict = evaluateApplyGate(plan, ack);
  assert.equal(verdict.ok, true, `gate refused: ${verdict.reasons.join("; ")}`);
});

// ───────────────────────────────────────────────────────────────────
// Scenario 5: Migrate Redis or PostgreSQL (data strategy)
// ───────────────────────────────────────────────────────────────────

test("e2e scenario 5: redis migration plan records dataStrategy=dump-restore (not raw rsync)", async () => {
  const items = await loadItems("redis-server");
  assert.equal(items.length, 1);
  const plan = buildRebuildPlan(items, "conn-5");
  const report = buildPlanReport(plan);
  const decision = report.dataStrategyDecisions.find(
    (d) => d.itemId === plan.items[0].id
  );
  assert.ok(decision);
  assert.equal(decision?.strategy, "dump-restore");
  assert.match(decision?.evidence ?? "", /SAVE|BGSAVE|catalog audit/i);
});

test("e2e scenario 5c: Redis requires data strategy approval and reports manual RDB/AOF review", async () => {
  const items = await loadItems("redis-server");
  const plan = buildRebuildPlan(items, "conn-5c");
  const gates = plan.review.approvalsRequired ?? [];
  assert.ok(gates.some((gate) => gate.kind === "data-strategy-confirm"));
  const manual = plan.items[0].actions.find((action) => action.id.endsWith(":manual:data-strategy"));
  assert.ok(manual, "Redis plan must include a structured manual data-strategy step");
  assert.match(manual?.label ?? "", /RDB\/AOF/);
  const report = buildPlanReport(plan);
  assert.ok(
    report.unresolvedManualSteps.some((step) => step.actionId.endsWith(":manual:data-strategy")),
    "Plan Report must surface the Redis manual data-strategy step"
  );
  assert.ok(!report.dataStrategyDecisions.some((decision) => decision.strategy === "raw-rsync"));
});

test("e2e scenario 5b: postgres migration plan records dataStrategy=dump-restore", async () => {
  const items = await loadItems("postgres-profile");
  const plan = buildRebuildPlan(items, "conn-5b");
  assert.ok((plan.review.approvalsRequired ?? []).some((gate) => gate.kind === "data-strategy-confirm"));
  assert.ok(
    plan.items[0].actions.some((action) => action.id.endsWith(":manual:data-strategy")),
    "PostgreSQL plan must include a structured dump/restore data strategy step"
  );
  const report = buildPlanReport(plan);
  const decision = report.dataStrategyDecisions[0];
  assert.equal(decision.strategy, "dump-restore");
  assert.match(decision.evidence, /pg_dump|pg_restore|catalog audit/);
});

test("e2e scenario 5d: mysql migration plan records dataStrategy=dump-restore", async () => {
  const items = await loadItems("mysql-server");
  const plan = buildRebuildPlan(items, "conn-5d");
  assert.ok((plan.review.approvalsRequired ?? []).some((gate) => gate.kind === "data-strategy-confirm"));
  assert.ok(
    plan.items[0].actions.some((action) => action.id.endsWith(":manual:data-strategy")),
    "MySQL plan must include a structured dump/restore data strategy step"
  );
  const verify = plan.items[0].actions.find((action) => action.id.endsWith(":verify"));
  assert.match(verify?.command ?? "", /mysqladmin ping|select 1/);
  const report = buildPlanReport(plan);
  const decision = report.dataStrategyDecisions[0];
  assert.equal(decision.strategy, "dump-restore");
  assert.match(decision.evidence, /mysqldump|catalog audit/i);
});

test("e2e scenario 5e: certbot-ssl requires private key and DNS approvals without live ACME", async () => {
  const items = await loadItems("certbot-ssl");
  const plan = buildRebuildPlan(items, "conn-5e");
  const gates = plan.review.approvalsRequired ?? [];
  assert.ok(gates.some((gate) => gate.kind === "secret-confirm"));
  assert.ok(gates.some((gate) => gate.kind === "manual-dns-confirm"));
  assert.ok(plan.items[0].actions.some((action) => action.id.endsWith(":manual:domain-ownership")));
  assert.ok(plan.items[0].actions.some((action) => action.id.endsWith(":manual:private-keys")));
  const verify = plan.items[0].actions.find((action) => action.id.endsWith(":verify"));
  assert.match(verify?.command ?? "", /certbot certificates/);
  const report = buildPlanReport(plan);
  const decision = report.dataStrategyDecisions[0];
  assert.equal(decision.strategy, "manual-review");
  assert.ok(!report.dataStrategyDecisions.some((d) => d.strategy === "raw-rsync"));
});

test("e2e scenario 5f: node and python runtime plans surface token/package review", async () => {
  const items = await loadItems("node-runtime-profile", "python-toolchain");
  const plan = buildRebuildPlan(items, "conn-5f");
  const gates = plan.review.approvalsRequired ?? [];
  assert.ok(gates.filter((gate) => gate.kind === "secret-confirm").length >= 2);
  assert.ok(
    plan.items.some((item) => item.actions.some((action) => action.id.endsWith(":manual:global-packages"))),
    "Node plan must include global npm package review"
  );
  assert.ok(
    plan.items.some((item) => item.actions.some((action) => action.id.endsWith(":manual:user-packages"))),
    "Python plan must include pipx/venv/user package review"
  );
  const verifyCommands = plan.items.flatMap((item) => item.actions).map((action) => action.command ?? "").join("\n");
  assert.match(verifyCommands, /node --version/);
  assert.match(verifyCommands, /python3 --version/);
});

test("e2e scenario 5g: caddy-server surfaces ACME and upstream review", async () => {
  const items = await loadItems("caddy-server");
  const plan = buildRebuildPlan(items, "conn-5g");
  assert.ok((plan.review.approvalsRequired ?? []).some((gate) => gate.kind === "secret-confirm"));
  assert.ok((plan.review.approvalsRequired ?? []).some((gate) => gate.kind === "manual-dns-confirm"));
  assert.ok(plan.items[0].actions.some((action) => action.id.endsWith(":manual:acme-storage")));
  assert.ok(plan.items[0].actions.some((action) => action.id.endsWith(":manual:site-upstreams")));
  const verify = plan.items[0].actions.find((action) => action.id.endsWith(":verify"));
  assert.match(verify?.command ?? "", /caddy validate/);
  const report = buildPlanReport(plan);
  assert.equal(report.dataStrategyDecisions[0].strategy, "manual-review");
});

test("e2e scenario 5h: openresty surfaces Lua module and TLS reference review", async () => {
  const items = await loadItems("openresty");
  const plan = buildRebuildPlan(items, "conn-5h");
  assert.ok((plan.review.approvalsRequired ?? []).some((gate) => gate.kind === "secret-confirm"));
  assert.ok(plan.items[0].actions.some((action) => action.id.endsWith(":manual:lua-modules")));
  const verify = plan.items[0].actions.find((action) => action.id.endsWith(":verify"));
  assert.match(verify?.command ?? "", /openresty -t/);
  const report = buildPlanReport(plan);
  assert.equal(report.dataStrategyDecisions[0].strategy, "manual-review");
});

test("e2e scenario 5i: traefik-proxy surfaces ACME/provider review", async () => {
  const items = await loadItems("traefik-proxy");
  const plan = buildRebuildPlan(items, "conn-5i");
  assert.ok((plan.review.approvalsRequired ?? []).some((gate) => gate.kind === "secret-confirm"));
  assert.ok((plan.review.approvalsRequired ?? []).some((gate) => gate.kind === "manual-dns-confirm"));
  assert.ok(plan.items[0].actions.some((action) => action.id.endsWith(":manual:acme-storage")));
  assert.ok(plan.items[0].actions.some((action) => action.id.endsWith(":manual:providers")));
  const verify = plan.items[0].actions.find((action) => action.id.endsWith(":verify"));
  assert.match(verify?.command ?? "", /traefik healthcheck/);
  const report = buildPlanReport(plan);
  assert.equal(report.dataStrategyDecisions[0].strategy, "manual-review");
});

// ───────────────────────────────────────────────────────────────────
// Scenario 6: LEMP combo (effective support level)
// ───────────────────────────────────────────────────────────────────

test("e2e scenario 6: lemp-stack combo effectiveSupportLevel reflects certified combo depth", async () => {
  const items = await loadItems("lemp-stack");
  assert.equal(items.length, 1);
  const plan = buildRebuildPlan(items, "conn-6");
  // The combo now has its own rule and harness, so it can stand beside
  // php-fpm without lowering the effective plan support level.
  const phpFpm = await loadItems("php-fpm");
  const combinedPlan = buildRebuildPlan([...items, ...phpFpm], "conn-6");
  const effective = computeEffectiveSupportLevel(combinedPlan.items);
  assert.equal(effective, "full-migration");
  assert.equal(combinedPlan.summary.effectiveSupportLevel, "full-migration");
});

test("e2e scenario 6b: detect-only items in a plan are reported as skipped", async () => {
  const items = await loadItems("nginx-web-service", "systemd-resolved");
  const plan = buildRebuildPlan(items, "conn-6b");
  const report = buildPlanReport(plan);
  assert.ok(report.skippedDetectOnlyItems.includes("capability:systemd-resolved"));
});

// ───────────────────────────────────────────────────────────────────
// Detect-only items must never produce direct apply actions.
// ───────────────────────────────────────────────────────────────────

test("e2e: detect-only catalog items emit only review actions", async () => {
  const items = await loadItems("systemd-resolved", "certbot-letsencrypt");
  for (const item of items) {
    assert.equal(item.supportLevel, "detect-only", `${item.id} must be detect-only`);
  }
  const plan = buildRebuildPlan(items, "conn-detect");
  for (const planItem of plan.items) {
    for (const action of planItem.actions) {
      assert.equal(
        action.kind,
        "review",
        `detect-only item ${planItem.id} produced non-review action ${action.kind}:${action.id}`
      );
    }
  }
});

test("e2e: detect-only items with mutating actions are rejected by the apply gate", async () => {
  const items = await loadItems("systemd-resolved");
  const plan = buildRebuildPlan(items, "conn-detect-violation");
  // Synthesize a malicious plan that adds a mutating action to a
  // detect-only item.
  const tampered: EnvironmentPlan = {
    ...plan,
    items: plan.items.map((it) => ({
      ...it,
      actions: [
        ...it.actions,
        {
          id: `${it.id}:install:systemd-resolved`,
          kind: "installPackage",
          label: "Install systemd-resolved (forged)",
          packageNames: ["systemd-resolved"],
          requiresSudo: true,
          changesTarget: true,
          canRollback: true,
          risk: "high"
        }
      ]
    }))
  };
  const ack = fullAck(tampered);
  const verdict = evaluateApplyGate(tampered, ack);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.detectOnlyViolations.length >= 1);
  assert.equal(verdict.detectOnlyViolations[0].itemId, "capability:systemd-resolved");
});

// ───────────────────────────────────────────────────────────────────
// Block conflict resolution consistency.
// ───────────────────────────────────────────────────────────────────

test("e2e: block conflict cannot be bypassed by a fake conflict ack", async () => {
  const items = await loadItems("firewall-baseline", "firewalld");
  const plan = buildRebuildPlan(items, "conn-fwbypass");
  // Fake ack that the operator chose keep-ufw, then claim done.
  const verdict = evaluateApplyGate(plan, {
    risks: {},
    conflicts: [{ conflictId: "firewall-stack", resolutionId: "keep-ufw" }],
    approvals: []
  });
  assert.equal(verdict.ok, false, "block conflict cannot be acked");
  assert.equal(verdict.blockingConflicts.length, 1);
  // Additionally, since the plan still contains both ufw + firewalld,
  // the resolution is inconsistent and surfaced explicitly.
  assert.ok(
    verdict.inconsistentResolutions.find((r) => r.conflictId === "firewall-stack"),
    "inconsistent resolution must be flagged"
  );
});

test("e2e: firewall-baseline carries safeFirewallApply, SSH guard, rollback, and approval gate", async () => {
  const items = await loadItems("firewall-baseline");
  assert.equal(items.length, 1);
  const plan = buildRebuildPlan(items, "conn-firewall");
  assert.equal(plan.items[0].supportLevel, "full-migration");
  assert.ok((plan.review.approvalsRequired ?? []).some((gate) => gate.kind === "firewall-lockout-confirm"));
  const safeApply = plan.items[0].actions.find((action) => action.id.endsWith(":safe-apply"));
  assert.ok(safeApply, "firewall-baseline must expose safeFirewallApply action");
  assert.match(safeApply?.command ?? "", /Refusing firewall apply: current SSH port unknown/);
  assert.match(safeApply?.command ?? "", /ufw allow/);
  assert.ok(safeApply?.rollbackSpec?.command, "safeFirewallApply must declare rollback command");
  const verifyChecks = safeApply?.verifySpec?.checks?.map((check) => check.description ?? check.command).join(" ");
  assert.match(verifyChecks ?? "", /firewall status/);
  assert.match(verifyChecks ?? "", /SSH reachable/);
});

test("e2e: fail2ban-protection validates service state and surfaces custom jail review", async () => {
  const items = await loadItems("fail2ban-protection");
  assert.equal(items.length, 1);
  const plan = buildRebuildPlan(items, "conn-fail2ban");
  assert.equal(plan.items[0].supportLevel, "full-migration");
  const verify = plan.items[0].actions.find((action) => action.id.endsWith(":verify"));
  assert.match(verify?.command ?? "", /fail2ban-client status/);
  assert.match(verify?.command ?? "", /systemctl is-active fail2ban/);
  const manual = plan.items[0].actions.find((action) => action.id.endsWith(":manual:custom-jails"));
  assert.ok(manual, "Fail2Ban plan must include custom jail review");
  assert.equal(manual?.secretPolicy, "redact");
  const backup = plan.items[0].actions.find((action) => action.id.endsWith(":backup:jails"));
  assert.equal(backup?.rollbackSpec?.restoreBackupOf, "/etc/fail2ban/jail.local");
});

test("e2e: warn conflict resolution that leaves both capabilities is flagged inconsistent", async () => {
  // identity-provider is warn-severity. Picking keep-keycloak while
  // authelia is still in the plan should be flagged inconsistent.
  const items = await loadItems("keycloak", "authelia");
  const plan = buildRebuildPlan(items, "conn-idpInconsistent");
  const ack = fullAck(plan);
  ack.conflicts = [{ conflictId: "identity-provider", resolutionId: "keep-keycloak" }];
  const verdict = evaluateApplyGate(plan, ack);
  assert.equal(verdict.ok, false);
  assert.ok(
    verdict.inconsistentResolutions.find((r) => r.conflictId === "identity-provider"),
    "keep-keycloak with authelia still in plan must be inconsistent"
  );
});

// ───────────────────────────────────────────────────────────────────
// Required approvals are aggregated.
// ───────────────────────────────────────────────────────────────────

test("e2e: high-risk catalog item requiredApprovals are written to plan.review.approvalsRequired", async () => {
  const items = await loadItems("ssh-hardening", "wireguard-vpn");
  const plan = buildRebuildPlan(items, "conn-aggregate");
  const aggregated = plan.review.approvalsRequired ?? [];
  // ssh-hardening contributes 2 gates (ssh-lockout-confirm + secret-confirm)
  // wireguard-vpn contributes 1 (secret-confirm).
  assert.ok(aggregated.length >= 3, `expected ≥3 aggregated gates, got ${aggregated.length}`);
  const kinds = new Set(aggregated.map((g) => g.kind));
  assert.ok(kinds.has("ssh-lockout-confirm"));
  assert.ok(kinds.has("secret-confirm"));
});

// ───────────────────────────────────────────────────────────────────
// remainingRisks rendering surface for PlanReviewPanel.
// ───────────────────────────────────────────────────────────────────

test("e2e: remainingRisks are placed onto plan.items[*].audit.remainingRisks for the Review panel", async () => {
  const items = await loadItems("ssh-hardening");
  const plan = buildRebuildPlan(items, "conn-risks");
  const item = plan.items[0];
  assert.ok((item.audit?.remainingRisks ?? []).length > 0);
  // Building a report must echo the same risks back so the UI can
  // continue to consume them.
  const report = buildPlanReport(plan);
  const entry = report.remainingRisks.find((r) => r.itemId === item.id);
  assert.ok(entry);
  assert.equal(entry?.risks.length, item.audit?.remainingRisks?.length);
});

// ───────────────────────────────────────────────────────────────────
// Apply gate is server-side: forged client request must still be refused.
// ───────────────────────────────────────────────────────────────────

test("e2e: apply gate is server-side; forged client request with all-true ack still refused if plan has block conflict", async () => {
  const items = await loadItems("nginx-web-service", "caddy-server");
  const plan = buildRebuildPlan(items, "conn-forged");
  // Operator forges every kind of ack: every risk, every approval gate,
  // and a "valid-looking" conflict ack.
  const risks: Record<string, string[]> = {};
  for (const item of plan.items) {
    risks[item.id] = item.audit?.remainingRisks ?? [];
  }
  const approvals = (plan.review.approvalsRequired ?? []).map((gate) => ({
    itemId: gate.itemId,
    gateId: gate.id
  }));
  const verdict = evaluateApplyGate(plan, {
    risks,
    conflicts: [{ conflictId: "http-frontend", resolutionId: "keep-nginx" }],
    approvals
  });
  // Even with everything checked, the live block conflict still refuses
  // because both nginx and caddy are still in the plan body.
  assert.equal(verdict.ok, false);
  assert.equal(verdict.blockingConflicts.length, 1);
});

// ───────────────────────────────────────────────────────────────────
// Build Mode Target Snapshot signal.
// ───────────────────────────────────────────────────────────────────

test("e2e: build mode without target snapshot marks targetStateUnknown", async () => {
  const items = await loadItems("nginx-web-service");
  const plan = buildRebuildPlan(items, "conn-no-snap");
  assert.equal(plan.review.targetStateUnknown, true);
  assert.equal(plan.review.targetStateConfidence, "unknown");
  const reasons = plan.review.reasons.join(" ");
  assert.match(reasons, /Target state is unknown/);
});

test("e2e: build mode with target snapshot marks targetStateConfidence=verified", async () => {
  const items = await loadItems("nginx-web-service");
  const plan = buildRebuildPlan(items, "conn-with-snap", {
    existingCapabilities: {},
    targetSnapshotAvailable: true,
    targetSnapshotAgeMs: 60_000
  });
  assert.equal(plan.review.targetStateUnknown, false);
  assert.equal(plan.review.targetStateConfidence, "verified");
});

test("e2e: build mode with stale target snapshot marks targetStateConfidence=stale", async () => {
  const items = await loadItems("nginx-web-service");
  const plan = buildRebuildPlan(items, "conn-stale-snap", {
    existingCapabilities: {},
    targetSnapshotAvailable: true,
    targetSnapshotAgeMs: 25 * 3600 * 1000
  });
  assert.equal(plan.review.targetStateConfidence, "stale");
});

test("e2e: build mode with existing target capability emits a target-state http-frontend conflict", async () => {
  const items = await loadItems("caddy-server");
  // Pretend the target already runs nginx.
  const plan = buildRebuildPlan(items, "conn-target-conflict", {
    existingCapabilities: { "web-server.nginx": "target reports nginx running" },
    targetSnapshotAvailable: true,
    targetSnapshotAgeMs: 0
  });
  const block = (plan.review.conflicts ?? []).find((c) => c.id === "http-frontend");
  assert.ok(block, "http-frontend conflict must trigger from target-state evidence");
  assert.equal(block?.severity, "block");
  // Target capability participates as a phantom plan item.
  assert.ok(
    block?.participatingItemIds.some((id) => id.startsWith("target:")),
    "block conflict must include the target phantom item id"
  );
});

// ───────────────────────────────────────────────────────────────────
// Plan Report contents
// ───────────────────────────────────────────────────────────────────

test("e2e: plan report records selected capabilities, conflicts, risks, gates, support level, dataStrategy", async () => {
  const items = await loadItems("ssh-hardening", "redis-server");
  const plan = buildRebuildPlan(items, "conn-report");
  const report = buildPlanReport(plan);
  assert.equal(report.selectedCapabilities.length, 2);
  assert.equal(report.effectiveSupportLevel, "full-migration");
  // ssh-hardening has remainingRisks
  assert.ok(report.remainingRisks.length >= 1);
  // ssh-hardening + redis-server both have approval gates
  assert.ok(report.requiredApprovalGates.length >= 2);
  // dataStrategyDecisions cover both items
  assert.equal(report.dataStrategyDecisions.length, 2);
  const redisDecision = report.dataStrategyDecisions.find((d) => d.itemId === "capability:redis-server");
  assert.equal(redisDecision?.strategy, "dump-restore");
});

test("e2e: plan report markdown includes severity + selected capabilities + data strategy headings", async () => {
  const items = await loadItems("redis-server");
  const plan = buildRebuildPlan(items, "conn-report-md");
  const report = buildPlanReport(plan);
  const md = planReportToMarkdown(report);
  assert.match(md, /# Plan Report/);
  assert.match(md, /Selected capabilities/);
  assert.match(md, /Data strategy decisions/);
  assert.match(md, /dump-restore/);
});

test("e2e: plan report flags severity=error when a detect-only item carries a forged mutating action", async () => {
  const items = await loadItems("systemd-resolved");
  const plan = buildRebuildPlan(items, "conn-report-violation");
  const tampered: EnvironmentPlan = {
    ...plan,
    items: plan.items.map((it) => ({
      ...it,
      actions: [
        ...it.actions,
        {
          id: `${it.id}:install:forged`,
          kind: "installPackage",
          label: "Forged install",
          packageNames: ["systemd-resolved"],
          requiresSudo: true,
          changesTarget: true,
          canRollback: true,
          risk: "high"
        }
      ]
    }))
  };
  const report = buildPlanReport(tampered);
  assert.equal(report.severity, "error");
  assert.ok(
    report.severityReasons.some((r) => /detect-only/.test(r)),
    "severityReasons must mention detect-only violation"
  );
});

// ───────────────────────────────────────────────────────────────────
// Effective support level helper.
// ───────────────────────────────────────────────────────────────────

test("e2e: computeEffectiveSupportLevel returns the minimum across plan items", () => {
  const items = [
    { audit: { supportLevel: "full-migration" }, supportLevel: "full-migration" } as any,
    { audit: { supportLevel: "managed-config" }, supportLevel: "managed-config" } as any,
    { audit: { supportLevel: "detect-only" }, supportLevel: "detect-only" } as any
  ];
  assert.equal(computeEffectiveSupportLevel(items), "detect-only");
});
