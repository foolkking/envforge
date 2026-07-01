import test from "node:test";
import assert from "node:assert/strict";
import { buildMigrationCandidateReport } from "../../migration-classifier.js";
import {
  assessmentReportToMarkdown,
  buildAssessmentSummary
} from "../../migration-assessment.js";
import type { FullSystemSnapshot } from "../../collectors/remote-collector.js";
import type { StoredMigrationDecision, StoredMigrationSession } from "../../runtime-store.js";

function session(): StoredMigrationSession {
  return {
    id: "msess-assessment",
    userId: "assessment-user",
    connectionId: "source-connection",
    status: "analysis-ready",
    currentStep: "analysis",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z"
  };
}

function snapshot(overrides: Partial<FullSystemSnapshot> = {}): FullSystemSnapshot {
  const software: FullSystemSnapshot["software"] = [
    { name: "postgresql", version: "16", source: "apt", status: "installed", trust: "user" },
    { name: "postgresql", version: "running-service", source: "systemd", status: "running", trust: "user" }
  ];
  return {
    agentId: "assessment-agent",
    collectedAt: "2026-07-01T00:01:00.000Z",
    collection: {
      status: "ok",
      completeness: 1,
      commands: [{ command: "envforge-remote-collector", exitCode: 0 }],
      errors: [],
      timedOut: false
    },
    collectors: {
      apt: {
        id: "apt",
        status: "ok",
        completeness: 1,
        commands: [{ command: "dpkg-query", exitCode: 0 }],
        errors: [],
        collectedAt: "2026-07-01T00:01:00.000Z",
        data: ["postgresql|16"]
      },
      "services-running": {
        id: "services-running",
        status: "ok",
        completeness: 1,
        commands: [{ command: "systemctl list-units", exitCode: 0 }],
        errors: [],
        collectedAt: "2026-07-01T00:01:00.000Z",
        data: ["postgresql.service"]
      },
      "docker-images": {
        id: "docker-images",
        status: "ok",
        completeness: 1,
        commands: [{ command: "docker images", exitCode: 0 }],
        errors: [],
        collectedAt: "2026-07-01T00:01:00.000Z",
        data: []
      }
    },
    system: {
      hostname: "legacy-db",
      platform: "linux",
      arch: "x86_64",
      release: "6.8",
      uptime: 3600,
      osPretty: "Ubuntu 24.04 LTS",
      cpu: { model: "fixture", cores: 4, speedMhz: 2000 },
      memory: { totalBytes: 1024, freeBytes: 512, usedBytes: 512, totalGb: "1", freeGb: "0.5" }
    },
    software,
    configChecklist: [
      { id: "open-ports", label: "Open ports: 5432", category: "network", status: "healthy", lastChanged: "2026-07-01" },
      { id: "postgresql-config", label: "pg_hba.conf and postgresql.conf found", category: "database", status: "healthy", lastChanged: "2026-07-01" },
      { id: "postgresql-data", label: "/var/lib/postgresql exists", category: "database", status: "healthy", lastChanged: "2026-07-01" }
    ],
    counts: {
      apt: 1, rpm: 0, snap: 0, flatpak: 0, npm: 0, pip: 0, gem: 0, cargo: 0,
      localBin: 0, opt: 0, userBin: 0, nvm: 0, pyenv: 0, docker: 0,
      enabledServices: 0, runningServices: 1, total: 2
    },
    ...overrides
  };
}

function assessment(source: FullSystemSnapshot, decisions: StoredMigrationDecision[] = []) {
  return buildAssessmentSummary({
    session: session(),
    snapshot: source,
    report: buildMigrationCandidateReport(source, { host: "legacy-db.example" }),
    decisions,
    host: "legacy-db.example",
    generatedAt: "2026-07-01T00:02:00.000Z",
    envForgeVersion: "0.1.0",
    catalogVersion: "fixture-v1"
  });
}

test("Assessment closes the database strategy prompt after an explicit record-only or manual decision", () => {
  const source = snapshot();
  const candidateId = buildMigrationCandidateReport(source, { host: "legacy-db.example" }).candidates.find((candidate) => /postgres/i.test(candidate.name))?.id;
  assert.ok(candidateId);
  const stored = (decision: StoredMigrationDecision["decision"]): StoredMigrationDecision => ({
    id: `decision-${decision}`,
    userId: "assessment-user",
    connectionId: "source-connection",
    candidateId,
    decision,
    updatedAt: "2026-07-01T00:03:00.000Z"
  });

  const recordOnly = assessment(source, [stored("record-only")]);
  assert.equal(recordOnly.requiredDecisions.length, 0);
  assert.equal(recordOnly.serviceStacks.find((stack) => stack.category === "database")?.migrationReadiness, "record-only-recommended");

  const manual = assessment(source, [stored("needs-manual-instruction")]);
  assert.equal(manual.requiredDecisions.length, 0);
  assert.equal(manual.serviceStacks.find((stack) => stack.category === "database")?.migrationReadiness, "manual");
});

