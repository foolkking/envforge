import test from "node:test";
import assert from "node:assert/strict";
import { buildMigrationCandidateReport, buildMigrationPlanFromCandidates } from "../../migration-classifier.js";
import type { FullSystemSnapshot } from "../../collectors/remote-collector.js";

function snapshot(software: FullSystemSnapshot["software"], configChecklist: FullSystemSnapshot["configChecklist"] = []): FullSystemSnapshot {
  return {
    agentId: "agent-test",
    collectedAt: "2026-05-27T00:00:00.000Z",
    system: {
      hostname: "vm-old",
      platform: "linux",
      arch: "x64",
      release: "6.8",
      uptime: 0,
      cpu: { model: "test", cores: 2, speedMhz: 0 },
      memory: { totalBytes: 1, freeBytes: 1, usedBytes: 0, totalGb: "0", freeGb: "0" }
    },
    software,
    configChecklist,
    counts: {
      apt: 0,
      rpm: 0,
      snap: 0,
      flatpak: 0,
      npm: 0,
      pip: 0,
      gem: 0,
      cargo: 0,
      localBin: 0,
      opt: 0,
      userBin: 0,
      nvm: 0,
      pyenv: 0,
      docker: 0,
      enabledServices: 0,
      runningServices: 0,
      total: software.length
    }
  };
}

test("Package Intent Score separates user intent from installed package noise", () => {
  const report = buildMigrationCandidateReport(snapshot([
    { name: "nginx", version: "1.24", source: "apt", status: "installed", trust: "user" },
    { name: "linux-image-generic", version: "6.8", source: "apt", status: "installed", trust: "uncertain" },
    { name: "eslint", version: "global", source: "npm", status: "installed", trust: "user" },
    { name: "redis", version: "service", source: "systemd", status: "installed", trust: "user" },
    { name: "library/ubuntu", version: "latest", source: "docker", status: "installed", trust: "user" },
    { name: "frp", version: "directory", source: "opt", status: "installed", trust: "user" }
  ]));

  const byName = new Map(report.candidates.map((candidate) => [candidate.name, candidate]));
  assert.equal(byName.get("nginx")?.migrationClass, "managed-software");
  assert.equal(byName.get("nginx")?.band, "medium");
  assert.equal(byName.has("linux-image-generic"), false);
  assert.equal(report.normalizedArtifacts.find((artifact) => artifact.artifactKey === "system-baseline:apt:linux-image-generic")?.userFacing, false);
  assert.equal(byName.get("eslint")?.migrationClass, "language-global-package");
  assert.equal(byName.get("library/ubuntu")?.migrationClass, "container-workload");
  assert.equal(byName.get("frp")?.migrationClass, "manual-install");
  assert.ok((byName.get("redis")?.recommendedActions ?? []).some((action) => action.includes("Validate")));
});

test("catalog-only candidates are medium while operational evidence raises confidence", () => {
  const report = buildMigrationCandidateReport(snapshot([
    { name: "nginx", version: "1.24", source: "apt", status: "installed", trust: "user" },
    { name: "nginx", version: "running-service", source: "systemd", status: "running", trust: "user" }
  ], [{ id: "open-ports", label: "Open ports: 80,443", category: "network", status: "healthy", lastChanged: "2026-05-27" }]));
  const nginx = report.candidates.find((candidate) => candidate.catalogRuleId === "nginx");
  assert.equal(nginx?.band, "high");
  assert.ok(nginx?.reasons.some((reason) => reason.includes("Evidence sources")));
  assert.equal(report.candidates.filter((candidate) => candidate.catalogRuleId === "nginx").length, 1);
  assert.deepEqual([...(nginx?.evidenceSources ?? [])].sort(), ["apt", "open-port", "systemd"]);
  assert.deepEqual(nginx?.ports, [80, 443]);
  assert.ok(nginx?.rawEvidence?.some((evidence) => evidence.kind === "package" && evidence.name === "nginx"));
  assert.ok(nginx?.rawEvidence?.some((evidence) => evidence.kind === "service" && evidence.name === "nginx"));
  assert.ok(nginx?.rawEvidence?.some((evidence) => evidence.kind === "port" && evidence.port === 80));

  const medium = buildMigrationCandidateReport(snapshot([
    { name: "redis", version: "7", source: "apt", status: "installed", trust: "uncertain" }
  ])).candidates.find((candidate) => candidate.catalogRuleId === "redis");
  assert.equal(medium?.band, "medium");
});

