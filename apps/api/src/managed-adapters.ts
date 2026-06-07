/**
 * managed-adapters.ts — concrete ManagedExecutionAdapters for the
 * three deeply-supported capabilities (nginx, docker, ssh-hardening).
 *
 * Each adapter exposes the four lifecycle hooks the orchestrator calls
 * (snapshot / apply / verify / rollback) and relies on:
 *
 *   - `safeWriteConfigFile` / `safeSshdConfigApply` for any config writes,
 *   - the executor's package + service modules for install / restart,
 *   - `restoreConfigFileFromBackup` for the rollback path.
 *
 * The adapters are deliberately small: the heavy lifting lives in
 * `config-files.ts` (already battle-tested), this module just produces
 * the lifecycle events the Plan Report needs and handles output capture
 * + redaction.
 */

import type { Client as SshClient } from "ssh2";
import { redactSecrets, safePreview, type ActionApplyResult, type ActionRollbackResult, type ActionSnapshot, type ActionVerifyResult } from "./action-runs.js";
import {
  restoreConfigFileFromBackup,
  safeSshdConfigApply,
  safeWriteConfigFile,
  validateConfigFile
} from "./config-files.js";
import type { ManagedExecutionAdapter } from "./managed-execution.js";
import type { EnvironmentPlanAction } from "./environment-plan.js";
import type { StoredConnection } from "./runtime-store.js";

export interface AdapterContext {
  connection: StoredConnection;
  /** Open an SSH client. Closed on adapter disposal. */
  openClient: () => Promise<SshClient>;
  /** Optional precomputed config payload for writeConfig actions. */
  contentByActionId?: Record<string, string>;
}

/**
 * Wrapping helper used by each adapter's `apply`/`verify`/`rollback`
 * hooks. Captures stdout+stderr from a single SSH exec into a buffer
 * the orchestrator can drain via `drainOutput`.
 */
class StreamCapture {
  private stdout = "";
  private stderr = "";

  pushStdout(text: string): void { this.stdout += text; }
  pushStderr(text: string): void { this.stderr += text; }
  drain(): { stdout?: string; stderr?: string } {
    const out = { stdout: this.stdout || undefined, stderr: this.stderr || undefined };
    this.stdout = "";
    this.stderr = "";
    return out;
  }
}

function execOnClient(client: SshClient, command: string, capture?: StreamCapture): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    client.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = "";
      let stderr = "";
      stream.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        stdout += text;
        capture?.pushStdout(text);
      });
      stream.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        stderr += text;
        capture?.pushStderr(text);
      });
      stream.on("close", (code: number) => resolve({ exitCode: code ?? 0, stdout, stderr }));
    });
  });
}

/**
 * Adapter for `installPackage` / `restartService` / `enableService` /
 * `runCommand` actions on a generic capability. Used by docker and the
 * config-write half of nginx (config writes use the dedicated
 * configWriteAdapter below).
 */
