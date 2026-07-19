---
id: EF-DOM-014
title: 正式状态机
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
- ADR-004
- ADR-007
- ADR-008
- ADR-010
- ADR-011
source_of_truth_for:
- all primary state machines
---


# 正式状态机

所有持久状态值使用 lowercase kebab-case。状态只能通过领域命令和 Expected Version/CAS 改变；客户端不得通用 PATCH。下表是权威来源，Mermaid 图仅为视图。

## 通用列定义

- **命令/触发**：允许产生转换的领域命令或系统事件。
- **前置条件**：必须在同一事务或外部 reconciliation 后成立。
- **事件**：成功转换后追加的 Domain Event。
- **恢复**：是否允许从该目标状态继续执行。

## EnvironmentProject

状态：`draft, discovering, reviewing, planning, ready, executing, attention-required, completed, archived`。

| From | To | 命令/触发 | 前置条件 | 事件 | 恢复 |
|---|---|---|---|---|---|
| draft | discovering | start-discovery | 有 Source Endpoint | project.discovery-started | 是 |
| draft/reviewing | planning | start-planning | 至少一个 Confirmed Blueprint | project.planning-started | 是 |
| discovering | reviewing | snapshot-finalized | Candidate Generation 已发布 | project.review-started | 是 |
| reviewing/planning | ready | evaluate-readiness | 无 Hard Blocker | project.ready | 是 |
| ready | executing | create-run | Approved Plan 有效 | project.execution-started | 是 |
| executing | completed | commit-recorded | 对应模式 Commit 有效 | project.completed | 否 |
| 任意活动 | attention-required | blocker/failure | 需要人工处理 | project.attention-required | 是 |
| 非 executing | archived | archive-project | 无活动 Run | project.archived | 否 |

禁止：`draft → completed`、`executing → archived`、无 Commit 的 `executing → completed`。

## EnvironmentSnapshot 与 SnapshotCollectionRun

Snapshot Collection 使用 `ControlPlaneOperation` 通用状态：`created → queued → running/waiting/finalizing → succeeded | failed | cancelled`。`SnapshotCollectionRun.phase` 为 `collecting | normalizing | finalizing`，不再复制生命周期状态。仅 Operation succeeded 且 result Snapshot 已持久化时创建 `EnvironmentSnapshot(status=finalized)`。Snapshot 本体没有 `failed` 状态，finalized 后不可修改。

## CandidateGeneration / CandidateReviewSession

CandidateGeneration：`generated → superseded`；内容不可变。Candidate 的 review disposition：`pending | confirmed | merged | split | dismissed | superseded`，不是执行状态机。

Review Session：

| From | To | 条件 |
|---|---|---|
| open | reviewing | 首个 ReviewDecision |
| reviewing | blocked | 存在 Critical unresolved/conflict |
| blocked | reviewing | 阻塞问题已回答或重新分配 |
| reviewing | ready | 所有 required Review Item 完成 |
| ready | promoted | Promotion 事务成功创建 Workload/Blueprint |
| open/reviewing/blocked/ready | closed | 用户终止且无 Promotion |

## WorkloadBlueprintRevision

`draft → confirmed → superseded | retired`。Draft 可以通过版本化编辑命令变更；Confirmed 内容不可修改。Readiness 不是状态。

## ControlPlaneOperation 与 PlanCompilationRun

ControlPlaneOperation 状态：`created, queued, running, waiting, finalizing, succeeded, failed, cancelled`。它是 Snapshot Collection、Candidate Generation、Plan Compilation、Archive Import 等非 Plan 长任务的生命周期权威。

PlanCompilationRun 是 1:1 specialization，只保存 phase 和 outcome：

- phase：`validating-inputs | resolving-graph | compiling-contracts | finalizing`；
- outcome：`compiled | review-required | blocked`。

Operation succeeded 之前必须原子或可恢复地保存 outcome 和 result PlanRevision（若有）。`blocked` 是成功完成编译评估后的业务 outcome，不是通用 Operation 的失败/blocked 状态。

## PlanRevision

| From | To | 命令/条件 |
|---|---|---|
| compiled | approval-pending | submit-for-approval；无 Compiler Blocker |
| review-required | approval-pending | 所有 required manual review 已完成 |
| approval-pending | approved | PlanApproval approved 且 Hash 匹配 |
| approval-pending | rejected | reject |
| approved | revoked | revoke；无不可中断活动 Run 或按 Policy 处理 |
| approved | expired | Approval/Plan TTL 到期 |
| compiled/review-required/approval-pending/approved | superseded | 新 PlanRevision 成为当前版本 |
| 终止非活动状态 | archived | retention policy |

Plan 内容在所有状态均不可修改。`rejected` 不能返回审批；必须重新编译或新 Revision。

## PlanApproval

`pending → approved | rejected | revoked | expired`。Approved 后只能 revoked/expired；Hash 不匹配时逻辑失效并追加事件。

## ExecutionRun

状态：`created, queued, claimed, running, waiting, pause-requested, pausing, paused, blocked, recovering, cancel-requested, cancelling, rollback-required, rolling-back, succeeded, failed, cancelled, rolled-back, partially-rolled-back`。

