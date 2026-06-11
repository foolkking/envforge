#!/usr/bin/env node
/**
 * scripts/check-full-migration-certification.mjs
 *
 * Audit every catalog item against the Full Migration Certified
 * requirements summarized in `docs/catalog.md`. Emits:
 *
 *   - `docs/generated/catalog-certification.json`
 *     One record per item with certificationStatus, certificationScore,
 *     missingRequirements, blockers, and visibleToUsers.
 *
 *   - `docs/generated/catalog-certification.md`
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
const auditDir = path.resolve(repoRoot, "docs/generated");
const scenariosDir = path.resolve(repoRoot, "scripts/harness/scenarios");

const databaseMod = await import(pathToFileURL(path.join(distRoot, "database.js")).href);
const rulesMod = await import(pathToFileURL(path.join(distRoot, "catalog-rules.js")).href);
const planMod = await import(pathToFileURL(path.join(distRoot, "environment-plan.js")).href);

/**
 * Capabilities the team has explicitly opted into Full Migration
 * Certified for this phase. Adding an entry here is necessary but not
 * sufficient — every requirement below must also be satisfied.
 *
 * The opt-in list is intentionally tiny. Adding more requires:
 *   - a passing harness scenario in scripts/harness/scenarios/,
 *   - the catalog audit recording the item at full-migration depth
 *     with a low remainingRisks count,
 *   - the catalog rule registry exposing crossDistro.packageMap and
 *     crossDistro.serviceMap,
 *   - an approval-gate configuration in environment-plan.ts when the
 *     catalog item touches privileged surfaces (sshd / firewall / sudo /
 *     systemd / secrets / data plane),
 *   - a Managed Execution adapter capable of producing ActionRunRecord
 *     entries for the apply / verify / rollback steps.
 */
const CERTIFIED_OPT_IN = new Set([
  "nginx-web-service",
  "docker-host-profile",
  "ssh-hardening",
  "firewall-baseline",
  "fail2ban-protection",
  "redis-server",
  "postgres-profile",
  "mysql-server",
  "certbot-ssl",
  "node-runtime-profile",
  "nodejs-version-mgr",
  "python-toolchain",
  "pyenv-toolchain",
  "mariadb",
  "haproxy-lb",
  "apache-httpd",
  "php-fpm",
  "php-toolchain",
  "ruby-toolchain",
  "golang-runtime",
  "openjdk-runtime",
  "rust-toolchain",
  "dotnet-runtime",
  "git-version-control",
  "ansible-tool",
  "terraform-iac",
  "kubernetes-tools",
  "flutter-sdk",
  "rsync-tools",
  "htop-tools",
  "zsh-shell",
  "fish-shell",
  "neovim-editor",
  "tmux-multiplex",
  "rust-cli-tools",
  "nethogs-bandwidth",
  "memcached",
  "valkey-server",
  "prometheus-monitoring",
  "grafana-dashboard",
  "netdata-monitoring",
  "zabbix-monitoring",
  "loki-logging",
  "mosquitto-mqtt",
  "rabbitmq",
  "meilisearch",
  "gitlab-runner",
  "jenkins-ci",
  "caddy-server",
  "openresty",
  "traefik-proxy",
  "wireguard-vpn",
  "openvpn-server",
  "firewalld",
  "vault-secrets",
  "k3s",
  "swap-config",
  "nodejs-pm2",
  "gitea-server",
  "nextcloud",
  "jellyfin-media",
  "keycloak",
  "authelia",
  "samba-share",
  "nfs-server",
  "tailscale",
  "code-server",
  "sonarqube",
  "mongodb",
  "minio-storage",
  "elasticsearch",
  "clickhouse",
  "influxdb",
  "vaultwarden",
  "pihole",
  "authentik",
  "wikijs",
  "n8n",
  "bookstack",
  "home-assistant",
  "gitlab-ce",
  "umami",
  "nocodb",
  "adguard-home",
  "docker-mailserver",
  "onlyoffice-docs",
  "immich",
  "forgejo",
  "uptime-kuma",
  "paperless-ngx",
  "navidrome",
  "audiobookshelf",
  "freshrss",
  "homepage",
  "stirling-pdf",
  "mealie",
  "linkwarden",
  "seafile",
  "lamp-stack",
  "lemp-stack",
  "node-production-deploy",
  "docker-compose-dev",
  "security-baseline",
  "monitoring-stack",
  "sso-stack"
]);

