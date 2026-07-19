---
id: EF-PERSIST-001
title: 持久化架构
version: '1.1'
status: accepted
classification: normative
owners:
- architecture
- backend
- platform
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-003
- ADR-008
- ADR-009
- ADR-012
source_of_truth_for:
- persistence architecture
---


# 持久化架构

v1 使用单一 PostgreSQL 作为控制面、Run、Queue、Lease 和 Audit 权威状态源；对象存储保存大型 Artifact、Dump、Manifest、日志和 Archive 内容。

## PostgreSQL Schema

`core, discovery, workload, planning, execution, dataset, secret, cutover, archive, artifact, audit, projection`。

## 数据分配

- 高频局部状态、约束、队列和锁：关系表。
- 复杂不可变合同：canonical JSONB + relational index + content hash。
- 大型二进制/Manifest/日志：对象存储，数据库保存 Hash、大小、encryption envelope 和状态。
- Event Log 是审计事实；状态表是当前索引，不采用全面 Event Sourcing。

## 多租户

所有业务表包含 `workspace_id`，或通过受约束父键可证明 workspace；v1 DDL 对关键子表直接保存 workspace_id，避免越权 JOIN。应用层所有查询必须带 workspace scope；多租户生产前启用 RLS 是 Phase 9 Gate。

## 迁移原则

生产 migration 是实际 Schema 事实源。`ddl/*.sql` 是 reference DDL；在对应 Phase Acceptance 前状态为 proposed，不可直接当作已验证生产脚本。
