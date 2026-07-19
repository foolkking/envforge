---
id: EF-DOM-012
title: 领域不变量
version: '1.1'
status: accepted
classification: normative
owners:
- architecture
- backend
- qa
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-007
- ADR-008
- ADR-010
- ADR-011
source_of_truth_for:
- domain invariants
---


# 领域不变量

## Revision 和证据

1. Finalized Snapshot、Confirmed Blueprint、DecisionSetRevision、PlanRevision、ArchiveVersion 内容不可修改。
2. 所有不可变输入同时保存 ID 与 Hash。
3. Candidate 不得直接生成 PlanAction。
4. ReportArtifact 只能依据 Event、Attempt、Checkpoint、Verification 和 Commit 生成。

## 执行

5. 未批准或 Approval 失效的 Plan 不得创建生产 Run。
6. Action 只有依赖、Gate 和资源锁满足后才能 ready。
7. 远端结果未知时必须 reconcile，禁止盲目重试高风险副作用。
8. Checkpoint 与 Event 必须在对外报告进度前持久化。
9. 旧 Worker 的 fencing token 不能写入新 Lease 周期。
10. Required Verification 失败时 Run/Commit 不得成功。

## Dataset/Cutover

11. Final Sync 只能在源 Writer 已 quiesced 且一致性点有效时执行。
12. 普通状态型 Workload 任意时刻最多一个权威写入端。
13. Traffic Switch 不等于 Cutover Commit。
14. 目标产生新写入后，回滚必须先判断或执行数据协调。
15. 目标已有 Dataset 默认阻塞，不自动覆盖。

## Secret/Archive

16. Secret 明文不得进入 Snapshot、Blueprint、Plan、Queue、Checkpoint、Event、Report 或普通日志。
17. Required Secret 不可用时必须等待或阻塞，不能写空值。
18. Archive 上传完成不等于 available；必须满足 Manifest、Key、Replica 和 Integrity Gate。
19. 没有符合 Policy 的 Restore Drill 和 SourceReleaseCommitRecord 时不得建议释放源。
20. Archive 删除必须处理引用、保留、Legal Hold、密钥与所有 Replica，并明确物理删除和 Crypto-shredding 差异。
