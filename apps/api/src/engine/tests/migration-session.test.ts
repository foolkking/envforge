import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMigrationSessionArtifacts,
  initialMigrationSessionState
} from "../../migration-session.js";
import type { FullSystemSnapshot } from "../../collectors/remote-collector.js";
import type { StoredMigrationConfigDecision, StoredMigrationDataDecision, StoredMigrationDecision, StoredMigrationSession } from "../../runtime-store.js";

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
      apt: software.filter((item) => item.source === "apt").length,
      rpm: software.filter((item) => item.source === "rpm").length,
      snap: software.filter((item) => item.source === "snap").length,
      flatpak: software.filter((item) => item.source === "flatpak").length,
      npm: software.filter((item) => item.source === "npm").length,
      pip: software.filter((item) => item.source === "pip").length,
      gem: software.filter((item) => item.source === "gem").length,
      cargo: software.filter((item) => item.source === "cargo").length,
      localBin: software.filter((item) => item.source === "local-bin").length,
      opt: software.filter((item) => item.source === "opt").length,
      userBin: software.filter((item) => item.source === "user-bin").length,
      nvm: software.filter((item) => item.source === "nvm").length,
      pyenv: software.filter((item) => item.source === "pyenv").length,
      docker: software.filter((item) => item.source === "docker").length,
      enabledServices: software.filter((item) => item.source === "systemd" && item.status === "enabled").length,
      runningServices: software.filter((item) => item.source === "systemd" && item.status === "running").length,
      total: software.length
    }
  };
}

function session(overrides: Partial<StoredMigrationSession> = {}): StoredMigrationSession {
  return {
    id: "msess-test",
    userId: "user-test",
    connectionId: "conn-source",
    status: "created",
    currentStep: "source",
    createdAt: "2026-05-27T00:00:00.000Z",
    updatedAt: "2026-05-27T00:00:00.000Z",
    ...overrides
  };
}

function decision(candidateId: string, value: StoredMigrationDecision["decision"]): StoredMigrationDecision {
  return {
    id: `mdec-${candidateId}`,
    userId: "user-test",
    connectionId: "conn-source",
    candidateId,
    decision: value,
    updatedAt: "2026-05-27T00:00:00.000Z"
  };
}

test("migration session starts at source when no snapshot exists", () => {
  assert.deepEqual(initialMigrationSessionState(false), { status: "created", currentStep: "source" });

  const artifacts = buildMigrationSessionArtifacts(session(), undefined, []);
  assert.equal(artifacts.view.recommendedStep, "source");
  assert.equal(artifacts.view.recommendedStatus, "created");
  assert.equal(artifacts.view.summary.totalCandidates, 0);
});

test("migration session keeps stored current step while exposing recommended step", () => {
  const sourceSnapshot = snapshot([
    { name: "lsd", version: "1.2", source: "apt", status: "installed", trust: "user" }
  ]);
  const discovered = buildMigrationSessionArtifacts(session(), sourceSnapshot, []);
  const candidateId = discovered.report?.candidates[0]?.id;
  assert.ok(candidateId);

  const artifacts = buildMigrationSessionArtifacts(
    session({ status: "selection-in-progress", currentStep: "unknown" }),
    sourceSnapshot,
    [decision(candidateId, "approved")]
  );
  assert.equal(artifacts.view.currentStep, "unknown");
  assert.notEqual(artifacts.view.recommendedStep, artifacts.view.currentStep);
  assert.equal(artifacts.view.summary.selectedCount, 1);
  assert.equal(artifacts.view.summary.planItemCount, 1);
});

test("migration session pending review count is deduped across candidates and review queue", () => {
  const artifacts = buildMigrationSessionArtifacts(
    session({ status: "analysis-ready", currentStep: "select" }),
    snapshot([{ name: "frp", version: "directory", source: "opt", status: "installed", trust: "user" }]),
    []
  );

  assert.equal(artifacts.report?.candidates[0]?.migrationClass, "manual-install");
  assert.equal(artifacts.reviewQueue.length, 1);
  assert.equal(artifacts.view.summary.pendingReviewCount, 1);
  assert.equal(artifacts.view.recommendedStep, "select");
});

