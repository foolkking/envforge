import test from "node:test";
import assert from "node:assert/strict";
import { buildConfigChangePlan, buildRebuildPlan, buildRemovePlan, migrationPlanToEnvironmentPlan } from "../../environment-plan.js";
import type { CatalogItem } from "../../catalog.js";
import type { MigrationPlan } from "../../migration-classifier.js";

function catalog(overrides: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id: "nginx",
    kind: "software",
    name: "Nginx",
    nameEn: "Nginx Web Server",
    category: "service",
    summary: "Web server capability.",
    summaryEn: "Web server capability.",
    rating: 4.8,
    installs: "10k",
    imageTone: "teal",
    sensitivity: "review",
    assets: [],
    guidePath: "configs/catalog/software/nginx.md",
    guideAuthor: "admin",
    installMode: "skip-existing",
    supportLevel: "full-migration",
    components: [
      { type: "software", label: "nginx", labelEn: "Nginx", detail: "apt" },
      { type: "system-config", label: "/etc/nginx/nginx.conf", labelEn: "nginx.conf", detail: "/etc/nginx/nginx.conf" }
    ],
    ...overrides
  };
}

test("rebuild plans convert catalog capabilities into reviewable target actions", () => {
  const plan = buildRebuildPlan([catalog()], "conn-1");
  assert.equal(plan.type, "rebuild");
  assert.equal(plan.review.required, true);
  assert.equal(plan.items[0]?.supportLevel, "full-migration");
  assert.ok(plan.items[0]?.actions.some((action) => action.kind === "installPackage" && action.changesTarget));
  assert.ok(plan.summary.requiresSudo > 0);
  assert.match(plan.export?.yaml ?? "", /EnvForge Rebuild Plan/);
});

test("detect-only catalog rules never generate mutating apply actions", () => {
  const plan = buildRebuildPlan([catalog({ id: "unknown-tool", supportLevel: "detect-only" })], "conn-1");
  assert.equal(plan.items[0]?.actions.length, 1);
  assert.equal(plan.items[0]?.actions[0]?.kind, "review");
  assert.equal(plan.items[0]?.actions[0]?.changesTarget, false);
  assert.equal(plan.summary.requiresSudo, 0);
});

test("remove plans preserve data by default and require review", () => {
  const plan = buildRemovePlan({ targetConnectionId: "conn-1", packages: ["redis"], source: "apt" });
  assert.equal(plan.type, "remove");
  assert.equal(plan.summary.dataPreservedByDefault, true);
  assert.equal(plan.review.required, true);
  assert.ok(plan.items[0]?.risks.some((risk) => risk.includes("preserved")));
  assert.ok(plan.items[0]?.actions.some((action) => action.kind === "removePackage" && action.risk === "high"));
});

test("config change proposals include secret scan, backup, validation, and rollback evidence", () => {
  const plan = buildConfigChangePlan({
    targetConnectionId: "conn-1",
    path: "/etc/nginx/nginx.conf",
    originalContent: "server {}\n",
    candidateContent: "password=super-secret\n",
    validationCommand: "nginx -t"
  });
  assert.equal(plan.type, "change");
  assert.equal(plan.review.required, true);
  assert.ok(plan.summary.highRisk > 0);
  assert.ok(plan.items[0]?.actions.some((action) => action.id === "scan-secret" && action.notes?.length));
  assert.ok(plan.items[0]?.actions.some((action) => action.kind === "backup" && action.canRollback));
  assert.ok(plan.items[0]?.actions.some((action) => action.kind === "validate" && action.command === "nginx -t"));
});

test("migration plans are wrapped as Environment Plans before target apply", () => {
  const migration: MigrationPlan = {
    sourceHost: "vm-old",
    generatedAt: "2026-05-28T00:00:00.000Z",
    items: [{
      id: "catalog:nginx",
      name: "nginx",
      type: "managed-software",
      confidence: 0.94,
      risks: ["Review config references."],
      userDecision: "pending",
      actions: [
        { kind: "installPackage", label: "Install nginx", packageNames: ["nginx"], requiresSudo: true },
        { kind: "validate", label: "Validate nginx", command: "nginx -t" }
      ]
    }]
  };
  const plan = migrationPlanToEnvironmentPlan(migration, "target-1");
  assert.equal(plan.type, "migration");
  assert.equal(plan.sourceHost, "vm-old");
  assert.equal(plan.targetConnectionId, "target-1");
  assert.equal(plan.items[0]?.type, "migration-candidate");
  assert.ok(plan.items[0]?.actions.some((action) => action.kind === "installPackage" && action.canRollback));
});
