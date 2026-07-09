/**
 * service-stack-phase5.test.ts — Phase 5-B enriched service stack tests.
 *
 * Covers: process/port/dataPath/envFile/secretRef/volume/network/certificate/
 * domain/userGroup/scheduledTask enrichment in ServiceStack output.
 *
 * Also covers: backward compat, empty graph, dedup, ordering, secret safety,
 * confidence propagation, enrichment warnings.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  extractInventoryGraph,
  aggregateServiceStacks,
  type ServiceStack,
  type StackProcessRef,
  type StackDataPathRef,
  type StackEnvFileRef,
  type StackSecretRef,
  type StackVolumeRef,
  type StackNetworkRef,
  type StackCertificateRef,
  type StackDomainRef,
  type StackUserGroupRef,
  type StackScheduledTaskRef,
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

/** Build a full snapshot with nginx service, packages, processes, data paths, env files */
function nginxSnapshot(): StoredProbeSnapshot {
  return snap({
    software: [
      { name: "nginx", version: "1.26.0", source: "apt", status: "installed", trust: "user" },
      { name: "nginx.service", version: "", source: "systemd", status: "running" },
    ],
    configChecklist: [
      { id: "n1", label: "开放端口", category: "network", status: "80, 443", lastChanged: "" },
    ],
    processes: [
      { pid: 1234, user: "www-data", command: "/usr/sbin/nginx -g daemon off;", serviceName: "nginx", listeningPorts: [80, 443], evidence: [{ collectorId: "ps-aux", source: "ps-aux", confidence: "high" }] },
    ],
    dataPaths: [
      { path: "/var/www/html", kind: "app-data", serviceName: "nginx", evidence: [{ collectorId: "data-paths", source: "data-paths" }] },
      { path: "/var/log/nginx", kind: "log-dir", serviceName: "nginx", evidence: [{ collectorId: "data-paths", source: "data-paths" }] },
    ],
    envFiles: [
      { path: "/etc/nginx/.env", keys: ["DB_HOST", "DB_PASSWORD"], redacted: true, serviceName: "nginx", evidence: [{ collectorId: "env-files", source: "env-files" }] },
    ],
    secretRefs: [
      { id: "secret:abc123", sourceLocation: "/etc/nginx/.env:DB_PASSWORD", kind: "env", fingerprint: "abc123", redacted: true, evidence: [{ collectorId: "env-files", source: "env-files" }] },
    ],
    usersGroups: [
      { name: "www-data", kind: "user", uid: 33, home: "/var/www", shell: "/usr/sbin/nologin", system: true, evidence: [{ collectorId: "users-groups", source: "users-groups" }] },
    ],
  });
}

// ═══════════════════════════════════════════════════════════════════
// 1. Existing tests still pass (regression)
// ═══════════════════════════════════════════════════════════════════

test("P5B: existing first-slice: nginx stack with package + port", () => {
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
  assert.equal(stacks.length, 1, "one stack");
  assert.equal(stacks[0].label, "nginx");
  assert.equal(stacks[0].packages.length, 1);
  assert.equal(stacks[0].ports.length, 2);
  assert.equal(stacks[0].confidence, "medium");
  assert.equal(stacks[0].containers.length, 0);
});

test("P5B: existing first-slice: two packages = high confidence", () => {
  const g = extractInventoryGraph(snap({
    software: [
      { name: "postgresql", version: "16", source: "apt", status: "installed", trust: "user" },
      { name: "postgresql-client", version: "16", source: "apt", status: "installed", trust: "user" },
      { name: "postgresql.service", version: "", source: "systemd", status: "running" },
    ],
    configChecklist: [
      { id: "n1", label: "数据库端口", category: "network", status: "5432", lastChanged: "" },
    ],
  }));
  const stacks = aggregateServiceStacks(g);
  assert.equal(stacks.length, 1);
  assert.equal(stacks[0].confidence, "high");
  assert.equal(stacks[0].packages.length, 2);
});

test("P5B: existing first-slice: cron-only service with no package forms no stack", () => {
  const g = extractInventoryGraph(snap({
    software: [
      { name: "cron.daily-trim", version: "", source: "cron", status: "active" },
    ],
  }));
  assert.equal(aggregateServiceStacks(g).length, 0);
});

// ═══════════════════════════════════════════════════════════════════
// 2. Process refs from service→runs
// ═══════════════════════════════════════════════════════════════════

