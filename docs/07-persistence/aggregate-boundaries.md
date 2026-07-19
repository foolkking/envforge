---
id: EF-PERSIST-002
title: 聚合边界
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
- ADR-011
source_of_truth_for:
- aggregate boundaries
---


# 聚合边界

| 聚合根 | 同一事务允许修改 | 跨聚合协作 |
|---|---|---|
| EnvironmentProject | 元数据、Endpoint role、当前指针、event/outbox | Snapshot/Plan/Run 通过引用和事件 |
| EnvironmentSnapshot | finalized snapshot、sections/evidence index | Candidate Generation 后续创建 |
| CandidateReviewSession | append ReviewDecision、session version | Promotion 创建 Workload/Blueprint 的受控事务/Saga |
| Workload | identity、placement、current blueprint pointer | Blueprint Revision 独立不可变写入 |
| DecisionSetRevision | 单个不可变文档 | Compiler 读取 |
| PlanRevision | bindings/stages/actions/contracts/hash 一次创建 | Approval 独立 |
| PlanApproval | approval decision/event | 创建 Run 时验证 |
| ExecutionRun | Run/当前 Action/Attempt/Checkpoint/Event 的受控小事务 | Dataset/Secret/Cutover 子系统通过 contract/run ref |
| DatasetMigrationRun | Dataset state、checkpoint、commit | TransferSession 独立高频子根 |
| SecretProviderBinding | provider mapping/version | Delivery Run JIT 读取 |
| CutoverRun | authority/traffic/observation/commit | Dataset commits 和 ExecutionRun 引用 |
| ArchiveVersion | header/manifest refs/index/finalization | Replica/Scrub/Drill 独立运行根 |

禁止跨模块 `ON DELETE CASCADE`。不可变执行绑定同时保存 ID 和 Hash。
