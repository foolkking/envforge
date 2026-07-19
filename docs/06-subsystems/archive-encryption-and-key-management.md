---
id: EF-SUB-008
title: Archive 加密与密钥管理
version: '1.1'
status: accepted
classification: normative
owners:
- archive
- security
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-009
source_of_truth_for:
- archive encryption
- ArchiveEncryptionEnvelope
---


# Archive 加密与密钥管理

## Envelope Encryption

每个 ArchiveVersion 独立 DEK；Critical Dataset 可独立 key。DEK 加密对象，KEK 通过 KMS/Vault Transit/User Recovery Key 包装。数据库/Manifest 可保存 wrapped key，不保存明文 DEK/KEK。

默认：AES-256-GCM 或 XChaCha20-Poly1305、随机 nonce、compression-before-encryption、Manifest/metadata 加密、associated data 绑定 archive/version/object role。

## Key Availability

Capture/ Scrub 执行受控 wrap/unwrap test，不仅检查配置存在。Key 状态：available、temporarily-unavailable、permanently-unavailable、unknown。永久不可用使 Archive unrecoverable。

## Rotation

优先 rewrap，不重传对象。算法/DEK 泄露需要 re-encrypt 并创建派生 ArchiveVersion；不原地修改已签名 Version。

## Recovery Key

用户恢复密钥需 challenge verification 和 fingerprint acknowledgement。EnvForge 默认不保存密钥；丢失责任必须明确展示。

## 去重边界

v1 只在 ArchiveVersion 或 Workspace 内受控去重，不做跨租户明文去重。对象键使用 ciphertext hash 或 Workspace HMAC 标识。
