#!/usr/bin/env node
/**
 * scripts/check-full-migration-certification.mjs
 *
 * Audit every catalog item against the Full Migration Certified
 * requirements summarized in `docs/catalog.md`. Emits:
 *
 *   - `artifacts/generated/catalog-certification/catalog-certification.json`
 *     One record per item with certificationStatus, certificationScore,
 *     missingRequirements, blockers, and visibleToUsers.
 *
 *   - `artifacts/generated/catalog-certification/catalog-certification.md`
 *     Human-readable summary (committed alongside the JSON).
 *
 * Exit codes:
 *   0  every certified item has a valid record AND every not-ready item
 *      has visibleToUsers=false.
 *   1  any certified item is missing a required field, or any not-ready
 *      item leaks into the user-side surface.
 *
 * Usage:
 *   npm run certification:check
 *   node scripts/check-full-migration-certification.mjs
 */

import path from "node:path";
import fs from "node:fs/promises";
import { pathToFileURL, fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const distRoot = path.resolve(repoRoot, "apps/api/dist");
const auditDir = path.resolve(
  repoRoot,
  process.env.ENVFORGE_CERTIFICATION_OUTPUT_DIR ?? "artifacts/generated/catalog-certification"
);
const scenariosDir = path.resolve(repoRoot, "scripts/harness/scenarios");

const databaseMod = await import(pathToFileURL(path.join(distRoot, "database.js")).href);
const rulesMod = await import(pathToFileURL(path.join(distRoot, "catalog-rules.js")).href);
const planMod = await import(pathToFileURL(path.join(distRoot, "environment-plan.js")).href);
const certMod = await import(pathToFileURL(path.join(distRoot, "catalog-certification.js")).href);
const auditMod = await import(pathToFileURL(path.join(distRoot, "certification-audit.js")).href);

/**
 * Capabilities the team has explicitly opted into Full Migration Certified.
 * The canonical list lives in `apps/api/src/catalog-certification.ts`; it is
 * imported here (via the compiled dist) so CI and the runtime never drift.
 * Adding an entry is necessary but not sufficient — every requirement
 * audited by `certification-audit.ts` must also pass, the item needs a
 * harness scenario, and privileged surfaces need approval gates.
 */
const CERTIFIED_OPT_IN = certMod.CERTIFIED_OPT_IN;

const REQUIREMENT_SECTIONS = auditMod.REQUIREMENT_SECTIONS;

const DECISION_OVERRIDES = {
  "cockpit-panel": {
    status: "blocked",
    reason: "server-panel-style administration UI; catalog quality gate forbids Full Migration certification for panels."
  },
  "portainer": {
    status: "blocked",
    reason: "server-panel-style Docker administration UI; endpoint credentials and docker access must remain operator-controlled."
  },
  "x-ui-panel": {
    status: "blocked",
    reason: "network proxy administration panel with credential-bearing SQLite state; keep detect-only until a human migration policy is approved."
  },
  "filebrowser": {
    status: "blocked",
    reason: "server-panel-style file manager; scoped roots and account database require operator-owned export decisions."
  },
  "dozzle": {
    status: "blocked",
    reason: "privileged docker-socket log viewer; stateless review card, not a migratable workload."
  },
  "sqlite": {
    status: "archive-candidate",
    reason: "embedded database engine; meaningful .db files belong to the owning application plan, not a standalone SQLite migration."
  },
  "certbot-letsencrypt": {
    status: "archive-candidate",
    reason: "legacy alias for certbot-ssl; the canonical certbot-ssl capability is already certified."
  },
  "systemd-resolved": {
    status: "archive-candidate",
    reason: "conflict-only DNS resolver stub; retained for pihole/adguard conflict detection, not direct user-side apply."
  },
  "selfhost-essentials": {
    status: "needs-human-decision",
    reason: "broad combo still includes multiple high-risk components and should be decomposed into certified child plans."
  },
  "ai-localllm-stack": {
    status: "needs-human-decision",
    reason: "uncatalogued GPU/model/runtime prerequisites require a product decision before EnvForge can certify migration."
  },
  "mail-stack": {
    status: "needs-human-decision",
    reason: "mail delivery depends on registrar DNS, DKIM, MTA reputation, and mailbox data strategy; keep blocked until a dedicated mail migration policy exists."
  },
  "homelab-dashboard": {
    status: "needs-human-decision",
    reason: "combo contains panel/log-viewer components; split into certified app cards and keep the aggregate hidden."
  },
  "selfhost-media": {
    status: "needs-human-decision",
    reason: "large media bind mounts and hardware acceleration are operator-specific; aggregate combo should not promise one-shot migration."
  },
  "selfhost-pkm": {
    status: "needs-human-decision",
    reason: "aggregate PKM combo spans multiple app backup models; certify child apps separately before exposing the combo."
  }
};

const items = await databaseMod.listCatalogFromDatabase();
const rulesByCapKey = new Map();
for (const rule of rulesMod.catalogDetectionRules) rulesByCapKey.set(rule.capabilityKey, rule);

const scenarioCoverage = await loadScenarioCoverage();

const records = items.map((item) => auditOne(item));
const certified = records.filter((r) => r.certificationStatus === "certified");
const notReady = records.filter((r) => r.certificationStatus === "not-ready");
const upgradeBacklog = notReady.filter((r) => r.decisionStatus === "upgrade-backlog");
const terminalDecisions = notReady.filter((r) => r.decisionStatus !== "upgrade-backlog");

const json = {
  generatedAt: new Date().toISOString(),
  totals: {
    catalog: items.length,
    certified: certified.length,
    notReady: notReady.length,
    upgradeBacklog: upgradeBacklog.length,
    terminalDecisions: terminalDecisions.length,
    blocked: terminalDecisions.filter((r) => r.decisionStatus === "blocked").length,
    archiveCandidates: terminalDecisions.filter((r) => r.decisionStatus === "archive-candidate").length,
    needsHumanDecision: terminalDecisions.filter((r) => r.decisionStatus === "needs-human-decision").length
  },
  records
};

await fs.mkdir(auditDir, { recursive: true });
await fs.writeFile(
  path.join(auditDir, "catalog-certification.json"),
  JSON.stringify(json, null, 2),
  "utf8"
);
await fs.writeFile(
  path.join(auditDir, "catalog-certification.md"),
  toMarkdown(json),
  "utf8"
);

console.log(`Certified : ${certified.length}/${items.length}`);
console.log(`Not-ready : ${notReady.length}/${items.length}`);
console.log(`Open backlog: ${upgradeBacklog.length}/${items.length}`);
console.log(`Terminal decisions: ${terminalDecisions.length}/${items.length}`);
console.log("");
console.log("Certified capabilities:");
for (const r of certified) console.log(`  ✔ ${r.id} (${r.capabilityKey ?? "n/a"})`);

let failure = 0;

// Anti-fake guards. Each of these is the "user-visible surface" gate.
for (const r of records) {
  if (r.certificationStatus === "certified" && r.missingRequirements.length > 0) {
    console.error(
      `FAIL ${r.id}: marked certified but missing ${r.missingRequirements.length} requirement(s): ${r.missingRequirements.join(", ")}`
    );
    failure += 1;
  }
  if (r.certificationStatus === "not-ready" && r.visibleToUsers === true) {
    console.error(
      `FAIL ${r.id}: not-ready but visibleToUsers=true. The user-side Build/Migrate/Maintain UI must hide this item.`
    );
    failure += 1;
  }
}

console.log("");
console.log(`Wrote ${path.relative(repoRoot, path.join(auditDir, "catalog-certification.json"))}`);
console.log(`Wrote ${path.relative(repoRoot, path.join(auditDir, "catalog-certification.md"))}`);

process.exit(failure === 0 ? 0 : 1);

// ── helpers ───────────────────────────────────────────────────────

async function loadScenarioCoverage() {
  /** Returns a Set of catalog ids that appear as planSource.capabilityIds in any scenario. */
  const out = new Set();
  let entries = [];
  try {
    entries = await fs.readdir(scenariosDir);
  } catch {
    return out;
  }
  for (const f of entries) {
    if (!f.endsWith(".json")) continue;
    const raw = JSON.parse(await fs.readFile(path.join(scenariosDir, f), "utf8"));
    const ids = raw?.planSource?.capabilityIds ?? [];
    for (const id of ids) out.add(id);
  }
  return out;
}

function auditOne(item) {
  const missing = [];
  const blockers = [];
  const upgradeTasks = [];
  const optIn = CERTIFIED_OPT_IN.has(item.id);
  const decision = DECISION_OVERRIDES[item.id] ?? null;

  const audit = auditMod.auditCatalogItem(item, {
    rule: rulesByCapKey.get(item.capabilityKey),
    hasScenario: scenarioCoverage.has(item.id),
    computeApprovals: (it) => planMod.computeRequiredApprovalsForCatalogItem(`audit:${it.id}`, it)
  });
  const checks = audit.sectionResults;
  missing.push(...audit.missingRequirements);
  for (const section of missing) {
    for (const reason of checks[section].reasons) {
      upgradeTasks.push({ section, task: reason, priority: priorityFor(item, section) });
    }
  }

  // Pull non-recoverable signals from the existing audit record.
  if ((item.audit?.supportLevel ?? item.supportLevel) === "detect-only") {
    blockers.push("audit support level is detect-only");
  }
  if (decision) {
    blockers.push(`${decision.status}: ${decision.reason}`);
  }
  if (!optIn && missing.length === 0) {
    // Even a clean item is not certified unless explicitly opted in.
    blockers.push("not in CERTIFIED_OPT_IN list — promote requires harness coverage + maintainer approval");
  }
  if (optIn && missing.length > 0) {
    blockers.push(`opted into certification but missing: ${missing.join(", ")}`);
  }

  // Score: weight every section equally (computed in certification-audit.ts).
  const certificationScore = audit.certificationScore;

  const certificationStatus = optIn && missing.length === 0 ? "certified" : "not-ready";
  const visibleToUsers = certificationStatus === "certified";

  return {
    id: item.id,
    capabilityKey: item.capabilityKey,
    name: item.nameEn || item.name,
    category: item.category,
    certificationStatus,
    certificationScore,
    visibleToUsers,
    missingRequirements: missing,
    sectionResults: checks,
    blockers,
    decisionStatus: decision?.status ?? (certificationStatus === "certified" ? "certified" : "upgrade-backlog"),
    decisionReason: decision?.reason,
    upgradeTasks,
    canBeCertifiedWithManualSteps: missing.length === 0,
    notes: notesFor(item, missing)
  };
}

function priorityFor(item, section) {
  // Build-page-common items are P0; security items P1; rest P2/P3.
  const isCore = ["nginx-web-service", "docker-host-profile", "postgres-profile", "ssh-hardening", "redis-server", "mysql-server", "firewall-baseline"].includes(item.id);
  if (isCore && (section === "data" || section === "rollback" || section === "harness")) return "P0";
  if (item.sensitivity === "privileged") return "P1";
  if (item.category === "service" || item.category === "database" || item.category === "container") return "P2";
  return "P3";
}

function notesFor(item, missing) {
  const notes = [];
  if (missing.length === 0) {
    notes.push("All structural requirements satisfied; certified.");
  } else {
    if (missing.includes("data")) notes.push("Capability owns persistent data — assign a data strategy (dump-restore / official-backup-restore / manual / blocked).");
    if (missing.includes("harness")) notes.push("Add a harness scenario before user-side exposure.");
    if (missing.includes("crossDistro")) notes.push("Document apt + dnf packageMap and serviceMap before user-side exposure.");
    if (missing.includes("security")) notes.push("Add requiredApprovals or downgrade sensitivity.");
    if (missing.includes("planIntegration")) notes.push("Detect-only items can stay in the admin registry but cannot enter Build/Migrate/Maintain.");
  }
  return notes;
}

function toMarkdown(json) {
  const lines = [];
  lines.push("# Full Migration Certification — audit");
  lines.push("");
  lines.push(`Generated: ${json.generatedAt}`);
  lines.push("");
  lines.push("## Totals");
  lines.push(`- catalog : ${json.totals.catalog}`);
  lines.push(`- certified: ${json.totals.certified}`);
  lines.push(`- not-ready: ${json.totals.notReady}`);
  lines.push(`- open upgrade backlog: ${json.totals.upgradeBacklog}`);
  lines.push(`- terminal decisions: ${json.totals.terminalDecisions}`);
  lines.push(`  - blocked: ${json.totals.blocked}`);
  lines.push(`  - archive-candidate: ${json.totals.archiveCandidates}`);
  lines.push(`  - needs-human-decision: ${json.totals.needsHumanDecision}`);
  lines.push("");

  lines.push("## Certified");
  lines.push("");
  for (const r of json.records.filter((r) => r.certificationStatus === "certified")) {
    lines.push(`- **${r.id}** (\`${r.capabilityKey ?? "n/a"}\`) — score ${r.certificationScore}/100`);
  }
  lines.push("");

  lines.push("## Not-ready Open Upgrade Backlog");
  lines.push("");
  const upgradeBacklog = [...json.records.filter((r) => r.decisionStatus === "upgrade-backlog")];
  upgradeBacklog.sort((a, b) => b.certificationScore - a.certificationScore);
  if (upgradeBacklog.length === 0) {
    lines.push("_No open upgrade-backlog items remain. All hidden not-ready items have explicit terminal decisions._");
    lines.push("");
  }
  for (const r of upgradeBacklog) {
    lines.push(`### ${r.id} — score ${r.certificationScore}/100`);
    lines.push("");
    lines.push(`- capabilityKey: \`${r.capabilityKey ?? "n/a"}\``);
    lines.push(`- category: ${r.category}`);
    if (r.decisionStatus) {
      lines.push(`- decision: ${r.decisionStatus}${r.decisionReason ? ` - ${r.decisionReason}` : ""}`);
    }
    if (r.missingRequirements.length) {
      lines.push(`- missing: ${r.missingRequirements.join(", ")}`);
    }
    if (r.blockers.length) {
      lines.push(`- blockers:`);
      for (const b of r.blockers) lines.push(`  - ${b}`);
    }
    if (r.notes.length) {
      lines.push(`- notes:`);
      for (const n of r.notes) lines.push(`  - ${n}`);
    }
    lines.push("");
  }

  lines.push("## Terminal Decisions (hidden from end users)");
  lines.push("");
  const terminal = [...json.records.filter((r) => r.certificationStatus === "not-ready" && r.decisionStatus !== "upgrade-backlog")];
  terminal.sort((a, b) => {
    const byDecision = String(a.decisionStatus).localeCompare(String(b.decisionStatus));
    if (byDecision !== 0) return byDecision;
    return b.certificationScore - a.certificationScore;
  });
  for (const r of terminal) {
    lines.push(`### ${r.id} - score ${r.certificationScore}/100`);
    lines.push("");
    lines.push(`- capabilityKey: \`${r.capabilityKey ?? "n/a"}\``);
    lines.push(`- category: ${r.category}`);
    lines.push(`- decision: ${r.decisionStatus}${r.decisionReason ? ` - ${r.decisionReason}` : ""}`);
    if (r.missingRequirements.length) {
      lines.push(`- missing: ${r.missingRequirements.join(", ")}`);
    }
    if (r.blockers.length) {
      lines.push(`- blockers:`);
      for (const b of r.blockers) lines.push(`  - ${b}`);
    }
    if (r.notes.length) {
      lines.push(`- notes:`);
      for (const n of r.notes) lines.push(`  - ${n}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
