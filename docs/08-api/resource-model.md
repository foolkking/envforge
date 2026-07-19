---
id: EF-API-002
title: API 资源模型
version: '1.1'
status: accepted
classification: normative
owners: [api, architecture]
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: [ADR-008, ADR-010, ADR-011]
source_of_truth_for: [API resource hierarchy]
---

# API 资源模型

## 1. 资源分类

- 稳定根：projects、endpoints、workloads、archives。
- 不可变 Revision：snapshots、blueprint-revisions、decision-set-revisions、plans、archive-versions。
- 审批/提交：plan-approvals、execution-commits、cutover-commits、source-release-commits。
- 长任务：operations、runs、dataset-runs、transfer-sessions、scrub-runs、restore-drills。
- 证据读取：events、attempts、checkpoints、verification-results、reports。

## 2. URL 原则

资源拥有稳定全局 ID；嵌套路由用于创建/过滤关系，不改变 canonical Location。例如通过 `/projects/{id}/plan-compilations` 创建，结果 Plan 的 canonical URL 是 `/plans/{planId}`。

## 3. 修改语义

不可变 Revision 不支持 PATCH；修改通过 `draft-successor` 或新 compilation。状态变化使用命令子资源：approve、pause、resume、commit、rollback。普通 metadata 可 PATCH，但必须 If-Match。

## 4. 表示

所有资源包含 `id`、`workspaceId`（可按权限省略展示）、`version`（可变根）、timestamps、state/status、`_links`。引用使用 `{id, hash?}`；安全关键不可变绑定同时返回 ID 与 Hash。

## 5. 分页

集合使用 cursor pagination：`limit`, `cursor`, `sort`, filters。响应 `items` 为具体 schema，附 `nextCursor`；不得使用 untyped generic object。事件按 sequence/time 排序，Manifest/Part 使用专用游标。

## 6. 删除

高风险/不可变资源无普通 DELETE；Project archive、Archive deletion request、Secret revoke 使用命令。返回 202 表示进入删除流程，不表示字节已经物理删除。

## 7. 权威契约

具体 path、method、header、request/response 和错误由 [OpenAPI](openapi/openapi.yaml) 定义。本文件不允许增加 OpenAPI 未定义的生产接口。
