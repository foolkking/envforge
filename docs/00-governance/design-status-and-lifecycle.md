---
id: EF-GOV-002
title: 设计状态与生命周期
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
- design lifecycle
---


# 设计状态与生命周期

## 生命周期

```text
draft → proposed → accepted → deprecated → superseded
```

| 转换 | 前置条件 | 审批 |
|---|---|---|
| draft → proposed | 章节完整、术语检查、影响分析、Open Questions 已登记 | 文档 Owner |
| proposed → accepted | 架构/产品/安全/测试相关 Owner 完成评审 | Architecture Owner；高风险设计需 ADR |
| accepted → deprecated | 存在替代路径和迁移计划 | Architecture Owner |
| deprecated → superseded | 新事实源已生效，链接和实施计划已更新 | Architecture Owner |

## 版本规则

- Patch：错别字、链接、说明性澄清，不改变行为。
- Minor：新增字段、状态或接口，但保持现有合同可兼容。
- Major：不兼容的领域、API、持久化或安全边界变化。

## 设计冻结

每个 Phase 启动前冻结该 Phase 的：领域状态机、DDL 约束、API 契约、验收证据。冻结后变化必须记录 ADR 或 Design Defect，并评估对已生成 Plan、活动 Run 和 Archive Reader 的影响。

## 活动实现保护

- 不对活动 Run 自动应用新状态机或 Adapter 版本。
- 不原地修改已确认 Revision、Plan 或 ArchiveVersion。
- 设计升级通过新 Revision、数据库 migration 和兼容 Reader 完成。
