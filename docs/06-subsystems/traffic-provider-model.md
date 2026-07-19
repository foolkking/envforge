---
id: EF-SUB-006
title: Traffic Provider 模型
version: '1.1'
status: accepted
classification: normative
owners:
- backend
- capability
- network
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-007
source_of_truth_for:
- TrafficProvider
- TrafficSwitchContract
---


# Traffic Provider 模型

## Provider 接口

`inspectRoute, prepare, applySwitch(expectedBeforeHash), verifySwitch, rollback(beforeState)`。API 超时后必须 inspect，不能假设成功或失败。

## v1 Provider

- Nginx route/upstream：保存 before config、生成 reviewed artifact、syntax test、atomic replace、reload、inspect active config。
- Structured Manual DNS：记录 before/expected state，用户操作后从权威 DNS 和外部 resolver probes 验证。

自动 DNS/LB/Cloudflare Provider 属后续认证范围。

## DNS 语义

DNS 非原子。记录 original/prepared TTL、loweredAt、authoritative check、recursive probes 和 propagation threshold。传播期 TrafficState 可能 `mixed`，源端应代理到目标或维护，不能独立写入。

## Canary

只有共享权威数据、Session/Schema 兼容和认证 Capability 才允许 weighted/canary；状态型黄金场景 v1 使用 all-at-once。