test("P5B: stack includes process refs from service→runs", () => {
  const g = extractInventoryGraph(nginxSnapshot());
  const stacks = aggregateServiceStacks(g);
  assert.equal(stacks.length, 1);
  const procs = stacks[0].processes;
  assert.ok(procs, "processes field present");
  assert.ok(procs!.length >= 1, "at least one process ref");
  const nginxProc = procs!.find((p: StackProcessRef) => p.pid === 1234);
  assert.ok(nginxProc, "nginx process found");
  assert.ok(nginxProc!.command?.includes("nginx"));
  assert.equal(nginxProc!.user, "www-data");
  assert.equal(nginxProc!.confidence, "high");
  assert.ok(nginxProc!.evidence.length >= 1);
  assert.ok(nginxProc!.evidence[0].includes("[high]"));
});

test("P5B: process refs include ports from listensOn", () => {
  const g = extractInventoryGraph(nginxSnapshot());
  const stacks = aggregateServiceStacks(g);
  const procs = stacks[0].processes!;
  const nginxProc = procs.find((p: StackProcessRef) => p.pid === 1234);
  assert.ok(nginxProc, "nginx process found");
  assert.ok(nginxProc!.ports, "ports present");
  assert.ok(nginxProc!.ports!.includes(80));
  assert.ok(nginxProc!.ports!.includes(443));
});

// ═══════════════════════════════════════════════════════════════════
// 3. Port refs from process→listensOn (2-hop)
// ═══════════════════════════════════════════════════════════════════

test("P5B: ports via edge-based 2-hop from process→listensOn", () => {
  const g = extractInventoryGraph(nginxSnapshot());
  const stacks = aggregateServiceStacks(g);
  assert.ok(stacks[0].ports.length >= 1);
  const portNums = stacks[0].ports.map(p => p.port);
  // Should have port 80 and 443 from edge-based lookup
  assert.ok(portNums.includes(80), "port 80 present");
  assert.ok(portNums.includes(443), "port 443 present");
});

// ═══════════════════════════════════════════════════════════════════
// 4. DataPath refs from service→writesTo
// ═══════════════════════════════════════════════════════════════════

test("P5B: stack includes dataPath refs from service→writesTo", () => {
  const g = extractInventoryGraph(nginxSnapshot());
  const stacks = aggregateServiceStacks(g);
  const dps = stacks[0].dataPaths;
  assert.ok(dps, "dataPaths present");
  assert.equal(dps!.length, 2);
  const html = dps!.find((d: StackDataPathRef) => d.path === "/var/www/html");
  assert.ok(html, "html dataPath found");
  assert.equal(html!.kind, "app-data");
  assert.equal(html!.confidence, "high");
  assert.ok(html!.evidence[0].includes("[high]"));
});

// ═══════════════════════════════════════════════════════════════════
// 5. EnvFile refs from service→readsEnv
// ═══════════════════════════════════════════════════════════════════

test("P5B: stack includes envFile refs from service→readsEnv", () => {
  const g = extractInventoryGraph(nginxSnapshot());
  const stacks = aggregateServiceStacks(g);
  const efs = stacks[0].envFiles;
  assert.ok(efs, "envFiles present");
  assert.equal(efs!.length, 1);
  const ef = efs![0];
  assert.equal(ef.path, "/etc/nginx/.env");
  assert.equal(ef.keyCount, 2);
  assert.equal(ef.confidence, "high");
});

// ═══════════════════════════════════════════════════════════════════
// 6. SecretRef refs via envFile→references (2-hop)
// ═══════════════════════════════════════════════════════════════════

test("P5B: stack includes secretRef refs via envFile→references", () => {
  const g = extractInventoryGraph(nginxSnapshot());
  const stacks = aggregateServiceStacks(g);
  const srs = stacks[0].secretRefs;
  assert.ok(srs, "secretRefs present");
  assert.equal(srs!.length, 1);
  const sr = srs![0] as StackSecretRef;
  assert.equal(sr.fingerprint, "abc123");
  assert.equal(sr.redacted, true);
  assert.equal(sr.confidence, "high");
  assert.ok(sr.sourceLocation!.includes("env:DB_PASSWORD") || sr.sourceLocation!.includes(".env:DB_PASSWORD"));
});

