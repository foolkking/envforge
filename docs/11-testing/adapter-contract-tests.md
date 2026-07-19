---
id: EF-TEST-004
title: Adapter Contract Tests
version: '1.1'
status: accepted
classification: normative
owners: [qa, capability, security]
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: [ADR-004, ADR-006, ADR-007]
source_of_truth_for: [adapter contract tests]
---

# Adapter Contract Tests

## 1. 适用对象

DetectionAdapter、PlanningAdapter、ExecutionAdapter、SecretProvider、TrafficProvider、ArchiveRepository 和 Dataset Source/Target Adapter 都必须通过对应 Contract Suite。

## 2. ExecutionAdapter 契约

每个 Action 类型测试：

1. `inspect/precondition`：资源 absent/present/conflicting/unknown。
2. `execute`：返回结构化 receipt，不以 stdout 作为唯一事实。
3. `postcondition`：真实外部状态满足合同。
4. `reconcile`：not-applied/applied/partially-applied/unknown/conflict。
5. `rollback/cleanup`：基于 before-state，重复调用幂等。
6. retry classification、timeout/cancel、resource key、fencing 和 redaction。

## 3. 故障矩阵

| 注入点 | 预期 |
|---|---|
| execute 调用前 kill | 可安全重新调度 |
| 远端副作用中断网 | reconcile 后决定 retry/block |
| 副作用完成但 receipt 前 kill | 不盲重做；inspect 确认 |
| receipt 后 checkpoint 前 kill | 新 Worker 从 receipt/reconcile 恢复 |
| rollback 中 kill | 独立 Rollback Run 可恢复 |

## 4. 权限与命令安全

不足权限应分类 authorization，不得重试；允许的 sudo command 最小化；参数通过结构化 escaping/schema；测试禁止 shell injection、日志泄密和未声明命令调用。

## 5. Fixture

每个 Adapter 提供 disposable target、before-state、expected after-state、cleanup、supported version matrix 和 evidence fixture。测试必须在至少一个真实 Linux 环境运行，不能只 mock SSH。

## 6. 认证门禁

所有 required case 通过、Crash Matrix 无 unknown unsafe result、Redaction 扫描通过、known limitations 已记录，才可标记对应 mode Certified。
