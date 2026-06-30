import React from "react";
import { useTranslation } from "react-i18next";
import type { Locale } from "../lib/types";

export type WorkflowStepStatus = "done" | "current" | "todo" | "blocked";

const STATUS_KEYS = {
  done: "workflow.status.done",
  current: "workflow.status.current",
  todo: "workflow.status.todo",
  blocked: "workflow.status.blocked"
} as const;

const MIGRATE_KEYS = {
  sourceVm: "workflow.migrate.sourceVm",
  sourceVmHint: "workflow.migrate.sourceVmHint",
  snapshot: "workflow.migrate.snapshot",
  snapshotHint: "workflow.migrate.snapshotHint",
  analysis: "workflow.migrate.analysis",
  analysisHint: "workflow.migrate.analysisHint",
  reviewQueue: "workflow.migrate.reviewQueue",
  reviewPending: "workflow.migrate.reviewPending",
  reviewDone: "workflow.migrate.reviewDone",
  plan: "workflow.migrate.plan",
  planHint: "workflow.migrate.planHint",
  target: "workflow.migrate.target",
  targetHint: "workflow.migrate.targetHint",
  applyVerify: "workflow.migrate.applyVerify",
  applyVerifyHint: "workflow.migrate.applyVerifyHint",
  report: "workflow.migrate.report",
  reportHint: "workflow.migrate.reportHint"
} as const;

const BUILD_KEYS = {
  title: "workflow.build.title",
  targetVm: "workflow.build.targetVm",
  targetVmHint: "workflow.build.targetVmHint",
  targetSnapshot: "workflow.build.targetSnapshot",
  targetSnapshotHint: "workflow.build.targetSnapshotHint",
  catalog: "workflow.build.catalog",
  catalogHint: "workflow.build.catalogHint",
  conflicts: "workflow.build.conflicts",
  conflictsHint: "workflow.build.conflictsHint",
  rebuildPlan: "workflow.build.rebuildPlan",
  rebuildPlanHint: "workflow.build.rebuildPlanHint",
  review: "workflow.build.review",
  reviewHint: "workflow.build.reviewHint",
  apply: "workflow.build.apply",
  applyHint: "workflow.build.applyHint",
  verify: "workflow.build.verify",
  verifyHint: "workflow.build.verifyHint",
  report: "workflow.build.report",
  reportHint: "workflow.build.reportHint"
} as const;

type WorkflowTextKey =
  | (typeof STATUS_KEYS)[keyof typeof STATUS_KEYS]
  | (typeof MIGRATE_KEYS)[keyof typeof MIGRATE_KEYS]
  | (typeof BUILD_KEYS)[keyof typeof BUILD_KEYS];

export interface WorkflowStep {
  id: string;
  labelKey: WorkflowTextKey;
  status: WorkflowStepStatus;
  hint?: { key: WorkflowTextKey; count?: number };
}

