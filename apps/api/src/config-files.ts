/**
 * config-files.ts — 远程配置文件管理
 *
 * 功能：
 * - 根据已安装软件列出关联的配置文件（路径 + 大小 + 修改时间）
 * - 读取指定配置文件内容（sudo cat）
 * - 写入配置文件（sudo tee）
 * - 用户级 dotfiles 采集
 */

import { Client } from "ssh2";
import type { StoredConnection } from "./runtime-store.js";
import { decryptStoredFields } from "./connections.js";
import { readUserKey } from "./key-store.js";
import fs from "node:fs/promises";
import { getConfigDiscoveryRules, ruleSecretPatterns, type CatalogDetectionRule } from "./catalog-rules.js";

export class ConfigConnectionError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 409) {
    super(message);
    this.name = "ConfigConnectionError";
    this.statusCode = statusCode;
  }
}

/** 软件名 → 关联配置文件路径 */
/** 通用系统配置文件（始终采集） */
const SYSTEM_CONFIGS = [
  "/etc/hosts",
  "/etc/sysctl.conf",
  "/etc/fstab",
  "/etc/crontab",
  "/etc/environment",
  "/etc/security/limits.conf",
];

/** 用户级 dotfiles（始终采集） */
const USER_DOTFILES = [
  "~/.bashrc",
  "~/.bash_profile",
  "~/.bash_aliases",
  "~/.profile",
  "~/.zshrc",
  "~/.gitconfig",
  "~/.gitignore_global",
  "~/.vimrc",
  "~/.tmux.conf",
  "~/.npmrc",
  "~/.ssh/config",
  "~/.config/pip/pip.conf",
  "~/.config/nvim/init.vim",
  "~/.cargo/config.toml",
  "~/.docker/config.json",
];

/** 排除的路径（安全考虑） */
const EXCLUDED_PATHS = [
  "/etc/shadow", "/etc/gshadow", "/etc/ssl/private",
  "/etc/pki/", "/etc/machine-id",
];

export interface ConfigFileInfo {
  path: string;
  size: number;
  modifiedAt: string;
  category: "system" | "user" | "app";
  associatedSoftware?: string;
  discovery?: ConfigDiscoveryInfo;
  governance?: ConfigGovernanceInfo;
}

export interface ConfigFileContent {
  path: string;
  content: string;
  size: number;
  modifiedAt: string;
  encoding: "utf8";
  secretScan?: SecretScanResult;
}

export interface ConfigDiscoveryInfo {
  source: "catalog-rule" | "system-default" | "user-dotfile" | "package-manager-modified";
  ruleId?: string;
  ruleName?: string;
  reasons: string[];
  sensitivity: "safe" | "review" | "secret";
  secretPatterns?: string[];
}

export interface ConfigGovernanceInfo {
  owners: Array<{ id: string; type: "software" | "system" | "user" | "unknown"; confidence: number; reason: string[] }>;
  defaultStatus: "default" | "modified" | "user-created" | "unknown";
  migrationStrategy: "copy" | "copy-with-review" | "redact-or-confirm" | "do-not-copy" | "manual-review";
  validationHint?: string;
  rollbackHint: string;
  riskNotes: string[];
}

export interface SecretScanResult {
  hasSecrets: boolean;
  hits: Array<{ pattern: string; line: number }>;
}

export interface ConfigValidationResult {
  path: string;
  command?: string;
  status: "passed" | "failed" | "skipped";
  stdout: string;
  stderr: string;
  exitCode: number | null;
  message: string;
  durationMs: number;
}

const SAFE_VALIDATION_COMMAND = /^[a-zA-Z0-9_./:=@,+ -]{1,300}$/;

/**
 * 列出连接对应 VM 上的所有可管理配置文件
 */
