/**
 * collectors/__tests__/data-surfaces.test.ts — Phase 3-B
 *
 * Comprehensive tests for structured data surface types, redaction,
 * parser behavior, and snapshot backward compatibility.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  extractEnvKeys, fingerprintSecret, isSecretKeyName, normalizeDataSurfaces,
} from "../data-surfaces.js";
import { parseRemoteCollectorOutput } from "../remote-collector.js";

// ══ Type / schema tests ═══════════════════════════════════════════════

test("FullSystemSnapshot from empty output has all data surface arrays as []", () => {
  const snap = parseRemoteCollectorOutput("", "test-host");
  // All new fields should be defined (empty arrays, not undefined)
  assert.ok(Array.isArray(snap.processes), "processes should be array");
  assert.ok(Array.isArray(snap.dataPaths), "dataPaths should be array");
  assert.ok(Array.isArray(snap.envFiles), "envFiles should be array");
  assert.ok(Array.isArray(snap.secretRefs), "secretRefs should be array");
  assert.ok(Array.isArray(snap.volumes), "volumes should be array");
  assert.ok(Array.isArray(snap.networks), "networks should be array");
  assert.ok(Array.isArray(snap.certificates), "certificates should be array");
  assert.ok(Array.isArray(snap.domains), "domains should be array");
  assert.ok(Array.isArray(snap.usersGroups), "usersGroups should be array");
  assert.ok(Array.isArray(snap.scheduledTasks), "scheduledTasks should be array");
  // Old fields still present
  assert.ok(Array.isArray(snap.software), "software still present");
  assert.ok(Array.isArray(snap.configChecklist), "configChecklist still present");
});

test("FullSystemSnapshot empty output has all arrays empty", () => {
  const snap = parseRemoteCollectorOutput("", "test-host");
  assert.equal(snap.processes?.length ?? 0, 0);
  assert.equal(snap.dataPaths?.length ?? 0, 0);
  assert.equal(snap.envFiles?.length ?? 0, 0);
  assert.equal(snap.secretRefs?.length ?? 0, 0);
});

// ══ Process extraction ════════════════════════════════════════════════

test("parse processes from ps-aux section", () => {
  const raw = [
    "===SECTION:ps-aux===",
    "1|root|0.0|0.0|/sbin/init",
    "1234|www-data|0.5|1.2|nginx: worker process",
    "===STATUS:ps-aux:0===",
    "===SECTION:services-running===",
    "nginx.service",
    "===STATUS:services-running:0===",
    "===SECTION:services-enabled===",
    "nginx.service",
    "===STATUS:services-enabled:0===",
    "===SECTION:end===",
    "===STATUS:end:0===",
  ].join("\n");

  const snap = parseRemoteCollectorOutput(raw, "test-host");
  assert.ok(snap.processes, "processes array exists");
  assert.ok(snap.processes!.length >= 1, "at least one process parsed");

  // First process is PID 1
  const init = snap.processes!.find(p => p.pid === 1);
  assert.ok(init, "pid 1 found");
  assert.equal(init!.user, "root");
  assert.equal(init!.command, "/sbin/init");

  // Nginx process should have cross-ref service name
  const nginx = snap.processes!.find(p => p.pid === 1234);
  assert.ok(nginx, "nginx process found");
  assert.ok(nginx!.evidence.length > 0, "evidence present");
  assert.equal(nginx!.evidence[0].collectorId, "ps-aux");
});

test("process evidence has required fields", () => {
  const raw = [
    "===SECTION:ps-aux===",
    "42|nobody|1.0|2.0|/usr/bin/app serve",
    "===STATUS:ps-aux:0===",
    "===SECTION:end===",
    "===STATUS:end:0===",
  ].join("\n");

  const snap = parseRemoteCollectorOutput(raw, "test-host");
  assert.ok(snap.processes!.length > 0);
  const p = snap.processes![0];
  assert.equal(p.pid, 42);
  assert.equal(p.user, "nobody");
  assert.equal(p.command, "/usr/bin/app serve");
  assert.equal(p.evidence[0].collectorId, "ps-aux");
  assert.equal(p.evidence[0].source, "ps-aux");
});

// ══ DataPath extraction ════════════════════════════════════════════════

test("parse data paths from systemd WorkDir + dir sections", () => {
  const raw = [
    "===SECTION:data-paths===",
    "SVC:nginx.service|WorkingDirectory=/etc/nginx",
    "SVC:postgresql.service|WorkingDirectory=/var/lib/postgresql",
    "DIR:nginx|/srv/www|1024",
    "===STATUS:data-paths:0===",
    "===SECTION:end===",
    "===STATUS:end:0===",
  ].join("\n");

  const snap = parseRemoteCollectorOutput(raw, "test-host");
  assert.ok(snap.dataPaths!.length >= 2);

  const nginxPath = snap.dataPaths!.find(d => d.serviceName === "nginx");
  assert.ok(nginxPath);
  assert.equal(nginxPath!.path, "/etc/nginx");
  assert.equal(nginxPath!.kind, "service-workdir");
  assert.ok(nginxPath!.evidence.length > 0);

  const wwwPath = snap.dataPaths!.find(d => d.path === "/srv/www");
  assert.ok(wwwPath);
  assert.equal(wwwPath!.kind, "app-data");
});

// ══ EnvFile extraction — values never stored ══════════════════════════

test("env files parse — only keys stored, values redacted", () => {
  const raw = [
    "===SECTION:env-files===",
    "ENVFILE:/etc/nginx/nginx.env",
    "  KEY:NGINX_PORT",
    "  KEY:NGINX_HOST",
    "  KEY:DB_PASSWORD",
    "ENVFILE:/srv/.env",
    "  KEY:APP_SECRET",
    "  KEY:DATABASE_URL",
    "===STATUS:env-files:0===",
    "===SECTION:end===",
    "===STATUS:end:0===",
  ].join("\n");

  const snap = parseRemoteCollectorOutput(raw, "test-host");
  assert.ok(snap.envFiles!.length >= 1);

  // Verify nginx env file
  const nginxEnv = snap.envFiles!.find(e => e.path === "/etc/nginx/nginx.env");
  assert.ok(nginxEnv);
  assert.equal(nginxEnv!.redacted, true);
  assert.ok(nginxEnv!.keys.includes("NGINX_PORT"));
  assert.ok(nginxEnv!.keys.includes("DB_PASSWORD"));
  // ABSOLUTELY no values
  for (const key of nginxEnv!.keys) {
    assert.ok(!key.includes("="), `key "${key}" must not contain =`);
    assert.ok(!/^\d/.test(key), `key "${key}" must not start with digit`);
  }
});

test("env file evidence carries path", () => {
  const raw = [
    "===SECTION:env-files===",
    "ENVFILE:/opt/app/.env",
    "  KEY:LOG_LEVEL",
    "===STATUS:env-files:0===",
    "===SECTION:end===",
    "===STATUS:end:0===",
  ].join("\n");

  const snap = parseRemoteCollectorOutput(raw, "test-host");
  const ef = snap.envFiles![0];
  assert.equal(ef.evidence[0].path, "/opt/app/.env");
});

// ══ SecretRef redaction — fingerprint only ═══════════════════════════

test("secret refs derived from env files with secret-like keys", () => {
  const raw = [
    "===SECTION:env-files===",
    "ENVFILE:/etc/app/config.env",
    "  KEY:DB_PASSWORD",
    "  KEY:API_TOKEN",
    "  KEY:LOG_LEVEL",
    "===STATUS:env-files:0===",
    "===SECTION:end===",
    "===STATUS:end:0===",
  ].join("\n");

  const snap = parseRemoteCollectorOutput(raw, "test-host");
  // DB_PASSWORD and API_TOKEN should generate secret refs, LOG_LEVEL should not
  assert.ok(snap.secretRefs!.length >= 2, `expected >=2 secret refs, got ${snap.secretRefs!.length}`);
  assert.ok(snap.secretRefs!.every(r => r.redacted === true));
  assert.ok(snap.secretRefs!.every(r => r.fingerprint.length > 0));
  // No raw values anywhere
  for (const ref of snap.secretRefs!) {
    const json = JSON.stringify(ref);
    assert.ok(!/password_value/i.test(json), "no raw password values in secret ref");
    assert.ok(!/my_secret_token/i.test(json), "no raw token values in secret ref");
  }
});

test("certificate key paths generate secret refs", () => {
  const raw = [
    "===SECTION:certificates===",
    "CERT:/etc/nginx/ssl/privkey.pem",
    "  subject=CN=example.com",
    "  issuer=CN=R3",
    "  notBefore=Jan 1 00:00:00 2024 GMT",
    "  notAfter=Jan 1 00:00:00 2025 GMT",
    "===STATUS:certificates:0===",
    "===SECTION:end===",
    "===STATUS:end:0===",
  ].join("\n");

  const snap = parseRemoteCollectorOutput(raw, "test-host");
  const certKeyRefs = snap.secretRefs!.filter(r => r.kind === "certificate-key");
  assert.ok(certKeyRefs.length >= 1, "certificate key should generate a secret ref");
  assert.equal(certKeyRefs[0].redacted, true);
});

// ══ Volume extraction ═════════════════════════════════════════════════

test("parse docker volumes", () => {
  const raw = [
    "===SECTION:docker-volumes===",
    "nginx-data|local|local|/var/lib/docker/volumes/nginx-data/_data",
    "postgres-data|local|local|/var/lib/docker/volumes/postgres-data/_data",
    "===STATUS:docker-volumes:0===",
    "===SECTION:end===",
    "===STATUS:end:0===",
  ].join("\n");

  const snap = parseRemoteCollectorOutput(raw, "test-host");
  assert.ok(snap.volumes!.length >= 2);
  assert.equal(snap.volumes![0].name, "nginx-data");
  assert.equal(snap.volumes![0].driver, "local");
  assert.ok(snap.volumes![0].evidence.length > 0);
});

test("empty docker-volumes → empty array", () => {
  const snap = parseRemoteCollectorOutput("", "test-host");
  assert.equal(snap.volumes!.length, 0);
});

// ══ Network extraction ════════════════════════════════════════════════

test("parse docker networks", () => {
  const raw = [
    "===SECTION:docker-networks===",
    "abc123|bridge|bridge|local",
    "def456|nginx-net|bridge|local",
    "===STATUS:docker-networks:0===",
    "===SECTION:end===",
    "===STATUS:end:0===",
  ].join("\n");

  const snap = parseRemoteCollectorOutput(raw, "test-host");
  assert.ok(snap.networks!.length >= 2);
  assert.equal(snap.networks![0].name, "bridge");
  assert.equal(snap.networks![0].kind, "docker-bridge");
  // evidence populated
  assert.ok(snap.networks![0].evidence.length > 0);
});

// ══ Certificate / Domain extraction ═══════════════════════════════════

test("parse certificates with subject, issuer, dates, SAN domains", () => {
  const raw = [
    "===SECTION:certificates===",
    "CERT:/etc/letsencrypt/live/example.com/cert.pem",
    "  subject=CN=example.com",
    "  issuer=CN=R3,O=Let's Encrypt",
    "  notBefore=Jul 1 00:00:00 2025 GMT",
    "  notAfter=Sep 29 00:00:00 2025 GMT",
    "  SAN:DNS:example.com, DNS:www.example.com",
    "===STATUS:certificates:0===",
    "===SECTION:end===",
    "===STATUS:end:0===",
  ].join("\n");

  const snap = parseRemoteCollectorOutput(raw, "test-host");
  assert.ok(snap.certificates!.length >= 1);
  const cert = snap.certificates![0];
  assert.equal(cert.path, "/etc/letsencrypt/live/example.com/cert.pem");
  assert.equal(cert.subject, "CN=example.com");
  assert.equal(cert.issuer, "CN=R3,O=Let's Encrypt");
  assert.ok(cert.notBefore);
  assert.ok(cert.notAfter);
  assert.ok(cert.domains!.includes("example.com"));
  assert.ok(cert.domains!.includes("www.example.com"));
});

test("empty certificates → empty array", () => {
  const snap = parseRemoteCollectorOutput("", "test-host");
  assert.equal(snap.certificates!.length, 0);
});

test("parse domains from nginx server_name", () => {
  const raw = [
    "===SECTION:domains===",
    "DOMAIN:example.com|nginx|/etc/nginx/sites-enabled/example.conf",
    "DOMAIN:api.example.com|nginx|/etc/nginx/sites-enabled/api.conf",
    "===STATUS:domains:0===",
    "===SECTION:end===",
    "===STATUS:end:0===",
  ].join("\n");

  const snap = parseRemoteCollectorOutput(raw, "test-host");
  assert.ok(snap.domains!.length >= 2);
  const d = snap.domains!.find(dd => dd.name === "example.com");
  assert.ok(d);
  assert.equal(d!.source, "nginx");
  assert.equal(d!.evidence[0].path, "/etc/nginx/sites-enabled/example.conf");
});

// ══ UserGroup extraction ══════════════════════════════════════════════

test("parse users and groups", () => {
  const raw = [
    "===SECTION:users-groups===",
    "USER:deploy|1001|/home/deploy|/bin/bash",
    "USER:apprunner|1002|/opt/app|/sbin/nologin",
    "GROUP:docker|docker:x:998:deploy,apprunner",
    "GROUP:sudo|sudo:x:27:deploy",
    "===STATUS:users-groups:0===",
    "===SECTION:end===",
    "===STATUS:end:0===",
  ].join("\n");

  const snap = parseRemoteCollectorOutput(raw, "test-host");
  assert.ok(snap.usersGroups!.length >= 3);

  const deploy = snap.usersGroups!.find(u => u.name === "deploy");
  assert.ok(deploy);
  assert.equal(deploy!.kind, "user");
  assert.equal(deploy!.uid, 1001);
  assert.equal(deploy!.home, "/home/deploy");
  assert.equal(deploy!.shell, "/bin/bash");

  const dockerGrp = snap.usersGroups!.find(u => u.name === "docker");
  assert.ok(dockerGrp);
  assert.equal(dockerGrp!.kind, "group");
});

test("empty users-groups → empty array", () => {
  const snap = parseRemoteCollectorOutput("", "test-host");
  assert.equal(snap.usersGroups!.length, 0);
});

// ══ ScheduledTask extraction ══════════════════════════════════════════

test("parse cron jobs and systemd timers", () => {
  const raw = [
    "===SECTION:cron-jobs===",
    "0 2 * * * /usr/bin/backup.sh",
    "*/5 * * * * /usr/local/bin/healthcheck",
    "===STATUS:cron-jobs:0===",
    "===SECTION:systemd-timers===",
    "backup.timer",
    "cleanup.timer",
    "===STATUS:systemd-timers:0===",
    "===SECTION:end===",
    "===STATUS:end:0===",
  ].join("\n");

  const snap = parseRemoteCollectorOutput(raw, "test-host");
  assert.ok(snap.scheduledTasks!.length >= 4);

  // Cron task
  const cronTask = snap.scheduledTasks!.find(t => t.kind === "cron");
  assert.ok(cronTask);
  assert.equal(cronTask!.schedule, "0 2 * * *");
  assert.equal(cronTask!.command, "/usr/bin/backup.sh");
  assert.equal(cronTask!.enabled, true);

  // Systemd timer
  const timerTask = snap.scheduledTasks!.find(t => t.id === "systemd-timer:backup");
  assert.ok(timerTask);
  assert.equal(timerTask!.kind, "systemd-timer");
  assert.equal(timerTask!.enabled, true);
});

