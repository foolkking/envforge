---
id: EF-ADR-016
title: ADR-016：Local Artifact 原子发布与生产敏感 Artifact 默认加密
version: '1.1'
status: accepted
classification: normative
owners: [platform, security, backend]
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: [ADR-009, ADR-013]
source_of_truth_for: [local artifact baseline, artifact encryption default]
---

# ADR-016：Local Artifact 原子发布与生产敏感 Artifact 默认加密

## 状态

Accepted — 2026-07-19；关闭 OQ-004。

## 当前事实

当前 Plan artifact 使用本地 content-addressed path、SHA-256、排他创建和限制权限，但没有统一 Provider、fsync 发布、生产加密默认或长期 Archive 能力。

## 方案比较

- PostgreSQL BLOB：事务简单，但不适合大型 Dump/Manifest/Archive。
- 裸本地路径：成本低，但路径会成为脆弱权威且不能满足生产恢复。
- Provider 接口：本地开发与对象存储共享完整性/生命周期合同。

## 决策

统一 Artifact Store 接口。Local 开发实现使用同目录临时写入、内容 SHA-256、文件 fsync、atomic rename、目录 fsync（平台支持时）和发布后校验。生产敏感 Artifact 默认 envelope encryption；数据库保存元数据、Hash 和 encryption reference，不保存普通大字节。Local path 不是 Archive 的长期可靠副本。

## 后果与验证

Phase 0 实现 local provider 与中断/篡改/权限/清理测试；生产 provider 继承相同接口和加密默认。Replica、Scrub、Retention、Restore Drill 仍属于 Phase 7/8，不能因 local provider 存在而声明 Archive 能力。
