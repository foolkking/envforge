---
id: EF-ACC-001
title: Phase 0：平台与持久化基座验收
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
- Phase 0 acceptance
---

# Phase 0：平台与持久化基座验收

## 目标

证明 PostgreSQL、Artifact、Audit、Outbox/Inbox、Idempotency、Redaction 和 API/Worker 进程骨架可作为后续权威基础。

## 固定环境

- PostgreSQL 目标版本的空数据库与从前一 migration 升级副本；
- Local/MinIO Artifact Repository；
- API、Projection、Worker 独立进程；
- Canary Secret 字符串。

## 执行步骤

1. 记录仓库 HEAD、设计版本、migration version、Capability manifest 和 Feature Flags。
2. 从干净环境部署/升级本 Phase 产物。
3. 执行基线和成功路径。
4. 执行并发、重放、权限和故障注入。
5. 收集 Evidence Bundle，执行清理并确认无敏感材料残留。

## 必须通过

- Reference migration 实际执行并通过约束测试；
- API 重启后 Project/Operation 状态不丢失；
- 相同 Idempotency Key 重放返回同一结果，不同 body 返回 409；
- CAS 冲突返回 412；
- Outbox 重复投递只产生一个消费结果；
- Artifact atomic publish、Hash 和 corruption detection 通过；
- Canary Secret 不出现在 DB/Event/log/trace/error report。

## 故障注入

- 在事务 commit 前/后 kill API；
- Outbox publish 后、Inbox commit 前 kill consumer；
- Artifact 上传中断；
- PostgreSQL 短暂不可用。

## Evidence Bundle

- migration logs、constraint test、API responses、outbox/inbox rows、artifact hashes、redaction scan、commit hashes。

## 非目标

正式 ExecutionRun/Action DAG、Dataset、Secret Delivery、Cutover、Archive。

## 判定

- **PASS**：全部 required 检查和故障断言通过，无 P0/P1 安全或数据风险。
- **PARTIAL**：仅非关键 optional 项失败；不能解锁依赖此能力的生产声明。
- **FAIL**：任何 required、数据完整性、Secret、状态机或恢复断言失败。