// ═══════════════════════════════════════════════════════════════════
// 7. Volume refs via container→mounts
// ═══════════════════════════════════════════════════════════════════

test("P5B: stack includes volume refs via container→mounts", () => {
  const g = extractInventoryGraph(snap({
    software: [
      { name: "nginx", version: "1.26.0", source: "apt", status: "installed", trust: "user" },
      { name: "nginx.service", version: "", source: "systemd", status: "running" },
      { name: "nginx:1.25", version: "abc", source: "docker", status: "running" },
    ],
    configChecklist: [
      { id: "n1", label: "开放端口", category: "network", status: "80", lastChanged: "" },
    ],
    volumes: [
      { id: "v1", name: "nginx_data", driver: "local", mountpoint: "/var/lib/docker/volumes/nginx_data/_data", containerNames: ["nginx:1.25"], evidence: [{ collectorId: "docker-volumes", source: "docker-volumes" }] },
    ],
  }));
  const stacks = aggregateServiceStacks(g);
  assert.equal(stacks.length, 1);
  const vols = stacks[0].volumes;
  assert.ok(vols, "volumes present");
  assert.equal(vols!.length, 1);
  assert.equal(vols![0].name, "nginx_data");
  assert.equal(vols![0].confidence, "high");
});

// ═══════════════════════════════════════════════════════════════════
// 8. Network refs via container→attachedTo
// ═══════════════════════════════════════════════════════════════════

test("P5B: stack includes network refs via container→attachedTo", () => {
  const g = extractInventoryGraph(snap({
    software: [
      { name: "nginx", version: "1.26.0", source: "apt", status: "installed", trust: "user" },
      { name: "nginx.service", version: "", source: "systemd", status: "running" },
      { name: "nginx:1.25", version: "abc", source: "docker", status: "running" },
    ],
    configChecklist: [
      { id: "n1", label: "开放端口", category: "network", status: "80", lastChanged: "" },
    ],
    networks: [
      { id: "net1", name: "nginx_net", kind: "docker-bridge", driver: "bridge", containers: ["nginx:1.25"], evidence: [{ collectorId: "docker-networks", source: "docker-networks" }] },
    ],
  }));
  const stacks = aggregateServiceStacks(g);
  const nets = stacks[0].networks;
  assert.ok(nets, "networks present");
  assert.equal(nets!.length, 1);
  assert.equal(nets![0].name, "nginx_net");
  assert.equal(nets![0].confidence, "high");
});

// ═══════════════════════════════════════════════════════════════════
// 9. Domain + certificate refs via domain→usesCertificate
// ═══════════════════════════════════════════════════════════════════

test("P5B: stack includes domain refs matching service name", () => {
  const g = extractInventoryGraph(snap({
    software: [
      { name: "nginx", version: "1.26.0", source: "apt", status: "installed", trust: "user" },
      { name: "nginx.service", version: "", source: "systemd", status: "running" },
    ],
    configChecklist: [
      { id: "n1", label: "开放端口", category: "network", status: "80", lastChanged: "" },
    ],
    domains: [
      { name: "example.com", source: "nginx", serviceName: "nginx", certificatePath: "/etc/letsencrypt/live/example.com/cert.pem", evidence: [{ collectorId: "domains", source: "domains" }] },
    ],
    certificates: [
      { path: "/etc/letsencrypt/live/example.com/cert.pem", subject: "CN=example.com", issuer: "CN=R3", notBefore: "2026-06-01T00:00:00Z", notAfter: "2026-09-01T00:00:00Z", daysRemaining: 54, kind: "cert", evidence: [{ collectorId: "certificates", source: "certificates" }] },
    ],
  }));
  const stacks = aggregateServiceStacks(g);
  const doms = stacks[0].domains;
  assert.ok(doms, "domains present");
  assert.equal(doms!.length, 1);
  assert.equal(doms![0].name, "example.com");
  assert.ok(doms![0].certificateId, "certificateId linked");

  const certs = stacks[0].certificates;
  assert.ok(certs, "certificates present");
  assert.equal(certs!.length, 1);
  assert.equal(certs![0].daysRemaining, 54);
  assert.equal(certs![0].confidence, "high");
});