test("migration session summary counts selected, skipped, and record-only decisions", () => {
  const sourceSnapshot = snapshot([
    { name: "eslint", version: "global", source: "npm", status: "installed", trust: "user" },
    { name: "prettier", version: "global", source: "npm", status: "installed", trust: "user" },
    { name: "typescript", version: "global", source: "npm", status: "installed", trust: "user" }
  ]);
  const discovered = buildMigrationSessionArtifacts(session(), sourceSnapshot, []);
  const candidateIds = discovered.report?.candidates.map((candidate) => candidate.id) ?? [];
  assert.equal(candidateIds.length, 3);

  const artifacts = buildMigrationSessionArtifacts(session(), sourceSnapshot, [
    decision(candidateIds[0], "approved"),
    decision(candidateIds[1], "skipped"),
    decision(candidateIds[2], "record-only")
  ]);

  assert.equal(artifacts.view.summary.selectedCount, 1);
  assert.equal(artifacts.view.summary.skippedCount, 1);
  assert.equal(artifacts.view.summary.recordOnlyCount, 1);
});

test("migration session recommends config-data when selected candidate has data or config risk", () => {
  const sourceSnapshot = snapshot([
    { name: "postgresql", version: "16", source: "apt", status: "installed", trust: "user" },
    { name: "postgresql", version: "running-service", source: "systemd", status: "running", trust: "user" }
  ], [{ id: "open-ports", label: "Open ports: 5432", category: "network", status: "healthy", lastChanged: "2026-05-27" }]);
  const discovered = buildMigrationSessionArtifacts(session(), sourceSnapshot, []);
  const postgres = discovered.report?.candidates.find((candidate) => candidate.catalogRuleId === "postgresql");
  assert.ok(postgres);

  const artifacts = buildMigrationSessionArtifacts(session(), sourceSnapshot, [decision(postgres.id, "approved")]);
  assert.equal(artifacts.view.summary.selectedCount, 1);
  assert.ok(artifacts.view.summary.configRiskCount > 0 || artifacts.view.summary.dataReviewCount > 0);
  assert.equal(artifacts.view.recommendedStep, "config-data");
  assert.equal(artifacts.view.recommendedStatus, "config-review-required");
});

test("migration session leaves config-data after bundle and data strategies are confirmed", () => {
  const sourceSnapshot = snapshot([
    { name: "postgresql", version: "16", source: "apt", status: "installed", trust: "user" },
    { name: "postgresql", version: "running-service", source: "systemd", status: "running", trust: "user" }
  ], [{ id: "open-ports", label: "Open ports: 5432", category: "network", status: "healthy", lastChanged: "2026-05-27" }]);
  const discovered = buildMigrationSessionArtifacts(session(), sourceSnapshot, []);
  const postgres = discovered.report?.candidates.find((candidate) => candidate.catalogRuleId === "postgresql");
  assert.ok(postgres);

  const configDecisions: StoredMigrationConfigDecision[] = (postgres.configBundles ?? []).map((bundle, index) => ({
    id: `mcfg-${index}`,
    userId: "user-test",
    sessionId: "msess-test",
    connectionId: "conn-source",
    bundleId: bundle.id,
    strategy: bundle.migrationStrategy,
    status: "approved",
    updatedAt: "2026-05-27T00:00:00.000Z"
  }));
  const dataDecision: StoredMigrationDataDecision = {
    id: "mdat-postgres",
    userId: "user-test",
    sessionId: "msess-test",
    connectionId: "conn-source",
    candidateId: postgres.id,
    strategy: "backup-restore",
    status: "confirmed",
    paths: postgres.dataPaths ?? [],
    updatedAt: "2026-05-27T00:00:00.000Z"
  };

  const artifacts = buildMigrationSessionArtifacts(
    session(),
    sourceSnapshot,
    [decision(postgres.id, "approved")],
    { configDecisions, dataDecisions: [dataDecision] }
  );

  assert.equal(artifacts.view.summary.configRiskCount, 0);
  assert.equal(artifacts.view.summary.dataReviewCount, 0);
  assert.equal(artifacts.view.recommendedStep, "plan");
  assert.equal(artifacts.view.recommendedStatus, "plan-ready");
});
