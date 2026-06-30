/**
 * action-runs.ts — ActionRunRecord lifecycle, secret redaction, and
 * ManagedCapabilityRecord types.
 *
 * The Managed Execution Hardening phase says every action that mutates
 * the target host must follow this lifecycle:
 *
 *   pending → snapshotting → applying → verifying → succeeded
 *                                                  ↘ failed → rolling-back → rolled-back
 *                                                                          ↘ rollback-failed
 *
 * `manual-required` and `skipped` are terminal short-circuits used when
 * the action cannot run automatically (detect-only) or was deliberately
 * bypassed by the operator.
 *
 * Every command output the runner captures must pass through
 * `redactSecrets` before being stored on the ActionRunRecord, written
 * to the plan report, or surfaced in API responses. The redaction list
 * mirrors the contract in the Managed Execution Hardening prompt.
 */

import type { CatalogItem } from "./catalog.js";

export type ActionRunStatus =
  | "pending"
  | "snapshotting"
  | "applying"
  | "verifying"
  | "succeeded"
  | "failed"
  | "rolling-back"
  | "rolled-back"
  | "rollback-failed"
  | "skipped"
  | "manual-required";

/**
 * Snapshot of the target before the action mutates anything. The
 * specifics depend on action kind:
 *
 *   - writeConfig / copyConfig: file size, sha256, mode, owner.
 *   - installPackage: list of currently-installed packages we will
 *     touch (so removable=managed-by-us is recorded).
 *   - service restart / reload: current `is-active` state.
 *   - generic: free-form `notes` array.
 */
export interface ActionSnapshot {
  kind: "config-file" | "packages" | "service" | "firewall" | "systemd-unit" | "generic";
  capturedAt: string;
  /** Path on the target this snapshot describes (config files only). */
  path?: string;
  /** Backup path produced during snapshotting. */
  backupPath?: string;
  /** SHA-256 of the original file content (config-file only). */
  sha256?: string;
  /** Octal mode string (e.g. "0644"). */
  mode?: string;
  /** Owner / group as `user:group`. */
  owner?: string;
  /** Existing-package marker per package (used for managed-marker logic). */
  packagesObserved?: Array<{ name: string; manager: string; installed: boolean; version?: string }>;
  /** systemd `is-active` snapshot. */
  serviceActiveBefore?: string;
  /** Free-form notes (post-redaction). */
  notes?: string[];
}

export interface ActionApplyResult {
  ok: boolean;
  /** Human-readable summary (post-redaction). */
  message: string;
  /** Per-step records (post-redaction). */
  steps: Array<{ label: string; ok: boolean; message?: string }>;
  /** Optional new path produced (e.g. tempPath for config writes). */
  tempPath?: string;
}

export interface ActionVerifyResult {
  ok: boolean;
  /** Per-check records (post-redaction). */
  checks: Array<{ command: string; ok: boolean; output: string }>;
  message: string;
}

export interface ActionRollbackResult {
  ok: boolean;
  steps: Array<{ label: string; ok: boolean; message?: string }>;
  message: string;
}

export interface ActionRunRecord {
  /** Stable id; usually `<planId>:<itemId>:<actionId>:<runIndex>`. */
  id: string;
  planId: string;
  /** Canonical immutable Plan hash this execution was authorized against. */
  planHash: string;
  itemId: string;
  actionId: string;
  targetConnectionId: string;
  dryRun: boolean;
  commandSummaries: Array<{ phase: "snapshot" | "apply" | "verify" | "rollback"; command: string }>;
  exitCode?: number;
  capabilityKey?: string;
  capabilityId?: string;
  /** Plan item id (for cross-reference with plan.items[*]). */
  startedAt: string;
  endedAt?: string;
  status: ActionRunStatus;
  snapshot?: ActionSnapshot;
  applyResult?: ActionApplyResult;
  verifyResult?: ActionVerifyResult;
  rollbackResult?: ActionRollbackResult;
  /** Truncated, redacted stdout (max ~4kB). */
  stdoutPreview?: string;
  /** Truncated, redacted stderr (max ~4kB). */
  stderrPreview?: string;
  /** True if any preview / message contained a redacted secret. */
  redacted: boolean;
  /** Redacted error message; empty when status=succeeded. */
  error?: string;
  /** When the operator manually intervened. */
  operatorAction?: "approved" | "rejected" | "deferred";
}

/**
 * ManagedCapabilityRecord — issued when EnvForge actually installs
 * a capability on a target. The Remove plan only auto-deletes records
 * marked `removableByEnvForge=true` AND `existedBefore=false`.
 */
