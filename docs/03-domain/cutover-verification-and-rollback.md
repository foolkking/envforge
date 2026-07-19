---
id: EF-DOM-010
title: Cutover、Verification 与 Rollback 领域模型
version: '1.1'
status: accepted
classification: normative
owners: [architecture, backend, operations, qa]
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: [ADR-004, ADR-007, ADR-010, ADR-011]
source_of_truth_for:
  - CutoverContract
  - CutoverRun
  - WriteAuthorityRecord
  - VerificationContract
  - VerificationResult
  - RollbackExecutionContract
---

# Cutover、Verification 与 Rollback 领域模型

正式状态和合法转换见 [状态机规范](state-machines.md)。执行算法分别见 [Cutover Engine](../06-subsystems/cutover-engine.md)、[Verification Engine](../05-execution/verification-engine.md) 和 [Rollback Engine](../05-execution/rollback-engine.md)。

## 1. CutoverContract

CutoverContract 是 Migration Plan 内的不可变高风险合同，绑定 source/target、维护窗口、停机预算、Drain、Quiesce、required Dataset、Write Authority、Traffic Provider、Business Verification、Observation、Commit、Rollback 和 Crash Recovery Policy。

```ts
interface CutoverContract {
  id: string;
  planRevisionId: string;
  sourceEndpointId: string;
  targetEndpointId: string;
  workloadIds: string[];
  maintenanceWindow: MaintenanceWindow;
  downtimeBudget: DowntimeBudget;
  preconditions: CutoverPrecondition[];
  drainPlan: DrainPlan;
  quiescePlan: QuiescePlan;
  requiredDatasetContractIds: string[];
  targetActivationPlan: TargetActivationPlan;
  writeAuthorityPlan: WriteAuthorityPlan;
  trafficSwitchContracts: TrafficSwitchContract[];
  businessVerificationContract: BusinessVerificationContract;
  observationPolicy: ObservationPolicy;
  commitPolicy: CutoverCommitPolicy;
  rollbackPlan: CutoverRollbackPlan;
  recoveryPolicy: CutoverRecoveryPolicy;
  contractHash: string;
}
```

## 2. CutoverRun 与 Critical Section

CutoverRun 记录真实阶段、写入权、流量状态、Dataset Commit、目标写入观察、验证和 Commit。Critical Section 从 `source-quiesced` 开始，到 Cutover Commit 完成或 Source 恢复并验证通过结束。

在 Critical Section 中：

- 普通 pause 不允许；cancel 转为 rollback request。
- Worker 失联获得最高恢复优先级。
- 无法证明 Source/Target authority 时必须进入 `blocked`。
- Final Sync、Traffic Switch 或 Provider timeout 后必须 inspect/reconcile，禁止盲重试。

## 3. WriteAuthorityRecord

```ts
interface WriteAuthorityRecord {
  id: string;
  cutoverRunId: string;
  workloadId: string;
  holder: "source" | "target" | "none" | "unknown";
  epoch: number;
  fencingMethod: string;
  evidenceArtifactIds: string[];
  grantedAt: string;
  revokedAt?: string;
}
```

普通状态型 Workload 任意时刻最多一个权威 writer。迁移顺序为 `source -> none -> target`。允许双写的 Capability 必须单独认证冲突解决和一致性语义，v1 黄金迁移不支持。

## 4. VerificationContract 与 VerificationResult

Verification 覆盖 Artifact、Syntax、Runtime、Network、Dependency、Data 和 Business。Blueprint 定义目标无关检查，Plan 绑定目标、vantage、Secret 和成功标准，Run 记录证据。

Required Verification 的规则：

- 不能被 optional failure budget 忽略。
- 不能仅依据 exit code；必须满足 postcondition。
- 对外服务至少包含 target-local 和 control-plane/external vantage。
- 业务写测试必须隔离、幂等并清理。
- Secret、完整敏感响应和个人数据不得进入证据。

结果状态使用 `pending | running | passed | failed | warning | skipped | error`；`warning` 不满足 required check。

## 5. Observation 与 Commit

Traffic Switch 不是 Commit。Observation 在生产路径重复运行 required checks 和运行信号，满足最短时间、采样阈值、无 critical alert、目标写入监控有效后才进入 `commit-pending`。

`CutoverCommitRecord` 绑定 Plan hash、Dataset Commit、Verification snapshot、Traffic state、Source/Target authority、目标写入状态、不可逆 Action 和 Commit actor。Record 创建一次后不可修改。

对于 Build/Restore/Capture 的成功提交，统一使用 `ExecutionCommitRecord`；Migration 额外使用 `CutoverCommitRecord`。

## 6. RollbackExecutionContract 与 RollbackRun

Rollback 是独立 `ExecutionRun(type=rollback)`，引用原 Run、原 Plan hash、before-state、实际成功 Action、不可逆 Action 和目标新写入证据。逆向 DAG 只包含实际产生副作用的节点。

分类：`full | partial | manual | none`。无 before-state、旧 Secret 已撤销、目标新写入无法协调或外部 Provider 不支持回滚时，不得标记 full。

安全回切顺序：冻结目标写入 → 撤销目标 authority → 评估/协调目标新数据 → 恢复源 → 授予源 authority → 源本地验证 → 流量回切 → 外部验证 → 隔离目标。

## 7. Point of No Return

普通 Cutover Rollback 的可用窗口在 Commit 前。Commit 后的恢复创建 Emergency Repair 或 Reverse Migration Project，不将原 CutoverRun 从 `committed` 改回历史状态。

## 8. 聚合与持久化

- 聚合根：`CutoverRun`；WriteAuthorityRecord、TrafficSwitchRun、ObservationRun、TargetWriteMonitor 是受控子记录。
- VerificationResult 是 Stage/Run 子记录；独立重复验证可创建 `ExecutionRun(type=verification)`。
- RollbackRun 使用统一 execution 表，不在原 Run 内伪造 Attempt。
- Commit、Authority 和 Route Snapshot 均 append-only；状态机更新、事件、Outbox 同事务。

## 9. 关键事件

`cutover.ready`、`cutover.drain.started`、`cutover.source-quiesced`、`authority.source-revoked`、`dataset.final-sync.completed`、`authority.target-granted`、`traffic.switch.requested`、`traffic.switch.reconciled`、`verification.business.passed`、`observation.completed`、`cutover.committed`、`rollback.run.created`。

## 10. 禁止事项

- 不得把 DNS API 成功响应等同于全部流量已传播。
- 不得在 required Dataset 未 Commit 时授予目标写入权。
- 不得在目标新写入未知时自动回切。
- 不得在 Commit 后覆盖原状态来“回滚”。
- 不得将用户点击“已完成”直接视为机器验证通过。
