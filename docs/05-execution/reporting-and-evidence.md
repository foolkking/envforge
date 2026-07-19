---
id: EF-EXEC-010
title: 报告与证据
version: '1.1'
status: accepted
classification: normative
owners:
- backend
- qa
- security
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- ReportArtifact
- execution evidence
---


# 报告与证据

`ReportArtifact` 是不可变 Artifact，来源为 RunEvent、ActionAttempt、Checkpoint、Verification、Commit、Dataset/Secret/Cutover/Archive Evidence。

## 内容

- 输入和 Hash；审批与风险；
- 实际执行 Action/Attempt；
- Retry/Reconciliation；
- Verification 和 vantage；
- Dataset Commit、Secret Delivery 状态；
- Cutover/Authority/Traffic/Observation；
- Rollback 能力和未恢复项；
- Artifact refs、时间线、限制和审计主体。

## 禁止

不得依据 Plan 推测“已执行”；不得输出 Secret、完整敏感响应或未验证成功。Sampled/partial/manual 必须明确标记。

Report 生成后保存 content hash 和 renderer version；重新渲染产生新 ReportArtifact，不覆盖旧报告。