export interface ManagedCapabilityRecord {
  id: string;
  capabilityKey: string;
  catalogId: string;
  installedByPlanId: string;
  installedAt: string;
  targetHostId: string;
  packagesInstalled: Array<{
    name: string;
    manager: string;
    version?: string;
    existedBefore: boolean;
    removableByEnvForge: boolean;
  }>;
  configsTouched: string[];
  servicesTouched: string[];
  dataPathsKnown: string[];
  /** Capability supportLevel at the time of install (snapshot). */
  supportLevelAtInstall?: NonNullable<CatalogItem["supportLevel"]>;
}

// ───────────────────────────────────────────────────────────────────
// Secret redaction
// ───────────────────────────────────────────────────────────────────

/**
 * Pattern → replacement label. We retain the key prefix so the operator
 * can still reason about which line was redacted, and replace the value
 * with a labelled `<REDACTED-...>` placeholder.
 *
 * The patterns are deliberately conservative. They run on plain-text
 * command output — a multi-line PEM private key may span several lines,
 * so we apply pattern matching twice: first across whole-string content
 * (to catch BEGIN/END blocks) and then line-by-line.
 */
interface RedactionRule {
  /** Identifier surfaced in the redaction summary. */
  name: string;
  /** Pattern with at least one capturing group; group 1 is the key prefix retained as-is. */
  pattern: RegExp;
  tag: string;
  /** When true the rule is applied across the whole multi-line buffer. */
  multiLine?: boolean;
}