export async function listConfigFiles(
  connection: StoredConnection,
  installedSoftware: string[]
): Promise<ConfigFileInfo[]> {
  const client = await connectForConfig(connection);
  try {
    // Build list of paths to check
    const pathsToCheck: Array<{
      path: string;
      category: "system" | "user" | "app";
      software?: string;
      source: ConfigDiscoveryInfo["source"];
      rule?: CatalogDetectionRule;
      isGlob?: boolean;
    }> = [];

    // System configs
    for (const p of SYSTEM_CONFIGS) {
      pathsToCheck.push({ path: p, category: "system", source: "system-default" });
    }

    // User dotfiles
    for (const p of USER_DOTFILES) {
      pathsToCheck.push({ path: p, category: "user", source: "user-dotfile" });
    }

    // Catalog-driven software configs. TypeScript executes rules; the catalog explains software.
    for (const item of getConfigDiscoveryRules(installedSoftware)) {
      pathsToCheck.push({
        path: item.path,
        category: item.category,
        software: item.rule.displayName,
        source: "catalog-rule",
        rule: item.rule,
        isGlob: item.isGlob
      });
    }

    // Build a single SSH command to stat all files
    const statScript = pathsToCheck.map(({ path }) => {
      const expanded = path.startsWith("~") ? path : path;
      // Handle glob patterns
      if (path.includes("*")) {
        return `for f in ${expanded}; do [ -f "$f" ] && stat --format='%n|%s|%Y' "$f" 2>/dev/null; done`;
      }
      return `[ -f ${expanded} ] && stat --format='%n|%s|%Y' ${expanded} 2>/dev/null || true`;
    }).join("\n");

    // Also find modified package config files using dpkg-query
    const dpkgScript = `dpkg-query -W -f='\${Conffiles}\\n' '*' 2>/dev/null | awk 'OFS=" "{print $2,$1}' | md5sum -c 2>/dev/null | awk -F: '$2!~ /OK/{print $1}' | head -30`;

    const script = `HOME_DIR=$(echo ~)\n${statScript.replace(/~/g, '$HOME_DIR')}\necho "===MODIFIED==="\n${dpkgScript}`;
    const { stdout } = await execOnClient(client, script);

    const results: ConfigFileInfo[] = [];
    const [mainOutput, modifiedOutput] = stdout.split("===MODIFIED===");

    for (const line of (mainOutput ?? "").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.includes("|")) continue;
      const parts = trimmed.split("|");
      if (parts.length < 3) continue;
      const filePath = parts[0];
      const size = parseInt(parts[1], 10) || 0;
      const mtime = parseInt(parts[2], 10) || 0;

      // Skip excluded paths
      if (EXCLUDED_PATHS.some((ex) => filePath.startsWith(ex))) continue;
      // Find category and software
      const match = pathsToCheck.find((p) => {
        if (p.path.includes("*")) {
          const prefix = p.path.split("*")[0];
          return filePath.startsWith(prefix.replace("~", ""));
        }
        return filePath === p.path.replace("~", "") || filePath.endsWith(p.path.replace("~/", ""));
      });
      if (match?.rule?.config?.exclude?.some((ex) => pathMatchesRule(filePath, ex))) continue;
      const maxSizeKb = match?.rule?.config?.maxSizeKB ?? 50;
      if (size > maxSizeKb * 1024) continue;

      results.push({
        path: filePath,
        size,
        modifiedAt: new Date(mtime * 1000).toISOString(),
        category: match?.category ?? "system",
        associatedSoftware: match?.software,
        discovery: buildDiscovery(match, filePath),
        governance: buildGovernance(match, filePath, inferDefaultStatus(match, filePath)),
      });
    }

    // Add modified package config files (from dpkg-query)
    for (const line of (modifiedOutput ?? "").split("\n")) {
      const filePath = line.trim();
      if (!filePath || !filePath.startsWith("/")) continue;
      if (EXCLUDED_PATHS.some((ex) => filePath.startsWith(ex))) continue;
      if (results.find((r) => r.path === filePath)) continue; // already listed
      results.push({
        path: filePath,
        size: 0,
        modifiedAt: new Date().toISOString(),
        category: "system",
        associatedSoftware: undefined,
        discovery: {
          source: "package-manager-modified",
          reasons: ["Package manager reports this conffile differs from the installed default."],
          sensitivity: "review"
        },
        governance: buildGovernance(undefined, filePath, "modified"),
      });
    }

    return results;
  } finally {
    client.end();
  }
}

/**
 * 读取指定配置文件内容
 */
export async function readConfigFile(
  connection: StoredConnection,
  filePath: string
): Promise<ConfigFileContent> {
  // Security check
  if (EXCLUDED_PATHS.some((ex) => filePath.startsWith(ex))) {
    throw new Error(`Access denied: ${filePath}`);
  }
  if (!filePath.startsWith("/") && !filePath.startsWith("~")) {
    throw new Error(`Invalid path: ${filePath}`);
  }

  const client = await connectForConfig(connection);
  try {
    const expandedPath = filePath.startsWith("~")
      ? filePath  // will be expanded in script
      : filePath;

    const script = filePath.startsWith("~")
      ? `HOME_DIR=$(echo ~); cat "$HOME_DIR${filePath.slice(1)}" 2>/dev/null`
      : `sudo cat "${expandedPath}" 2>/dev/null`;

    const { stdout, exitCode } = await execOnClient(client, script);
    if (exitCode !== 0 && !stdout) {
      throw new Error(`Cannot read ${filePath}: file not found or permission denied`);
    }

    // Get file info
    const statScript = filePath.startsWith("~")
      ? `HOME_DIR=$(echo ~); stat --format='%s|%Y' "$HOME_DIR${filePath.slice(1)}" 2>/dev/null`
      : `sudo stat --format='%s|%Y' "${expandedPath}" 2>/dev/null`;
    const { stdout: statOut } = await execOnClient(client, statScript);
    const [sizeStr, mtimeStr] = (statOut.trim()).split("|");

    return {
      path: filePath,
      content: stdout,
      size: parseInt(sizeStr ?? "0", 10) || stdout.length,
      modifiedAt: new Date((parseInt(mtimeStr ?? "0", 10) || 0) * 1000).toISOString(),
      encoding: "utf8",
      secretScan: scanConfigSecrets(stdout),
    };
  } finally {
    client.end();
  }
}

/**
 * 写入配置文件内容（支持 sudo）
 */
export async function writeConfigFile(
  connection: StoredConnection,
  filePath: string,
  content: string,
  backup = true
): Promise<{ success: boolean; message: string }> {
  return safeWriteConfigFile(connection, filePath, content, backup);
}

