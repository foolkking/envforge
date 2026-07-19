---
id: EF-EXP-005
title: Plan 审查、审批与 Run 进度
version: '1.1'
status: accepted
classification: normative
owners:
- product
- design
- execution
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- plan review experience
- approval experience
- run progress experience
---

# Plan 审查、审批与 Run 进度

## 1. Plan 与 Run 分离

Plan 页面展示“将执行什么”；Run 页面展示“实际发生了什么”。

Plan 页面不得通过实时状态修改不可变内容；Run 页面不得偷偷切换到最新 Plan。

## 2. Plan Review 信息

至少展示：

- Plan type/revision/hash；
- Blueprint、DecisionSet、Snapshot/Archive、Capability 和 Policy 输入；
- Stages 和 Action DAG；
- config/artifact diff；
- Dataset、Secret、Cutover、Verification、Rollback contracts；
- Gates、Risks、manual steps；
- compatibility warnings；
- irreversible/point-of-no-return；
- expected downtime 和 observation window。

## 3. Approval

Approval UI 必须展示：

- 被批准的 Plan Hash；
- accepted risks；
- required reviewers；
- approval policy；
- expiry；
- step-up authentication；
- target/source identity；
- Material Drift 会使 Approval 失效的说明。

审批不能自动启动 Run，除非用户明确选择经过政策允许的“Approve and schedule”。

## 4. Run Timeline

Run Timeline 应从 Event、Attempt、Checkpoint 和 Verification 生成，不从 Plan 推断。

每个 Action 展示：

- state；
- attempt count；
- worker/lease；
- start/end/duration；
- pre/postcondition；
- evidence；
- retry/reconcile；
- side-effect classification；
- rollback availability。

## 5. Pause、Cancel 和 Blocked

界面必须区分：

- pause-requested / pausing / paused；
- cancel-requested / cancelling / cancelled；
- blocked-user-input；
- blocked-secret；
- blocked-unknown-outcome；
- blocked-material-drift；
- waiting-window。

处于 Cutover critical section 时，普通 Cancel 可能不可用，必须说明原因和安全恢复动作。

## 6. Verification 与 Commit

Required Verification 是主流程，不是“Apply 成功后可选检查”。界面不得在 required verification 未通过时显示 completed/committed。

Commit Record 创建后，应展示绑定 Hash、时间、actor/system 和证据摘要。

## 7. Rollback

Rollback 必须创建独立 Run。原 Run 页面提供：

- rollback readiness；
- before-state evidence；
- irreversible effects；
- recommended actions；
-创建 Rollback Run 的明确操作。

不得通过修改原 Run 结果伪造“已回滚”。
