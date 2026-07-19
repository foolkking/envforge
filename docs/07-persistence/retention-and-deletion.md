---
id: EF-PERSIST-009
title: 数据保留与删除
version: '1.1'
status: accepted
classification: normative
owners: [platform, security, operations]
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: [ADR-008, ADR-009]
source_of_truth_for: [retention policy, deletion semantics]
---

# 数据保留与删除

## 1. 分类

| 记录 | 默认策略 |
|---|---|
| Snapshot/Blueprint/Decision/Plan Revision | 不可变；项目归档后按 Workspace Policy 保留 |
| Approval/Run/Attempt/Checkpoint/Commit/Audit | 不允许普通硬删除；安全与审计长期保留 |
| 临时 Secret Input/Handle metadata | 短期；值永不持久化 |
| Staging Artifact/partial upload | 成功后清理；失败按 Debug/Sensitive Policy |
| Environment Archive | 独立 Retention、Legal Hold、Reference 和 Deletion 状态机 |
| Projection | 可删除并重建 |

## 2. Project 删除

v1 只支持 `archive project`，不级联硬删除历史 Run/Plan/Report。隐私删除请求通过 Redaction/Deletion Operation 处理可删除字段，并保留最小不可抵赖审计。

## 3. Archive 删除

流程：`deletion-requested -> approval-pending -> deleting -> deleted/partially-deleted/blocked`。前置条件：无 Legal Hold、无活动 Restore/Scrub、无子版本/共享对象引用、Object Lock 允许、权限与双人审批满足。

删除包括所有 Replica、Manifest、Header、Signature、Encryption Envelope、Escrow ref、multipart 残留和临时 Drill Target。每个 Provider 返回删除证据；无法删除时状态不得显示完全删除。

## 4. Crypto-shredding

销毁独立 DEK/Envelope 可使密文不可访问，但必须与物理删除分别报告。只有所有 Key 副本和 Wrap path 均失效时才可声称 cryptographically inaccessible。

## 5. Referential Integrity

任何对象有有效引用、Legal Hold 或未过 retentionUntil 时不可物理删除。共享 Chunk 通过引用表/mark-and-sweep；禁止仅用计数缓存做最终判断。

## 6. 验收

- 删除旧 ArchiveVersion 不破坏新版本继承对象。
- Object Lock 阻止删除时 UI/Report 显示 blocked/partial。
- Project archive 不删除 Run 和 Approval。
- 清理敏感 Dump 后产生 Audit 和 Provider evidence。
