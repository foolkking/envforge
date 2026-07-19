---
id: EF-DOM-001
title: 领域总览
version: '1.1'
status: accepted
classification: normative
owners:
- architecture
- backend
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-008
- ADR-010
- ADR-011
source_of_truth_for:
- domain model overview
---


# 领域总览

## 主链

```text
EnvironmentProject → Endpoint/Snapshot → CandidateGeneration/Review
→ Workload → WorkloadBlueprintRevision → DecisionSetRevision
→ PlanCompilationRun → PlanRevision → PlanApproval → ExecutionRun
→ Dataset/Secret/Cutover/Verification → Commit/Report
→ ArchiveVersion/RestoreDrill/Restore
```

## 聚合根

| 聚合根 | 一致性职责 |
|---|---|
| EnvironmentProject | 用户目标、端点角色、当前 Revision 指针 |
| EnvironmentSnapshot | 不可变机器事实和 Collector 完整性 |
| CandidateGeneration | 一次算法生成的不可变 Candidate 集合 |
| CandidateReviewSession | Review Decisions 和 Evidence ownership |
| Workload | 稳定业务身份、Placement、当前 Blueprint 指针 |
| WorkloadBlueprintRevision | 不可变目标无关合同 |
| DecisionSetRevision | 不可变用户/策略决策 |
| PlanRevision | 不可变目标特定执行合同和 DAG |
| PlanApproval | 对精确 Plan Hash 的授权 |
| ExecutionRun | 一次 Plan-backed 执行的权威状态 |
| DatasetMigrationRun | 一个 Dataset 的真实迁移和一致性证据 |
| SecretProviderBinding / SecretDeliveryRun | Secret 来源决策和 JIT 交付 |
| CutoverRun | 写入权、流量、观察和提交 |
| EnvironmentArchive / ArchiveVersion | 稳定 Archive 身份与不可变 Capture 版本 |
| RestoreDrillRun | 对特定 ArchiveVersion 的隔离恢复证据 |

`ControlPlaneOperation` 是长操作资源，不是业务聚合。ReportArtifact 和 Projection 是不可变证据/读模型。
