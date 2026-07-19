---
id: EF-PERSIST-004
title: 标识、Revision 与 Hash
version: '1.1'
status: accepted
classification: normative
owners:
- backend
- architecture
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-008
- ADR-009
source_of_truth_for:
- identifiers
- revisions
- hashing
---


# 标识、Revision 与 Hash

## ID

应用生成 UUIDv7。业务稳定身份和 Revision ID 分离；对象存储 key 不使用用户路径。

## Revision

`UNIQUE(root_id, revision)`，从 1 单调增加。Confirmed/compiled/finalized 内容不更新；新内容创建新 Revision。状态 envelope 和 retention metadata 可按命令更新，但不进入 content hash 或需单独 hash。

## Canonical JSON

UTF-8、排序 object keys、禁止 NaN/Infinity、明确 number/string normalization、数组顺序只有在领域有序时保留。Hash 使用 SHA-256，输入包含 schemaVersion。

## Hash Binding

Plan/Run/Archive 保存：ID、contentHash、schemaVersion、compiler/adapter version。Secret value 不参与持久 Hash；使用 Workspace HMAC fingerprint。Archive plaintext hash 仅存加密 Manifest/受保护索引。
