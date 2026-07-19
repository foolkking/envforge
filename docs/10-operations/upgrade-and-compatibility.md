---
id: EF-OPS-008
title: 升级与兼容
version: '1.1'
status: proposed
classification: normative
owners: [operations, architecture, backend]
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: [ADR-008, ADR-009]
source_of_truth_for: [upgrade compatibility]
---

# 升级与兼容

## 1. 升级面

API/UI、Worker、PostgreSQL Schema、OpenAPI、Event schema、Blueprint/Plan schema、Capability implementation、Artifact format、Archive format/Reader 和 Provider config。

## 2. 发布前检查

列出活动 Run/Operation、绑定 Capability/Plan version、数据库 migration compatibility、Archive Reader support 和 rollback window。存在无法被新 Worker 安全接管的 Critical Run 时暂停发布或保留旧 pool。

## 3. 数据库

采用 `expand -> backfill -> verify -> switch reads/writes -> contract`。Migration 必须在空库、上一生产版本副本和大数据 fixture 执行；提供 lock/timeout 评估、down migration 或 forward-fix 策略。不得在同一发布删除仍被旧 Worker 使用的列/枚举。

## 4. API/Event

新增字段优先 optional；破坏性 API 发布新 version/operation。Event consumer 支持旧 schema window；无法解析进入 dead-letter。OpenAPI client compatibility test 是发布门禁。

## 5. Capability

Plan 固定 implementation hash。新 Worker 只接管声明兼容的旧 Action schema；否则旧 pool drain 完成。安全撤销可阻止新 Run，但历史证据不变。

## 6. Archive

Reader 支持承诺格式；格式/加密升级创建 derived ArchiveVersion，验证副本/Scrub/Drill 后才退役旧版本。禁止原地修改 signed manifest。

## 7. 回滚

应用回滚不能回退已由新版本写入的不兼容 Schema。发布计划必须注明可直接 rollback、需 forward-fix 或需 maintenance restore。活动 Run 状态必须在切换前后 reconcile。

## 8. 验收

滚动升级期间 Queue 不丢、旧/new Worker 不双执行、SSE/API 兼容、Projection 可重建、Archive 旧版本可读、失败发布能按计划恢复。
