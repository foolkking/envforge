---
id: EF-PERSIST-006
title: Outbox 与 Inbox
version: '1.1'
status: accepted
classification: normative
owners: [backend, platform]
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: [ADR-003, ADR-007, ADR-012]
source_of_truth_for: [transactional outbox, idempotent inbox]
---

# Outbox 与 Inbox

## 1. 目标

Outbox 保证“聚合状态与待发布事件”原子持久化；Inbox 保证至少一次投递下消费者的幂等处理。该机制不提供分布式 Exactly Once，也不允许消费者重放外部副作用。

## 2. 数据模型

```text
audit.domain_events
- id, workspace_id, aggregate_type, aggregate_id
- aggregate_version, event_type, schema_version
- payload_json, payload_hash, occurred_at

audit.outbox_messages
- id, event_id, topic, partition_key
- payload_ref, state, available_at
- claimed_by, claim_token, lease_expires_at
- attempt_count, last_error, published_at

audit.inbox_messages
- consumer_name, message_id, received_at
- processing_state, result_hash, completed_at
```

约束：`domain_events(aggregate_type, aggregate_id, aggregate_version)` 唯一；`inbox_messages(consumer_name,message_id)` 唯一。Outbox Payload 只保存小型结构化数据或 Artifact 引用，不保存 Secret、大 Manifest 或 Dump。

## 3. 写入事务

```text
BEGIN;
  load aggregate with expected version;
  validate command and state transition;
  update aggregate version;
  insert domain_event;
  insert outbox_message referencing event;
  insert audit_record;
COMMIT;
```

任一插入失败则整体回滚。禁止先提交聚合后异步“补写事件”。

## 4. Dispatcher

Dispatcher 使用 `FOR UPDATE SKIP LOCKED` 领取批次，写 claim token 和短 Lease。发布成功后设置 `published_at`；进程崩溃后 Lease 过期可重领。`published_at` 只表示已交付内部 transport/handler，不证明所有下游完成。

重试采用指数退避和 jitter。超过阈值进入 dead-letter 状态并告警，但不得删除消息。运维修复后可显式 requeue，必须保留原 message id。

## 5. Consumer/Inbox

消费者事务：

```text
BEGIN;
  INSERT inbox(consumer,message) ON CONFLICT DO NOTHING;
  if already completed: return recorded result;
  apply idempotent projection or issue next command;
  mark inbox completed with result hash;
COMMIT;
```

如果消费者需要外部副作用，必须使用该 Provider 的 idempotency key、receipt 和 reconciliation，不能仅依赖 Inbox。

## 6. 顺序与一致性

- 单聚合按 `aggregate_version` 顺序消费。
- 跨聚合只保证最终一致；安全门禁读取权威写模型，不依赖 Projection。
- 发现版本缺口时暂停该聚合的 Projection，回补缺失事件后继续。
- Projection 可从事件和当前状态重建；外部执行不能通过事件重放重做。

## 7. 安全与可观测性

Payload 经统一 Redaction；记录 publish latency、attempt、dead-letter 数、consumer lag 和缺口。任何包含 Secret-like 高熵字段的 Outbox 写入必须被测试和日志过滤阻止。

## 8. 验收

- 在聚合提交与 Outbox 发布之间 kill API，不丢消息。
- 重复发布 10 次，Projection 只产生一次业务结果。
- Dispatcher Lease 过期后新实例接管，旧 claim token 写入被拒绝。
- 无法解析 schemaVersion 的消息进入 dead-letter 并告警。
