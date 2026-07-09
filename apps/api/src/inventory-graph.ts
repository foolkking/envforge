/**
 * inventory-graph.ts — typed node/relationship layer over HostSnapshot.
 *
 * Phase: P1 Inventory Graph — nodes + service-stack aggregator.
 * Phase 4-B: Second slice — Phase 3 data surfaces → typed nodes + edges.
 *
 * The existing `FullSystemSnapshot` / `StoredProbeSnapshot` stores a flat
 * `SoftwareItem[]` array where every entity (apt package, systemd service,
 * docker image, cron job, npm global, etc.) is the same shape discriminated
 * only by `source`. The migration-classifier then re-normalises this data ad
 * hoc through pattern matching on string labels. This module provides a
 * single, typed extraction that downstream consumers (classifier, Review
 * Inbox, conflict resolver, confidence engine, service-stack aggregator) can
 * share.
 *
 * Design:
 *   - Nodes = typed wrappers around the raw source evidence. They carry an
 *     `evidence` ref so the Review Inbox can show "why does the system think
 *     this port belongs to this service?"
 *   - Rels = lightweight link objects (no full-blown graph DB; lists of
 *     n:1 relationships that are cheap to walk in O(n)).
 *   - The extractor is pure data transformation (no SSH, no network) —
 *     testable against any StoredProbeSnapshot JSON.
 *   - The first aggregator recognises service stacks from colocated evidence.
 *   - Phase 4-B consumes the 10 structured data surfaces from Phase 3.
 */

import type { StoredProbeSnapshot } from "./runtime-store.js";

// ══ Node types ════════════════════════════════════════════════════════

export type InventoryNodeKind =
  | "package"
  | "service"
  | "port"
  | "process"
  | "container"
  | "configFile"
  | "dataPath"
  | "volume"
  | "secretRef"
  | "envFile"
  | "network"
  | "certificate"
  | "domain"
  | "userGroup"
  | "scheduledTask";

export interface InventoryNode {
  /** Stable node id within this extraction (e.g. "pkg:apt:nginx"). */
  id: string;
  kind: InventoryNodeKind;
  /** Human label derived from source evidence. */
  label: string;
  /** The raw source evidence backing this node (for the Review Inbox). */
  evidence: Record<string, unknown>;
}

export interface PackageNode extends InventoryNode {
  kind: "package";
  source: string;   // "apt" | "rpm" | "snap" | "flatpak" | "npm" | "pip" | ...
  name: string;
  version: string;
  trust: "user" | "uncertain";
}

export interface ServiceNode extends InventoryNode {
  kind: "service";
  /** systemd unit name, or "cron:<name>", or "docker:<container-id>" */
  unit: string;
  /** "running" | "enabled" | "static" | "unknown" */
  status: string;
}

export interface PortNode extends InventoryNode {
  kind: "port";
  port: number;
  protocol: "tcp" | "udp";
  /** If we parsed the process name from ss/netstat output. */
  processName?: string;
}

export interface ProcessNode extends InventoryNode {
  kind: "process";
  pid: number;
  user?: string;
  command: string;
  cpuPct?: number;
  memPct?: number;
  serviceName?: string;
  packageName?: string;
}

export interface ContainerNode extends InventoryNode {
  kind: "container";
  image: string;
  imageId?: string;
  source: "docker" | "podman";
}

export interface ConfigFileNode extends InventoryNode {
  kind: "configFile";
  path: string;
  /** Best-guess owning capability (from catalog rule lookup). */
  ownerCapabilityKey?: string;
}

export interface DataPathNode extends InventoryNode {
  kind: "dataPath";
  path: string;
  dataPathKind?: string;
  serviceName?: string;
  packageName?: string;
  sizeBytes?: number;
}

export interface VolumeNode extends InventoryNode {
  kind: "volume";
  name: string;
  mountpoint?: string;
  driver?: string;
}

export interface SecretRefNode extends InventoryNode {
  kind: "secretRef";
  fingerprint: string;
  /** e.g. "env:DB_PASSWORD" or "file:/etc/nginx/ssl/key.pem" */
  sourceLocation: string;
  secretKind: string;
  redacted: true;
}

export interface EnvFileNode extends InventoryNode {
  kind: "envFile";
  path: string;
  /** Integer count only — never the key names themselves. */
  keyCount: number;
  serviceName?: string;
}

export interface NetworkNode extends InventoryNode {
  kind: "network";
  name: string;
  networkKind: string;
  driver?: string;
  subnet?: string;
  gateway?: string;
}

export interface CertificateNode extends InventoryNode {
  kind: "certificate";
  path: string;
  subject?: string;
  issuer?: string;
  notBefore?: string;
  notAfter?: string;
  daysRemaining?: number;
  domains?: string[];
  certKind?: string;
}

export interface DomainNode extends InventoryNode {
  kind: "domain";
  name: string;
  source: string;
  serviceName?: string;
}

export interface UserGroupNode extends InventoryNode {
  kind: "userGroup";
  name: string;
  ugKind: "user" | "group";
  uid?: number;
  gid?: number;
  home?: string;
  shell?: string;
  system: boolean;
}

export interface ScheduledTaskNode extends InventoryNode {
  kind: "scheduledTask";
  taskId: string;
  taskKind: "cron" | "systemd-timer" | "anacron" | "unknown";
  schedule?: string;
  command?: string;
  user?: string;
  serviceName?: string;
  enabled: boolean;
}

// ══ Relationship types ════════════════════════════════════════════════

export type RelKind =
  | "owns"
  | "listensOn"
  | "dependsOn"
  | "mounts"
  | "contains"
  | "references"
  | "runs"
  | "writesTo"
  | "readsEnv"
  | "attachedTo"
  | "usesCertificate"
  | "invokes"
  | "provides"
  | "usesConfig";

export interface InventoryRel {
  from: string;   // node id of the subject
  kind: RelKind;
  to: string;     // node id of the object
  evidence: string; // one-line justification, may include [confidence] prefix
}

// ══ Extractor result ══════════════════════════════════════════════════

export interface InventoryGraph {
  /** The host this graph was built from. */
  hostname: string;
  capturedAt: string;
  completeness: number;
  nodes: InventoryNode[];
  rels: InventoryRel[];
}

// ══ Helpers ══════════════════════════════════════════════════════════

function nodeId(kind: InventoryNodeKind, discriminator: string): string {
  return `${kind}:${discriminator}`;
}

