---
id: EF-PERSIST-008
title: Artifact 与对象存储边界
version: '1.1'
status: accepted
classification: normative
owners: [backend, platform, security]
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: [ADR-009, ADR-016]
source_of_truth_for: [ArtifactRecord, artifact storage boundary]
---

# Artifact 与对象存储边界

## 1. 定义

Artifact 是不可变的大型内容或证据；PostgreSQL 保存索引、Hash、生命周期和权限，对象存储保存字节。普通 Artifact 与长期 `ArchiveObjectRecord` 共享 Storage Adapter，但加密、保留和删除策略不同。

## 2. ArtifactRecord

```ts
interface ArtifactRecord {
  id: string;
  workspaceId: string;
  kind: "snapshot" | "config" | "plan" | "log" | "evidence" |
        "database-dump" | "transfer-manifest" | "report" | "archive-object";
  storageProviderId: string;
  objectKey: string;
  contentHash: string;
  storedHash?: string;
  bytes: number;
  contentType: string;
  encryptionEnvelopeId?: string;
  state: "pending" | "available" | "corrupt" | "deletion-pending" | "deleted";
  retentionUntil?: string;
  createdAt: string;
}
```

## 3. 写入协议

`create pending record -> stream temporary object -> compute hash -> provider head/read verification -> atomic publish/multipart complete -> mark available`。数据库不得在远端校验前标记 available。失败对象进入 cleanup queue，并保留失败事件。

根据 ADR-016，Local 开发 Provider 必须使用 temp write、SHA-256、文件 fsync、atomic rename 和发布后校验；生产敏感 Artifact 默认 envelope encryption。Local path 不构成 Archive 长期可靠副本。

对象键使用 opaque ID/ciphertext hash，不使用原路径、域名或数据库名。用户路径只放在受保护 Metadata 或加密 Manifest。

## 4. 读取协议

读取必须校验 workspace、permission、Artifact state、retention 和 expected hash。安全关键消费者（Plan、Restore、Scrub）至少验证 stored hash；解密后需要 content hash 的场景再次验证 plaintext hash。

## 5. 数据边界

适合对象存储：Snapshot 原始结果、配置备份、日志、Dump、大型 Manifest、Verification Evidence、Report、Archive Object。适合 PostgreSQL：状态、版本、Hash、object key、size、content type、encryption ref、引用计数。

禁止将 Secret 明文、Provider Token、私钥或解密后的 SOPS 文档保存为普通 Artifact。

## 6. 原子性与引用

业务对象在同一事务创建 Artifact 引用；字节先以 pending/staging 上传。Finalizer 只有在 hash 验证后发布引用。Archive 共享对象使用显式 `archive_object_references`，删除前计算所有有效引用和 Legal Hold。

## 7. Provider 接口

必须实现 `put`, `get`, `head`, `delete`, range read（如支持）、multipart、conditional write 和 abort cleanup。Provider timeout 后先 `head/reconcile`，禁止盲目重复完成 multipart。

## 8. 验收

- 上传响应丢失后能通过 head/hash 判定结果。
- 篡改一个对象字节会被读取和 Scrub 检出。
- Workspace A 无法枚举或读取 Workspace B object key。
- 删除数据库记录不会直接删除受引用对象。