| From | To | 触发 | 前置条件/说明 |
|---|---|---|---|
| created | queued | enqueue | Plan/Approval/input binding 已冻结 |
| created | cancelled | cancel | 尚无副作用 |
| queued | claimed | worker-claim | Queue row 可用；创建 Lease；fencing+1 |
| claimed | running | start-attempt | Lease 有效 |
| claimed/running | recovering | lease-expired/worker-crash | 真实结果需 inspect |
| running | waiting | gate/backoff/window/secret | 当前 Action 已到安全边界 |
| waiting | queued | condition-satisfied | 重新入队，不直接跳 running |
| running/waiting | pause-requested | pause | 非禁止 Critical Section |
| pause-requested | pausing | scheduler-stop | 不再发新 Action |
| pausing | paused | checkpoint-persisted | 活动 Action 到安全边界 |
| paused | queued | resume | Checkpoint/Drift/Secret/Lock 重新验证 |
| running/waiting | cancel-requested | cancel | Cutover Critical Section 转 rollback-required |
| cancel-requested | cancelling | safe-boundary | 停止调度并清理 |
| cancelling | cancelled | cleanup-complete | 无 required rollback 或已清理 |
| running/recovering | blocked | manual-required | 无安全自动路径 |
| running/recovering | rollback-required | failure-policy | 有回滚合同且需要恢复 |
| rollback-required | rolling-back | rollback-run-created | 独立 rollback ExecutionRun 已创建 |
| rolling-back | rolled-back | rollback-outcome=full | 原 Run 派生状态 |
| rolling-back | partially-rolled-back | partial/manual outcome | 明确未恢复项 |
| running | succeeded | required verification + commit | 终态 |
| running/recovering | failed | 无可恢复/回滚路径 | 终态 |
| recovering | queued | reconcile=resumable | 新 fencing lease 后重排队 |

终态：`succeeded, failed, cancelled, rolled-back, partially-rolled-back`。`blocked` 可由人工命令重新进入 `queued`，但必须保存 resolution evidence。

## ActionRun / ActionAttempt

ActionRun：`pending → ready → claimed → running → waiting | succeeded | failed | blocked | pause-pending | paused | cancelled | skipped | rollback-pending → rolling-back → rolled-back | rollback-failed`。

- `pending → ready` 由依赖/Gate 评估器产生。
- `running → succeeded` 要求执行回执、postcondition 和 required action verification 全通过。
- `running → failed` 仅表示本次 Action 终结；Run Policy 决定 retry/block/rollback。
- `skipped` 只允许明确条件分支且不属于 required Action。

ActionAttempt：`created → running → succeeded | failed | outcome-unknown | cancelled`。`outcome-unknown` 必须 reconcile，不能覆盖成 failed。

## DatasetMigrationRun

状态：`pending, preflighting, preparing, initial-syncing, waiting-quiesce, quiescing, final-syncing, restoring, activating, verifying, waiting, paused, blocked, succeeded, failed, rollback-required, rolling-back, rolled-back, partially-rolled-back`。

Writer 状态独立为：`unknown | active | draining | quiesced | stopped | resumed`。`source-quiesced` 不是 DatasetRun 顶层状态。

强制转换：`initial-syncing → waiting-quiesce → quiescing → final-syncing`；Final Sync 前必须有 valid ConsistencyCheckpoint，Writer=quiesced/stopped。

## TransferSession

`created → enumerating → ready → queued → running → verifying → finalizing → succeeded`，以及 `running → pause-requested → paused → queued`、`running/queued → waiting | recovering | failed | cancelled | blocked`。恢复只信任目标端 verified Part/Chunk。

## SecretDeliveryRun

`pending → waiting | resolving → available → materializing → injecting → validating → rotating? → cleaning → succeeded`；任意阶段可进入 `failed | blocked | expired | revoked`。Secret value 不持久化。Waiting 的原因必须是 provider/user input，不得以空值继续。

## CutoverRun

状态：`pending, preparing, ready, waiting-window, draining, quiescing, source-quiesced, final-syncing, target-activating, granting-target-authority, traffic-switching, traffic-switched, business-verifying, observing, commit-pending, committing, committed, rollback-required, rolling-back, rolled-back, partially-rolled-back, blocked, failed`。

关键不变量：

- `source-quiesced` 起进入 Critical Section；普通 pause/cancel 被禁止或转 rollback。
- Final Sync 前 Source Authority=`none`，Target Authority!=`target`。
- `traffic-switched` 不得直接跳 `committed`；必须 business verification、observation 和 commit gate。
- Target writes detected 后 rollback 必须 reconciliation。

## ArchiveVersion

`created → capturing → finalizing → replicating → verifying → available`。Available 可因健康变化进入 `degraded | corrupt | unrecoverable`；修复成功 `degraded → available`。Retention：`available/degraded → retention-expired → deletion-pending → deleted`。`corrupt/unrecoverable/deleted` 不允许回到 available；修复应创建证据或派生 Version。

## RestoreDrillRun

运行状态：`created, compiling-plan, preparing-target, restoring, verifying, cleaning, succeeded, warning, failed, cleanup-failed`。Outcome 单独为 `passed | passed-with-warnings | failed | incomplete`。`warning` 状态表示执行完成但存在非阻断警告；不应与 outcome 混用。

## 不允许的通用跳转

- 任意对象跳过审批、Gate、Checkpoint 或 required Verification。
- 终态回到活动状态；重试必须创建新 Attempt/Run/Revision。
- API 客户端直接写 `state`。
- 仅凭 HTTP 超时将 Provider Action 标为 failed 或 succeeded。