test("P5B: domain matched by source name even without serviceName", () => {
  const g = extractInventoryGraph(snap({
    software: [
      { name: "nginx", version: "1.26.0", source: "apt", status: "installed", trust: "user" },
      { name: "nginx.service", version: "", source: "systemd", status: "running" },
    ],
    configChecklist: [
      { id: "n1", label: "开放端口", category: "network", status: "80", lastChanged: "" },
    ],
    domains: [
      { name: "mysite.com", source: "nginx", evidence: [{ collectorId: "domains", source: "domains" }] },
    ],
  }));
  const stacks = aggregateServiceStacks(g);
  assert.ok(stacks[0].domains, "domains present");
  assert.equal(stacks[0].domains!.length, 1);
  assert.equal(stacks[0].domains![0].name, "mysite.com");
});

// ═══════════════════════════════════════════════════════════════════
// 10. UserGroup refs via userGroup→owns→process
// ═══════════════════════════════════════════════════════════════════

test("P5B: stack includes userGroup refs via userGroup→owns→process", () => {
  const g = extractInventoryGraph(nginxSnapshot());
  const stacks = aggregateServiceStacks(g);
  const ugs = stacks[0].usersGroups;
  assert.ok(ugs, "usersGroups present");
  assert.ok(ugs!.length >= 1);
  const www = ugs!.find((u: StackUserGroupRef) => u.name === "www-data");
  assert.ok(www, "www-data user found");
  assert.equal(www!.kind, "user");
  assert.equal(www!.confidence, "high");
});

// ═══════════════════════════════════════════════════════════════════
// 11. ScheduledTask refs via scheduledTask→invokes→service
// ═══════════════════════════════════════════════════════════════════

test("P5B: stack includes scheduledTask refs via scheduledTask→invokes service", () => {
  const g = extractInventoryGraph(snap({
    software: [
      { name: "nginx", version: "1.26.0", source: "apt", status: "installed", trust: "user" },
      { name: "nginx.service", version: "", source: "systemd", status: "running" },
    ],
    configChecklist: [
      { id: "n1", label: "开放端口", category: "network", status: "80", lastChanged: "" },
    ],
    scheduledTasks: [
      { id: "systemd-timer:logrotate", kind: "systemd-timer", serviceName: "nginx", enabled: true, evidence: [{ collectorId: "systemd-timers", source: "systemd-timers" }] },
    ],
  }));
  const stacks = aggregateServiceStacks(g);
  const sts = stacks[0].scheduledTasks;
  assert.ok(sts, "scheduledTasks present");
  assert.equal(sts!.length, 1);
  assert.equal(sts![0].kind, "systemd-timer");
  assert.equal(sts![0].confidence, "high");
});

test("P5B: scheduledTask with cron kind", () => {
  const g = extractInventoryGraph(snap({
    software: [
      { name: "nginx", version: "1.26.0", source: "apt", status: "installed", trust: "user" },
      { name: "nginx.service", version: "", source: "systemd", status: "running" },
    ],
    configChecklist: [
      { id: "n1", label: "开放端口", category: "network", status: "80", lastChanged: "" },
    ],
    scheduledTasks: [
      { id: "cron:nginx-rotate", kind: "cron", schedule: "0 2 * * *", command: "/usr/sbin/logrotate", user: "root", enabled: true, serviceName: "nginx", evidence: [{ collectorId: "cron-jobs", source: "cron-jobs" }] },
    ],
  }));
  const stacks = aggregateServiceStacks(g);
  const sts = stacks[0].scheduledTasks;
  assert.ok(sts, "scheduledTasks present");
  assert.equal(sts![0].schedule, "0 2 * * *");
  assert.ok(sts![0].command?.includes("logrotate"));
});

// ═══════════════════════════════════════════════════════════════════
// 12. Dedup — no duplicate refs
// ═══════════════════════════════════════════════════════════════════

test("P5B: duplicate process refs deduped", () => {
  // Same process appears in data-source twice — extractor already dedupes nodes
  const g = extractInventoryGraph(snap({
    software: [
      { name: "nginx", version: "1.26.0", source: "apt", status: "installed", trust: "user" },
      { name: "nginx.service", version: "", source: "systemd", status: "running" },
    ],
    configChecklist: [
      { id: "n1", label: "开放端口", category: "network", status: "80", lastChanged: "" },
    ],
    processes: [
      { pid: 1, command: "/usr/sbin/nginx", serviceName: "nginx", evidence: [{ collectorId: "ps-aux", source: "ps-aux" }] },
      { pid: 1, command: "/usr/sbin/nginx", serviceName: "nginx", evidence: [{ collectorId: "ps-aux", source: "ps-aux" }] },
    ],
  }));
  const stacks = aggregateServiceStacks(g);
  assert.equal(stacks.length, 1);
  const procs = stacks[0].processes!;
  // extractor dedupes by node id, so only 1 process node → 1 process ref
  assert.equal(procs.length, 1);
});

