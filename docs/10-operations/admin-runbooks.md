---
id: EF-OPS-006
title: 管理员 Runbook 索引
version: '1.1'
status: proposed
classification: normative
owners:
- operations
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- administrator runbooks
---


# 管理员 Runbook 索引

每个 Runbook 必须含触发条件、权限、前置检查、命令、证据、回滚、升级联系人和事后复盘。

## RB-001 过期 Worker Lease

- 确认 heartbeat 和进程；
- 不手工删除 Attempt；
- 由 Recovery Coordinator increment fencing 并 inspect；
- 结果记录 `resume/retry/rollback/block`。

## RB-002 Cutover Critical Incident

- 冻结新调度；
- 读取 source/target authority、traffic、dataset commit、target writes；
- 按 RecoveryPolicy 继续或恢复源；
- 需要数据协调时禁止先切流。

## RB-003 Secret Provider Outage

- 阻止新 Secret Stage；
- 评估现有 lease expiry；
- 使用已批准 fallback；
- 不将 Secret 手工写入日志/DB。

## RB-004 Archive Corruption

- 标记 degraded；
- 停止 deletion；
- 从有效 replica repair；
- Full Scrub；
- 无有效副本时标记 corrupt 并告警。

## RB-005 Projection Drift

- 权威写模型只读；
- 清理/重建 Projection；
- 比较 event sequence；
- 不修改业务聚合来迎合 UI。
