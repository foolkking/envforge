---
id: EF-EXP-004
title: Candidate Review 与可解释性
version: '1.1'
status: accepted
classification: normative
owners:
- product
- design
- discovery
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- candidate review experience
- decision explainability
---

# Candidate Review 与可解释性

## 1. Review 目标

Candidate Review 将机器推断转换成人工确认的业务边界。它不是“接受 AI 建议”按钮，而是一套证据所有权、共享资源和合同完整性处理流程。

## 2. Review 工作队列

每个 Review Item 至少包含：

- Candidate/Component；
- Decision 类型；
- Evidence；
- confidence；
- risk；
- reason；
- alternatives；
- required input；
- unresolved impact；
- recommended safe default；
- history。

优先级建议：Critical blocker → high-risk shared resource → missing contract → low-confidence suggestion。

## 3. 支持的决策

```text
confirm
merge
split
reassign-evidence
mark-shared
mark-reference
mark-external
exclude
dismiss
answer-question
complete-contract
promote
```

每次决策必须记录 actor、reason、evidenceRefs、before/after 和时间。

## 4. Explainability 卡片

关键判断必须展示：

| 字段 | 含义 |
|---|---|
| Decision | EnvForge 建议或阻塞什么 |
| Evidence | 直接和间接事实 |
| Confidence | 推断可信度，不等同安全性 |
| Risk | 错误或执行的影响 |
| Reason | 规则、关系和缺口 |
| Alternative | 可选择策略 |
| Required Input | 用户必须提供的业务信息 |
| Downstream Impact | 对 Blueprint、Plan、Migration/Capture 的影响 |

前端只能展示后端产生的 Evidence/Reason，不重新计算领域风险。

## 5. PostgreSQL 示例

当发现：active service、5432 socket、data directory、config 和应用连接引用时，可以形成 PostgreSQL Component Candidate。

推荐解释：

- confidence high：多条强关系一致；
- risk high：stateful writer、版本和数据量未知；
- blocker：data ownership/strategy/freshness 未确认；
- recommendation：逻辑 dump/restore；
- alternatives：physical backup、external reference、manual follow-up；
-禁止项：运行中 data directory blind copy。

## 6. Shared Resource

数据库、Nginx、Redis、目录、用户、证书和 cron 可能被多个 Candidate 共享。界面必须让用户选择：

- 归属一个 Workload；
- 标记 shared；
- 仅引用 external；
- 拆分资源；
- 保持 unresolved。

不得自动将弱关系合并为同一 Workload。

## 7. Promotion Gate

只有 Critical Evidence 已分配、Critical Question 已回答、required contract 完整时才允许 Promotion。Promotion 创建 Workload 和 Blueprint Draft/Revision，不修改原 CandidateGeneration。

## 8. 历史与漂移

Review 历史必须可查看。新 Snapshot 产生新 CandidateGeneration 或 Drift Proposal，不覆盖旧 Review 证据。
