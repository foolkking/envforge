---
id: EF-ADR-013
title: ADR-013：采纳 EnvForge Integrated Design Baseline v1.2
version: '1.1'
status: accepted
classification: normative
owners: [architecture, product]
last_reviewed: '2026-07-19'
supersedes: [ADR-001]
related_adrs: []
source_of_truth_for: [integrated design baseline adoption]
---

# ADR-013：采纳 EnvForge Integrated Design Baseline v1.2

## 状态

Accepted — 2026-07-19

## 背景

修复后的 v1.1 叶子规范与 Integrated 包新增的 Experience、Capability Publication/Preview/Promotion、Legacy Documentation Migration、Historical Evidence、Generated Artifact、当前实现指南和 Phase 10 GA Closure 共同构成新的仓库级设计输入。继续称整个包为 v1.1 会把集成治理增量与修复基线混淆。

## 方案

1. 继续将包称为 v1.1：无法唯一标识 Integrated 增量。
2. 将全部叶子文件机械改为 v1.2：产生无语义的版本噪声并破坏独立规范版本。
3. 将集成包正式登记为 `EnvForge Integrated Design Baseline v1.2`，保留各叶子文件自身版本。

## 决策

采用方案 3。Markdown 叶子规范是 active fact source；总体设计是集成视图；current guides 不是目标权威；历史证据必须重验证；生成物必须可重建。设计包 SHA-256 为 `72dedef165e175f6f188c6a17cffde79d199a1b6f4a32ff8658367b5e942b9b0`。

## 后果

- 唯一路线固定为 Preparation + Phase 0–10。
- `docs/15-experience` 与 Capability Publication Governance 是正式事实源组成部分。
- 叶子文件 `version: 1.1` 不表示包级基线仍为 v1.1。
- 核心不变量或范围变化仍需新 ADR/Design Change；本决策不批准产品实现。

## 验证

Preparation 通过 Source-of-Truth、术语/Phase、文档迁移、机器规范和 Acceptance Traceability 证明采纳完成。