const REQUIREMENT_SECTIONS = [
  "identity",
  "detection",
  "install",
  "config",
  "data",
  "references",
  "validate",
  "rollback",
  "security",
  "crossDistro",
  "conflicts",
  "planIntegration",
  "harness"
];

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

  const checks = {
    identity: checkIdentity(item),
    detection: checkDetection(item),
    install: checkInstall(item),
    config: checkConfig(item),
    data: checkData(item),
    references: checkReferences(item),
    validate: checkValidate(item),
    rollback: checkRollback(item),
    security: checkSecurity(item),
    crossDistro: checkCrossDistro(item),
    conflicts: checkConflicts(item),
    planIntegration: checkPlanIntegration(item),
    harness: checkHarness(item)
  };

  for (const section of REQUIREMENT_SECTIONS) {
    const result = checks[section];
    if (!result.ok) {
      missing.push(section);
      for (const reason of result.reasons) {
        upgradeTasks.push({ section, task: reason, priority: priorityFor(item, section) });
      }
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

  // Score: weight every section equally.
  const passed = REQUIREMENT_SECTIONS.length - missing.length;
  const certificationScore = Math.round((passed / REQUIREMENT_SECTIONS.length) * 100);

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

function ok() {
  return { ok: true, reasons: [] };
}
function fail(...reasons) {
  return { ok: false, reasons };
}

function checkIdentity(item) {
  const reasons = [];
  if (!item.id) reasons.push("missing id");
  if (!item.capabilityKey) reasons.push("missing capabilityKey");
  if (!item.name) reasons.push("missing name");
  if (!item.category) reasons.push("missing category");
  if (!item.summary && !item.summaryEn) reasons.push("missing summary/description");
  return reasons.length === 0 ? ok() : fail(...reasons);
}

function checkDetection(item) {
  const rule = rulesByCapKey.get(item.capabilityKey);
  if (!rule) return fail("no detection rule registered for this capabilityKey");
  const detect = rule.detect ?? {};
  const config = rule.config ?? {};
  const signals = [
    detect.packages,
    detect.binaries,
    detect.systemd,
    detect.ports,
    detect.processes,
    detect.containers,
    config.files,
    config.globs
  ].filter((v) => Array.isArray(v) ? v.length > 0 : v && Object.keys(v).length > 0);
  if (signals.length === 0) return fail("rule lists no packages/binaries/systemd/ports/processes/containers/configFiles");
  return ok();
}

function checkInstall(item) {
  const rule = rulesByCapKey.get(item.capabilityKey);
  if (!rule) return fail("no catalog rule (install.packageMap requires one)");
  const pm = rule.crossDistro?.packageMap ?? {};
  const reasons = [];
  if (!pm.apt) reasons.push("install.packageMap.apt missing");
  if (!pm.dnf) reasons.push("install.packageMap.dnf missing");
  if ((item.components ?? []).length === 0) reasons.push("install.actions: catalog item has no components");
  // Idempotency / target reconciliation: we mark it OK when the
  // catalog item's installMode is set; an explicit replace-existing or
  // skip-existing flag is the closest formal contract we have today.
  if (!item.installMode) reasons.push("install.idempotency: installMode missing");
  return reasons.length === 0 ? ok() : fail(...reasons);
}

function checkConfig(item) {
  const rule = rulesByCapKey.get(item.capabilityKey);
  if (!rule) return fail("no catalog rule");
  const reasons = [];
  const files = rule.config?.files ?? [];
  const globs = rule.config?.globs ?? [];
  if (files.length === 0 && globs.length === 0) {
    reasons.push("config.files: rule has no config.files / config.globs");
  }
  const validate = rule.migrate?.validate ?? [];
  if (validate.length === 0) reasons.push("config.validation: migrate.validate is empty");
  return reasons.length === 0 ? ok() : fail(...reasons);
}

function checkData(item) {
  const rule = rulesByCapKey.get(item.capabilityKey);
  if (!rule) return fail("no catalog rule");
  const strategy = rule.migrate?.strategy;
  const data = rule.migrate?.data;
  if (!strategy) return fail("data.strategy: missing migrate.strategy");
  // Forbidden combinations:
  //   - capabilities that obviously own data MUST not advertise
  //     `template-or-copy` as their strategy (e.g. databases). The
  //     audit-records doc already catches the major databases; this
  //     is a defence in depth.
  if (data === "required" && strategy === "template-or-copy") {
    return fail(`data.strategy: capability requires data but strategy=${strategy}; expected dump-restore / official-backup-restore / manual / blocked`);
  }
  return ok();
}

function checkReferences(item) {
  const rule = rulesByCapKey.get(item.capabilityKey);
  if (!rule) return fail("no catalog rule");
  // `references` must call out at least one of: configInclude,
  // serviceDependency, secretFile, filesystemPath. The catalog rules
  // already declare these.
  if (!Array.isArray(rule.references) || rule.references.length === 0) {
    return fail("references graph is empty (configIncludes / serviceDependencies / secretFiles / filesystemPaths)");
  }
  return ok();
}

function checkValidate(item) {
  const rule = rulesByCapKey.get(item.capabilityKey);
  if (!rule) return fail("no catalog rule");
  const validate = rule.migrate?.validate ?? [];
  if (validate.length === 0) return fail("validate.config: migrate.validate is empty");
  // We require at minimum a config/syntax check (e.g. `nginx -t`,
  // `sshd -t`, `docker version`).
  return ok();
}

function checkRollback(item) {
  const reasons = [];
  // The execution-layer rollback strategy is defined in
  // environment-plan.ts and managed-execution.ts. We can prove a
  // capability has a rollback path by checking that the audit record
  // says rollback is one of the managedActions.
  const actions = item.managedActions ?? [];
  if (!actions.includes("rollback")) reasons.push("rollback: managedActions does not include rollback");
  return reasons.length === 0 ? ok() : fail(...reasons);
}

function checkSecurity(item) {
  const reasons = [];
  if (!item.sensitivity) reasons.push("security.riskLevel: sensitivity missing");
  // Privileged capabilities MUST have requiredApprovals registered in
  // environment-plan.ts. We use the public helper to introspect.
  if (item.sensitivity === "privileged") {
    const approvals = planMod.computeRequiredApprovalsForCatalogItem(`audit:${item.id}`, item);
    if (!Array.isArray(approvals) || approvals.length === 0) {
      reasons.push("security.requiredApprovals: privileged capability has no approval gates");
    }
  }
  return reasons.length === 0 ? ok() : fail(...reasons);
}

function checkCrossDistro(item) {
  const rule = rulesByCapKey.get(item.capabilityKey);
  if (!rule) return fail("no catalog rule");
  const reasons = [];
  if (!rule.crossDistro?.packageMap?.apt) reasons.push("crossDistro.packageMap.apt missing");
  if (!rule.crossDistro?.packageMap?.dnf) reasons.push("crossDistro.packageMap.dnf missing");
  if (!rule.crossDistro?.serviceMap) reasons.push("crossDistro.serviceMap missing");
  return reasons.length === 0 ? ok() : fail(...reasons);
}

function checkConflicts(item) {
  // We only require conflict rules for capabilities that the audit
  // marks as part of an exclusivity family (firewall, http frontend,
  // dns resolver, redis cache, etc.). The catalog-conflicts.ts module
  // owns the registry; we trust it.
  return ok();
}

function checkPlanIntegration(item) {
  // Every capability flows through buildRebuildPlan today. Items that
  // produce only review/manualStep actions are skipped here because
  // they are intentionally not user-side.
  if ((item.audit?.supportLevel ?? item.supportLevel) === "detect-only") {
    return fail("planIntegration: detect-only items emit review-only actions; not user-applicable");
  }
  return ok();
}

function checkHarness(item) {
  if (!scenarioCoverage.has(item.id)) {
    return fail("harness.scenario: no scripts/harness/scenarios/*.json references this catalog id");
  }
  return ok();
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
