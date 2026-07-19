---
id: EF-API-008
title: API 权限模型
version: '1.1'
status: accepted
classification: normative
owners: [api, security, product]
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: [ADR-010, ADR-011]
source_of_truth_for: [API permission names, authorization checks]
---

# API 权限模型

## 1. 角色基线

`Viewer`、`Operator`、`Approver`、`SecretOperator`、`ArchiveAdministrator`、`WorkspaceAdministrator`。角色是权限集合，不直接写入业务规则；部署可扩展 ABAC（Workspace、Project、risk、environment classification、time window）。

## 2. 权限目录

| 权限 | 典型接口 | 风险 |
|---|---|---|
| `project.read/create/archive` | Project API | 低/中 |
| `discovery.collect/review` | Snapshot、Candidate Review | 中 |
| `blueprint.confirm` | confirm revision | 高 |
| `plan.compile/approve/revoke` | Planning | 高 |
| `run.create/pause/resume/cancel` | Execution | 高 |
| `run.rollback` | Rollback | critical |
| `secret.bind/supply/rotate/revoke` | Secret | high/critical |
| `cutover.start/commit/rollback` | Cutover | critical |
| `archive.restore/scrub/delete` | Archive | high/critical |
| `archive.source-release` | Source Release | critical |
| `archive.key-recover` | Key recovery | critical |

## 3. 授权流程

请求认证后先解析 Workspace membership，再检查资源归属、权限、ABAC policy、step-up authentication 和审批分离。资源不存在与无权限可统一返回 404，避免枚举；审计内部记录真实原因。

## 4. Separation of Duties

Workspace Policy 可要求 Plan approver 与 Run operator 分离，Archive delete/key recovery/source release 双人审批。系统管理员不能自动获得 Secret value 读取权限。

## 5. Worker 权限

Worker 使用 machine identity，只可更新其有效 Lease/Fencing 范围内的 Run/Action/Checkpoint，不拥有用户级 plan approval 或 archive deletion 权限。

## 6. 测试

为每个 OpenAPI operation 生成 allow/deny matrix；跨 Workspace 一律拒绝；过期 membership 立即失效；step-up token 不可复用于其他高风险 operation；denied 请求不改变聚合且产生安全审计。
