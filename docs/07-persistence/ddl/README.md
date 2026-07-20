---
id: EF-PERSIST-DDL-README
title: Reference DDL 说明
version: '1.1'
status: proposed
classification: informative
owners:
- backend
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-003
- ADR-012
source_of_truth_for:
- reference DDL
---


# Reference DDL

## Phase ownership clarification

`phase-1-domain.sql` remains a cross-phase reference artifact. Its Discovery,
snapshot collection, candidate generation, and candidate review tables belong
to Phase 4 and are intentionally absent from the Phase 1 production migration.
Phase 1 production authority is the reviewed `0003_phase1_domain_planning.sql`
subset under `apps/api/migrations/postgres/`.

这些 SQL 是 v1.1 逻辑设计的可执行参考，不是已经部署的生产 migration。使用前必须：

1. 在目标 PostgreSQL 版本实际执行；
2. 运行约束、并发、升级和 backfill 测试；
3. 转换为项目 migration 工具格式；
4. 记录 down/forward-only 策略；
5. 通过对应 Phase Acceptance。

文件：

- `phase-0-foundation.sql`：Workspace、Project、Endpoint、Artifact、Audit/Outbox、ControlPlaneOperation。
- `phase-1-domain.sql`：Discovery、Workload、Planning。
- `phase-2-execution.sql`：Durable Run、Queue、Lease、Lock、Checkpoint、Verification、Commit/Report。
