---
id: EF-PERSIST-005
title: 事务与并发
version: '1.1'
status: accepted
classification: normative
owners:
- backend
- platform
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-003
- ADR-004
- ADR-007
source_of_truth_for:
- transaction boundaries
- optimistic concurrency
---


# 事务与并发

## 命令事务模板

```text
authorize + validate idempotency
load aggregate FOR UPDATE or CAS version
validate state transition and invariants
write aggregate/current child rows
append domain event and outbox
store idempotency result
commit
```

可变聚合根包含 `version bigint`；API 使用 `If-Match`。条件更新 0 行返回 412。业务冲突返回 409，锁资源返回 423。

## 隔离

默认 READ COMMITTED + explicit row locks/CAS。Claim 使用 `FOR UPDATE SKIP LOCKED`。Commit、Authority Transfer、Source Release 和 Archive Finalize 需要锁定聚合根并使用 unique/once-only constraint。

## 外部副作用

数据库事务不能包裹 SSH/Provider 调用。采用 Attempt receipt、idempotency key、reconciliation 和 compensation，不声称分布式原子事务。