test("Assessment summarizes PostgreSQL as a high-risk stateful database with a required data decision", () => {
  const result = assessment(snapshot());
  const postgres = result.serviceStacks.find((stack) => stack.category === "database");

  assert.ok(postgres);
  assert.equal(postgres.name, "PostgreSQL Database");
  assert.equal(postgres.statefulness, "stateful");
  assert.equal(postgres.risk, "high");
  assert.equal(postgres.confidence, "high");
  assert.equal(postgres.migrationReadiness, "requires-decision");
  assert.equal(postgres.recommendedStrategy, "Use pg_dump/pg_restore for logical migration.");
  assert.ok(postgres.evidence.some((evidence) => evidence.label.includes("postgresql.service is active")));
  assert.ok(postgres.evidence.some((evidence) => evidence.label.includes("port 5432 is listening")));
  assert.ok(postgres.evidence.some((evidence) => evidence.label.includes("pg_hba.conf and postgresql.conf found")));
  assert.ok(postgres.evidence.some((evidence) => evidence.label.includes("/var/lib/postgresql exists")));
  assert.ok(postgres.riskReasons.some((reason) => reason.includes("Direct file copy may corrupt data")));
  assert.ok(postgres.riskReasons.some((reason) => reason.includes("Backup freshness is unknown")));

  const decision = result.requiredDecisions.find((item) => item.title === "PostgreSQL data migration strategy");
  assert.ok(decision);
  assert.equal(decision.options.length, 4);
  assert.equal(decision.options[0].label, "Use pg_dump/pg_restore");
  assert.equal(result.readiness.status, "apply-requires-decisions");
});

test("Assessment preserves failed collector evidence instead of treating empty Docker data as absence", () => {
  const complete = assessment(snapshot());
  const dockerComplete = complete.evidenceQuality.collectors.find((collector) => collector.name === "docker-images");
  assert.equal(dockerComplete?.status, "ok");
  assert.equal(complete.serviceStacks.some((stack) => /docker/i.test(stack.name)), false, "ok + empty means Docker workload was not found");

  const partialSnapshot = snapshot({
    collection: {
      status: "partial",
      completeness: 0.62,
      commands: [{ command: "envforge-remote-collector", timedOut: true }],
      stderr: "docker daemon permission denied",
      errors: ["collection timed out"],
      timedOut: true
    },
    collectors: {
      ...snapshot().collectors,
      "docker-images": {
        id: "docker-images",
        status: "failed",
        completeness: 0,
        commands: [{ command: "docker images", exitCode: 1, timedOut: false }],
        stderr: "permission denied",
        errors: ["docker inventory failed"],
        collectedAt: "2026-07-01T00:01:00.000Z",
        data: []
      }
    }
  });
  const partial = assessment(partialSnapshot);
  const dockerFailed = partial.evidenceQuality.collectors.find((collector) => collector.name === "docker-images");
  assert.equal(dockerFailed?.status, "failed");
  assert.deepEqual(dockerFailed?.failedCommands, ["docker images"]);
  assert.equal(dockerFailed?.stderrSummary, "permission denied");
  assert.ok(partial.evidenceQuality.notes.some((note) => note.includes("empty result") && note.includes("does not mean")));
  assert.equal(partial.availability, "collector-incomplete");
  assert.equal(partial.readiness.status, "blocked-by-missing-evidence");
  assert.equal(partial.snapshot?.completeness.timedOut, true);
});

test("Assessment JSON and Markdown reports redact secrets and state the read-only boundary", () => {
  const source = snapshot({
    configChecklist: [
      ...snapshot().configChecklist,
      {
        id: "postgresql-env",
        label: "DATABASE_URL=postgres://envforge:super-secret-password@db.internal/app",
        category: "database",
        status: "review",
        lastChanged: "2026-07-01"
      }
    ]
  });
  const result = assessment(source);
  const json = JSON.stringify(result);
  const markdown = assessmentReportToMarkdown(result);

  assert.doesNotMatch(json, /super-secret-password/);
  assert.doesNotMatch(markdown, /super-secret-password/);
  assert.match(json, /REDACTED-DB-URL-PASSWORD/);
  assert.match(markdown, /Sensitive values are redacted by default/);
  assert.match(markdown, /This assessment was generated in read-only mode/);
  assert.match(markdown, /No apply run was created/);
  assert.match(markdown, /No target mutation was performed/);
});
