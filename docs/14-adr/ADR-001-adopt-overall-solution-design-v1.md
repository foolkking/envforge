---
id: EF-ADR-001
title: ADR-001：采纳 Overall Solution Design v1.1
version: '1.1'
status: accepted
classification: normative
owners:
- architecture
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- design baseline
---

# ADR-001：采纳 Overall Solution Design v1.1

## 状态

Accepted — 2026-07-19

## 背景

EnvForge 已从同步 Apply 工具扩展为发现、构建、迁移、封存和恢复平台，需要统一术语、边界和实施约束。

## 决策

采纳 Markdown docs v1.1 作为工程事实源；DOCX 仅为发布视图。核心不变量变化必须 ADR。

## 决策驱动因素

- 数据完整性和可恢复性优先于短期实现便利；
- 设计必须能被数据库约束、API、测试和运行证据验证；
- 首期控制复杂度，同时保留明确演进路径；
- 不允许 UI 或临时兼容层绕过核心不变量。

## 被否决/暂缓方案

继续依赖聊天记录；单一超长文档；各团队自行定义对象。

## 后果

增加文档治理成本，但避免实现分叉；叶子规范承担权威，Overall 只做集成视图。

## 实施与迁移

- 在对应 Phase 通过 Feature Flag/兼容适配渐进引入；
- 新模型成为唯一写入事实源，旧路径只读或转译命令；
- 数据和 API 变化需 migration、backfill、OpenAPI 与 Acceptance 同步。

## 可逆性与退出条件

本决策可通过新的 ADR supersede，但已创建的不可变 Revision、Run、Commit、Audit 和 Archive 不被原地改写。替代方案必须给出历史数据读取、活动任务接管和安全回退路径。

## 风险

主要风险是实现复杂度、迁移期间双模型漂移和团队误用。通过事实源映射、CI 设计校验、Feature Flag、纵向验收和故障注入控制。

## 验证与复审

对应规范、测试和 Phase Acceptance 必须证明此决策。若规模、安全或兼容性前提变化，通过新 ADR supersede，不原地删除历史。
