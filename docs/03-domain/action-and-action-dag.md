---
id: EF-DOM-006
title: PlanAction 与 Action DAG
version: '1.1'
status: accepted
classification: normative
owners:
- architecture
- backend
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-007
source_of_truth_for:
- PlanAction
- ActionDAG
---


# PlanAction 与 Action DAG

## PlanAction

核心字段：`id, actionKey, stageKey, type, adapterId/version, target, workload/component, inputs, preconditions, postconditions, verificationCheckIds, retryPolicy, recoveryContract, rollbackDefinition, resumability, riskLevel, resourceKeys, trace`。

Action ID 由 Plan/Workload/Component/Type/normalized inputs 确定性生成。普通字符串 Shell 不是 Action；仅允许经过审核的 `ReviewedCommandAction`，并必须声明输入、输出、redaction、rollback 和风险。

## 依赖

- `must-complete-before`
- `must-succeed-before`
- `same-checkpoint`
- `rollback-after`
- `exclusive-resource-lock`

编译器必须验证无环、Action Key 唯一、所有依赖同 Plan、所有 Required Contract 有实现节点。

## 可恢复性

`idempotent | byte-resumable | step-resumable | restart-required | manual`。每个非幂等 Action 必须有 reconciliation probe，区分 `not-applied | applied | partially-applied | unknown`。
