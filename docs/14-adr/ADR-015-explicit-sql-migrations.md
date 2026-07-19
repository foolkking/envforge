---
id: EF-ADR-015
title: ADR-015：显式 SQL Migration 为生产 Schema 权威
version: '1.1'
status: accepted
classification: normative
owners: [backend, architecture]
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: [ADR-003, ADR-013]
source_of_truth_for: [production schema migration policy]
---

# ADR-015：显式 SQL Migration 为生产 Schema 权威

## 状态

Accepted — 2026-07-19；关闭 OQ-003。

## 当前事实

当前 SQLite 使用显式、版本化、checksum DDL step，并有独立 JSON document migration；目标 PostgreSQL 尚无生产 migration 目录或 ORM。

## 方案比较

- ORM auto-sync：快速但不可审查、不可重放，生产漂移风险高。
- ORM 生成 migration：可审查，但生成器不能成为隐式权威。
- reviewed explicit SQL：约束、事务、回放和升级证据最清晰。

## 决策

生产 Schema 由 checked-in、reviewed explicit SQL migrations 权威定义。ORM/Query Builder 可用于访问和生成初稿，但不得自动同步生产 Schema。Migration 必须具备唯一版本、checksum、事务边界或明确 non-transactional 分类、pre/post validation、幂等/重放策略、干净安装和逐版本升级测试。

`docs/07-persistence/ddl/*.sql` 仍是 reference DDL；Phase 0 必须转换成项目 production migration，并以真实 PostgreSQL 验证后才成为实现事实。

## 后果与验证

Phase 0 选择具体 runner/目录布局作为实现细节，但不得改变本 ADR 的权威和安全语义。CI 必须验证顺序、checksum、重复应用、升级和失败原子性。
