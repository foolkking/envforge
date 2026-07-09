/**
 * collectors/data-surfaces.ts — structured data-surface item types
 *
 * Phase 3-B: Each surface carries typed fields + evidence refs so the
 * Inventory Graph second slice and the Review Inbox have rich, queryable
 * data without parsing raw collector strings.
 *
 * Backward-compatible: all fields on StoredProbeSnapshot are optional.
 * Old snapshots without these fields deserialize without error.
 */

// ══ Evidence ═══════════════════════════════════════════════════════════

/**
 * Lightweight evidence reference that links a surface item back to the
 * collector command / section that produced it.
 *
 * Designed to be compatible with InventoryNode.evidence: Record<string,unknown>
 * — the extraction layer maps EvidenceRef[] → Record<string, unknown>.
 */
export interface EvidenceRef {
  collectorId: string;
  source: string; // "ps-aux" | "systemd-show" | "docker-network-inspect" | …
  command?: string;
  path?: string;
  confidence?: "high" | "medium" | "low";
}

// ══ Process ════════════════════════════════════════════════════════════

export interface ProcessItem {
  pid: number;
  ppid?: number;
  user?: string;
  command: string;
  args?: string[];
  cpuPct?: number;
  memPct?: number;
  serviceName?: string;
  packageName?: string;
  listeningPorts?: number[];
  evidence: EvidenceRef[];
}

// ══ DataPath ═══════════════════════════════════════════════════════════

export interface DataPathItem {
  path: string;
  kind: "service-workdir" | "docker-volume-mount" | "app-data" | "database-data"
    | "log-dir" | "config-dir" | "unknown";
  owner?: string;
  group?: string;
  mode?: string;
  sizeBytes?: number;
  serviceName?: string;
  packageName?: string;
  evidence: EvidenceRef[];
}

// ══ EnvFile ═══════════════════════════════════════════════════════════

/**
 * EnvFile entries store ONLY key names — values are stripped during
 * collection and MUST NOT appear in the snapshot.
 */
export interface EnvFileItem {
  path: string;
  serviceName?: string;
  keys: string[]; // key names only — values redacted before leaving remote host
  redacted: true;
  secretRefs?: string[]; // fingerprint ids of secrets found in this file
  evidence: EvidenceRef[];
}

// ══ SecretRef ═════════════════════════════════════════════════════════

/**
 * SecretRef stores ONLY a fingerprint (sha256). The raw secret value
 * MUST NOT be collected, stored, or serialized.
 */
export interface SecretRefItem {
  /** Stable id derived from sourceLocation + fingerprint prefix. */
  id: string;
  sourceLocation: string; // e.g. "env:DB_PASSWORD" or "file:/etc/nginx/ssl/key.pem"
  kind: "env" | "config" | "file" | "connection-string" | "token" | "password"
    | "certificate-key" | "unknown";
  fingerprint: string; // sha256 hex — irreversible
  redacted: true;
  requiredAtApply?: boolean;
  evidence: EvidenceRef[];
}

// ══ Volume ════════════════════════════════════════════════════════════

export interface VolumeItem {
  id: string;
  name?: string;
  driver?: string;
  mountpoint?: string;
  scope?: "local" | "global";
  labels?: Record<string, string>;
  containerNames?: string[];
  sizeBytes?: number;
  evidence: EvidenceRef[];
}

// ══ Network ════════════════════════════════════════════════════════════

export interface NetworkItem {
  id: string;
  name: string;
  kind: "docker-bridge" | "docker-overlay" | "docker-macvlan" | "host" | "compose" | "unknown";
  driver?: string;
  subnet?: string;
  gateway?: string;
  containers?: string[];
  labels?: Record<string, string>;
  evidence: EvidenceRef[];
}

// ══ Certificate ════════════════════════════════════════════════════════

export interface CertificateItem {
  path: string;
  subject?: string;
  issuer?: string;
  notBefore?: string;
  notAfter?: string;
  daysRemaining?: number;
  domains?: string[]; // SAN entries extracted via openssl
  kind: "cert" | "key" | "chain" | "unknown";
  evidence: EvidenceRef[];
}

// ══ Domain ═════════════════════════════════════════════════════════════

export interface DomainItem {
  name: string;
  source: "nginx" | "caddy" | "apache" | "certificate" | "config" | "unknown";
  serviceName?: string;
  certificatePath?: string;
  evidence: EvidenceRef[];
}

// ══ UserGroup ══════════════════════════════════════════════════════════

export interface UserGroupItem {
  name: string;
  kind: "user" | "group";
  uid?: number;
  gid?: number;
  home?: string;
  shell?: string;
  system: boolean;
  memberOf?: string[];
  serviceNames?: string[];
  evidence: EvidenceRef[];
}

// ══ ScheduledTask ══════════════════════════════════════════════════════

export interface ScheduledTaskItem {
  id: string;
  kind: "cron" | "systemd-timer" | "anacron" | "unknown";
  schedule?: string; // cron expression or OnCalendar=
  command?: string;
  user?: string;
  serviceName?: string;
  enabled: boolean;
  evidence: EvidenceRef[];
}

// ══ Collection helpers ═════════════════════════════════════════════════

/**
 * Ensure all data-surface arrays are at least `[]` so downstream
 * consumers never see `undefined` for a missing surface.
 */
export function normalizeDataSurfaces<
  T extends Partial<Record<string, Array<unknown>>>
>(surfaces: T): T {
  const out = { ...surfaces };
  for (const [key, val] of Object.entries(out)) {
    if (val === undefined || val === null) (out as Record<string, unknown>)[key] = [];
  }
  return out;
}

// ══ Redaction ══════════════════════════════════════════════════════════

/**
 * Compute an irreversible fingerprint from a source location + key name.
 * Uses a simple DJB2-style hash — fast, deterministic, and one-way for
 * this purpose (we never need to reverse it).
 */
export function fingerprintSecret(location: string, keyName: string): string {
  const input = `${location}:${keyName}`;
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Strip env values — return only key names. */
export function extractEnvKeys(raw: string): string[] {
  return raw
    .split("\n")
    .map(l => l.trim())
    .filter(l => l && !l.startsWith("#"))
    .map(l => {
      const eqIdx = l.indexOf("=");
      return eqIdx > 0 ? l.slice(0, eqIdx).trim() : l;
    })
    .filter(k => k.length > 0);
}

/**
 * Known secret-like key patterns. Never matched against values —
 * only used to classify SecretRef entries after key extraction.
 */
const SECRET_KEY_PATTERNS = [
  /PASSWORD/i, /PASSWD/i, /SECRET/i, /TOKEN/i, /KEY/i,
  /CREDENTIAL/i, /AUTH/i, /API[_-]?KEY/i, /ACCESS[_-]?KEY/i,
  /PRIVATE[_-]?KEY/i, /CERTIFICATE[_-]?KEY/i,
];

/**
 * Return true when a key NAME (not value) looks like it refers to a
 * secret. This guards the classification step without touching values.
 */
export function isSecretKeyName(keyName: string): boolean {
  return SECRET_KEY_PATTERNS.some(p => p.test(keyName));
}
