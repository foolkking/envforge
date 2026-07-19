---
id: EF-COMP-007
title: 编译错误与可追溯性
version: '1.1'
status: accepted
classification: normative
owners:
- backend
- qa
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- compiler errors
- compiler traceability
---


# 编译错误与可追溯性

## 错误分类

| 类别 | 结果 | 示例 |
|---|---|---|
| `input-invalid` | failed | Hash 不匹配、Revision 非 confirmed |
| `readiness-blocked` | blocked | Critical Dataset owner unknown |
| `compatibility-blocked` | blocked | 目标架构不支持 |
| `decision-required` | review-required | 目标端口冲突、Secret Provider 未绑定 |
| `capability-unavailable` | blocked | 无认证 Migration Adapter |
| `policy-denied` | blocked | Raw Shell 被禁止 |
| `compiler-internal` | failed | 不变量或序列化错误 |

## Trace

每个 PlanAction/Contract 保存：Blueprint JSON Pointer、Decision key、Capability Rule ID/version、Evidence refs、Compiler stage、生成理由。用户必须能从 Action 回溯到业务合同，而不是只看到命令。

## 错误响应

PlanCompilationRun 保存脱敏 diagnostics、blockers、questions、warnings 和 trace artifact。内部堆栈不返回客户端，也不能含 Secret。
