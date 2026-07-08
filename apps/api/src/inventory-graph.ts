/**
 * inventory-graph.ts — typed node/relationship layer over HostSnapshot.
 *
 * Phase: P1 Inventory Graph — nodes + service-stack aggregator.
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
  | "secretRef";

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
  ownerCapabilityKey?: string;
}

export interface VolumeNode extends InventoryNode {
  kind: "volume";
  name: string;
  mountpoint?: string;
  driver?: string;
}

// ══ Relationship types ════════════════════════════════════════════════

export type RelKind = "owns" | "listensOn" | "dependsOn" | "mounts" | "contains" | "references";

export interface InventoryRel {
  from: string;   // node id of the subject
  kind: RelKind;
  to: string;     // node id of the object
  evidence: string; // one-line justification
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

// ══ Extractors ════════════════════════════════════════════════════════

function nodeId(kind: InventoryNodeKind, discriminator: string): string {
  return `${kind}:${discriminator}`;
}

/**
 * Build a typed inventory graph from a stored probe snapshot. Only
 * extracts data that the collector actually gathers today — if a section
 * is missing (e.g. no docker-volumes collector) the corresponding nodes
 * are simply absent.
 */
export function extractInventoryGraph(snapshot: StoredProbeSnapshot): InventoryGraph {
  const nodes: InventoryNode[] = [];
  const rels: InventoryRel[] = [];

  // ── Packages ────────────────────────────────────────────────
  const pkgSources = new Set(["apt", "rpm", "snap", "flatpak", "npm", "pip", "gem", "cargo"]);
  for (const sw of snapshot.software ?? []) {
    if (pkgSources.has(sw.source)) {
      const id = nodeId("package", `${sw.source}:${sw.name}`);
      const pkg: PackageNode = { id, kind: "package", label: sw.name, source: sw.source, name: sw.name, version: sw.version, trust: sw.trust ?? "uncertain", evidence: { name: sw.name, version: sw.version, source: sw.source } };
      nodes.push(pkg);
    }
  }

  // ── Services ────────────────────────────────────────────────
  for (const sw of snapshot.software ?? []) {
    if (sw.source === "systemd" || sw.source === "systemd-timer" || sw.source === "cron") {
      const unit = sw.name; // e.g. "nginx.service"
      const id = nodeId("service", unit);
      const svcNode: ServiceNode = { id, kind: "service", label: unit, unit, status: sw.status ?? "unknown", evidence: { name: unit, status: sw.status, source: sw.source } };
      nodes.push(svcNode);
      // Service → Package link: match packages whose name starts with the
      // service's bare name (e.g. postgresql.service → postgresql, postgresql-client).
      const bareName = sw.name.replace(/\.(service|timer)$/, "");
      const matches = (snapshot.software ?? []).filter(
        s => (s.name === bareName || s.name.startsWith(bareName + "-")) && pkgSources.has(s.source)
      );
      for (const match of matches) {
        rels.push({
          from: id, kind: "owns",
          to: nodeId("package", `${match.source}:${match.name}`),
          evidence: "service name matches package name"
        });
      }
    }
  }

  // ── Containers ──────────────────────────────────────────────
  for (const sw of snapshot.software ?? []) {
    if (sw.source === "docker") {
      const id = nodeId("container", sw.name);
      const cn: ContainerNode = { id, kind: "container", label: sw.name, image: sw.name, source: "docker", evidence: { name: sw.name, version: sw.version } };
      nodes.push(cn);
    }
  }

  // ── Ports (from configChecklist + security-audit) ────────────
  for (const item of snapshot.configChecklist ?? []) {
    if (item.category === "network") {
      const portMatches = (item.status ?? "").match(/\b(\d{1,5})\b/g) ?? [];
      for (const portStr of portMatches) {
        const port = parseInt(portStr, 10);
        if (port > 0 && port <= 65535) {
          const id = nodeId("port", `${port}/tcp`);
          if (!nodes.some(n => n.id === id)) {
            const pn: PortNode = { id, kind: "port", label: `${port}/tcp`, port, protocol: "tcp", evidence: { configChecklistId: item.id, configItemLabel: item.label } };
            nodes.push(pn);
          }
        }
      }
    }
  }

  // ── Config files ────────────────────────────────────────────
  for (const sw of snapshot.software ?? []) {
    if (sw.source === "custom-config" || sw.source === "config-path") {
      const node: ConfigFileNode = { id: nodeId("configFile", sw.name), kind: "configFile", label: sw.name, path: sw.name, evidence: { name: sw.name } };
      nodes.push(node);
    }
  }

  return {
    hostname: snapshot.system?.hostname ?? snapshot.system?.platform ?? "unknown",
    capturedAt: snapshot.collectedAt,
    completeness: snapshot.collection?.completeness ?? 1,
    nodes,
    rels
  };
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
}

/**
 * Group nodes into service stacks by linking services → packages → ports
 * through evidence already present in the graph. This is the first
 * aggregator; future ones will handle container workloads and
 * database-cluster detection.
 */
export function aggregateServiceStacks(graph: InventoryGraph): ServiceStack[] {
  const stacks: ServiceStack[] = [];
  const assigned = new Set<string>(); // track assigned nodes

  const services = graph.nodes.filter(n => n.kind === "service") as ServiceNode[];
  for (const svc of services) {
    // Packages linked via the owns rel
    const ownedPkgIds = graph.rels
      .filter(r => r.from === svc.id && r.kind === "owns")
      .map(r => r.to);
    const packages = graph.nodes.filter(n => ownedPkgIds.includes(n.id)) as PackageNode[];

    // Ports: heuristic match — port number commonly associated with this
    // service's well-known port (e.g. service "nginx" matches port 80/443);
    // for now assign ports in the same evidence cluster.
    const ports = graph.nodes.filter(n =>
      n.kind === "port" &&
      ownedPkgIds.some(pid => {
        // loose heuristic: same-named package → likely same service stack
        const pkgNode = graph.nodes.find(nn => nn.id === pid) as PackageNode | undefined;
        return pkgNode && (svc.label.includes(pkgNode.name) || pkgNode.name.includes(svc.label.replace(/\.service$/, "")));
      })
    ) as PortNode[];

    // Config files with matching label
    const configFiles = graph.nodes.filter(n =>
      n.kind === "configFile" && n.label.toLowerCase().includes(svc.label.replace(/\.service$/, "").toLowerCase())
    ) as ConfigFileNode[];

    // Assign all
    for (const n of [svc, ...packages, ...ports, ...configFiles]) assigned.add(n.id);

    if (packages.length > 0 || ports.length > 0) {
      stacks.push({
        id: `stack:${svc.label.replace(/\.service$/, "")}`,
        label: svc.label.replace(/\.service$/, ""),
        service: svc,
        packages,
        ports,
        configFiles,
        containers: [],
        confidence: packages.length >= 2 ? "high" : packages.length === 1 ? "medium" : "low",
        reasoning: packages.length > 0
          ? `Service ${svc.unit} owns ${packages.length} packages, ${ports.length} known ports`
          : `Service ${svc.unit} has no directly linked packages`
      });
    }
  }

  return stacks;
}
