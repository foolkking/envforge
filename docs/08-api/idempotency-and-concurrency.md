---
id: EF-API-004
title: API 幂等与并发
version: '1.1'
status: accepted
classification: normative
owners: [api, backend]
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: [ADR-003, ADR-007]
source_of_truth_for: [API idempotency, API optimistic concurrency]
---

# API 幂等与并发

## 1. Idempotency-Key

所有产生副作用的 POST command 必须使用 `Idempotency-Key`。服务端作用域为 `(workspaceId, actorId, operationId, key)`，保存 normalized request hash、处理状态、响应码、响应 body hash、created resource/operation ID 和 expiry。

同 Key 同 request hash：处理完成返回原响应；处理中返回相同 Operation/Resource；同 Key 不同 hash 返回 `409 IDEMPOTENCY_CONFLICT`。TTL 不短于客户端/网关最大重试窗口和长任务创建窗口。

## 2. Optimistic Concurrency

修改现有聚合的 command 必须使用 `If-Match: "<version>"`。根资源创建可使用 `If-Match: *` 或不要求版本，以 OpenAPI 为准。版本不匹配返回 412；状态机前置条件不满足返回 409；Resource Lease 冲突返回 423。

响应携带 `ETag` 和当前 `version`。服务端禁止 last-write-wins 覆盖确认、审批、Run 控制或 Commit。

## 3. 多层幂等

API 幂等不替代：

- Plan 编译确定性 hash；
- PlanAction `actionKey`；
- Adapter/Provider idempotency token；
- TransferPart `(session, object, offset, length, hash)`；
- Traffic Provider expected-before-state hash；
- Commit Record unique constraint。

每层作用域和重复结果都必须明确。

## 4. 长任务创建

创建 Run/Compilation/Scrub/Drill 返回 202 与稳定 operation ID。客户端超时后用相同 Key 重试，服务端不得创建第二个任务。

## 5. 示例

```http
POST /api/v1/runs/01.../pause
Idempotency-Key: 5f2...
If-Match: "12"
```

成功返回新 ETag；重复同请求返回相同结果。若版本已经 13 且 Key 首次出现，返回 412。

## 6. 测试

并发 50 次相同 create command 只创建一个资源；相同 Key 不同 body 冲突；两个不同 actor 的同 Key 不互相污染；代理重试不会重复启动 Run；CAS 失败不写 Event/Outbox。
