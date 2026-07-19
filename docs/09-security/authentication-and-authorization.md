---
id: EF-SEC-003
title: 身份认证与授权
version: '1.1'
status: accepted
classification: normative
owners:
- security
- api
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-001
- ADR-014
source_of_truth_for:
- authentication
- authorization
---


# 身份认证与授权

根据 ADR-014，v1 支持本地管理员引导和 OIDC；生产策略必须支持 MFA，高风险操作要求 recent reauthentication。Session 使用 HttpOnly/Secure/SameSite Cookie 或短期 Bearer，CSRF 防护适用于 Cookie 模式。应用会话不得复用为 SSH 或 Secret Provider Credential。

## RBAC/ABAC

基础角色：Viewer、Operator、Approver、Secret Operator、Archive Administrator、Workspace Administrator。ABAC 条件包括 workspace、resource owner、risk severity、Archive criticality、Project state。

## Reauthentication

Plan Approval、Cutover Commit、Source Release、Secret Rotation/Revoke、Archive Delete/Key Recovery 要求最近 MFA/reauth；Policy 可要求双人审批和执行者隔离。

## 服务身份

API、Worker、Projection、Archive Service 使用独立身份和最小数据库/Provider权限。Worker Credential 可轮换，不能复用用户 Session。