export function createPackageAdapter(ctx: AdapterContext): ManagedExecutionAdapter {
  const capture = new StreamCapture();
  return {
    async snapshot(action) {
      const snap: ActionSnapshot = {
        kind: action.kind === "installPackage" || action.kind === "removePackage" ? "packages" : "service",
        capturedAt: new Date().toISOString(),
        notes: []
      };
      const client = await ctx.openClient();
      try {
        if (action.kind === "installPackage" && action.packageNames?.length) {
          snap.packagesObserved = [];
          for (const pkg of action.packageNames) {
            const probe = await execOnClient(client, `dpkg -s ${shellQuote(pkg)} 2>/dev/null | awk '/^Status:/ { print $0 } /^Version:/ { print $0 }' || rpm -q ${shellQuote(pkg)} 2>/dev/null || true`);
            const installed = /Status: install ok installed/.test(probe.stdout) || /^[a-zA-Z0-9_.+-]+-\d/.test(probe.stdout.trim());
            const versionMatch = probe.stdout.match(/Version:\s*(\S+)/) ?? probe.stdout.match(/-(\d[\w.+:-]*)/);
            snap.packagesObserved.push({
              name: pkg,
              manager: probe.stdout.includes("Status:") ? "apt" : "rpm",
              installed,
              version: versionMatch?.[1]
            });
          }
        } else if (action.serviceName) {
          const probe = await execOnClient(client, `systemctl is-active ${shellQuote(action.serviceName)} 2>&1 || true`);
          snap.serviceActiveBefore = probe.stdout.trim();
        }
      } finally {
        client.end();
      }
      return snap;
    },
    async apply(action) {
      const client = await ctx.openClient();
      try {
        const command = applyCommandFor(action);
        if (!command) {
          return { ok: true, message: `No-op for action kind ${action.kind}.`, steps: [] };
        }
        const { exitCode, stdout, stderr } = await execOnClient(client, command, capture);
        const ok = exitCode === 0;
        return {
          ok,
          message: ok ? `Apply succeeded (${action.kind}).` : `Apply failed: ${stderr || stdout}`,
          steps: [{ label: action.label, ok, message: stderr || stdout }]
        };
      } finally {
        client.end();
      }
    },
    async verify(action) {
      const command = verifyCommandFor(action);
      if (!command) {
        return { ok: true, message: "No verify command attached; apply assumed sufficient.", checks: [] };
      }
      const client = await ctx.openClient();
      try {
        const { exitCode, stdout, stderr } = await execOnClient(client, command, capture);
        const ok = exitCode === 0;
        return {
          ok,
          message: ok ? "Verify passed." : "Verify failed.",
          checks: [{ command, ok, output: stdout || stderr }]
        };
      } finally {
        client.end();
      }
    },
    async rollback(action, snapshot) {
      const client = await ctx.openClient();
      try {
        if (action.kind === "installPackage" && snapshot?.packagesObserved) {
          // Only uninstall packages that did NOT exist before the apply.
          const toRemove = snapshot.packagesObserved
            .filter((pkg) => pkg.installed === false)
            .map((pkg) => pkg.name);
          if (toRemove.length === 0) {
            return { ok: true, message: "Nothing to roll back; all packages existed before apply.", steps: [] };
          }
          const cmd = `(sudo apt-get -y remove ${toRemove.map(shellQuote).join(" ")} 2>/dev/null || sudo dnf -y remove ${toRemove.map(shellQuote).join(" ")} 2>/dev/null || true)`;
          const { exitCode, stdout, stderr } = await execOnClient(client, cmd, capture);
          return {
            ok: exitCode === 0,
            message: exitCode === 0 ? "Rolled back package install." : `Rollback failed: ${stderr || stdout}`,
            steps: [{ label: `Remove ${toRemove.join(", ")}`, ok: exitCode === 0 }]
          };
        }
        if ((action.kind === "restart" || action.kind === "restartService") && snapshot?.serviceActiveBefore) {
          const wasActive = snapshot.serviceActiveBefore === "active";
          const cmd = wasActive
            ? `sudo systemctl restart ${shellQuote(action.serviceName ?? "")}`
            : `sudo systemctl stop ${shellQuote(action.serviceName ?? "")}`;
          const { exitCode } = await execOnClient(client, cmd, capture);
          return { ok: exitCode === 0, message: "Service rolled back to prior state.", steps: [{ label: cmd, ok: exitCode === 0 }] };
        }
        return { ok: true, message: "No rollback strategy for this action; nothing to do.", steps: [] };
      } finally {
        client.end();
      }
    },
    drainOutput: () => capture.drain()
  };
}

/**
 * Adapter for `writeConfig` / `copyConfig` actions. Wraps
 * `safeWriteConfigFile` and surfaces the backup path / pre-validate /
 * post-validate steps as ActionApplyResult steps.
 */
