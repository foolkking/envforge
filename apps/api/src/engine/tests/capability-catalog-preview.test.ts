import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCatalogPreviewReviewFromPreviews,
  buildCatalogPromotionRequestDraft,
  buildCapabilityCatalogPreview,
  runCapabilityCatalogPreview,
  stableStringify,
  writeCapabilityCatalogPreviewArtifacts
} from "../../capability-catalog-preview.js";
import { certifyCapabilityManifest, type CapabilityCertificationResult, type CapabilityDocument } from "../../capability-certification.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../..");
const capabilitiesRoot = path.join(repoRoot, "capabilities");
const configsCatalogRoot = path.join(repoRoot, "configs", "catalog");

test("capability catalog preview: official.nginx creates a review-only update preview", async () => {
  const result = await certifyCapabilityManifest(path.join(capabilitiesRoot, "official", "nginx", "capability.yaml"));
  const preview = buildCapabilityCatalogPreview(result);

  assert.equal(preview.source.capabilityId, "official.nginx");
  assert.equal(preview.source.certificationPassed, true);
  assert.equal(preview.targetCatalog.generatedCatalogId, "nginx-web-service");
  assert.equal(preview.targetCatalog.operation, "update");
  assert.equal(preview.serviceStackMappings[0].category, "web-entry");
  assert.ok(preview.serviceStackMappings[0].signals.includes("/etc/nginx"));
  assert.ok(preview.gates.includes("config-diff-confirm"));
  assert.ok(preview.gates.includes("service-reload-confirm"));
  assert.ok(preview.risks.includes("certificate path missing"));
  assert.ok(preview.risks.includes("config invalid"));
  assert.equal(preview.generatedArtifact?.enabledByDefault, false);
  assert.equal(preview.catalogArtifact.runtimeEnabled, false);
  assert.ok(preview.diff.some((entry) => entry.kind === "service-stack-mapping"));
  assert.ok(preview.diff.some((entry) => entry.kind === "gate"));
  assert.ok(preview.diff.some((entry) => entry.kind === "risk"));
  assert.ok(preview.diff.some((entry) => entry.kind === "permission"));
});

test("capability catalog preview: official.postgresql creates database review metadata", async () => {
  const result = await certifyCapabilityManifest(path.join(capabilitiesRoot, "official", "postgresql", "capability.yaml"));
  const preview = buildCapabilityCatalogPreview(result);

  assert.equal(preview.source.capabilityId, "official.postgresql");
  assert.equal(preview.targetCatalog.generatedCatalogId, "postgres-profile");
  assert.equal(preview.targetCatalog.operation, "update");
  assert.equal(preview.serviceStackMappings[0].category, "database");
  for (const signal of ["postgresql service", "port 5432", "/var/lib/postgresql", "pg_hba.conf", "postgresql.conf"]) {
    assert.ok(preview.serviceStackMappings[0].signals.includes(signal));
  }
  for (const gate of ["data-migration-strategy-confirm", "backup-freshness-confirm", "version-compatibility-confirm"]) {
    assert.ok(preview.gates.includes(gate));
  }
  for (const risk of ["raw file copy corruption", "version mismatch", "backup freshness unknown", "data volume unknown"]) {
    assert.ok(preview.risks.includes(risk));
  }
});

test("capability catalog preview: root preview passes for official examples", async () => {
  const before = await hashDirectory(configsCatalogRoot);
  const summary = await runCapabilityCatalogPreview(capabilitiesRoot);
  const after = await hashDirectory(configsCatalogRoot);

  assert.equal(summary.certificationPassed, true);
  assert.equal(summary.blocked.length, 0);
  assert.deepEqual(summary.previews.map((preview) => preview.source.capabilityId).sort(), ["official.nginx", "official.postgresql"]);
  assert.equal(after, before, "preview must not modify configs/catalog");
});

test("capability catalog preview: uncertified capability is blocked", () => {
  const result = resultFor(minimalCapability({ id: "official.nginx" }), {
    passed: false,
    issues: [{ severity: "error", code: "schema.required", message: "requiresGates is required", path: "requiresGates" }]
  });
  const preview = buildCapabilityCatalogPreview(result);

  assert.equal(preview.targetCatalog.operation, "blocked");
  assert.ok(preview.blockers.some((blocker) => blocker.includes("Capability certification failed")));
  assert.ok(preview.diff.every((entry) => entry.operation === "blocked"));
});

