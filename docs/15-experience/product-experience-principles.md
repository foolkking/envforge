---
id: EF-EXP-001
title: 产品体验原则
version: '1.1'
status: accepted
classification: normative
owners:
- product
- design
- architecture
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-005
- ADR-008
source_of_truth_for:
- product experience principles
---

# 产品体验原则

## 1. 定位

EnvForge 是面向现有 Linux 环境的发现、构建、迁移、封存和恢复工作台。它不是通用服务器面板、直接 SSH 执行器、备份浏览器、Ansible/Terraform 替代品或应用市场。

核心体验承诺：

```text
把未知、不可控的 Linux 环境，转化为可解释、可审查、可执行、可验证和可恢复的生命周期合同。
```

## 2. 价值顺序

用户价值按以下顺序建立：

```text
Insight → Explanation → Decision → Approval → Execution → Verification → Recovery Evidence
```

首次使用不以“立即迁移成功”为目标，而以“用户终于知道服务器上有什么、哪些内容重要、哪些风险未知”为目标。

## 3. 证据优先

UI 不得把推断描述为事实。每个关键结论应能展开查看：

- Evidence 来源；
- Collector 完整性；
- confidence；
- risk；
- conflicting evidence；
- unresolved question；
- user decision；
- 该决定将怎样影响 Blueprint 或 Plan。

`unknown` 不得渲染为 `absent`，`not-collected` 不得渲染为 `safe`。

## 4. Plan-first mutation

所有目标变更必须呈现为：

```text
Confirmed Contract → Decision → Immutable Plan → Approval → Durable Run → Verification → Commit/Report
```

界面不得提供绕过 Plan、Approval 或 required Verification 的主操作。直接变更主机、编辑远端文件或安装包不属于 v1 的普通用户体验。

## 5. 风险必须可见

风险展示至少包含：

- 风险级别和来源；
- 影响对象；
- Required Gate；
- 是否接受风险；
- 替代方案；
- 回滚边界；
- Point of No Return；
- 未解决时对 Plan/Run 的影响。

不得仅用颜色表达风险，必须同时使用文本、图标和语义状态。

## 6. 失败必须可操作

失败信息必须回答：What、Where、Attempt、Impact、Evidence、Likely Cause、Next Action。系统必须诚实说明：

- 能否重试；
- 是否会重复副作用；
- 是否需要 Reconcile；
- 能否自动回滚；
- 是否只能人工处理；
- 是否可以生成待审核 Repair/Rollback Plan。

## 7. 支持而不夸大

UI 只展示 Capability 实际认证的维度。Detect 成功不表示 Build/Migrate/Restore 已支持；普通用户不得看到可执行但未认证的 Capability 作为安全选项。

## 8. 当前实现与目标设计分离

目标体验由本目录定义。当前路由、React 组件、CSS 文件和旧对象形状记录于 [`current-web-implementation.md`](current-web-implementation.md)，不得反向限制最终领域模型。
