---
id: EF-API-006
title: 长任务返回模型
version: '1.1'
status: accepted
classification: normative
owners: [api, backend]
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: [ADR-004, ADR-011]
source_of_truth_for: [ControlPlaneOperation, long-running HTTP semantics]
---

# 长任务返回模型

## 1. 两类长任务

- `ControlPlaneOperation`：Snapshot collection、Candidate generation、Plan compilation、Scrub、Repair、Archive import 等控制面作业。
- `ExecutionRun`：执行 Approved Plan，或独立 Verification/Rollback。

两者不得混用。Operation 不承载 Plan Action DAG 或业务 Commit。

## 2. HTTP 语义

创建返回 `202 Accepted`，`Location` 指向 Operation/Run，body 包含 ID、state、createdAt、links。相同 Idempotency-Key 返回同一 ID。同步验证错误（权限、参数、状态冲突）直接返回 4xx，不创建假 Operation。

## 3. ControlPlaneOperation

状态：`created | queued | running | waiting | succeeded | failed | cancelled`。字段包括 kind、progress summary、result resource refs、error ProblemDetails、version。大结果通过 Artifact/资源链接返回。

## 4. Polling 与 Retry-After

GET 支持 ETag；未变化可 304。服务端可返回 `Retry-After`。客户端不得依据百分比推断成功；只在终态和 result refs 完整时继续。

## 5. 取消

只有 operation 声明 cancellable 才提供 cancel command。已产生不可逆副作用的任务转 blocked/manual 或完成清理，不伪造 cancelled。

## 6. 验收

API 重启后 Operation 可查询；相同 Key 不重复创建；失败返回稳定 ProblemDetails；结果资源创建与 operation success 原子或通过可恢复 finalization 保证。
