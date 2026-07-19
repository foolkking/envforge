---
id: EF-PERSIST-003
title: 数据库 Schema Catalog
version: '1.1'
status: accepted
classification: normative
owners:
- backend
- architecture
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-003
- ADR-008
- ADR-012
source_of_truth_for:
- database logical schema
---


# 数据库 Schema Catalog

本文件定义逻辑表组；reference DDL 位于 [`ddl/`](ddl/README.md)。

## core

`workspaces, projects, endpoints, connection_refs, project_endpoints, project_links, control_plane_operations`。

## discovery

`snapshot_collection_runs, snapshots, snapshot_sections, evidence, evidence_relations, candidate_generations, workload_candidates, candidate_components, candidate_questions, candidate_conflicts, candidate_review_sessions, candidate_review_decisions, evidence_assignments`。

## workload

`workloads, workload_placements, workload_dependencies, blueprint_revisions, blueprint_readiness_results, blueprint_update_proposals, classification_rules`。

## planning

`decision_set_revisions, plan_compilation_runs, plan_revisions, plan_input_bindings, plan_stages, plan_actions, plan_action_dependencies, plan_contracts, plan_gates, plan_risks, plan_approvals, approval_decisions`。

## execution

`runs, stage_runs, action_runs, action_attempts, run_queue, worker_leases, resource_lock_heads, resource_leases, checkpoints, run_events, manual_gates, verification_results, execution_commit_records, report_artifacts`。

## 子系统

Dataset、Secret、Cutover 和 Archive 的完整表在对应实施 Phase 增加，不提前放入 Phase 0–2 reference DDL。

## 关键约束

- `UNIQUE(root_id, revision)`；
- immutable content hash；
- PlanInputBinding 支持多个 Blueprint；
- Action dependency 使用 `(plan_revision_id, action_id)` composite FK 保证同 Plan；
- root Run active uniqueness 不阻止独立 rollback Run；
- Worker Lease 唯一权威；
- 多 read lock 通过 lock head + holder rows 实现；
- Snapshot 失败属于 CollectionRun，不生成 failed Snapshot。
