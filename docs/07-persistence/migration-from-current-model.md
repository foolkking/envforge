---
id: EF-PERSIST-010
title: 从当前模型迁移
version: '1.1'
status: accepted
classification: normative
owners: [backend, architecture, qa]
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: [ADR-003, ADR-004, ADR-008]
source_of_truth_for: [legacy data migration]
---

# 从当前模型迁移

## 1. 原则

采用“新模型唯一写入、旧接口兼容适配、旧表只读退役”，不长期双写。每个 backfill 保存 `legacy_source_type`、`legacy_source_id`、`migration_batch_id`、转换版本和 source hash。

## 2. 映射

| 当前对象 | 新对象 | 策略 |
|---|---|---|
| StoredMigrationSession | `core.projects(type=migration)` | backfill 项目与 endpoint role |
| ServiceStack | `WorkloadCandidate` | 保留机器推断，不自动创建 confirmed Workload |
| EnvironmentPlan | `PlanRevision(origin=legacy-import)` | 标记能力限制，不宣称完整 Migration Plan |
| 内嵌 approval fields | `PlanApproval` | 仅在 hash/evidence 足够时迁移，否则 expired |
| ApplyRun | `ExecutionRun(origin=legacy-import)` | 历史终态只读；活动旧 Apply 不伪造可恢复状态 |
| Verify/Rollback result | verification/rollback legacy evidence | 不伪造独立 Run 的完整 Attempt |
| 本地 Artifact | `ArtifactRecord` | 计算 hash、导入 provider、校验后切换引用 |

## 3. 阶段

1. 添加新 Schema 和写路径，旧读取不变。
2. Snapshot 一致性备份；执行可重复 backfill。
3. 对比数量、hash、引用和状态映射，生成 migration report。
4. Feature Flag 将新命令写入新模型；旧 API 转为命令适配器。
5. UI 切换 Projection；旧写接口返回 410/迁移提示。
6. 观察期后冻结旧表，只读保留；最终按保留策略归档。

## 4. 风险处理

- 无法映射的活动 Apply 标为 `legacy-unknown-outcome`，要求人工审查。
- 缺少 Blueprint 证据的 Plan 不可自动批准。
- SQLite 到 PostgreSQL 的时间、UUID、JSON canonicalization 必须固定转换规则。
- Backfill 不触发外部副作用或重新发送事件；只生成 `legacy.record-imported` 审计。

## 5. 验收

两次运行 backfill 结果相同；每条旧记录有映射或显式 rejected reason；切换后不存在双写分叉；回滚 Feature Flag 不删除新记录，只恢复旧读路径。