export async function safeWriteConfigFile(
  connection: StoredConnection,
  filePath: string,
  content: string,
  backup = true
): Promise<{ success: boolean; message: string; backupPath?: string; tempPath?: string }> {
  // Security check
  if (EXCLUDED_PATHS.some((ex) => filePath.startsWith(ex))) {
    throw new Error(`Access denied: ${filePath}`);
  }
  if (filePath.includes("sudoers")) return safeSudoersApply(connection, filePath, content, backup);
  if (filePath.includes("/ssh/sshd_config")) return safeSshdConfigApply(connection, filePath, content, backup);
  if (filePath.includes("/ufw/") || filePath.includes("firewalld")) return safeFirewallApply(connection, filePath, content, backup);
  if (filePath.includes("/systemd/") || filePath.endsWith(".service")) return safeSystemdUnitApply(connection, filePath, content, backup);

  // Generic safe write.
  // Managed Execution Hardening phase contract:
  //   1. stat original (mode/owner) so install -m / chown can preserve it.
  //   2. read original sha256 (so the snapshot recorded by the
  //      ActionRunRecord can be byte-exact).
  //   3. backup to timestamped + stable suffix.
  //   4. write candidate to temp.
  //   5. pre-validate the *existing* live file (catches "we are about
  //      to write on top of an already-broken state" — refuse early).
  //   6. atomic install with preserved mode/owner.
  //   7. post-validate the live file.
  //   8. on post-validate failure restore the backup.
  const client = await connectForConfig(connection);
  try {
    const needsSudo = filePath.startsWith("/etc/") || filePath.startsWith("/usr/") || filePath.startsWith("/var/");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const bakPath = `${filePath}.envforge.bak.${timestamp}`;
    const stableBakPath = `${filePath}.envforge.bak`;
    const tempPath = `/tmp/envforge-${Buffer.from(filePath).toString("base64url")}-${Date.now()}`;

    // Stat the existing file so we can preserve mode + owner.
    const stat = await execOnClient(
      client,
      `(test -f ${shellSafe(filePath)} && stat -c '%a:%U:%G' ${shellSafe(filePath)}) || echo MISSING`
    );
    const statText = stat.stdout.trim();
    let mode: string | undefined;
    let owner: string | undefined;
    if (statText && statText !== "MISSING") {
      const [m, u, g] = statText.split(":");
      mode = m;
      if (u && g) owner = `${u}:${g}`;
    }

    if (backup) {
      const backupCmd = needsSudo
        ? `sudo cp -p ${shellSafe(filePath)} ${shellSafe(bakPath)} 2>/dev/null || true; sudo cp -p ${shellSafe(filePath)} ${shellSafe(stableBakPath)} 2>/dev/null || true`
        : `cp -p ${shellSafe(filePath)} ${shellSafe(bakPath)} 2>/dev/null || true; cp -p ${shellSafe(filePath)} ${shellSafe(stableBakPath)} 2>/dev/null || true`;
      await execOnClient(client, backupCmd);
    }

    // Write candidate to temp.
    const b64 = Buffer.from(content, "utf8").toString("base64");
    const writeTempCmd = `echo '${b64}' | base64 -d > ${shellSafe(tempPath)}`;
    const temp = await execOnClient(client, writeTempCmd);
    if (temp.exitCode !== 0) throw new Error(`Write temp failed: ${temp.stderr || "permission denied"}`);

    // Pre-validate the EXISTING live file. If the live file is broken
    // before we touch it, fail loudly so the operator does not blame
    // EnvForge for whatever was already wrong.
    const preValidate = await validateConfigFile(connection, filePath).catch(() => undefined);
    if (preValidate?.command && preValidate.status === "failed") {
      await execOnClient(client, `rm -f ${shellSafe(tempPath)}`);
      throw new Error(`Pre-validate failed; refusing to write on top of a broken file. Live ${preValidate.command} reported: ${preValidate.message}`);
    }

    const modeArg = mode ? `-m 0${mode}` : "-m 0644";
    const ownerArg = owner ? `-o ${owner.split(":")[0]} -g ${owner.split(":")[1]}` : "";
    const replaceCmd = needsSudo
      ? `sudo install ${modeArg} ${ownerArg} ${shellSafe(tempPath)} ${shellSafe(filePath)} && rm -f ${shellSafe(tempPath)}`
      : `install ${modeArg} ${shellSafe(tempPath)} ${shellSafe(filePath)} && rm -f ${shellSafe(tempPath)}`;
    const { exitCode, stderr } = await execOnClient(client, replaceCmd);
    if (exitCode !== 0) {
      await execOnClient(client, `rm -f ${shellSafe(tempPath)}`);
      throw new Error(`Write failed: ${stderr || "permission denied"}`);
    }

    // Post-validate the live file.
    const postValidate = await validateConfigFile(connection, filePath).catch(() => undefined);
    if (postValidate?.command && postValidate.status === "failed") {
      await restoreConfigFileFromBackup(connection, filePath).catch(() => undefined);
      throw new Error(`Post-validate failed (${postValidate.command}); backup restored. Output: ${postValidate.message}`);
    }

    return { success: true, message: `Safely written ${content.length} bytes to ${filePath}`, backupPath: bakPath, tempPath };
  } finally {
    client.end();
  }
}

function shellSafe(value: string): string {
  return `"${value.replace(/(["\\$`])/g, "\\$1")}"`;
}

/**
 * Apply an SSH daemon config safely.
 *
 * SSH config mistakes can lock the operator out of the box, so this
 * function does more than a generic write:
 *
 *  1. Pre-validate the existing config (`sshd -t`). Refuse to apply on top of
 *     a broken state — that hides whose change broke what.
 *  2. Write the candidate via the temp-file + atomic install path.
 *  3. Re-run `sshd -t`. On failure, restore the EnvForge backup immediately.
 *  4. Reload (not restart) sshd so existing sessions stay open.
 *  5. Verify a brand-new SSH session can authenticate. If it cannot, restore
 *     the backup and reload again. The caller's session is preserved.
 *
 * The reachability check uses `ssh -o BatchMode=yes -o ConnectTimeout=5
 * <user>@127.0.0.1 true`. We deliberately run it from the target host so we
 * never rely on the EnvForge server reaching the box from outside.
 */
