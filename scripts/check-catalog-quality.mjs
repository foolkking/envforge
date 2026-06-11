#!/usr/bin/env node
/**
 * check-catalog-quality.mjs
 *
 * Quality gate for `apps/api/src/catalog.ts`.
 *
 * Reads the merged catalog (post-`withCapabilityMetadata`) via the
 * compiled `apps/api/dist/database.js` module and checks every item
 * against the rules summarized in `docs/catalog.md`.
 *
 * Exit code 0 = all checks pass.
 * Exit code 1 = at least one item failed.
 *
 * Usage:
 *   npm run catalog:check
 *
 * The script intentionally treats *visible catalog items* (the cards
 * users browse) as the unit of audit. Detection rules in
 * `apps/api/src/catalog-rules.ts` are inspected via `capabilityKey`.
 *
 * The Enforcement-phase audit added structural rules (1–10 below) that
 * extend the supportLevel field check. They turn the audit
 * `remainingRisks` and `requiredApprovals` data into concrete gate
 * preconditions.
 */
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const distRoot = path.resolve(here, "../apps/api/dist");

const databaseMod = await import(pathToFileURL(path.join(distRoot, "database.js")).href);
const items = await databaseMod.listCatalogFromDatabase();

const FORBIDDEN_SUMMARY_PREFIXES = [
  /^安装\s/, /^一键安装\s/, /^快速部署\s/, /^确认并安装/,
  /^Install\s/i, /^Configure\s+&\s+install/i, /^One-click install/i
];

const REQUIRED_TOP_FIELDS = ["id", "capabilityKey", "kind", "name", "summary", "category", "supportLevel"];
const ALLOWED_LEVELS = new Set(["detect-only", "basic-rebuild", "managed-config", "full-migration"]);

const PRIVILEGED_OR_DANGEROUS = new Set(["privileged", "dangerous"]);

const HIGH_RISK_REQUIRES_APPROVAL_IDS = new Set([
  "gitlab-ce",
  "docker-mailserver",
  "mail-stack",
  "vault-secrets",
  "vaultwarden",
  "pihole",
  "adguard-home",
  "authentik",
  "keycloak",
  "authelia",
  "wireguard-vpn",
  "openvpn-server",
  "tailscale",
  "k3s",
  "ssh-hardening",
  "firewall-baseline",
  "firewalld"
]);

const failures = [];
const warnings = [];

function fail(item, reason) {
  failures.push({ id: item.id, level: item.supportLevel ?? "unknown", reason });
}

function warn(item, reason) {
  warnings.push({ id: item.id, level: item.supportLevel ?? "unknown", reason });
}

// Pre-build capabilityKey -> [items] map for the multi-card-shared rule.
const itemsByCapabilityKey = new Map();
for (const item of items) {
  const key = item.capabilityKey;
  if (!key) continue;
  const list = itemsByCapabilityKey.get(key) ?? [];
  list.push(item);
  itemsByCapabilityKey.set(key, list);
}

const FRONT_PAGE_RECOMMENDED_LEVELS = new Set(["full-migration"]);
const SERVER_PANEL_PATTERN = /(panel|cockpit|portainer|filebrowser|webmin|x-ui|3x-ui)/i;
const SECURITY_CATEGORY = new Set(["security"]);
const DATABASE_CATEGORY = new Set(["database"]);
const CONTAINER_CATEGORY = new Set(["container"]);