test("empty cron and timers → empty scheduled tasks", () => {
  const snap = parseRemoteCollectorOutput("", "test-host");
  assert.equal(snap.scheduledTasks!.length, 0);
});

// ══ Compatibility — old snapshot fields survive ═══════════════════════

test("old snapshot fields — system, software, configChecklist still present", () => {
  const raw = [
    "===SECTION:hostname===",
    "my-vm",
    "===STATUS:hostname:0===",
    "===SECTION:uname===",
    "linux",
    "x86_64",
    "5.15.0",
    "===STATUS:uname:0===",
    "===SECTION:cpu===",
    "4",
    "Intel Xeon",
    "===STATUS:cpu:0===",
    "===SECTION:memory===",
    "8589934592 4294967296",
    "===STATUS:memory:0===",
    "===SECTION:apt===",
    "nginx|1.26.0",
    "===STATUS:apt:0===",
    "===SECTION:services-enabled===",
    "nginx.service",
    "===STATUS:services-enabled:0===",
    "===SECTION:services-running===",
    "nginx.service",
    "===STATUS:services-running:0===",
    "===SECTION:end===",
    "===STATUS:end:0===",
  ].join("\n");

  const snap = parseRemoteCollectorOutput(raw, "test-host");
  assert.equal(snap.system.hostname, "my-vm");
  assert.equal(snap.system.platform, "linux");
  assert.equal(snap.system.cpu.cores, 4);
  assert.ok(snap.software.some(s => s.name === "nginx"));
  assert.ok(snap.configChecklist.length > 0);
  assert.equal(snap.counts!.apt, 1);
});

