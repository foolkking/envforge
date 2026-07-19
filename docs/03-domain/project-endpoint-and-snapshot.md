---
id: EF-DOM-002
title: "Project、Endpoint 与 Snapshot"
version: '1.1'
status: accepted
classification: normative
owners:
  - backend
last_reviewed: 2026-07-19
supersedes:
  []
related_adrs:
  []
source_of_truth_for:
  - EnvironmentProject
  - EnvironmentEndpoint
  - EnvironmentSnapshot
  - Evidence
---

# Project、Endpoint 与 Snapshot

> **设计标记**：`[已确认设计]` 表示架构基线；`[建议方案]` 表示实施阶段需通过评审确认；`[待决策]` 表示尚未冻结。若本文件与权威来源冲突，以 [`source-of-truth-map.md`](../00-governance/source-of-truth-map.md) 的映射为准。

## 目的

本文件将总体设计中的相关决策下沉为可直接用于研发、评审和验收的规范。实现不得通过 UI 隐藏、临时内存状态或未审查脚本绕过这里定义的边界。

## 设计口径

- **事实与合同分离**：Snapshot/Evidence 描述观察事实；Blueprint 描述业务合同；Plan 描述本次执行；Run 记录真实证据。
- **不可变输入**：确认后的 Revision 与批准后的 Plan 不原地修改。
- **高风险操作显式化**：审批、Secret、Dataset、Cutover、Commit、Rollback 均为一等对象。
- **证据优先**：状态必须由 Attempt、Checkpoint、Verification、Manifest 或 Commit Record 支撑。
## 5.2 EnvironmentProject

| 属性 | 设计 |
|---|---|
| 职责 | 聚合一次用户目标、端点角色、当前 Revision 引用和项目级生命周期 |
| 核心字段 | `id`、`workspaceId`、`type`、`status`、`sourceEndpointId?`、`targetEndpointId?`、`archiveVersionId?`、当前 Blueprint/Decision/Plan 引用、`version` |
| 不变量 | Project 不拥有 Snapshot、Plan 或 Run 的内容；一个 Restore Project 必须绑定一个 ArchiveVersion；`completed` 只能由有效 Commit/Run 结果驱动 |
| 生命周期 | draft → discovering/reviewing/planning → ready → executing → completed/attention-required → archived |
| 关系 | 绑定 Endpoint；引用 Workload、Revision、Run、Archive |
| 聚合根 | `EnvironmentProject` |
| 持久化边界 | `core.projects`、`core.project_endpoints`、`core.project_links`；同一事务内只更新项目元数据和当前指针 |

## 5.3 EnvironmentEndpoint 与 Connection Reference

| 属性 | 设计 |
|---|---|
| 职责 | 表示 Source、Target、Drill Target 或 Storage Host 的稳定端点身份；引用连接凭据而不保存 Secret 值 |
| 核心字段 | `id`、`workspaceId`、`kind`、`role`、`displayName`、`connectionProviderRef`、`hostIdentity`、`status`、`lastSeenAt` |
| 不变量 | Host Key 变化必须触发重新信任；Endpoint 与某次 Snapshot 分离；Credential 只能以控制面 Secret 引用存在 |
| 生命周期 | unvalidated → available/degraded/unavailable → retired |
| 关系 | 产生 Snapshot；作为 Plan/Run 的源或目标；被 Resource Lease 引用 |
| 聚合根 | `EnvironmentProject` 管理角色绑定；Endpoint 自身可作为独立目录实体 |
| 持久化边界 | `core.endpoints`、`core.project_endpoints`、`core.connection_refs` |

**建议方案：** v1 采用 Agentless SSH；可选 Agent 作为后续能力。SSH Adapter 必须支持 Host Key、sudo、命令超时、重连、临时目录与远端清理。

## 5.4 EnvironmentSnapshot

| 属性 | 设计 |
|---|---|
| 职责 | 保存某个端点在明确采集时间的机器事实与 Collector 完整性 |
| 核心字段 | `id`、`endpointId`、`collectorRunId`、`schemaVersion`、`snapshotHash`、`capturedAt`、`sections`、`collectorCompleteness`、Artifact 引用 |
| 不变量 | finalized 后不可修改；Collector 失败表示 unknown，不表示 absent；补采必须创建新 Snapshot |
| 生命周期 | collecting → finalizing → finalized；失败产生 failed Snapshot Run，而不是修改旧 Snapshot |
| 关系 | 产生 Evidence/Graph/CandidateGeneration；被 Plan 绑定为 Source/Target 输入 |
| 聚合根 | `EnvironmentSnapshot` |
| 持久化边界 | `discovery.snapshots`、`snapshot_sections`、`evidence`；大型原始结果放 Artifact Store |

## 5.5 Evidence 与 Inventory Graph

| 属性 | 设计 |
|---|---|
| 职责 | 将 systemd、process、socket、package、config、directory、DB、container、Nginx、domain、cert、cron、user 等事实正规化并建立可解释关系 |
| 核心字段 | Evidence：`id`、`snapshotId`、`kind`、`identityKey`、`attributes`、`sourceSurface`、`confidence`；Relation：`fromId`、`toId`、`type`、`strength`、`evidenceIds` |
| 不变量 | 每条推断关系必须可追溯；端口是关系，不是 Workload；缺少 Collector 不得推断“资源不存在” |
| 生命周期 | 随 Snapshot Generation 不可变；新 Snapshot 创建新 Graph |
| 关系 | Candidate Builder 的唯一机器事实来源；Blueprint 保留关键 Evidence 来源 |
| 聚合根 | Snapshot 逻辑子域；Graph 可作为派生 Artifact |
| 持久化边界 | `discovery.evidence`、`evidence_relations`，或关系索引 + Graph Artifact |

强关系示例：systemd cgroup → process、process fd → socket、Nginx upstream → socket、Compose → container、container → declared volume、timer → service、应用配置 → DB URL。弱关系不得单独触发自动合并。

## 事务边界

- Project 事务仅更新元数据、Endpoint Role 和当前 Revision 指针。
- Snapshot Finalize 同时固化 Header、Section Hash、Completeness 和 Evidence 索引。
- 新 Collector 结果永远创建新 Snapshot；不得补写 finalized Snapshot。