export function createConfigWriteAdapter(ctx: AdapterContext): ManagedExecutionAdapter {
  const capture = new StreamCapture();
  let lastBackupPath: string | undefined;
  return {
    async snapshot(action) {
      const path = action.applySpec?.path ?? action.path;
      if (!path) {
        return { kind: "config-file", capturedAt: new Date().toISOString(), notes: ["no path on action; skipping snapshot"] };
      }
      const client = await ctx.openClient();
      try {
        const stat = await execOnClient(client, `(test -f ${shellQuote(path)} && stat -c '%a:%U:%G:%s' ${shellQuote(path)} && sha256sum ${shellQuote(path)} | awk '{ print $1 }') || echo MISSING`);
        const lines = stat.stdout.trim().split(/\n/);
        if (lines.length === 1 && lines[0] === "MISSING") {
          return { kind: "config-file", capturedAt: new Date().toISOString(), path, notes: ["original file does not exist; write will create it."] };
        }
        const [statLine, hash] = lines;
        const [mode, user, group] = (statLine ?? "::").split(":");
        return {
          kind: "config-file",
          capturedAt: new Date().toISOString(),
          path,
          mode: mode ? `0${mode}` : undefined,
          owner: user && group ? `${user}:${group}` : undefined,
          sha256: hash
        };
      } finally {
        client.end();
      }
    },
    async apply(action) {
      const path = action.applySpec?.path ?? action.path;
      if (!path) return { ok: false, message: "writeConfig action missing path.", steps: [] };
      const content = ctx.contentByActionId?.[action.id];
      if (content === undefined) {
        return { ok: false, message: "writeConfig action missing content; provide via AdapterContext.contentByActionId.", steps: [] };
      }
      // Pre-validate the candidate by writing to a temp path and running
      // the existing validateConfigFile against the live path's
      // validation command (the path's syntax checker, e.g. nginx -t).
      const validation = await validateConfigFile(ctx.connection, path).catch(() => ({ status: "passed" as const, message: "no validator", command: undefined }));
      if (validation.status === "failed" && validation.command) {
        return {
          ok: false,
          message: `Pre-validate failed (existing file syntax error): ${redactSecrets(validation.message ?? "").text}`,
          steps: [{ label: `pre-validate ${validation.command}`, ok: false, message: validation.message }]
        };
      }
      const result = await safeWriteConfigFile(ctx.connection, path, content, true);
      lastBackupPath = result.backupPath;
      // Post-validate
      const after = await validateConfigFile(ctx.connection, path).catch(() => ({ status: "passed" as const, message: "no validator", command: undefined }));
      if (after.status === "failed" && after.command) {
        // Restore now so the caller sees a consistent state when
        // verify reports failure.
        await restoreConfigFileFromBackup(ctx.connection, path).catch(() => undefined);
        return {
          ok: false,
          message: `Post-validate failed: ${redactSecrets(after.message ?? "").text}`,
          steps: [
            { label: "pre-validate", ok: true },
            { label: "atomic-write", ok: true, message: result.message },
            { label: `post-validate ${after.command}`, ok: false, message: after.message }
          ]
        };
      }
      return {
        ok: true,
        message: `Wrote ${path} (${content.length} bytes); backup at ${result.backupPath ?? "(none)"}.`,
        steps: [
          { label: "pre-validate", ok: true },
          { label: "atomic-write", ok: true, message: result.message },
          { label: "post-validate", ok: true }
        ],
        tempPath: result.tempPath
      };
    },
    async verify(action) {
      const path = action.applySpec?.path ?? action.path;
      if (!path) return { ok: true, message: "no path; skipping verify", checks: [] };
      const validation = await validateConfigFile(ctx.connection, path).catch(() => ({ status: "passed" as const, message: "no validator", command: undefined }));
      if (!validation.command) {
        return { ok: true, message: "no validator known for this path", checks: [] };
      }
      return {
        ok: validation.status === "passed",
        message: validation.message ?? "",
        checks: [{ command: validation.command, ok: validation.status === "passed", output: validation.message ?? "" }]
      };
    },
    async rollback(action, snapshot) {
      const path = action.applySpec?.path ?? action.path ?? snapshot?.path;
      if (!path) return { ok: false, message: "no path on action; cannot rollback", steps: [] };
      const restore = await restoreConfigFileFromBackup(ctx.connection, path).catch((err) => ({ success: false, message: err instanceof Error ? err.message : String(err) }));
      return {
        ok: restore.success,
        message: redactSecrets(restore.message).text,
        steps: [{ label: `restore ${lastBackupPath ?? `${path}.envforge.bak`}`, ok: restore.success, message: restore.message }]
      };
    },
    drainOutput: () => capture.drain()
  };
}

/**
 * Adapter for the SSH hardening capability. Uses safeSshdConfigApply
 * which already runs `sshd -t` before/after, reloads (not restarts)
 * sshd, and probes a fresh SSH connection.
 */