const REDACTION_RULES: RedactionRule[] = [
  // PEM private-key blocks (multi-line)
  {
    name: "private-key-block",
    pattern: /(-----BEGIN [A-Z ]*PRIVATE KEY-----)[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----)/g,
    tag: "REDACTED-PRIVATE-KEY",
    multiLine: true
  },
  // OpenSSH private key headers
  {
    name: "openssh-private-key",
    pattern: /(-----BEGIN OPENSSH PRIVATE KEY-----)[\s\S]*?(-----END OPENSSH PRIVATE KEY-----)/g,
    tag: "REDACTED-OPENSSH-PRIVATE-KEY",
    multiLine: true
  },
  {
    name: "rsa-private-key",
    pattern: /(-----BEGIN RSA PRIVATE KEY-----)[\s\S]*?(-----END RSA PRIVATE KEY-----)/g,
    tag: "REDACTED-RSA-PRIVATE-KEY",
    multiLine: true
  },
  // High-entropy specific token shapes — MUST run before the generic
  // env-secret / generic-secret rules so the specific rule wins. Each
  // value capture excludes `<>` so a placeholder produced by an earlier
  // rule is never re-matched by a later one (which would corrupt the
  // tag and lose the original signal).
  {
    name: "github-token",
    pattern: /\b(gh[opsu]_)([A-Za-z0-9]{30,})\b/g,
    tag: "REDACTED-GH-TOKEN"
  },
  {
    name: "gitlab-token",
    pattern: /\b(glpat-)([A-Za-z0-9_-]{20,})\b/g,
    tag: "REDACTED-GL-TOKEN"
  },
  {
    name: "openai-key",
    pattern: /\b(sk-[a-z]*)([A-Za-z0-9]{20,})\b/g,
    tag: "REDACTED-API-KEY"
  },
  {
    name: "aws-access-key",
    pattern: /\b(AKIA)([A-Z0-9]{12,})\b/g,
    tag: "REDACTED-AWS-KEY"
  },
  {
    name: "jwt",
    pattern: /\b(eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.)([A-Za-z0-9_-]{6,})\b/g,
    tag: "REDACTED-JWT"
  },
  // Bearer / Authorization headers — exclude `<>` from value so the
  // placeholder from an earlier rule is preserved unchanged.
  {
    name: "auth-header",
    pattern: /(\bAuthorization:\s*(?:Bearer|Basic|Token)\s+)([^<>\s]+)/gi,
    tag: "REDACTED-AUTH"
  },
  // DATABASE_URL with embedded credentials
  {
    name: "database-url",
    pattern: /\b(DATABASE_URL\s*=\s*["']?[a-z][a-z0-9+.-]*:\/\/[^:]+:)([^@<>\s"']+)(@\S+)/gi,
    tag: "REDACTED-DB-URL-PASSWORD"
  },
  // AWS secret key (multiple forms)
  {
    name: "aws-secret-key",
    pattern: /^(\s*aws_secret_access_key\s*[:=]\s*)([^<>\s"']+)/gim,
    tag: "REDACTED-AWS-SECRET"
  },
  {
    name: "aws-secret-env",
    pattern: /\b(AWS_SECRET_ACCESS_KEY\s*=\s*["']?)([^\s"'#<>]+)(["']?)/g,
    tag: "REDACTED-AWS-SECRET"
  },
  // env-var style API keys / passwords. Runs after the high-entropy
  // shape rules so e.g. `API_TOKEN=ghp_xxx...` is tagged as
  // `REDACTED-GH-TOKEN`, not the catch-all `REDACTED-ENV-SECRET`.
  {
    name: "env-secret",
    pattern: /^((?:export\s+)?[A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASS)[A-Z0-9_]*\s*=\s*["']?)([^\s"'#<>]{6,})(["']?\s*(?:#.*)?)$/gm,
    tag: "REDACTED-ENV-SECRET"
  },
  // Generic key=value catch-all. The `<>` exclusion in the value
  // pattern is critical: it makes the rule idempotent and stops it
  // re-redacting placeholders produced by the rules above.
  {
    name: "generic-password",
    pattern: /((?:^|[\s;,&])(?:[A-Za-z][A-Za-z0-9_-]*[._-])?(?:password|passwd|pwd)\s*[:=]\s*["']?)([^"'\s#<>]{6,})/gi,
    tag: "REDACTED-PASSWORD"
  },
  {
    name: "generic-secret",
    pattern: /((?:^|[\s;,&])(?:[A-Za-z][A-Za-z0-9_-]*[._-])?(?:secret|api[_-]?key|access[_-]?key|token)\s*[:=]\s*["']?)([^"'\s#<>]{6,})/gi,
    tag: "REDACTED-SECRET"
  }
];

export interface RedactionResult {
  text: string;
  redacted: boolean;
  hits: Array<{ rule: string; count: number }>;
}

/**
 * Redact every secret pattern from the supplied text. Safe to call on
 * empty / undefined inputs — they're echoed back unchanged.
 */
export function redactSecrets(text: string | null | undefined): RedactionResult {
  if (!text) return { text: text ?? "", redacted: false, hits: [] };
  const counts = new Map<string, number>();
  let out = text;
  for (const rule of REDACTION_RULES) {
    let count = 0;
    if (rule.multiLine) {
      out = out.replace(rule.pattern, (_match, prefix: string, suffix: string) => {
        count += 1;
        return `${prefix}\n<${rule.tag}>\n${suffix}`;
      });
    } else {
      // The replace callback signature is
      //   (match, p1, p2, …, offset, source [, namedGroups]).
      // We only care about the capture groups, so filter on type-check
      // PLUS index — the last two args (offset:number, source:string)
      // must be excluded. We do that by counting `(...)` pairs in the
      // source pattern and stopping there.
      const groupCount = countCapturingGroups(rule.pattern);
      out = out.replace(rule.pattern, (match: string, ...rest: unknown[]) => {
        count += 1;
        const captures = rest.slice(0, groupCount).map((c) => (typeof c === "string" ? c : ""));
        const prefix = captures[0] ?? "";
        const trail = groupCount >= 3 ? captures[2] : "";
        return `${prefix}<${rule.tag}>${trail}`;
      });
    }
    if (count > 0) counts.set(rule.name, (counts.get(rule.name) ?? 0) + count);
  }
  return {
    text: out,
    redacted: counts.size > 0,
    hits: [...counts.entries()].map(([rule, count]) => ({ rule, count }))
  };
}

/**
 * Count capturing groups in a regex source. Naive but sufficient for
 * the redaction patterns we own (no nested character-class
 * gymnastics). We skip `(?:`, `(?=`, `(?!`, `(?<`, etc.
 */
function countCapturingGroups(re: RegExp): number {
  const src = re.source;
  let count = 0;
  let escape = false;
  let charClass = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (charClass) {
      if (ch === "]") charClass = false;
      continue;
    }
    if (ch === "[") { charClass = true; continue; }
    if (ch === "(") {
      if (src[i + 1] === "?") {
        // (?: , (?= , (?! , (?<= , (?<! , (?<name> are non-capturing or
        // named-but-still-capturing. Only (?<name> still counts.
        if (src[i + 2] === "<" && src[i + 3] !== "=" && src[i + 3] !== "!") count += 1;
      } else {
        count += 1;
      }
    }
  }
  return count;
}

const DEFAULT_PREVIEW_BYTES = 4096;

/**
 * Truncate a string to ~`maxBytes` of UTF-8 output, appending an
 * ellipsis indicator when truncated. Takes redaction into account so
 * the caller never has to decide between truncate-then-redact and
 * redact-then-truncate (we always redact first).
 */
export function truncatePreview(text: string | null | undefined, maxBytes = DEFAULT_PREVIEW_BYTES): string {
  if (!text) return "";
  if (text.length <= maxBytes) return text;
  return `${text.slice(0, maxBytes)}\n…[truncated ${text.length - maxBytes} bytes]`;
}

/**
 * Convenience helper: redact + truncate in one call.
 */
export function safePreview(text: string | null | undefined, maxBytes?: number): { text: string; redacted: boolean } {
  const r = redactSecrets(text);
  return { text: truncatePreview(r.text, maxBytes), redacted: r.redacted };
}

/**
 * Produce a fresh ActionRunRecord in `pending` state. Routes use this
 * before invoking the orchestrator so the API can return the run id
 * even if the SSH connection has not opened yet.
 */
export function newActionRunRecord(input: {
  planId: string;
  planHash?: string;
  itemId: string;
  actionId: string;
  targetConnectionId?: string;
  dryRun?: boolean;
  capabilityKey?: string;
  capabilityId?: string;
}): ActionRunRecord {
  return {
    id: `${input.planId}::${input.itemId}::${input.actionId}::${Date.now()}`,
    planId: input.planId,
    planHash: input.planHash ?? "legacy-unbound",
    itemId: input.itemId,
    actionId: input.actionId,
    targetConnectionId: input.targetConnectionId ?? "unknown-target",
    dryRun: input.dryRun === true,
    commandSummaries: [],
    capabilityKey: input.capabilityKey,
    capabilityId: input.capabilityId,
    startedAt: new Date().toISOString(),
    status: "pending",
    redacted: false
  };
}

/**
 * State machine for ActionRunRecord. Centralised so the test suite can
 * assert on transitions without duplicating the rules.
 */
const ALLOWED_TRANSITIONS: Record<ActionRunStatus, ActionRunStatus[]> = {
  pending: ["snapshotting", "skipped", "manual-required", "failed"],
  snapshotting: ["applying", "failed", "skipped"],
  applying: ["verifying", "failed"],
  verifying: ["succeeded", "failed"],
  succeeded: [],
  failed: ["rolling-back", "rolled-back"],
  "rolling-back": ["rolled-back", "rollback-failed"],
  "rolled-back": [],
  "rollback-failed": [],
  skipped: [],
  "manual-required": ["pending", "skipped"]
};

export class ActionRunStateError extends Error {
  constructor(from: ActionRunStatus, to: ActionRunStatus) {
    super(`ActionRunRecord: illegal transition ${from} → ${to}`);
  }
}

export function transition(record: ActionRunRecord, to: ActionRunStatus): ActionRunRecord {
  const allowed = ALLOWED_TRANSITIONS[record.status] ?? [];
  if (!allowed.includes(to)) throw new ActionRunStateError(record.status, to);
  return { ...record, status: to, endedAt: TERMINAL_STATES.has(to) ? new Date().toISOString() : record.endedAt };
}

export const TERMINAL_STATES = new Set<ActionRunStatus>([
  "succeeded",
  "failed",
  "rolled-back",
  "rollback-failed",
  "skipped",
  "manual-required"
]);

/**
 * Decide whether a Remove plan can auto-remove the supplied managed
 * marker. Returns either `auto` (apply gate proceeds) or `manual` with
 * a reason string the operator must read before confirming.
 */
export function canAutoRemove(marker: ManagedCapabilityRecord): { decision: "auto" | "manual"; reason: string } {
  const allManagedFresh = marker.packagesInstalled.every(
    (pkg) => pkg.removableByEnvForge && pkg.existedBefore === false
  );
  if (!allManagedFresh) {
    const offenders = marker.packagesInstalled.filter((pkg) => !pkg.removableByEnvForge || pkg.existedBefore);
    return {
      decision: "manual",
      reason: `${offenders.length} package(s) require manual confirmation: ${offenders
        .map((p) => `${p.name} (existedBefore=${p.existedBefore}, removable=${p.removableByEnvForge})`)
        .join(", ")}`
    };
  }
  if (marker.dataPathsKnown.length > 0) {
    return {
      decision: "manual",
      reason: `Capability has ${marker.dataPathsKnown.length} data path(s) requiring confirmation before removal: ${marker.dataPathsKnown.join(", ")}`
    };
  }
  return { decision: "auto", reason: "All packages were installed by EnvForge and existed before=false." };
}