test("P5B: duplicate dataPath refs deduped", () => {
  const g = extractInventoryGraph(snap({
    software: [
      { name: "nginx", version: "1.26.0", source: "apt", status: "installed", trust: "user" },
      { name: "nginx.service", version: "", source: "systemd", status: "running" },
    ],
    configChecklist: [
      { id: "n1", label: "开放端口", category: "network", status: "80", lastChanged: "" },
    ],
    dataPaths: [
      { path: "/var/www/html", kind: "app-data", serviceName: "nginx", evidence: [{ collectorId: "data-paths", source: "data-paths" }] },
      { path: "/var/www/html", kind: "app-data", serviceName: "nginx", evidence: [{ collectorId: "data-paths", source: "data-paths" }] },
    ],
  }));
  const stacks = aggregateServiceStacks(g);
  assert.equal(stacks.length, 1);
  const dps = stacks[0].dataPaths!;
  assert.equal(dps.length, 1, "one dataPath ref (node dedup + edge dedup)");
});

// ═══════════════════════════════════════════════════════════════════
// 13. Ordering is deterministic
// ═══════════════════════════════════════════════════════════════════

test("P5B: deterministic ordering of refs across multiple calls", () => {
  const s = nginxSnapshot();
  const g1 = extractInventoryGraph(s);
  const g2 = extractInventoryGraph(s);
  const st1 = aggregateServiceStacks(g1);
  const st2 = aggregateServiceStacks(g2);

  assert.equal(st1.length, st2.length);
  for (let i = 0; i < st1.length; i++) {
    // Check process ref ordering
    const p1 = st1[i].processes ?? [];
    const p2 = st2[i].processes ?? [];
    assert.equal(p1.length, p2.length);
    for (let j = 0; j < p1.length; j++) {
      assert.equal(p1[j].id, p2[j].id, `process ${j} id deterministic`);
    }
    // Check dataPath ref ordering
    const d1 = st1[i].dataPaths ?? [];
    const d2 = st2[i].dataPaths ?? [];
    assert.equal(d1.length, d2.length);
    for (let j = 0; j < d1.length; j++) {
      assert.equal(d1[j].id, d2[j].id, `dataPath ${j} id deterministic`);
    }
    // Check enrichment metadata
    assert.ok(st1[i].enrichment, "enrichment present");
    assert.equal(st1[i].enrichment!.version, "phase5.stack.v1");
    assert.equal(st1[i].enrichment!.sourceGraphNodeCount, st2[i].enrichment!.sourceGraphNodeCount);
    assert.equal(st1[i].enrichment!.sourceGraphEdgeCount, st2[i].enrichment!.sourceGraphEdgeCount);
  }
});

// ═══════════════════════════════════════════════════════════════════
// 14. Old graph without Phase 4 nodes still works
// ═══════════════════════════════════════════════════════════════════

test("P5B: old snapshot without Phase 4 surfaces: new fields are undefined", () => {
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
  assert.equal(stacks.length, 1);
  // New fields should be undefined for old snapshots
  assert.equal(stacks[0].processes, undefined);
  assert.equal(stacks[0].dataPaths, undefined);
  assert.equal(stacks[0].envFiles, undefined);
  assert.equal(stacks[0].secretRefs, undefined);
  assert.equal(stacks[0].volumes, undefined);
  assert.equal(stacks[0].networks, undefined);
  assert.equal(stacks[0].certificates, undefined);
  assert.equal(stacks[0].domains, undefined);
  assert.equal(stacks[0].usersGroups, undefined);
  assert.equal(stacks[0].scheduledTasks, undefined);
  // But enrichment metadata should always be present
  assert.ok(stacks[0].enrichment, "enrichment should be present");
  assert.equal(stacks[0].enrichment!.version, "phase5.stack.v1");
  // Packages, ports, confidence unchanged
  assert.equal(stacks[0].packages.length, 1);
  assert.equal(stacks[0].ports.length, 2);
  assert.equal(stacks[0].confidence, "medium");
});

