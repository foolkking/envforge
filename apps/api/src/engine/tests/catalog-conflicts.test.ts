import test from "node:test";
import assert from "node:assert/strict";
import {
  blockingConflicts,
  catalogConflictRules,
  detectPlanConflicts,
  getCatalogConflict
} from "../../catalog-conflicts.js";

test("catalog-conflicts: ships the six audit-derived rules", () => {
  const ids = catalogConflictRules.map((rule) => rule.id);
  assert.deepEqual(ids.sort(), [
    "dns-resolver",
    "firewall-stack",
    "http-frontend",
    "identity-provider",
    "kubernetes-cluster",
    "redis-port"
  ]);
});

test("catalog-conflicts: each rule lists at least two capabilityKeys + a resolution option", () => {
  for (const rule of catalogConflictRules) {
    assert.ok(rule.capabilityKeys.length >= 2, `${rule.id}: needs at least two participants`);
    assert.ok(rule.resolutionOptions.length >= 1, `${rule.id}: needs at least one resolution option`);
    assert.ok(rule.reason.length > 20, `${rule.id}: reason copy is too short`);
  }
});

test("catalog-conflicts: detects firewall-stack conflict (UFW + firewalld)", () => {
  const detected = detectPlanConflicts([
    { id: "capability:firewall-baseline", capabilityKey: "security.firewall.ufw" },
    { id: "capability:firewalld", capabilityKey: "security.firewall.firewalld" },
    { id: "capability:nginx", capabilityKey: "web-server.nginx" }
  ]);
  assert.equal(detected.length, 1);
  const fw = detected.find((d) => d.rule.id === "firewall-stack");
  assert.ok(fw, "firewall-stack rule must trigger");
  assert.equal(fw?.rule.severity, "block");
  assert.deepEqual(fw?.participatingItemIds.sort(), [
    "capability:firewall-baseline",
    "capability:firewalld"
  ]);
});

test("catalog-conflicts: detects http-frontend conflict (nginx + caddy)", () => {
  const detected = detectPlanConflicts([
    { id: "capability:nginx-web-service", capabilityKey: "web-server.nginx" },
    { id: "capability:caddy-server", capabilityKey: "web-server.caddy" }
  ]);
  assert.equal(detected.length, 1);
  assert.equal(detected[0].rule.id, "http-frontend");
  assert.equal(detected[0].rule.severity, "block");
});

test("catalog-conflicts: detects redis-port conflict (redis + valkey)", () => {
  const detected = detectPlanConflicts([
    { id: "capability:redis-server", capabilityKey: "cache.redis" },
    { id: "capability:valkey-server", capabilityKey: "cache.valkey" }
  ]);
  assert.equal(detected.length, 1);
  assert.equal(detected[0].rule.id, "redis-port");
});

test("catalog-conflicts: detects dns-resolver conflict (pihole + adguard + systemd-resolved)", () => {
  const detected = detectPlanConflicts([
    { id: "capability:pihole", capabilityKey: "app.dns.pihole" },
    { id: "capability:adguard-home", capabilityKey: "app.dns.adguard-home" },
    { id: "capability:systemd-resolved", capabilityKey: "system.dns.systemd-resolved" }
  ]);
  assert.equal(detected.length, 1);
  assert.equal(detected[0].rule.id, "dns-resolver");
  assert.equal(detected[0].participatingItemIds.length, 3);
});

test("catalog-conflicts: detects identity-provider (warn) and kubernetes-cluster (warn)", () => {
  const detected = detectPlanConflicts([
    { id: "capability:keycloak", capabilityKey: "security.sso.keycloak" },
    { id: "capability:authentik", capabilityKey: "security.sso.authentik" },
    { id: "capability:kubernetes-tools", capabilityKey: "developer.kubectl" },
    { id: "capability:k3s", capabilityKey: "container.kubernetes.k3s" }
  ]);
  const idp = detected.find((d) => d.rule.id === "identity-provider");
  const k8s = detected.find((d) => d.rule.id === "kubernetes-cluster");
  assert.ok(idp);
  assert.ok(k8s);
  assert.equal(idp?.rule.severity, "warn");
  assert.equal(k8s?.rule.severity, "warn");
  // blockingConflicts() filters to severity=block only
  assert.equal(blockingConflicts(detected).length, 0);
});

test("catalog-conflicts: returns empty when no rule triggers", () => {
  const detected = detectPlanConflicts([
    { id: "capability:nginx-web-service", capabilityKey: "web-server.nginx" },
    { id: "capability:redis-server", capabilityKey: "cache.redis" },
    { id: "capability:postgres-profile", capabilityKey: "database.postgresql" }
  ]);
  assert.equal(detected.length, 0);
});

test("catalog-conflicts: getCatalogConflict looks up by id", () => {
  assert.equal(getCatalogConflict("firewall-stack")?.severity, "block");
  assert.equal(getCatalogConflict("identity-provider")?.severity, "warn");
  assert.equal(getCatalogConflict("nonexistent"), undefined);
});
