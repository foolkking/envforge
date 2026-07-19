---
id: EF-EXP-010
title: 当前 Web 实现说明
version: '1.1'
status: accepted
classification: informative
owners:
- frontend
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- current legacy web implementation guide
current_implementation_as_of: '2026-07-18'
target_architecture_authority: false
retirement_phase: phase-10
---

# 当前 Web 实现说明

> 本文记录旧代码基线的实现事实，用于 Preparation 审计和迁移。它不是目标信息架构或领域模型事实源。所有路径必须在当前仓库 HEAD 上重新验证。

## 1. 当前技术

旧基线使用 React 18、Vite 和单体 Web Workspace。目标设计不会强制保留当前组件和 CSS 组织。

## 2. 历史导航

旧用户导航包含 Dashboard、Migrate、Build、Plans、Reports；管理员另有 Capability Admin。历史上 Account/Settings 被折叠，Maintain 被拆入 Plans/Dashboard/Admin，普通用户 Catalog 被 Build 取代。

这些决策的目标原则已迁入 [`information-architecture.md`](information-architecture.md)，具体旧 route 不再是规范。

## 3. 已记录代码路径

历史文档记录：

```text
apps/web/src/lib/nav.ts
apps/web/src/components/PipelineBar.tsx
apps/web/src/components/ui/*
apps/web/src/styles.css
apps/web/src/styles/*
apps/web/src/i18n/locales/{zh,en}.ts
```

Preparation 必须核实文件是否仍存在。

## 4. CSS

历史实现将 `styles.css` 作为 import-only 入口，拆分 tokens/base/components/shell/page files，并通过 `legacy-overrides.css` 和 `overrides.css` 保持旧 cascade。迁移前不得盲目删除后置 override；应由视觉回归和 computed-style 检查证明可移除。

## 5. UI Smoke

历史命令：

```bash
npm run smoke:web
```

曾覆盖 public、auth、user/admin routes、desktop/mobile、zh/en 和 light/dark；截图通过环境变量选择。Preparation 应将真实命令和覆盖范围写入当前测试清单。

## 6. 迁移要求

- 旧 Migrate/Build 内嵌下游执行应迁入统一 Plan/Run 页面；
- `/app/reports` 等旧链接需兼容重定向；
- 当前 `ServiceStack`、`EnvironmentPlan` 等 UI 类型需映射到新 API；
- Capability Admin 保持治理性质；
- 在 Phase 10 删除不再使用的 route、component、CSS compatibility layer。
