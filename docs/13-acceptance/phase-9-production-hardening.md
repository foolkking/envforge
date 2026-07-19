---
id: EF-ACC-010
title: Phase 9：生产强化验收
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
- Phase 9 acceptance
---

# Phase 9：生产强化验收

## 目标

验证多用户安全、HA/恢复、Worker 扩展、Capability Certification 和长期格式兼容。

## 固定环境

- 多 workspace/OIDC/MFA；
- PostgreSQL backup/restore 或 HA 测试；
- 多 Worker pools；
- signed Capability/SBOM；
- Archive format upgrade fixture。

## 执行步骤

1. 记录仓库 HEAD、设计版本、migration version、Capability manifest 和 Feature Flags。
2. 从干净环境部署/升级本 Phase 产物。
3. 执行基线和成功路径。
4. 执行并发、重放、权限和故障注入。
5. 收集 Evidence Bundle，执行清理并确认无敏感材料残留。

## 必须通过

- RBAC/ABAC/IDOR/RLS gate；
- 高风险双人审批；
- PostgreSQL recovery 后活动 Run reconcile；
- queue fairness/scale；
- signed Adapter enforcement；
- projection rebuild；
- archive derived version upgrade；
- SLO/alerts/runbooks 演练。

## 故障注入

- DB failover、worker pool loss、provider outage、supply-chain revocation、format reader incompatibility。

## Evidence Bundle

- security audit、load/chaos results、certification bundles、DR exercise、SLO dashboard、incident runbooks。

## 非目标

未在 Capability Matrix 声明的任意平台。

## 判定

- **PASS**：全部 required 检查和故障断言通过，无 P0/P1 安全或数据风险。
- **PARTIAL**：仅非关键 optional 项失败；不能解锁依赖此能力的生产声明。
- **FAIL**：任何 required、数据完整性、Secret、状态机或恢复断言失败。


## Phase 10 Handoff

Phase 9 PASS 仅表示生产强化能力完成，不等于 GA。必须生成 Handoff Manifest，列出仍存在的 legacy paths、feature flags、兼容层、Schema/API/Archive format 和 RC 限制；最终发布由 [`phase-10-final-integration-and-ga-closure.md`](phase-10-final-integration-and-ga-closure.md) 验收。
