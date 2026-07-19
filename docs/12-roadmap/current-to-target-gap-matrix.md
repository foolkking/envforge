---
id: EF-ROAD-002
title: 当前到目标差距矩阵
version: '1.1'
status: proposed
classification: normative
owners:
- architecture
- engineering
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- current target gap matrix
---


# 当前到目标差距矩阵

| 目标 | 当前近似 | Gap | 策略 | Phase |
|---|---|---|---|---|
| EnvironmentProject | StoredMigrationSession | 仅 Migration、文档式状态 | Backfill + compatibility adapter | 0/1 |
| EnvironmentSnapshot | Snapshot | 不可变/Collector completeness 需强化 | Adapt | 1/4 |
| WorkloadCandidate | ServiceStack | 非正式、未进入 Review | Legacy import + replace | 4 |
| WorkloadBlueprintRevision | 无 | 核心缺失 | New | 1 |
| DecisionSetRevision | 零散 decision | 不可变版本缺失 | New | 1 |
| PlanRevision | EnvironmentPlan | 单 Blueprint/能力不完整 | Adapt/replace | 1 |
| PlanApproval | Plan 内字段 | 未独立 Hash/Policy | Extract | 1 |
| ExecutionRun | ApplyRun | 同步 HTTP、无 lease/checkpoint | Replace | 2 |
| DatasetMigrationRun/Transfer | 无 | 缺失 | New | 5 |
| Secret Delivery | SecretRef/Redaction | 无 provider binding/JIT | New | 3 |
| CutoverRun | 无 | 缺失 | New | 6 |
| ArchiveVersion | 本地 artifact | 无 manifest/encryption/scrub | New | 7 |
| Restore Drill | 无 | 缺失 | New | 8 |

每一行在仓库实施前补充实际代码路径、表/API、Feature Flag、测试和删除旧路径条件。
