---
id: EF-SEC-004
title: 租户隔离
version: '1.1'
status: accepted
classification: normative
owners:
- security
- backend
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-003
source_of_truth_for:
- tenant isolation
---


# 租户隔离

所有资源属于 workspace。API 从认证上下文获取 workspace，不信任 body 中的 workspaceId；所有查询/命令带 workspace scope。

## 数据库

关键表直接保存 workspace_id，并使用 composite FK 阻止跨 workspace 关联。应用层 repository 必须强制 scope；Phase 9 多租户生产前启用 PostgreSQL RLS 并测试 background worker/service role。

## 对象存储和密钥

Object key 以不可猜 ID/Hash 分区；Repository credential 最小 prefix；加密 key/context 绑定 workspace/archive。跨租户去重禁止。

## 测试

对每个 GET/command 做 IDOR 测试，随机替换 resource ID；验证 404/403 不泄露存在性。Projection 和 Event Stream 同样隔离。
