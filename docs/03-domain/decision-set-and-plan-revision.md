---
id: EF-DOM-005
title: DecisionSet、Plan Compilation、Plan Revision 与 Approval
version: '1.1'
status: accepted
classification: normative
owners:
- architecture
- backend
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-008
- ADR-010
- ADR-011
source_of_truth_for:
- DecisionSetRevision
- PlanCompilationRun
- PlanRevision
- PlanApproval
- ExecutionCommitRecord
---


# DecisionSet、Plan Compilation、Plan Revision 与 Approval

## DecisionSetRevision

保存目标冲突、Dataset/Secret、共享资源、停机、流量、验证、回滚和风险接受。旧答案不覆盖；Hard Blocker 不可用风险接受消除。

核心字段：`id, projectId, revision, content, contentHash, riskAcceptances, createdBy, createdAt`。

## PlanCompilationRun

Plan Compilation 是 `ControlPlaneOperation(operationType=plan-compilation)` 的领域专用记录。通用 Operation 是生命周期权威：`created → queued → running/waiting/finalizing → succeeded | failed | cancelled`。

`PlanCompilationRun` 只保存 `phase(validating-inputs|resolving-graph|compiling-contracts|finalizing)`、输入 hash、compiler version、diagnostics、`outcome(compiled|review-required|blocked)` 和可选 result Plan ID。Operation 只有在 outcome 与结果资源持久化完成后进入 succeeded。

相同 Idempotency-Key 返回同一 Operation；相同输入允许创建新 Operation 但必须产生相同 Plan canonical hash，除非绑定的 compiler/capability/policy 版本变化。

## PlanRevision

核心字段：`id, projectId, revision, planType, status, inputBindings, stages, actions, contracts, gates, risks, limitations, compilerTrace, planHash`。

输入通过 `PlanInputBinding` 多行记录：`blueprint | decision-set | source-snapshot | target-snapshot | archive-version | capability | policy | artifact`。Plan 不含单一 Blueprint 假设。

状态：`compiled | review-required | approval-pending | approved | rejected | superseded | revoked | expired | archived`。内容不可修改；状态 envelope 可通过命令演进。

## PlanApproval

独立授权记录，绑定 Plan Hash、风险、Approval Policy、审批者、有效期。Approval 不自动执行；Material Drift 要求新 Plan 和 Approval。

## Commit Records

- `ExecutionCommitRecord`：Build 和 Restore 的正式成功提交，绑定 Plan Hash、required Verification、Placement 和不可逆动作。
- `CutoverCommitRecord`：Migration 的权威切换提交。
- `SourceReleaseCommitRecord`：确认 Archive 满足释放源 Policy。

三种 Commit 都不可变、once-only，不能由客户端直接 PATCH 创建。
