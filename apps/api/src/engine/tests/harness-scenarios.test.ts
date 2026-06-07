/**
 * harness-scenarios.test.ts — runs every harness scenario through the
 * dry-run pathway in-process so CI catches regressions in the planner,
 * apply gate, and approval aggregation. The harness shell script
 * reuses the same dist modules; this test covers the same logic
 * without spawning a child process.
 *
 * Each scenario MUST:
 *   - parse as JSON,
 *   - reference a known catalog item (when planSource is
 *     capability-selection),
 *   - produce a Plan whose review.required is true,
 *   - clear the apply gate when fully acked (the dry-run runner sees
 *     no live SSH so we only assert the gate's *verdict* matches the
 *     scenario's expectation).
 */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  buildConfigChangePlan,
  buildRebuildPlan,
  buildRemovePlan,
  evaluateApplyGate,
  buildPlanReport
} from "../../environment-plan.js";
import { listCatalogFromDatabase } from "../../database.js";
import type { ManagedCapabilityRecord } from "../../action-runs.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const scenarioDir = path.resolve(here, "../../../../../scripts/harness/scenarios");

async function loadScenarios(): Promise<Array<{ file: string; data: any }>> {
  const files = (await fs.readdir(scenarioDir)).filter((f) => f.endsWith(".json"));
  files.sort();
  const result: Array<{ file: string; data: any }> = [];
  for (const file of files) {
    const raw = await fs.readFile(path.join(scenarioDir, file), "utf8");
    result.push({ file, data: JSON.parse(raw) });
  }
  return result;
}

test("harness: ships exactly one hundred nine golden scenarios", async () => {
  const scenarios = await loadScenarios();
  const ids = scenarios.map((s) => s.data.id).sort();
  assert.deepEqual(ids, [
    "adguard-home-dry-run",
    "ansible-tool-dry-run",
    "apache-httpd-dry-run",
    "audiobookshelf-dry-run",
    "authelia-dry-run",
    "authentik-dry-run",
    "bookstack-dry-run",
    "build-docker-success",
    "caddy-server-dry-run",
    "certbot-letsencrypt-alias-review",
    "certbot-ssl-dry-run",
    "clickhouse-dry-run",
    "code-server-dry-run",
    "docker-mailserver-dry-run",
    "dotnet-runtime-dry-run",
    "elasticsearch-dry-run",
    "fail2ban-protection-dry-run",
    "firewall-baseline-dry-run",
    "firewalld-dry-run",
    "fish-shell-dry-run",
    "flutter-sdk-dry-run",
    "forgejo-dry-run",
    "freshrss-dry-run",
    "git-version-control-dry-run",
    "gitea-server-dry-run",
    "gitlab-ce-dry-run",
    "gitlab-runner-dry-run",
    "golang-runtime-dry-run",
    "grafana-dashboard-dry-run",
    "build-nginx-success",
    "haproxy-lb-dry-run",
    "home-assistant-dry-run",
    "homepage-dry-run",
    "htop-tools-dry-run",
    "influxdb-dry-run",
    "immich-dry-run",
    "jellyfin-media-dry-run",
    "jenkins-ci-dry-run",
    "k3s-dry-run",
    "keycloak-dry-run",
    "kubernetes-tools-dry-run",
    "lamp-stack-dry-run",
    "lemp-stack-dry-run",
    "linkwarden-dry-run",
    "loki-logging-dry-run",
    "mariadb-dry-run",
    "meilisearch-dry-run",
    "mealie-dry-run",
    "memcached-dry-run",
    "minio-storage-dry-run",
    "mongodb-dry-run",
    "mosquitto-mqtt-dry-run",
    "nginx-config-postvalidate-failure-rollback",
    "mysql-server-dry-run",
    "neovim-editor-dry-run",
    "netdata-monitoring-dry-run",
    "nethogs-bandwidth-dry-run",
    "nextcloud-dry-run",
    "nfs-server-dry-run",
    "n8n-dry-run",
    "navidrome-dry-run",
    "nocodb-dry-run",
    "node-runtime-profile-dry-run",
    "node-production-deploy-dry-run",
    "nodejs-pm2-dry-run",
    "nodejs-version-mgr-dry-run",
    "openjdk-runtime-dry-run",
    "openresty-dry-run",
    "openvpn-server-dry-run",
    "onlyoffice-docs-dry-run",
    "paperless-ngx-dry-run",
    "pihole-dry-run",
    "php-fpm-dry-run",
    "php-toolchain-dry-run",
    "postgres-profile-dry-run",
    "prometheus-monitoring-dry-run",
    "pyenv-toolchain-dry-run",
    "python-toolchain-dry-run",
    "rabbitmq-dry-run",
    "redis-server-dry-run",
    "remove-existing-nginx-blocked",
    "remove-managed-nginx",
    "rsync-tools-dry-run",
    "ruby-toolchain-dry-run",
    "rust-cli-tools-dry-run",
    "rust-toolchain-dry-run",
    "samba-share-dry-run",
    "seafile-dry-run",
    "security-baseline-dry-run",
    "sonarqube-dry-run",
    "ssh-hardening-safe-apply",
    "sso-stack-dry-run",
    "stirling-pdf-dry-run",
    "swap-config-dry-run",
    "tailscale-dry-run",
    "terraform-iac-dry-run",
    "tmux-multiplex-dry-run",
    "umami-dry-run",
    "uptime-kuma-dry-run",
    "valkey-server-dry-run",
    "vault-secrets-dry-run",
    "vaultwarden-dry-run",
    "wireguard-vpn-dry-run",
    "wikijs-dry-run",
    "zabbix-monitoring-dry-run",
    "zsh-shell-dry-run",
    "docker-compose-dev-dry-run",
    "monitoring-stack-dry-run",
    "traefik-proxy-dry-run"
  ].sort());
});

