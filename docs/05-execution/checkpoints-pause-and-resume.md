---
id: EF-EXEC-005
title: Checkpoint、Pause 与 Resume
version: '1.1'
status: accepted
classification: normative
owners:
- backend
- qa
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-004
source_of_truth_for:
- ExecutionCheckpoint
- pause resume
---


# Checkpoint、Pause 与 Resume

## Checkpoint

类型：`action, transfer, dataset-consistency, stage, cutover, commit`。字段包含 Run/Action、sequence、Plan/Action Input Hash、resume data、observed state hash、Artifact refs、validity constraints。

进度、Checkpoint 和 Event 必须在同一事务或可证明的原子协议中持久化后，才能向 UI 报告“已保存断点”。

## Pause

1. 状态进入 `pause-requested`；
2. Scheduler 不再发新 Action；
3. 当前 Action 按 resumability 到达安全边界；
4. 写 Checkpoint；
5. 释放非必要资源锁；
6. 进入 `paused`。

Source 已 quiesced 的 Cutover Critical Section 禁止普通 Pause；用户只能选择继续、恢复源或 rollback。

## Resume

```text
paused → validate plan/input/checkpoint/drift/secret/window/locks
→ queued → claimed → recovering → running
```

任何 Hash/Artifact/Provider/Consistency 变化都可能使 Checkpoint invalid，结果为 restart-required 或 blocked。
