---
id: EF-SUB-009
title: Archive Scrub 与 Repair
version: '1.1'
status: accepted
classification: normative
owners:
- archive
- operations
- qa
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-009
source_of_truth_for:
- ArchiveScrubRun
- ArchiveRepairRun
---


# Archive Scrub 与 Repair

## Scrub 等级

- Metadata：Header/Manifest/Signature/object count/size/key config。
- Sampled：按 Dataset、Artifact type、age、replica 和大小分层抽样，验证密文/明文 Hash。
- Full：读取所有 required object，解密并验证 Manifest relation。
- Repair：从有效 Replica 复制、验证并恢复损坏对象。

## 策略

按 criticality 配置频率、sample percent、minimum objects、plaintext/key/replica verification、auto repair 和 maximum unverified days。

## 状态影响

单个副本缺失但仍满足 minimum → degraded；存在修复源 → repair → available；required 对象所有副本损坏 → corrupt；永久 Key loss → unrecoverable。

## Durable 运行

Scrub/Repair 使用 Archive 子系统运行记录和共享 durable job runtime，支持对象级 checkpoint、bandwidth、pause/resume 和 lease。它不是 Approved Plan-backed ExecutionRun。
