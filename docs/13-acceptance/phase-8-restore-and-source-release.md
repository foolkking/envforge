---
id: EF-ACC-009
title: Phase 8：Restore 与 Source Release 验收
version: '1.1'
status: accepted
classification: normative
owners:
- qa
- architecture
- engineering
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- Phase 8 acceptance
---

# Phase 8：Restore 与 Source Release 验收

## 目标

证明 Archive 经过隔离 Restore Drill 后可安全释放源，并在源销毁后恢复到新 Target。

## 固定环境

- Phase 7 ArchiveVersion；
- isolated drill target + no/allowlisted egress；
- new target VM；
- test/sandbox Secret Provider；
- source VM destroy/recreate harness。

## 执行步骤

1. 记录仓库 HEAD、设计版本、migration version、Capability manifest 和 Feature Flags。
2. 从干净环境部署/升级本 Phase 产物。
3. 执行基线和成功路径。
4. 执行并发、重放、权限和故障注入。
5. 收集 Evidence Bundle，执行清理并确认无敏感材料残留。

## 必须通过

- Plan-only 与真实 Drill 等级区分；
- Dataset/Workload/Business Drill 通过，外部副作用被隔离；
- Drill result 绑定 manifest/plan/target hash 和有效期；
- SourceReleaseReadiness 所有 required gates；
- SourceReleaseCommitRecord once-only；
- 销毁 Source 后 import Archive、重新编译 Restore Plan、恢复/验证/ExecutionCommitRecord。

## 故障注入

- Drill cleanup fail、Secret unavailable、target incompatible、Archive object missing、control-plane DB loss、restore Worker crash。

## Evidence Bundle

- Drill execution/report、network isolation proof、Source Release gates/commit、source destruction proof、new target Restore report/commit。

## 非目标

无限未来兼容、任意硬件/软件恢复保证。

## 判定

- **PASS**：全部 required 检查和故障断言通过，无 P0/P1 安全或数据风险。
- **PARTIAL**：仅非关键 optional 项失败；不能解锁依赖此能力的生产声明。
- **FAIL**：任何 required、数据完整性、Secret、状态机或恢复断言失败。