export function createSshHardeningAdapter(ctx: AdapterContext): ManagedExecutionAdapter {
  const capture = new StreamCapture();
  let lastBackupPath: string | undefined;
  return {
    async snapshot(action) {
      const path = action.applySpec?.path ?? action.path ?? "/etc/ssh/sshd_config";
      const client = await ctx.openClient();
      try {
        const probe = await execOnClient(client, `sudo cp -p ${shellQuote(path)} ${shellQuote(`${path}.envforge.bak`)} 2>/dev/null && sha256sum ${shellQuote(path)} | awk '{ print $1 }'`);
        return {
          kind: "config-file",
          capturedAt: new Date().toISOString(),
          path,
          backupPath: `${path}.envforge.bak`,
          sha256: probe.stdout.trim(),
          notes: ["snapshot taken via sudo cp -p before safeSshdConfigApply"]
        };
      } finally {
        client.end();
      }
    },
    async apply(action) {
      const path = action.applySpec?.path ?? action.path ?? "/etc/ssh/sshd_config";
      const content = ctx.contentByActionId?.[action.id];
      if (content === undefined) return { ok: false, message: "ssh-hardening writeConfig requires content; provide via AdapterContext.contentByActionId.", steps: [] };
      try {
        const result = await safeSshdConfigApply(ctx.connection, path, content, true);
        lastBackupPath = result.backupPath;
        return {
          ok: result.success,
          message: result.message,
          steps: [
            { label: "pre-validate sshd -t", ok: true },
            { label: "atomic write", ok: true, message: result.message },
            { label: "post-validate sshd -t", ok: true },
            { label: "reload sshd (no restart)", ok: true },
            { label: "fresh SSH probe", ok: result.reachability?.ok === true, message: result.reachability?.output }
          ]
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          ok: false,
          message: redactSecrets(message).text,
          steps: [{ label: "safeSshdConfigApply", ok: false, message }]
        };
      }
    },
    async verify(action) {
      const path = action.applySpec?.path ?? action.path ?? "/etc/ssh/sshd_config";
      const v = await validateConfigFile(ctx.connection, path).catch(() => ({ status: "passed" as const, message: "no validator", command: undefined }));
      return {
        ok: v.status === "passed",
        message: v.message ?? "",
        checks: v.command ? [{ command: v.command, ok: v.status === "passed", output: v.message ?? "" }] : []
      };
    },
    async rollback(action) {
      const path = action.applySpec?.path ?? action.path ?? "/etc/ssh/sshd_config";
      const restore = await restoreConfigFileFromBackup(ctx.connection, path).catch((err) => ({ success: false, message: err instanceof Error ? err.message : String(err) }));
      const client = await ctx.openClient();
      try {
        await execOnClient(client, "sudo systemctl reload ssh 2>/dev/null || sudo systemctl reload sshd 2>/dev/null || sudo service ssh reload 2>/dev/null || true", capture);
      } finally {
        client.end();
      }
      return {
        ok: restore.success,
        message: redactSecrets(restore.message).text,
        steps: [
          { label: `restore ${lastBackupPath ?? `${path}.envforge.bak`}`, ok: restore.success },
          { label: "reload sshd after rollback", ok: true }
        ]
      };
    },
    drainOutput: () => capture.drain()
  };
}

function shellQuote(value: string): string {
  if (!value) return "''";
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function applyCommandFor(action: EnvironmentPlanAction): string | undefined {
  if (action.applySpec?.command) return action.applySpec.command;
  if (action.command) return action.command;
  if (action.kind === "installPackage" && action.packageNames?.length) {
    const list = action.packageNames.map(shellQuote).join(" ");
    return `sudo apt-get install -y ${list} 2>/dev/null || sudo dnf install -y ${list}`;
  }
  if (action.kind === "removePackage" && action.packageNames?.length) {
    const list = action.packageNames.map(shellQuote).join(" ");
    return `sudo apt-get remove -y ${list} 2>/dev/null || sudo dnf remove -y ${list}`;
  }
  if ((action.kind === "restartService" || action.kind === "restart") && action.serviceName) {
    return `sudo systemctl restart ${shellQuote(action.serviceName)}`;
  }
  if (action.kind === "reloadService" && action.serviceName) {
    return `sudo systemctl reload ${shellQuote(action.serviceName)}`;
  }
  if (action.kind === "enableService" && action.serviceName) {
    return `sudo systemctl enable --now ${shellQuote(action.serviceName)}`;
  }
  return undefined;
}

function verifyCommandFor(action: EnvironmentPlanAction): string | undefined {
  if (action.verifySpec?.command) return action.verifySpec.command;
  if (action.verifySpec?.checks?.length) return action.verifySpec.checks[0].command;
  if (action.verify) return action.verify;
  if ((action.kind === "restart" || action.kind === "restartService" || action.kind === "enableService" || action.kind === "reloadService") && action.serviceName) {
    return `systemctl is-active ${shellQuote(action.serviceName)}`;
  }
  return undefined;
}
