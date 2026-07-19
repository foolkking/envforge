---
id: EF-ACC-002
title: Phase 1：核心领域与 Planning 验收
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
- Phase 1 acceptance
---

# Phase 1：核心领域与 Planning 验收

## 目标

证明 Project→Blueprint→DecisionSet→Plan→Approval 的不可变、可追溯链路。

## 固定环境

- 人工和 legacy-import Blueprint fixtures；
- 空 Target Snapshot 和冲突 Target Snapshot；
- 固定 Capability Catalog/Compiler/Policy。

## 执行步骤

1. 记录仓库 HEAD、设计版本、migration version、Capability manifest 和 Feature Flags。
2. 从干净环境部署/升级本 Phase 产物。
3. 执行基线和成功路径。
4. 执行并发、重放、权限和故障注入。
5. 收集 Evidence Bundle，执行清理并确认无敏感材料残留。

## 必须通过

- Confirmed Blueprint 不可修改；
- Decision 变化产生新 Revision；
- Plan 支持多个 Blueprint input binding；
- 相同输入相同 Plan Hash，字段顺序变化不改变 Hash；
- 输入/Capability/Policy 变化产生新 Plan；
- Action DAG 无环且可追溯；
- Approval 绑定 exact Plan/Approval Hash，批准不自动 Run；
- Hard Blocker 不能风险接受。

## 故障注入

- 并发创建相同 revision；
- Compiler 在 persist 前崩溃；
- Plan compiled 后 Target Snapshot material drift；
- Approval 请求重放。

## Evidence Bundle

- fixtures、Plan JSON/Hash、trace、state transitions、database constraints、OpenAPI examples。

## 非目标

真实远端 Action、Worker Lease、数据迁移和 Cutover。

## 判定

- **PASS**：全部 required 检查和故障断言通过，无 P0/P1 安全或数据风险。
- **PARTIAL**：仅非关键 optional 项失败；不能解锁依赖此能力的生产声明。
- **FAIL**：任何 required、数据完整性、Secret、状态机或恢复断言失败。
