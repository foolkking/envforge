---
id: EF-DOM-013
title: 领域事件规范
version: '1.1'
status: accepted
classification: normative
owners: [architecture, backend, platform, security]
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: [ADR-003, ADR-007, ADR-012]
source_of_truth_for:
  - DomainEventEnvelope
  - event naming
  - event taxonomy
  - event retention
---

# 领域事件规范

## 1. 目的与边界

Domain Event 表示已经发生并持久化的业务事实。它用于审计、Projection、Worker 调度、通知和报告，不替代当前状态表，也不是任意应用日志。

事件、聚合状态更新和 Outbox 插入必须在同一个 PostgreSQL 事务内完成；发布和消费采用 at-least-once，消费者必须幂等。

## 2. Event Envelope

```ts
interface DomainEventEnvelope<TPayload> {
  id: string;                 // UUIDv7
  schemaVersion: number;
  workspaceId: string;
  projectId?: string;
  runId?: string;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number;
  eventType: string;
  sequence?: number;          // Run 内单调序列
  occurredAt: string;
  actor: { type: "user" | "worker" | "system"; id: string };
  correlationId: string;
  causationId?: string;
  requestId?: string;
  payload: TPayload;
  payloadHash: string;
}
```

规则：

- `eventType` 采用 `domain.subject.past-tense`，例如 `execution.run.created`。
- 事件名不可复用为不同语义；破坏性 Payload 变化增加 schemaVersion 或新事件名。
- Run 内 `(runId, sequence)` 唯一且单调。
- Payload 不得包含 Secret 明文、凭据、完整 Dump、私钥或超大 Artifact；只保存引用和摘要。
- Event append-only。合法纠正以新事件表达，不更新历史事件。

## 3. 事件目录

| 领域 | 规范事件 |
|---|---|
| Project | `project.created`, `project.endpoint-bound`, `project.status-changed`, `project.completed`, `project.archived` |
| Discovery | `snapshot-collection.started`, `snapshot.finalized`, `candidate-generation.published`, `candidate-generation.superseded` |
| Review | `candidate-review.started`, `candidate-review.decision-recorded`, `candidate-review.blocked`, `blueprint.promoted` |
| Workload | `workload.created`, `workload.placement-created`, `blueprint.confirmed`, `blueprint.superseded`, `blueprint.drift-detected` |
| Planning | `decision-set.created`, `plan-compilation.started`, `plan.compiled`, `plan.review-required`, `plan.superseded`, `plan-approval.approved`, `plan-approval.revoked` |
| Execution | `execution.run.created`, `execution.run.queued`, `execution.run.claimed`, `execution.run.waiting`, `execution.run.paused`, `execution.run.recovering`, `execution.run.succeeded`, `execution.run.failed` |
| Action | `execution.action.ready`, `execution.attempt.started`, `execution.attempt.receipt-recorded`, `execution.action.reconciled`, `execution.checkpoint.created`, `execution.action.succeeded`, `execution.action.failed` |
| Dataset | `dataset.run.created`, `transfer.manifest-created`, `transfer.part-verified`, `dataset.writer-quiesced`, `dataset.consistency-checkpoint-created`, `dataset.final-sync-completed`, `dataset.committed` |
| Secret | `secret.binding-created`, `secret.binding-validated`, `secret.resolution-succeeded`, `secret.materialized`, `secret.validated`, `secret.rotated`, `secret.revoked`, `secret.cleaned` |
| Cutover | `cutover.ready`, `cutover.source-drained`, `cutover.source-quiesced`, `authority.source-revoked`, `authority.target-granted`, `traffic.switch-reconciled`, `cutover.observation-completed`, `cutover.committed` |
| Rollback | `rollback.run-created`, `rollback.reconciliation-required`, `rollback.completed`, `rollback.partially-completed`, `rollback.manual-required` |
| Archive | `archive.version-created`, `archive.object-stored`, `archive.manifest-finalized`, `archive.replica-completed`, `archive.scrub-failed`, `archive.object-repaired`, `restore-drill.passed`, `source-release.committed`, `archive.deleted` |
| Security | `security.permission-denied`, `security.break-glass-used`, `security.key-recovery-requested`, `security.high-risk-operation-approved`, `security.credential-revoked` |

完整事件列表允许按 Capability 扩展，但新事件必须登记 owner、Payload schema、PII/Secret classification、retention 和 consumer。

## 4. 事务伪代码

```text
BEGIN;
  SELECT aggregate FOR UPDATE / CAS expected_version;
  validate transition and invariants;
  UPDATE aggregate SET state=?, version=version+1;
  INSERT domain_events(... aggregate_version=version+1 ...);
  INSERT outbox_messages(event_id, payload_ref, available_at);
COMMIT;
```

Outbox Dispatcher 不修改业务聚合。Consumer 在同一事务写入 `inbox_messages` 与其 Projection/后续命令结果。

## 5. 顺序、重复与重放

- 只保证单聚合版本顺序；跨聚合不提供全局总序。
- Consumer 必须接受重复事件，使用 `(consumerName, eventId)` 去重。
- Projection 按 aggregateVersion 检测缺口；出现缺口时暂停该聚合并补读，而不是越过。
- 事件重放只重建读模型，不自动重放外部副作用。

## 6. Retention 与审计

Run、Approval、Commit、Source Release、Archive Delete 和 Security 事件长期保留并遵守 Workspace Policy。高容量 Progress 事件可以汇总，但原始 Attempt/Checkpoint 证据的删除不能破坏已发布 Report 的可验证性。

## 7. 兼容性

Event schema 采用向后兼容演进：新增可选字段优先；删除/改义必须新版本。消费者声明支持版本范围，无法解析时进入 dead-letter 并告警，禁止静默丢弃。
