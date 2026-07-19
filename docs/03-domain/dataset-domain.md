---
id: EF-DOM-008
title: Dataset 领域模型
version: '1.1'
status: accepted
classification: normative
owners: [architecture, backend, data, qa]
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: [ADR-007, ADR-008, ADR-010]
source_of_truth_for:
  - DatasetContract
  - DatasetExecutionContract
  - DatasetMigrationRun
  - DatasetCommitRecord
  - TransferSession relationship
---

# Dataset 领域模型

本文定义 Dataset 的业务身份、执行合同、运行证据和提交边界。正式状态枚举及转换以 [状态机规范](state-machines.md) 为唯一事实源；具体传输算法见 [Dataset Migration Engine](../06-subsystems/dataset-migration-engine.md) 和 [Transfer Session](../06-subsystems/transfer-session.md)。

## 1. 分层

```text
WorkloadBlueprintRevision.DatasetContract
  -> PlanRevision.DatasetExecutionContract
  -> DatasetMigrationRun
       -> ConsistencyCheckpoint
       -> TransferSession
       -> DatasetVerificationResult
       -> DatasetCommitRecord
```

| 层 | 职责 | 是否可变 |
|---|---|---|
| `DatasetContract` | 目标无关地声明数据是什么、所有者、writer、一致性、可接受策略和验证要求 | Blueprint Revision 内不可变 |
| `DatasetExecutionContract` | 绑定本次源、目标、Archive、策略、阶段、校验与回滚 | Plan Revision 内不可变 |
| `DatasetMigrationRun` | 记录某次真实迁移或恢复的当前状态与证据引用 | CAS 状态转换 |
| `TransferSession` | 管理字节或 Artifact 的枚举、分块、传输、校验和断点 | 独立受控子根 |
| `DatasetCommitRecord` | 证明 required Dataset 满足一致性和验证要求 | append-only，不可变 |

## 2. DatasetContract

核心字段：

```ts
interface DatasetContract {
  id: string;
  logicalName: string;
  type: "filesystem" | "postgresql" | "docker-volume" | "custom";
  ownerWorkloadId: string;
  writerComponentIds: string[];
  readerComponentIds: string[];
  required: boolean;
  ownership: "exclusive" | "shared" | "external";
  consistencyRequirement:
    | "crash-consistent"
    | "filesystem-consistent"
    | "application-consistent"
    | "transaction-consistent"
    | "manual";
  allowedStrategies: string[];
  verificationRequirements: DatasetVerificationRequirement[];
  recoveryRequirement: "required" | "optional" | "recreatable";
  evidenceRefs: string[];
}
```

不变量：

1. required Dataset 必须有 owner、writer 结论和验证要求。
2. shared Dataset 不允许被多个 Workload 分别宣称 exclusive。
3. Collector 缺失表示 `unknown`，不得推断 Dataset 不存在。
4. PostgreSQL data directory 默认不得作为普通 filesystem Dataset 在线复制。
5. DatasetContract 不包含目标路径、具体命令、临时 Dump 路径或传输进度。

## 3. DatasetExecutionContract

```ts
interface DatasetExecutionContract {
  id: string;
  planRevisionId: string;
  workloadId: string;
  datasetContractId: string;
  type: DatasetContract["type"];
  source: ResolvedDatasetEndpoint;
  destination: ResolvedDatasetDestination;
  strategy:
    | "recreate"
    | "logical-dump-restore"
    | "initial-final-file-sync"
    | "snapshot-transfer"
    | "volume-export-import"
    | "archive-capture"
    | "archive-restore"
    | "reuse-target"
    | "manual";
  consistencyPlan: ConsistencyExecutionPlan;
  stages: DatasetStageDefinition[];
  transferPlan?: TransferPlan;
  restorePlan?: DatasetRestorePlan;
  verificationPlan: DatasetVerificationPlan;
  rollbackPlan: DatasetRollbackPlan;
  riskClassification: "low" | "medium" | "high" | "critical";
  contractHash: string;
}
```

合同必须绑定 Capability implementation hash、源/目标 Snapshot hash 和 DecisionSet revision。任何 material drift 都要求重新编译或阻塞 Run。

## 4. DatasetMigrationRun

职责：维护阶段、writer 状态、TransferSession、ConsistencyCheckpoint、Verification 和 Outcome。它不拥有父 ExecutionRun 的审批和总体 Commit。

关键字段：`executionRunId`、`datasetExecutionContractId`、`state`、`phase`、`currentWriterState`、`transferSessionIds`、`consistencyCheckpointIds`、`verificationResultIds`、`bytesPlanned`、`bytesProcessed`、`outcome`、`version`。

核心不变量：

- Initial Sync 可以在 writer active 时进行，但不得宣称最终一致。
- Final Sync 前必须证明 writer 已 quiesced，且 ConsistencyCheckpoint 有效。
- 目标在 Final Sync 完成前不得成为权威 writer。
- required Dataset 未生成有效 `DatasetCommitRecord` 时，父 Execution Commit/Cutover Commit/Source Release Commit 均不得通过。
- 状态 `succeeded` 只表示 Dataset Commit 已创建，不是“传输进程退出码为 0”。

## 5. ConsistencyCheckpoint

Checkpoint 保存 writer 状态、数据库 LSN/事务快照、filesystem snapshot、source manifest hash、观察时间和证据 Artifact。用户点击确认本身不是有效证据；至少要有 systemd/container/DB/application probe 的机器观察。

失效条件包括：源恢复写入、Snapshot/Manifest 变化、Checkpoint 超时、Capability 版本不兼容、数据源重新挂载或 Final Sync 输入变更。

## 6. DatasetCommitRecord

```ts
interface DatasetCommitRecord {
  id: string;
  datasetMigrationRunId: string;
  contractHash: string;
  consistencyCheckpointId: string;
  verificationResultIds: string[];
  sourceStateHash: string;
  destinationStateHash: string;
  committedAt: string;
}
```

Record 只能创建一次；创建需满足 required Verification 全通过、所有 TransferSession 成功并 finalizing 完成、无 unresolved integrity error。

## 7. 聚合与持久化

- 聚合根：`DatasetMigrationRun`；`TransferSession` 为高吞吐独立子根，通过 fencing token 和 resource lease 受控。
- 关系表：`dataset.migration_runs`、`dataset.consistency_checkpoints`、`dataset.verification_results`、`dataset.commit_records`。
- 大型 Manifest/Chunk index 存对象存储，数据库保存分段索引、root hash 和 totals。
- 每次状态转换事务追加 Dataset Event 和 Outbox；TransferPart 高频更新不得锁住整个父 Run。

## 8. 事件

`dataset.run.created`、`dataset.preflight.completed`、`dataset.initial-sync.completed`、`dataset.writer.quiesced`、`dataset.consistency-checkpoint.created`、`dataset.final-sync.completed`、`dataset.verification.passed`、`dataset.committed`、`dataset.rollback-required`。

## 9. 禁止事项

- 不得把第二次 `pg_dump` 描述为增量同步。
- 不得默认覆盖目标已有数据库或目录。
- 不得仅凭“已发送字节数”标记传输成功。
- 不得把 sampled verification 描述为 full-content verification。
- 不得在 DatasetMigrationRun 中直接切换生产流量。
