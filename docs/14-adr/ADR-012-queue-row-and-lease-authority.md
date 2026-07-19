---
id: EF-ADR-012
title: ADR-012：Queue 行保留与 WorkerLease 权威
version: '1.1'
status: accepted
classification: normative
owners:
- architecture
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- queue and lease authority
---

# ADR-012：Queue 行保留与 WorkerLease 权威

## 状态

Accepted — 2026-07-19

## 背景

旧文档同时描述 Claim 删除 Queue 行/更新 claimed，也在 runs 与 worker_leases 重复 Lease 字段。

## 决策

Claim 更新 Queue 行为 claimed，终态后 done/cancelled；worker_leases 是所有权唯一权威，runs 只保存单调 fencing token。

## 决策驱动因素

- 数据完整性和可恢复性优先于短期实现便利；
- 设计必须能被数据库约束、API、测试和运行证据验证；
- 首期控制复杂度，同时保留明确演进路径；
- 不允许 UI 或临时兼容层绕过核心不变量。

## 被否决/暂缓方案

Claim 删除行；Run 表和 Lease 表双权威；时间戳充当 fencing。

## 后果

恢复和审计更清楚，需 retention 清理 Queue 历史；Claim 事务稍复杂。

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