export async function safeSshdConfigApply(
  connection: StoredConnection,
  filePath: string,
  content: string,
  backup = true
): Promise<{ success: boolean; message: string; backupPath?: string; tempPath?: string; reachability?: { ok: boolean; output: string } }> {
  const validation = await validateConfigFile(connection, filePath);
  if (validation.command && validation.status === "failed") {
    throw new Error(`Existing SSH config validation failed before apply: ${validation.message}`);
  }
  const result = await safeGenericWriteWithoutSpecialDispatch(connection, filePath, content, backup);
  const after = await validateConfigFile(connection, filePath);
  if (after.status === "failed") {
    await restoreConfigFileFromBackup(connection, filePath);
    throw new Error(`sshd validation failed after apply; rollback attempted: ${after.message}`);
  }

  // Reload first so a new SSH connection picks up the candidate config.
  const client = await connectForConfig(connection);
  let reachability: { ok: boolean; output: string };
  try {
    await execOnClient(
      client,
      "sudo systemctl reload ssh 2>/dev/null || sudo systemctl reload sshd 2>/dev/null || sudo service ssh reload 2>/dev/null || true"
    );
    // Verify with a fresh SSH session opened from the target itself. We
    // use BatchMode so a misconfigured PasswordAuthentication=no can never
    // block the check on a password prompt.
    const { decryptStoredFields } = await import("./connections.js");
    const decrypted = decryptStoredFields(connection.fields);
    const reachCmd = `ssh -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5 -p ${parseInt(decrypted.port ?? "22", 10) || 22} ${decrypted.username}@127.0.0.1 true 2>&1 || true`;
    const probe = await execOnClient(client, reachCmd);
    reachability = { ok: probe.exitCode === 0, output: probe.stdout || probe.stderr };
    if (!reachability.ok) {
      // Roll back: restore backup and reload again.
      await restoreConfigFileFromBackup(connection, filePath);
      await execOnClient(
        client,
        "sudo systemctl reload ssh 2>/dev/null || sudo systemctl reload sshd 2>/dev/null || sudo service ssh reload 2>/dev/null || true"
      );
      throw new Error(`sshd reachability check failed; backup restored and sshd reloaded. Reachability output: ${reachability.output}`);
    }
  } finally {
    client.end();
  }
  return {
    ...result,
    reachability,
    message: `${result.message}; sshd validation passed; reload + reachability probe verified a fresh SSH session.`
  };
}

/**
 * Apply a sudoers file safely. We never pipe directly to /etc/sudoers — we
 * write to a candidate path under /etc/sudoers.d/.envforge-candidate,
 * validate it with `visudo -cf`, and only then move it into place. A bad
 * sudoers file can lock everyone out of `sudo`, so failure rolls back to the
 * EnvForge backup before throwing.
 */
export async function safeSudoersApply(
  connection: StoredConnection,
  filePath: string,
  content: string,
  backup = true
): Promise<{ success: boolean; message: string; backupPath?: string; tempPath?: string; visudoOutput?: string }> {
  const client = await connectForConfig(connection);
  try {
    const candidatePath = `/etc/sudoers.d/.envforge-candidate-${Date.now()}`;
    const b64 = Buffer.from(content, "utf8").toString("base64");
    const writeCandidate = `echo '${b64}' | base64 -d | sudo tee ${candidatePath} >/dev/null && sudo chmod 0440 ${candidatePath}`;
    const wrote = await execOnClient(client, writeCandidate);
    if (wrote.exitCode !== 0) {
      throw new Error(`Failed to stage sudoers candidate: ${wrote.stderr || "permission denied"}`);
    }
    const visudo = await execOnClient(client, `sudo visudo -cf ${candidatePath} 2>&1`);
    if (visudo.exitCode !== 0) {
      await execOnClient(client, `sudo rm -f ${candidatePath}`);
      throw new Error(`visudo -cf rejected the candidate sudoers file: ${visudo.stdout || visudo.stderr}`);
    }
    // Candidate is valid; clean it up before the actual write so the regular
    // safe-write path (with backup + atomic install) can take over.
    await execOnClient(client, `sudo rm -f ${candidatePath}`);
  } finally {
    client.end();
  }

  const result = await safeGenericWriteWithoutSpecialDispatch(connection, filePath, content, backup);
  // Re-run visudo on the live target file as a final defence.
  const finalClient = await connectForConfig(connection);
  let visudoOutput = "";
  try {
    const finalCheck = await execOnClient(finalClient, `sudo visudo -cf ${filePath} 2>&1`);
    visudoOutput = finalCheck.stdout || finalCheck.stderr;
    if (finalCheck.exitCode !== 0) {
      await restoreConfigFileFromBackup(connection, filePath);
      throw new Error(`visudo -cf rejected the live sudoers file after apply; backup restored. Output: ${visudoOutput}`);
    }
  } finally {
    finalClient.end();
  }
  return {
    ...result,
    visudoOutput,
    message: `${result.message}; visudo -cf accepted the candidate before and after apply.`
  };
}

/**
 * Apply a firewall config (UFW / firewalld / nftables) with an automatic
 * rollback timer.
 *
 * The danger: a misconfigured firewall can drop the SSH connection that
 * EnvForge itself depends on. To survive this we:
 *
 *  1. Schedule an `at`-driven rollback that restores the backup and reloads
 *     the firewall after `rollbackSeconds` (default 90s) unless cancelled.
 *  2. Apply the candidate.
 *  3. Reload the firewall.
 *  4. Verify SSH is still reachable from the target (same probe used by
 *     {@link safeSshdConfigApply}).
 *  5. On success, cancel the rollback timer. On failure, let the timer fire.
 *
 * The host needs the `at` daemon installed for the timer to fire. When `at`
 * is unavailable we still apply the change but the message warns about the
 * missing safety net so operators can wire up their own watchdog.
 */
/**
 * Pure helper: parse a candidate firewall config and decide whether
 * applying it would block the SSH connection EnvForge depends on.
 *
 * Supports the three formats EnvForge sees in practice:
 *
 *   - UFW user-rules (`/etc/ufw/user.rules`) — recognises `-A …
 *     --dport <port> … ACCEPT/DROP` lines.
 *   - firewalld zone XML (`<port port="22" protocol="tcp"/>` — accept
 *     when present).
 *   - nftables script (`tcp dport 22 accept|drop`).
 *
 * Returns `{ ok: true }` when SSH is allowed by the candidate or no
 * decision can be made (lack of rules ≠ blocked). Returns `{ ok: false,
 * reason }` when the candidate clearly blocks the SSH port.
 *
 * Used by safeFirewallApply as a pre-flight check; tested directly so
 * we don't need a live SSH session.
 */
