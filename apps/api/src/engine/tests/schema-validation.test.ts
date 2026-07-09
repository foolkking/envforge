/**
 * schema-validation.test.ts — Phase 6R-B schema validation tests.
 *
 * 18 tests covering plan create/review/apply and migration decision
 * body validators. Pure unit tests — no Fastify instance needed.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  validateCreatePlanBody,
  validateReviewPlanBody,
  validateApplyPlanBody,
} from "../../schemas/plan-schemas.js";
import { validateMigrationDecisionsBody } from "../../schemas/migration-schemas.js";
import {
  ensureObject,
  ensureString,
  ensureNonEmptyString,
  ensureEnum,
  ensureStringArray,
  ensureObjectArray,
  forbidFields,
  restrictFields,
} from "../../schemas/shared.js";

// ══ S1-S7: POST /api/plans (create) ═════════════════════════════════════

test("S1: validateCreatePlanBody accepts valid capability-selection body", () => {
  const r = validateCreatePlanBody({
    targetConnectionId: "conn-123",
    source: { kind: "capability-selection", capabilityIds: ["cap-1", "cap-2"] },
  });
  assert.ok(r.ok, `expected ok but got: ${(r as { error: string }).error}`);
  if (r.ok) {
    assert.equal(r.value.source?.kind, "capability-selection");
  }
});

test("S2: validateCreatePlanBody accepts valid recipe body", () => {
  const r = validateCreatePlanBody({
    targetConnectionId: "conn-123",
    source: { kind: "recipe", yaml: "name: test\nsteps: []", name: "my-recipe" },
  });
  assert.ok(r.ok, `expected ok but got: ${(r as { error: string }).error}`);
  if (r.ok) {
    assert.equal(r.value.source?.kind, "recipe");
  }
});

test("S3: validateCreatePlanBody accepts valid config-change body", () => {
  const r = validateCreatePlanBody({
    targetConnectionId: "conn-123",
    source: { kind: "config-change", path: "/etc/nginx/nginx.conf", content: "# new config" },
  });
  assert.ok(r.ok, `expected ok but got: ${(r as { error: string }).error}`);
  if (r.ok) {
    assert.equal(r.value.source?.kind, "config-change");
  }
});

test("S4: validateCreatePlanBody rejects missing source.kind", () => {
  const r = validateCreatePlanBody({
    targetConnectionId: "conn-123",
    source: { notKind: "something" },
  });
  assert.ok(!r.ok, "expected error for missing source.kind");
  if (!r.ok) {
    assert.ok(r.error.includes("source.kind"), `error should mention source.kind: ${r.error}`);
  }
});

test("S5: validateCreatePlanBody rejects unknown source.kind", () => {
  const r = validateCreatePlanBody({
    targetConnectionId: "conn-123",
    source: { kind: "unsupported-kind" },
  });
  assert.ok(!r.ok, "expected error for unknown source.kind");
  if (!r.ok) {
    assert.ok(r.error.includes("must be one of"), `error should mention valid kinds: ${r.error}`);
  }
});

test("S6: validateCreatePlanBody rejects null body", () => {
  const r = validateCreatePlanBody(null);
  assert.ok(!r.ok, "expected error for null body");
  if (!r.ok) {
    assert.ok(r.error.includes("required"), `error should say required: ${r.error}`);
  }
});

test("S7: validateCreatePlanBody rejects array body", () => {
  const r = validateCreatePlanBody([{ kind: "recipe" }]);
  assert.ok(!r.ok, "expected error for array body");
  if (!r.ok) {
    assert.ok(r.error.includes("object"), `error should say object: ${r.error}`);
  }
});

// ══ S8-S11: POST /api/plans/:id/review ═════════════════════════════════

test("S8: validateReviewPlanBody accepts approved decision", () => {
  const r = validateReviewPlanBody({ decision: "approved" });
  assert.ok(r.ok, `expected ok but got: ${(r as { error: string }).error}`);
  if (r.ok) {
    assert.equal(r.value.decision, "approved");
  }
});

test("S9: validateReviewPlanBody accepts rejected decision", () => {
  const r = validateReviewPlanBody({ decision: "rejected", note: "Not ready yet" });
  assert.ok(r.ok, `expected ok but got: ${(r as { error: string }).error}`);
  if (r.ok) {
    assert.equal(r.value.decision, "rejected");
    assert.equal(r.value.note, "Not ready yet");
  }
});

test("S10: validateReviewPlanBody rejects invalid decision", () => {
  const r = validateReviewPlanBody({ decision: "invalid-choice" });
  assert.ok(!r.ok, "expected error for invalid decision");
  if (!r.ok) {
    assert.ok(r.error.includes("must be one of"), `error should enumerate valid values: ${r.error}`);
  }
});

test("S11: validateReviewPlanBody rejects plan field (forbidden)", () => {
  const r = validateReviewPlanBody({ decision: "approved", plan: { id: "p1" } });
  assert.ok(!r.ok, "expected error for forbidden plan field");
  if (!r.ok) {
    assert.ok(r.error.includes("forbidden"), `error should say forbidden: ${r.error}`);
  }
});

// ══ S12-S15: POST /api/plans/:id/apply ═════════════════════════════════

test("S12: validateApplyPlanBody accepts valid dryRun=true body", () => {
  const r = validateApplyPlanBody({ dryRun: true });
  assert.ok(r.ok, `expected ok but got: ${(r as { error: string }).error}`);
  if (r.ok) {
    assert.equal(r.value.dryRun, true);
  }
});

test("S13: validateApplyPlanBody accepts valid non-dryRun body with key", () => {
  const r = validateApplyPlanBody({
    dryRun: false,
    idempotencyKey: "idem-abc123",
    targetConnectionId: "conn-456",
  });
  assert.ok(r.ok, `expected ok but got: ${(r as { error: string }).error}`);
  if (r.ok) {
    assert.equal(r.value.dryRun, false);
    assert.equal(r.value.idempotencyKey, "idem-abc123");
    assert.equal(r.value.targetConnectionId, "conn-456");
  }
});

test("S14: validateApplyPlanBody rejects forbidden field (plan)", () => {
  const r = validateApplyPlanBody({ dryRun: true, plan: { id: "p1" } });
  assert.ok(!r.ok, "expected error for forbidden plan field");
  if (!r.ok) {
    assert.ok(r.error.includes("forbidden"), `error should say forbidden: ${r.error}`);
  }
});

test("S15: validateApplyPlanBody rejects unknown field", () => {
  const r = validateApplyPlanBody({ dryRun: true, extraField: 42 });
  assert.ok(!r.ok, "expected error for unknown field");
  if (!r.ok) {
    assert.ok(r.error.includes("unsupported"), `error should say unsupported: ${r.error}`);
  }
});

// ══ S16-S18: POST /api/migration/sessions/:sessionId/decisions ═════════

test("S16: validateMigrationDecisionsBody accepts valid decision with candidateIds", () => {
  const r = validateMigrationDecisionsBody({
    candidateIds: ["cand-1", "cand-2"],
    decision: "approved",
    note: "looks good",
  });
  assert.ok(r.ok, `expected ok but got: ${(r as { error: string }).error}`);
  if (r.ok) {
    assert.equal(r.value.decision, "approved");
    assert.deepEqual(r.value.candidateIds, ["cand-1", "cand-2"]);
  }
});

test("S17: validateMigrationDecisionsBody rejects candidateIds that is not an array", () => {
  const r = validateMigrationDecisionsBody({
    candidateIds: "not-an-array",
    decision: "approved",
  });
  assert.ok(!r.ok, "expected error for non-array candidateIds");
  if (!r.ok) {
    assert.ok(r.error.includes("array"), `error should say array: ${r.error}`);
  }
});

test("S18: validateMigrationDecisionsBody rejects candidateIds with non-string elements", () => {
  const r = validateMigrationDecisionsBody({
    candidateIds: ["ok", 123, null],
    decision: "approved",
  });
  assert.ok(!r.ok, "expected error for non-string candidateIds element");
  if (!r.ok) {
    assert.ok(r.error.includes("string"), `error should say string: ${r.error}`);
  }
});

// ══ SS1-SS6: Error shape & shared primitives ════════════════════════════

test("SS1: validation error shape is stable — has ok, error, optional field", () => {
  const r = validateReviewPlanBody({ decision: "bad" });
  assert.ok(!r.ok);
  if (!r.ok) {
    assert.equal(typeof r.error, "string");
    assert.ok(r.error.length > 0);
    // field is optional, but if present must be string
    if (r.field !== undefined) {
      assert.equal(typeof r.field, "string");
    }
  }
});

test("SS2: validation error does not leak stack traces", () => {
  // All validators return plain error strings, never Error objects
  const r1 = validateCreatePlanBody(null);
  if (!r1.ok) {
    assert.doesNotMatch(r1.error, /at\s+/);   // no stack trace line
    assert.doesNotMatch(r1.error, /\.ts:\d+/); // no file:line
  }
  const r2 = validateReviewPlanBody("not-object");
  if (!r2.ok) {
    assert.doesNotMatch(r2.error, /at\s+/);
    assert.doesNotMatch(r2.error, /\.ts:\d+/);
  }
});

test("SS3: validation error does not echo secret-like values", () => {
  const r = validateCreatePlanBody({
    password: "secret123",
    apiKey: "sk-live-abcdef",
  });
  // It may error (bad body shape) but must not echo password/apiKey values
  const json = JSON.stringify(r);
  assert.doesNotMatch(json, /secret123/i);
  assert.doesNotMatch(json, /sk-live-abcdef/i);
});

test("SS4: ensureString rejects non-strings", () => {
  const r = ensureString(42, "count");
  assert.ok(!r.ok);
  if (!r.ok) assert.ok(r.error.includes("must be a string"));
});

test("SS5: ensureEnum rejects values not in the allowed set", () => {
  const r = ensureEnum("maybe", ["yes", "no"] as const, "answer");
  assert.ok(!r.ok);
  if (!r.ok) assert.ok(r.error.includes("must be one of"));
});

test("SS6: ensureStringArray trims whitespace from elements", () => {
  const r = ensureStringArray(["  hello  ", "world"], "items");
  assert.ok(r.ok);
  if (r.ok) {
    assert.deepEqual(r.value, ["hello", "world"]);
  }
});

// ══ SS7-SS8: forbidFields / restrictFields ══════════════════════════════

test("SS7: forbidFields rejects bodies containing forbidden fields", () => {
  const r = forbidFields({ plan: {}, dryRun: true }, ["plan", "path"]);
  assert.ok(r !== null, "should reject forbidden field");
  if (r) {
    assert.ok(r.error.includes("forbidden"));
    assert.ok(r.error.includes("plan"));
  }
});

test("SS8: restrictFields rejects bodies with fields outside the allowlist", () => {
  const r = restrictFields(
    { dryRun: true, extra: "bad", alsoBad: 1 },
    ["dryRun", "idempotencyKey", "targetConnectionId"]
  );
  assert.ok(r !== null, "should reject unsupported fields");
  if (r) {
    assert.ok(r.error.includes("unsupported"));
  }
});
