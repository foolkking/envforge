---
id: EF-ACC-005
title: Phase 4：Discovery 与 Candidate Review 验收
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
- Phase 4 acceptance
---

# Phase 4：Discovery 与 Candidate Review 验收

## 目标

证明真实 Source Snapshot 可以形成可解释 Candidate，经人工边界/合同补全生成可消费 Blueprint。

## 固定环境

- Source VM：Nginx、systemd app、PostgreSQL、uploads、timer、.env SecretRef；
- 一个共享 Nginx/DB 场景；
- 一个 Collector 缺失场景。

## 执行步骤

1. 记录仓库 HEAD、设计版本、migration version、Capability manifest 和 Feature Flags。
2. 从干净环境部署/升级本 Phase 产物。
3. 执行基线和成功路径。
4. 执行并发、重放、权限和故障注入。
5. 收集 Evidence Bundle，执行清理并确认无敏感材料残留。

## 必须通过

- Snapshot finalized 后不可变，失败属于 CollectionRun；
- Evidence/relations 可追溯；
- ports 不成为 Workload；
- Candidate 不直接生成 Plan；
- confirm/merge/split/shared/reassign/exclude 均有 append-only decision；
- Critical evidence 全部归属；
- Promotion 创建 WorkloadBlueprintRevision；
- 新 Snapshot 产生 drift proposal，不覆盖旧 Blueprint。

## 故障注入

- Collector partial；
- 并发 Review；
- Promotion 事务中断；
- shared directory/DB conflict。

## Evidence Bundle

- Snapshot/Graph/Candidate hashes、Review Decision log、Blueprint content/Readiness、drift result。

## 非目标

自动执行迁移和所有第三方技术栈。

## 判定

- **PASS**：全部 required 检查和故障断言通过，无 P0/P1 安全或数据风险。
- **PARTIAL**：仅非关键 optional 项失败；不能解锁依赖此能力的生产声明。
- **FAIL**：任何 required、数据完整性、Secret、状态机或恢复断言失败。
