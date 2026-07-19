---
id: EF-GOV-008
title: 旧文档知识迁移记录
version: '1.1'
status: accepted
classification: informative
owners:
- architecture
- product
- engineering
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-001
source_of_truth_for:
- legacy documentation migration record
---

# 旧文档知识迁移记录

## 1. 输入

2026-07-19 对旧 `docs.zip` 的 51 个文件进行了分类和迁移。原始文件 Hash、处置和目标记录在重建包的 `LEGACY_FILE_DISPOSITION.csv` 与 `SOURCE_SHA256SUMS`。

## 2. 迁移策略

```text
stable design → accepted leaf specification
current implementation → informative temporary guide
historical audit/phase report → delivery/history
regeneratable output → artifacts/generated or CI Artifact
ephemeral failed run → deletion register
```

## 3. 新增事实源

- `15-experience/*`：产品体验和 UI 目标设计；
- `04-compilation/capability-publication-and-catalog-governance.md`；
- current implementation guides；
- Phase 10 final integration/legacy retirement acceptance。

## 4. 被否决的旧定义

- `Migrate | Build | Maintain` 作为产品模式；
- `Read-only/Plan-only/Controlled Apply` 作为 Project 类型；
- `ServiceStack` 作为最终 Workload；
- `EnvironmentPlan/ApplyRun` 作为目标模型；
- `Full Migration Certified` 作为单一认证开关；
- SQLite/HTTP Apply 作为目标执行模型；
- 旧 Phase 0–7/5R/6R/7R 作为当前路线。

## 5. 历史证据

历史文件保留原文本并增加 metadata；它们只证明当时仓库和测试状态。Preparation 必须在 initial HEAD 重新运行审计和基线测试。
