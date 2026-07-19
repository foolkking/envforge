---
id: EF-GOV-006
title: 设计变更流程
version: '1.1'
status: accepted
classification: normative
owners:
- architecture
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-001
source_of_truth_for:
- design change process
---


# 设计变更流程

## 变更分类

| 变更 | 处理方式 |
|---|---|
| 错别字、链接、非行为澄清 | 直接 PR；至少一名 Owner 审查 |
| 新增兼容字段、可选检查 | 规范 PR + 兼容性和测试影响 |
| 状态、API、DDL、权限或加密边界变化 | ADR + 规范更新 + Migration/Versioning 计划 |
| 核心产品范围或不变量变化 | Overall Design minor/major 版本 + 跨团队评审 |

## PR 必需内容

- 变更原因和来源 Issue；
- 受影响事实源、衍生文档和代码模块；
- 兼容性：已有 Revision、Plan、活动 Run、Archive Reader；
- 安全和数据迁移影响；
- 新增/修改测试；
- Open Questions 与 ADR；
- 文档验证器结果。

## 冲突处理

发现实现与规范冲突时，先停止扩散。记录当前行为、期望行为、数据风险和可逆性；由事实源 Owner 决定修代码、修规范或建立兼容层。不得通过 UI 文案掩盖实际能力差距。
