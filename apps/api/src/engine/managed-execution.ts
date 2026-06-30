import type { Client as SshClient } from "ssh2";
import { newActionRunRecord, transition, type ActionApplyResult, type ActionRunRecord, type ActionSnapshot, type ActionVerifyResult } from "../action-runs.js";
import { getPlanArtifact } from "../artifact-store.js";
import type { EnvironmentPlan, EnvironmentPlanAction, EnvironmentPlanItem } from "../environment-plan.js";
import { createConfigWriteAdapter, createPackageAdapter, createSshHardeningAdapter, type AdapterContext } from "../managed-adapters.js";
import { appendActionRunRecord } from "../plan-store.js";
import { computeEnvironmentPlanHash, verifyEnvironmentPlanHash } from "../plan-hash.js";
import { runManagedAction, type ManagedExecutionAdapter } from "../managed-execution.js";
import type { StoredConnection } from "../runtime-store.js";
import { executePlaybook } from "./index.js";

export interface ManagedPlanExecutionResult {
  ok: boolean;
  dryRun: boolean;
  planId: string;
  planHash: string;
  applyRunId?: string;
  actionRuns: ActionRunRecord[];
  summary: { total: number; succeeded: number; failed: number; skipped: number };
}

export interface ExecuteEnvironmentPlanInput {
  userId: string;
  plan: EnvironmentPlan;
  planHash: string;
  applyRunId?: string;
  connection: StoredConnection;
  dryRun: boolean;
  openClient: () => Promise<SshClient>;
  adapterFactory?: (context: {
    plan: EnvironmentPlan;
    item: EnvironmentPlanItem;
    action: EnvironmentPlanAction;
    artifactContent?: Buffer;
    adapterContext: AdapterContext;
  }) => ManagedExecutionAdapter;
}

/** The only trusted mutating entry point for Environment Plan Apply. */
export async function executeEnvironmentPlan(input: ExecuteEnvironmentPlanInput): Promise<ManagedPlanExecutionResult> {
  const { plan } = input;
  if (!verifyEnvironmentPlanHash(plan)) throw new Error("Environment Plan integrity verification failed.");
  const currentHash = computeEnvironmentPlanHash(plan);
  if (currentHash !== input.planHash || currentHash !== plan.planHash) {
    throw new Error("Environment Plan hash mismatch before managed execution.");
  }
  if (!input.dryRun && (plan.status !== "approved" || plan.approvedPlanHash !== currentHash || plan.approvalRecord?.planHash !== currentHash)) {
    throw new Error("Managed execution requires hash-bound Environment Plan approval.");
  }
  if (!plan.targetConnectionId || plan.targetConnectionId !== input.connection.id) {
    throw new Error("Environment Plan target does not match the managed execution connection.");
  }

  const artifactContents = new Map<string, Buffer>();
  for (const artifact of plan.artifacts ?? []) {
    artifactContents.set(artifact.id, await getPlanArtifact(plan.id, artifact));
  }

  const actionRuns: ActionRunRecord[] = [];
  let haltedByActionId: string | undefined;
  for (const item of plan.items) {
    for (const action of item.actions) {
      if (haltedByActionId) {
        let skipped = newActionRunRecord({
          planId: plan.id,
          planHash: currentHash,
          itemId: item.id,
          actionId: action.id,
          targetConnectionId: input.connection.id,
          dryRun: input.dryRun,
          capabilityKey: item.capabilityKey ?? item.audit?.capabilityKey,
          capabilityId: action.capabilityId
        });
        skipped.applyResult = {
          ok: false,
          message: `Skipped because prior action ${haltedByActionId} did not complete successfully.`,
          steps: []
        };
        skipped = transition(skipped, "skipped");
        await appendActionRunRecord(plan.id, input.userId, skipped);
        actionRuns.push(skipped);
        continue;
      }
      const artifactId = action.applySpec?.artifactId;
      const artifactContent = artifactId ? artifactContents.get(artifactId) : undefined;
      if (artifactId && !artifactContent) throw new Error(`Frozen artifact not found for action ${action.id}.`);
      const contentByActionId = artifactContent ? { [action.id]: artifactContent.toString("utf8") } : undefined;
      const adapterContext: AdapterContext = {
        connection: input.connection,
        openClient: input.openClient,
        contentByActionId
      };
      const adapter = input.adapterFactory?.({ plan, item, action, artifactContent, adapterContext })
        ?? adapterForAction(plan, action, artifactContent, adapterContext);
      const run = await runManagedAction({ plan, item, action, adapter, dryRun: input.dryRun });
      await appendActionRunRecord(plan.id, input.userId, run);
      actionRuns.push(run);
      if (["failed", "rolled-back", "rollback-failed", "manual-required"].includes(run.status)) haltedByActionId = action.id;
    }
  }

  const failed = actionRuns.filter((run) => ["failed", "rolled-back", "rollback-failed", "manual-required"].includes(run.status)).length;
  const succeeded = actionRuns.filter((run) => run.status === "succeeded").length;
  const skipped = actionRuns.filter((run) => run.status === "skipped").length;
  return {
    ok: failed === 0,
    dryRun: input.dryRun,
    planId: plan.id,
    planHash: currentHash,
    applyRunId: input.applyRunId,
    actionRuns,
    summary: { total: actionRuns.length, succeeded, failed, skipped }
  };
}

