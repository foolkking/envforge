---
id: EF-SUB-002
title: Transfer Session
version: '1.1'
status: accepted
classification: normative
owners:
- backend
- dataset
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-004
- ADR-007
- ADR-009
source_of_truth_for:
- TransferSession
- TransferManifest
- TransferPart
---


# Transfer Session

## 模型

TransferSession 绑定 DatasetMigrationRun 和 TransferPlan，持久记录 manifest、bytes/items、verified progress、active parts、checkpoint 和 lease。

状态见正式状态机。进度只按目标端 verified part/chunk 计算，不能按“已发送字节”宣称完成。

## Manifest

每条记录包括 relative path/object role、type、size、metadata、content hash、sparse/chunk refs 和 required 标志。大型 Manifest 分段压缩存对象存储，数据库保存 root hash、totals 和 segment index。

## Part/Chunk

- Chunk：content-addressed，算法 SHA-256/BLAKE3，压缩/加密 metadata。
- Part：offset/length、attempt、source/destination checksum、state、worker/fencing。

## 协议

`ssh-stream | rsync | sftp | object-storage | local-copy | database-stream | custom`。TransferPlan 还包含 compression、encryption、chunking、bandwidth、concurrency、retry、integrity、staging。

## Pause/Resume

Pause 停止新 Part，当前 Part 到安全边界，持久化 verified parts 和 checkpoint。Resume 验证 Manifest、源对象、目标 staging、已完成 Hash 和 encryption context，再回到 queued。

## 崩溃

Lease 过期后进入 recovering。Recovery 读取目标临时对象、长度/Hash 和 multipart 状态，分类 verified/partial/missing；partial 只能从协议安全 offset 继续，否则丢弃重传。
