---
id: EF-GOV-001
title: 文档约定
version: '1.1'
status: accepted
classification: normative
owners:
- architecture
- engineering
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-001
source_of_truth_for:
- documentation conventions
---


# 文档约定

## 1. 文档层次

1. **ADR**：解释为什么选择某项不可轻易逆转的方案。
2. **叶子规范**：某一领域、API、数据库或运行算法的唯一权威合同。
3. **总体设计**：跨领域集成视图，不重复维护所有细节。
4. **Roadmap/Acceptance**：实施顺序和证据要求，不重新定义领域语义。
5. **示例和图**：帮助理解；与文字规范冲突时不具权威性。

## 2. Front matter

所有 Markdown（目录 README 除外也建议包含）必须声明：`id`、`title`、`version`、`status`、`classification`、`owners`、`last_reviewed`、`related_adrs`、`source_of_truth_for`。

### status

- `draft`：正在编写，不得作为实现依据。
- `proposed`：内容完整，等待评审。
- `accepted`：可作为事实源。
- `deprecated`：不再用于新实现。
- `superseded`：由新文档替代。
- `archived`：只用于历史证据，不用于 active design。

### classification

- `normative`：定义必须遵守的合同。
- `informative`：说明、索引、背景或示例。
- `generated`：由工具生成，不手工编辑。
- 历史证据位于 `delivery/history/`，可使用 `classification: historical-evidence`，但必须声明 `not_source_of_truth: true`。
- 当前实现指南仍使用 `classification: informative`，并声明 `target_architecture_authority: false`、`current_implementation_as_of` 和可选 `retirement_phase`。

## 3. 设计标记

- `[已确认设计]`：已有明确决策；更改需要 ADR。
- `[建议方案]`：为了工程完整性提出的推荐；最迟在标注 Phase 前决定。
- `[尚未决定]`：不得在实现中自行假设。

标记应放在完整决策块前，不应逐句重复。

## 4. 语言与代码

自然语言以中文为主；代码类型、状态、事件和协议字段保持英文 canonical name。状态值统一为 lowercase kebab-case；事件统一为 lowercase dot notation。

## 5. 图表

Mermaid 源文件位于 `02-architecture/diagrams/`。图必须注明其对应的文字事实源。图只展示视图，不覆盖状态转换表或 API 契约。

## 6. 链接

文档间引用使用相对 Markdown 链接，不仅使用反引号路径。引用代码类型时链接其领域规范；引用接口时链接 OpenAPI path 或资源文档。

## 7. 示例

所有 JSON/YAML/SQL 示例必须标记其性质：`normative`、`illustrative` 或 `reference draft`。示例不得包含真实 Secret、Credential、私钥或生产主机信息。

## 8. 完成定义

一个权威规范只有在包含职责、输入输出、字段、状态、不变量、失败语义、安全要求、可观测性和测试证据后才能标为 `accepted`。
