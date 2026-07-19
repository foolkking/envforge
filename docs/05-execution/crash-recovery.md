---
id: EF-EXEC-006
title: 崩溃恢复
version: '1.1'
status: accepted
classification: normative
owners:
- backend
- platform
- qa
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-004
- ADR-007
source_of_truth_for:
- crash recovery
- RecoveryCoordinator
---


# 崩溃恢复

## 扫描范围

Recovery Coordinator 扫描：过期 Worker Lease、stale running Attempt、未知结果、源已 quiesced/traffic-switched Cutover、Interrupted Rollback、失效 Checkpoint 和过期 Resource Lease。

## 恢复算法

```text
expire old lease and increment fencing epoch
load last durable checkpoint and active attempt
inspect real external state
classify reconcile result
validate plan/input/artifact/secret/window/locks
choose resume | retry | rollback | recover-source | block
persist decision and event before scheduling
```

## 优先级

Critical Cutover、Rollback 和 Secret Rotation 恢复优先于普通 Build。系统必须告警并持续显示业务停机时间。

## 关键场景

- Action 副作用完成但响应丢失：inspect 后认领成功，禁止重复执行。
- Traffic API 超时：读取权威 route，分类 source/target/mixed/unknown。
- Worker 在 Quiesce 后消失：按 CutoverRecoveryPolicy 继续 Final Sync 或恢复源。
- Archive multipart 中断：reconcile remote parts，完成或 abort。

Recovery 决策本身写 Audit 和 Evidence；不能仅修改状态枚举。
