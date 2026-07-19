---
id: EF-ARCH-006
title: 控制面与执行面
version: '1.1'
status: accepted
classification: normative
owners:
- architecture
- backend
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-004
- ADR-011
source_of_truth_for:
- control plane boundary
- execution plane boundary
---


# 控制面与执行面

## 控制面职责

- 接收用户命令并进行认证、授权、幂等和 CAS；
- 管理 Project、Snapshot 索引、Workload、Revision、Approval；
- 执行 side-effect-free 编译和 Readiness；
- 创建 Plan-backed ExecutionRun；
- 展示 Projection 和 Report。

## 执行面职责

- Claim 已排队 Run；
- 在 fencing token 下执行结构化 PlanAction；
- 管理远端连接、资源锁、Retry、Reconciliation 和 Checkpoint；
- 调用 Dataset、Secret、Cutover 和 Verification Runtime；
- 追加不可变 Attempt、Event 和 Evidence。

## 禁止边界

- HTTP handler 不执行长远端动作。
- Worker 不修改 Blueprint、DecisionSet 或 Plan 内容。
- Adapter 不直接更新 Run 状态表；通过 Action Runtime API 提交受验证结果。
- Projection 不参与 Commit/Approval 等安全判断。
- Secret Material 不经过 Outbox、Queue Payload 或 Report。

## 非 Plan 长任务

Snapshot Collection、Candidate Generation 和 Plan Compilation 使用 `ControlPlaneOperation`。它们可复用 durable job 基础设施，但不伪装成 Approved Plan 的 ExecutionRun。Archive Scrub/Repair 使用子系统运行记录；Restore Drill 在需要真实恢复时创建临时 Restore Project 和 ExecutionRun。
