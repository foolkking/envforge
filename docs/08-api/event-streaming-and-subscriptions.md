---
id: EF-API-007
title: 事件流与订阅
version: '1.1'
status: accepted
classification: normative
owners: [api, backend, platform]
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: [ADR-007]
source_of_truth_for: [SSE contract, event subscription model]
---

# 事件流与订阅

## 1. SSE

v1 对 Run Timeline 使用 SSE：`GET /api/v1/runs/{runId}/events/stream`。响应事件包含 `id`（Run sequence）、`event`（eventType）、`data`（redacted summary）。客户端使用 `Last-Event-ID` 断线续传。

服务端先从持久 RunEvent 读取缺失序列，再切换实时通知；实时通知不是事实源。Heartbeat comment 防止代理超时。权限在连接建立和定期刷新时校验。

## 2. Backpressure

客户端落后时可从数据库分页补读；服务端不无限缓存。高频 Transfer progress 可合并，但状态、Attempt、Checkpoint、Verification、Commit 事件不可丢弃。

## 3. Webhook/Subscription

[建议方案] Phase 9 提供持久 Subscription 资源：event filters、destination、secret ref、retry policy、delivery log。Webhook payload 签名、带 event id、timestamp 和 replay protection。未实施前 OpenAPI 不宣称 webhook available。

## 4. 安全

SSE/订阅不得输出 Secret、完整命令敏感参数、数据库行或 Archive private manifest。Workspace 跨租户过滤在查询层和测试层同时强制。

## 5. 验收

断线后无序列缺口；重复连接可收到重复事件但 UI 幂等；无权用户不能连接；Run 终态后流结束并可通过分页复核完整 Timeline。
