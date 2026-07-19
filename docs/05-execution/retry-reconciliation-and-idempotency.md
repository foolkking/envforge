---
id: EF-EXEC-004
title: Retry、Reconciliation 与幂等
version: '1.1'
status: accepted
classification: normative
owners:
- backend
- qa
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-007
source_of_truth_for:
- retry policy
- reconciliation
- idempotency
---


# Retry、Reconciliation 与幂等

## 失败分类

`transient-network, transient-remote, rate-limited, resource-busy, authentication, authorization, precondition-failed, target-drift, validation-failed, data-integrity-failed, insufficient-capacity, deterministic-command-failure, side-effect-unknown, worker-crash, user-cancelled, manual-intervention-required`。

## Retry Policy

包含最大 Attempt、可重试分类、exponential backoff、jitter、deadline 和是否强制 reconcile。认证、授权、Material Drift、数据完整性和 deterministic failure 默认不可自动重试。

## 禁止盲重试

删除、配置覆盖、数据库 restore、DNS/Traffic switch、源停止、Final Sync、密钥轮换和任何 `side-effect-unknown` 必须先 inspect/reconcile。

## Reconciliation 结果

`not-applied | applied | partially-applied | unknown | inconsistent`。

- applied：验证 postcondition 后将原 Attempt 视为成功证据。
- not-applied：可按 Retry Policy 新建 Attempt。
- partially-applied：使用 step resume、cleanup、rollback 或 block。
- unknown/inconsistent：禁止自动继续高风险链路。

## 幂等键

API 命令、PlanAction 和外部 Provider 请求分别使用不同 idempotency scope。数据库唯一约束用于防重复创建，不能只依赖内存缓存。
