---
id: EF-ARCH-005
title: 部署拓扑
version: '1.1'
status: accepted
classification: normative
owners:
- platform
- operations
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-002
- ADR-003
- ADR-006
source_of_truth_for:
- deployment topology
---


# 部署拓扑

## 开发拓扑

单机 Docker Compose：API、Worker、PostgreSQL、MinIO/Local Artifact Store。Disposable VM 独立运行，避免测试 Worker 误操作宿主机。

## 小型生产拓扑

- 1–2 API 实例（无本地权威状态）；
- 1–N Worker，按 Capability/风险标签分池；
- PostgreSQL 单主 + 备份；
- S3-compatible Object Store；
- 外部 Vault/KMS 可选；
- TLS 终止和 OIDC。

## 高可用演进

Phase 9 支持 PostgreSQL HA、Worker 水平扩展、Queue fairness、跨故障域 Archive Replica。任何拓扑下 PostgreSQL 仍是 Run/Lease 权威状态源，对象存储是 Artifact 内容源。

## 网络

Worker 需要到 Endpoint、Provider 和对象存储的最小出站权限。API 不应持有远程执行网络权限（建议方案：通过独立 Worker 网络区隔）。
