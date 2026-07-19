---
id: EF-EXEC-002
title: Queue、Claim、Lease 与 Fencing
version: '1.1'
status: accepted
classification: normative
owners:
- backend
- platform
- qa
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-003
- ADR-004
- ADR-007
- ADR-012
source_of_truth_for:
- durable queue
- worker claim
- worker lease
- fencing
---


# Queue、Claim、Lease 与 Fencing

## Queue 语义

`execution.run_queue` 行在 Claim 时更新为 `claimed`，不删除。Run 终态后标记 `done/cancelled`，再按 retention 清理。Queue 是调度索引，`execution.runs.state` 是业务权威状态。

## Lease 权威

`execution.worker_leases` 是当前 Worker 所有权的唯一权威表。`execution.runs.fencing_token` 保存单调 epoch；Run 不重复保存 worker/claim_token/lease expiry。

## Claim 事务伪代码

```sql
BEGIN;
SELECT q.run_id
FROM execution.run_queue q
JOIN execution.runs r ON r.id=q.run_id
WHERE q.state='queued' AND q.available_at<=now()
ORDER BY q.priority DESC, q.queued_at
FOR UPDATE SKIP LOCKED LIMIT 1;

UPDATE execution.runs
SET state='claimed', fencing_token=fencing_token+1, version=version+1
WHERE id=:run_id AND state='queued'
RETURNING fencing_token;

UPDATE execution.run_queue
SET state='claimed', claimed_at=now(), claimed_by=:worker
WHERE run_id=:run_id AND state='queued';

INSERT INTO execution.worker_leases(...)
VALUES (..., :fencing_token, now()+:ttl)
ON CONFLICT (run_id) DO UPDATE ...;
INSERT run_event(... 'execution.run.claimed' ...);
COMMIT;
```

## Heartbeat

Worker 仅在 `claim_token + fencing_token + worker_id` 全匹配时续约。Heartbeat 更新不得改变业务状态。Lease 过期后 Recovery Coordinator 增加 fencing epoch；旧 Worker 的后续写入因 token 不匹配失败。

## 防护规则

- 所有 Attempt、Checkpoint、Action state 写入携带 fencing token。
- 外部系统不支持 fencing 时，Adapter 必须通过 resource-specific reconciliation/identity key 降低重复风险。
- 不能把 wall-clock timestamp 当 fencing token。

## 公平性

v1 使用优先级 + queued_at。Phase 9 可增加 workspace quota、capability pool 和 starvation prevention，但不得改变 Run 权威状态。