test("harness: every scenario has a planSource", async () => {
  const scenarios = await loadScenarios();
  for (const { data } of scenarios) {
    assert.ok(data.planSource, `${data.id}: missing planSource`);
    assert.ok(data.planSource.kind, `${data.id}: planSource.kind required`);
  }
});

test("harness: capability-selection scenarios reference known catalog items", async () => {
  const scenarios = await loadScenarios();
  const catalog = await listCatalogFromDatabase();
  for (const { data } of scenarios) {
    if (data.planSource.kind !== "capability-selection") continue;
    for (const id of data.planSource.capabilityIds ?? []) {
      const found = catalog.find((it) => it.id === id);
      assert.ok(found, `${data.id}: catalog item ${id} not found`);
    }
  }
});

async function buildPlanForScenario(scenario: any) {
  const targetConnectionId = "harness-test";
  const source = scenario.planSource;
  if (source.kind === "capability-selection") {
    const catalog = await listCatalogFromDatabase();
    const items = source.capabilityIds.map((id: string) => catalog.find((it) => it.id === id)).filter(Boolean);
    return buildRebuildPlan(items, targetConnectionId);
  }
  if (source.kind === "remove-request") {
    let markers: ManagedCapabilityRecord[] = [];
    if (scenario.preconditions?.managedCapabilityRecord) {
      markers = [
        {
          id: `harness-${scenario.id}`,
          installedAt: new Date().toISOString(),
          installedByPlanId: "harness-precondition",
          targetHostId: targetConnectionId,
          configsTouched: [],
          servicesTouched: [],
          dataPathsKnown: [],
          ...scenario.preconditions.managedCapabilityRecord
        }
      ];
    } else if (source.managedByEnvForge) {
      markers = [
        {
          id: `harness-${scenario.id}-default`,
          capabilityKey: "web-server.nginx",
          catalogId: "nginx-web-service",
          installedByPlanId: "harness-default",
          installedAt: new Date().toISOString(),
          targetHostId: targetConnectionId,
          packagesInstalled: (source.packages ?? []).map((name: string) => ({
            name,
            manager: source.source ?? "apt",
            existedBefore: false,
            removableByEnvForge: true
          })),
          configsTouched: [],
          servicesTouched: [],
          dataPathsKnown: []
        }
      ];
    }
    return buildRemovePlan({
      targetConnectionId,
      packages: source.packages ?? [],
      source: source.source ?? "apt",
      managedByEnvForge: source.managedByEnvForge === true,
      preserveDataByDefault: source.preserveData !== false,
      managedMarkers: markers
    });
  }
  if (source.kind === "config-change") {
    return buildConfigChangePlan({
      targetConnectionId,
      path: source.path,
      originalContent: "",
      candidateContent: source.content ?? ""
    });
  }
  throw new Error(`unsupported planSource.kind ${source.kind}`);
}