export function WorkflowStepper({
  steps,
  titleKey
}: {
  steps: WorkflowStep[];
  locale: Locale;
  titleKey?: WorkflowTextKey;
}) {
  const { t } = useTranslation();
  return (
    <section className="workflow-stepper">
      {titleKey ? <div className="workflow-stepper-title">{t(titleKey)}</div> : null}
      <ol className="workflow-stepper-list">
        {steps.map((step, index) => (
          <li key={step.id} className="workflow-stepper-item">
            <div className="workflow-stepper-content">
              <div className="workflow-stepper-main">
                <span
                  className={`workflow-step-bullet workflow-step-${step.status}`}
                  aria-label={t(STATUS_KEYS[step.status])}
                >
                  {step.status === "done" ? "✓" : step.status === "blocked" ? "!" : index + 1}
                </span>
                <strong className={`workflow-step-label workflow-step-label-${step.status}`}>
                  {t(step.labelKey)}
                </strong>
              </div>
              {step.hint ? (
                <small className="workflow-step-hint">
                  {t(step.hint.key, { count: step.hint.count ?? 0 })}
                </small>
              ) : null}
            </div>
            {index < steps.length - 1 ? (
              <span aria-hidden className={`workflow-step-connector ${step.status === "done" ? "done" : ""}`} />
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function buildMigrateSteps(input: {
  hasConnection: boolean;
  hasSnapshot: boolean;
  hasCandidates: boolean;
  reviewPending: number;
  hasPlan: boolean;
  hasTarget: boolean;
  hasApplied: boolean;
}): WorkflowStep[] {
  const status = (condition: boolean, dependencies = true): WorkflowStepStatus => (condition ? "done" : dependencies ? "current" : "todo");
  return [
    {
      id: "source-vm",
      labelKey: MIGRATE_KEYS.sourceVm,
      status: input.hasConnection ? "done" : "current",
      hint: { key: MIGRATE_KEYS.sourceVmHint }
    },
    {
      id: "snapshot",
      labelKey: MIGRATE_KEYS.snapshot,
      status: status(input.hasSnapshot, input.hasConnection),
      hint: { key: MIGRATE_KEYS.snapshotHint }
    },
    {
      id: "analysis",
      labelKey: MIGRATE_KEYS.analysis,
      status: status(input.hasCandidates, input.hasSnapshot),
      hint: { key: MIGRATE_KEYS.analysisHint }
    },
    {
      id: "review-queue",
      labelKey: MIGRATE_KEYS.reviewQueue,
      status: input.reviewPending === 0 && input.hasCandidates ? "done" : input.hasCandidates ? "current" : "todo",
      hint: input.reviewPending > 0
        ? { key: MIGRATE_KEYS.reviewPending, count: input.reviewPending }
        : { key: MIGRATE_KEYS.reviewDone }
    },
    {
      id: "plan",
      labelKey: MIGRATE_KEYS.plan,
      status: status(input.hasPlan, input.hasCandidates),
      hint: { key: MIGRATE_KEYS.planHint }
    },
    {
      id: "target",
      labelKey: MIGRATE_KEYS.target,
      status: status(input.hasTarget, input.hasPlan),
      hint: { key: MIGRATE_KEYS.targetHint }
    },
    {
      id: "apply-verify",
      labelKey: MIGRATE_KEYS.applyVerify,
      status: status(input.hasApplied, input.hasTarget),
      hint: { key: MIGRATE_KEYS.applyVerifyHint }
    },
    {
      id: "report",
      labelKey: MIGRATE_KEYS.report,
      status: input.hasApplied ? "done" : "todo",
      hint: { key: MIGRATE_KEYS.reportHint }
    }
  ];
}

export function buildBuildSteps(input: {
  hasConnection: boolean;
  hasTargetSnapshot?: boolean;
  hasSelection: boolean;
  hasConflictsResolved: boolean;
  hasPlan: boolean;
  hasReviewed?: boolean;
  hasApplied: boolean;
  hasVerified?: boolean;
  hasReport?: boolean;
}): WorkflowStep[] {
  const status = (condition: boolean, dependencies = true): WorkflowStepStatus => (condition ? "done" : dependencies ? "current" : "todo");
  const hasTargetSnapshot = input.hasTargetSnapshot ?? input.hasConnection;
  const hasReviewed = input.hasReviewed ?? input.hasPlan;
  const hasVerified = input.hasVerified ?? input.hasApplied;
  const hasReport = input.hasReport ?? input.hasApplied;

  return [
    {
      id: "target-vm",
      labelKey: BUILD_KEYS.targetVm,
      status: input.hasConnection ? "done" : "current",
      hint: { key: BUILD_KEYS.targetVmHint }
    },
    {
      id: "target-snapshot",
      labelKey: BUILD_KEYS.targetSnapshot,
      status: status(hasTargetSnapshot, input.hasConnection),
      hint: { key: BUILD_KEYS.targetSnapshotHint }
    },
    {
      id: "catalog",
      labelKey: BUILD_KEYS.catalog,
      status: status(input.hasSelection, hasTargetSnapshot),
      hint: { key: BUILD_KEYS.catalogHint }
    },
    {
      id: "conflicts",
      labelKey: BUILD_KEYS.conflicts,
      status: status(input.hasConflictsResolved, input.hasSelection),
      hint: { key: BUILD_KEYS.conflictsHint }
    },
    {
      id: "rebuild-plan",
      labelKey: BUILD_KEYS.rebuildPlan,
      status: status(input.hasPlan, input.hasConflictsResolved),
      hint: { key: BUILD_KEYS.rebuildPlanHint }
    },
    {
      id: "review",
      labelKey: BUILD_KEYS.review,
      status: status(hasReviewed, input.hasPlan),
      hint: { key: BUILD_KEYS.reviewHint }
    },
    {
      id: "apply",
      labelKey: BUILD_KEYS.apply,
      status: status(input.hasApplied, hasReviewed),
      hint: { key: BUILD_KEYS.applyHint }
    },
    {
      id: "verify",
      labelKey: BUILD_KEYS.verify,
      status: status(hasVerified, input.hasApplied),
      hint: { key: BUILD_KEYS.verifyHint }
    },
    {
      id: "report",
      labelKey: BUILD_KEYS.report,
      status: hasReport ? "done" : "todo",
      hint: { key: BUILD_KEYS.reportHint }
    }
  ];
}

export const BUILD_PIPELINE_TITLE_KEY = BUILD_KEYS.title;