for (const item of items) {
  // ── universal rules ────────────────────────────────────────────────
  for (const field of REQUIRED_TOP_FIELDS) {
    if (item[field] === undefined || item[field] === null || item[field] === "") {
      fail(item, `missing required top-level field: ${field}`);
    }
  }
  if (item.supportLevel && !ALLOWED_LEVELS.has(item.supportLevel)) {
    fail(item, `unknown supportLevel: ${item.supportLevel}`);
  }

  // forbidden-summary check (Chinese + English)
  for (const re of FORBIDDEN_SUMMARY_PREFIXES) {
    if (re.test(item.summary ?? "") || re.test(item.summaryEn ?? "")) {
      fail(item, `summary uses forbidden install-style phrasing (${re.source})`);
    }
  }

  // modeSupport must be present (kept under the legacy `modeSupport` key
  // for back-compat; the schema document calls it `modes`).
  if (!item.modeSupport) {
    warn(item, "missing modeSupport object (canonical name: `modes`)");
  }

  // sensitivity = legacy field used for risk; quality gate calls for
  // `riskLevel` but the compiled record reuses `sensitivity`. We accept
  // either as long as one is present.
  if (!item.sensitivity) {
    fail(item, "missing risk level (sensitivity / riskLevel)");
  }

  // detect signals — at minimum we expect the merged metadata to carry
  // at least one component or capability rule (rule lookup happens via
  // capabilityKey; we trust that today).
  const componentTypes = new Set((item.components ?? []).map((c) => c.type));
  if (componentTypes.size === 0) {
    warn(item, "no components declared — detect signals may be missing");
  }

  // ── per-supportLevel rules ─────────────────────────────────────────
  switch (item.supportLevel) {
    case "full-migration": {
      if (!item.modeSupport?.maintain) {
        warn(item, "full-migration item should support maintain mode");
      }
      if (!(item.managedActions ?? []).includes("data-strategy")) {
        warn(item, "full-migration item is missing data-strategy in managedActions");
      }
      if (!(item.managedActions ?? []).includes("config-migrate")) {
        warn(item, "full-migration item is missing config-migrate in managedActions");
      }
      break;
    }
    case "managed-config": {
      if (!(item.managedActions ?? []).includes("config-read")) {
        warn(item, "managed-config item should expose config-read action");
      }
      if (!(item.managedActions ?? []).includes("validate")) {
        warn(item, "managed-config item should expose validate action");
      }
      if (!(item.managedActions ?? []).includes("rollback")) {
        warn(item, "managed-config item should expose rollback action");
      }
      break;
    }
    case "basic-rebuild": {
      if (!(item.managedActions ?? []).includes("install")) {
        fail(item, "basic-rebuild item must expose install action");
      }
      break;
    }
    case "detect-only": {
      if (item.modeSupport?.migrate || item.modeSupport?.build) {
        warn(item, "detect-only item should not advertise migrate/build modes");
      }
      break;
    }
  }

  // ── special-case rules ─────────────────────────────────────────────
  if (item.kind === "combo") {
    if (item.supportLevel === "full-migration") {
      warn(item, "combo at full-migration: ensure all included components honour the same depth");
    }
  }

  // server-panel / admin-panel category check (heuristic by id)
  if (SERVER_PANEL_PATTERN.test(item.id)) {
    if (item.supportLevel === "full-migration") {
      fail(item, "server-panel-style item must not be full-migration");
    }
  }

  // databases must declare data strategy (we approximate by checking
  // managedActions for `data-strategy`).
  if (DATABASE_CATEGORY.has(item.category) && item.supportLevel === "full-migration" && !(item.managedActions ?? []).includes("data-strategy")) {
    fail(item, "database full-migration item missing data-strategy");
  }

  // ── Enforcement-phase structural rules ────────────────────────────
  // Rule 1: full-migration must have data-strategy + validate + rollback + security risk.
  if (item.supportLevel === "full-migration") {
    const actions = item.managedActions ?? [];
    if (!actions.includes("data-strategy")) {
      fail(item, "full-migration: managedActions missing data-strategy (rule 1)");
    }
    if (!actions.includes("validate")) {
      fail(item, "full-migration: managedActions missing validate (rule 1)");
    }
    if (!actions.includes("rollback")) {
      fail(item, "full-migration: managedActions missing rollback (rule 1)");
    }
    if (!item.sensitivity) {
      fail(item, "full-migration: missing security/sensitivity (rule 1)");
    }
  }

  // Rule 2: managed-config must have configs (system-config component) + security + validate + rollback.
  if (item.supportLevel === "managed-config") {
    const actions = item.managedActions ?? [];
    if (!actions.includes("validate")) {
      fail(item, "managed-config: managedActions missing validate (rule 2)");
    }
    if (!actions.includes("rollback")) {
      fail(item, "managed-config: managedActions missing rollback (rule 2)");
    }
    if (!item.sensitivity) {
      fail(item, "managed-config: missing security/sensitivity (rule 2)");
    }
  }

  // Rule 3: basic-rebuild must expose install action. Rollback is implicit
  // (uninstall the package) in the runtime so we only require install.
  if (item.supportLevel === "basic-rebuild") {
    const actions = item.managedActions ?? [];
    if (!actions.includes("install")) {
      fail(item, "basic-rebuild: managedActions missing install (rule 3)");
    }
  }

  // Rule 4: detect-only items must NOT be marked as front-page recommended.
  if (item.supportLevel === "detect-only") {
    if (item.ui?.recommended === true) {
      fail(item, "detect-only item must not be a front-page recommended card (rule 4)");
    }
  }

  // Rule 5: dangerous / privileged items must have requiredApprovals (enforced via
  // catalog audit list — the runtime mapping lives in environment-plan.ts).
  if (PRIVILEGED_OR_DANGEROUS.has(item.sensitivity)) {
    if (HIGH_RISK_REQUIRES_APPROVAL_IDS.has(item.id)) {
      // ok — explicit approval gates are wired
    } else if (item.audit?.remainingRisks?.length === 0 || !item.audit?.remainingRisks) {
      // Items with no remainingRisks + privileged sensitivity should still be
      // flagged so the operator either records risks or downgrades sensitivity.
      warn(item, "privileged/dangerous item without recorded remainingRisks (rule 5)");
    }
  }

  // Rule 6: when remainingRisks is non-empty the merged metadata must
  // surface it for the UI. The runtime renders a callout automatically
  // whenever audit.remainingRisks is non-empty; we only warn when the
  // catalog explicitly suppresses the callout (ui.mustShowRiskCallout
  // === false), which contradicts the audit data.
  if ((item.audit?.remainingRisks?.length ?? 0) > 0) {
    if (item.ui?.mustShowRiskCallout === false) {
      fail(item, "remainingRisks present but ui.mustShowRiskCallout=false suppresses the callout (rule 6)");
    }
  }

  // Rule 7: combo supportLevel cannot be higher than its components allow.
  // We approximate by checking whether the combo's components reference
  // catalog ids that are mostly detect-only — in that case the combo
  // should also be detect-only.
  if (item.kind === "combo" && item.supportLevel) {
    const componentLabels = (item.components ?? []).map((c) => `${c.label}`.toLowerCase());
    const detectOnlySignals = componentLabels.filter((label) =>
      /vaultwarden|pihole|home-assistant|forgejo|gitlab|onlyoffice|wikijs|nocodb|paperless|seafile|navidrome|audiobookshelf|freshrss|stirling|mealie|linkwarden|jellyfin|gitea|filebrowser|portainer/.test(label)
    ).length;
    if (detectOnlySignals > 0 && item.supportLevel !== "detect-only") {
      // Stop only when most components are detect-only; allow combos that
      // wrap one detect-only component beside several deeply-supported ones.
      const total = componentLabels.length || 1;
      if (detectOnlySignals / total > 0.5 && item.supportLevel !== "detect-only") {
        fail(item, `combo supportLevel ${item.supportLevel} exceeds detect-only floor inferred from components (rule 7)`);
      }
    }
  }

  // Rule 8: when multiple items share a capabilityKey they must declare
  // their relationship (variantOf / profileOf / includes / alternativeOf).
  if (item.capabilityKey) {
    const sharedSiblings = itemsByCapabilityKey.get(item.capabilityKey)?.filter((sib) => sib.id !== item.id) ?? [];
    if (sharedSiblings.length > 0) {
      const declaresRelation =
        Boolean(item.variantOf) ||
        Boolean(item.profileOf) ||
        Boolean(item.alternativeOf) ||
        (Array.isArray(item.includes) && item.includes.length > 0);
      if (!declaresRelation) {
        warn(item, `shares capabilityKey ${item.capabilityKey} with ${sharedSiblings.map((s) => s.id).join(", ")} but declares no variantOf/profileOf/includes/alternativeOf (rule 8)`);
      }
    }
  }

  // Rule 9: server-panel items must not be in default-recommended list.
  if (SERVER_PANEL_PATTERN.test(item.id)) {
    if (item.ui?.recommended === true) {
      fail(item, "server-panel item must not be on the default-recommended list (rule 9)");
    }
  }

  // Rule 10: database/docker/security items must declare matching strategies.
  if (DATABASE_CATEGORY.has(item.category) && item.supportLevel === "full-migration") {
    if (!(item.managedActions ?? []).includes("data-strategy")) {
      fail(item, "database full-migration item missing data-strategy (rule 10)");
    }
    if (!(item.managedActions ?? []).includes("rollback")) {
      fail(item, "database full-migration item missing rollback (rule 10)");
    }
  }
  if (CONTAINER_CATEGORY.has(item.category) && (item.supportLevel === "full-migration" || item.supportLevel === "managed-config")) {
    if (!(item.managedActions ?? []).includes("validate")) {
      fail(item, "container item at managed-config or higher missing validate (rule 10)");
    }
  }
  if (SECURITY_CATEGORY.has(item.category) && (item.supportLevel === "full-migration" || item.supportLevel === "managed-config")) {
    if (!(item.managedActions ?? []).includes("rollback")) {
      fail(item, "security item at managed-config or higher missing rollback (rule 10)");
    }
    if (!(item.managedActions ?? []).includes("validate")) {
      fail(item, "security item at managed-config or higher missing validate (rule 10)");
    }
  }
}

const summary = {
  total: items.length,
  pass: items.length - failures.length,
  fail: failures.length,
  warn: warnings.length
};

console.log(`\nCatalog quality check`);
console.log(`  total: ${summary.total}`);
console.log(`  pass : ${summary.pass}`);
console.log(`  fail : ${summary.fail}`);
console.log(`  warn : ${summary.warn}\n`);

for (const f of failures) {
  console.log(`  FAIL  [${f.level}] ${f.id}: ${f.reason}`);
}
for (const w of warnings) {
  console.log(`  warn  [${w.level}] ${w.id}: ${w.reason}`);
}

process.exit(failures.length === 0 ? 0 : 1);