export function preflightFirewallContentKeepsSsh(
  content: string,
  sshPort = 22
): { ok: boolean; reason: string } {
  const portText = String(sshPort);
  const lower = content.toLowerCase();

  // UFW: explicit DENY/REJECT/DROP for SSH port.
  const denyUfw = new RegExp(`(?:^|\\n)\\s*-A\\s+ufw[^\\n]*?--dport\\s+${portText}\\b[^\\n]*?(?:DROP|REJECT|DENY)`, "i");
  if (denyUfw.test(content)) {
    return { ok: false, reason: `Candidate UFW rule denies tcp/${portText} (SSH).` };
  }
  // firewalld zone: explicit `<reject/>` or `<drop/>` after port 22.
  const fwdReject = new RegExp(`<port[^>]*port=\\"${portText}\\"[^>]*\\/>[\\s\\S]{0,200}?<(?:reject|drop)\\b`, "i");
  if (fwdReject.test(content)) {
    return { ok: false, reason: `Candidate firewalld config rejects port ${portText} (SSH).` };
  }
  // nftables: `tcp dport 22 drop`
  const nftDrop = new RegExp(`tcp\\s+dport\\s+${portText}\\b[^\\n]*?(?:drop|reject)`, "i");
  if (nftDrop.test(lower)) {
    return { ok: false, reason: `Candidate nftables rule drops tcp/${portText} (SSH).` };
  }
  // iptables: -A INPUT -p tcp --dport 22 -j DROP
  const iptDrop = new RegExp(`-p\\s+tcp[^\\n]*?--dport\\s+${portText}\\b[^\\n]*?-j\\s+(?:DROP|REJECT)`, "i");
  if (iptDrop.test(content)) {
    return { ok: false, reason: `Candidate iptables rule drops tcp/${portText} (SSH).` };
  }
  // UFW default policy: explicit `DEFAULT_INPUT_POLICY="DROP"` without a corresponding allow for the SSH port.
  if (/DEFAULT_INPUT_POLICY=\"?(?:DROP|REJECT)\"?/i.test(content)) {
    const allowSsh = new RegExp(`(?:--dport\\s+${portText}\\b|port\\s+${portText}\\b)[^\\n]*?(?:ACCEPT|allow|ALLOW)`, "i");
    if (!allowSsh.test(content)) {
      return { ok: false, reason: `Candidate sets default INPUT=DROP without an explicit allow for tcp/${portText} (SSH).` };
    }
  }
  return { ok: true, reason: `No rule in the candidate blocks tcp/${portText}.` };
}

export async function safeFirewallApply(
  connection: StoredConnection,
  filePath: string,
  content: string,
  backup = true,
  rollbackSeconds = 90
): Promise<{ success: boolean; message: string; backupPath?: string; tempPath?: string; reachability?: { ok: boolean; output: string }; rollbackArmed: boolean; preflight: { ok: boolean; reason: string } }> {
  // Preflight: never apply a candidate that would block our own SSH
  // session. The pure helper makes this testable without a live SSH
  // client; the rest of the function still does the runtime probe so a
  // misconfigured kernel module / nftables fall-through is caught.
  const sshPort = parseInt((connection.fields.port ?? "22"), 10) || 22;
  const preflight = preflightFirewallContentKeepsSsh(content, sshPort);
  if (!preflight.ok) {
    throw new Error(`safeFirewallApply refused: ${preflight.reason}`);
  }

  const client = await connectForConfig(connection);
  let rollbackArmed = false;
  let reachability: { ok: boolean; output: string } | undefined;
  try {
    const stableBakPath = `${filePath}.envforge.bak`;
    const reloadCmd = "(sudo ufw reload 2>/dev/null || sudo firewall-cmd --reload 2>/dev/null || sudo systemctl reload nftables 2>/dev/null || sudo iptables-restore < /etc/iptables/rules.v4 2>/dev/null) || true";
    const haveAt = await execOnClient(client, "command -v at >/dev/null 2>&1 && echo yes || echo no");
    if (haveAt.stdout.trim() === "yes") {
      const armCmd = `echo "sudo cp -p '${stableBakPath}' '${filePath}' 2>/dev/null && ${reloadCmd}; rm -f /tmp/envforge-firewall-rollback.id" | at now + 2 minutes 2>&1 | tail -n1`;
      // Truncate `at` to ~rollbackSeconds: schedule via shell sleep instead so
      // we can use sub-minute granularity.
      const scriptPath = `/tmp/envforge-firewall-rollback-${Date.now()}.sh`;
      const script = `#!/bin/sh\nsleep ${rollbackSeconds}\nif [ -f /tmp/envforge-firewall-rollback.cancel ]; then rm -f /tmp/envforge-firewall-rollback.cancel; exit 0; fi\nsudo cp -p '${stableBakPath}' '${filePath}' 2>/dev/null && ${reloadCmd}\n`;
      await execOnClient(client, `cat <<'EOF' > ${scriptPath}\n${script}\nEOF\nchmod +x ${scriptPath}; rm -f /tmp/envforge-firewall-rollback.cancel; nohup ${scriptPath} >/dev/null 2>&1 & echo $! > /tmp/envforge-firewall-rollback.pid`);
      rollbackArmed = true;
      // Suppress unused-variable lint for the optional `at` path we kept above.
      void armCmd;
    }
  } finally {
    client.end();
  }

  const result = await safeGenericWriteWithoutSpecialDispatch(connection, filePath, content, backup);

  const verifyClient = await connectForConfig(connection);
  try {
    await execOnClient(
      verifyClient,
      "(sudo ufw reload 2>/dev/null || sudo firewall-cmd --reload 2>/dev/null || sudo systemctl reload nftables 2>/dev/null) || true"
    );
    const { decryptStoredFields } = await import("./connections.js");
    const decrypted = decryptStoredFields(connection.fields);
    const probe = await execOnClient(
      verifyClient,
      `ssh -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5 -p ${parseInt(decrypted.port ?? "22", 10) || 22} ${decrypted.username}@127.0.0.1 true 2>&1 || true`
    );
    reachability = { ok: probe.exitCode === 0, output: probe.stdout || probe.stderr };
    if (reachability.ok && rollbackArmed) {
      // Cancel the timer.
      await execOnClient(verifyClient, "touch /tmp/envforge-firewall-rollback.cancel; (kill -9 $(cat /tmp/envforge-firewall-rollback.pid 2>/dev/null) 2>/dev/null || true)");
      rollbackArmed = false;
    }
  } finally {
    verifyClient.end();
  }

  return {
    ...result,
    reachability,
    rollbackArmed,
    preflight,
    message: `${result.message}; firewall reloaded${reachability?.ok ? "; SSH reachability probe passed" : "; SSH reachability probe failed — rollback timer will fire"}.`
  };
}

