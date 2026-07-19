---
id: EF-EXP-000
title: 产品体验设计入口
version: '1.1'
status: accepted
classification: informative
owners:
- product
- design
- frontend
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- experience documentation navigation
---

# EnvForge 产品体验设计

本目录定义 EnvForge 从首次 Assessment 到 Plan、Run、Verification、Archive 和 Restore 的用户体验合同。它不重新定义领域对象、API 或状态机；相应权威仍位于 `03-domain`、`08-api` 和 `13-acceptance`。

## 体验目标

EnvForge 应让用户持续回答五个问题：

1. 系统发现了什么，证据是否完整？
2. EnvForge 为什么形成当前边界、风险和建议？
3. 用户还必须做出哪些决定？
4. 接下来会改变什么，谁批准了这些改变？
5. 失败后可以重试、恢复、回滚还是必须人工处理？

## 阅读顺序

1. [产品体验原则](product-experience-principles.md)
2. [信息架构](information-architecture.md)
3. [首次 Assessment](assessment-first-run.md)
4. [Candidate Review 与可解释性](candidate-review-and-explainability.md)
5. [Plan、审批与 Run 进度](plan-review-approval-and-run-progress.md)
6. [失败、恢复与支持](failure-recovery-and-support.md)
7. [信任、风险与高风险操作](trust-risk-and-high-risk-operations.md)
8. [Capability 治理体验](capability-governance-experience.md)
9. [设计系统、可访问性与国际化](design-system-accessibility-and-i18n.md)
10. [当前 Web 实现说明](current-web-implementation.md)

## 权威边界

- 产品模式：[`01-product/product-modes.md`](../01-product/product-modes.md)
- Candidate 和 Review：[`03-domain/workload-candidate-and-review.md`](../03-domain/workload-candidate-and-review.md)
- Plan 和 Approval：[`03-domain/decision-set-and-plan-revision.md`](../03-domain/decision-set-and-plan-revision.md)
- Run 状态：[`03-domain/state-machines.md`](../03-domain/state-machines.md)
- API：[`08-api/openapi/openapi.yaml`](../08-api/openapi/openapi.yaml)
- 阶段验收：[`13-acceptance`](../13-acceptance/)

旧文档中的 `Read-only Assessment / Plan-only / Controlled Apply` 被保留为信任阶梯，不再作为独立产品模式；旧 `Migrate / Build / Maintain` 已由 Assessment、Build、Migration、Capture、Restore 取代。
