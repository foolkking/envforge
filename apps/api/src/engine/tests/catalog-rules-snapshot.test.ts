/**
 * catalog-rules-snapshot.test.ts — zero-drift guard for the rule registry.
 *
 * Phase A refactors hand-written CatalogDetectionRule literals into the
 * `nativeRule(...)` archetype factory. This test pins the canonical
 * (key-sorted, deep) serialization of `catalogDetectionRules` to a
 * committed baseline so any accidental semantic change — a dropped
 * field, a different packageMap, a reordered validate array — fails
 * loudly. The factory migration is provably an identity transform iff
 * this snapshot stays green.
 *
 * If a rule is *intentionally* changed in the future, regenerate the
 * fixture from dist and review the diff.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { catalogDetectionRules } from "../../catalog-rules.js";

/** Deep key-sort so equality is by content, not key insertion order
 *  (the factory may emit keys in a different order than the old literal). */
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = stable((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

const here = dirname(fileURLToPath(import.meta.url));
// dist/engine/tests → ../../../src/engine/tests/fixtures (fixture lives in source)
const fixturePath = resolve(here, "../../../src/engine/tests/fixtures/catalog-rules.snapshot.json");

test("catalogDetectionRules matches the committed baseline (zero drift)", () => {
  const baseline = readFileSync(fixturePath, "utf8");
  const current = JSON.stringify(stable(catalogDetectionRules), null, 0);
  if (current !== baseline) {
    // Surface a small, actionable hint rather than dumping ~190KB.
    assert.equal(
      current.length,
      baseline.length,
      `catalogDetectionRules drifted from the baseline (len ${current.length} vs ${baseline.length}). ` +
      `If this change is intentional, regenerate src/engine/tests/fixtures/catalog-rules.snapshot.json from dist and review the diff.`
    );
    assert.equal(current, baseline, "catalogDetectionRules content drifted from the baseline snapshot.");
  }
  assert.ok(catalogDetectionRules.length > 0);
});