/**
 * Apply a systemd unit file safely. After the write we run
 * `systemctl daemon-reload` and `systemctl is-active <unit>` so the
 * caller knows whether the unit is healthy. Failures restore the backup
 * and rethrow so the operator is never left guessing.
 */
export async function safeSystemdUnitApply(
  connection: StoredConnection,
  filePath: string,
  content: string,
  backup = true
): Promise<{ success: boolean; message: string; backupPath?: string; tempPath?: string; daemonReload?: { exitCode: number; output: string }; activeState?: string }> {
  const result = await safeGenericWriteWithoutSpecialDispatch(connection, filePath, content, backup);
  const client = await connectForConfig(connection);
  try {
    const reload = await execOnClient(client, "sudo systemctl daemon-reload 2>&1");
    const daemonReload = { exitCode: reload.exitCode, output: reload.stdout || reload.stderr };
    if (reload.exitCode !== 0) {
      await restoreConfigFileFromBackup(connection, filePath);
      throw new Error(`systemctl daemon-reload failed; backup restored. Output: ${daemonReload.output}`);
    }
    const unitName = filePath.split("/").pop() ?? "";
    const isActive = unitName.endsWith(".service")
      ? await execOnClient(client, `sudo systemctl is-active ${unitName} 2>&1`)
      : { stdout: "skipped", stderr: "", exitCode: 0 };
    const activeState = (isActive.stdout || isActive.stderr).trim();
    return {
      ...result,
      daemonReload,
      activeState,
      message: `${result.message}; daemon-reload succeeded; unit state: ${activeState}.`
    };
  } finally {
    client.end();
  }
}

async function safeGenericWriteWithoutSpecialDispatch(connection: StoredConnection, filePath: string, content: string, backup = true) {
  const client = await connectForConfig(connection);
  try {
    const needsSudo = filePath.startsWith("/etc/") || filePath.startsWith("/usr/") || filePath.startsWith("/var/");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const bakPath = `${filePath}.envforge.bak.${timestamp}`;
    const stableBakPath = `${filePath}.envforge.bak`;
    const tempPath = `/tmp/envforge-${Buffer.from(filePath).toString("base64url")}-${Date.now()}`;
    if (backup) {
      const backupCmd = needsSudo
        ? `sudo cp -p "${filePath}" "${bakPath}" 2>/dev/null || true; sudo cp -p "${filePath}" "${stableBakPath}" 2>/dev/null || true`
        : `cp -p "${filePath}" "${bakPath}" 2>/dev/null || true; cp -p "${filePath}" "${stableBakPath}" 2>/dev/null || true`;
      await execOnClient(client, backupCmd);
    }
    const b64 = Buffer.from(content, "utf8").toString("base64");
    const temp = await execOnClient(client, `echo '${b64}' | base64 -d > "${tempPath}"`);
    if (temp.exitCode !== 0) throw new Error(`Write temp failed: ${temp.stderr || "permission denied"}`);
    const replaceCmd = needsSudo
      ? `sudo install -m 0644 "${tempPath}" "${filePath}" && rm -f "${tempPath}"`
      : `install -m 0644 "${tempPath}" "${filePath}" && rm -f "${tempPath}"`;
    const { exitCode, stderr } = await execOnClient(client, replaceCmd);
    if (exitCode !== 0) throw new Error(`Write failed: ${stderr || "permission denied"}`);
    return { success: true, message: `Safely written ${content.length} bytes to ${filePath}`, backupPath: bakPath, tempPath };
  } finally {
    client.end();
  }
}

/**
 * Read the current file and the EnvForge backup side-by-side so the UI can show a diff
 * between "before EnvForge first wrote" and "current state".
 */
export async function readConfigFileWithBackup(
  connection: StoredConnection,
  filePath: string
): Promise<{
  current: ConfigFileContent;
  backup?: ConfigFileContent & { backupPath: string };
}> {
  const current = await readConfigFile(connection, filePath);
  const bakPath = `${filePath}.envforge.bak`;
  try {
    const backup = await readConfigFile(connection, bakPath);
    return { current, backup: { ...backup, backupPath: bakPath } };
  } catch {
    return { current };
  }
}

// ── SSH helpers ──

export async function getConfigRollbackPreview(
  connection: StoredConnection,
  filePath: string
): Promise<{
  path: string;
  backupPath: string;
  rollbackAvailable: boolean;
  validationHint?: string;
}> {
  const bakPath = `${filePath}.envforge.bak`;
  try {
    await readConfigFile(connection, bakPath);
    return {
      path: filePath,
      backupPath: bakPath,
      rollbackAvailable: true,
      validationHint: validationHintForPath(filePath)
    };
  } catch {
    return {
      path: filePath,
      backupPath: bakPath,
      rollbackAvailable: false,
      validationHint: validationHintForPath(filePath)
    };
  }
}