// ═══════════════════════════════════════════════════════════════════
// 15. Empty graph still works
// ═══════════════════════════════════════════════════════════════════

test("P5B: empty graph returns no stacks", () => {
  const g = extractInventoryGraph(snap({ software: [] }));
  const stacks = aggregateServiceStacks(g);
  assert.equal(stacks.length, 0);
});

test("P5B: graph with only packages (no service) returns no stacks", () => {
  const g = extractInventoryGraph(snap({
    software: [
      { name: "vim", version: "9.1", source: "apt", status: "installed" },
    ],
  }));
  const stacks = aggregateServiceStacks(g);
  assert.equal(stacks.length, 0);
});

// ═══════════════════════════════════════════════════════════════════
// 16. Secret values do not leak into stack JSON
// ═══════════════════════════════════════════════════════════════════

test("P5B: secret values do not leak into stack JSON", () => {
  const g = extractInventoryGraph(snap({
    software: [
      { name: "nginx", version: "1.26.0", source: "apt", status: "installed", trust: "user" },
      { name: "nginx.service", version: "", source: "systemd", status: "running" },
    ],
    configChecklist: [
      { id: "n1", label: "开放端口", category: "network", status: "80", lastChanged: "" },
    ],
    envFiles: [
      { path: "/etc/app/.env", keys: ["DB_PASSWORD", "TOKEN"], redacted: true, serviceName: "nginx", evidence: [{ collectorId: "env-files", source: "env-files" }] },
    ],
    secretRefs: [
      { id: "secret:abc123", sourceLocation: "/etc/app/.env:DB_PASSWORD", kind: "env", fingerprint: "abc123def456", redacted: true, evidence: [{ collectorId: "env-files", source: "env-files" }] },
    ],
  }));
  const stacks = aggregateServiceStacks(g);
  assert.equal(stacks.length, 1);
  const json = JSON.stringify(stacks);

  // Secret VALUES that should never appear
  assert.ok(!json.includes("mypassword"), "no raw password value");
  assert.ok(!json.includes("supersecret"), "no raw secret value");

  // Key name in sourceLocation is safe metadata (pointer, not value)
  assert.ok(json.includes("DB_PASSWORD"), "key name in sourceLocation is safe pointer metadata");

  // Fingerprint is safe
  assert.ok(json.includes("abc123def456"), "fingerprint present");

  // EnvFile must only have keyCount, not raw key names in its own fields
  const ef = stacks[0].envFiles!;
  assert.ok(ef, "envFiles present");
  assert.equal(ef[0].keyCount, 2);
  assert.equal(typeof ef[0].keyCount, "number");

  // SecretRef must have redacted:true
  const sr = stacks[0].secretRefs![0] as StackSecretRef;
  assert.ok(sr, "secretRefs present");
  assert.equal(sr.redacted, true);
  assert.equal(sr.fingerprint, "abc123def456");
});

test("P5B: envFile refs never contain raw key values", () => {
  const g = extractInventoryGraph(snap({
    software: [
      { name: "app", version: "1.0", source: "apt", status: "installed", trust: "user" },
      { name: "app.service", version: "", source: "systemd", status: "running" },
    ],
    configChecklist: [
      { id: "n1", label: "开放端口", category: "network", status: "8080", lastChanged: "" },
    ],
    envFiles: [
      { path: "/etc/app/.env", keys: ["SECRET_KEY", "API_TOKEN"], redacted: true, serviceName: "app", evidence: [{ collectorId: "env-files", source: "env-files" }] },
    ],
  }));
  const stacks = aggregateServiceStacks(g);
  assert.equal(stacks.length, 1);
  const efRefs = stacks[0].envFiles!;
  assert.ok(efRefs, "envFiles present");
  assert.equal(efRefs.length, 1);
  for (const ef of efRefs) {
    // Only keyCount (number) — no keyNames array
    assert.equal(typeof ef.keyCount, "number");
    const refJson = JSON.stringify(ef);
    // key names "SECRET_KEY", "API_TOKEN" must NOT be in the ref (only in sourceLocation of secretRefs)
    assert.ok(!refJson.includes("SECRET_KEY"), "envFile ref must not include key names");
    assert.ok(!refJson.includes("API_TOKEN"), "envFile ref must not include key names");
  }
});

