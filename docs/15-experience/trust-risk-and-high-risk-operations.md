---
id: EF-EXP-007
title: 信任、风险与高风险操作
version: '1.1'
status: accepted
classification: normative
owners:
- product
- design
- security
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- trust ladder experience
- high risk operation experience
---

# 信任、风险与高风险操作

## 1. 信任阶梯

以下是体验层级，不是 Project 类型：

```text
Level 1: Read-only Assessment
Level 2: Reviewable Planning
Level 3: Approved Durable Execution
Level 4: High-risk Critical Section
Level 5: Committed and Recoverable Evidence
```

## 2. Level 1

必须明确：不会修改源或目标。连接、Host Key、sudo 和 Collector Policy 应在执行前展示。被政策禁止读取的内容不能以 unknown-risk=low 处理。

## 3. Level 2

用户可以查看 Plan、Diff、Risk、Gate、Secret Requirement、Dataset Strategy、Verification 和 Rollback。此阶段不产生目标副作用。

## 4. Level 3

只执行有效 Approval 绑定的不可变 Plan。创建 Run 与批准是两个独立操作。界面展示 Idempotency、Target、Maintenance Window 和 expected effects。

## 5. Level 4

Quiesce、Write Authority、Traffic Switch、Archive Source Release 等操作必须使用高风险确认：

- step-up authentication；
- 明确资源和时间窗口；
- required approvers；
- Point of No Return；
- rollback/readiness；
- observation；
- audit reason。

普通确认对话框不足以替代 Approval Policy。

## 6. Secret 输入

Secret 输入界面必须说明 Provider、用途、作用域、TTL、是否一次性、是否可重新生成和何时撤销。用户输入值不能在提交后回显，也不能出现在浏览器日志、URL 或 Report。

## 7. Source Release

只有 Archive health、Replica、Key 和 Restore Drill 达到 Policy，并创建 `SourceReleaseCommitRecord` 后，才可以展示“允许释放源环境”。默认按钮应是生成 Release Checklist，而不是直接删除主机。

## 8. 风险接受

Risk Acceptance 不能消除 Hard Blocker。接受记录必须绑定 Plan/Decision Hash、actor、reason、expiry 和 affected risks。