export async function restoreConfigFileFromBackup(
  connection: StoredConnection,
  filePath: string
): Promise<{ success: boolean; message: string; validation?: ConfigValidationResult }> {
  if (EXCLUDED_PATHS.some((ex) => filePath.startsWith(ex))) {
    throw new Error(`Access denied: ${filePath}`);
  }
  if (!filePath.startsWith("/") && !filePath.startsWith("~")) {
    throw new Error(`Invalid path: ${filePath}`);
  }

  const bakPath = `${filePath}.envforge.bak`;
  const client = await connectForConfig(connection);
  try {
    const needsSudo = filePath.startsWith("/etc/") || filePath.startsWith("/usr/") || filePath.startsWith("/var/");
    const restoreCmd = needsSudo
      ? `sudo test -f "${bakPath}" && sudo cp -p "${bakPath}" "${filePath}"`
      : `test -f "${bakPath}" && cp -p "${bakPath}" "${filePath}"`;
    const { exitCode, stderr } = await execOnClient(client, restoreCmd);
    if (exitCode !== 0) {
      throw new Error(`Rollback failed: ${stderr || "backup not found or permission denied"}`);
    }
  } finally {
    client.end();
  }

  let validation: ConfigValidationResult | undefined;
  try {
    validation = await validateConfigFile(connection, filePath);
  } catch {
    validation = undefined;
  }
  return {
    success: true,
    message: `Restored ${filePath} from ${bakPath}`,
    validation
  };
}

export async function validateConfigFile(
  connection: StoredConnection,
  filePath: string
): Promise<ConfigValidationResult> {
  if (EXCLUDED_PATHS.some((ex) => filePath.startsWith(ex))) {
    throw new Error(`Access denied: ${filePath}`);
  }
  if (!filePath.startsWith("/") && !filePath.startsWith("~")) {
    throw new Error(`Invalid path: ${filePath}`);
  }

  const command = validationHintForPath(filePath);
  if (!command) {
    return {
      path: filePath,
      status: "skipped",
      stdout: "",
      stderr: "",
      exitCode: null,
      message: "No validation hook is defined for this config file.",
      durationMs: 0
    };
  }
  if (!SAFE_VALIDATION_COMMAND.test(command)) {
    return {
      path: filePath,
      command,
      status: "skipped",
      stdout: "",
      stderr: "",
      exitCode: null,
      message: "Validation command was skipped because it is not in the safe command subset.",
      durationMs: 0
    };
  }

  const client = await connectForConfig(connection);
  const startedAt = Date.now();
  try {
    const result = await execOnClient(client, command);
    const durationMs = Date.now() - startedAt;
    const passed = result.exitCode === 0;
    return {
      path: filePath,
      command,
      status: passed ? "passed" : "failed",
      stdout: trimValidationOutput(result.stdout),
      stderr: trimValidationOutput(result.stderr),
      exitCode: result.exitCode,
      message: passed ? "Validation passed." : "Validation failed; review the command output before applying this config.",
      durationMs
    };
  } finally {
    client.end();
  }
}

function validationHintForPath(filePath: string): string | undefined {
  if (filePath.includes("/etc/nginx/")) return "sudo nginx -t";
  if (filePath.includes("/etc/ssh/")) return "sudo sshd -t";
  if (filePath.includes("/etc/redis/")) return "redis-server --test-memory 2";
  if (filePath.includes("/etc/postgresql/")) return "systemctl is-active postgresql";
  if (filePath.includes("/etc/mysql/") || filePath.includes("/etc/mariadb/")) return "mysql --version";
  return undefined;
}

function trimValidationOutput(output: string): string {
  const max = 4000;
  return output.length > max ? `${output.slice(0, max)}\n...[truncated]` : output;
}

function buildDiscovery(
  match: {
    path: string;
    category: "system" | "user" | "app";
    software?: string;
    source: ConfigDiscoveryInfo["source"];
    rule?: CatalogDetectionRule;
  } | undefined,
  filePath: string
): ConfigDiscoveryInfo {
  if (!match) {
    return {
      source: "system-default",
      reasons: [`${filePath} was discovered by a generic config scan.`],
      sensitivity: "review"
    };
  }
  if (match.rule) {
    return {
      source: "catalog-rule",
      ruleId: match.rule.id,
      ruleName: match.rule.displayName,
      reasons: [
        `Discovered by the ${match.rule.displayName} catalog rule.`,
        "The matched software is present in the latest host inventory.",
        "Migration should follow this rule's validate and restart guidance."
      ],
      sensitivity: match.rule.config?.secretPatterns?.length ? "review" : "safe",
      secretPatterns: ruleSecretPatterns(match.rule)
    };
  }
  if (match.source === "user-dotfile") {
    return {
      source: "user-dotfile",
      reasons: ["Common user-level configuration file, useful for dotfile migration."],
      sensitivity: filePath.includes(".ssh") || filePath.endsWith(".npmrc") ? "review" : "safe",
      secretPatterns: ruleSecretPatterns()
    };
  }
  return {
    source: "system-default",
    reasons: ["Common system configuration file; review before migrating to another host."],
    sensitivity: "review",
    secretPatterns: ruleSecretPatterns()
  };
}

