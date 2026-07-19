---
id: EF-ADR-014
title: ADR-014：Authentication 与高风险 Reauthentication 基线
version: '1.1'
status: accepted
classification: normative
owners: [security, api]
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: [ADR-013]
source_of_truth_for: [authentication baseline, reauthentication baseline]
---

# ADR-014：Authentication 与高风险 Reauthentication 基线

## 状态

Accepted — 2026-07-19；关闭 OQ-002。

## 当前事实

当前产品已有本地账户、GitHub/Google OAuth、TOTP、Bearer Session 和 API Token，但尚无目标 workspace RBAC/ABAC 与统一高风险 reauthentication 合同。

## 方案比较

- 本地账户 only：开发和离线部署简单，但企业生产身份治理不足。
- OIDC only：企业联邦强，但引导和恢复依赖外部 IdP。
- 本地管理员引导 + 可选 OIDC：保留本地恢复能力，同时允许生产联邦和策略强化。

## 决策

首期支持本地管理员引导并保留 OIDC。生产策略必须支持 MFA；Plan Approval、Cutover Commit、Source Release、Secret Rotation/Revoke、Archive Delete/Key Recovery 等高风险操作要求 recent reauthentication，可配置双人审批/执行者隔离。应用会话、SSH Credential 与 Secret Provider Credential 必须分离。

## 后果与验证

Phase 0 建立身份/会话基础和审计绑定；后续 Phase 完成 workspace RBAC/ABAC 与高风险策略。测试必须覆盖本地/OIDC 会话、MFA、reauth 过期、权限拒绝和审计，不得把当前 TOTP 字段视为目标合同已实现。