/** DJB2-style hash for deterministic IDs (one-way, fast). */
function hashStr(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Normalize a filesystem path into a stable key (lowercase, no trailing slash unless root). */
function normalizePath(p: string): string {
  let n = p.trim().toLowerCase().replace(/\\/g, "/");
  while (n.endsWith("/") && n.length > 1) n = n.slice(0, -1);
  return n;
}

/** Composite edge key for dedup. */
function edgeKey(from: string, kind: RelKind, to: string): string {
  return `${from}::${kind}::${to}`;
}

/** Add a node only if its id is not already present. Returns true if added. */
function addNodeOnce(nodes: InventoryNode[], node: InventoryNode): boolean {
  if (nodes.some(n => n.id === node.id)) return false;
  nodes.push(node);
  return true;
}

/** Add an edge only if its composite key is not already present. Returns true if added. */
function addEdgeOnce(rels: InventoryRel[], rel: InventoryRel): boolean {
  const key = edgeKey(rel.from, rel.kind, rel.to);
  if (rels.some(r => edgeKey(r.from, r.kind, r.to) === key)) return false;
  rels.push(rel);
  return true;
}

/** Format evidence excerpt, max 120 chars, no secret values. */
function fmtEvidence(excerpt: string): string {
  const cleaned = excerpt.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.length > 120 ? cleaned.slice(0, 117) + "…" : cleaned;
}

/**
 * Convert Phase 3 EvidenceRef[] to a safe Record<string, unknown>.
 * Only includes `collectorId`, `source`, `confidence` — never raw values.
 */
function evidenceRefsToRecord(refs: Array<{ collectorId: string; source: string; command?: string; path?: string; confidence?: string }>): Record<string, unknown> {
  if (!refs || refs.length === 0) return { source: "unknown" };
  const first = refs[0];
  return {
    collectorId: first.collectorId,
    source: first.source,
    ...(first.confidence ? { confidence: first.confidence } : {}),
    refCount: refs.length,
  };
}

/** Sort nodes: kind, then id. Deterministic output order. */
function sortNodes(nodes: InventoryNode[]): void {
  nodes.sort((a, b) => {
    const cmp = a.kind.localeCompare(b.kind);
    return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
  });
}

/** Sort edges: kind, then from, then to. Deterministic output order. */
function sortEdges(rels: InventoryRel[]): void {
  rels.sort((a, b) => {
    const cmp = a.kind.localeCompare(b.kind);
    if (cmp !== 0) return cmp;
    const fromCmp = a.from.localeCompare(b.from);
    if (fromCmp !== 0) return fromCmp;
    return a.to.localeCompare(b.to);
  });
}

// ══ Main extractor ═══════════════════════════════════════════════════

/**
 * Build a typed inventory graph from a stored probe snapshot. Only
 * extracts data that the collector actually gathers today — if a section
 * is missing (e.g. no docker-volumes collector) the corresponding nodes
 * are simply absent.
 *
 * Phase 4-B: consumes all 10 Phase 3 data surfaces.
 */
export function extractInventoryGraph(snapshot: StoredProbeSnapshot): InventoryGraph {
  const nodes: InventoryNode[] = [];
  const rels: InventoryRel[] = [];
  const hostname = snapshot.system?.hostname ?? "unknown";
  const seen = new Set<string>(); // global node-id dedup set

  // ── Helper: safe add with dedup ─────────────────────────
  function addNode(node: InventoryNode): boolean {
    if (seen.has(node.id)) return false;
    seen.add(node.id);
    nodes.push(node);
    return true;
  }

  function addRel(from: string, kind: RelKind, to: string, evidence: string): boolean {
    const key = edgeKey(from, kind, to);
    if (rels.some(r => edgeKey(r.from, r.kind, r.to) === key)) return false;
    rels.push({ from, kind, to, evidence: fmtEvidence(evidence) });
    return true;
  }

  // ═══════════════════════════════════════════════════════════
  // Phase 1 — First Slice: packages, services, ports, containers, configFiles
  // ═══════════════════════════════════════════════════════════

  const pkgSources = new Set(["apt", "rpm", "snap", "flatpak", "npm", "pip", "gem", "cargo"]);
  for (const sw of snapshot.software ?? []) {
    if (pkgSources.has(sw.source)) {
      const id = nodeId("package", `${sw.source}:${sw.name}`);
      const pkg: PackageNode = { id, kind: "package", label: sw.name, source: sw.source, name: sw.name, version: sw.version, trust: sw.trust ?? "uncertain", evidence: { name: sw.name, version: sw.version, source: sw.source } };
      addNode(pkg);
    }
  }

  // ── Services ────────────────────────────────────────────
  for (const sw of snapshot.software ?? []) {
    if (sw.source === "systemd" || sw.source === "systemd-timer" || sw.source === "cron") {
      const unit = sw.name;
      const id = nodeId("service", unit);
      const svcNode: ServiceNode = { id, kind: "service", label: unit, unit, status: sw.status ?? "unknown", evidence: { name: unit, status: sw.status, source: sw.source } };
      addNode(svcNode);
      // Service → Package link
      const bareName = sw.name.replace(/\.(service|timer)$/, "");
      const matches = (snapshot.software ?? []).filter(
        s => (s.name === bareName || s.name.startsWith(bareName + "-")) && pkgSources.has(s.source)
      );
      for (const match of matches) {
        addRel(id, "owns", nodeId("package", `${match.source}:${match.name}`),
          `[high] service name matches package name: ${match.name}`);
      }
    }
  }

  // ── Containers ──────────────────────────────────────────
  for (const sw of snapshot.software ?? []) {
    if (sw.source === "docker") {
      const id = nodeId("container", sw.name);
      const cn: ContainerNode = { id, kind: "container", label: sw.name, image: sw.name, source: "docker", evidence: { name: sw.name, version: sw.version } };
      addNode(cn);
    }
  }

  // ── Ports (from configChecklist + security-audit) ──────
  for (const item of snapshot.configChecklist ?? []) {
    if (item.category === "network") {
      const portMatches = (item.status ?? "").match(/\b(\d{1,5})\b/g) ?? [];
      for (const portStr of portMatches) {
        const port = parseInt(portStr, 10);
        if (port > 0 && port <= 65535) {
          const id = nodeId("port", `${port}/tcp`);
          if (!seen.has(id)) {
            const pn: PortNode = { id, kind: "port", label: `${port}/tcp`, port, protocol: "tcp", evidence: { configChecklistId: item.id, configItemLabel: item.label } };
            addNode(pn);
          }
        }
      }
    }
  }

  // ── Config files ────────────────────────────────────────
  for (const sw of snapshot.software ?? []) {
    if (sw.source === "custom-config" || sw.source === "config-path") {
      const node: ConfigFileNode = { id: nodeId("configFile", sw.name), kind: "configFile", label: sw.name, path: sw.name, evidence: { name: sw.name } };
      addNode(node);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Phase 4-B — Second Slice: Phase 3 data surfaces → nodes
  // ═══════════════════════════════════════════════════════════

  // ── 1. Process nodes ───────────────────────────────────
  for (const proc of snapshot.processes ?? []) {
    if (!proc.command || proc.pid === 0) continue;
    const cmdBase = proc.command.split(/\s+/)[0].split("/").pop() ?? "?";
    const h = hashStr(`${hostname}:${proc.command}`);
    const id = nodeId("process", `${proc.pid}|${h}`);
    const node: ProcessNode = {
      id, kind: "process",
      label: `${cmdBase} (pid=${proc.pid})`,
      pid: proc.pid, user: proc.user, command: proc.command,
      cpuPct: proc.cpuPct, memPct: proc.memPct,
      serviceName: proc.serviceName, packageName: proc.packageName,
      evidence: evidenceRefsToRecord(proc.evidence ?? []),
    };
    addNode(node);
  }

  // ── 2. DataPath nodes ──────────────────────────────────
  for (const dp of snapshot.dataPaths ?? []) {
    if (!dp.path) continue;
    const normPath = normalizePath(dp.path);
    const id = nodeId("dataPath", normPath);
    const label = dp.path.split("/").filter(Boolean).pop() ?? dp.path;
    const node: DataPathNode = {
      id, kind: "dataPath", label, path: dp.path,
      dataPathKind: dp.kind, serviceName: dp.serviceName, packageName: dp.packageName,
      sizeBytes: dp.sizeBytes,
      evidence: evidenceRefsToRecord(dp.evidence ?? []),
    };
    addNode(node);
  }

  // ── 3. EnvFile nodes ───────────────────────────────────
  for (const ef of snapshot.envFiles ?? []) {
    if (!ef.path) continue;
    const normPath = normalizePath(ef.path);
    const id = nodeId("envFile", normPath);
    const label = ef.path.split("/").filter(Boolean).pop() ?? ef.path;
    // keyCount only — NEVER expose key names in graph
    const node: EnvFileNode = {
      id, kind: "envFile", label, path: ef.path,
      keyCount: (ef.keys ?? []).length, serviceName: ef.serviceName,
      evidence: evidenceRefsToRecord(ef.evidence ?? []),
    };
    addNode(node);
  }

  // ── 4. SecretRef nodes ─────────────────────────────────
  for (const sr of snapshot.secretRefs ?? []) {
    if (!sr.fingerprint) continue;
    const id = nodeId("secretRef", sr.fingerprint);
    const node: SecretRefNode = {
      id, kind: "secretRef",
      label: `secret:${sr.fingerprint.slice(0, 8)}`,
      fingerprint: sr.fingerprint, sourceLocation: sr.sourceLocation,
      secretKind: sr.kind, redacted: true,
      // Only expose fingerprint + sourceLocation in evidence, never the raw value
      evidence: evidenceRefsToRecord(sr.evidence ?? []),
    };
    addNode(node);
  }

  // ── 5. Volume nodes ────────────────────────────────────
  for (const vol of snapshot.volumes ?? []) {
    const name = vol.name ?? vol.id;
    if (!name) continue;
    const id = nodeId("volume", name);
    const node: VolumeNode = {
      id, kind: "volume", label: name, name,
      mountpoint: vol.mountpoint, driver: vol.driver,
      evidence: evidenceRefsToRecord(vol.evidence ?? []),
    };
    addNode(node);
  }

  // ── 6. Network nodes ───────────────────────────────────
  for (const net of snapshot.networks ?? []) {
    if (!net.name || !net.id) continue;
    const id = nodeId("network", net.id);
    const node: NetworkNode = {
      id, kind: "network", label: net.name, name: net.name,
      networkKind: net.kind, driver: net.driver,
      subnet: net.subnet, gateway: net.gateway,
      evidence: evidenceRefsToRecord(net.evidence ?? []),
    };
    addNode(node);
  }

  // ── 7. Certificate nodes ───────────────────────────────
  for (const cert of snapshot.certificates ?? []) {
    if (!cert.path) continue;
    const normPath = normalizePath(cert.path);
    const id = nodeId("certificate", normPath);
    const label = cert.path.split("/").filter(Boolean).pop() ?? cert.path;
    const node: CertificateNode = {
      id, kind: "certificate", label, path: cert.path,
      subject: cert.subject, issuer: cert.issuer,
      notBefore: cert.notBefore, notAfter: cert.notAfter,
      daysRemaining: cert.daysRemaining, domains: cert.domains,
      certKind: cert.kind,
      evidence: evidenceRefsToRecord(cert.evidence ?? []),
    };
    addNode(node);
  }

  // ── 8. Domain nodes ────────────────────────────────────
  for (const dom of snapshot.domains ?? []) {
    if (!dom.name) continue;
    const id = nodeId("domain", dom.name.toLowerCase());
    const node: DomainNode = {
      id, kind: "domain", label: dom.name, name: dom.name,
      source: dom.source, serviceName: dom.serviceName,
      evidence: evidenceRefsToRecord(dom.evidence ?? []),
    };
    addNode(node);
  }

  // ── 9. UserGroup nodes ─────────────────────────────────
  for (const ug of snapshot.usersGroups ?? []) {
    if (!ug.name) continue;
    const id = nodeId("userGroup", `${ug.kind}:${ug.name}`);
    const node: UserGroupNode = {
      id, kind: "userGroup", label: ug.name, name: ug.name,
      ugKind: ug.kind,
      uid: ug.uid, gid: ug.gid,
      home: ug.home, shell: ug.shell,
      system: ug.system,
      evidence: evidenceRefsToRecord(ug.evidence ?? []),
    };
    addNode(node);
  }

  // ── 10. ScheduledTask nodes ────────────────────────────
  for (const st of snapshot.scheduledTasks ?? []) {
    if (!st.id) continue;
    const id = nodeId("scheduledTask", st.id);
    const node: ScheduledTaskNode = {
      id, kind: "scheduledTask", label: st.id, taskId: st.id,
      taskKind: st.kind,
      schedule: st.schedule, command: st.command,
      user: st.user, serviceName: st.serviceName,
      enabled: st.enabled,
      evidence: evidenceRefsToRecord(st.evidence ?? []),
    };
    addNode(node);
  }

  // ═══════════════════════════════════════════════════════════
  // Phase 4-B — Second Slice: edges
  // ═══════════════════════════════════════════════════════════

  // Build index maps for O(1) lookups
  const svcByName = new Map<string, string>(); // bareName → nodeId
  const containerByName = new Map<string, string>();
  const volByName = new Map<string, string>();
  const netById = new Map<string, string>();
  const processByPid = new Map<number, ProcessNode>();
  const certByPath = new Map<string, string>();
  const domainByName = new Map<string, string>();
  const envFileByPath = new Map<string, string>();
  const dataPathByPath = new Map<string, string>();
  const configFileByPath = new Map<string, string>();
  const userGroupByName = new Map<string, string>();
  const scheduledTaskByServiceName = new Map<string, string>();
  const scheduledTaskById = new Map<string, ScheduledTaskNode>();
  /** Cert nodes indexed by ID for SAN matching */
  const certNodesById = new Map<string, CertificateNode>();

  for (const n of nodes) {
    if (n.kind === "service") {
      const sn = n as ServiceNode;
      const bare = sn.unit.replace(/\.(service|timer)$/, "");
      if (!svcByName.has(bare)) svcByName.set(bare, sn.id);
    }
    if (n.kind === "container") containerByName.set(n.label, n.id);
    if (n.kind === "volume") volByName.set((n as VolumeNode).name, n.id);
    if (n.kind === "network") netById.set(n.id, n.id);
    if (n.kind === "process") {
      const pn = n as ProcessNode;
      if (!processByPid.has(pn.pid)) processByPid.set(pn.pid, pn);
    }
    if (n.kind === "certificate") {
      const cn = n as CertificateNode;
      const norm = normalizePath(cn.path);
      if (!certByPath.has(norm)) certByPath.set(norm, cn.id);
      certNodesById.set(cn.id, cn);
    }
    if (n.kind === "domain") {
      if (!domainByName.has(n.label.toLowerCase())) domainByName.set(n.label.toLowerCase(), n.id);
    }
    if (n.kind === "envFile") {
      const norm = normalizePath((n as EnvFileNode).path);
      if (!envFileByPath.has(norm)) envFileByPath.set(norm, n.id);
    }
    if (n.kind === "dataPath") {
      const norm = normalizePath((n as DataPathNode).path);
      if (!dataPathByPath.has(norm)) dataPathByPath.set(norm, n.id);
    }
    if (n.kind === "configFile") {
      const norm = normalizePath((n as ConfigFileNode).path);
      if (!configFileByPath.has(norm)) configFileByPath.set(norm, n.id);
    }
    if (n.kind === "userGroup") {
      if (!userGroupByName.has(n.label)) userGroupByName.set(n.label, n.id);
    }
    if (n.kind === "scheduledTask") {
      const stn = n as ScheduledTaskNode;
      scheduledTaskById.set(stn.taskId, stn);
      if (stn.serviceName) {
        const bare = stn.serviceName.replace(/\.(service|timer)$/, "");
        if (!scheduledTaskByServiceName.has(bare)) scheduledTaskByServiceName.set(bare, stn.id);
      }
    }
  }

  // ── service → runs → process ───────────────────────────
  for (const proc of snapshot.processes ?? []) {
    if (!proc.serviceName) continue;
    const bare = proc.serviceName.replace(/\.(service|timer)$/, "");
    const svcId = svcByName.get(bare);
    if (!svcId) continue;
    const procNode = [...processByPid.values()].find(p => p.pid === proc.pid);
    if (!procNode) continue;
    addRel(svcId, "runs", procNode.id,
      `[high] process.serviceName=${proc.serviceName} links to service ${bare}`);
  }

  // ── process → listensOn → port ─────────────────────────
  for (const proc of snapshot.processes ?? []) {
    if (!proc.listeningPorts || proc.listeningPorts.length === 0) continue;
    const procNode = [...processByPid.values()].find(p => p.pid === proc.pid);
    if (!procNode) continue;
    for (const lp of proc.listeningPorts) {
      const portId = nodeId("port", `${lp}/tcp`);
      // Only link if port node actually exists (it might have been created from configChecklist)
      if (seen.has(portId)) {
        addRel(procNode.id, "listensOn", portId,
          `[high] process pid=${proc.pid} listens on port ${lp}`);
      }
    }
  }

  // ── service → writesTo → dataPath ──────────────────────
  for (const dp of snapshot.dataPaths ?? []) {
    if (!dp.serviceName || !dp.path) continue;
    const bare = dp.serviceName.replace(/\.(service|timer)$/, "");
    const svcId = svcByName.get(bare);
    if (!svcId) continue;
    const norm = normalizePath(dp.path);
    const dpId = dataPathByPath.get(norm);
    if (!dpId) continue;
    addRel(svcId, "writesTo", dpId,
      `[high] service=${dp.serviceName} has data path ${dp.path}`);
  }

  // ── service → readsEnv → envFile ───────────────────────
  for (const ef of snapshot.envFiles ?? []) {
    if (!ef.serviceName || !ef.path) continue;
    const bare = ef.serviceName.replace(/\.(service|timer)$/, "");
    const svcId = svcByName.get(bare);
    if (!svcId) continue;
    const norm = normalizePath(ef.path);
    const efId = envFileByPath.get(norm);
    if (!efId) continue;
    addRel(svcId, "readsEnv", efId,
      `[high] service=${ef.serviceName} reads env file ${ef.path}`);
  }

  // ── envFile → references → secretRef ───────────────────
  for (const sr of snapshot.secretRefs ?? []) {
    if (!sr.sourceLocation || !sr.fingerprint) continue;
    const srId = nodeId("secretRef", sr.fingerprint);
    if (!seen.has(srId)) continue;
    // Match secretRef sourceLocation to an envFile path
    for (const [efNorm, efId] of envFileByPath) {
      if (sr.sourceLocation.startsWith(efNorm) || sr.sourceLocation.includes(efNorm)) {
        addRel(efId, "references", srId,
          `[high] secret fingerprint ${sr.fingerprint.slice(0, 8)} from env file`);
        break; // only link to first matching envFile
      }
    }
  }

  // ── configFile → references → secretRef ────────────────
  for (const sr of snapshot.secretRefs ?? []) {
    if (!sr.sourceLocation || !sr.fingerprint) continue;
    const srId = nodeId("secretRef", sr.fingerprint);
    if (!seen.has(srId)) continue;
    for (const [cfNorm, cfId] of configFileByPath) {
      if (sr.sourceLocation.startsWith(cfNorm) || sr.sourceLocation.includes(cfNorm)) {
        addRel(cfId, "references", srId,
          `[medium] secret fingerprint ${sr.fingerprint.slice(0, 8)} from config file`);
        break;
      }
    }
  }

  // ── container → mounts → volume ────────────────────────
  for (const vol of snapshot.volumes ?? []) {
    if (!vol.containerNames || vol.containerNames.length === 0) continue;
    const volName = vol.name ?? vol.id;
    if (!volName) continue;
    const volId = volByName.get(volName);
    if (!volId) continue;
    for (const cn of vol.containerNames) {
      const containerId = containerByName.get(cn);
      if (containerId) {
        addRel(containerId, "mounts", volId,
          `[high] container ${cn} mounts volume ${volName}`);
      }
    }
  }

  // ── container → attachedTo → network ───────────────────
  for (const net of snapshot.networks ?? []) {
    if (!net.containers || net.containers.length === 0) continue;
    const netId = netById.get(nodeId("network", net.id));
    if (!netId) continue;
    for (const cn of net.containers) {
      const containerId = containerByName.get(cn);
      if (containerId) {
        addRel(containerId, "attachedTo", netId,
          `[high] container ${cn} attached to network ${net.name}`);
      }
    }
  }

  // ── domain → usesCertificate → certificate ─────────────
  for (const dom of snapshot.domains ?? []) {
    if (!dom.name) continue;
    const domId = domainByName.get(dom.name.toLowerCase());
    if (!domId) continue;

    if (dom.certificatePath) {
      // Direct path match from domain evidence
      const normCertPath = normalizePath(dom.certificatePath);
      const certId = certByPath.get(normCertPath);
      if (certId) {
        addRel(domId, "usesCertificate", certId,
          `[high] domain ${dom.name} uses certificate at ${dom.certificatePath}`);
      }
    }

    // Fallback: match by SAN in certificates
    for (const [certId, certNode] of certNodesById) {
      if (certNode.domains?.some(d => d.toLowerCase() === dom.name.toLowerCase())) {
        addRel(domId, "usesCertificate", certId,
          `[high] domain ${dom.name} found in certificate SANs at ${certNode.path}`);
      }
    }
  }

  // ── scheduledTask → invokes → service ──────────────────
  for (const st of snapshot.scheduledTasks ?? []) {
    if (!st.serviceName || !st.id) continue;
    const stNode = scheduledTaskById.get(st.id);
    if (!stNode) continue;
    const bare = st.serviceName.replace(/\.(service|timer)$/, "");
    const svcId = svcByName.get(bare);
    if (svcId) {
      addRel(stNode.id, "invokes", svcId,
        `[high] scheduled task ${st.id} invokes service ${st.serviceName}`);
    }
  }

  // ── scheduledTask → invokes → process (by command match) ──
  for (const st of snapshot.scheduledTasks ?? []) {
    if (!st.command || !st.id) continue;
    const stNode = scheduledTaskById.get(st.id);
    if (!stNode) continue;
    // Heuristic: match command token to a process command
    const stCmdBase = st.command.split(/\s+/)[0].split("/").pop() ?? "";
    for (const [pid, procNode] of processByPid) {
      const procCmdBase = procNode.command.split(/\s+/)[0].split("/").pop() ?? "";
      if (stCmdBase === procCmdBase) {
        addRel(stNode.id, "invokes", procNode.id,
          `[medium] scheduled task command matches process ${procCmdBase} (pid=${pid})`);
      }
    }
  }

  // ── userGroup → owns → process ─────────────────────────
  for (const proc of snapshot.processes ?? []) {
    if (!proc.user) continue;
    const procNode = [...processByPid.values()].find(p => p.pid === proc.pid);
    if (!procNode) continue;
    const ugId = nodeId("userGroup", `user:${proc.user}`);
    if (seen.has(ugId)) {
      addRel(ugId, "owns", procNode.id,
        `[high] user ${proc.user} owns process pid=${proc.pid}`);
    }
  }

  // ── userGroup → owns → dataPath ────────────────────────
  for (const dp of snapshot.dataPaths ?? []) {
    if (!dp.owner) continue;
    const ugId = nodeId("userGroup", `user:${dp.owner}`);
    if (!seen.has(ugId)) continue;
    const norm = normalizePath(dp.path);
    const dpId = dataPathByPath.get(norm);
    if (!dpId) continue;
    addRel(ugId, "owns", dpId,
      `[high] user ${dp.owner} owns data path ${dp.path}`);
  }

  // ── package → provides → service ───────────────────────
  for (const sw of snapshot.software ?? []) {
    if (sw.source === "systemd" || sw.source === "systemd-timer") {
      const bare = sw.name.replace(/\.(service|timer)$/, "");
      const svcId = svcByName.get(bare);
      if (!svcId) continue;
      // Find packages with the same name
      const matches = (snapshot.software ?? []).filter(
        s => (s.name === bare || s.name.startsWith(bare + "-")) && pkgSources.has(s.source)
      );
      for (const match of matches) {
        const pkgId = nodeId("package", `${match.source}:${match.name}`);
        if (seen.has(pkgId)) {
          addRel(pkgId, "provides", svcId,
            `[medium] package ${match.name} likely provides service ${bare}`);
        }
      }
    }
  }

  // ── service → usesConfig → configFile ──────────────────
  for (const sw of snapshot.software ?? []) {
    if (sw.source !== "custom-config" && sw.source !== "config-path") continue;
    const cfId = nodeId("configFile", sw.name);
    if (!seen.has(cfId)) continue;
    // Heuristic: match config file name to known services
    for (const [bare, svcId] of svcByName) {
      if (sw.name.toLowerCase().includes(bare.toLowerCase())) {
        addRel(svcId, "usesConfig", cfId,
          `[low] config file ${sw.name} matches service ${bare} by name substring`);
      }
    }
  }

  // Sort for deterministic output
  sortNodes(nodes);
  sortEdges(rels);

  return {
    hostname,
    capturedAt: snapshot.collectedAt,
    completeness: snapshot.collection?.completeness ?? 1,
    nodes,
    rels
  };
}

// ══ Service stack ref types (Phase 5-B) ════════════════════════════════

export interface StackProcessRef {
  id: string;
  pid?: number;
  command?: string;
  user?: string;
  ports?: number[];
  confidence: "high" | "medium" | "low";
  evidence: string[];
}

export interface StackDataPathRef {
  id: string;
  path: string;
  kind?: string;
  owner?: string;
  confidence: "high" | "medium" | "low";
  evidence: string[];
}

export interface StackEnvFileRef {
  id: string;
  path: string;
  keyCount?: number;
  confidence: "high" | "medium" | "low";
  evidence: string[];
}

export interface StackSecretRef {
  id: string;
  fingerprint: string;
  kind?: string;
  sourceLocation?: string;
  redacted: true;
  confidence: "high" | "medium" | "low";
  evidence: string[];
}

export interface StackVolumeRef {
  id: string;
  name?: string;
  mountpoint?: string;
  confidence: "high" | "medium" | "low";
  evidence: string[];
}

export interface StackNetworkRef {
  id: string;
  name?: string;
  kind?: string;
  confidence: "high" | "medium" | "low";
  evidence: string[];
}

export interface StackCertificateRef {
  id: string;
  path?: string;
  domains?: string[];
  daysRemaining?: number;
  confidence: "high" | "medium" | "low";
  evidence: string[];
}

export interface StackDomainRef {
  id: string;
  name: string;
  certificateId?: string;
  confidence: "high" | "medium" | "low";
  evidence: string[];
}

export interface StackUserGroupRef {
  id: string;
  name: string;
  kind: "user" | "group";
  confidence: "high" | "medium" | "low";
  evidence: string[];
}

export interface StackScheduledTaskRef {
  id: string;
  kind?: string;
  schedule?: string;
  command?: string;
  confidence: "high" | "medium" | "low";
  evidence: string[];
}

export interface StackEnrichment {
  version: "phase5.stack.v1";
  sourceGraphNodeCount: number;
  sourceGraphEdgeCount: number;
  enrichmentWarnings: string[];
}

// ══ Service stack aggregator ═════════════════════════════════════════

export interface ServiceStack {
  /** Synthetic id (e.g. "stack:nginx-web-service"). */
  id: string;
  label: string;
  /** The service node at the centre of this stack. */
  service: ServiceNode;
  packages: PackageNode[];
  ports: PortNode[];
  configFiles: ConfigFileNode[];
  containers: ContainerNode[];
  /** How confident the system is that this is a coherent stack. */
  confidence: "high" | "medium" | "low";
  reasoning: string;

  // ── Phase 5-B: enriched stack fields (all optional, backward-compatible) ──
  processes?: StackProcessRef[];
  dataPaths?: StackDataPathRef[];
  envFiles?: StackEnvFileRef[];
  secretRefs?: StackSecretRef[];
  volumes?: StackVolumeRef[];
  networks?: StackNetworkRef[];
  certificates?: StackCertificateRef[];
  domains?: StackDomainRef[];
  usersGroups?: StackUserGroupRef[];
  scheduledTasks?: StackScheduledTaskRef[];
  enrichment?: StackEnrichment;
}

// ══ Aggregation helpers ══════════════════════════════════════════════

/** Parse confidence from edge evidence prefix. Defaults to "medium". */
function parseConfidence(evidence: string): "high" | "medium" | "low" {
  if (evidence.startsWith("[high]")) return "high";
  if (evidence.startsWith("[medium]")) return "medium";
  if (evidence.startsWith("[low]")) return "low";
  return "medium";
}

/** Collect edges of a given kind where `from` matches any of the given node IDs. */
function collectEdgesFrom(
  rels: InventoryRel[],
  fromIds: Set<string>,
  kind: RelKind
): InventoryRel[] {
  return rels.filter(r => fromIds.has(r.from) && r.kind === kind);
}

/** Collect edges of a given kind where `to` matches any of the given node IDs (reverse lookup). */
function collectEdgesTo(
  rels: InventoryRel[],
  toIds: Set<string>,
  kind: RelKind
): InventoryRel[] {
  return rels.filter(r => toIds.has(r.to) && r.kind === kind);
}

/** Sort refs by confidence (high→med→low) then id. Deterministic. */
function sortRefs<T extends { confidence: string; id: string }>(refs: T[]): void {
  const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
  refs.sort((a, b) => {
    const cmp = order[a.confidence] - order[b.confidence];
    return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
  });
}

/** Build a node lookup by id for fast access. */
function nodeById(nodes: InventoryNode[]): Map<string, InventoryNode> {
  const m = new Map<string, InventoryNode>();
  for (const n of nodes) m.set(n.id, n);
  return m;
}

// ══ Main aggregator ══════════════════════════════════════════════════

/**
 * Group nodes into service stacks by linking services to their surrounding
 * resources through graph edges.
 *
 * Phase 5-B enrichment: consumes Phase 4 expanded graph edges to attach
 * processes, dataPaths, envFiles, secretRefs, volumes, networks,
 * certificates, domains, usersGroups, and scheduledTasks to each stack.
 *
 * All new fields are optional — old snapshots without Phase 4 data
 * surfaces produce stacks identical to the pre-Phase-5 shape.
 */
export function aggregateServiceStacks(graph: InventoryGraph): ServiceStack[] {
  const stacks: ServiceStack[] = [];
  const assigned = new Set<string>();
  const nodeMap = nodeById(graph.nodes);

  // Pre-build edge index maps for O(1) lookups
  const edgesFrom = new Map<string, Map<RelKind, InventoryRel[]>>();
  const edgesTo = new Map<string, Map<RelKind, InventoryRel[]>>();
  for (const rel of graph.rels) {
    // from-index
    let fm = edgesFrom.get(rel.from);
    if (!fm) { fm = new Map(); edgesFrom.set(rel.from, fm); }
    let arr = fm.get(rel.kind);
    if (!arr) { arr = []; fm.set(rel.kind, arr); }
    arr.push(rel);
    // to-index
    let tm = edgesTo.get(rel.to);
    if (!tm) { tm = new Map(); edgesTo.set(rel.to, tm); }
    arr = tm.get(rel.kind);
    if (!arr) { arr = []; tm.set(rel.kind, arr); }
    arr.push(rel);
  }

  const hasPhase4Surfaces =
    graph.nodes.some(n => n.kind === "process") ||
    graph.nodes.some(n => n.kind === "dataPath");

  const services = graph.nodes.filter(n => n.kind === "service") as ServiceNode[];

  for (const svc of services) {
    const svcBareName = svc.unit.replace(/\.(service|timer)$/, "");
    const warnings: string[] = [];

    // ── 1-hop from service ──────────────────────────────────────────
    const sf = edgesFrom.get(svc.id) ?? new Map<RelKind, InventoryRel[]>();

    // Packages (owns — existing logic, unchanged)
    const ownedRels = sf.get("owns") ?? [];
    const ownedPkgIds = ownedRels.map((r: InventoryRel) => r.to);
    const packages = ownedPkgIds
      .map((id: string) => nodeMap.get(id) as PackageNode | undefined)
      .filter((n): n is PackageNode => n !== undefined && n.kind === "package");

    // Config files (usesConfig — new edge-based; fall back to label heuristic)
    let configEdges = sf.get("usesConfig") ?? [];
    let configFiles: ConfigFileNode[];
    if (configEdges.length > 0) {
      configFiles = configEdges
        .map((r: InventoryRel) => nodeMap.get(r.to) as ConfigFileNode | undefined)
        .filter((n): n is ConfigFileNode => n !== undefined && n.kind === "configFile");
    } else {
      // Fallback: label-substring heuristic (original behavior)
      configFiles = graph.nodes.filter(n =>
        n.kind === "configFile" &&
        n.label.toLowerCase().includes(svcBareName.toLowerCase())
      ) as ConfigFileNode[];
    }

    // Ports (prefer process→listensOn 2-hop; fall back to heuristic)
    let ports: PortNode[] = [];
    const portIds = new Set<string>();

    const processEdges = sf.get("runs") ?? [];
    const processIds = new Set<string>(processEdges.map((r: InventoryRel) => r.to));

    if (processIds.size > 0) {
      // Edge-based: process → listensOn → port (2-hop)
      for (const pid of processIds) {
        const pf = edgesFrom.get(pid);
        if (!pf) continue;
        const listenEdges = pf.get("listensOn") ?? [];
        for (const le of listenEdges) {
          const portNode = nodeMap.get(le.to) as PortNode | undefined;
          if (portNode?.kind === "port" && !portIds.has(portNode.id)) {
            ports.push(portNode);
            portIds.add(portNode.id);
          }
        }
      }
    }

    if (ports.length === 0) {
      // Fallback: original heuristic (package-name substring matching)
      ports = graph.nodes.filter(n =>
        n.kind === "port" &&
        ownedPkgIds.some((pid: string) => {
          const pkgNode = nodeMap.get(pid) as PackageNode | undefined;
          return pkgNode && (
            svc.label.includes(pkgNode.name) ||
            pkgNode.name.includes(svcBareName)
          );
        })
      ) as PortNode[];
    }

    // Containers (image-name heuristic matching)
    const containers = graph.nodes.filter(n => {
      if (n.kind !== "container") return false;
      const cn = n as ContainerNode;
      return cn.image.toLowerCase().includes(svcBareName.toLowerCase()) ||
             svcBareName.toLowerCase().includes(cn.image.toLowerCase());
    }) as ContainerNode[];
    const containerIds = new Set(containers.map(c => c.id));

    // ── Phase 5-B enrichment: 1-hop from service ──────────────────
    // Processes (runs)
    const runsEdges = sf.get("runs") ?? [];
    const stackProcessIds = new Set<string>(runsEdges.map((r: InventoryRel) => r.to));
    const processes: StackProcessRef[] = [];
    for (const re of runsEdges) {
      const pn = nodeMap.get(re.to) as ProcessNode | undefined;
      if (!pn || pn.kind !== "process") continue;
      // Collect ports this process listens on
      const pf = edgesFrom.get(pn.id);
      const pPorts: number[] = [];
      if (pf) {
        for (const le of pf.get("listensOn") ?? []) {
          const portNode = nodeMap.get(le.to) as PortNode | undefined;
          if (portNode?.kind === "port") pPorts.push(portNode.port);
        }
      }
      processes.push({
        id: pn.id,
        pid: pn.pid,
        command: pn.command,
        user: pn.user,
        ports: pPorts.length > 0 ? pPorts : undefined,
        confidence: parseConfidence(re.evidence),
        evidence: [re.evidence],
      });
    }

    // DataPaths (writesTo)
    const writesEdges = sf.get("writesTo") ?? [];
    const stackDataPathIds = new Set<string>(writesEdges.map((r: InventoryRel) => r.to));
    const dataPaths: StackDataPathRef[] = [];
    for (const we of writesEdges) {
      const dp = nodeMap.get(we.to) as DataPathNode | undefined;
      if (!dp || dp.kind !== "dataPath") continue;
      dataPaths.push({
        id: dp.id,
        path: dp.path,
        kind: dp.dataPathKind,
        owner: undefined,
        confidence: parseConfidence(we.evidence),
        evidence: [we.evidence],
      });
    }

    // EnvFiles (readsEnv)
    const readsEnvEdges = sf.get("readsEnv") ?? [];
    const stackEnvFileIds = new Set<string>(readsEnvEdges.map((r: InventoryRel) => r.to));
    const envFiles: StackEnvFileRef[] = [];
    for (const ree of readsEnvEdges) {
      const ef = nodeMap.get(ree.to) as EnvFileNode | undefined;
      if (!ef || ef.kind !== "envFile") continue;
      envFiles.push({
        id: ef.id,
        path: ef.path,
        keyCount: ef.keyCount,
        confidence: parseConfidence(ree.evidence),
        evidence: [ree.evidence],
      });
    }

    // ── Phase 5-B enrichment: 2-hop ────────────────────────────────
    // SecretRefs (envFile → references → secretRef)
    const secretRefs: StackSecretRef[] = [];
    const secretRefIds = new Set<string>();
    for (const efId of stackEnvFileIds) {
      const eff = edgesFrom.get(efId);
      if (!eff) continue;
      const refEdges = eff.get("references") ?? [];
      for (const re of refEdges) {
        const sr = nodeMap.get(re.to) as SecretRefNode | undefined;
        if (!sr || sr.kind !== "secretRef" || secretRefIds.has(sr.id)) continue;
        secretRefIds.add(sr.id);
        secretRefs.push({
          id: sr.id,
          fingerprint: sr.fingerprint,
          kind: sr.secretKind,
          sourceLocation: sr.sourceLocation,
          redacted: true,
          confidence: parseConfidence(re.evidence),
          evidence: [re.evidence],
        });
      }
    }

    // ── Phase 5-B enrichment: container resources ──────────────────
    const volumes: StackVolumeRef[] = [];
    const volumeIds = new Set<string>();
    for (const cid of containerIds) {
      const cf = edgesFrom.get(cid);
      if (!cf) continue;
      const mountEdges = cf.get("mounts") ?? [];
      for (const me of mountEdges) {
        const vol = nodeMap.get(me.to) as VolumeNode | undefined;
        if (!vol || vol.kind !== "volume" || volumeIds.has(vol.id)) continue;
        volumeIds.add(vol.id);
        volumes.push({
          id: vol.id,
          name: vol.name,
          mountpoint: vol.mountpoint,
          confidence: parseConfidence(me.evidence),
          evidence: [me.evidence],
        });
      }
    }

    const networks: StackNetworkRef[] = [];
    const networkIds = new Set<string>();
    for (const cid of containerIds) {
      const cf = edgesFrom.get(cid);
      if (!cf) continue;
      const netEdges = cf.get("attachedTo") ?? [];
      for (const ne of netEdges) {
        const net = nodeMap.get(ne.to) as NetworkNode | undefined;
        if (!net || net.kind !== "network" || networkIds.has(net.id)) continue;
        networkIds.add(net.id);
        networks.push({
          id: net.id,
          name: net.name,
          kind: net.networkKind,
          confidence: parseConfidence(ne.evidence),
          evidence: [ne.evidence],
        });
      }
    }

    // ── Phase 5-B enrichment: domain + certificate (name matching) ──
    const domainNodes = graph.nodes.filter(n =>
      n.kind === "domain" && (
        (n as DomainNode).serviceName === svcBareName ||
        (n as DomainNode).serviceName === svc.unit ||
        (n as DomainNode).source.toLowerCase() === svcBareName.toLowerCase() ||
        (n as DomainNode).source.toLowerCase() === svc.label.toLowerCase()
      )
    ) as DomainNode[];

    const domains: StackDomainRef[] = [];
    const certificates: StackCertificateRef[] = [];
    const certIds = new Set<string>();

    for (const dom of domainNodes) {
      const df = edgesFrom.get(dom.id);
      const certEdges = df?.get("usesCertificate") ?? [];
      let certId: string | undefined;
      for (const ce of certEdges) {
        const cert = nodeMap.get(ce.to) as CertificateNode | undefined;
        if (!cert || cert.kind !== "certificate") continue;
        if (!certIds.has(cert.id)) {
          certIds.add(cert.id);
          certificates.push({
            id: cert.id,
            path: cert.path,
            domains: cert.domains,
            daysRemaining: cert.daysRemaining,
            confidence: parseConfidence(ce.evidence),
            evidence: [ce.evidence],
          });
        }
        certId = certId ?? cert.id;
      }
      domains.push({
        id: dom.id,
        name: dom.name,
        certificateId: certId,
        confidence: "high",
        evidence: [fmtEvidence(`domain ${dom.name} from ${dom.source}`)],
      });
    }

    // ── Phase 5-B enrichment: reverse edges ────────────────────────
    // scheduledTask → invokes → service
    const scheduledTasks: StackScheduledTaskRef[] = [];
    const stIds = new Set<string>();
    const invokesToSvc = collectEdgesTo(graph.rels, new Set([svc.id]), "invokes");
    for (const ie of invokesToSvc) {
      const st = nodeMap.get(ie.from) as ScheduledTaskNode | undefined;
      if (!st || st.kind !== "scheduledTask" || stIds.has(st.id)) continue;
      stIds.add(st.id);
      const conf = parseConfidence(ie.evidence);
      if (conf === "low") warnings.push(`Low confidence: scheduledTask ${st.taskId} → service ${svcBareName}`);
      scheduledTasks.push({
        id: st.id,
        kind: st.taskKind,
        schedule: st.schedule,
        command: st.command,
        confidence: conf,
        evidence: [ie.evidence],
      });
    }

    // userGroup → owns → process/dataPath (that are in this stack)
    const usersGroups: StackUserGroupRef[] = [];
    const ugIds = new Set<string>();
    // userGroup owns processes in this stack
    const ugOwnsProcesses = collectEdgesTo(graph.rels, stackProcessIds, "owns")
      .filter(r => nodeMap.get(r.from)?.kind === "userGroup");
    for (const re of ugOwnsProcesses) {
      const ug = nodeMap.get(re.from) as UserGroupNode | undefined;
      if (!ug || ug.kind !== "userGroup" || ugIds.has(ug.id)) continue;
      ugIds.add(ug.id);
      usersGroups.push({
        id: ug.id,
        name: ug.name,
        kind: ug.ugKind,
        confidence: parseConfidence(re.evidence),
        evidence: [re.evidence],
      });
    }
    // userGroup owns dataPaths in this stack
    const ugOwnsDps = collectEdgesTo(graph.rels, stackDataPathIds, "owns")
      .filter(r => nodeMap.get(r.from)?.kind === "userGroup");
    for (const re of ugOwnsDps) {
      const ug = nodeMap.get(re.from) as UserGroupNode | undefined;
      if (!ug || ug.kind !== "userGroup" || ugIds.has(ug.id)) continue;
      ugIds.add(ug.id);
      usersGroups.push({
        id: ug.id,
        name: ug.name,
        kind: ug.ugKind,
        confidence: parseConfidence(re.evidence),
        evidence: [re.evidence],
      });
    }

    // ── Sort all refs deterministically ──────────────────
    sortRefs(processes);
    sortRefs(dataPaths);
    sortRefs(envFiles);
    sortRefs(secretRefs);
    sortRefs(volumes);
    sortRefs(networks);
    sortRefs(certificates);
    sortRefs(domains);
    sortRefs(usersGroups);
    sortRefs(scheduledTasks);

    // Assign all
    for (const n of [svc, ...packages, ...ports, ...configFiles, ...containers]) assigned.add(n.id);

    if (packages.length > 0 || ports.length > 0) {
      stacks.push({
        id: `stack:${svc.label.replace(/\.service$/, "")}`,
        label: svc.label.replace(/\.service$/, ""),
        service: svc,
        packages,
        ports,
        configFiles,
        containers,
        confidence: packages.length >= 2 ? "high" : packages.length === 1 ? "medium" : "low",
        reasoning: packages.length > 0
          ? `Service ${svc.unit} owns ${packages.length} packages, ${ports.length} known ports`
          : `Service ${svc.unit} has no directly linked packages`,
        // Phase 5-B enrichment (only include if there's data)
        processes: processes.length > 0 ? processes : undefined,
        dataPaths: dataPaths.length > 0 ? dataPaths : undefined,
        envFiles: envFiles.length > 0 ? envFiles : undefined,
        secretRefs: secretRefs.length > 0 ? secretRefs : undefined,
        volumes: volumes.length > 0 ? volumes : undefined,
        networks: networks.length > 0 ? networks : undefined,
        certificates: certificates.length > 0 ? certificates : undefined,
        domains: domains.length > 0 ? domains : undefined,
        usersGroups: usersGroups.length > 0 ? usersGroups : undefined,
        scheduledTasks: scheduledTasks.length > 0 ? scheduledTasks : undefined,
        enrichment: {
          version: "phase5.stack.v1",
          sourceGraphNodeCount: graph.nodes.length,
          sourceGraphEdgeCount: graph.rels.length,
          enrichmentWarnings: warnings,
        },
      });
    }
  }

  return stacks;
}
