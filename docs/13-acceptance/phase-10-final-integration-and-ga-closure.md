---
id: EF-ACC-011
title: Phase 10：系统集成、Legacy Retirement 与 GA 收尾验收
version: '1.1'
status: accepted
classification: normative
owners:
- architecture
- product
- qa
- security
- operations
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- Phase 10 acceptance
- GA closure
---

# Phase 10：系统集成、Legacy Retirement 与 GA 收尾验收

## 1. 目标

证明 Phase 0–9 的能力组合成可升级、可运营、可恢复和可正式发布的 EnvForge v1，并删除不再需要的旧权威路径。Phase 10 禁止新增主要产品能力。

## 2. Entry Gate

- Phase 0–9 全部 PASS；
- Golden Build、Golden Migration、Golden Preserve & Restore PASS；
- 无 P0/P1 Security/Data Integrity 缺陷；
- Capability Support Matrix 达到发布范围；
- upgrade、backup、control-plane restore 方案存在。

## 3. Required Scope

### 全系统一致性

复核 Domain、State、API、DDL、Event、Error、ADR、Capability 和 Acceptance；发布最终设计变更记录。

### Legacy Retirement

至少处理：

- SQLite authoritative state；
- synchronous HTTP Apply；
- in-memory active Run/Mutex claim；
- legacy ApplyRun/EnvironmentPlan write paths；
- derived Report without immutable evidence；
- stale feature flags；
- deprecated API/routes；
- current-implementation docs 和 compatibility CSS/routes。

每项必须有 usage telemetry、data migration、rollback 和 release note。

### Format Freeze

版本化 API v1、Blueprint/Plan/Event/Archive/Capability contracts 和数据库 baseline。后续变化遵守 compatibility policy。

### Upgrade/Rollback Drill

从旧稳定版本升级 Schema/API/Worker，处理活动 Run，并证明 rollback 或 forward-fix。Archive reader 必须兼容受支持旧格式。

### Full E2E

运行 Assessment、Build、Migration、Capture、Restore、Rollback、Scrub/Repair、Control-plane Restore、Worker Crash 和 Provider Failure。

### Release Candidate Soak

覆盖长时间、多并发、大 Artifact/Manifest、PostgreSQL 重启、Worker 重启和 Object Store timeout。

### Security and Operations

完成 Threat Model closure、SBOM、signing、dependency/secret scan、privilege review、incident/runbook/support bundle 和 release rollback。

## 4. Evidence

- release candidate commits/images；
- schema/API/format versions；
- legacy removal inventory；
- upgrade/rollback logs；
- full E2E Evidence Bundles；
- soak/performance results；
- security assessment；
- release notes、known limitations 和 migration guide。

## 5. PASS

仅当：前置阶段全 PASS、三条 Golden 场景 PASS、无长期双写、旧权威路径删除或永久关闭、升级/恢复通过、安全 P0/P1 为零、文档与代码一致，才输出：

```text
PASS — EnvForge v1 General Availability Approved
```

PARTIAL/FAIL 不允许 GA。
