---
id: EF-API-005
title: API 错误模型
version: '1.1'
status: accepted
classification: normative
owners:
- api
- backend
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- Problem Details
- API errors
---


# API 错误模型

使用 `application/problem+json`：

```json
{
  "type":"https://envforge.dev/problems/invalid-state-transition",
  "title":"Invalid state transition",
  "status":409,
  "code":"INVALID_STATE_TRANSITION",
  "detail":"A source-quiesced cutover cannot be paused.",
  "instance":"/api/v1/cutover-runs/.../pause",
  "currentState":"source-quiesced",
  "expectedVersion":42,
  "errors":[]
}
```

## 状态码

400 语法；401 未认证；403 越权/Policy；404 不可见或不存在；409 状态/幂等冲突；412 ETag；422 领域字段；423 锁；429 限流；500 内部错误。

## 关键错误码

`INVALID_STATE_TRANSITION, IDEMPOTENCY_KEY_REUSED, VERSION_MISMATCH, PLAN_NOT_APPROVED, PLAN_HASH_MISMATCH, MATERIAL_DRIFT, CAPABILITY_UNAVAILABLE, SECRET_UNAVAILABLE, DATASET_CONSISTENCY_NOT_REACHED, RESOURCE_LOCKED, SIDE_EFFECT_UNKNOWN, VERIFICATION_FAILED, CUTOVER_COMMIT_NOT_ALLOWED, ARCHIVE_UNRECOVERABLE, SOURCE_RELEASE_NOT_SAFE`。

错误 detail 不得包含 Secret、完整命令、连接字符串或敏感响应。
