---
id: EF-ROAD-006
title: Phase Exit Criteria
version: '1.1'
status: accepted
classification: normative
owners:
- architecture
- qa
- engineering
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- phase exit criteria
---


# Phase Exit Criteria

每个 Phase 只有在以下全部满足时通过：

1. 范围内事实源 accepted，Open Questions 已关闭/明确延期；
2. 数据库 migration 在真实 PostgreSQL 执行，约束和升级测试通过；
3. OpenAPI、实现和权限一致；
4. 单元/状态机/集成/E2E/故障注入按 Acceptance 通过；
5. Security/Redaction 审查通过；
6. 旧路径迁移/Feature Flag/删除条件明确，无长期双写；
7. 运维、告警、Runbook 和 rollback 完成；
8. Evidence Bundle、Closure Report 和 commits 可审计；
9. 不存在用 UI/文案声称未实现能力；
10. 生成 Handoff Manifest，明确 authoritative paths、deprecated paths、feature flags、known debt 和下一阶段输入；
11. 最终 Verdict 为 PASS。PARTIAL 不能解锁依赖 Phase 的生产能力。

Phase 10 额外要求全系统 E2E、upgrade/rollback drill、legacy retirement、format freeze、RC soak 和 GA Closure PASS。
