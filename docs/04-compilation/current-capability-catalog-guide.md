---
id: EF-COMP-GUIDE-002
title: 当前 Capability Catalog 指南
version: '1.1'
status: accepted
classification: informative-current-implementation
owners:
- capability
- operations
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- current legacy catalog implementation guide
current_implementation_as_of: '2026-07-19'
target_architecture_authority: false
verified_against_commit: a0a9a69cefc0888c32e9fb2ef3f5ca5416a4a254
retirement_phase: phase-10
---

# 当前 Capability Catalog 指南

> 本文只记录旧 Runtime Catalog 的当前实现，用于迁移。目标支持语义以 [`01-product/capability-support-policy.md`](../01-product/capability-support-policy.md) 为准。

## 1. 旧模型

历史 Catalog 位于 `configs/catalog/*`，使用 `CatalogItem`、`capabilityKey`、`supportLevel`、`modes`、detect/install/config/data/validate/rollback 等字段。旧用户状态主要为 `Full Migration Certified` 和 `Not Ready`。

该模型不得直接映射为新 `detect/build/migrate/capture/restore/verify/rollback` 认证结果。

## 2. 历史命令

```bash
npm run catalog:check
npm run certification:check
npm run certification:backlog
```

Preparation 必须核实命令、输出和实际 Catalog 条目。

## 3. 迁移

每个 CatalogItem 需要映射：

- detect evidence；
- Build/Migrate/Capture/Restore dimension；
- required gates；
- risk；
- data/secret strategy；
- verification；
- rollback；
- OS matrix；
- owner；
- fixtures/evidence。

旧 `detect-only/basic-rebuild/managed-config/full-migration` 可以作为迁移输入，不作为最终用户标签。

## 4. 生成结果

旧 `docs/generated/catalog-certification.*` 是历史工具输出，不属于 active docs。新输出进入 CI Artifact 或 `artifacts/generated/`，并绑定 commit 和输入 Hash。
