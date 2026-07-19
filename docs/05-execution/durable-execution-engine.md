---
id: EF-EXEC-001
title: Durable Execution Engine
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
- ADR-011
source_of_truth_for:
- durable execution engine
- ExecutionRun scheduler
---


# Durable Execution Engine

## 目标

把 Approved Plan 的执行从 HTTP 生命周期中剥离，提供持久状态、可恢复调度、真实证据、可验证成功和独立 Rollback。

## 分层

```text
PlanRevision → PlanApproval → ExecutionRun
→ StageRun → ActionRun → ActionAttempt → ExecutionCheckpoint/RunEvent
```

## 控制循环

```text
claim run lease
reconcile previous unknown work
while lease valid and run active:
  evaluate gates/dependencies
  acquire ordered resource locks
  create attempt
  execute adapter with timeout/cancellation context
  persist receipt + postconditions + verification + checkpoint + event atomically
  release locks
  update stage/run or wait/requeue
```

## 权威边界

- PostgreSQL 是 Run、Queue、Lease 和 Checkpoint 权威源。
- Plan 内容不可修改；Run 保存冻结的 ID+Hash。
- Worker 内存只保存缓存和当前执行上下文，重启后必须从数据库恢复。
- 成功由 required Verification 和 Commit 决定，不由 exit code 单独决定。

## 调度顺序

1. Run 状态可调度；2. Lease 有效；3. Stage Gate 满足；4. Action dependencies 满足；5. Secret/Window/Manual Gate 可用；6. Resource Lock 获取；7. Action Attempt 执行。

## 执行类型

Build、Migration、Capture、Restore、Verification、Rollback。Control-plane compilation/collection 不使用 ExecutionRun。
