---
id: EF-GOV-004
title: 术语与命名规范
version: '1.1'
status: accepted
classification: normative
owners:
- architecture
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-007
- ADR-008
- ADR-010
- ADR-011
source_of_truth_for:
- canonical terminology
- canonical type names
- state naming
---


# 术语与命名规范

## Canonical 类型名称

| Canonical type | 自然语言简称 | 禁止用作类型的模糊名称 |
|---|---|---|
| `EnvironmentProject` | Project | MigrationSession |
| `EnvironmentEndpoint` | Endpoint | ServerConnection |
| `EnvironmentSnapshot` | Snapshot | Backup |
| `CandidateGeneration` | Candidate Generation | AnalysisResult |
| `WorkloadCandidate` | Candidate | ServiceStack（仅 legacy） |
| `CandidateReviewSession` | Review Session | Review |
| `Workload` | Workload | Service（过于宽泛） |
| `WorkloadBlueprintRevision` | Blueprint Revision | Blueprint、BlueprintVersion 作为类型 |
| `PlannerReadinessResult` | Readiness Result | planner-ready 持久状态 |
| `DecisionSetRevision` | Decision Revision | Decisions |
| `PlanCompilationRun` | Plan Compilation | CompileJob |
| `PlanRevision` | Plan Revision | EnvironmentPlan（legacy） |
| `PlanApproval` | Approval | approved 字段 |
| `PlanAction` | Action | Task、Command |
| `ExecutionRun` | Run | ApplyRun（legacy） |
| `StageRun` | Stage Run | PhaseRun |
| `ActionRun` | Action Run | Action status row |
| `ActionAttempt` | Attempt | Retry |
| `ExecutionCheckpoint` | Checkpoint | Progress marker |
| `ExecutionCommitRecord` | Build/Restore Commit | Commit（无类型） |
| `DatasetExecutionContract` | Dataset Contract（Plan 上下文） | MigrationStrategy string |
| `DatasetMigrationRun` | Dataset Run | Transfer（不等价） |
| `TransferSession` | Transfer Session | CopyJob |
| `SecretRequirement` | Secret Requirement | Secret value |
| `SecretProviderBinding` | Secret Binding | Provider Binding 作为类型 |
| `SecretDeliveryRun` | Secret Delivery Run | SecretRun |
| `CutoverContract` | Cutover Plan | CutoverPlan 类型 |
| `CutoverRun` | Cutover Run | SwitchRun |
| `CutoverCommitRecord` | Cutover Commit | TrafficSwitch result |
| `SourceReleaseCommitRecord` | Source Release Commit | DeleteSourceApproval |
| `ReportArtifact` | Report | Dynamic report |
| `EnvironmentArchive` | Archive | Backup |
| `ArchiveVersion` | Archive Version | Snapshot archive |
| `RestoreDrillRun` | Restore Drill | Restore Test |
| `ControlPlaneOperation` | Operation | ExecutionRun（非 Plan 操作） |

## 关键术语

- **Workload**：跨构建、迁移和恢复保持稳定的业务身份。
- **Candidate**：绑定特定 Snapshot 的可解释推断，可能错误。
- **Blueprint Revision**：目标无关、不可变的技术和恢复合同。
- **Plan Revision**：绑定具体输入、目标、Capability 和 Policy 的不可变执行合同。
- **Run**：对一个已批准 Plan 的一次真实执行。
- **Archive**：自描述、加密、不可变、经过完整性证据验证的长期恢复资产。

## 状态、事件和字段

- 类型：`PascalCase`。
- JSON/API：`camelCase`。
- PostgreSQL：`snake_case`。
- 状态值：lowercase kebab-case，如 `pause-requested`。
- 事件：lowercase dot notation，如 `execution.action.succeeded`。
- ID 后缀：`Id`/`_id`；Hash 后缀：`Hash`/`_hash`。

## 统一决策

1. Blueprint readiness 按模式计算，不是 Blueprint 持久状态。
2. Rollback 是独立 `ExecutionRun(type=rollback)`。
3. 第二次 `pg_dump` 不称为增量同步。
4. Traffic Switch 不等于 Cutover Commit。
5. Capture 与 Restore 是不同 Compiler；Preserve & Restore 是产品流程。
6. v1 Queue 使用 PostgreSQL；At-least-once + 幂等，不声称 exactly-once。
7. `ExecutionCommitRecord` 用于 Build/Restore；Migration 使用 `CutoverCommitRecord`；释放源使用 `SourceReleaseCommitRecord`。
8. Snapshot collection、Candidate generation 和 Plan compilation 属于 `ControlPlaneOperation`，不是 Plan-backed `ExecutionRun`。