test("multi-package catalog capabilities aggregate package evidence and keep package list complete", () => {
  const report = buildMigrationCandidateReport(snapshot([
    { name: "bat", version: "0.24", source: "apt", status: "installed", trust: "user" },
    { name: "ripgrep", version: "14", source: "apt", status: "installed", trust: "user" },
    { name: "fd-find", version: "8.7", source: "apt", status: "installed", trust: "user" },
    { name: "lsd", version: "1.2", source: "apt", status: "installed", trust: "user" },
    { name: "zoxide", version: "0.9", source: "apt", status: "installed", trust: "user" }
  ]));

  const cliTools = report.candidates.find((candidate) => candidate.catalogRuleId === "modern-cli-tools");
  assert.equal(cliTools?.migrationClass, "managed-software");
  assert.equal(cliTools?.band, "high");
  assert.deepEqual([...(cliTools?.packageNames ?? [])].sort(), ["bat", "fd-find", "lsd", "ripgrep", "zoxide"]);
  assert.ok(cliTools?.reasons.some((reason) => reason.includes("Matched 5 packages")));

  const plan = buildMigrationPlanFromCandidates(report);
  const installAction = plan.items.find((item) => item.id === "catalog:modern-cli-tools")
    ?.actions.find((action) => action.kind === "installPackage");
  assert.deepEqual([...(installAction?.packageNames ?? [])].sort(), ["bat", "fd-find", "lsd", "ripgrep", "zoxide"]);
});

test("single recognized component of a multi-package capability is still medium confidence", () => {
  const lsd = buildMigrationCandidateReport(snapshot([
    { name: "lsd", version: "1.2", source: "apt", status: "installed", trust: "user" }
  ])).candidates.find((candidate) => candidate.catalogRuleId === "modern-cli-tools");

  assert.equal(lsd?.band, "medium");
  assert.deepEqual(lsd?.packageNames, ["lsd"]);
});

test("known user package-manager items without catalog rules are reviewable medium confidence", () => {
  const pwgen = buildMigrationCandidateReport(snapshot([
    { name: "pwgen", version: "2.08", source: "apt", status: "installed", trust: "user" }
  ])).candidates.find((candidate) => candidate.name === "pwgen");

  assert.equal(pwgen?.migrationClass, "unknown-review");
  assert.equal(pwgen?.band, "medium");
});

test("migration classifier consumes scoped Decision Engine preferences as advisory policy", () => {
  const report = buildMigrationCandidateReport(snapshot([
    { name: "eslint", version: "9", source: "npm", status: "installed", trust: "user" }
  ]), {
    decisionPolicy: {
      userId: "classifier-user",
      connectionId: "source-1",
      preferences: [{
        id: "pref-eslint",
        userId: "classifier-user",
        scope: "connection",
        scopeId: "source-1",
        pattern: "eslint",
        preferredOutcome: "required-decision",
        confidence: 0.93,
        observations: 3,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z"
      }]
    }
  });
  const eslint = report.candidates.find((candidate) => candidate.name === "eslint");
  assert.equal(eslint?.userPreferenceConfidence, 0.93);
  assert.equal(eslint?.decisionOutcome, "required-decision");
  assert.ok(eslint?.reviewReasons?.some((reason) => reason.includes("pref-eslint")));
});

