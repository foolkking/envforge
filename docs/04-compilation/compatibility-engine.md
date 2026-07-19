---
id: EF-COMP-006
title: Compatibility Engine
version: '1.1'
status: accepted
classification: normative
owners:
- backend
- capability
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-008
source_of_truth_for:
- CompatibilityEngine
---


# Compatibility Engine

## 输入

Blueprint CompatibilityEnvelope、Source/Target Snapshot 或 Archive、Capability Rules、Policy、DecisionSet。

## 输出

`compatible | compatible-with-conversion | review-required | blocked`，并包含 issue、evidence、conversion option、risk、required capability 和 target drift sensitivity。

## 检查维度

OS/architecture、package/runtime version、filesystem/UID/GID、ports/routes、database version/locale/extension、container driver、capacity、Secret injection、external dependency、Archive reader/encryption。

## 规则

- Unknown 不等于 compatible。
- Physical PostgreSQL data directory 只有明确版本/平台 Capability 才允许；默认 logical restore。
- Conversion 必须编译为 Action，不允许仅写 warning。
- Material Target Drift 使 Plan/Approval 失效。
