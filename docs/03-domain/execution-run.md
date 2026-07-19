---
id: EF-DOM-007
title: Execution Run 模型
version: '1.1'
status: accepted
classification: normative
owners:
- architecture
- backend
- qa
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-004
- ADR-007
source_of_truth_for:
- ExecutionRun
- StageRun
- ActionRun
- ActionAttempt
- ExecutionCheckpoint
- RunEvent
---


# Execution Run 模型

## 分层

`PlanRevision → PlanApproval → ExecutionRun → StageRun → ActionRun → ActionAttempt → ExecutionCheckpoint`。

## ExecutionRun

绑定 `planRevisionId/planHash`、`approvalId/approvalHash`、输入 Hash、Policy Version。Run 类型：`build | migration | capture | restore | verification | rollback`。

Run Root 维护总体状态、当前 Phase、版本、fencing epoch、waiting reason、outcome 和 commit/rollback 引用。它不存 Secret 明文或整个 DAG 副本。

## StageRun

表示业务阶段。Required Action、Verification、Checkpoint 和 Gate 全满足才能成功。Stage 失败不会覆盖 ActionAttempt 证据。

## ActionRun/Attempt

ActionRun 是一个 PlanAction 在当前 Run 的累计状态；Attempt 是一次真实执行。Attempt 历史不可覆盖，包含 worker、fencing token、execution receipt、错误分类和 evidence refs。

## ExecutionCheckpoint

类型：`action | transfer | dataset-consistency | stage | cutover | commit`。绑定 Plan Hash、Action Input Hash、序列、resume data、Observed State Hash 和 Artifact Ref。

## RunEvent

append-only，sequence 在 Run 内单调。Event Payload 必须结构化、脱敏且可版本化。