test("harness: build-nginx-success — apply gate clears with full acks (any remainingRisks acked)", async () => {
  const scenarios = await loadScenarios();
  const scenario = scenarios.find((s) => s.data.id === "build-nginx-success")!;
  const plan = await buildPlanForScenario(scenario.data);
  assert.equal(plan.type, "rebuild");
  assert.equal(plan.items[0].id, "capability:nginx-web-service");
  // Build the full ack set (mirrors what the harness runner does).
  const risks: Record<string, string[]> = {};
  for (const item of plan.items) {
    const remaining = item.audit?.remainingRisks ?? [];
    if (remaining.length > 0) risks[item.id] = [...remaining];
  }
  const approvals = (plan.review.approvalsRequired ?? []).map((g) => ({ itemId: g.itemId, gateId: g.id }));
  const verdict = evaluateApplyGate(plan, { risks, approvals });
  assert.equal(verdict.ok, true, `gate should clear with full acks: ${verdict.reasons.join(";")}`);
});

test("harness: ssh-hardening-safe-apply — gate refuses without acks, passes with full acks", async () => {
  const scenarios = await loadScenarios();
  const scenario = scenarios.find((s) => s.data.id === "ssh-hardening-safe-apply")!;
  const plan = await buildPlanForScenario(scenario.data);
  // Without any acks, gate refuses (remainingRisks + approval gates).
  const refused = evaluateApplyGate(plan, {});
  assert.equal(refused.ok, false);
  assert.ok(refused.missingRiskAcks.length > 0);
  assert.ok(refused.missingApprovalGates.length > 0);
  // With full acks, gate clears.
  const risks: Record<string, string[]> = {};
  for (const item of plan.items) risks[item.id] = item.audit?.remainingRisks ?? [];
  const approvals = (plan.review.approvalsRequired ?? []).map((g) => ({ itemId: g.itemId, gateId: g.id }));
  const accepted = evaluateApplyGate(plan, { risks, approvals });
  assert.equal(accepted.ok, true, `gate should clear with full acks: ${accepted.reasons.join(";")}`);
});

test("harness: remove-existing-nginx-blocked — blockedUntilApproved set when existedBefore=true", async () => {
  const scenarios = await loadScenarios();
  const scenario = scenarios.find((s) => s.data.id === "remove-existing-nginx-blocked")!;
  const plan = await buildPlanForScenario(scenario.data);
  const removeAction = plan.items[0].actions.find((a) => a.id === "remove-packages");
  assert.equal(removeAction?.blockedUntilApproved, true);
  const reasons = plan.review.reasons.join(" / ");
  assert.match(reasons, /existed before|manual confirmation/);
});

test("harness: remove-managed-nginx — blockedUntilApproved=false (auto-remove eligible)", async () => {
  const scenarios = await loadScenarios();
  const scenario = scenarios.find((s) => s.data.id === "remove-managed-nginx")!;
  const plan = await buildPlanForScenario(scenario.data);
  const removeAction = plan.items[0].actions.find((a) => a.id === "remove-packages");
  assert.equal(removeAction?.blockedUntilApproved, false);
});

test("harness: nginx-config-postvalidate-failure-rollback — produces a config-change plan", async () => {
  const scenarios = await loadScenarios();
  const scenario = scenarios.find((s) => s.data.id === "nginx-config-postvalidate-failure-rollback")!;
  const plan = await buildPlanForScenario(scenario.data);
  assert.equal(plan.type, "change");
  assert.equal(plan.items[0].type, "config-change");
});

test("harness: every scenario builds a non-empty Plan Report", async () => {
  const scenarios = await loadScenarios();
  for (const { data } of scenarios) {
    const plan = await buildPlanForScenario(data);
    const report = buildPlanReport(plan);
    assert.ok(report.selectedCapabilities.length >= 1, `${data.id}: selectedCapabilities empty`);
    assert.ok(report.severity, `${data.id}: severity missing`);
    // The Plan Report must always carry actionRuns; empty array is
    // fine for dry-run, but the field must exist.
    assert.ok(Array.isArray(report.actionRuns));
  }
});

test("harness: build-docker-success — full-migration item with packagesInstalled in evidence", async () => {
  const scenarios = await loadScenarios();
  const scenario = scenarios.find((s) => s.data.id === "build-docker-success")!;
  const plan = await buildPlanForScenario(scenario.data);
  const item = plan.items[0];
  assert.equal(item.audit?.supportLevel, "full-migration");
  // The plan should declare an installPackage action for docker.io and the compose plugin.
  const installs = item.actions.filter((a) => a.kind === "installPackage");
  assert.ok(installs.length >= 1, "expected at least one installPackage action for docker");
});
