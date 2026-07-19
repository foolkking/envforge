---
id: EF-OPS-001
title: 部署指南
version: '1.1'
status: proposed
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
- ADR-009
source_of_truth_for:
- deployment operations
---


# 部署指南

## 拓扑

开发：Docker Compose 运行 API、Worker、PostgreSQL、MinIO/Local Artifact Store。生产：API/Worker 分进程和身份，PostgreSQL 持久卷与备份，S3-compatible Store，OIDC/TLS，外部 Vault/KMS 可选。

## 必需配置

- Database DSN 和 migration mode；
- Artifact Repository、bucket/prefix、encryption policy；
- API public URL、OIDC/session keys；
- Worker identity、capability pool、lease/heartbeat；
- Redaction、Audit retention、telemetry opt-in；
- SSH known-host policy 和 connection credential provider。

## 部署顺序

1. 创建 DB/roles；2. 执行已接受 migration；3. 验证 object store atomic put/head/delete；4. 启动 API health/readiness；5. 启动 Projection；6. 启动低风险 Worker；7. 执行 internal control operation；8. 开启高风险 capability pool。

## 回滚

应用回滚不得回退已被新版本写入且不兼容的 Schema。升级前必须读取 `upgrade-and-compatibility.md`，对活动 Run 做 drain/compatibility check。
