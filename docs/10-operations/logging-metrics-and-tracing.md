---
id: EF-OPS-003
title: 日志、Metrics 与 Tracing
version: '1.1'
status: accepted
classification: normative
owners: [operations, platform, security]
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: [ADR-007]
source_of_truth_for: [logging, metrics, tracing]
---

# 日志、Metrics 与 Tracing

## 1. 日志

结构化 JSON 字段：timestamp、level、service、environment、workspace/project/run/action/attempt（按权限）、correlationId、requestId、eventType、errorClass、provider、duration。日志是诊断信息，不是 Run 权威证据。

禁止记录 Secret value、private key、完整 connection string、Secret input request body、数据库行、解密 Manifest、未经脱敏 stdout/stderr。命令只记录 action type、template hash 和 redacted parameter summary。

## 2. Redaction

在日志库、HTTP access log、Adapter output、error tracker、Trace attribute 和 support bundle 发送前统一处理：结构化敏感字段删除、已知 Secret exact match、connection string、PEM/key、高熵 token 和长度截断。Canary Secret 测试覆盖所有 sink。

## 3. Metrics

低基数 labels：service、state、phase、capability、worker_pool、error_class、provider_type、risk_class。禁止把 UUID、domain、path、user ID 作为 label。高基数细节通过 Event/Trace 查询。

## 4. Tracing

Trace 链：API command → DB transaction/outbox → dispatcher/claim → Action Attempt → Adapter/Provider → receipt/evidence。Trace ID 写 Audit/Attempt，采样丢失不影响业务证明。Secret 输入和 payload 内容不进入 span。

## 5. 保留

Debug 日志短期；Audit/Event/Report 按规范长期。日志删除不得破坏 Commit/Verification 证据。生产默认 info，动态 debug 需 scope/TTL/审计。

## 6. 验收

在正常、失败和 crash 场景可通过 correlation ID定位；指标无高基数爆炸；Secret canary 全 sink 0 命中；Trace 与 RunEvent 时间线可关联但不被当作事实源。
