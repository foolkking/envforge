/**
 * phase1-bypass.test.ts — Phase 1 bypass runtime regression tests
 *
 * Added in Phase 2 as a postponed Phase 1 deliverable.
 * These tests prove that executePlaybookTask() and executePlaybook()
 * (without approved-artifact context) are blocked at runtime.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { _resetStoreForTests, updateRuntimeDatabase, type StoredConnection } from "../../runtime-store.js";
import { executePlaybookTask } from "../../executor.js";
import { executePlaybook, type ApprovedArtifactExecutionContext } from "../../engine/index.js";

// ══ Helpers ═══════════════════════════════════════════════════════════

function mockConnection(): StoredConnection {
  return {
    id: "bypass-test-conn",
    userId: "bypass-user",
    method: "ssh-password",
    label: "test",
    status: "ssh_ok",
    fields: { host: "127.0.0.1", port: "22", username: "root", _rawPassword: "test" },
    sshError: undefined,
    tags: [],
    probeSnapshot: undefined,
    agentUrl: undefined,
    lastProbeAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    maskedSecrets: {} as any,
    realConnection: undefined as any
  };
}

const malYaml = `name: bypass-test
hosts: all
tasks:
  - name: install nginx
    module: package
    args:
      name: nginx
      state: present
  - name: raw shell
    module: shell
    args:
      cmd: id
`;

const emptyExecCtx: ApprovedArtifactExecutionContext = {
  planId: "", planHash: "", artifactHash: "", actionId: "", source: "approved-artifact" as const
};

// ══ executePlaybookTask — direct execution blocked ════════════════════

test("executePlaybookTask: direct playbook execution returns failed task", async () => {
  // Set up temp runtime DB
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "envforge-phase1-bypass-"));
  process.env.FOOL_RUNTIME_DB = path.join(tmpDir, "runtime.json");
  process.env.FOOL_DATA_DIR = tmpDir;
  await fs.writeFile(process.env.FOOL_RUNTIME_DB, JSON.stringify({
    schemaVersion: "0.3.0", users: [], sessions: [], connections: [], tasks: [], playbooks: []
  }));
  _resetStoreForTests();

  const conn = mockConnection();
  const task = await executePlaybookTask("bypass-user", conn, malYaml, false);

  // Assert: task is failed
  assert.equal(task.status, "failed", `Expected failed, got ${task.status}`);
  assert.ok(task.error, "Expected error message");
  assert.match(task.error!, /disabled/i, "Error should mention disabled");
  assert.match(task.error!, /Environment Plan/i, "Error should mention Environment Plan");

  _resetStoreForTests();
  await new Promise(resolve => setTimeout(resolve, 100));
  await fs.rm(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

test("executePlaybookTask: does not succeed (SSH never called)", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "envforge-phase1-bp2-"));
  process.env.FOOL_RUNTIME_DB = path.join(tmpDir, "runtime.json");
  process.env.FOOL_DATA_DIR = tmpDir;
  await fs.writeFile(process.env.FOOL_RUNTIME_DB, JSON.stringify({
    schemaVersion: "0.3.0", users: [], sessions: [], connections: [], tasks: [], playbooks: []
  }));
  _resetStoreForTests();

  const conn = mockConnection();
  const task = await executePlaybookTask("bypass-user", conn, malYaml, false);

  // The task should not have succeeded — there is no SSH connection to this host
  assert.notEqual(task.status, "succeeded", "executePlaybookTask should never succeed");
  assert.equal(task.items?.[0]?.status, "failed");

  _resetStoreForTests();
  await new Promise(resolve => setTimeout(resolve, 100));
  await fs.rm(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

// ══ executePlaybook — without approved context rejected ═══════════════

test("executePlaybook: without approved-artifact context throws", async () => {
  // Call executePlaybook with no execCtx — should throw immediately
  const conn = mockConnection();
  await assert.rejects(
    async () => executePlaybook(malYaml, conn, { dryRun: false }),
    (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      return /disabled/i.test(message) && /Environment Plan/i.test(message);
    }
  );
});

test("executePlaybook: with execCtx but empty fields throws", async () => {
  const conn = mockConnection();
  // emptyExecCtx has source="approved-artifact" but empty planId/planHash/artifactHash/actionId
  await assert.rejects(
    async () => executePlaybook(malYaml, conn, { dryRun: false }, emptyExecCtx),
    (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      return /disabled/i.test(message);
    }
  );
});
