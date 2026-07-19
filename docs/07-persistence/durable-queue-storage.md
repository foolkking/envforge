---
id: EF-PERSIST-007
title: Durable Queue 存储
version: '1.1'
status: accepted
classification: normative
owners: [backend, platform]
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: [ADR-003, ADR-004, ADR-007, ADR-012]
source_of_truth_for: [run queue schema, queue claim transaction]
---

# Durable Queue 存储

## 1. 权威边界

v1 使用 PostgreSQL Queue。`execution.run_queue` 保存调度状态；`execution.worker_leases` 是 Claim/Lease 权威；`execution.runs` 保存业务状态和 monotonic fencing epoch。Claim 后 queue row **不删除**，而更新为 `claimed`，便于审计和恢复。

## 2. Queue Entry

字段：`run_id`、`workspace_id`、`state(queued|claimed|completed|cancelled)`、`priority`、`available_at`、`queued_at`、`claim_token_hash`、`claimed_by`、`claimed_at`、`attempt_count`、`last_error`。一个非终态 root Run 只有一个活动 queue row。

## 3. Claim 事务

```sql
BEGIN;
SELECT run_id
FROM execution.run_queue
WHERE state='queued' AND available_at <= now()
ORDER BY priority DESC, queued_at
FOR UPDATE SKIP LOCKED
LIMIT 1;

UPDATE execution.runs
SET state='claimed', fencing_token=fencing_token+1, version=version+1
WHERE id=:run AND state='queued';

INSERT INTO execution.worker_leases(... fencing_token ...);
UPDATE execution.run_queue SET state='claimed', claimed_by=:worker, ...;
INSERT event/outbox;
COMMIT;
```

任一步失败全部回滚。Lease token 只保存 hash，客户端持有原 token。

## 4. Heartbeat 与过期

Heartbeat 条件更新需匹配 `run_id + worker_id + claim_token_hash + fencing_token + non-expired lease`。续租不改变 fencing token。Recovery Coordinator 扫描 expired lease，将 Run 置 `recovering` 并创建新 queue entry/claim epoch；旧 Worker 的后续写入因 fencing mismatch 被拒绝。

## 5. Fairness 与优先级

优先级用于 Critical Cutover/rollback/recovery 高于普通 Build；同优先级按 queued_at。实现必须防止低优先级永久饥饿，可使用 aging。Workspace concurrency quota 在 Claim 前检查，不通过则推迟 available_at。

## 6. 取消与完成

Run 终态事务将 queue row 标为 completed/cancelled，释放 Lease 和非保留 Resource Lease。不得删除队列历史。Cancel request 不直接终止正在产生不可分副作用的 Action，而由 Worker 在安全点处理。

## 7. 验收

- 20 个并发 Worker 不会领取同一个 Run。
- Claim 事务中 kill 数据库连接后不出现半 Claim。
- Lease 过期后新 Worker 接管，旧 Worker不能更新 Action/Checkpoint。
- Critical rollback 在普通任务队列中获得优先级。