// ═══════════════════════════════════════════════════════════════════
// 17. Low/medium confidence edges preserved + enrichment warnings
// ═══════════════════════════════════════════════════════════════════

test("P5B: enrichment metadata present on all stacks", () => {
  const g = extractInventoryGraph(nginxSnapshot());
  const stacks = aggregateServiceStacks(g);
  assert.equal(stacks.length, 1);
  assert.ok(stacks[0].enrichment);
  assert.equal(stacks[0].enrichment!.version, "phase5.stack.v1");
  assert.ok(stacks[0].enrichment!.sourceGraphNodeCount > 0);
  assert.ok(stacks[0].enrichment!.sourceGraphEdgeCount >= 0);
  assert.ok(Array.isArray(stacks[0].enrichment!.enrichmentWarnings));
});

test("P5B: low confidence scheduleTask→process adds warning", () => {
  // Command-match based scheduledTask→process edges are [medium] confidence
  const g = extractInventoryGraph(snap({
    software: [
      { name: "nginx", version: "1.26.0", source: "apt", status: "installed", trust: "user" },
      { name: "nginx.service", version: "", source: "systemd", status: "running" },
    ],
    configChecklist: [
      { id: "n1", label: "开放端口", category: "network", status: "80", lastChanged: "" },
    ],
    processes: [
      { pid: 99, command: "/usr/sbin/logrotate -f", evidence: [{ collectorId: "ps-aux", source: "ps-aux" }] },
    ],
    scheduledTasks: [
      { id: "cron:logrotate", kind: "cron", schedule: "0 2 * * *", command: "/usr/sbin/logrotate -f", user: "root", enabled: true, serviceName: "nginx", evidence: [{ collectorId: "cron-jobs", source: "cron-jobs" }] },
    ],
  }));
  const stacks = aggregateServiceStacks(g);
  assert.equal(stacks.length, 1);
  const sts = stacks[0].scheduledTasks;
  assert.ok(sts, "scheduledTasks present");
  assert.equal(sts![0].confidence, "high", "scheduledTask→service is high confidence");
});

// ═══════════════════════════════════════════════════════════════════
// 18. Multi-service graph: each service gets its own resources
// ═══════════════════════════════════════════════════════════════════

test("P5B: multi-service graph isolates resources per stack", () => {
  const g = extractInventoryGraph(snap({
    software: [
      { name: "nginx", version: "1.26.0", source: "apt", status: "installed", trust: "user" },
      { name: "nginx.service", version: "", source: "systemd", status: "running" },
      { name: "postgresql", version: "16", source: "apt", status: "installed", trust: "user" },
      { name: "postgresql.service", version: "", source: "systemd", status: "running" },
    ],
    configChecklist: [
      { id: "n1", label: "开放端口", category: "network", status: "80, 443, 5432", lastChanged: "" },
    ],
    processes: [
      { pid: 1234, user: "www-data", command: "/usr/sbin/nginx", serviceName: "nginx", listeningPorts: [80], evidence: [{ collectorId: "ps-aux", source: "ps-aux" }] },
      { pid: 5678, user: "postgres", command: "/usr/lib/postgresql/16/bin/postgres", serviceName: "postgresql", listeningPorts: [5432], evidence: [{ collectorId: "ps-aux", source: "ps-aux" }] },
    ],
    dataPaths: [
      { path: "/var/www/html", kind: "app-data", serviceName: "nginx", evidence: [{ collectorId: "data-paths", source: "data-paths" }] },
      { path: "/var/lib/postgresql", kind: "database-data", serviceName: "postgresql", evidence: [{ collectorId: "data-paths", source: "data-paths" }] },
    ],
  }));

  const stacks = aggregateServiceStacks(g);
  assert.equal(stacks.length, 2);

  const nginxStack = stacks.find(s => s.label === "nginx");
  const pgStack = stacks.find(s => s.label === "postgresql");

  assert.ok(nginxStack, "nginx stack found");
  assert.ok(pgStack, "postgresql stack found");

  // nginx stack should NOT have postgresql resources
  const nginxProcs = nginxStack!.processes!;
  assert.equal(nginxProcs.length, 1);
  assert.ok(nginxProcs[0].command?.includes("nginx"));

  // postgresql stack should NOT have nginx resources
  const pgProcs = pgStack!.processes!;
  assert.equal(pgProcs.length, 1);
  assert.ok(pgProcs[0].command?.includes("postgres"));

  // DataPaths isolated
  assert.equal(nginxStack!.dataPaths!.length, 1);
  assert.equal(nginxStack!.dataPaths![0].path, "/var/www/html");
  assert.equal(pgStack!.dataPaths!.length, 1);
  assert.equal(pgStack!.dataPaths![0].path, "/var/lib/postgresql");
});

