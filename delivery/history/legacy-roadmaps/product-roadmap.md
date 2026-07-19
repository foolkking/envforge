---
title: Product Roadmap
status: archived
classification: historical-evidence
not_source_of_truth: true
original_path: product/roadmap.md
archived_at: '2026-07-19'
source_sha256: ed81d568850933d83808ca53b0d1c9145348f98ae163c7f05fc321762de9699c
---

> 历史证据：保留原始内容、日期和当时结论。不得作为当前设计或当前代码事实源；使用前必须在当前 HEAD 重新验证。

# Product Roadmap

## Phase 0: Freeze Current Security Baseline

Goal:

~~~text
commit
push
tag internal baseline
docs mark P0 complete
~~~

Output:

~~~text
P0 security kernel baseline
~~~

## Phase 1: First-run Assessment

Goal:

~~~text
用户 10 分钟内获得服务器认知价值。
~~~

Tasks:

- Assessment wizard
- Read-only mode badge
- Service stack summary
- Evidence quality UI
- Risk summary
- Migration readiness
- Export Assessment Report

## Phase 2: Review Inbox

Goal:

~~~text
让用户知道自己需要做哪些关键决定。
~~~

Tasks:

- Decision Inbox UI
- Decision explanation card
- Options and recommendations
- Decision audit history
- User preference memory

## Phase 3: Golden Scenario Lab

Goal:

~~~text
证明 5 个黄金场景真的跑得通。
~~~

Tasks:

- demo lab
- VPS migration fixture
- Docker Compose fixture
- PostgreSQL fixture
- Assessment-only fixture
- Post-migration verification fixture

## Phase 4: Failure / Repair Experience

Goal:

~~~text
失败时用户知道怎么办。
~~~

Tasks:

- diagnostic error cards
- repair plan generation
- retry / skip / rollback UX
- support bundle export
- redacted logs

## Phase 5: Capability SDK

Goal:

~~~text
别人能贡献能力。
~~~

Tasks:

- capability package format
- SDK docs
- harness template
- certification levels
- example capabilities
- contribution guide

## Phase 6: Production Team Adoption

Goal:

~~~text
团队能纳入生产流程。
~~~

Tasks:

- RBAC
- team approval
- audit log
- SSO
- policy-as-code
- database-backed runtime store
- distributed apply claim
- backup/restore EnvForge
- upgrade docs

## Near-term priority

1. First-run Assessment
2. Review Inbox
3. Golden Scenario Lab
4. Failure / Repair Experience
5. Capability SDK
6. Production Team Adoption
