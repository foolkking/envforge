---
id: EF-OPS-005
title: Worker 运维
version: '1.1'
status: proposed
classification: normative
owners: [operations, platform]
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: [ADR-004, ADR-007, ADR-012]
source_of_truth_for: [worker runbook]
---

# Worker 运维

## 1. Worker Pool

Worker 按 Capability、risk level、network zone 和版本分池。每个实例使用 machine identity、固定 Capability manifest hash、最大并发和临时目录 quota。Critical Cutover/rollback/recovery pool 与普通 Build/transfer pool 可隔离。

## 2. 日常检查

- heartbeat age、queue depth/oldest age、claim latency；
- expired lease、fencing rejection、unknown outcome；
- active critical runs 和 rollback deadline；
- resource lock wait、worker disk/tmp、SSH/provider error；
- Capability version 与 Plan binding；
- redaction/security alerts。

## 3. 安全 Drain/停机

1. 标记 Worker `draining`，停止新 Claim。
2. 列出当前 Attempt 和 resumability。
3. 让 Action 到安全 Checkpoint；持续 Heartbeat/Lease。
4. Transfer 写 verified part checkpoint；释放非必要读锁。
5. Critical Section 未完成时启动替代 Worker/Recovery，再停旧实例。
6. 进程退出后确认 Lease 已释放/过期，记录 Audit。

## 4. 卡死或失联

先检查进程、Attempt deadline、远端命令、provider、DB、lock。不要手工把 Run 改 succeeded。确认 Worker 不可恢复后允许 Lease 过期，Recovery Coordinator 增加 fencing epoch 并 reconcile。旧 Worker 返回时所有写入必须被拒绝。

## 5. 扩缩容

Scale-out 前验证 DB connection/lock capacity。Queue aging 避免低优先级饥饿。Scale-in 只选择无 Critical Attempt 或可安全 checkpoint 的实例。旧 Capability Worker 在活动 Run 完成前保留。

## 6. 临时目录和敏感材料

Worker 启动/结束扫描 orphan staging、Secret tmpfs 和 Dump；依据 cleanup policy 清理，失败产生告警。禁止将临时目录打入通用备份或 support bundle。

## 7. 演练

每个 release 在测试环境执行 worker kill、network partition、DB timeout、stale fencing 和 rolling upgrade；Evidence 包含 Run/Lease/Attempt/External state。
