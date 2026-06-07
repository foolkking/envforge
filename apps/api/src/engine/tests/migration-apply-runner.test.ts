import test from "node:test";
import assert from "node:assert/strict";
import { applyMigrationPlanWithExecutor } from "../../migration-apply-runner.js";
import type { MigrationPlan } from "../../migration-classifier.js";
import type { SshExecutor } from "../types.js";

class FakeExecutor implements SshExecutor {
  calls: string[] = [];
  installed = new Set<string>();

  async exec(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    this.calls.push(command);
    if (command.includes("command -v apt-get")) return { stdout: "/usr/bin/apt-get\n", stderr: "", exitCode: 0 };
    if (command.startsWith("dpkg-query") || command.startsWith("(dpkg-query")) {
      const pkg = command.includes("nginx") ? "nginx" : "";
      return { stdout: "", stderr: "", exitCode: pkg && this.installed.has(pkg) ? 0 : 1 };
    }
    if (command === "sudo apt-get update -qq") return { stdout: "", stderr: "", exitCode: 0 };
    if (command.includes("apt-get install") && command.includes("nginx")) {
      this.installed.add("nginx");
      return { stdout: "installed nginx", stderr: "", exitCode: 0 };
    }
    if (command.includes("apt-get remove") && command.includes("nginx")) {
      this.installed.delete("nginx");
      return { stdout: "removed nginx", stderr: "", exitCode: 0 };
    }
    if (command === "nginx -t") return { stdout: "", stderr: "bad config", exitCode: 1 };
    return { stdout: "", stderr: "", exitCode: 0 };
  }

  async putFile(): Promise<void> {}
  async getFile(): Promise<string> { return ""; }
  async pathExists(): Promise<boolean> { return false; }
}

test("migration apply installs approved packages and rolls back on validate failure", async () => {
  const plan: MigrationPlan = {
    sourceHost: "vm-old",
    generatedAt: "2026-05-28T00:00:00.000Z",
    items: [{
      id: "catalog:nginx",
      name: "nginx",
      type: "managed-software",
      confidence: 0.96,
      risks: [],
      userDecision: "approved",
      actions: [
        { kind: "installPackage", label: "Install package/capability Nginx.", packageNames: ["nginx"] },
        { kind: "validate", label: "Validate with: nginx -t.", command: "nginx -t" }
      ]
    }]
  };
  const executor = new FakeExecutor();
  const result = await applyMigrationPlanWithExecutor(plan, executor);
  assert.equal(result.ok, false);
  assert.equal(result.rolledBack, true);
  assert.equal(executor.installed.has("nginx"), false);
  assert.ok(result.steps.some((step) => step.action === "rollback" && step.status === "rolled-back"));
});

test("migration apply skips unapproved items and safe-MVP config copy", async () => {
  const plan: MigrationPlan = {
    sourceHost: "vm-old",
    generatedAt: "2026-05-28T00:00:00.000Z",
    items: [
      {
        id: "catalog:nginx",
        name: "nginx",
        type: "managed-software",
        confidence: 0.96,
        risks: [],
        userDecision: "approved",
        actions: [{ kind: "copyConfig", label: "Copy catalog-owned config files with backup and diff.", configPaths: ["/etc/nginx/nginx.conf"] }]
      },
      {
        id: "npm:eslint",
        name: "eslint",
        type: "language-global-package",
        confidence: 0.5,
        risks: [],
        userDecision: "pending",
        actions: [{ kind: "installPackage", label: "Install package/capability eslint.", packageNames: ["eslint"] }]
      }
    ]
  };
  const result = await applyMigrationPlanWithExecutor(plan, new FakeExecutor());
  assert.equal(result.ok, true);
  assert.equal(result.summary.skipped, 2);
});
