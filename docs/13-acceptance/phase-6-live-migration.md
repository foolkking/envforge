---
id: EF-ACC-007
title: Phase 6：Live Migration 验收
version: '1.1'
status: accepted
classification: normative
owners:
- qa
- architecture
- engineering
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- Phase 6 acceptance
---

# Phase 6：Live Migration 验收

## 目标

证明黄金 Workload 在双 VM 间通过单写权威、Final Sync、流量、业务验证、Observation、Commit/安全回滚完成迁移。

## 固定环境

- Source/Target Ubuntu VMs；
- Nginx、systemd app、PostgreSQL、uploads、timer；
- Nginx traffic provider + structured manual DNS；
- external probes 和 maintenance window。

## 执行步骤

1. 记录仓库 HEAD、设计版本、migration version、Capability manifest 和 Feature Flags。
2. 从干净环境部署/升级本 Phase 产物。
3. 执行基线和成功路径。
4. 执行并发、重放、权限和故障注入。
5. 收集 Evidence Bundle，执行清理并确认无敏感材料残留。

## 必须通过

- Drain 有 active request/job evidence；
- Quiesce 后 Source Authority=none；
- Final Sync 引用 valid checkpoint；
- Target 之前不权威写；
- Traffic timeout reconcile；
- post-switch business transaction/observation；
- target write monitor；
- CutoverCommitRecord once-only；
- 无 Commit 不标成功；
- rollback 顺序和数据协调正确。

## 故障注入

- source-quiesced、final sync、target activate、traffic timeout、business failure、observation、rollback 各点 kill Worker；
- DNS mixed propagation；
- target writes 后请求 rollback。

## Evidence Bundle

- Authority records、traffic snapshots、Dataset Commits、business/observation evidence、Cutover Commit/Rollback report。

## 非目标

Active-active、weighted canary、logical replication 零停机。

## 判定

- **PASS**：全部 required 检查和故障断言通过，无 P0/P1 安全或数据风险。
- **PARTIAL**：仅非关键 optional 项失败；不能解锁依赖此能力的生产声明。
- **FAIL**：任何 required、数据完整性、Secret、状态机或恢复断言失败。
