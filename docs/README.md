---
id: EF-DOCS-ROOT
title: EnvForge 设计文档入口
version: '1.1'
status: accepted
classification: informative
owners:
- architecture
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-001
- ADR-013
source_of_truth_for:
- documentation navigation
---


# EnvForge Integrated Design Baseline v1.2

本目录是 EnvForge 的工程设计事实源。总体设计提供跨团队视图，叶子规范定义可实施合同；实现、测试、数据库迁移和 API 不得仅依赖聊天记录或 DOCX。

## 阅读路径

| 读者 | 建议顺序 |
|---|---|
| 产品 | `01-product` → `15-experience` → Overall Design → `13-acceptance` |
| 架构/后端 | `02-architecture` → `03-domain` → `04-compilation` → `05-execution` → `07-persistence` → `08-api` |
| Capability 开发 | `04-compilation/capability-sdk-and-certification.md` → `04-compilation/capability-publication-and-catalog-governance.md` → `05-execution/action-runtime-and-adapters.md` → `11-testing/adapter-contract-tests.md` |
| 安全 | `02-architecture/trust-boundaries.md` → `09-security` → Secret/Archive 子系统 |
| QA | `03-domain/state-machines.md` → `11-testing` → `13-acceptance` |
| 运维 | `10-operations` → `05-execution/crash-recovery.md` → `06-subsystems/archive-scrub-and-repair.md` |
| 体验/UI | `15-experience` → `01-product/product-modes.md` → `03-domain` → `08-api` |

## 设计状态

- **v1.1**：根据全量审计修复后的叶子规范基线。修复记录见 [`00-governance/v1.1-audit-remediation.md`](00-governance/v1.1-audit-remediation.md)。
- **Integrated v1.2**：正式采纳 v1.1 Integrated 包，加入 Experience、Capability Publication/Preview/Promotion、Legacy Migration、Historical Evidence、Generated Artifact 和 Phase 10 GA Closure 治理。采纳决策见 [`ADR-013`](14-adr/ADR-013-adopt-integrated-design-baseline-v1.2.md)。叶子文件的 `version: 1.1` 是各自规范版本，不因包级采纳而机械改写。

设计输入 ZIP SHA-256：`72dedef165e175f6f188c6a17cffde79d199a1b6f4a32ff8658367b5e942b9b0`。旧文档包与迁移证据见 [`delivery/preparation/07-legacy-document-disposition.md`](../delivery/preparation/07-legacy-document-disposition.md)。
- 所有已确认不变量的变更必须通过 ADR。
- 标记为 `[建议方案]` 的工程参数需要在对应 Phase 前关闭或接受。
- 标记为 `[尚未决定]` 的问题记录于 [`00-governance/open-questions-register.md`](00-governance/open-questions-register.md)。

## 唯一实施路线

`Preparation → Phase 0 → Phase 1 → … → Phase 9 → Phase 10`。权威定义见 [`12-roadmap/implementation-roadmap-v1.md`](12-roadmap/implementation-roadmap-v1.md)。旧的 Phase 编号不再有效。

Preparation 的正式验收合同见 [`13-acceptance/preparation-design-baseline.md`](13-acceptance/preparation-design-baseline.md)。

## 权威来源

见 [`00-governance/source-of-truth-map.md`](00-governance/source-of-truth-map.md)。发生冲突时，禁止实现团队自行选择；必须登记设计缺陷或 ADR。

## 旧文档知识迁移

旧产品、UI、Capability、运维和历史 Phase 文档已按 [`00-governance/legacy-document-migration.md`](00-governance/legacy-document-migration.md) 迁移。目标体验见 [`15-experience`](15-experience/README.md)；当前旧实现指南为 `informative-current-implementation`，不属于目标架构事实源。

## 自动校验

ZIP 根目录包含 `tools/validate_design_docs.py`。运行：

```bash
python tools/validate_design_docs.py
```

该脚本检查 front matter、ID、相对链接、锚点、Mermaid 基础结构、YAML/OpenAPI `$ref`、Phase 术语和状态命名。
