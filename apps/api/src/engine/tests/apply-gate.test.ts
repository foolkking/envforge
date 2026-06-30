import test from "node:test";
import assert from "node:assert/strict";
import {
  buildImportedRecipePlan,
  attachConflictsAndApprovalAggregate,
  buildRebuildPlan,
  computeRequiredApprovalsForCatalogItem,
  evaluateApplyGate
} from "../../environment-plan.js";
import type { CatalogItem } from "../../catalog.js";

function catalog(overrides: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id: "ssh-hardening",
    kind: "software",
    name: "SSH 加固",
    nameEn: "SSH hardening",
    category: "security",
    summary: "SSH server hardening capability.",
    summaryEn: "SSH server hardening capability.",
    rating: 4.9,
    installs: "10k",
    imageTone: "slate",
    sensitivity: "privileged",
    capabilityKey: "security.ssh",
    supportLevel: "full-migration",
    assets: [],
    guidePath: "configs/catalog/software/ssh-hardening.md",
    guideAuthor: "admin",
    installMode: "skip-existing",
    components: [
      { type: "software", label: "openssh-server", labelEn: "openssh-server", detail: "apt" },
      { type: "system-config", label: "/etc/ssh/sshd_config", labelEn: "sshd_config", detail: "/etc/ssh/sshd_config" }
    ],
    audit: {
      status: "pass",
      remainingRisks: [
        "Operators must review authorized_keys migration manually."
      ]
    },
    ...overrides
  };
}

test("apply-gate: rebuild plan attaches audit + capabilityKey + requiredApprovals", () => {
  const plan = buildRebuildPlan([catalog()], "conn-1");
  assert.equal(plan.items[0].capabilityKey, "security.ssh");
  assert.deepEqual(plan.items[0].audit?.remainingRisks, [
    "Operators must review authorized_keys migration manually."
  ]);
  assert.ok((plan.items[0].requiredApprovals ?? []).length >= 2);
  assert.ok(plan.review.approvalsRequired && plan.review.approvalsRequired.length >= 2);
});

test("apply-gate: blocks when remainingRisks unacknowledged", () => {
  const plan = buildRebuildPlan([catalog()], "conn-1");
  const verdict = evaluateApplyGate(plan, {});
  assert.equal(verdict.ok, false);
  assert.ok(verdict.missingRiskAcks.length >= 1);
  // Risks must be flagged for the ssh-hardening item by id
  const sshMissing = verdict.missingRiskAcks.find((entry) => entry.itemId === "capability:ssh-hardening");
  assert.ok(sshMissing);
});

test("apply-gate: passes once risks + approvals are acknowledged", () => {
  const plan = buildRebuildPlan([catalog()], "conn-1");
  const itemId = plan.items[0].id;
  const remaining = plan.items[0].audit?.remainingRisks ?? [];
  const gates = plan.review.approvalsRequired ?? [];
  const verdict = evaluateApplyGate(plan, {
    risks: { [itemId]: remaining },
    approvals: gates.map((gate) => ({ itemId: gate.itemId, gateId: gate.id }))
  });
  assert.equal(verdict.ok, true);
  assert.equal(verdict.missingRiskAcks.length, 0);
  assert.equal(verdict.missingApprovalGates.length, 0);
});

test("apply-gate: blocks on block-severity conflict (UFW + firewalld)", () => {
  const plan = buildRebuildPlan(
    [
      catalog({ id: "firewall-baseline", capabilityKey: "security.firewall.ufw", supportLevel: "managed-config", audit: { status: "pass", remainingRisks: [] } }),
      catalog({ id: "firewalld", capabilityKey: "security.firewall.firewalld", supportLevel: "managed-config", audit: { status: "pass", remainingRisks: [] } })
    ],
    "conn-1"
  );
  assert.ok((plan.review.conflicts ?? []).some((c) => c.id === "firewall-stack" && c.severity === "block"));
  const verdict = evaluateApplyGate(plan, {});
  assert.equal(verdict.ok, false);
  assert.equal(verdict.blockingConflicts.length, 1);
  assert.equal(verdict.blockingConflicts[0].id, "firewall-stack");
});

