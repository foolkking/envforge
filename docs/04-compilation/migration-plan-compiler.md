---
id: EF-COMP-003
title: Migration Plan Compiler
version: '1.1'
status: accepted
classification: normative
owners:
- backend
- architecture
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-005
- ADR-007
- ADR-008
source_of_truth_for:
- MigrationPlanCompiler
---


# Migration Plan Compiler

## 范围

Migration 绑定同时存在的 Source/Target，编译目标准备、Dataset initial/final sync、Secret 连续性、Cutover、业务验证、Observation、Rollback 和 Source Retention。

## 阶段

```text
SOURCE_PREFLIGHT → TARGET_PREFLIGHT → TARGET_PREPARE
→ INITIAL_DATA_SYNC → TARGET_PREVERIFY → WAIT_MAINTENANCE_WINDOW
→ SOURCE_DRAIN → SOURCE_QUIESCE → FINAL_DATA_SYNC
→ TARGET_ACTIVATE → GRANT_TARGET_AUTHORITY → TRAFFIC_SWITCH
→ BUSINESS_VERIFY → OBSERVE → CUTOVER_COMMIT
→ SOURCE_RETENTION → CLEANUP
```

失败路径：

```text
FREEZE_TARGET → ASSESS_TARGET_WRITES → RECONCILE_DATA?
→ RECOVER_SOURCE → GRANT_SOURCE_AUTHORITY → ROLLBACK_TRAFFIC
→ VERIFY_SOURCE → ISOLATE_TARGET
```

## 强制编译规则

- Prepare 与 Critical Cutover 分离。
- 每个 required Dataset 必须有 consistency、final sync、verify 和 rollback/reconciliation contract。
- Source Authority 撤销后才允许 Final Sync。
- 目标在 Final Sync 前不得产生权威写入。
- Traffic Switch 后必须验证和观察，不能直接 Commit。
- Target Write Monitor 不可用时 Rollback 等级至少降为 manual/partial。

## PostgreSQL MVP

小中型数据库在 Cutover 中执行最终完整 transaction-consistent `pg_dump`/restore；初始阶段只做容量、速度、扩展和 Restore Drill/预验证。第二次 dump 不称为增量。Logical Replication 是未来认证 Capability。

## Commit

所有 DatasetCommitRecord、Write Authority、Traffic State、required Business Verification 和 Observation Policy 满足后创建 `CutoverCommitRecord`。

## 输入绑定

所有输入保存 ID + Hash；Capability 保存 implementation version/hash 和认证范围。任何 Material Drift、绑定 Artifact 过期或 Policy 变化均要求新 Plan Revision。

## 输出结构

- `planStages`
- `planActions` 与 `planActionDependencies`
- `datasetExecutionContracts`
- `secretExecutionContracts`
- 模式特定 Contract
- `verificationExecutionContract`
- `rollbackExecutionContract`
- `manualSteps`
- `gates, risks, limitations, estimates, compilerTrace`

## 错误与 Gate

- Hard Blocker：不能由风险接受绕过。
- Review Required：需要明确人工决定，决定后新 DecisionSet/Plan Revision。
- Warning：可以继续，但必须进入 Plan Review 和 Report。
- Compiler Internal Error：不创建 Plan；保存脱敏诊断和 input hash。

## 测试

每个 Compiler 必须有 Golden Fixture：固定输入、期望 Action/Edge/Contract、Plan Hash、Gate、Risk 和 Rollback；Property Test 验证 DAG 无环、required contract 有实现、Hash 稳定且输入敏感。
