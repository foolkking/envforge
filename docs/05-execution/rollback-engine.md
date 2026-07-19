---
id: EF-EXEC-009
title: Rollback Engine
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
- ADR-007
- ADR-010
source_of_truth_for:
- RollbackExecutionContract
- RollbackRun
---


# Rollback Engine

Rollback 是独立 `ExecutionRun(type=rollback, rollbackOfRunId=...)`。它绑定原 Plan Hash、before-state、实际 succeeded Action、irreversible actions 和当前外部状态。

## 编译/生成

反向 DAG 只包含实际产生副作用的成功 Action，并按 `rollback-after` 和正向依赖反转。未执行 Action 不进入 Rollback。

## 结果

`full | partial | manual-required | failed`，映射为原 Run 的 `rolled-back | partially-rolled-back | failed/blocked` 派生状态。

## 数据和 Secret

目标产生新写入时先冻结目标和协调数据；旧 Secret 已撤销、加密密钥已用于新数据或外部 Provider 不可恢复时不得声称 full rollback。

## Point of No Return

Commit 后普通 Rollback 结束，需创建 Reverse Migration/Emergency Recovery Project。不可逆 Action 必须在 Plan Review 和 Commit Record 中列出。
