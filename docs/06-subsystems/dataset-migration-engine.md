---
id: EF-SUB-001
title: Dataset Migration Engine
version: '1.1'
status: accepted
classification: normative
owners:
- backend
- dataset
- qa
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-004
- ADR-007
source_of_truth_for:
- Dataset Migration Engine
- DatasetExecutionContract
- DatasetMigrationRun
---


# Dataset Migration Engine

## 职责

把 Blueprint DatasetContract 编译结果执行为可一致、可断点、可验证的数据迁移或封存过程。TransferSession 只负责字节/Artifact 传输，不等同于 Dataset 迁移。

## 类型和策略

| Dataset | v1 策略 |
|---|---|
| filesystem | initial-final-file-sync、archive-capture/restore |
| PostgreSQL | logical-dump-restore；未来 replication/physical |
| Docker local volume | volume-export-import / initial-final file sync |
| object storage/external mount | reuse-external、provider copy 或 manual |

策略：`recreate, logical-dump-restore, physical-backup-restore, initial-final-file-sync, snapshot-transfer, replication, volume-export-import, archive-capture, archive-restore, reuse-target, manual`。

## DatasetExecutionContract

包含 source/destination、strategy、ConsistencyExecutionPlan、stages、TransferPlan、RestorePlan、VerificationPlan、RollbackPlan、capacity/time estimate、risk、blocker 和 contractHash。

## 生命周期

```text
preflight → prepare destination → initial sync
→ wait/quiesce writers → consistency checkpoint → final sync
→ restore/activate → verify → dataset commit | rollback
```

Final Sync 前必须 `writerState=quiesced|stopped` 且 Checkpoint 有效。

## Filesystem

保留 path、mode、uid/gid、mtime、symlink、hardlink；ACL/xattr/sparse 根据 Capability。默认 staging → verify → atomic promotion。Deletion Policy 必须显式：`mirror | preserve-target | review | ignore`。

## PostgreSQL

逻辑迁移包含 globals、roles、memberships、grants、extensions、ownership、schema、data、large objects、sequences。目标已有数据库默认 block。跨数据库一致性若无协调能力必须声明 limitation。

## Docker Volume

识别 driver 和 writer container。Local driver 可文件级迁移；NFS/CIFS 默认 external。数据库 Volume 只有数据库完全停止且 Capability 明确认证时才允许物理复制。

## Commit

Required Dataset 只有 consistency、transfer/restore 和 required Verification 全通过才创建 `DatasetCommitRecord`。Migration/Capture/Restore 的上层 Commit 必须引用它。
