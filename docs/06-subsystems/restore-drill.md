---
id: EF-SUB-010
title: Restore Drill
version: '1.1'
status: accepted
classification: normative
owners:
- archive
- qa
- security
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-009
- ADR-011
source_of_truth_for:
- RestoreDrillRun
- RestoreDrillPolicy
---


# Restore Drill

## 等级

`plan-only | artifact-reconstruction | dataset-reconstruction | isolated-workload-restore | business-verification`。

Plan-only 不能宣称真实恢复通过。Dataset 及以上等级创建临时 Restore Project；需要真实动作时引用一个真实 Restore ExecutionRun。

## 隔离

默认 no/allowlisted egress、禁止生产 DNS、禁用 scheduler/mail、外部依赖使用 sandbox/mock、测试域名和临时 Credential。必须防止支付、Webhook、Queue、SMTP 等副作用。

## 结果

运行状态与 Outcome 分离。Outcome：passed、passed-with-warnings、failed、incomplete。结果绑定 ArchiveVersion、Manifest Root、Blueprint Hash、Restore Plan Hash、Target Profile 和 Verification Contract Hash，并有有效期。

## Source Release

Critical Archive 只有 required Drill Level、Integrity/Replica/Key/Secret Recovery/Retention 全满足，才可生成 SourceReleaseReadiness；用户确认后创建 once-only SourceReleaseCommitRecord。
