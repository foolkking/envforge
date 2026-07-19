---
id: EF-ARCH-003
title: 容器架构
version: '1.1'
status: accepted
classification: normative
owners:
- architecture
- platform
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-002
- ADR-003
- ADR-004
- ADR-009
source_of_truth_for:
- container architecture
---


# 容器架构

## v1 部署单元

| 容器/进程 | 职责 | 权威数据 |
|---|---|---|
| Web UI | 引导、Review、Approval、Timeline | 无 |
| API / Control Plane | 领域命令、编译、权限、Read Model API | PostgreSQL 聚合状态 |
| Durable Worker | Claim、Adapter 执行、Checkpoint、Verification | 通过事务写 PostgreSQL |
| Recovery Coordinator | 扫描过期 Lease、关键 Cutover、Interrupted Rollback | PostgreSQL + 外部 inspect |
| Projection Updater | 消费 Outbox/Event 更新查询模型 | Projection，可重建 |
| Artifact Service | 原子 put/get/head、Hash、加密引用 | Object Store |
| Archive Service | Manifest、Replica、Scrub、Repair、Import | Archive Store + PostgreSQL 索引 |
| PostgreSQL | 聚合、Queue、Lease、Event、Outbox | 控制面权威源 |
| Object Storage | Artifact、Dump、Manifest、Archive 对象 | 内容权威源，数据库保存引用 |

## 通信

API 不同步等待长执行。命令事务写聚合和 Outbox；Worker 从 PostgreSQL Queue Claim；进度通过 Event/SSE。Projection Updater 从 Outbox/Event 消费，不是 API 的同步下游。

图：[`diagrams/containers.mmd`](diagrams/containers.mmd)。
