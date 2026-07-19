---
id: EF-GOV-005
title: 开放问题登记册
version: '1.1'
status: proposed
classification: normative
owners:
- architecture
- product
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- open questions
---


# 开放问题登记册

状态：`open | proposed | decided | deferred | rejected`。所有 open 项必须有 Owner、推荐方案和最迟决策阶段。

| ID | 优先级 | 问题 | 影响 | 推荐方案 | Owner | 最迟阶段 | 状态 | 决策/ADR |
|---|---|---|---|---|---|---|---|---|
| OQ-001 | P0 | 首期认证 OS 精确范围 | Collector、Package、测试矩阵 | Ubuntu 22.04/24.04 + Debian 12，x86_64 | Product/Capability | Phase 1 | proposed | — |
| OQ-002 | P0 | 用户认证方式 | API/UI、审计、Secret 输入 | 本地管理员引导 + OIDC 可选；生产 MFA；高风险 recent reauth | Security | Phase 0 | decided | ADR-014；2026-07-19 |
| OQ-003 | P0 | PostgreSQL migration 工具和 ORM | DDL、事务、回滚 | 显式 SQL migration 为权威；ORM 不自动同步生产 Schema | Backend | Phase 0 | decided | ADR-015；2026-07-19 |
| OQ-004 | P0 | Artifact 本地开发实现路径与加密默认 | Secret/证据安全 | Local 原子发布 + SHA-256；生产敏感 Artifact 默认加密 | Infra/Security | Phase 0 | decided | ADR-016；2026-07-19 |
| OQ-005 | P1 | Build/Restore Commit 是否统一 | 状态机、API、Report | 采用 `ExecutionCommitRecord` | Architecture | Phase 1 | decided | ADR-010 |
| OQ-006 | P1 | 非 Plan 长任务的统一模型 | Snapshot/Compilation/Scrub | `ControlPlaneOperation` + 子系统运行记录；不冒充 ExecutionRun | Architecture | Phase 1 | decided | ADR-011 |
| OQ-007 | P1 | Capability 包版本保留周期 | 旧 Plan/Archive 可读性 | 保存 manifest 和兼容 Reader；执行需可用认证版本 | Capability | Phase 3 | open | — |
| OQ-008 | P1 | Secret Provider 控制面凭据存储 | 安全边界 | 操作系统 Keyring/Vault/KMS 引用；数据库不存明文 | Security | Phase 3 | open | — |
| OQ-009 | P1 | PostgreSQL Golden Migration 最大规模 | 停机预算、支持声明 | 以实测 dump/restore 预算和用户窗口为 Gate，不按单一容量硬编码 | Dataset/Product | Phase 5 | proposed | — |
| OQ-010 | P1 | DNS 自动 Provider 首期范围 | Cutover | Phase 6 只做结构化人工 DNS + Nginx；自动 Provider 后续 | Product | Phase 6 | proposed | — |
| OQ-011 | P1 | Archive Key Provider 首期组合 | Preserve 可恢复性 | Vault Transit/KMS 之一 + 用户恢复密钥 | Security/Archive | Phase 7 | open | — |
| OQ-012 | P2 | PostgreSQL RLS 启用阶段 | 租户隔离 | Phase 9 前强制应用层 workspace scope；生产多租户前启用 RLS | Security/Backend | Phase 9 | proposed | — |
| OQ-013 | P2 | Webhook 是否进入 v1 | API 订阅 | v1 以 SSE + Outbox Consumer 为主；Webhook 延后 | Product/API | Phase 9 | proposed | — |
| OQ-014 | P2 | 可选 Agent 的协议 | 网络和长期任务 | 在 Agentless SSH 认证后另立设计 | Architecture | Phase 9 | deferred | — |

## 关闭规则

问题只有在填写决策、接受者、日期和 ADR（若需要）后才能标记 `decided`。任何代码实现不得以默认值隐式关闭 open 问题。
