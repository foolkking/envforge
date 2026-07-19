---
id: EF-DOM-004
title: "Workload 与 Blueprint Revision"
version: '1.1'
status: accepted
classification: normative
owners:
  - architecture
  - backend
last_reviewed: 2026-07-19
supersedes:
  []
related_adrs:
  - ADR-008
source_of_truth_for:
  - Workload
  - WorkloadBlueprintRevision
  - PlannerReadinessResult
---

# Workload 与 Blueprint Revision

> **设计标记**：`[已确认设计]` 表示架构基线；`[建议方案]` 表示实施阶段需通过评审确认；`[待决策]` 表示尚未冻结。若本文件与权威来源冲突，以 [`source-of-truth-map.md`](../00-governance/source-of-truth-map.md) 的映射为准。

## 目的

本文件将总体设计中的相关决策下沉为可直接用于研发、评审和验收的规范。实现不得通过 UI 隐藏、临时内存状态或未审查脚本绕过这里定义的边界。

## 设计口径

- **事实与合同分离**：Snapshot/Evidence 描述观察事实；Blueprint 描述业务合同；Plan 描述本次执行；Run 记录真实证据。
- **不可变输入**：确认后的 Revision 与批准后的 Plan 不原地修改。
- **高风险操作显式化**：审批、Secret、Dataset、Cutover、Commit、Rollback 均为一等对象。
- **证据优先**：状态必须由 Attempt、Checkpoint、Verification、Manifest 或 Commit Record 支撑。
## 5.8 Workload

| 属性 | 设计 |
|---|---|
| 职责 | 表示跨迁移、重建和恢复保持稳定的业务身份 |
| 核心字段 | `id`、`workspaceId`、`name`、`kind`、`owner`、`tags`、`lifecycleStatus`、当前 Blueprint 指针、Placements |
| 不变量 | 运行位置、PID、容器 ID 和当前端口不定义 Workload 身份；真实拆分、独立克隆或新业务才创建新 Workload |
| 生命周期 | active → retired/archived；Placement 独立演进 |
| 关系 | 拥有 Blueprint Revisions；依赖其他 Workload；关联 Project/Archive |
| 聚合根 | `Workload` |
| 持久化边界 | `workload.workloads`、`workload_placements`、`workload_dependencies` |

## 5.9 WorkloadBlueprintRevision

| 属性 | 设计 |
|---|---|
| 职责 | 目标无关地定义 Workload 的运行、部署、配置、数据、Secret、入口、身份、任务、瞬时状态、兼容性、验证和恢复要求 |
| 核心字段 | `id`、`workloadId`、`revision`、`status`、`schemaVersion`、`content`、`contentHash`、`origin`、`confirmedAt` |
| 不变量 | confirmed Revision 不可修改；不得包含 Secret 明文、目标具体命令、Run 进度、当前 PID、未审查 Shell；Planner 只消费 confirmed Revision |
| 生命周期 | draft → confirmed → superseded/retired；Readiness 按模式计算，不是持久状态 |
| 关系 | 来源于 Candidate Review 或 Update Proposal；被 DecisionSet/Plan/Archive 引用 |
| 聚合根 | `Workload` 下的不可变 Revision 文档 |
| 持久化边界 | `workload.blueprint_revisions` 使用 canonical JSONB + hash；Dataset/Secret/Endpoint 建关系型索引 |

Blueprint 主要合同：Identity、Component、Runtime、Deployment、Config、Dataset、SecretRequirement、Endpoint、SystemIdentity、ScheduledTask、Dependency、EphemeralState、CompatibilityEnvelope、Verification、Operational/Recovery Requirement。

## 5.10 PlannerReadinessResult

| 属性 | 设计 |
|---|---|
| 职责 | 判断某个 Blueprint Revision 对某种模式是否可以进入 Plan Compiler |
| 核心字段 | `mode`、`status(planner-ready/review-required/blocked)`、`gates`、`blockers`、`warnings`、`deferredItems`、`evaluatedInputHash` |
| 不变量 | Readiness 绑定 Blueprint Revision 和模式；Capture 要求最严格；风险接受不能绕过 Hard Blocker |
| 生命周期 | 评估结果可重复生成；输入变化产生新结果 |
| 关系 | Plan Compilation 的前置 Gate |
| 聚合根 | 读模型/评估记录，不独立拥有业务状态 |
| 持久化边界 | `workload.blueprint_readiness_results` 或 Projection |

## Blueprint 内容边界

Blueprint 包含目标无关合同，不包含目标命令、Run 进度、明文 Secret、当前 PID、未审查 Shell 或本次冲突结果。Planner Readiness 按模式计算，而不是 Blueprint 的持久状态。

## 更新策略

新 Snapshot 只产生 Drift/Update Proposal。已确认 Revision 不覆盖；用户接受 Proposal 后创建后继 Revision。
