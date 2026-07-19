---
id: EF-OPS-007
title: 数据修复
version: '1.1'
status: proposed
classification: normative
owners: [operations, backend, security]
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: [ADR-003, ADR-007, ADR-012]
source_of_truth_for: [control-plane data repair]
---

# 数据修复

## 1. 边界

Data Repair 只修复控制面派生索引、孤立队列/Lease、Artifact index 和可证明的关系一致性；不得伪造远端副作用、Verification、Approval、Commit、Authority 或 Audit。

## 2. 许可流程

创建 Repair Request，包含症状、影响、scope、read-only query、expected invariant、rollback、owner 和审批。生产执行需要双人 review；脚本版本化并先在备份副本 dry-run。

## 3. 标准流程

1. 冻结相关资源写入并取得维护 Resource Lease。
2. 创建数据库和关联 Artifact 备份，记录 before hash/count。
3. 运行 read-only diagnosis，输出 affected IDs 和 invariant violation。
4. 从权威 Event、Artifact、Provider inspect 或不可变 binding 计算修复值。
5. 执行小批量 CAS update；每批写 Audit/Repair Event。
6. 运行约束、Projection、API 和外部状态复核。
7. 解除冻结并保存 after hash、影响行数和 Evidence Bundle。

## 4. 可修复项

- Projection 重建；
- published Event 缺失的读模型补齐；
- 已过期 WorkerLease/ResourceLease 清理；
- queue row 与终态 Run 对齐；
- Artifact pending 状态通过 provider head/hash reconcile；
- derived readiness/health 重新计算；
- Archive replica index 从 signed manifest 重建。

## 5. 不可直接修复

- unknown Action outcome；必须 Recovery Coordinator inspect。
- 缺少 PlanApproval；不得补造批准。
- Required Verification 失败；不得 SQL 改 passed。
- Cutover Authority unknown；需外部 inspect 和 incident flow。
- Commit/Audit 历史；只能追加纠正/说明事件。

## 6. 回滚

修复使用可逆 update 或恢复备份；如已触发新的外部行为，停止并升级 Incident，不继续“修数据库使其一致”。

## 7. Evidence

Repair ID、脚本 hash、审批、before/after queries、row IDs/count、DB LSN、Artifact/provider evidence、验证结果、操作者、时间和复盘。
