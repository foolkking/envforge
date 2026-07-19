---
id: EF-TEST-002
title: 领域与状态机测试
version: '1.1'
status: accepted
classification: normative
owners:
- qa
- backend
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- domain tests
- state machine tests
---


# 领域与状态机测试

为 `state-machines.md` 每行生成正向测试，并为所有未列出的 From/To 生成非法转换测试。断言：状态、version+1、Domain Event、Outbox、Audit、终态/恢复标志。

重点：

- Confirmed Revision 不可修改；
- Candidate 不进入 Plan；
- 未 Approved Plan 不能 Run；
- waiting/paused 恢复必须 requeue；
- source-quiesced 不可普通 pause/cancel；
- Required Verification 失败不能 Commit；
- Archive deleted 不可恢复 available；
- Commit once-only；
- risk acceptance 不能绕过 Hard Blocker。

使用 property-based test 生成命令序列，确保无非法终态和 version 回退。
