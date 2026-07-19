---
id: EF-ARCH-004
title: 组件架构
version: '1.1'
status: accepted
classification: normative
owners:
- architecture
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-002
source_of_truth_for:
- component architecture
---


# 组件架构

## Control Plane 模块

- `core`：Workspace、Project、Endpoint、Connection Ref。
- `discovery`：Snapshot Operation、Evidence、Graph、Candidate Generation。
- `workload`：Workload、Blueprint、Readiness、Drift。
- `planning`：DecisionSet、Compatibility、Compiler、Plan、Approval。
- `policy`：Risk、Capability Certification、High-risk Approval。

## Execution Plane 模块

- `execution`：Run/Stage/Action/Attempt、Queue、Lease、Checkpoint、Recovery。
- `dataset`：Dataset Run、TransferSession、一致性和 Commit。
- `secret`：Provider Binding、JIT Resolution、Materialization、Rotation。
- `cutover`：Drain、Authority、Traffic、Verification、Observation、Commit/Rollback。
- `archive`：Capture Artifact、ArchiveVersion、Replica、Scrub、Drill。

## 依赖方向

```text
core ← discovery ← workload ← planning ← execution
                                  ├─ dataset
                                  ├─ secret
                                  ├─ cutover
                                  └─ archive
```

领域模块不得直接访问其他模块私有表；通过 Application Port、不可变引用和 Domain Event 协作。Capability 分为 Detection、Planning、Execution Adapter，避免巨大万能接口。

图：[`diagrams/components.mmd`](diagrams/components.mmd)。
