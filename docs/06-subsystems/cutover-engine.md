---
id: EF-SUB-005
title: Cutover Engine
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
- Cutover Engine
- CutoverContract
- CutoverRun
---


# Cutover Engine

## 目标

安全撤销源写入权、完成 Final Sync、激活目标、切换流量、业务验证、观察并 Commit 或 Rollback。

## 阶段

```text
prepare/readiness → wait maintenance window → drain → quiesce
→ source authority none → final sync → target passive activation
→ grant target authority → traffic switch → business verify
→ observation → commit pending → CutoverCommitRecord
```

Critical Section 从 `source-quiesced` 开始，到 committed 或源恢复并验证结束。

## Maintenance/Drain/Quiesce

MaintenanceWindow 定义 timezone、start/latest、max duration、hard stop、operator presence 和 auto rollback。Drain 停止新工作并等待 active request/job；Quiesce 停止持久写入。不能用固定 sleep 代替 active work checks。

## Write Authority

转移：`source → none → target`。记录 holder、epoch、fencing method、evidence 和时间。普通 Workload 禁止 source+target 同时权威写入。

## Commit Gate

Required Dataset Commits、target authority、source revoked、traffic observed、required verification、observation duration、rollback classification、无 critical warning。Commit once-only。

## Rollback

先冻结目标、撤销 target authority、检测/协调新写入、恢复并验证源，再回切流量。Commit 后不再是普通 rollback，创建 Reverse Migration/Emergency Project。
