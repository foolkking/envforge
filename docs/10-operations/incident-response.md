---
id: EF-OPS-009
title: 安全与可靠性事件响应
version: '1.1'
status: proposed
classification: normative
owners: [operations, security, product]
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: [ADR-004, ADR-007, ADR-010]
source_of_truth_for: [incident response]
---

# 安全与可靠性事件响应

## 1. 分级

- **SEV-1**：数据丢失/错误写入、Split Brain、错误 Commit、Archive unrecoverable/key loss、Secret 泄漏、跨租户访问。
- **SEV-2**：Critical Run blocked/Lease expired、Replica below minimum、Scrub/Restore Drill 失败、Provider 大范围不可用。
- **SEV-3**：单个普通 Run、Projection、非关键 Adapter 问题。

## 2. 通用流程

Detect → appoint incident commander → preserve evidence → contain → establish source/target/data/traffic/key authority → recover → required verification → communicate → postmortem。Contain 不能销毁 before-state、Checkpoint、Provider receipts 或 rollback window。

## 3. 专项行动

### Split Brain
冻结源目标写入和调度；读取 Authority/DB LSN/traffic/target writes；选择权威数据；执行 reconciliation；验证后才恢复流量。

### Secret 泄漏
停止相关 Run，撤销/轮换，扫描 logs/events/artifacts/traces/support bundles，通知 owner，评估下游和 Archive。不得删除审计掩盖事件。

### Archive corruption/key loss
停止 Source Release/Delete；冻结 lifecycle；验证所有 Replica/Key Provider/recovery copy；repair/full scrub；无可恢复路径标 critical/unrecoverable。

### Supply chain
撤销 Capability/Artifact signature，阻止新 Plan/Run，定位绑定版本的 Plan/Run/Archive，提供替代和重新验证。

## 4. 通信

状态更新明确已知/未知、影响、数据风险、下一决策点和用户行动。不得在未经证据时宣称“无数据丢失”。

## 5. 关闭

Required Verification、数据一致性和安全控制恢复；Evidence Bundle 完整；所有临时权限/Break Glass 撤销；Postmortem 更新 Threat Model、Runbook、tests、ADR/规范和 Capability status。
