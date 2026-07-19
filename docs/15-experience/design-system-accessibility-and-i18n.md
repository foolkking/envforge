---
id: EF-EXP-009
title: 设计系统、可访问性与国际化
version: '1.1'
status: accepted
classification: normative
owners:
- design
- frontend
- qa
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- design system
- accessibility
- internationalization
---

# 设计系统、可访问性与国际化

## 1. 视觉方向

EnvForge 应表现为稳定、技术性和证据密集的 Operations Workbench，而不是营销卡片或通用控制面板。

- 高信息密度，但保持清楚的层次；
- 优先 table/list/rail/inspector；
- 避免多层嵌套 Card；
- 语义色只用于状态，不作为装饰；
- dark mode 使用 token，不做页面级补丁堆叠。

## 2. 组件语义

至少建立：Button、Badge、StatusPill、RiskPill、Gate、EvidenceList、Timeline、DiffViewer、Code/LogViewer、Drawer、DataTable、Empty/Unknown State。

组件名称表达语义，不用通用 Badge 模拟所有状态。

## 3. 可访问性

- 所有操作键盘可达；
- focus 清晰；
- Dialog/Drawer 管理 focus；
- 状态颜色有文本和图标；
- Timeline/graph 有文本替代；
- 表格表头和排序可读；
- 进度支持 reduced motion；
- 日志支持复制但默认脱敏；
- 高风险确认不依赖拖动或颜色。

目标至少满足 WCAG 2.2 AA 的相关 Web 界面要求。

## 4. 国际化

Canonical 类型、状态、Event 和 API 字段保持英文；用户文案使用翻译 Key。禁止新增散落的 `locale ===` 分支。日期、时区、数字、文件大小和持续时间统一格式化。

中英文文案不得改变风险语义，例如 `manual-required` 不能翻译成暗示可自动完成的表述。

## 5. 测试

UI 变更至少覆盖：

- zh/en；
- light/dark；
- desktop/mobile；
- keyboard navigation；
- semantic status；
- Plan/Run deep links；
- no-secret screenshot/log；
- visual smoke 或受控 snapshot。