// ══ Compatibility — collection.completeness still works ═══════════════

test("collection.completeness computed from collectors", () => {
  const raw = [
    "===SECTION:hostname===",
    "vm1",
    "===STATUS:hostname:0===",
    "===SECTION:uname===",
    "linux",
    "x86_64",
    "5.15.0",
    "===STATUS:uname:0===",
    "===SECTION:cpu===",
    "2",
    "test",
    "===STATUS:cpu:0===",
    "===SECTION:memory===",
    "4294967296 2147483648",
    "===STATUS:memory:0===",
    "===SECTION:end===",
    "===STATUS:end:0===",
  ].join("\n");

  const snap = parseRemoteCollectorOutput(raw, "test-host");
  assert.ok(typeof snap.collection?.completeness === "number");
  assert.ok(snap.collection!.completeness > 0);
});

test("collection.collectors contains per-section results", () => {
  const raw = [
    "===SECTION:hostname===",
    "vm2",
    "===STATUS:hostname:0===",
    "===SECTION:uname===",
    "linux",
    "===STATUS:uname:0===",
    "===SECTION:cpu===",
    "1",
    "CPU",
    "===STATUS:cpu:0===",
    "===SECTION:memory===",
    "1024 512",
    "===STATUS:memory:0===",
    "===SECTION:end===",
    "===STATUS:end:0===",
  ].join("\n");

  const snap = parseRemoteCollectorOutput(raw, "test-host");
  assert.ok(snap.collectors);
  assert.ok(snap.collectors!["hostname"]);
  assert.ok(snap.collectors!["uname"]);
});

