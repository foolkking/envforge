---
id: EF-PROD-003
title: 产品模式
version: '1.1'
status: accepted
classification: normative
owners:
- product
- architecture
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-005
- ADR-008
source_of_truth_for:
- assessment
- build
- migration
- capture
- restore
- preserve and restore
---


# 产品模式

## 统一 Project 类型

`assessment | build | migration | capture | restore`。`Preserve & Restore` 是 Capture 与 Restore 组成的用户旅程，不是第六个 Compiler 类型。

## 模式矩阵

| 模式 | 适用场景 | 必需输入 | 核心输出 | 成功证据 | 明确不包含 |
|---|---|---|---|---|---|
| Assessment | 理解现有主机业务、依赖和风险 | Source Endpoint、Collector Policy | Snapshot、Evidence Graph、Candidate、Workload、Blueprint、Assessment Report | Snapshot Hash、Review Decisions、Confirmed Blueprint | 目标修改、数据迁移、Cutover |
| Build | 从 Blueprint 在空/受控目标创建环境 | Confirmed Blueprint、Target Snapshot、DecisionSet、Secret Binding、可选 seed/upload | Target Placement、ExecutionCommitRecord、ReportArtifact | required Verification 全通过、Commit Record | Source Drain、Initial/Final Sync、Source Resume |
| Migration | 源在线且目标同时存在 | Blueprint、Source/Target Snapshot、DecisionSet、Dataset/Secret/Cutover Policy | Dataset Commits、CutoverCommitRecord、Source Retention、Report | 单写权威、业务验证、Observation、Commit | Active-active、无约束双写 |
| Capture | 保存环境供未来恢复 | Blueprint、Source Snapshot、Archive Repository、Encryption/Replica/Drill Policy | ArchiveVersion、Manifest、Replica、Scrub/Drill 证据、Release Readiness | Archive Health 达标 | Target Host、Traffic Switch |
| Restore | 从 Archive 恢复到当前目标 | ArchiveVersion、Target Snapshot、Secret Binding、Compatibility Decision | Restore Plan/Run、Target Placement、ExecutionCommitRecord | Archive 验证、业务验证、Restore Commit | 复用 Capture Actions |

## Assessment 生命周期

```text
connect → collect → finalize snapshot → build graph → generate candidates
→ review boundary → complete contracts → promote blueprint → report
```

失败 Collector 表示 `unknown`，不表示资源不存在。Candidate 不得直接进入 Planner。

## Build 生命周期

```text
target-preflight → prepare → deploy/configure → initialize data
→ bind secrets → activate → verify → commit → cleanup
```

Dataset 来源仅允许 `empty | seed | uploaded | target-existing`。运行中源主机数据使用 Migration，Archive 使用 Restore。

## Migration 生命周期

```text
source/target preflight → target prepare → initial sync → target preverify
→ wait window → drain → quiesce → final sync → target activate
→ grant target authority → traffic switch → business verify → observe
→ cutover commit → source retention
```

无 `CutoverCommitRecord` 不得标记迁移完成。Traffic Switch 只是中间状态。

## Capture 生命周期

```text
source/storage preflight → capture deployment/config → initial data capture
→ quiesce → final data capture → manifest → encrypt → replicate
→ verify/scrub → optional drill → release readiness
```

上传完成不等于 Archive Available；必须满足 Manifest、Key、Replica 和 Integrity Policy。

## Restore 生命周期

```text
verify archive → inspect target → compatibility → compile new restore plan
→ reconstruct artifacts → restore data/config → bind secrets → activate
→ verify → execution commit
```

Restore 必须针对当前目标重新编译；Archive 只提供恢复合同和资产，不提供可直接重放的旧 Actions。

## Preserve & Restore 完整闭环

```text
Assessment/Blueprint → Capture → ArchiveVersion → Replica/Scrub
→ Restore Drill → SourceReleaseCommitRecord → release source
→ future Restore Project → new target compatibility → Restore Run
→ Business Verification → ExecutionCommitRecord
```

## 模式切换规则

Project 类型不原地变更。Assessment 通过 `project_links` 派生 Build/Migration/Capture；ArchiveVersion 派生 Restore。所有派生关系保留来源 ID 和 Hash。


## 信任层级不是产品模式

旧文档中的 `Read-only Assessment → Plan-only → Controlled Apply` 保留为体验信任阶梯：只读发现、可审查规划、已批准持久执行。它们不替代 `assessment | build | migration | capture | restore` Project 类型。详细体验见 [`15-experience/trust-risk-and-high-risk-operations.md`](../15-experience/trust-risk-and-high-risk-operations.md)。