test("capability catalog preview: write/apply capability must retain gates and Environment Plan boundary", () => {
  const capability = minimalCapability({
    id: "official.nginx",
    requiresGates: [],
    safety: {
      approvedPlanRequired: true,
      appliesViaManagedExecution: true,
      publicMutationApi: false,
      directMutationRoutes: [],
      environmentPlanBoundary: "Runs directly."
    }
  });
  const preview = buildCapabilityCatalogPreview(resultFor(capability, { passed: true }));

  assert.equal(preview.targetCatalog.operation, "blocked");
  assert.ok(preview.blockers.some((blocker) => blocker.includes("write permissions require review gates")));
  assert.ok(preview.blockers.some((blocker) => blocker.includes("approved immutable Environment Plan boundary")));
  assert.ok(preview.blockers.some((blocker) => blocker.includes("required gate removed or missing: config-diff-confirm")));
  assert.ok(preview.blockers.some((blocker) => blocker.includes("required gate removed or missing: service-reload-confirm")));
});

test("capability catalog preview: PostgreSQL data gates cannot be removed", () => {
  const capability = minimalCapability({
    id: "official.postgresql",
    catalogRefs: ["postgres-profile"],
    riskLevel: "high",
    requiresGates: ["secret-handling-confirm"]
  });
  const preview = buildCapabilityCatalogPreview(resultFor(capability, { passed: true }));

  assert.equal(preview.targetCatalog.operation, "blocked");
  assert.ok(preview.blockers.some((blocker) => blocker.includes("data-migration-strategy-confirm")));
  assert.ok(preview.blockers.some((blocker) => blocker.includes("backup-freshness-confirm")));
  assert.ok(preview.blockers.some((blocker) => blocker.includes("version-compatibility-confirm")));
});

test("capability catalog preview: Nginx reload gate cannot be removed", () => {
  const capability = minimalCapability({
    id: "official.nginx",
    catalogRefs: ["nginx-web-service"],
    requiresGates: ["config-diff-confirm", "secret-handling-confirm"]
  });
  const preview = buildCapabilityCatalogPreview(resultFor(capability, { passed: true }));

  assert.equal(preview.targetCatalog.operation, "blocked");
  assert.ok(preview.blockers.some((blocker) => blocker.includes("service-reload-confirm")));
});

test("capability catalog preview: risk downgrade without evidence is blocked", () => {
  const capability = minimalCapability({
    id: "official.postgresql",
    catalogRefs: ["postgres-profile"],
    riskLevel: "medium",
    requiresGates: ["data-migration-strategy-confirm", "backup-freshness-confirm", "version-compatibility-confirm"]
  });
  const preview = buildCapabilityCatalogPreview(resultFor(capability, { passed: true }));

  assert.equal(preview.targetCatalog.operation, "blocked");
  assert.ok(preview.blockers.some((blocker) => blocker.includes("risk downgrade without evidence")));
});

test("capability catalog preview: secret leak from certification blocks preview", () => {
  const result = resultFor(minimalCapability({ id: "official.postgresql", catalogRefs: ["postgres-profile"] }), {
    passed: false,
    issues: [
      {
        severity: "error",
        code: "redaction.sentinel",
        message: "raw sentinel secret value appears in fixture",
        path: "fixtures/example.json"
      }
    ]
  });
  const preview = buildCapabilityCatalogPreview(result);

  assert.equal(preview.targetCatalog.operation, "blocked");
  assert.ok(stableStringify(preview).includes("redaction.sentinel"));
});

test("capability catalog preview: generated artifacts are deterministic and review-only", async () => {
  const summary = await runCapabilityCatalogPreview(capabilitiesRoot);
  const firstDir = await fs.mkdtemp(path.join(os.tmpdir(), "envforge-preview-a-"));
  const secondDir = await fs.mkdtemp(path.join(os.tmpdir(), "envforge-preview-b-"));

  const first = await writeCapabilityCatalogPreviewArtifacts(firstDir, summary.previews);
  const second = await writeCapabilityCatalogPreviewArtifacts(secondDir, summary.previews);

  assert.equal(stableStringify(first), stableStringify(second));
  for (const preview of first) {
    const text = stableStringify(preview);
    assert.equal(preview.generatedArtifact?.enabledByDefault, false);
    assert.equal(preview.catalogArtifact.runtimeEnabled, false);
    assert.ok(!text.includes("SENTINEL_DB_PASSWORD_SHOULD_NOT_LEAK"));
    assert.ok(!text.includes("SENTINEL_API_TOKEN_SHOULD_NOT_LEAK"));
    assert.ok(!text.includes("SENTINEL_PRIVATE_KEY_SHOULD_NOT_LEAK"));
    assert.ok(!text.includes(repoRoot.replace(/\\/g, "/")), "artifact must not contain absolute repo path");
    assert.ok(!/"generatedAt"/.test(text), "committed artifact must not include timestamp metadata");
  }
});

