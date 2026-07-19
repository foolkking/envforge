---
id: EF-ACC-006
title: Phase 5：Dataset Engine 验收
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
- Phase 5 acceptance
---

# Phase 5：Dataset Engine 验收

## 目标

证明 Filesystem、PostgreSQL 和 Docker local volume 能够一致、断点、可校验地准备/恢复数据。

## 固定环境

- Source/Target VMs；
- 大小文件、symlink、permissions、变化文件；
- PostgreSQL 14–16 数据库/roles/grants/extensions/sequences；
- Docker local volume writer。

## 执行步骤

1. 记录仓库 HEAD、设计版本、migration version、Capability manifest 和 Feature Flags。
2. 从干净环境部署/升级本 Phase 产物。
3. 执行基线和成功路径。
4. 执行并发、重放、权限和故障注入。
5. 收集 Evidence Bundle，执行清理并确认无敏感材料残留。

## 必须通过

- Transfer progress 只计 verified bytes/items；
- initial/final filesystem sync、staging/promotion、Deletion Policy；
- ConsistencyCheckpoint 前置；
- pg_dump/restore 不伪称增量；
- target existing DB 默认 block；
- schema/row/sequence/business verify；
- DatasetCommitRecord 绑定 consistency/verification；
- pause/resume 和 bandwidth 生效。

## 故障注入

- SSH 断开、Worker kill、磁盘满、checksum mismatch；
- source file 读时变化；
- dump/artifact corruption；
- restore partially complete。

## Evidence Bundle

- Manifest/root hash、TransferPart/Checkpoint、source/target comparison、DB verification、Dataset Commit。

## 非目标

自动 Quiesce/Traffic/Cutover。

## 判定

- **PASS**：全部 required 检查和故障断言通过，无 P0/P1 安全或数据风险。
- **PARTIAL**：仅非关键 optional 项失败；不能解锁依赖此能力的生产声明。
- **FAIL**：任何 required、数据完整性、Secret、状态机或恢复断言失败。