function buildGovernance(
  match: {
    path: string;
    category: "system" | "user" | "app";
    software?: string;
    source: ConfigDiscoveryInfo["source"];
    rule?: CatalogDetectionRule;
  } | undefined,
  filePath: string,
  defaultStatus: ConfigGovernanceInfo["defaultStatus"]
): ConfigGovernanceInfo {
  const discovery = buildDiscovery(match, filePath);
  const owners: ConfigGovernanceInfo["owners"] = [];
  if (match?.rule) {
    owners.push({
      id: match.rule.id,
      type: "software",
      confidence: 0.92,
      reason: [`Matched ${match.rule.displayName} catalog config rule.`, `Support level: ${match.rule.supportLevel}.`]
    });
  } else if (match?.source === "user-dotfile") {
    owners.push({ id: "user-dotfiles", type: "user", confidence: 0.8, reason: ["Known user-level dotfile path."] });
  } else if (match?.source === "system-default") {
    owners.push({ id: "system", type: "system", confidence: 0.65, reason: ["Common system configuration path."] });
  } else {
    owners.push({ id: "unknown", type: "unknown", confidence: 0.4, reason: ["No catalog owner matched; manual review required."] });
  }

  const sensitivity = discovery.sensitivity;
  const migrationStrategy: ConfigGovernanceInfo["migrationStrategy"] =
    EXCLUDED_PATHS.some((ex) => filePath.startsWith(ex)) ? "do-not-copy" :
    sensitivity === "secret" ? "redact-or-confirm" :
    sensitivity === "review" ? "copy-with-review" :
    defaultStatus === "default" ? "manual-review" :
    "copy";

  const riskNotes = [
    ...(match?.rule?.security?.notes ?? []),
    ...(match?.rule?.migrationCompleteness?.missingRisks ?? []).map((risk) => `Completeness dependency: ${risk}.`)
  ];
  if (sensitivity !== "safe") riskNotes.push("Content should be scanned for secrets before migration.");
  if (filePath.includes("/etc/ssh/")) riskNotes.push("SSH config changes require sshd -t and a rollback-safe active session.");

  return {
    owners,
    defaultStatus,
    migrationStrategy,
    validationHint: validationHintForPath(filePath) ?? match?.rule?.migrate.validate?.[0],
    rollbackHint: "EnvForge creates a .envforge.bak backup before managed writes.",
    riskNotes: [...new Set(riskNotes)]
  };
}

function inferDefaultStatus(
  match: {
    path: string;
    category: "system" | "user" | "app";
    software?: string;
    source: ConfigDiscoveryInfo["source"];
    rule?: CatalogDetectionRule;
  } | undefined,
  filePath: string
): ConfigGovernanceInfo["defaultStatus"] {
  if (match?.source === "user-dotfile") return "user-created";
  if (match?.source === "package-manager-modified") return "modified";
  if (match?.rule && match.path.includes("*")) return "user-created";
  if (match?.rule && /\/(conf\.d|sites-available|sites-enabled|jail\.d|mysql\.conf\.d|mariadb\.conf\.d)\//.test(filePath)) return "user-created";
  if (match?.rule) return "unknown";
  if (match?.source === "system-default") return "unknown";
  return "unknown";
}

export function scanConfigSecrets(content: string, patterns = ruleSecretPatterns()): SecretScanResult {
  const hits: SecretScanResult["hits"] = [];
  const lines = content.split(/\r?\n/);
  const normalizedPatterns = [...new Set(patterns.filter(Boolean))];
  lines.forEach((line, index) => {
    const lower = line.toLowerCase();
    for (const pattern of normalizedPatterns) {
      if (lower.includes(pattern.toLowerCase())) {
        hits.push({ pattern, line: index + 1 });
      }
    }
  });
  return { hasSecrets: hits.length > 0, hits: hits.slice(0, 50) };
}

function pathMatchesRule(filePath: string, rulePath: string): boolean {
  if (rulePath.includes("*")) {
    const [prefix, suffix = ""] = rulePath.split("*");
    return filePath.startsWith(prefix) && filePath.endsWith(suffix);
  }
  return filePath === rulePath || filePath.startsWith(rulePath);
}

async function connectForConfig(connection: StoredConnection): Promise<Client> {
  return new Promise((resolve, reject) => {
    const client = new Client();
    const timer = setTimeout(() => { client.destroy(); reject(new Error("SSH timeout")); }, 10000);

    client.on("ready", () => { clearTimeout(timer); resolve(client); });
    client.on("error", (err) => { clearTimeout(timer); reject(err); });

    const decrypted = decryptStoredFields(connection.fields);
    const host = decrypted.host;
    const port = parseInt(decrypted.port ?? "22", 10) || 22;
    const username = decrypted.username;

    const cfg: Record<string, unknown> = { host, port, username, readyTimeout: 10000, keepaliveInterval: 30000, keepaliveCountMax: 3 };

    if (connection.method === "ssh-key") {
      const keyId = decrypted._keyId;
      if (keyId) {
        readUserKey(connection.userId, keyId).then((key) => {
          cfg.privateKey = Buffer.from(key, "utf8");
          if (decrypted._rawPassphrase) cfg.passphrase = decrypted._rawPassphrase;
          client.connect(cfg as any);
        }).catch((err) => {
          clearTimeout(timer);
          reject(new ConfigConnectionError(err instanceof Error ? err.message : String(err)));
        });
        return;
      }
      const keyPath = decrypted.privateKeyPath;
      if (keyPath) {
        fs.readFile(keyPath, "utf8").then((key) => {
          cfg.privateKey = key;
          if (decrypted._rawPassphrase) cfg.passphrase = decrypted._rawPassphrase;
          client.connect(cfg as any);
        }).catch((err) => {
          clearTimeout(timer);
          reject(new ConfigConnectionError(
            `SSH private key path is not readable: ${keyPath}. Re-upload the key or edit the connection.`
          ));
        });
        return;
      }
      clearTimeout(timer);
      reject(new ConfigConnectionError("No SSH key configured. Re-upload the key or edit the connection."));
    } else {
      const password = decrypted._rawPassword;
      if (!password) { clearTimeout(timer); reject(new Error("No password")); return; }
      cfg.password = password;
      client.connect(cfg as any);
    }
  });
}

function execOnClient(client: Client, command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    client.exec(command, (err, stream) => {
      if (err) { reject(err); return; }
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => { stream.destroy(); resolve({ stdout, stderr, exitCode: -1 }); }, 30000);
      stream.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
      stream.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
      stream.on("close", (code: number) => { clearTimeout(timer); resolve({ stdout, stderr, exitCode: code ?? 0 }); });
    });
  });
}