test("capability catalog preview: review model summarizes safety, diff, and review-only artifact state", async () => {
  const summary = await runCapabilityCatalogPreview(capabilitiesRoot);
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "envforge-preview-review-"));
  const previews = await writeCapabilityCatalogPreviewArtifacts(tmp, summary.previews);
  const review = buildCatalogPreviewReviewFromPreviews(previews);

  assert.equal(review.runtimeEnabled, false);
  assert.equal(review.catalogMutated, false);
  assert.equal(review.deterministic, true);
  assert.equal(review.capabilityCount, 2);
  assert.equal(review.certifiedCapabilityCount, 2);
  assert.equal(review.blockedCapabilityCount, 0);
  assert.equal(review.safetySummary.hasRuntimeMutation, false);
  assert.equal(review.safetySummary.hasConfigCatalogMutation, false);
  assert.equal(review.safetySummary.hasSecretLeak, false);
  assert.ok(review.diffSummary.riskChanges > 0);
  assert.ok(review.diffSummary.gateChanges > 0);
  assert.ok(review.diffSummary.permissionChanges > 0);
  assert.ok(review.diffSummary.serviceStackMappingChanges > 0);
  assert.ok(review.diffItems.some((item) => item.safetyStatus === "needs-review" && item.category === "permission"));
  assert.ok(review.serviceStackImpact.some((impact) => impact.capabilityId === "official.nginx" && impact.category === "web-entry"));
  assert.ok(review.artifacts.every((artifact) => artifact.enabledByDefault === false));
});

test("capability catalog preview: promotion request is draft-only and cannot enable runtime catalog", async () => {
  const summary = await runCapabilityCatalogPreview(capabilitiesRoot);
  const previews = summary.previews.map((preview) => ({
    ...preview,
    generatedArtifact: { path: `generated/catalog-preview/${preview.source.capabilityId}.catalog-preview.json`, enabledByDefault: false as const }
  }));
  const review = buildCatalogPreviewReviewFromPreviews(previews);
  const draft = buildCatalogPromotionRequestDraft(review);

  assert.equal(draft.status, "draft");
  assert.equal(draft.runtimeEnabled, false);
  assert.equal(draft.catalogMutated, false);
  assert.match(draft.summary, /No runtime catalog was changed/);
  assert.match(draft.summary, /No capability was enabled/);
  assert.match(draft.summary, /No apply run was created/);
  assert.match(draft.runtimeMutationNote, /does not modify configs\/catalog/);
  assert.ok(draft.generatedArtifacts.every((artifact) => artifact.startsWith("generated/catalog-preview/")));
  assert.ok(draft.diffItems.length > 0);
});

function resultFor(
  capability: CapabilityDocument,
  overrides: Partial<CapabilityCertificationResult> = {}
): CapabilityCertificationResult {
  return {
    filePath: "capabilities/official/example/capability.yaml",
    packageDir: "capabilities/official/example",
    capability,
    passed: true,
    claimedLevel: capability.status,
    effectiveLevel: capability.status,
    maxEligibleLevel: capability.status,
    issues: [],
    checks: ["schema-valid", "approved-environment-plan-boundary"],
    ...overrides
  };
}

function minimalCapability(overrides: Partial<CapabilityDocument> = {}): CapabilityDocument {
  return {
    id: "official.example",
    name: "Example",
    publisher: "envforge",
    version: "0.1.0",
    status: "official",
    riskLevel: "medium",
    catalogRefs: ["example"],
    supports: { os: ["ubuntu-22.04"], architectures: ["x86_64"] },
    features: { discover: true, plan: true, apply: true, verify: true, rollback: "partial" },
    permissions: {
      read: ["/etc/example"],
      write: ["/etc/example"],
      commands: ["systemctl reload example"]
    },
    requiresGates: ["config-diff-confirm", "service-reload-confirm"],
    testMatrix: ["ubuntu-22.04"],
    fixtures: [{ id: "example", path: "fixtures/example.json", type: "assessment" }],
    certification: {
      evidence: {
        discoverClassifyTests: true,
        redactionTests: true,
        goldenScenario: true,
        planOnlyTests: true,
        failureDiagnosticFixture: true,
        officialDocs: true,
        certificationHarness: true,
        p0SafetyGates: true
      }
    },
    redaction: { sensitiveKeys: [], assertions: ["no raw secret values"] },
    safety: {
      approvedPlanRequired: true,
      appliesViaManagedExecution: true,
      publicMutationApi: false,
      directMutationRoutes: [],
      environmentPlanBoundary: "Target-changing applier steps execute only as actions in an approved immutable Environment Plan through Managed Execution."
    },
    docs: { readme: "README.md" },
    ...overrides
  };
}

async function hashDirectory(root: string): Promise<string> {
  const files: string[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(fullPath);
      if (entry.isFile()) files.push(fullPath);
    }
  }
  await walk(root);
  const parts = await Promise.all(
    files.sort().map(async (file) => {
      const relative = path.relative(root, file).replace(/\\/g, "/");
      return relative + "\0" + (await fs.readFile(file, "utf8"));
    })
  );
  return stableStringify(parts);
}
