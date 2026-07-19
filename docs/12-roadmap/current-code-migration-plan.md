---
id: EF-ROAD-005
title: 当前代码迁移计划
version: '1.1'
status: proposed
classification: normative
owners:
- architecture
- backend
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-003
- ADR-004
- ADR-008
source_of_truth_for:
- current code migration plan
---


# 当前代码迁移计划

## 原则

不推倒重写，不长期双写。新模型通过 Feature Flag 逐步成为唯一写源；旧 API 短期适配为新 Command。

## 顺序

1. PostgreSQL/Artifact/Outbox 基座；
2. Backfill Project/Endpoint/legacy Plan，保留 source ID/hash；
3. 新 Blueprint/Planning；
4. Durable Run 旁路，先一个幂等 Action；
5. 旧 Apply 改为创建新 Run 并返回 202；
6. Golden Build 验收后冻结旧 Apply；
7. Candidate/Discovery 接入 Blueprint；
8. Dataset/Cutover/Archive 分阶段新增；
9. 对账、只读保留、最终归档旧表。

## 删除 Gate

旧路径只有在数据对账、API consumers、active runs、reports、rollback/read compatibility 和 backup 均验证后删除。
