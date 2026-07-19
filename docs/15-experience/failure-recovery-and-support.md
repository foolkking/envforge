---
id: EF-EXP-006
title: 失败、恢复与支持体验
version: '1.1'
status: accepted
classification: normative
owners:
- product
- design
- operations
- support
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- failure experience
- support bundle experience
- repair experience
---

# 失败、恢复与支持体验

## 1. 失败对象

失败应绑定具体对象：ControlPlaneOperation、ExecutionRun、StageRun、ActionRun、ActionAttempt、TransferSession、SecretDeliveryRun、CutoverRun、Scrub 或 RestoreDrillRun。

不得只显示 `exit code 1`。

## 2. 标准失败卡片

至少包含：

- What failed；
- Where；
- Attempted operation；
- Impact；
- Failure class；
- Evidence；
- Likely causes；
- Recommended next actions；
- Retry safety；
- Reconciliation requirement；
- Skip policy；
- Rollback boundary；
- Manual action；
- Support Bundle link。

## 3. Failure Class

建议 UI 使用与执行引擎一致的分类：

```text
precondition-failed
transient-provider
permanent-input
verification-failed
unknown-outcome
material-drift
resource-conflict
permission-denied
integrity-failed
manual-intervention-required
```

## 4. Repair

Repair 只能生成可审查的 Plan/Decision Proposal，不得自动执行。Repair 建议必须说明：

- 依据的失败证据；
- 会修改的资源；
- 风险和 Gate；
- 是否改变原合同；
- 是否需要新 Blueprint/Decision/Plan Revision。

## 5. Retry 和 Reconcile

重试按钮必须依据 Action Policy 启用。Unknown Outcome 先 Reconcile，不能盲目重复。用户应看到“为什么不能立即重试”。

## 6. Support Bundle

Support Bundle 是只读、脱敏、可验证的诊断 Artifact，至少包含：

- product/build version；
- object IDs 和非敏感 Hash；
- Event/Attempt/Checkpoint 摘要；
- sanitized command output；
- target/source metadata；
- provider error；
- test/verification evidence；
- known limitations。

不得包含：Secret 值、private key、完整数据库 URL、Cookie、Session、生产用户数据。

## 7. Nginx 示例

当 `nginx -t` 失败时，应展示：验证步骤、目标配置 Artifact Hash、stderr 摘要、可能的语法/路径/证书问题、是否尚未 reload、是否可安全修改 Decision/Plan，以及当前服务是否仍保持 before-state。

## 8. PostgreSQL 示例

当 backup freshness 或 target restore verification 未知时，Run 必须 blocked/review-required；不得显示 migration successful。建议操作可以是重新 dump、确认版本、扩大维护窗口或人工验证，但每项必须形成新的证据。

## 9. 支持操作的安全性

导出、查看诊断和生成 Repair Draft 不得创建 Approval、ExecutionRun、Target mutation 或隐式 retry。
