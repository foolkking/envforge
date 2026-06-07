#!/usr/bin/env node
/**
 * Generate docs/CAPABILITY_CERTIFICATION_BACKLOG.md from the audit
 * JSON. Re-run after every certification:check.
 */
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const auditPath = path.resolve(repoRoot, "docs/catalog-audit/full-migration-certification.json");
const out = path.resolve(repoRoot, "docs/CAPABILITY_CERTIFICATION_BACKLOG.md");

const data = JSON.parse(await fs.readFile(auditPath, "utf8"));
const certified = data.records.filter((r) => r.certificationStatus === "certified");
const notReady = data.records.filter((r) => r.certificationStatus === "not-ready");
const openBacklog = notReady.filter((r) => r.decisionStatus === "upgrade-backlog");
const terminalDecisions = notReady.filter((r) => r.decisionStatus !== "upgrade-backlog");

const SECTION_TO_EFFORT = {
  identity: "small",
  detection: "small",
  install: "small",
  config: "medium",
  data: "large",
  references: "small",
  validate: "medium",
  rollback: "medium",
  security: "small",
  crossDistro: "small",
  conflicts: "small",
  planIntegration: "huge",
  harness: "medium"
};

function priorityOf(record) {
  // The audit attaches a per-task priority; we take the highest
  // (smallest letter) priority across the open tasks.
  const order = { P0: 0, P1: 1, P2: 2, P3: 3 };
  let best = "P3";
  for (const t of record.upgradeTasks ?? []) {
    if ((order[t.priority] ?? 99) < order[best]) best = t.priority;
  }
  return best;
}

function effortOf(record) {
  let max = "small";
  const rank = { small: 0, medium: 1, large: 2, huge: 3 };
  for (const sec of record.missingRequirements ?? []) {
    const e = SECTION_TO_EFFORT[sec] ?? "medium";
    if (rank[e] > rank[max]) max = e;
  }
  return max;
}

const buckets = { P0: [], P1: [], P2: [], P3: [] };
for (const r of openBacklog) buckets[priorityOf(r)].push(r);

const lines = [];
lines.push("# Capability Certification Backlog");
lines.push("");
lines.push(`Generated from \`docs/catalog-audit/full-migration-certification.json\` at ${data.generatedAt}.`);
lines.push("");
lines.push("> The long-term goal is for every capability the platform retains to be Full Migration Certified.");
lines.push("> Until then, end users only see the items in the **Currently certified** list. Everything else");
lines.push("> stays hidden in the admin registry. Open upgrade-backlog items are actionable; terminal");
lines.push("> decision items are intentionally blocked, archive candidates, or pending product policy.");
lines.push("");
lines.push("## Totals");
lines.push("");
lines.push(`- catalog : **${data.totals.catalog}**`);
lines.push(`- certified : **${data.totals.certified}**`);
lines.push(`- not-ready : **${data.totals.notReady}**`);
lines.push(`- open upgrade backlog : **${data.totals.upgradeBacklog ?? openBacklog.length}**`);
lines.push(`- terminal decisions : **${data.totals.terminalDecisions ?? terminalDecisions.length}**`);
lines.push(`  - blocked : **${data.totals.blocked ?? terminalDecisions.filter((r) => r.decisionStatus === "blocked").length}**`);
lines.push(`  - archive-candidate : **${data.totals.archiveCandidates ?? terminalDecisions.filter((r) => r.decisionStatus === "archive-candidate").length}**`);
lines.push(`  - needs-human-decision : **${data.totals.needsHumanDecision ?? terminalDecisions.filter((r) => r.decisionStatus === "needs-human-decision").length}**`);
lines.push("");

lines.push("## Currently certified");
lines.push("");
if (certified.length === 0) {
  lines.push("_None._");
} else {
  for (const r of certified) {
    lines.push(`- **${r.id}** (\`${r.capabilityKey ?? "n/a"}\`) — score ${r.certificationScore}/100`);
  }
}
lines.push("");

lines.push("## Open upgrade backlog");
lines.push("");
if (openBacklog.length === 0) {
  lines.push("_No open upgrade-backlog items remain. All hidden not-ready items have explicit terminal decisions._");
  lines.push("");
}

for (const priority of ["P0", "P1", "P2", "P3"]) {
  const bucket = buckets[priority];
  if (bucket.length === 0) continue;
  lines.push(`## ${priority} — ${bucket.length} item(s)`);
  lines.push("");
  bucket.sort((a, b) => b.certificationScore - a.certificationScore);
  for (const r of bucket) {
    lines.push(`### ${r.id} — score ${r.certificationScore}/100, effort \`${effortOf(r)}\``);
    lines.push("");
    lines.push(`- capabilityKey: \`${r.capabilityKey ?? "n/a"}\``);
    lines.push(`- category: ${r.category}`);
    if (r.decisionStatus) {
      lines.push(`- decision: \`${r.decisionStatus}\`${r.decisionReason ? ` - ${r.decisionReason}` : ""}`);
    }
    if (r.missingRequirements.length) {
      lines.push(`- missing: ${r.missingRequirements.map((s) => `\`${s}\``).join(", ")}`);
    }
    if (r.blockers?.length) {
      lines.push(`- blockers:`);
      for (const b of r.blockers) lines.push(`  - ${b}`);
    }
    if (r.notes?.length) {
      lines.push(`- notes:`);
      for (const n of r.notes) lines.push(`  - ${n}`);
    }
    lines.push(`- upgrade tasks:`);
    for (const t of r.upgradeTasks ?? []) {
      lines.push(`  - [${t.priority}] (${t.section}) ${t.task}`);
    }
    lines.push(`- needs live harness: ${r.upgradeTasks?.some((t) => t.section === "harness") ? "yes" : "no"}`);
    lines.push(`- can be certified with structured manual steps: ${r.canBeCertifiedWithManualSteps ? "yes" : "no"}`);
    lines.push("");
  }
}

lines.push("## Terminal decisions");
lines.push("");
if (terminalDecisions.length === 0) {
  lines.push("_None._");
  lines.push("");
} else {
  const terminalBuckets = new Map();
  for (const r of terminalDecisions) {
    const key = r.decisionStatus ?? "unknown";
    if (!terminalBuckets.has(key)) terminalBuckets.set(key, []);
    terminalBuckets.get(key).push(r);
  }
  for (const decision of ["blocked", "archive-candidate", "needs-human-decision", "unknown"]) {
    const bucket = terminalBuckets.get(decision);
    if (!bucket?.length) continue;
    bucket.sort((a, b) => b.certificationScore - a.certificationScore);
    lines.push(`### ${decision} - ${bucket.length} item(s)`);
    lines.push("");
    for (const r of bucket) {
      lines.push(`#### ${r.id} - score ${r.certificationScore}/100`);
      lines.push("");
      lines.push(`- capabilityKey: \`${r.capabilityKey ?? "n/a"}\``);
      lines.push(`- category: ${r.category}`);
      if (r.decisionReason) {
        lines.push(`- reason: ${r.decisionReason}`);
      }
      if (r.blockers?.length) {
        lines.push(`- blockers:`);
        for (const b of r.blockers) lines.push(`  - ${b}`);
      }
      lines.push(`- hidden from end users: yes`);
      lines.push("");
    }
  }
}

await fs.writeFile(out, lines.join("\n"), "utf8");
console.log(`Wrote ${path.relative(repoRoot, out)}`);
