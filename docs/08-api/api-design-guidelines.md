---
id: EF-API-001
title: API 设计规范
version: '1.1'
status: accepted
classification: normative
owners:
- api
- architecture
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-007
- ADR-008
source_of_truth_for:
- API style
---


# API 设计规范

OpenAPI 3.1 文件是 URL、方法、请求响应和 Schema 的权威契约。本文定义风格。

- Base path：`/api/v1`。
- 查询使用 REST 资源；状态变化使用显式 Command，不允许通用 PATCH state。
- 长任务返回 `202 Accepted + Location/CommandAccepted`。
- 不可变 Revision 只有 create/read/submit/approve 等命令，没有内容 PATCH。
- JSON 使用 camelCase，时间 ISO 8601 with offset，ID UUID。
- 所有响应通过 workspace scope 和权限过滤。
- ETag 表示 aggregate version，不是 content hash；content hash 在响应字段中显式返回。

## 安全默认

所有接口要求认证；Secret Input 使用 no-store、独立日志策略和 writeOnly Schema。高风险命令需要 reauthentication/approval policy。
