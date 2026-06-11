import React from "react";
import type { Locale } from "../lib/types";

/**
 * WorkflowStepper — visualises the Migrate / Build / Maintain pipelines.
 *
 * EnvForge's three modes share a Plan-centric flow but each one has its own
 * sequence of stages. Rather than scattering progress hints across panels,
 * this component renders the pipeline as a labelled stepper at the top of
 * the page so the operator always knows which step they're on and what
 * remains.
 *
 * Steps can be marked as `done`, `current`, `todo`, or `blocked`; the
 * blocked state is used when an upstream prerequisite has not been met
 * (e.g. Source VM has not been probed yet so Migration Plan cannot be
 * generated).
 */
export type WorkflowStepStatus = "done" | "current" | "todo" | "blocked";

export interface WorkflowStep {
  id: string;
  label: { zh: string; en: string };
  status: WorkflowStepStatus;
  hint?: { zh: string; en: string };
}

export function WorkflowStepper({
  steps,
  locale,
  title
}: {
  steps: WorkflowStep[];
  locale: Locale;
  title?: { zh: string; en: string };
}) {
  return (
    <section className="workflow-stepper">
      {title ? (
        <div className="workflow-stepper-title">
          {locale === "zh" ? title.zh : title.en}
        </div>
      ) : null}
      <ol className="workflow-stepper-list">
        {steps.map((step, idx) => (
          <li key={step.id} className="workflow-stepper-item">
            <div className="workflow-stepper-content">
              <div className="workflow-stepper-main">
                <span
                  className={`workflow-step-bullet workflow-step-${step.status}`}
                  aria-label={statusLabel(step.status, locale)}
                >
                  {step.status === "done" ? "✓" : step.status === "blocked" ? "!" : idx + 1}
                </span>
                <strong className={`workflow-step-label workflow-step-label-${step.status}`}>
                  {locale === "zh" ? step.label.zh : step.label.en}
                </strong>
              </div>
              {step.hint ? (
                <small className="workflow-step-hint">
                  {locale === "zh" ? step.hint.zh : step.hint.en}
                </small>
              ) : null}
            </div>
            {idx < steps.length - 1 ? (
              <span
                aria-hidden
                className={`workflow-step-connector ${step.status === "done" ? "done" : ""}`}
              />
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function statusLabel(status: WorkflowStepStatus, locale: Locale): string {
  const zh = { done: "已完成", current: "进行中", todo: "待办", blocked: "受阻" } as const;
  const en = { done: "Done", current: "Current", todo: "To do", blocked: "Blocked" } as const;
  return (locale === "zh" ? zh : en)[status];
}

/**
 * Build the canonical Migrate Mode pipeline.
 *
 * The pipeline matches docs/product.md and docs/system-design.md:
 *
 *   Source VM -> Snapshot -> Analysis -> Review Queue -> Migration Plan
 *   -> Target VM -> Apply & Verify -> Report
 */
export function buildMigrateSteps(input: {
  hasConnection: boolean;
  hasSnapshot: boolean;
  hasCandidates: boolean;
  reviewPending: number;
  hasPlan: boolean;
  hasTarget: boolean;
  hasApplied: boolean;
}): WorkflowStep[] {
  const status = (cond: boolean, deps = true): WorkflowStepStatus => (cond ? "done" : deps ? "current" : "blocked");
  return [
    {
      id: "source-vm",
      label: { zh: "源主机", en: "Source VM" },
      status: input.hasConnection ? "done" : "current",
      hint: { zh: "通过 SSH 连接旧机器", en: "Connect to the old VM through SSH" }
    },
    {
      id: "snapshot",
      label: { zh: "主机快照", en: "Snapshot" },
      status: status(input.hasSnapshot, input.hasConnection),
      hint: { zh: "只读采集 OS / 包 / 服务 / 配置", en: "Read-only collect OS / packages / services / configs" }
    },
    {
      id: "analysis",
      label: { zh: "环境分析", en: "Analysis" },
      status: status(input.hasCandidates, input.hasSnapshot),
      hint: { zh: "包意图评分与候选分类", en: "Package Intent Score + classifier" }
    },
    {
      id: "review-queue",
      label: { zh: "审查队列", en: "Review Queue" },
      status: input.reviewPending === 0 && input.hasCandidates ? "done" : input.hasCandidates ? "current" : "blocked",
      hint: input.reviewPending > 0
        ? { zh: `还有 ${input.reviewPending} 项待决策`, en: `${input.reviewPending} item(s) pending decision` }
        : { zh: "未知项决策已完成", en: "All unknown items decided" }
    },
    {
      id: "plan",
      label: { zh: "迁移计划", en: "Migration Plan" },
      status: status(input.hasPlan, input.hasCandidates),
      hint: { zh: "生成可审查的迁移计划", en: "Generate the reviewable migration plan" }
    },
    {
      id: "target",
      label: { zh: "目标主机", en: "Target VM" },
      status: status(input.hasTarget, input.hasPlan),
      hint: { zh: "选择并连接目标机器", en: "Pick and connect the target VM" }
    },
    {
      id: "apply-verify",
      label: { zh: "执行与验证", en: "Apply & Verify" },
      status: status(input.hasApplied, input.hasTarget),
      hint: { zh: "执行计划并自动验证", en: "Apply the plan and run verifications" }
    },
    {
      id: "report",
      label: { zh: "报告", en: "Report" },
      status: input.hasApplied ? "done" : "todo",
      hint: { zh: "生成迁移报告", en: "Produce the migration report" }
    }
  ];
}

/**
 * Build the canonical Build Mode pipeline.
 *
 * Per the design document the pipeline has 9 explicit stages:
 *
 *   Target VM
 *   -> Target Snapshot
 *   -> Certified Capabilities
 *   -> Resolve Conflicts
 *   -> Rebuild Plan
 *   -> Review
 *   -> Apply
 *   -> Verify
 *   -> Report
 *
 * Each stage has its own state so the operator can see exactly which
 * step is the next blocking action. The `Apply` and `Verify` steps were
 * previously merged into a single `Apply & Verify` step; they are now
 * split because the lifecycle endpoints (`/apply`, `/verify`) and their
 * results live separately.
 */
export function buildBuildSteps(input: {
  hasConnection: boolean;
  /** Target VM read-only inventory has been collected at least once. */
  hasTargetSnapshot?: boolean;
  hasSelection: boolean;
  hasConflictsResolved: boolean;
  hasPlan: boolean;
  /** Plan has moved past `needs-review` (i.e. status === "approved" or later). */
  hasReviewed?: boolean;
  hasApplied: boolean;
  /** Verify run produced at least one result for the active plan. */
  hasVerified?: boolean;
  /** Plan has reached a terminal status (`succeeded` / `failed` / `rolled-back` / `committed`). */
  hasReport?: boolean;
}): WorkflowStep[] {
  const status = (cond: boolean, deps = true): WorkflowStepStatus => (cond ? "done" : deps ? "current" : "blocked");
  // Backwards-compat: when callers pass only the old 5-step signal set
  // (no snapshot / reviewed / verified / report), light up the steps from
  // existing approximations.
  const hasTargetSnapshot = input.hasTargetSnapshot ?? input.hasConnection;
  const hasReviewed = input.hasReviewed ?? input.hasPlan;
  const hasVerified = input.hasVerified ?? input.hasApplied;
  const hasReport = input.hasReport ?? input.hasApplied;

  return [
    {
      id: "target-vm",
      label: { zh: "目标主机", en: "Target VM" },
      status: input.hasConnection ? "done" : "current",
      hint: { zh: "连接干净的目标机器", en: "Connect to the clean target VM" }
    },
    {
      id: "target-snapshot",
      label: { zh: "目标快照", en: "Target Snapshot" },
      status: status(hasTargetSnapshot, input.hasConnection),
      hint: { zh: "只读读取目标主机当前状态", en: "Read-only collect the target state" }
    },
    {
      id: "catalog",
      label: { zh: "已认证能力", en: "Certified Capabilities" },
      status: status(input.hasSelection, hasTargetSnapshot),
      hint: { zh: "选择已认证能力", en: "Pick certified capabilities" }
    },
    {
      id: "conflicts",
      label: { zh: "处理冲突", en: "Resolve Conflicts" },
      status: status(input.hasConflictsResolved, input.hasSelection),
      hint: { zh: "处理兼容性冲突", en: "Resolve compatibility conflicts" }
    },
    {
      id: "rebuild-plan",
      label: { zh: "重建计划", en: "Rebuild Plan" },
      status: status(input.hasPlan, input.hasConflictsResolved),
      hint: { zh: "生成可审查的重建计划", en: "Generate the reviewable rebuild plan" }
    },
    {
      id: "review",
      label: { zh: "审查", en: "Review" },
      status: status(hasReviewed, input.hasPlan),
      hint: { zh: "审查动作、风险与回滚", en: "Review actions, risks, and rollback" }
    },
    {
      id: "apply",
      label: { zh: "执行", en: "Apply" },
      status: status(input.hasApplied, hasReviewed),
      hint: { zh: "执行已审查的计划", en: "Execute the reviewed plan" }
    },
    {
      id: "verify",
      label: { zh: "验证", en: "Verify" },
      status: status(hasVerified, input.hasApplied),
      hint: { zh: "运行规则库验证检查", en: "Run catalog-defined verifications" }
    },
    {
      id: "report",
      label: { zh: "报告", en: "Report" },
      status: hasReport ? "done" : "todo",
      hint: { zh: "查看 Markdown 报告", en: "View the Markdown report" }
    }
  ];
}