function adapterForAction(
  plan: EnvironmentPlan,
  action: EnvironmentPlanAction,
  artifactContent: Buffer | undefined,
  context: AdapterContext
): ManagedExecutionAdapter {
  if (plan.type === "imported-recipe" && action.id === "recipe:apply") {
    if (!artifactContent) throw new Error("Imported recipe action is missing its frozen recipe artifact.");
    return createRecipeArtifactAdapter(context.connection, artifactContent.toString("utf8"));
  }
  if (action.kind === "writeConfig" || action.kind === "copyConfig") {
    const targetPath = action.applySpec?.path ?? action.path ?? "";
    return targetPath.startsWith("/etc/ssh/")
      ? createSshHardeningAdapter(context)
      : createConfigWriteAdapter(context);
  }
  return createPackageAdapter(context);
}

function createRecipeArtifactAdapter(connection: StoredConnection, yaml: string): ManagedExecutionAdapter {
  let stdout = "";
  let stderr = "";
  let lastApply: ActionApplyResult | undefined;
  return {
    async snapshot(): Promise<ActionSnapshot> {
      return { kind: "generic", capturedAt: new Date().toISOString(), notes: ["Recipe artifact hash verified before execution."] };
    },
    async apply(): Promise<ActionApplyResult> {
      const result = await executePlaybook(yaml, connection, {
        dryRun: false,
        onProgress: (log) => {
          if (log.command) stdout += `$ ${log.command}\n`;
          if (log.result?.stdout) stdout += `${log.result.stdout}\n`;
          if (log.result?.stderr) stderr += `${log.result.stderr}\n`;
        }
      });
      lastApply = {
        ok: result.ok,
        message: result.ok ? "Frozen recipe artifact applied." : (result.error ?? "Recipe apply failed."),
        steps: result.logs.map((log) => ({ label: log.taskName, ok: log.status !== "failed", message: log.result?.msg }))
      };
      return lastApply;
    },
    async verify(): Promise<ActionVerifyResult> {
      return {
        ok: lastApply?.ok === true,
        message: lastApply?.ok ? "Recipe runner verification completed." : "Recipe runner reported failure.",
        checks: []
      };
    },
    async rollback() {
      return { ok: false, message: "Imported recipe has no automatic rollback contract.", steps: [] };
    },
    drainOutput() {
      const drained = { stdout: stdout || undefined, stderr: stderr || undefined };
      stdout = "";
      stderr = "";
      return drained;
    }
  };
}
