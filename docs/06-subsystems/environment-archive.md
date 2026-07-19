---
id: EF-SUB-007
title: Environment Archive
version: '1.1'
status: accepted
classification: normative
owners:
- archive
- architecture
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-009
source_of_truth_for:
- EnvironmentArchive
- ArchiveVersion
- Archive Manifest
---


# Environment Archive

## 定义

EnvironmentArchive 是长期稳定身份；ArchiveVersion 是一次不可变 Capture。Snapshot 不是 Archive。

## 内容

Blueprint Bundle、Deployment Bundle、Config Bundle、Dataset Bundle、Secret Recovery Metadata、Compatibility/Verification、Provenance、Consistency Evidence。

## 两层 Manifest

- Public/minimal `ArchiveHeader`：format version、encrypted manifest key/hash、encryption envelope、signature ref，不暴露路径和业务名称。
- Encrypted Private Manifest：Workload、Artifact、Dataset、Secret Recovery、Compatibility、Verification、Object Index、Replica、Encryption、Integrity、Limitations。

Manifest Root 使用 Merkle-style root；对象记录 ciphertext hash，plaintext hash 仅在加密 Manifest/受保护索引。

## 自描述和导入

即使控制面数据库丢失，Header + Manifest + Key Provider + Reader 能重建 Catalog 并创建 Restore Project。Archive 不依赖原 Run 内存或当前 Capability Catalog 的隐式信息。

## 健康

Integrity、Recoverability、Replica、Key、Scrub、Drill、Retention 多维计算。`available` 仅在 Policy 满足时成立。
