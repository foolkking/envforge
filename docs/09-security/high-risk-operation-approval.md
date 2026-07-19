---
id: EF-SEC-009
title: 高风险操作审批
version: '1.1'
status: accepted
classification: normative
owners: [security, product, backend]
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: [ADR-010, ADR-011]
source_of_truth_for: [high-risk approval policy]
---

# 高风险操作审批

## 1. 高风险操作

Plan approval、Cutover start/commit/rollback、target overwrite、Secret rotate/revoke、Archive key recovery/delete、Source Release、Break Glass、ReviewedCommandAction 和接受确定数据损失。

## 2. Approval Binding

审批必须绑定 exact resource hash/version、风险集合、限制、过期时间、actor、policy 和必要 step-up factor。输入、Hash、target Snapshot 或风险发生 material change 时自动失效。

## 3. 双人和职责分离

Workspace Policy 可要求 operator != approver；critical Archive delete/key recovery/source release 使用 two-person rule。系统管理员角色不等于自动批准。

## 4. 运行时确认

维护窗口或 Commit 前可以要求 second confirmation，但它只确认实时状态，不替代原 PlanApproval。机器 Gate（Dataset Commit、Verification、Authority）不能被用户确认绕过。

## 5. Break Glass

只用于恢复服务/安全事件；需要强认证、原因、有限 scope/TTL、实时告警和事后 review。Break Glass 不能读取 Secret 明文或伪造 Verification。

## 6. 验收

过期/撤销/Hash 不匹配审批不可使用；同一用户在 SoD Policy 下无法自批自执行；审批记录可从 Run/Commit 追溯；API 和 UI 不提供直接状态 PATCH 绕过。
