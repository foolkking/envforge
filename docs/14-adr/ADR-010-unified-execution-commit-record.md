---
id: EF-ADR-010
title: ADR-010：统一 Build/Restore ExecutionCommitRecord
version: '1.1'
status: accepted
classification: normative
owners:
- architecture
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- execution commit records
---

# ADR-010：统一 Build/Restore ExecutionCommitRecord

## 状态

Accepted — 2026-07-19

## 背景

Build 和 Restore 都需要正式成功提交，但总体设计只完整定义 CutoverCommitRecord 和 SourceReleaseCommitRecord。

## 决策

引入 `ExecutionCommitRecord(commitType=build|restore)`；Migration 使用 CutoverCommitRecord；源释放使用 SourceReleaseCommitRecord。

## 决策驱动因素

- 数据完整性和可恢复性优先于短期实现便利；
- 设计必须能被数据库约束、API、测试和运行证据验证；
- 首期控制复杂度，同时保留明确演进路径；
- 不允许 UI 或临时兼容层绕过核心不变量。

## 被否决/暂缓方案

只依赖 Run succeeded；分别建 BuildCommit/RestoreCommit；所有模式共用一个无类型 Commit。

## 后果

统一 API/Report 和 once-only 约束，同时保留 Migration/Release 的特殊语义。

## 实施与迁移

- 在对应 Phase 通过 Feature Flag/兼容适配渐进引入；
- 新模型成为唯一写入事实源，旧路径只读或转译命令；
- 数据和 API 变化需 migration、backfill、OpenAPI 与 Acceptance 同步。

## 可逆性与退出条件

本决策可通过新的 ADR supersede，但已创建的不可变 Revision、Run、Commit、Audit 和 Archive 不被原地改写。替代方案必须给出历史数据读取、活动任务接管和安全回退路径。

## 风险

主要风险是实现复杂度、迁移期间双模型漂移和团队误用。通过事实源映射、CI 设计校验、Feature Flag、纵向验收和故障注入控制。

## 验证与复审

对应规范、测试和 Phase Acceptance 必须证明此决策。若规模、安全或兼容性前提变化，通过新 ADR supersede，不原地删除历史。