test("apply-gate: warn-severity conflict can be acknowledged", () => {
  const plan = buildRebuildPlan(
    [
      catalog({ id: "kubernetes-tools", capabilityKey: "developer.kubectl", supportLevel: "basic-rebuild", audit: { status: "pass", remainingRisks: [] } }),
      catalog({ id: "k3s", capabilityKey: "container.kubernetes.k3s", supportLevel: "managed-config", audit: { status: "pass", remainingRisks: [] } })
    ],
    "conn-1"
  );
  const ackApprovals = (plan.review.approvalsRequired ?? []).map((gate) => ({ itemId: gate.itemId, gateId: gate.id }));
  // Without acking the warn conflict, gate refuses.
  const refused = evaluateApplyGate(plan, { approvals: ackApprovals });
  assert.equal(refused.ok, false);
  assert.equal(refused.unresolvedWarnConflicts.length, 1);
  // After acking, gate accepts (no remainingRisks on these stub items).
  const accepted = evaluateApplyGate(plan, {
    approvals: ackApprovals,
    conflicts: [{ conflictId: "kubernetes-cluster", resolutionId: "ack-kubeconfig-rewire" }]
  });
  assert.equal(accepted.ok, true);
});

test("apply-gate: computeRequiredApprovalsForCatalogItem returns empty for low-risk items", () => {
  const result = computeRequiredApprovalsForCatalogItem("capability:htop-tools", catalog({ id: "htop-tools", sensitivity: "safe", supportLevel: "basic-rebuild" }));
  assert.equal(result.length, 0);
});

test("apply-gate: generic high-risk command confirmation is mandatory", () => {
  const plan = attachConflictsAndApprovalAggregate(buildImportedRecipePlan({ targetConnectionId: "conn-1", yaml: "steps:\n  - run: sudo rm /tmp/example\n" }));
  const item = plan.items[0]!;
  const gate = plan.review.approvalsRequired?.find((entry) => entry.kind === "high-risk-command-confirm");
  assert.ok(gate);
  const refused = evaluateApplyGate(plan, { risks: { [item.id]: item.risks } });
  assert.ok(refused.missingApprovalGates.some((entry) => entry.kind === "high-risk-command-confirm"));
  const accepted = evaluateApplyGate(plan, {
    risks: { [item.id]: item.risks },
    approvals: (plan.review.approvalsRequired ?? []).map((entry) => ({ itemId: entry.itemId, gateId: entry.id }))
  });
  assert.equal(accepted.ok, true);
});

test("apply-gate: target-state conflicts require target-conflict confirmation", () => {
  const plan = buildRebuildPlan([catalog({ id: "nginx", capabilityKey: "web-server.nginx", audit: { status: "pass", remainingRisks: [] } })], "conn-1", {
    existingCapabilities: { "web-server.caddy": "caddy" }, targetSnapshotAvailable: true
  });
  const targetGate = plan.review.approvalsRequired?.find((entry) => entry.kind === "target-conflict-confirm");
  assert.ok(targetGate);
  const reattached = attachConflictsAndApprovalAggregate(plan);
  assert.ok(reattached.review.conflicts?.some((conflict) => conflict.participatingItemIds.some((id) => id.startsWith("target:"))));
  assert.ok(reattached.review.approvalsRequired?.some((entry) => entry.kind === "target-conflict-confirm"));
  const approvals = (plan.review.approvalsRequired ?? [])
    .filter((entry) => entry.kind !== "target-conflict-confirm")
    .map((entry) => ({ itemId: entry.itemId, gateId: entry.id }));
  const refused = evaluateApplyGate(plan, { approvals });
  assert.ok(refused.missingApprovalGates.some((entry) => entry.kind === "target-conflict-confirm"));
});

test("apply-gate: partial snapshots require hash-bound partial-snapshot confirmation", () => {
  const plan = buildRebuildPlan([catalog({ audit: { status: "pass", remainingRisks: [] } })], "conn-1", {
    targetSnapshotAvailable: true, snapshotCompleteness: 0.5
  });
  const partialGate = plan.review.approvalsRequired?.find((entry) => entry.kind === "partial-snapshot-confirm");
  assert.ok(partialGate);
  const refused = evaluateApplyGate(plan, {
    approvals: (plan.review.approvalsRequired ?? [])
      .filter((entry) => entry.id !== partialGate!.id)
      .map((entry) => ({ itemId: entry.itemId, gateId: entry.id }))
  });
  assert.ok(refused.missingApprovalGates.some((entry) => entry.kind === "partial-snapshot-confirm"));
});
