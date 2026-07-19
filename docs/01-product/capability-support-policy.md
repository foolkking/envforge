---
id: EF-PROD-004
title: Capability 支持策略
version: '1.1'
status: accepted
classification: normative
owners:
- product
- architecture
- qa
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-005
source_of_truth_for:
- capability support policy
---


# Capability 支持策略

## 能力维度

每个 Capability 分别声明：`detect | build | migrate | capture | restore | verify | rollback`。一个维度可为：`unsupported | experimental | preview | supported | certified | deprecated`。

## 晋级要求

| 等级 | 最低要求 |
|---|---|
| experimental | 本地开发可运行；无生产承诺 |
| preview | 明确范围、限制和基础集成测试 |
| supported | Adapter Contract、真实 VM E2E、故障恢复、文档和运维支持 |
| certified | Golden Fixture、Crash Matrix、安全审查、版本矩阵和可复现证据包全部通过 |

## UI 和 Planner 约束

Planner 只能选择满足 Project 模式和风险策略的 Capability 版本。UI 必须同时展示能力维度、版本、限制、回滚等级和认证证据；Detect 成功不得推导 Migrate 支持。

## 版本绑定

Plan 绑定 Capability ID、版本、实现 Hash 和认证范围。活动 Run 不自动切换到最新 Adapter。Archive 保存恢复所需的 Capability 要求和 Reader 最低版本。


## 发布与可见性

Capability 的认证结果不能直接修改 Runtime Catalog。Package 必须经过确定性 Preview、Diff、管理员 Review 和显式 Promotion；流程见 [`04-compilation/capability-publication-and-catalog-governance.md`](../04-compilation/capability-publication-and-catalog-governance.md)。旧 `Full Migration Certified` 与 `supportLevel` 仅作为迁移输入，不是新用户状态。