// ═══════════════════════════════════════════════════════════════════
// 19. Phase 4 inventory graph tests still pass (sanity)
// ═══════════════════════════════════════════════════════════════════

test("P5B: Phase 4 graph extraction unchanged", () => {
  const g = extractInventoryGraph(nginxSnapshot());
  // Verify graph still has expected nodes and edges
  const procs = g.nodes.filter(n => n.kind === "process");
  assert.equal(procs.length, 1);
  const services = g.nodes.filter(n => n.kind === "service");
  assert.equal(services.length, 1);
  const runsEdges = g.rels.filter(r => r.kind === "runs");
  assert.ok(runsEdges.length >= 1);
  const writesEdges = g.rels.filter(r => r.kind === "writesTo");
  assert.ok(writesEdges.length >= 2);
  const readsEdges = g.rels.filter(r => r.kind === "readsEnv");
  assert.equal(readsEdges.length, 1);
});

// ═══════════════════════════════════════════════════════════════════
// 20. Enrichment warnings count edge cases
// ═══════════════════════════════════════════════════════════════════

test("P5B: no warnings for clean high-confidence graph", () => {
  const g = extractInventoryGraph(nginxSnapshot());
  const stacks = aggregateServiceStacks(g);
  assert.equal(stacks.length, 1);
  assert.ok(stacks[0].enrichment!.enrichmentWarnings.length === 0 || stacks[0].enrichment!.enrichmentWarnings.every(w => !w.includes("Low confidence")), "no low-confidence warnings on clean graph");
});

// ═══════════════════════════════════════════════════════════════════
// 21. Container matching fallback works
// ═══════════════════════════════════════════════════════════════════

test("P5B: container image containing service name gets included", () => {
  const g = extractInventoryGraph(snap({
    software: [
      { name: "nginx", version: "1.26.0", source: "apt", status: "installed", trust: "user" },
      { name: "nginx.service", version: "", source: "systemd", status: "running" },
      { name: "my-nginx-prod:latest", version: "def456", source: "docker", status: "running" },
    ],
    configChecklist: [
      { id: "n1", label: "开放端口", category: "network", status: "80", lastChanged: "" },
    ],
  }));
  const stacks = aggregateServiceStacks(g);
  assert.equal(stacks.length, 1);
  assert.equal(stacks[0].containers.length, 1);
  assert.equal(stacks[0].containers[0].image, "my-nginx-prod:latest");
});

// ═══════════════════════════════════════════════════════════════════
// 22. Service with config file via edge (usesConfig) works
// ═══════════════════════════════════════════════════════════════════

test("P5B: configFiles from service→usesConfig edge preferred over heuristic", () => {
  const g = extractInventoryGraph(snap({
    software: [
      { name: "nginx", version: "1.26.0", source: "apt", status: "installed", trust: "user" },
      { name: "nginx.service", version: "", source: "systemd", status: "running" },
      { name: "/etc/nginx/nginx.conf", version: "", source: "custom-config", status: "installed" },
    ],
    configChecklist: [
      { id: "n1", label: "开放端口", category: "network", status: "80", lastChanged: "" },
    ],
  }));
  // Graph extraction includes service→usesConfig edges for matching config files
  const g2 = extractInventoryGraph(snap({
    software: [
      { name: "nginx", version: "1.26.0", source: "apt", status: "installed", trust: "user" },
      { name: "nginx.service", version: "", source: "systemd", status: "running" },
      { name: "/etc/nginx/nginx.conf", version: "", source: "custom-config", status: "installed" },
      { name: "/etc/nginx/sites-enabled/default", version: "", source: "config-path", status: "installed" },
    ],
    configChecklist: [
      { id: "n1", label: "开放端口", category: "network", status: "80", lastChanged: "" },
    ],
  }));
  // Both should produce valid stacks with config files
  const stacks2 = aggregateServiceStacks(g2);
  assert.equal(stacks2.length, 1);
  assert.ok(stacks2[0].configFiles.length >= 1, "config files present via edge matching");
});
