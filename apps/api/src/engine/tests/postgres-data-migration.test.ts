/**
 * postgres-data-migration.test.ts — Phase 5R-B test suite.
 *
 * Covers: PostgreSQL intent generation, dry-run evidence shape, execution safety,
 * non-PostgreSQL rejection, missing strategy handling, command template sanitization,
 * and AssessmentSummary wiring.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPostgresDataMigrationIntent,
  buildPostgresDataMigrationDryRun,
  postgresDataMigrationDryRunForAssessment,
  type PostgresDataMigrationIntent,
  type PostgresDataMigrationDryRun,
} from "../../postgres-data-migration.js";
import { buildAssessmentSummary } from "../../migration-assessment.js";
import { buildMigrationCandidateReport } from "../../migration-classifier.js";
import type { StoredProbeSnapshot } from "../../runtime-store.js";
import type { FullSystemSnapshot } from "../../collectors/remote-collector.js";

// ══ Fixtures ════════════════════════════════════════════════════════════

function pgCandidate(overrides: Partial<Parameters<typeof buildMigrationCandidateReport>[0]> = {}) {
  const snapshot = fullSnapshot();
  const report = buildMigrationCandidateReport(snapshot, { host: "pg-host.example" });
  const candidate = report.candidates.find((c) => /postgres/i.test(c.name));
  return { candidate, snapshot, report };
}

function fullSnapshot(): FullSystemSnapshot {
  return {
    agentId: "test-agent",
    collectedAt: "2026-07-09T10:00:00.000Z",
    collection: { status: "ok", completeness: 1, commands: [], errors: [], timedOut: false },
    collectors: {
      apt: {
        id: "apt", status: "ok", completeness: 1,
        commands: [{ command: "dpkg-query", exitCode: 0 }], errors: [],
        collectedAt: "2026-07-09T10:00:00.000Z",
        data: ["postgresql|16"]
      },
      "services-running": {
        id: "services-running", status: "ok", completeness: 1,
        commands: [{ command: "systemctl list-units", exitCode: 0 }], errors: [],
        collectedAt: "2026-07-09T10:00:00.000Z",
        data: ["postgresql.service"]
      }
    },
    system: {
      hostname: "pg-host",
      platform: "linux", arch: "x86_64", release: "6.8", uptime: 3600,
      osPretty: "Ubuntu 24.04 LTS",
      cpu: { model: "fixture", cores: 4, speedMhz: 2000 },
      memory: { totalBytes: 8192, freeBytes: 4096, usedBytes: 4096, totalGb: "8", freeGb: "4" }
    },
    software: [
      { name: "postgresql", version: "16", source: "apt", status: "installed", trust: "user" },
      { name: "postgresql.service", version: "", source: "systemd", status: "running", trust: "user" }
    ],
    configChecklist: [
      { id: "pg-data", label: "/var/lib/postgresql exists", category: "database", status: "healthy", lastChanged: "2026-07-09" },
      { id: "pg-conf", label: "/etc/postgresql found", category: "database", status: "healthy", lastChanged: "2026-07-09" }
    ],
    counts: {
      apt: 1, rpm: 0, snap: 0, flatpak: 0, npm: 0, pip: 0, gem: 0, cargo: 0,
      localBin: 0, opt: 0, userBin: 0, nvm: 0, pyenv: 0, docker: 0,
      enabledServices: 0, runningServices: 1, total: 2
    }
  };
}

function session() {
  return {
    id: "session-test",
    userId: "test-user",
    connectionId: "conn-test",
    status: "analysis-ready" as const,
    currentStep: "analysis" as const,
    createdAt: "2026-07-09T10:00:00.000Z",
    updatedAt: "2026-07-09T10:00:00.000Z"
  };
}

// ══ Tests ═══════════════════════════════════════════════════════════════

// ── T1: PostgreSQL candidate → logical-dump intent ──

test("T1: PostgreSQL candidate with export-import strategy produces logical-dump intent", () => {
  const { candidate, snapshot } = pgCandidate();
  assert.ok(candidate, "PG candidate found in report");

  const intent = buildPostgresDataMigrationIntent({
    candidate: candidate!,
    snapshot: snapshot as unknown as StoredProbeSnapshot,
    dataDecisions: [{
      id: "dec-test", userId: "test", sessionId: "s", connectionId: "c",
      candidateId: candidate!.id,
      strategy: "export-import" as const,
      status: "confirmed" as const,
      paths: ["/var/lib/postgresql"],
      updatedAt: "2026-07-09T10:00:00.000Z"
    }],
    host: "pg-host.example"
  });

  assert.ok(intent, "intent is not null");
  assert.equal(intent!.candidateId, candidate!.id);
  assert.equal(intent!.strategy, "logical-dump");
  assert.equal(intent!.dryRunOnly, true);
  assert.ok(intent!.requiredApprovals.includes("data-strategy-confirm"));
  assert.ok(intent!.commandTemplates.length > 0, "has command templates");
  assert.equal(intent!.blockedReason, undefined, "no blocked reason when data strategy is confirmed");

  // Verify command templates are blocked
  for (const ct of intent!.commandTemplates) {
    assert.equal(ct.blocked, true, `template ${ct.id} is blocked`);
    assert.equal(ct.requiresSecret, true, `template ${ct.id} requires secret`);
    assert.equal(ct.requiresApproval, true, `template ${ct.id} requires approval`);
    assert.ok(ct.blockedReason.length > 0, `template ${ct.id} has blocked reason`);
  }
});

// ── T2: Non-PostgreSQL candidate → null ──

test("T2: Non-PostgreSQL candidate returns null", () => {
  const snapshot = fullSnapshot();
  // Create a non-PG candidate (nginx)
  const nonPgSnapshot: FullSystemSnapshot = {
    ...snapshot,
    software: [
      { name: "nginx", version: "1.26.0", source: "apt", status: "installed", trust: "user" },
      { name: "nginx.service", version: "", source: "systemd", status: "running", trust: "user" }
    ],
    configChecklist: []
  };
  const report = buildMigrationCandidateReport(nonPgSnapshot, { host: "web-host.example" });
  const nginxCandidate = report.candidates.find((c) => /nginx/i.test(c.name));
  assert.ok(nginxCandidate, "nginx candidate found");

  const intent = buildPostgresDataMigrationIntent({
    candidate: nginxCandidate!,
    snapshot: snapshot as unknown as StoredProbeSnapshot,
    dataDecisions: [],
    host: "web-host.example"
  });

  assert.equal(intent, null, "non-PG candidate returns null");
});

// ── T3: Missing data strategy → blocked ──

test("T3: Missing data strategy decision produces blocked intent", () => {
  const { candidate, snapshot } = pgCandidate();
  assert.ok(candidate);

  const intent = buildPostgresDataMigrationIntent({
    candidate: candidate!,
    snapshot: snapshot as unknown as StoredProbeSnapshot,
    dataDecisions: [],  // no decisions
    host: "pg-host.example"
  });

  assert.ok(intent, "intent is not null (PG is still detected)");
  assert.equal(intent!.strategy, "blocked");
  assert.ok(intent!.blockedReason, "has blocked reason");
  assert.match(intent!.blockedReason!, /not yet been decided/i);
});

// ── T4: Record-only strategy → valid intent ──

test("T4: Record-only data strategy produces valid intent with requires-decision readiness", () => {
  const { candidate, snapshot } = pgCandidate();
  assert.ok(candidate);

  const intent = buildPostgresDataMigrationIntent({
    candidate: candidate!,
    snapshot: snapshot as unknown as StoredProbeSnapshot,
    dataDecisions: [{
      id: "dec-ro", userId: "test", sessionId: "s", connectionId: "c",
      candidateId: candidate!.id,
      strategy: "no-data" as const,
      status: "confirmed" as const,
      paths: [],
      updatedAt: "2026-07-09T10:00:00.000Z"
    }],
    host: "pg-host.example"
  });

  assert.ok(intent);
  assert.equal(intent!.strategy, "manual");
  assert.equal(intent!.blockedReason, undefined);

  const dryRun = buildPostgresDataMigrationDryRun(intent!);
  assert.equal(dryRun.readiness, "requires-decision");
});

// ── T5: Dry-run evidence shape contract ──

test("T5: Dry-run evidence has correct shape contract", () => {
  const { candidate, snapshot } = pgCandidate();
  const intent = buildPostgresDataMigrationIntent({
    candidate: candidate!,
    snapshot: snapshot as unknown as StoredProbeSnapshot,
    dataDecisions: [{
      id: "dec", userId: "test", sessionId: "s", connectionId: "c",
      candidateId: candidate!.id,
      strategy: "export-import" as const,
      status: "confirmed" as const,
      paths: ["/var/lib/postgresql"],
      updatedAt: "2026-07-09T10:00:00.000Z"
    }],
    host: "pg-host.example"
  });
  assert.ok(intent);

  const dryRun = buildPostgresDataMigrationDryRun(intent!);

  // Top-level fields
  assert.equal(dryRun.schemaVersion, "phase5r.dry-run.v1");
  assert.equal(typeof dryRun.generatedAt, "string");
  assert.equal(typeof dryRun.hostname, "string");

  // Assessment block
  assert.equal(dryRun.assessment.candidateFound, true);
  assert.equal(typeof dryRun.assessment.strategyRecommended, "string");
  assert.ok(Array.isArray(dryRun.assessment.requiredDecisions));

  // Readiness
  assert.ok(["requires-decision", "dry-run-ready", "blocked"].includes(dryRun.readiness));

  // Approval gates
  assert.ok(Array.isArray(dryRun.approvalGates));
  assert.ok(dryRun.approvalGates.length > 0);
  for (const gate of dryRun.approvalGates) {
    assert.equal(typeof gate.gate, "string");
    assert.equal(typeof gate.satisfied, "boolean");
  }

  // Command templates
  assert.ok(Array.isArray(dryRun.commandTemplates));
  assert.ok(dryRun.commandTemplates.length > 0);

  // Execution safety
  assert.equal(dryRun.executionBlocked, true, "execution is always blocked");
  assert.equal(typeof dryRun.executionBlockedReason, "string");
  assert.ok(dryRun.executionBlockedReason.length > 0, "execution blocked reason is non-empty");

  // Safety notes
  assert.ok(Array.isArray(dryRun.safetyNotes));
  assert.ok(dryRun.safetyNotes.length >= 3, "at least 3 safety notes");
});

// ── T6: Execution always blocked ──

test("T6: Execution is always blocked regardless of strategy", async (t) => {
  const strategies = ["export-import", "backup-restore", "no-data", "manual"] as const;

  for (const strategy of strategies) {
    await t.test(`strategy=${strategy}`, () => {
      const { candidate, snapshot } = pgCandidate();
      const intent = buildPostgresDataMigrationIntent({
        candidate: candidate!,
        snapshot: snapshot as unknown as StoredProbeSnapshot,
        dataDecisions: [{
          id: "dec", userId: "test", sessionId: "s", connectionId: "c",
          candidateId: candidate!.id,
          strategy,
          status: "confirmed" as const,
          paths: [],
          updatedAt: "2026-07-09T10:00:00.000Z"
        }],
        host: "pg-host.example"
      });
      assert.ok(intent, `intent exists for strategy=${strategy}`);

      const dryRun = buildPostgresDataMigrationDryRun(intent!);
      assert.equal(dryRun.executionBlocked, true, `execution blocked for strategy=${strategy}`);
      assert.ok(dryRun.executionBlockedReason.length > 0);
    });
  }
});

// ── T7: Command templates sanitized — no credentials ──

test("T7: Command templates contain no credential values or raw secrets", () => {
  const { candidate, snapshot } = pgCandidate();
  const intent = buildPostgresDataMigrationIntent({
    candidate: candidate!,
    snapshot: snapshot as unknown as StoredProbeSnapshot,
    dataDecisions: [{
      id: "dec", userId: "test", sessionId: "s", connectionId: "c",
      candidateId: candidate!.id,
      strategy: "export-import" as const,
      status: "confirmed" as const,
      paths: [],
      updatedAt: "2026-07-09T10:00:00.000Z"
    }],
    host: "pg-host.example"
  });
  assert.ok(intent);

  const json = JSON.stringify(intent);

  // No raw credential patterns
  assert.doesNotMatch(json, /\bpassword\b/i);
  assert.doesNotMatch(json, /\bsecret\b/i);
  assert.doesNotMatch(json, /\bprivate[_-]?key\b/i);
  assert.doesNotMatch(json, /\bPGPASSWORD=/i);
  assert.doesNotMatch(json, /DATABASE_URL=/i);

  // Templates use placeholders, not real values
  for (const ct of intent!.commandTemplates) {
    assert.ok(ct.template.includes("<"), `template ${ct.id} uses placeholder angle brackets`);
  }
});

// ── T8: Command templates structurally correct ──

test("T8: Command templates contain expected pg_dump/pg_restore patterns", () => {
  const { candidate, snapshot } = pgCandidate();
  const intent = buildPostgresDataMigrationIntent({
    candidate: candidate!,
    snapshot: snapshot as unknown as StoredProbeSnapshot,
    dataDecisions: [{
      id: "dec", userId: "test", sessionId: "s", connectionId: "c",
      candidateId: candidate!.id,
      strategy: "export-import" as const,
      status: "confirmed" as const,
      paths: [],
      updatedAt: "2026-07-09T10:00:00.000Z"
    }],
    host: "pg-host.example"
  });
  assert.ok(intent);

  const ids = intent!.commandTemplates.map((ct) => ct.id);
  assert.ok(ids.includes("pg-dump-custom"));
  assert.ok(ids.includes("pg-dumpall"));
  assert.ok(ids.includes("pg-basebackup"));
  assert.ok(ids.includes("pg-restore-custom"));

  const dumpTemplate = intent!.commandTemplates.find((ct) => ct.id === "pg-dump-custom")!;
  assert.ok(dumpTemplate.template.includes("-Fc"), "custom format dump template contains -Fc");
  assert.ok(dumpTemplate.template.includes("pg_dump"), "dump template contains pg_dump");

  const restoreTemplate = intent!.commandTemplates.find((ct) => ct.id === "pg-restore-custom")!;
  assert.ok(restoreTemplate.template.includes("pg_restore"), "restore template contains pg_restore");
  assert.ok(restoreTemplate.template.includes("-d"), "restore template contains -d (dbname)");
});

// ── T9: Safety notes populated ──

test("T9: Safety notes contain required guidance", () => {
  const { candidate, snapshot } = pgCandidate();
  const intent = buildPostgresDataMigrationIntent({
    candidate: candidate!,
    snapshot: snapshot as unknown as StoredProbeSnapshot,
    dataDecisions: [{
      id: "dec", userId: "test", sessionId: "s", connectionId: "c",
      candidateId: candidate!.id,
      strategy: "export-import" as const,
      status: "confirmed" as const,
      paths: [],
      updatedAt: "2026-07-09T10:00:00.000Z"
    }],
    host: "pg-host.example"
  });
  assert.ok(intent);

  const dryRun = buildPostgresDataMigrationDryRun(intent!);

  assert.ok(dryRun.safetyNotes.length >= 3, "at least 3 safety notes");
  assert.ok(dryRun.safetyNotes.some((n) => /no database connection/i.test(n)));
  assert.ok(dryRun.safetyNotes.some((n) => /sanitized/i.test(n)));
  assert.ok(dryRun.safetyNotes.some((n) => /credential/i.test(n.toLowerCase())));
  assert.ok(dryRun.safetyNotes.some((n) => /direct file copy/i.test(n.toLowerCase()) || /corrupt/i.test(n.toLowerCase())));
});

// ── T10: AssessmentSummary includes postgresDataMigrationDryRun for PG ──

test("T10: AssessmentSummary includes postgresDataMigrationDryRun when PostgreSQL is present", () => {
  const snapshot = fullSnapshot();
  const report = buildMigrationCandidateReport(snapshot, { host: "pg-host.example" });
  const assessment = buildAssessmentSummary({
    session: session(),
    snapshot,
    report,
    host: "pg-host.example",
    generatedAt: "2026-07-09T10:01:00.000Z",
    envForgeVersion: "0.1.0",
    catalogVersion: "test-v1"
  });

  assert.ok(assessment.postgresDataMigrationDryRun, "postgresDataMigrationDryRun is populated");
  const dryRun = assessment.postgresDataMigrationDryRun!;
  assert.equal(dryRun.schemaVersion, "phase5r.dry-run.v1");
  assert.equal(dryRun.executionBlocked, true);
  assert.ok(dryRun.assessment.candidateFound);

  // Existing fields unchanged
  assert.ok(Array.isArray(assessment.serviceStacks));
  assert.ok(assessment.serviceStacks.length > 0);
});

// ── T11: AssessmentSummary omits postgresDataMigrationDryRun for non-PG ──

test("T11: AssessmentSummary omits postgresDataMigrationDryRun when no PostgreSQL present", () => {
  // Assessment summary fixture without postgres
  const nonPgSnapshot: FullSystemSnapshot = {
    agentId: "test-agent",
    collectedAt: "2026-07-09T10:00:00.000Z",
    collection: { status: "ok", completeness: 1, commands: [], errors: [], timedOut: false },
    collectors: {},
    system: {
      hostname: "web-host", platform: "linux", arch: "x86_64", release: "6.8", uptime: 3600,
      osPretty: "Ubuntu 24.04 LTS",
      cpu: { model: "fixture", cores: 2, speedMhz: 2000 },
      memory: { totalBytes: 4096, freeBytes: 2048, usedBytes: 2048, totalGb: "4", freeGb: "2" }
    },
    software: [
      { name: "nginx", version: "1.26", source: "apt", status: "installed", trust: "user" }
    ],
    configChecklist: [],
    counts: { apt: 1, rpm: 0, snap: 0, flatpak: 0, npm: 0, pip: 0, gem: 0, cargo: 0, localBin: 0, opt: 0, userBin: 0, nvm: 0, pyenv: 0, docker: 0, enabledServices: 0, runningServices: 0, total: 1 }
  };
  const report = buildMigrationCandidateReport(nonPgSnapshot, { host: "web-host.example" });
  const assessment = buildAssessmentSummary({
    session: session(),
    snapshot: nonPgSnapshot,
    report,
    host: "web-host.example",
    generatedAt: "2026-07-09T10:01:00.000Z",
    envForgeVersion: "0.1.0",
    catalogVersion: "test-v1"
  });

  assert.equal(assessment.postgresDataMigrationDryRun, undefined);
});

// ── T12: secret safety in dry-run JSON ──

test("T12: No raw secrets leak in dry-run evidence JSON", () => {
  const { candidate, snapshot } = pgCandidate();
  const intent = buildPostgresDataMigrationIntent({
    candidate: candidate!,
    snapshot: snapshot as unknown as StoredProbeSnapshot,
    dataDecisions: [{
      id: "dec", userId: "test", sessionId: "s", connectionId: "c",
      candidateId: candidate!.id,
      strategy: "export-import" as const,
      status: "confirmed" as const,
      paths: ["/var/lib/postgresql"],
      updatedAt: "2026-07-09T10:00:00.000Z"
    }],
    host: "pg-host.example"
  });
  assert.ok(intent);
  const dryRun = buildPostgresDataMigrationDryRun(intent!);

  const json = JSON.stringify(dryRun);

  // No credential values — exclude structural field names (requiresSecret, blockedReason mentions "secret")
  assert.doesNotMatch(json, /"password":/i);
  assert.doesNotMatch(json, /"token":/i);
  assert.doesNotMatch(json, /PGPASSWORD=/i);
  assert.doesNotMatch(json, /DATABASE_URL=/i);
  assert.doesNotMatch(json, /api[_-]?key/i);
  // Verify these safety-related structural fields exist (they contain the word but are field names)
  assert.ok(json.includes('"requiresSecret"'));
  assert.ok(json.includes('"blocked":true'));
});

// ── T13 (bonus): postgresDataMigrationDryRunForAssessment helper ──

test("T13: Helper returns undefined when no PG candidate in list", () => {
  const snapshot = fullSnapshot();
  const nonPgSnapshot: FullSystemSnapshot = {
    ...snapshot,
    software: [{ name: "redis", version: "7", source: "apt", status: "installed", trust: "user" }],
  };
  const report = buildMigrationCandidateReport(nonPgSnapshot, { host: "redis-host.example" });

  const result = postgresDataMigrationDryRunForAssessment({
    candidates: report.candidates,
    snapshot: snapshot as unknown as StoredProbeSnapshot,
    dataDecisions: [],
    host: "redis-host.example"
  });

  assert.equal(result, undefined, "returns undefined when no PG candidate");
});