test("decision model separates intent, readiness, risk, support, and default decision", () => {
  const report = buildMigrationCandidateReport(snapshot([
    { name: "custom-app", version: "directory", source: "opt", status: "installed", trust: "user" },
    { name: "libssl3", version: "3", source: "apt", status: "installed", trust: "uncertain" },
    { name: "postgresql", version: "16", source: "apt", status: "installed", trust: "user" },
    { name: "postgresql", version: "running-service", source: "systemd", status: "running", trust: "user" }
  ], [{ id: "open-ports", label: "Open ports: 5432", category: "network", status: "healthy", lastChanged: "2026-05-27" }]));

  const custom = report.candidates.find((candidate) => candidate.name === "custom-app");
  assert.equal(custom?.decisionBand, "manual");
  assert.ok((custom?.intentConfidence ?? 0) >= 0.68);
  assert.ok((custom?.migrationReadiness ?? 1) < 0.4);

  assert.equal(report.candidates.some((candidate) => candidate.name === "libssl3"), false);
  assert.ok(report.normalizedArtifacts.some((artifact) => artifact.artifactKey === "system-baseline:apt:libssl3"));

  const postgres = report.candidates.find((candidate) => candidate.catalogRuleId === "postgresql");
  assert.equal(postgres?.supportLevel, "full-migration");
  assert.equal(postgres?.decisionBand, "review");
  assert.ok((postgres?.intentConfidence ?? 0) >= 0.75);
  assert.ok((postgres?.migrationReadiness ?? 1) < 0.7);
  assert.ok(postgres?.reviewReasons?.some((reason) => reason.includes("Database data strategy")));
});

test("config bundles govern defaults, secrets, and privileged system config", () => {
  const report = buildMigrationCandidateReport(snapshot([
    { name: "nginx", version: "1.24", source: "apt", status: "installed", trust: "user" },
    { name: "homepage", version: "latest", source: "docker", status: "installed", trust: "user" },
    { name: "ufw", version: "0.36", source: "apt", status: "installed", trust: "user" }
  ], [{ id: "firewall", label: "UFW firewall enabled", category: "security", status: "healthy", lastChanged: "2026-05-27" }]));

  const nginx = report.candidates.find((candidate) => candidate.catalogRuleId === "nginx");
  assert.ok(nginx?.configBundles?.some((bundle) => bundle.ownerRuleId === "nginx"));
  assert.ok(nginx?.configBundles?.some((bundle) => bundle.migrationStrategy === "omit-default" && bundle.paths.some((file) => file.path.includes("mime.types"))));
  assert.ok(nginx?.configBundles?.some((bundle) => bundle.migrationStrategy === "template-with-vars" || bundle.migrationStrategy === "copy-with-review"));

  const homepage = report.candidates.find((candidate) => candidate.catalogRuleId === "homepage");
  assert.ok(homepage?.configBundles?.some((bundle) => bundle.migrationStrategy === "secret-out-of-band"));
  const homepagePlan = buildMigrationPlanFromCandidates({ ...report, candidates: [homepage! as NonNullable<typeof homepage>] });
  assert.ok(homepagePlan.items[0].actions.some((action) => action.kind === "review" && action.label.includes("secret-out-of-band")));
  assert.equal(homepagePlan.items[0].actions.some((action) => action.kind === "copyConfig" && action.configPaths?.some((path) => path.includes(".env"))), false);

  const security = report.candidates.find((candidate) => candidate.catalogRuleId === "ufw" || candidate.catalogRuleId === "security-baseline");
  assert.equal(security?.riskLevel, "privileged");
  assert.equal(security?.decisionBand, "review");
  assert.ok(security?.configBundles?.some((bundle) => bundle.ownership === "system-security" && bundle.migrationStrategy === "manual-only"));
  assert.ok(report.configBundles.some((bundle) => bundle.ownerRuleId === "security-baseline" && bundle.ownership === "system-security"));
});

test("migration plan excludes ignored baseline packages and keeps reviewable actions", () => {
  const report = buildMigrationCandidateReport(snapshot([
    { name: "docker.io", version: "24", source: "apt", status: "installed", trust: "user" },
    { name: "cloud-init", version: "23", source: "apt", status: "installed", trust: "uncertain" }
  ]));
  const plan = buildMigrationPlanFromCandidates(report);
  assert.equal(plan.items.length, 1);
  assert.equal(plan.items[0].name, "docker.io");
  assert.ok(plan.items[0].actions.some((action) => action.kind === "copyConfig" || action.kind === "installPackage"));
  assert.equal(report.candidates.some((candidate) => candidate.name === "cloud-init"), false);
  assert.ok(report.normalizedArtifacts.some((artifact) => artifact.artifactKey === "system-baseline:apt:cloud-init"));
});
