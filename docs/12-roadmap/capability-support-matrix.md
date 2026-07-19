---
id: EF-ROAD-003
title: Capability 支持矩阵
version: '1.1'
status: proposed
classification: normative
owners:
- product
- capability
- qa
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-005
source_of_truth_for:
- capability support matrix
---


# Capability 支持矩阵

以下是目标矩阵，不表示当前已实现；实际状态必须随认证证据更新。

| Capability | Detect | Build | Migrate | Capture | Restore | Verify | Rollback | 限制 |
|---|---|---|---|---|---|---|---|---|
| Ubuntu 22.04/24.04 | target certified | target certified | target certified | target certified | target certified | — | — | x86_64 |
| Debian 12 | target supported | target supported | preview | supported | supported | — | — | OQ-001 |
| systemd | certified target | certified target | certified target | capture units | restore units | runtime | partial/full by action | — |
| Nginx | certified target | certified target | route switch | config capture | restore config | syntax/HTTP/TLS | config rollback | v1 traffic provider |
| Node.js/Python app | candidate | golden build | golden migration | artifacts | restore | HTTP/business | before-state | version matrix |
| PostgreSQL 14–16 | detect | init | logical dump/restore | logical dump | logical restore | schema/data/business | partial after writes | no logical replication v1 |
| Filesystem | detect | seed/upload | initial/final rsync | chunk/archive | restore | manifest/content | staging/before-state | ACL/xattr by platform |
| Docker Compose local volume | detect | build | stop/final copy | export | import | container/data | partial | no cloud driver v1 |

状态词遵守产品支持策略；没有 Evidence Bundle 不得标 certified。