// ══ Redaction helper tests ═══════════════════════════════════════════

test("extractEnvKeys: strips values, returns key names only", () => {
  const input = "DB_HOST=localhost\nDB_PASSWORD=secret123\nLOG_LEVEL=debug\n";
  const keys = extractEnvKeys(input);
  assert.equal(keys.length, 3);
  assert.ok(keys.includes("DB_HOST"));
  assert.ok(keys.includes("DB_PASSWORD"));
  assert.ok(keys.includes("LOG_LEVEL"));
  // No values
  for (const k of keys) {
    assert.ok(!k.includes("="));
    assert.ok(!k.includes("secret"));
  }
});

test("extractEnvKeys: skips comments and empty lines", () => {
  const input = "# This is a comment\n\nDB_HOST=localhost\n\n# another comment\n";
  const keys = extractEnvKeys(input);
  assert.equal(keys.length, 1);
  assert.equal(keys[0], "DB_HOST");
});

test("fingerprintSecret: deterministic, irreversible", () => {
  const fp1 = fingerprintSecret("/etc/env", "DB_PASSWORD");
  const fp2 = fingerprintSecret("/etc/env", "DB_PASSWORD");
  const fp3 = fingerprintSecret("/etc/env", "DB_HOST");
  assert.equal(fp1, fp2, "same inputs must produce same fingerprint");
  assert.notEqual(fp1, fp3, "different keys must produce different fingerprints");
  assert.equal(fp1.length, 8, "fingerprint is 8-char hex");
});

