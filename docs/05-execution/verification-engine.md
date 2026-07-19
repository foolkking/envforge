---
id: EF-EXEC-008
title: Verification Engine
version: '1.1'
status: accepted
classification: normative
owners:
- backend
- qa
- product
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-005
source_of_truth_for:
- VerificationEngine
- VerificationResult
---


# Verification Engine

## 分层

`artifact → syntax → runtime → dependency → dataset → business transaction → external observation`。

## 时点

`post-action, stage, pre-cutover, post-cutover, observation, final`。Required Check 是 DAG/Gate 的一部分，不是事后按钮。

## Result

包含 check ID/version、required、vantage point、started/completed、status、evidence Artifact、redacted summary、source baseline comparison 和 cleanup result。

## 成功规则

- required 全部 passed；warning 不能替代 required。
- HTTP 200 需同时验证预期内容/TLS/latency，避免维护页误判。
- DB 业务验证使用隔离 write/read/delete 或 transaction rollback。
- 外部路径至少一个 control-plane/external vantage；target-local 不能证明公网路径。
- Synthetic write 必须幂等、隔离、可清理，清理失败按 Policy warning/block。

## 失败

Pre-cutover 失败阻止切流；Post-switch 失败按 Target Writes、Rollback Eligibility 和 Failure Policy 决定 retry/hold/rollback/manual。
