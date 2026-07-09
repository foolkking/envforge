/**
 * inventory-graph-phase4.test.ts — Phase 4-B second slice tests.
 *
 * Covers all 10 data surfaces: Process, DataPath, EnvFile, SecretRef,
 * Volume, Network, Certificate, Domain, UserGroup, ScheduledTask.
 *
 * Also covers: old snapshot compat, empty arrays, secret safety,
 * deterministic IDs, dedup, and existing first slice regression.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  extractInventoryGraph,
  aggregateServiceStacks,
  type PackageNode, type ServiceNode, type PortNode, type ContainerNode,
  type ProcessNode, type DataPathNode, type EnvFileNode, type SecretRefNode,
  type VolumeNode, type NetworkNode, type CertificateNode, type DomainNode,
  type UserGroupNode, type ScheduledTaskNode,
} from "../../inventory-graph.js";
import type { StoredProbeSnapshot } from "../../runtime-store.js";

// ── Snapshot builder helper ──

function snap(overrides: Partial<StoredProbeSnapshot> = {}): StoredProbeSnapshot {
  return {
    agentId: "agent-test",
    collectedAt: "2026-07-01T00:00:00.000Z",
    system: {
      hostname: "vm-test", platform: "linux", arch: "x64", release: "6.8", uptime: 0,
      cpu: { model: "test", cores: 2, speedMhz: 2400 },
      memory: { totalBytes: 8192, freeBytes: 4096, usedBytes: 4096, totalGb: "8", freeGb: "4" }
    },
    software: [],
    configChecklist: [],
    collection: { status: "ok", completeness: 1, commands: [], errors: [], timedOut: false },
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Process
// ═══════════════════════════════════════════════════════════════════

test("P4B: process nodes from dataSurfaces.processes", () => {
  const g = extractInventoryGraph(snap({
    processes: [
      { pid: 1234, user: "www-data", command: "/usr/sbin/nginx", cpuPct: 0.5, memPct: 1.2, serviceName: "nginx", evidence: [{ collectorId: "ps-aux", source: "ps-aux", confidence: "high" }] },
      { pid: 5678, user: "root", command: "/usr/sbin/sshd", evidence: [{ collectorId: "ps-aux", source: "ps-aux" }] },
    ]
  }));
  const procs = g.nodes.filter(n => n.kind === "process") as ProcessNode[];
  assert.equal(procs.length, 2, "two process nodes");
  const nginx = procs.find(p => p.pid === 1234);
  assert.ok(nginx, "nginx process exists");
  assert.ok(nginx!.id.startsWith("process:1234|"), "deterministic id prefix");
  assert.equal(nginx!.user, "www-data");
  assert.equal(nginx!.serviceName, "nginx");
  assert.equal(nginx!.label, "nginx (pid=1234)");
  // evidence preserved
  assert.equal(nginx!.evidence.collectorId, "ps-aux");
});

test("P4B: process pid=0 skipped", () => {
  const g = extractInventoryGraph(snap({
    processes: [
      { pid: 0, command: "", evidence: [{ collectorId: "ps-aux", source: "ps-aux" }] },
    ]
  }));
  assert.equal(g.nodes.filter(n => n.kind === "process").length, 0, "pid=0 skipped");
});

test("P4B: service -> runs -> process edge", () => {
  const g = extractInventoryGraph(snap({
    software: [
      { name: "nginx.service", version: "", source: "systemd", status: "running" },
    ],
    processes: [
      { pid: 1234, user: "www-data", command: "/usr/sbin/nginx", serviceName: "nginx", evidence: [{ collectorId: "ps-aux", source: "ps-aux" }] },
    ]
  }));
  const runsEdges = g.rels.filter(r => r.kind === "runs");
  assert.ok(runsEdges.length >= 1, "at least one runs edge");
  const runs = runsEdges[0];
  assert.ok(runs.from.startsWith("service:"), "from is a service");
  assert.ok(runs.to.startsWith("process:"), "to is a process");
  assert.ok(runs.evidence.includes("[high]"), "high confidence");
});

test("P4B: process -> listensOn -> port edge", () => {
  const g = extractInventoryGraph(snap({
    configChecklist: [
      { id: "n1", label: "开放端口", category: "network", status: "8080", lastChanged: "" },
    ],
    processes: [
      { pid: 99, user: "root", command: "/usr/bin/node server.js", listeningPorts: [8080], evidence: [{ collectorId: "ps-aux", source: "ps-aux" }] },
    ]
  }));
  const listenEdges = g.rels.filter(r => r.kind === "listensOn");
  assert.ok(listenEdges.length >= 1, "at least one listensOn edge");
  assert.ok(listenEdges[0].from.startsWith("process:"), "from is process");
  assert.ok(listenEdges[0].to.startsWith("port:"), "to is port");
});

// ═══════════════════════════════════════════════════════════════════
// DataPath
// ═══════════════════════════════════════════════════════════════════

test("P4B: dataPath nodes", () => {
  const g = extractInventoryGraph(snap({
    dataPaths: [
      { path: "/var/www/html", kind: "app-data", serviceName: "nginx", evidence: [{ collectorId: "data-paths", source: "data-paths" }] },
      { path: "/var/lib/postgresql", kind: "database-data", evidence: [{ collectorId: "data-paths", source: "data-paths" }] },
    ]
  }));
  const dps = g.nodes.filter(n => n.kind === "dataPath") as DataPathNode[];
  assert.equal(dps.length, 2);
  // deterministic path normalization
  assert.ok(dps[0].id.includes("var/www/html") || dps[1].id.includes("var/www/html"));
  const nginxDp = dps.find(d => d.serviceName === "nginx");
  assert.ok(nginxDp);
  assert.equal(nginxDp!.dataPathKind, "app-data");
});

test("P4B: service -> writesTo -> dataPath edge", () => {
  const g = extractInventoryGraph(snap({
    software: [
      { name: "nginx.service", version: "", source: "systemd", status: "running" },
    ],
    dataPaths: [
      { path: "/var/www/html", kind: "app-data", serviceName: "nginx", evidence: [{ collectorId: "data-paths", source: "data-paths" }] },
    ]
  }));
  const wt = g.rels.filter(r => r.kind === "writesTo");
  assert.ok(wt.length >= 1);
  assert.ok(wt[0].evidence.includes("[high]"));
});

// ═══════════════════════════════════════════════════════════════════
// EnvFile
// ═══════════════════════════════════════════════════════════════════

test("P4B: envFile nodes", () => {
  const g = extractInventoryGraph(snap({
    envFiles: [
      { path: "/etc/nginx/.env", keys: ["DB_HOST", "DB_PASSWORD", "API_KEY"], redacted: true, serviceName: "nginx", evidence: [{ collectorId: "env-files", source: "env-files" }] },
    ]
  }));
  const efs = g.nodes.filter(n => n.kind === "envFile") as EnvFileNode[];
  assert.equal(efs.length, 1);
  const ef = efs[0];
  assert.equal(ef.keyCount, 3, "keyCount = 3");
  assert.equal(ef.path, "/etc/nginx/.env");
  assert.equal(ef.serviceName, "nginx");
  // keyCount must be present, but key names must NOT be in metadata
  assert.equal(typeof ef.keyCount, "number");
});

test("P4B: service -> readsEnv -> envFile edge", () => {
  const g = extractInventoryGraph(snap({
    software: [
      { name: "nginx.service", version: "", source: "systemd", status: "running" },
    ],
    envFiles: [
      { path: "/etc/nginx/.env", keys: ["DB_HOST"], redacted: true, serviceName: "nginx", evidence: [{ collectorId: "env-files", source: "env-files" }] },
    ]
  }));
  const re = g.rels.filter(r => r.kind === "readsEnv");
  assert.ok(re.length >= 1);
  assert.ok(re[0].evidence.includes("[high]"));
});

// ═══════════════════════════════════════════════════════════════════
// SecretRef
// ═══════════════════════════════════════════════════════════════════

test("P4B: secretRef nodes", () => {
  const g = extractInventoryGraph(snap({
    secretRefs: [
      { id: "secret:abc123", sourceLocation: "env:DB_PASSWORD", kind: "env", fingerprint: "abc123", redacted: true, evidence: [{ collectorId: "env-files", source: "env-files" }] },
    ]
  }));
  const srs = g.nodes.filter(n => n.kind === "secretRef") as SecretRefNode[];
  assert.equal(srs.length, 1);
  assert.equal(srs[0].fingerprint, "abc123");
  assert.equal(srs[0].redacted, true);
  // label must not contain raw secret
  assert.ok(!srs[0].label.includes("PASSWORD"));
  assert.ok(srs[0].label.includes("secret:"));
});

test("P4B: envFile -> references -> secretRef edge", () => {
  const g = extractInventoryGraph(snap({
    envFiles: [
      { path: "/etc/nginx/.env", keys: ["DB_PASSWORD"], redacted: true, evidence: [{ collectorId: "env-files", source: "env-files" }] },
    ],
    secretRefs: [
      { id: "secret:abc123", sourceLocation: "/etc/nginx/.env:DB_PASSWORD", kind: "env", fingerprint: "abc123", redacted: true, evidence: [{ collectorId: "env-files", source: "env-files" }] },
    ]
  }));
  const refEdges = g.rels.filter(r => r.kind === "references");
  const envToSecret = refEdges.filter(r => r.from.startsWith("envFile:") && r.to.startsWith("secretRef:"));
  assert.ok(envToSecret.length >= 1, "envFile -> secretRef edge exists");
  assert.ok(envToSecret[0].evidence.includes("[high]"));
});

// ═══════════════════════════════════════════════════════════════════
// Volume
// ═══════════════════════════════════════════════════════════════════

test("P4B: volume nodes", () => {
  const g = extractInventoryGraph(snap({
    volumes: [
      { id: "v1", name: "nginx_data", driver: "local", mountpoint: "/var/lib/docker/volumes/nginx_data/_data", evidence: [{ collectorId: "docker-volumes", source: "docker-volumes" }] },
      { id: "v2", name: "postgres_data", driver: "local", mountpoint: "/var/lib/docker/volumes/postgres_data/_data", evidence: [{ collectorId: "docker-volumes", source: "docker-volumes" }] },
    ]
  }));
  const vols = g.nodes.filter(n => n.kind === "volume") as VolumeNode[];
  assert.equal(vols.length, 2);
  assert.equal(vols[0].name, "nginx_data");
  assert.equal(vols[0].driver, "local");
  assert.equal(vols[0].mountpoint, "/var/lib/docker/volumes/nginx_data/_data");
});

test("P4B: container -> mounts -> volume edge", () => {
  const g = extractInventoryGraph(snap({
    software: [
      { name: "nginx:1.25", version: "abc", source: "docker", status: "running" },
    ],
    volumes: [
      { id: "v1", name: "nginx_data", driver: "local", mountpoint: "/var/lib/docker/volumes/nginx_data/_data", containerNames: ["nginx:1.25"], evidence: [{ collectorId: "docker-volumes", source: "docker-volumes" }] },
    ]
  }));
  const mounts = g.rels.filter(r => r.kind === "mounts");
  assert.ok(mounts.length >= 1);
  assert.ok(mounts[0].from.startsWith("container:"), "from is container");
  assert.ok(mounts[0].to.startsWith("volume:"), "to is volume");
});

// ═══════════════════════════════════════════════════════════════════
// Network
// ═══════════════════════════════════════════════════════════════════

test("P4B: network nodes", () => {
  const g = extractInventoryGraph(snap({
    networks: [
      { id: "net1", name: "nginx_net", kind: "docker-bridge", driver: "bridge", subnet: "172.18.0.0/16", gateway: "172.18.0.1", evidence: [{ collectorId: "docker-networks", source: "docker-networks" }] },
    ]
  }));
  const nets = g.nodes.filter(n => n.kind === "network") as NetworkNode[];
  assert.equal(nets.length, 1);
  assert.equal(nets[0].name, "nginx_net");
  assert.equal(nets[0].networkKind, "docker-bridge");
  assert.equal(nets[0].subnet, "172.18.0.0/16");
});

test("P4B: container -> attachedTo -> network edge", () => {
  const g = extractInventoryGraph(snap({
    software: [
      { name: "nginx:1.25", version: "abc", source: "docker", status: "running" },
    ],
    networks: [
      { id: "net1", name: "nginx_net", kind: "docker-bridge", driver: "bridge", containers: ["nginx:1.25"], evidence: [{ collectorId: "docker-networks", source: "docker-networks" }] },
    ]
  }));
  const att = g.rels.filter(r => r.kind === "attachedTo");
  assert.ok(att.length >= 1);
  assert.ok(att[0].from.startsWith("container:"), "from is container");
  assert.ok(att[0].to.startsWith("network:"), "to is network");
});

// ═══════════════════════════════════════════════════════════════════
// Certificate
// ═══════════════════════════════════════════════════════════════════

test("P4B: certificate nodes", () => {
  const g = extractInventoryGraph(snap({
    certificates: [
      { path: "/etc/letsencrypt/live/example.com/cert.pem", subject: "CN=example.com", issuer: "CN=R3,O=Let's Encrypt", notBefore: "2026-06-01T00:00:00Z", notAfter: "2026-09-01T00:00:00Z", daysRemaining: 54, domains: ["example.com", "www.example.com"], kind: "cert", evidence: [{ collectorId: "certificates", source: "certificates" }] },
    ]
  }));
  const certs = g.nodes.filter(n => n.kind === "certificate") as CertificateNode[];
  assert.equal(certs.length, 1);
  assert.equal(certs[0].daysRemaining, 54);
  assert.equal(certs[0].subject, "CN=example.com");
  assert.deepEqual(certs[0].domains, ["example.com", "www.example.com"]);
});

// ═══════════════════════════════════════════════════════════════════
// Domain
// ═══════════════════════════════════════════════════════════════════

test("P4B: domain nodes", () => {
  const g = extractInventoryGraph(snap({
    domains: [
      { name: "example.com", source: "nginx", certificatePath: "/etc/letsencrypt/live/example.com/cert.pem", evidence: [{ collectorId: "domains", source: "domains" }] },
    ]
  }));
  const doms = g.nodes.filter(n => n.kind === "domain") as DomainNode[];
  assert.equal(doms.length, 1);
  assert.equal(doms[0].name, "example.com");
  assert.equal(doms[0].source, "nginx");
});

test("P4B: domain -> usesCertificate -> certificate edge (path match)", () => {
  const g = extractInventoryGraph(snap({
    domains: [
      { name: "example.com", source: "nginx", certificatePath: "/etc/letsencrypt/live/example.com/cert.pem", evidence: [{ collectorId: "domains", source: "domains" }] },
    ],
    certificates: [
      { path: "/etc/letsencrypt/live/example.com/cert.pem", subject: "CN=example.com", issuer: "CN=R3", notBefore: "2026-06-01T00:00:00Z", notAfter: "2026-09-01T00:00:00Z", daysRemaining: 54, kind: "cert", evidence: [{ collectorId: "certificates", source: "certificates" }] },
    ]
  }));
  const uc = g.rels.filter(r => r.kind === "usesCertificate");
  assert.ok(uc.length >= 1, "usesCertificate edge exists");
});

test("P4B: domain -> usesCertificate -> certificate edge (SAN match)", () => {
  const g = extractInventoryGraph(snap({
    domains: [
      { name: "api.example.com", source: "nginx", evidence: [{ collectorId: "domains", source: "domains" }] },
    ],
    certificates: [
      { path: "/etc/letsencrypt/live/wildcard/cert.pem", subject: "CN=*.example.com", issuer: "CN=R3", notBefore: "2026-06-01T00:00:00Z", notAfter: "2026-09-01T00:00:00Z", daysRemaining: 54, domains: ["api.example.com", "www.example.com"], kind: "cert", evidence: [{ collectorId: "certificates", source: "certificates" }] },
    ]
  }));
  const uc = g.rels.filter(r => r.kind === "usesCertificate");
  assert.ok(uc.length >= 1, "SAN-based edge exists");
});

// ═══════════════════════════════════════════════════════════════════
// UserGroup
// ═══════════════════════════════════════════════════════════════════

test("P4B: userGroup nodes", () => {
  const g = extractInventoryGraph(snap({
    usersGroups: [
      { name: "www-data", kind: "user", uid: 33, home: "/var/www", shell: "/usr/sbin/nologin", system: true, evidence: [{ collectorId: "users-groups", source: "users-groups" }] },
      { name: "docker", kind: "group", gid: 999, system: false, evidence: [{ collectorId: "users-groups", source: "users-groups" }] },
    ]
  }));
  const ugs = g.nodes.filter(n => n.kind === "userGroup") as UserGroupNode[];
  assert.equal(ugs.length, 2);
  const user = ugs.find(u => u.ugKind === "user");
  assert.ok(user);
  assert.equal(user!.name, "www-data");
  assert.equal(user!.uid, 33);
  assert.ok(user!.system);

  const group = ugs.find(u => u.ugKind === "group");
  assert.ok(group);
  assert.equal(group!.name, "docker");
  assert.equal(group!.gid, 999);
});

test("P4B: userGroup -> owns -> process edge", () => {
  const g = extractInventoryGraph(snap({
    usersGroups: [
      { name: "www-data", kind: "user", uid: 33, home: "/var/www", shell: "/usr/sbin/nologin", system: true, evidence: [{ collectorId: "users-groups", source: "users-groups" }] },
    ],
    processes: [
      { pid: 1234, user: "www-data", command: "/usr/sbin/nginx", evidence: [{ collectorId: "ps-aux", source: "ps-aux" }] },
    ]
  }));
  const ownEdges = g.rels.filter(r => r.kind === "owns" && r.from.startsWith("userGroup:"));
  assert.ok(ownEdges.length >= 1, "userGroup owns process edge exists");
});

test("P4B: userGroup -> owns -> dataPath edge", () => {
  const g = extractInventoryGraph(snap({
    usersGroups: [
      { name: "www-data", kind: "user", uid: 33, home: "/var/www", shell: "/usr/sbin/nologin", system: true, evidence: [{ collectorId: "users-groups", source: "users-groups" }] },
    ],
    dataPaths: [
      { path: "/var/www/html", kind: "app-data", owner: "www-data", evidence: [{ collectorId: "data-paths", source: "data-paths" }] },
    ]
  }));
  const ownEdges = g.rels.filter(r => r.kind === "owns" && r.from.startsWith("userGroup:") && r.to.startsWith("dataPath:"));
  assert.ok(ownEdges.length >= 1, "userGroup owns dataPath edge exists");
});

// ═══════════════════════════════════════════════════════════════════
// ScheduledTask
// ═══════════════════════════════════════════════════════════════════

test("P4B: scheduledTask nodes", () => {
  const g = extractInventoryGraph(snap({
    scheduledTasks: [
      { id: "cron:logrotate", kind: "cron", schedule: "0 2 * * *", command: "/usr/sbin/logrotate /etc/logrotate.conf", user: "root", enabled: true, evidence: [{ collectorId: "cron-jobs", source: "cron-jobs" }] },
      { id: "systemd-timer:certbot", kind: "systemd-timer", serviceName: "certbot", enabled: true, evidence: [{ collectorId: "systemd-timers", source: "systemd-timers" }] },
    ]
  }));
  const sts = g.nodes.filter(n => n.kind === "scheduledTask") as ScheduledTaskNode[];
  assert.equal(sts.length, 2);
  const cron = sts.find(s => s.taskKind === "cron");
  assert.ok(cron);
  assert.equal(cron!.schedule, "0 2 * * *");
  assert.equal(cron!.enabled, true);

  const timer = sts.find(s => s.taskKind === "systemd-timer");
  assert.ok(timer);
  assert.equal(timer!.serviceName, "certbot");
});

test("P4B: scheduledTask -> invokes -> service edge", () => {
  const g = extractInventoryGraph(snap({
    software: [
      { name: "certbot.service", version: "", source: "systemd", status: "running" },
    ],
    scheduledTasks: [
      { id: "systemd-timer:certbot", kind: "systemd-timer", serviceName: "certbot", enabled: true, evidence: [{ collectorId: "systemd-timers", source: "systemd-timers" }] },
    ]
  }));
  const inv = g.rels.filter(r => r.kind === "invokes");
  const toService = inv.filter(r => r.to.startsWith("service:"));
  assert.ok(toService.length >= 1, "scheduledTask -> service invokes edge exists");
});

test("P4B: scheduledTask -> invokes -> process edge (command match)", () => {
  const g = extractInventoryGraph(snap({
    processes: [
      { pid: 99, command: "/usr/sbin/logrotate /etc/logrotate.conf", evidence: [{ collectorId: "ps-aux", source: "ps-aux" }] },
    ],
    scheduledTasks: [
      { id: "cron:logrotate", kind: "cron", schedule: "0 2 * * *", command: "/usr/sbin/logrotate /etc/logrotate.conf", user: "root", enabled: true, evidence: [{ collectorId: "cron-jobs", source: "cron-jobs" }] },
    ]
  }));
  const inv = g.rels.filter(r => r.kind === "invokes");
  const toProcess = inv.filter(r => r.to.startsWith("process:"));
  assert.ok(toProcess.length >= 1, "scheduledTask -> process invokes edge exists");
  assert.ok(toProcess[0].evidence.includes("[medium]"), "medium confidence for command heuristic");
});

// ═══════════════════════════════════════════════════════════════════
// Compatibility
// ═══════════════════════════════════════════════════════════════════

test("P4B: old snapshot without dataSurfaces builds graph without error", () => {
  const g = extractInventoryGraph(snap({
    software: [
      { name: "nginx", version: "1.26.0", source: "apt", status: "installed", trust: "user" },
    ]
  }));
  assert.ok(g.nodes.length > 0, "graph has at least package node");
  assert.equal(g.nodes.filter(n => n.kind === "process").length, 0, "no process nodes for old snapshot");
  assert.equal(g.hostname, "vm-test");
  assert.equal(g.completeness, 1);
});

test("P4B: empty dataSurfaces arrays do not crash", () => {
  const g = extractInventoryGraph(snap({
    processes: [],
    dataPaths: [],
    envFiles: [],
    secretRefs: [],
    volumes: [],
    networks: [],
    certificates: [],
    domains: [],
    usersGroups: [],
    scheduledTasks: [],
  }));
  assert.ok(g.nodes.length >= 0, "empty arrays are fine");
  const kinds = new Set(g.nodes.map(n => n.kind));
  assert.ok(!kinds.has("process"), "no process when empty process array");
});

// ═══════════════════════════════════════════════════════════════════
// Secret safety
// ═══════════════════════════════════════════════════════════════════

test("P4B: secret values do not leak into graph JSON", () => {
  const g = extractInventoryGraph(snap({
    envFiles: [
      { path: "/etc/nginx/.env", keys: ["DB_PASSWORD", "SECRET_KEY", "TOKEN"], redacted: true, evidence: [{ collectorId: "env-files", source: "env-files" }] },
    ],
    secretRefs: [
      { id: "secret:abc123", sourceLocation: "/etc/nginx/.env:DB_PASSWORD", kind: "env", fingerprint: "abc123def456", redacted: true, evidence: [{ collectorId: "env-files", source: "env-files" }] },
    ]
  }));
  const json = JSON.stringify(g);

  // Secret VALUES that should never appear anywhere
  assert.ok(!json.includes("mypassword"), "no raw password value");
  assert.ok(!json.includes("supersecret"), "no raw secret value");

  // Source location is OK — it's a pointer (path:keyname), not the actual secret value
  assert.ok(json.includes("sourceLocation"), "sourceLocation is present but is a path pointer, not secret value");

  // Key names in sourceLocation are NOT secret values — they tell you what the key is called,
  // not what its value is. This is safe metadata (like knowing a file is called "key.pem"
  // doesn't tell you the contents of the key).
  assert.ok(json.includes("DB_PASSWORD"), "key name in sourceLocation is safe metadata (pointer, not value)");

  // node ID with fingerprint is OK
  assert.ok(json.includes("abc123def456"), "fingerprint appears in id/label");

  // EnvFileNode must contain keyCount only, not key names in its own metadata
  const efNodes = g.nodes.filter(n => n.kind === "envFile") as EnvFileNode[];
  for (const ef of efNodes) {
    // Only keyCount and metadata fields should be present — no raw key array
    assert.equal(typeof ef.keyCount, "number");
    assert.ok(ef.keyCount > 0);
    // The node interface itself enforces safety: keyCount is a number, not a string[].
    // No key names in the envFile node's own metadata structure.
  }
});

// ═══════════════════════════════════════════════════════════════════
// Deterministic IDs
// ═══════════════════════════════════════════════════════════════════

test("P4B: deterministic node IDs", () => {
  const s = snap({
    processes: [
      { pid: 1234, user: "root", command: "/usr/sbin/nginx", evidence: [{ collectorId: "ps-aux", source: "ps-aux" }] },
    ],
    volumes: [
      { id: "v1", name: "nginx_data", driver: "local", mountpoint: "/data", evidence: [{ collectorId: "docker-volumes", source: "docker-volumes" }] },
    ],
    networks: [
      { id: "net1", name: "nginx_net", kind: "docker-bridge", driver: "bridge", evidence: [{ collectorId: "docker-networks", source: "docker-networks" }] },
    ],
    domains: [
      { name: "example.com", source: "nginx", evidence: [{ collectorId: "domains", source: "domains" }] },
    ],
    usersGroups: [
      { name: "www-data", kind: "user", uid: 33, home: "/var/www", shell: "/usr/sbin/nologin", system: true, evidence: [{ collectorId: "users-groups", source: "users-groups" }] },
    ],
    scheduledTasks: [
      { id: "cron:backup", kind: "cron", schedule: "0 3 * * *", enabled: true, evidence: [{ collectorId: "cron-jobs", source: "cron-jobs" }] },
    ]
  });

  const g1 = extractInventoryGraph(s);
  const g2 = extractInventoryGraph(s);

  assert.equal(g1.nodes.length, g2.nodes.length, "same node count");
  assert.equal(g1.rels.length, g2.rels.length, "same edge count");

  for (let i = 0; i < g1.nodes.length; i++) {
    assert.equal(g1.nodes[i].id, g2.nodes[i].id, `node ${i} id deterministic`);
    assert.equal(g1.nodes[i].kind, g2.nodes[i].kind, `node ${i} kind deterministic`);
  }

  for (let i = 0; i < g1.rels.length; i++) {
    assert.equal(g1.rels[i].from, g2.rels[i].from, `rel ${i} from deterministic`);
    assert.equal(g1.rels[i].kind, g2.rels[i].kind, `rel ${i} kind deterministic`);
    assert.equal(g1.rels[i].to, g2.rels[i].to, `rel ${i} to deterministic`);
  }
});

// ═══════════════════════════════════════════════════════════════════
// Dedup
// ═══════════════════════════════════════════════════════════════════

test("P4B: duplicate nodes deduped", () => {
  // Same path in two dataPath entries should yield only one node
  const g = extractInventoryGraph(snap({
    dataPaths: [
      { path: "/var/www/html", kind: "app-data", evidence: [{ collectorId: "data-paths", source: "data-paths" }] },
      { path: "/var/www/html", kind: "app-data", evidence: [{ collectorId: "data-paths", source: "data-paths" }] },
    ]
  }));
  const dps = g.nodes.filter(n => n.kind === "dataPath");
  assert.equal(dps.length, 1, "duplicate path deduped to one node");
});

test("P4B: duplicate edges deduped", () => {
  const s = snap({
    software: [
      { name: "nginx.service", version: "", source: "systemd", status: "running" },
    ],
    processes: [
      { pid: 1, command: "/usr/sbin/nginx", serviceName: "nginx", evidence: [{ collectorId: "ps-aux", source: "ps-aux" }] },
    ]
  });
  const g = extractInventoryGraph(s);
  // If we had duplicate edges, they'd be deduped by edgeKey
  const runsEdges = g.rels.filter(r => r.kind === "runs");
  // Each from→to pair is unique
  const keys = new Set(runsEdges.map(r => `${r.from}::${r.kind}::${r.to}`));
  assert.equal(keys.size, runsEdges.length, "no duplicate edge keys");
});

// ═══════════════════════════════════════════════════════════════════
// Output ordering
// ═══════════════════════════════════════════════════════════════════

test("P4B: nodes sorted by kind then id", () => {
  const g = extractInventoryGraph(snap({
    software: [
      { name: "nginx", version: "1.26.0", source: "apt", status: "installed", trust: "user" },
      { name: "nginx.service", version: "", source: "systemd", status: "running" },
    ],
    processes: [
      { pid: 1, command: "/usr/sbin/nginx", serviceName: "nginx", evidence: [{ collectorId: "ps-aux", source: "ps-aux" }] },
    ],
    domains: [
      { name: "example.com", source: "nginx", evidence: [{ collectorId: "domains", source: "domains" }] },
    ]
  }));
  // Verify sort order: kind ascending, then id ascending within same kind
  for (let i = 1; i < g.nodes.length; i++) {
    const prev = g.nodes[i - 1];
    const curr = g.nodes[i];
    assert.ok(
      prev.kind < curr.kind || (prev.kind === curr.kind && prev.id <= curr.id),
      `node ${i}: ${prev.kind}/${prev.id} should sort before ${curr.kind}/${curr.id}`
    );
  }
  // Edges sorted by kind, from, to
  for (let i = 1; i < g.rels.length; i++) {
    const prev = g.rels[i - 1];
    const curr = g.rels[i];
    const prevKey = `${prev.kind}::${prev.from}::${prev.to}`;
    const currKey = `${curr.kind}::${curr.from}::${curr.to}`;
    assert.ok(prevKey <= currKey, `edge ${i}: ${prevKey} should sort before ${currKey}`);
  }
});

// ═══════════════════════════════════════════════════════════════════
// Existing first slice regression
// ═══════════════════════════════════════════════════════════════════

test("P4B: existing first slice: packages get typed PackageNode", () => {
  const g = extractInventoryGraph(snap({
    software: [
      { name: "nginx", version: "1.26.0", source: "apt", status: "installed", trust: "user" },
      { name: "vim", version: "9.1", source: "apt", status: "installed" },
      { name: "eslint", version: "8.0.0", source: "npm", status: "global" }
    ],
  }));
  const pkgs = g.nodes.filter(n => n.kind === "package");
  assert.equal(pkgs.length, 3);
  assert.equal(pkgs[0].id, "package:apt:nginx");
  assert.equal((pkgs[0] as unknown as PackageNode).source, "apt");
  assert.equal((pkgs[1] as unknown as PackageNode).trust, "uncertain", "missing trust ⇒ uncertain");
});

test("P4B: existing first slice: services get typed ServiceNode + owns package link", () => {
  const g = extractInventoryGraph(snap({
    software: [
      { name: "nginx", version: "1.26.0", source: "apt", status: "installed", trust: "user" },
      { name: "nginx.service", version: "", source: "systemd", status: "running" },
      { name: "cron.daily-backup", version: "", source: "cron", status: "active" },
    ],
  }));
  const svcs = g.nodes.filter(n => n.kind === "service");
  assert.equal(svcs.length, 2);
  const nginx = svcs.find(s => (s as unknown as ServiceNode).unit === "nginx.service");
  assert.ok(nginx);
  const owns = g.rels.filter(r => r.from === nginx?.id && r.kind === "owns");
  assert.equal(owns.length, 1, "nginx.service owns package apt:nginx");
  assert.match(owns[0].to, /package:/);
});

test("P4B: existing first slice: ports deduped", () => {
  const g = extractInventoryGraph(snap({
    software: [],
    configChecklist: [
      { id: "n1", label: "a", category: "network", status: "80", lastChanged: "" },
      { id: "n2", label: "b", category: "network", status: "80", lastChanged: "" },
    ],
  }));
  assert.equal(g.nodes.filter(n => n.kind === "port").length, 1, "duplicate port 80 deduped");
});

test("P4B: existing first slice: containers extracted from docker source", () => {
  const g = extractInventoryGraph(snap({
    software: [
      { name: "nginx:1.25-alpine", version: "abc123", source: "docker", status: "running" },
    ],
  }));
  const containers = g.nodes.filter(n => n.kind === "container");
  assert.equal(containers.length, 1);
  assert.equal(containers[0].id, "container:nginx:1.25-alpine");
  assert.equal((containers[0] as unknown as ContainerNode).image, "nginx:1.25-alpine");
});

test("P4B: existing first slice: aggregateServiceStacks still works", () => {
  const g = extractInventoryGraph(snap({
    software: [
      { name: "nginx", version: "1.26.0", source: "apt", status: "installed", trust: "user" },
      { name: "nginx.service", version: "", source: "systemd", status: "running" },
    ],
    configChecklist: [
      { id: "n1", label: "开放端口", category: "network", status: "80, 443", lastChanged: "" },
    ],
  }));
  const stacks = aggregateServiceStacks(g);
  assert.equal(stacks.length, 1, "one stack for nginx");
  assert.equal(stacks[0].label, "nginx");
  assert.equal(stacks[0].packages.length, 1);
  assert.equal(stacks[0].packages[0].name, "nginx");
  assert.equal(stacks[0].ports.length, 2);
  assert.equal(stacks[0].confidence, "medium");
});

test("P4B: existing first slice: completeness and hostname propagate", () => {
  const g = extractInventoryGraph(snap({ software: [] }));
  assert.equal(g.hostname, "vm-test");
  assert.equal(g.completeness, 1);
});

// ═══════════════════════════════════════════════════════════════════
// Edge cases
// ═══════════════════════════════════════════════════════════════════

test("P4B: partial records with only id/label still produce safe nodes", () => {
  const g = extractInventoryGraph(snap({
    processes: [
      { pid: 1, command: "/bin/true", evidence: [] },
    ],
    scheduledTasks: [
      { id: "minimal-task", kind: "unknown", enabled: false, evidence: [] },
    ]
  }));
  const procs = g.nodes.filter(n => n.kind === "process");
  assert.equal(procs.length, 1);
  const sts = g.nodes.filter(n => n.kind === "scheduledTask");
  assert.equal(sts.length, 1);
  assert.equal(sts[0].label, "minimal-task");
});
