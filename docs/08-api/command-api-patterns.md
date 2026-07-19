---
id: EF-API-003
title: 命令 API 模式
version: '1.1'
status: accepted
classification: normative
owners:
- api
- backend
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-007
source_of_truth_for:
- command API
---


# 命令 API 模式

## 请求

```http
POST /api/v1/runs/{runId}/pause
Idempotency-Key: 9b...
If-Match: "17"
```

根资源创建没有父版本时使用 `If-Match: *`；子资源创建使用父聚合 ETag。命令 Body 不包含目标状态，只包含意图和必要证据。

## 响应

同步完成返回 200/201；长操作返回 202：

```json
{"resourceId":"...","resourceType":"ExecutionRun","status":"queued","location":"/api/v1/runs/..."}
```

重复相同 Idempotency Key + request hash 返回原响应；相同 key 不同 body 返回 409。

## 命令处理

Authorize → Idempotency → Load/CAS → Validate state/invariant → Persist state/event/outbox/idempotency → Commit。外部副作用不在 HTTP 事务内执行。
