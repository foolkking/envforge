---
id: EF-ROAD-005
title: 当前代码迁移计划
version: '1.1'
status: accepted
classification: normative
owners:
- architecture
- backend
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: [ADR-003, ADR-004, ADR-008, ADR-013, ADR-015, ADR-016]
source_of_truth_for:
- current code migration plan
---


# 当前代码迁移计划

## 原则

不推倒重写，不长期双写。新模型通过 Feature Flag 逐步成为唯一写源；旧 API 短期适配为新 Command。

## 顺序

1. PostgreSQL/Artifact/Outbox 基座；
2. Backfill Project/Endpoint/legacy Plan，保留 source ID/hash；
3. 新 Blueprint/Planning；
4. Durable Run 旁路，先一个幂等 Action；
5. 旧 Apply 改为创建新 Run 并返回 202；
6. Golden Build 验收后冻结旧 Apply；
7. Candidate/Discovery 接入 Blueprint；
8. Dataset/Cutover/Archive 分阶段新增；
9. 对账、只读保留、最终归档旧表。

## 删除 Gate

旧路径只有在数据对账、API consumers、active runs、reports、rollback/read compatibility 和 backup 均验证后删除。

## Authority、Compatibility 与 Feature Flags

| Transition | New authoritative write | Temporary compatibility read/command | Required flag/telemetry | Backfill | Rollback |
|---|---|---|---|---|---|
| SQLite runtime document → PostgreSQL core | PostgreSQL command transaction | legacy `/api` adapter reads/translates | per-aggregate read/write flag; old/new counts and source IDs | repeatable batch with source hash and rejection reason | restore old read only; never erase new rows |
| `StoredMigrationSession` → Project/Endpoint | Project application service | migration-session routes translate to Project commands | project-authority flag + route usage | session/connection owner and state mapping | disable new command path; retain imported rows |
| `EnvironmentPlan` → `PlanRevision` | compiler creates immutable Revision | current Plan read representation from new contract | planner/plan-authority flag + hash parity | legacy-import only with limitation marker | new revisions remain immutable; old read adapter can resume |
| Apply → durable ExecutionRun | durable command creates Run/queue row and returns 202 | legacy Apply route creates new Run; never executes separately | execution-authority flag + active-run telemetry | historical ApplyRun read-only import | stop new claims, reconcile active Runs, do not dual-execute |
| local Plan artifact → Artifact Store | provider + PostgreSQL metadata | legacy storage ref reader after verified import | artifact-provider flag + hash/bytes/references | content-hash import | provider switchback only while both verified |

## Bounded Dual-write Exception

No business authority may be long-term dual-written. A bounded shadow comparison may write a non-authoritative projection/evidence record only when the owner, expiry, reconciliation metric, rollback trigger, and deletion gate are recorded. It cannot serve reads or execution decisions before cutover.

## Phase 10 Retirement Evidence

For every remaining legacy path, Phase 10 requires route/consumer usage zero, data and hash reconciliation, no active run reference, backup and restore proof, read compatibility for retained evidence, removal/410 behavior, release note, and rollback or forward-fix plan.
