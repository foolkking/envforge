/**
 * inventory-graph.test.ts — prove node extraction + service-stack aggregation
 * work on minimal mock snapshots (no real collection needed).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { extractInventoryGraph, aggregateServiceStacks, type PackageNode, type ServiceNode, type PortNode, type ContainerNode } from "../../inventory-graph.js";
import type { StoredProbeSnapshot } from "../../runtime-store.js";

function snap(software: StoredProbeSnapshot["software"], checklist: StoredProbeSnapshot["configChecklist"] = []): StoredProbeSnapshot {
  return {
    agentId: "agent-test",
    collectedAt: "2026-07-01T00:00:00.000Z",
    system: {
      hostname: "vm-test", platform: "linux", arch: "x64", release: "6.8", uptime: 0,
      cpu: { model: "test", cores: 2, speedMhz: 2400 },
      memory: { totalBytes: 8192, freeBytes: 4096, usedBytes: 4096, totalGb: "8", freeGb: "4" }
    },
    software,
    configChecklist: checklist,
    collection: { status: "ok", completeness: 1, commands: [], errors: [], timedOut: false }
  };
}

test("extractInventoryGraph: packages get typed PackageNode with source discriminator", () => {
  const g = extractInventoryGraph(snap([
    { name: "nginx", version: "1.26.0", source: "apt", status: "installed", trust: "user" },
    { name: "vim", version: "9.1", source: "apt", status: "installed" },
    { name: "eslint", version: "8.0.0", source: "npm", status: "global" }
  ]));
  const pkgs = g.nodes.filter(n => n.kind === "package");
  assert.equal(pkgs.length, 3);
  assert.equal(pkgs[0].id, "package:apt:nginx"); // fix: was n[0]
  assert.equal((pkgs[0] as unknown as PackageNode).source, "apt");
  // trust defaults
  assert.equal((pkgs[1] as unknown as PackageNode).trust, "uncertain", "missing trust ⇒ uncertain");
});

test("extractInventoryGraph: services get typed ServiceNode + owns package link", () => {
  const g = extractInventoryGraph(snap([
    { name: "nginx", version: "1.26.0", source: "apt", status: "installed", trust: "user" },
    { name: "nginx.service", version: "", source: "systemd", status: "running" },
    { name: "cron.daily-backup", version: "", source: "cron", status: "active" }
  ]));
  const svcs = g.nodes.filter(n => n.kind === "service");
  assert.equal(svcs.length, 2);
  const nginx = svcs.find(s => (s as unknown as ServiceNode).unit === "nginx.service");
  assert.ok(nginx);
  // owns relationship
  const owns = g.rels.filter(r => r.from === nginx?.id && r.kind === "owns");
  assert.equal(owns.length, 1, "nginx.service owns package apt:nginx");
  assert.match(owns[0].to, /package:/);
});

test("extractInventoryGraph: ports extracted from configChecklist network items", () => {
  const g = extractInventoryGraph(snap(
    [{ name: "openssh-server", version: "1:8.9", source: "apt", status: "installed" }],
    [{ id: "network-001", label: "开放端口", category: "network", status: "22, 80, 443", lastChanged: "" }]
  ));
  const ports = g.nodes.filter(n => n.kind === "port");
  assert.equal(ports.length, 3);
  assert.ok(ports.some(p => (p as unknown as PortNode).port === 80));
  assert.ok(ports.some(p => (p as unknown as PortNode).port === 443));
  // dedup by id
  const g2 = extractInventoryGraph(snap(
    [],
    [
      { id: "n1", label: "a", category: "network", status: "80", lastChanged: "" },
      { id: "n2", label: "b", category: "network", status: "80", lastChanged: "" }
    ]
  ));
  assert.equal(g2.nodes.filter(n => n.kind === "port").length, 1, "duplicate port 80 deduped");
});

test("extractInventoryGraph: containers extracted from docker source", () => {
  const g = extractInventoryGraph(snap([
    { name: "nginx:1.25-alpine", version: "abc123", source: "docker", status: "running" }
  ]));
  const containers = g.nodes.filter(n => n.kind === "container");
  assert.equal(containers.length, 1);
  assert.equal(containers[0].id, "container:nginx:1.25-alpine");
  assert.equal((containers[0] as unknown as ContainerNode).image, "nginx:1.25-alpine");
});

test("aggregateServiceStacks: nginx service with matching package + port forms a stack", () => {
  const g = extractInventoryGraph(snap(
    [
      { name: "nginx", version: "1.26.0", source: "apt", status: "installed", trust: "user" },
      { name: "nginx.service", version: "", source: "systemd", status: "running" }
    ],
    [{ id: "n1", label: "开放端口", category: "network", status: "80, 443", lastChanged: "" }]
  ));
  const stacks = aggregateServiceStacks(g);
  assert.equal(stacks.length, 1, "one stack for nginx");
  assert.equal(stacks[0].label, "nginx");
  assert.equal(stacks[0].packages.length, 1);
  assert.equal(stacks[0].packages[0].name, "nginx");
  assert.equal(stacks[0].ports.length, 2);
  assert.equal(stacks[0].confidence, "medium", "one package = medium confidence");
});

test("aggregateServiceStacks: service with two matching packages is high confidence", () => {
  const g = extractInventoryGraph(snap(
    [
      { name: "postgresql", version: "16", source: "apt", status: "installed", trust: "user" },
      { name: "postgresql-client", version: "16", source: "apt", status: "installed", trust: "user" },
      { name: "postgresql.service", version: "", source: "systemd", status: "running" }
    ],
    [{ id: "n1", label: "数据库端口", category: "network", status: "5432", lastChanged: "" }]
  ));
  const stacks = aggregateServiceStacks(g);
  assert.equal(stacks.length, 1);
  assert.equal(stacks[0].packages.length, 2);
  assert.equal(stacks[0].confidence, "high", "two packages = high confidence");
});

test("aggregateServiceStacks: cron-only service with no package forms no stack (no meaningful evidence)", () => {
  const g = extractInventoryGraph(snap([
    { name: "cron.daily-trim", version: "", source: "cron", status: "active" }
  ]));
  assert.equal(aggregateServiceStacks(g).length, 0);
});

test("InventoryGraph: completeness and hostname propagate", () => {
  const g = extractInventoryGraph(snap([]));
  assert.equal(g.hostname, "vm-test");
  assert.equal(g.completeness, 1);
});