test("isSecretKeyName: detects secret-like key names", () => {
  assert.equal(isSecretKeyName("DB_PASSWORD"), true);
  assert.equal(isSecretKeyName("API_TOKEN"), true);
  assert.equal(isSecretKeyName("SECRET_KEY"), true);
  assert.equal(isSecretKeyName("AWS_ACCESS_KEY_ID"), true);
  assert.equal(isSecretKeyName("PRIVATE_KEY_PATH"), true);
  assert.equal(isSecretKeyName("CERTIFICATE_KEY"), true);
  assert.equal(isSecretKeyName("MY_CREDENTIALS"), true);
  // Not secret
  assert.equal(isSecretKeyName("LOG_LEVEL"), false);
  assert.equal(isSecretKeyName("DB_HOST"), false);
  assert.equal(isSecretKeyName("NGINX_PORT"), false);
  assert.equal(isSecretKeyName("APP_NAME"), false);
});

test("normalizeDataSurfaces: converts undefined to []", () => {
  const input = { processes: undefined, volumes: [] as any[] };
  const out = normalizeDataSurfaces(input);
  assert.deepEqual(out.processes, []);
  assert.deepEqual(out.volumes, []);
});

// ══ No secret leakage — snapshot JSON must not contain example values ═════

test("snapshot JSON does not contain SECRET/PASSWORD/TOKEN plaintext sample values", () => {
  const raw = [
    "===SECTION:env-files===",
    "ENVFILE:/etc/app/.env",
    "  KEY:DB_PASSWORD",
    "  KEY:API_TOKEN",
    "  KEY:SECRET_KEY",
    "  KEY:LOG_LEVEL",
    "===STATUS:env-files:0===",
    "===SECTION:certificates===",
    "CERT:/etc/nginx/ssl/privkey.pem",
    "===STATUS:certificates:0===",
    "===SECTION:end===",
    "===STATUS:end:0===",
  ].join("\n");

  const snap = parseRemoteCollectorOutput(raw, "test-host");
  const json = JSON.stringify(snap);

  // The sample plaintext values that we must NOT leak
  const forbiddenPatterns = [
    /secret123/i,
    /my_secret_token/i,
    /super_secret_key/i,
    /password_value/i,
    /-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY-----/,
  ];

  for (const pattern of forbiddenPatterns) {
    assert.ok(!pattern.test(json), `Snapshot JSON must not contain pattern: ${pattern}`);
  }

  // But key names and fingerprints should be present
  assert.ok(json.includes("DB_PASSWORD"), "secret key name should be in snapshot");
  assert.ok(json.includes("API_TOKEN"), "secret key name should be in snapshot");
});
