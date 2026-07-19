---
id: EF-SUB-003
title: Secret Delivery Engine
version: '1.1'
status: accepted
classification: normative
owners:
- backend
- security
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-004
- ADR-009
source_of_truth_for:
- Secret Delivery Engine
- SecretDeliveryRun
---


# Secret Delivery Engine

## 生命周期

```text
SecretRef → SecretRequirement → SecretProviderBinding
→ SecretExecutionContract → JIT resolve → materialize/inject
→ validate → rotate? → cleanup/revoke
```

## 核心规则

- Secret value 不进入 Snapshot、Blueprint、Plan、Queue、Checkpoint、Event、Report 和普通数据库。
- Provider 返回受控 `SecretHandle`，不是普通 string。
- Required Secret 不可用时 Run=`waiting/blocked`。
- 注入后以 consumer 行为验证，不能打印 Secret。

## Materialization

优先级：external reference/systemd credential/Docker secret → protected file → environment → command argument（默认禁止）。临时文件优先 tmpfs、0600、受控 owner，并有 cleanup evidence。

## 崩溃恢复

- resolved 未 injected：销毁并重新 resolve；
- injected 未 validated：inspect target reference/consumer；
- rotated 但 consumer 未更新：高优先级恢复，禁止再次生成；
- old revoked：不能普通 rollback，必须完成新凭据或人工修复。

## Audit/Redaction

记录 requirement、provider type、version fingerprint、actor、结果和时间，不记录 value。统一 redaction pipeline 处理结构化字段、connection string、PEM、known token 和高熵串。
