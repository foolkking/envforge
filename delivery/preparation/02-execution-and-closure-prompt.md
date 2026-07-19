---
id: EF-DELIVERY-PREP-001
title: EnvForge Preparation Execution and Closure Prompt
version: "2.1"
status: ready-for-execution
classification: delivery-prompt
design_baseline: EnvForge Integrated Design Baseline v1.2
delivery_contract: EF-DELIVERY-CONTRACT-001@1.1
phase_id: preparation
phase_name: Integrated Design Baseline Adoption, Legacy Documentation Migration, and Implementation Readiness
risk_level: high
prompt_template_version: "1.1"
source_design_package: EnvForge_Design_Docs_v1.1_Integrated.zip
depends_on: []
unlocks:
  - phase-0-platform-and-persistence
---

# EnvForge Preparation Execution and Closure Prompt

> 本文件是 EnvForge `Preparation` 阶段的正式执行与关闭 Prompt。  
> 它必须与 EnvForge Unified Phase Delivery Contract 一致，并作为后续 Phase 0–10 的交付治理起点。  
> 本阶段只负责 Integrated Design Baseline 采纳、旧文档迁移、真实仓库审计、机器规范验证、决策关闭、交付治理和实施就绪，不得提前开发 Phase 0 产品能力。
>
> 本 Prompt 使用 `EF-DELIVERY-CONTRACT-001@1.1` 和 Prompt Template `1.1`。

---

# 0. Task Identity

你正在执行：

```text
EnvForge Preparation
Integrated Design Baseline Adoption, Legacy Documentation Migration,
Repository Fact Audit, Delivery Governance, and Implementation Readiness Closure
```

阶段编号：

```text
preparation
```

阶段风险：

```text
high
```

本阶段没有前置产品 Phase，但必须以已经通过审查的：

```text
EnvForge Integrated Design Baseline v1.2
```

为设计输入。

你的职责是把设计基线从外部设计资产转换成当前代码仓库中的正式事实源，并用真实代码、真实工具、真实测试和可重放证据证明：

```text
Accepted Architecture & Design Baseline
→ Implementation-Ready Repository Baseline
```

本阶段最终只允许：

```text
PASS
PARTIAL
FAIL
```

只有：

```text
PASS — Ready to generate Phase 0 Execution and Closure Prompt
```

才允许解锁 Phase 0。

---

# 1. Authority and Required Reading

## 1.1 设计基线与输入包

权威设计输入来自：

```text
EnvForge_Design_Docs_v1.1_Integrated.zip
```

该包在 Preparation 中应正式登记为：

```text
EnvForge Integrated Design Baseline v1.2
```

采用 v1.2 的原因是 Integrated 包不仅修复了 v1.1，还正式加入：

- `docs/15-experience`；
- Capability Publication、Catalog Preview 和 Promotion Governance；
- 当前实现指南；
- Legacy Document Migration；
- Historical Evidence Policy；
- Generated Artifact Policy；
- Phase 10 Final Integration and GA Closure。

Preparation 必须记录：

- Integrated ZIP SHA-256；
- 原旧 `docs.zip` SHA-256；
- Legacy Disposition Report SHA-256；
- 安装前项目 `docs/` 全量 Hash；
- 安装后设计基线 Hash；
- 正式采用 v1.2 的 ADR 或 Design Change Record。

仓库中的 active 设计树应最终包含：

```text
docs/
├── README.md
├── 00-governance/
├── 01-product/
├── 02-architecture/
├── 03-domain/
├── 04-compilation/
├── 05-execution/
├── 06-subsystems/
├── 07-persistence/
├── 08-api/
├── 09-security/
├── 10-operations/
├── 11-testing/
├── 12-roadmap/
├── 13-acceptance/
├── 14-adr/
├── 15-experience/
└── archive/
```

以下位置不属于 active target-design namespace：

```text
delivery/history/   historical evidence
artifacts/generated/ generated artifacts and policy
```

总体 DOCX 只能作为 historical release artifact 或 review reference，不得覆盖 Markdown 叶子事实源。

## 1.2 事实源优先级与文档分类

发生冲突时按以下顺序处理：

1. accepted ADR；
2. accepted normative leaf specification；
3. accepted machine-readable contract 或 production migration；
4. Overall Solution Design；
5. roadmap、diagram、example、current implementation guide 或 historical evidence。

不允许静默选择较低优先级定义。发现冲突必须创建 Design Defect，并同步修复权威源及所有衍生文件。

所有输入必须先分类：

### `normative-target-design`

目标产品、架构、领域、体验、安全、运维、测试、Roadmap、Acceptance、ADR 和机器合同。可以定义实现与验收。

### `informative-current-implementation`

当前 Runtime、Web、Catalog、SDK、Harness 和运维指南。只能用于当前事实审计、Gap Matrix、兼容和迁移，不能覆盖目标设计。

每份 current guide 必须记录：

```yaml
classification: informative-current-implementation
target_architecture_authority: false
current_implementation_as_of:
verified_against_commit:
retirement_phase:
```

### `historical-evidence`

历史审计、Planning、Implementation、Closure 和 Certification。只能提供审计线索；关键事实必须在当前 HEAD 重新验证。

### `generated-artifact`

OpenAPI bundle、Catalog Certification、Mermaid render、Schema bundle、inventory 等。必须可重新生成、固定工具版本、可检查 stale，并禁止手工编辑。

### `ephemeral-output`

临时失败日志、scratch、无完整上下文的 Harness Summary。不得进入 active docs 或正式 Evidence。

## 1.3 唯一阶段路线

Preparation 必须确认并冻结：

```text
Preparation
Phase 0  Platform and Persistence Foundation
Phase 1  Core Domain and Planning
Phase 2  Durable Execution Kernel
Phase 3  Golden Build
Phase 4  Discovery and Candidate Review
Phase 5  Dataset Migration Engine
Phase 6  Live Migration and Cutover
Phase 7  Capture and Environment Archive
Phase 8  Restore, Restore Drill, and Source Release
Phase 9  Production Hardening and Capability Certification
Phase 10 System Integration, Legacy Retirement, and GA Closure
```

任何旧 Phase 编号只能保留在：

- historical note；
- superseded document；
- migration history；
- ADR context。

并必须清楚标记为 deprecated。

## 1.4 强制阅读清单

修改任何文件前，按权威类别阅读。

### Normative Governance Inputs

```text
docs/README.md
docs/00-governance/documentation-conventions.md
docs/00-governance/design-status-and-lifecycle.md
docs/00-governance/source-of-truth-map.md
docs/00-governance/terminology-and-naming.md
docs/00-governance/open-questions-register.md
docs/00-governance/design-change-process.md
docs/00-governance/legacy-document-migration.md
```

### Normative Product and Architecture Inputs

```text
docs/01-product/product-vision-and-scope.md
docs/01-product/target-users-and-use-cases.md
docs/01-product/product-modes.md
docs/01-product/capability-support-policy.md
docs/01-product/non-goals-and-boundaries.md
docs/02-architecture/envforge-overall-solution-design-v1.md
docs/02-architecture/system-context.md
docs/02-architecture/container-architecture.md
docs/02-architecture/component-architecture.md
docs/02-architecture/deployment-topology.md
docs/02-architecture/control-and-execution-plane.md
docs/02-architecture/trust-boundaries.md
```

### Normative Domain and Execution Inputs

```text
docs/03-domain/domain-overview.md
docs/03-domain/domain-invariants.md
docs/03-domain/state-machines.md
docs/03-domain/workload-candidate-and-review.md
docs/03-domain/workload-blueprint.md
docs/03-domain/decision-set-and-plan-revision.md
docs/03-domain/action-and-action-dag.md
docs/03-domain/execution-run.md
docs/05-execution/durable-execution-engine.md
docs/05-execution/queue-claim-lease-and-fencing.md
docs/05-execution/retry-reconciliation-and-idempotency.md
docs/05-execution/crash-recovery.md
```

### Normative Capability Inputs

```text
docs/04-compilation/capability-sdk-and-certification.md
docs/04-compilation/capability-publication-and-catalog-governance.md
docs/11-testing/capability-certification.md
docs/12-roadmap/capability-support-matrix.md
```

### Normative Experience Inputs

```text
docs/15-experience/README.md
docs/15-experience/product-experience-principles.md
docs/15-experience/information-architecture.md
docs/15-experience/assessment-first-run.md
docs/15-experience/candidate-review-and-explainability.md
docs/15-experience/plan-review-approval-and-run-progress.md
docs/15-experience/failure-recovery-and-support.md
docs/15-experience/trust-risk-and-high-risk-operations.md
docs/15-experience/capability-governance-experience.md
docs/15-experience/design-system-accessibility-and-i18n.md
```

### Machine-readable Contracts

```text
docs/07-persistence/ddl/phase-0-foundation.sql
docs/07-persistence/ddl/phase-1-domain.sql
docs/07-persistence/ddl/phase-2-execution.sql
docs/08-api/openapi/openapi.yaml
docs/08-api/openapi/schemas/*.yaml
```

### Normative Persistence, API, Security, Operations, Testing Inputs

```text
docs/07-persistence/persistence-architecture.md
docs/07-persistence/database-schema-catalog.md
docs/07-persistence/migration-from-current-model.md
docs/08-api/api-design-guidelines.md
docs/08-api/resource-model.md
docs/08-api/command-api-patterns.md
docs/08-api/idempotency-and-concurrency.md
docs/08-api/error-model.md
docs/09-security/security-architecture.md
docs/09-security/threat-model.md
docs/09-security/authentication-and-authorization.md
docs/09-security/secret-and-key-security.md
docs/10-operations/observability-and-slos.md
docs/10-operations/backup-and-control-plane-recovery.md
docs/11-testing/test-strategy.md
docs/11-testing/failure-injection-and-crash-matrix.md
docs/11-testing/end-to-end-scenarios.md
```

### Normative Roadmap and Acceptance Inputs

```text
docs/12-roadmap/implementation-roadmap-v1.md
docs/12-roadmap/current-to-target-gap-matrix.md
docs/12-roadmap/capability-support-matrix.md
docs/12-roadmap/dependency-map.md
docs/12-roadmap/current-code-migration-plan.md
docs/12-roadmap/phase-exit-criteria.md
docs/13-acceptance/phase-0-platform-foundation.md
docs/13-acceptance/golden-build-v1.md
docs/13-acceptance/golden-migration-v1.md
docs/13-acceptance/golden-preserve-restore-v1.md
docs/13-acceptance/phase-10-final-integration-and-ga-closure.md
docs/14-adr/README.md
```

### Current Implementation Inputs

```text
docs/04-compilation/capability-authoring-guide.md
docs/04-compilation/current-capability-catalog-guide.md
docs/10-operations/current-runtime-operations.md
docs/11-testing/current-harness-guide.md
docs/15-experience/current-web-implementation.md
```

这些文件的路径、命令和行为必须在当前 HEAD 重新验证；失效内容必须更新或退休。

### Historical Evidence Inputs

至少读取：

```text
delivery/history/README.md
delivery/history/LEGACY_FILE_DISPOSITION.csv
delivery/history/audits/envforge-local-current-state-audit-2026-07-18.md
delivery/history/legacy-phase-reports/phase7r-0-baseline-recovery-2026-07-18.md
delivery/history/legacy-phase-reports/phase7r-b-final-audit-evidence-2026-07-18.md
delivery/history/legacy-phase-reports/phase7r-c-final-convergence-verification-2026-07-18.md
delivery/history/deleted-ephemeral-files.md
```

这些历史文件不能直接满足当前 Acceptance，必须在当前 HEAD 重新验证关键事实。

### Generated Artifact Policy Input

```text
artifacts/generated/README.md
```

历史 Catalog Certification 只作为历史快照；Preparation 必须依据当前模型重新生成需要的输出。

## 1.5 阅读证据

Closure Report 必须列出：

- 实际阅读文件；
- Git Blob Hash 或 SHA-256；
- 文档状态；
- 是否发现冲突；
- 关联 Design Defect。

不得只声称“已阅读全部文档”。还必须记录每项输入的分类：`normative-target-design`、`informative-current-implementation`、`historical-evidence` 或 `generated-artifact`，以及 current/historical 输入是否在当前 HEAD 重新验证。

---

# 2. Repository Baseline

## 2.1 修改前事实快照

在任何写操作前记录：

- repository root；
- remote；
- branch；
- initial HEAD；
- remote HEAD；
- working tree；
- worktree；
- submodule；
- Git LFS；
- operating system；
- CPU architecture；
- shell；
- runtime versions；
- package managers；
- lockfiles；
- Docker/Compose；
- PostgreSQL client/server availability；
- CI provider；
- current database；
- current schema/migration mechanism；
- current API version；
- current feature flags；
- current test commands；
- existing `docs/` file inventory and hashes；
- existing documentation entrypoints and backlinks；
- current `delivery/` contents；
- current `artifacts/` and generated-output locations；
- Integrated package and legacy-doc source hashes。

## 2.2 基线文件

创建：

```text
delivery/preparation/evidence/
├── index.md
├── repository-baseline.json
├── environment-baseline.md
├── git-status-before.txt
├── dependency-toolchain.md
├── command-index.md
├── current-state/
├── legacy-docs/
├── historical-validation/
├── generated-artifacts/
├── experience/
├── capability-governance/
└── hashes/
```

`repository-baseline.json` 至少包含：

```json
{
  "phase": "preparation",
  "repository": "",
  "branch": "",
  "initialHead": "",
  "remoteHead": "",
  "workingTreeClean": true,
  "worktrees": [],
  "submodules": [],
  "gitLfs": false,
  "packageManagers": [],
  "runtimeVersions": {},
  "database": {},
  "apiVersion": null,
  "schemaVersion": null,
  "featureFlags": [],
  "designBaseline": "1.2",
  "sourceDesignPackage": "EnvForge_Design_Docs_v1.1_Integrated.zip",
  "existingDocsFileCount": 0,
  "existingDocsTreeHash": "",
  "capturedAt": ""
}
```

## 2.3 Working Tree 规则

如果 working tree 不干净：

1. 不覆盖用户改动；
2. 分类已有改动；
3. 识别是否与 Preparation 冲突；
4. 在 Entry Assessment 中记录；
5. 无法安全区分时输出 `ENTRY-BLOCKED`。

不得自动 stash、reset、clean 或删除用户文件。

---

# 3. Previous Phase Handoff

Preparation 没有前置产品 Phase。

本节必须明确记录：

```yaml
previous_phase: null
previous_phase_verdict: not-applicable
previous_phase_final_head: null
previous_handoff_manifest: null
```

Preparation 的等价输入为：

- EnvForge Integrated Design Baseline v1.2；
- 当前仓库 initial HEAD；
- 当前代码和测试事实；
- 已上传的修复设计文档；
- 当前开放问题登记册。

不得虚构前置 Handoff Manifest。

---

# 4. Phase Purpose

Preparation 的目的不是交付用户功能，而是建立后续所有 Phase 可依赖的工程治理基线。

完成后必须具备：

1. 设计基线已经进入仓库；
2. 文档事实源唯一；
3. 当前代码事实已经审计；
4. Gap Matrix 绑定真实路径和符号；
5. Phase 0 阻断决策关闭；
6. 机器可读规范由真实工具验证；
7. Golden Build v1 范围冻结；
8. Phase Delivery 目录和模板建立；
9. 文档验证进入 CI；
10. 当前测试基线固定；
11. 风险、决策、缺陷和 Deferred Work 可追踪；
12. Preparation Closure 和 Handoff 可供 Phase 0 消费。

---

# 5. Entry Criteria

## 5.1 Entry Assessment 文件

必须创建：

```text
delivery/preparation/01-entry-assessment.md
```

## 5.2 Entry Gate

检查：

- 当前目录是有效 Git 仓库；
- initial HEAD 可读取；
- working tree 可安全处理；
- 设计文档包可读取且完整；
- 设计版本明确；
- 不存在未解决 Git 冲突；
- 不会因审计命令泄露 Secret；
- 有足够工具运行基线测试或能明确记录环境阻塞；
- Preparation 不会覆盖用户未提交工作；
- 当前仓库没有已知 P0 数据损坏状态；
- 项目已有 `docs/` 已完成文件、Hash、Git history 和引用清单；
- Integrated 包不会未经审计覆盖项目新增文档；
- `delivery/` 中已有 Contract、Prompt、Closure 不会被覆盖；
- `artifacts/` 中已有项目生成物不会被错误删除；
- 每个旧 active 文档都能在 disposition 中找到，或被登记为项目新增待处置项；
- 使用 `/MIR`、删除或替换前已有明确迁移和回退计划。

## 5.3 Entry Verdict

只允许：

```text
ENTRY-PASS
ENTRY-BLOCKED
```

`ENTRY-BLOCKED` 时：

- 停止所有修改；
- 输出 blocker；
- 记录解除条件；
- 不创建“部分完成”的产品改动。

---

# 6. Objectives and Exit Outcomes

Preparation 必须实现以下结果：

| ID | Exit Outcome |
|---|---|
| PREP-O-001 | 设计文档成为仓库正式资产 |
| PREP-O-002 | Source of Truth Map 在真实文件中成立 |
| PREP-O-003 | 阶段路线统一到 Preparation + Phase 0–10 |
| PREP-O-004 | Canonical 术语和状态命名可自动校验 |
| PREP-O-005 | 当前代码、API、DB、执行链、测试和 CI 完成事实审计 |
| PREP-O-006 | Current-to-Target Gap Matrix 绑定真实代码证据 |
| PREP-O-007 | Phase 0 阻断开放问题通过 ADR 关闭 |
| PREP-O-008 | Markdown、Mermaid、OpenAPI、JSON Schema、Reference DDL 通过真实工具验证 |
| PREP-O-009 | Golden Build v1 Fixture 和验收范围冻结 |
| PREP-O-010 | Phase Delivery Contract 和目录治理在仓库中落地 |
| PREP-O-011 | 文档与规范验证进入 CI |
| PREP-O-012 | Preparation Evidence、Closure、Handoff 完整 |
| PREP-O-013 | 没有 P0/P1 未关闭缺陷 |
| PREP-O-014 | Phase 0 Prompt 具备真实输入条件 |
| PREP-O-015 | 旧 docs 每个文件均有可审计 disposition |
| PREP-O-016 | 稳定旧设计已合并，当前运行知识未丢失 |
| PREP-O-017 | Current Implementation Guides 已绑定当前 HEAD |
| PREP-O-018 | Historical Evidence 已隔离并完成关键事实重验证 |
| PREP-O-019 | Generated Artifact 已移出 active docs 并可重新生成 |
| PREP-O-020 | `docs/15-experience` 已纳入事实源和验收追踪 |
| PREP-O-021 | Capability Preview/Review/Promotion 治理已验证 |
| PREP-O-022 | 旧 active 文档链接和兼容入口已有退休计划 |

---

# 7. Scope

允许修改：

- `docs/**`；
- `delivery/**`；
- 文档/规范验证工具；
- 文档 CI；
- OpenAPI、JSON Schema 和 Reference DDL 中已确认的设计缺陷；
- ADR 和 Open Questions；
- Issue、PR、Closure、Evidence、Handoff 模板；
- 非生产性的仓库审计脚本；
- 固定文档工具版本所需开发依赖和 lockfile；
- Golden Build Fixture 的规范和目录骨架；
- README、贡献指南和设计治理入口；
- `delivery/history/**` 的分类、索引和 metadata；
- `artifacts/generated/README.md` 与生成物策略；
- 旧文档 disposition、迁移追踪和短期兼容桩。

允许只读审计：

- 生产代码；
- 当前 API；
- 当前数据库；
- 当前执行路径；
- 当前 UI；
- 当前 Artifact；
- 当前 SSH；
- 当前 Apply/Verify/Rollback；
- 当前测试和 CI。

---

# 8. Non-goals

Preparation 不得实施：

- PostgreSQL 生产权威状态迁移；
- 正式 Workspace/Project 新模型；
- ExecutionRun；
- Action DAG；
- Durable Queue；
- Worker Lease；
- Fencing；
- Outbox 生产处理；
- Artifact 生产迁移；
- Secret Delivery；
- Dataset Migration；
- Cutover；
- Archive；
- Golden Build Actions；
- 新用户功能；
- UI 产品改造；
- legacy runtime cutover。

除非用户明确授权，不得修复产品 Bug 或重构生产代码。

---

# 9. Confirmed Invariants

Preparation 必须确认设计和后续交付不违反：

1. Candidate 不能直接产生执行 Action；
2. Workload 是稳定业务身份；
3. Blueprint 是目标无关、不可变 Revision；
4. PlanRevision 是目标特定、不可变执行合同；
5. Approval 绑定准确 Plan Hash；
6. Run 固定绑定 Plan 和 Approval；
7. Rollback 是独立 ExecutionRun；
8. Required Verification 位于主 DAG；
9. Traffic Switch 不等于 Cutover Commit；
10. 普通状态迁移保持单写权威；
11. Secret 明文不得进入 Snapshot、Blueprint、Plan、Event、Report 或普通 DB；
12. Archive Integrity 与 Recoverability 分离；
13. Capture Plan 不可复用为 Restore Plan；
14. 长任务不应依赖 HTTP 生命周期；
15. At-least-once 必须结合幂等、Reconciliation、Checkpoint 和 Fencing；
16. 不能长期双写新旧权威模型；
17. Report 只能陈述真实证据；
18. Phase 10 负责全系统集成、Legacy Retirement 和 GA Closure。

Preparation 只审计和固化这些不变量，不实现其运行时。

---

# 10. Open Decisions and ADR Rules

## 10.1 必须关闭的开放问题

至少处理：

```text
OQ-002 Authentication baseline
OQ-003 PostgreSQL migration and ORM policy
OQ-004 Local Artifact Store and encryption default
```

## 10.2 决策过程

每项必须：

1. 审计当前代码；
2. 列出至少两个方案；
3. 比较设计一致性；
4. 比较迁移成本；
5. 比较安全风险；
6. 比较测试能力；
7. 比较运维；
8. 比较可逆性；
9. 比较后续 Phase 影响；
10. 给出推荐；
11. 创建或更新 ADR；
12. 更新 Open Questions；
13. 更新相关事实源；
14. 更新 Phase 0 Acceptance。

## 10.3 推荐基线

除非当前仓库存在可证明的强阻断，优先：

### Authentication

```text
初始版本支持本地账户；
架构保留 OIDC；
高风险操作要求 re-authentication；
MFA 作为生产策略能力；
应用会话与 SSH/Secret Provider Credential 分离。
```

### Database Migration

```text
显式 SQL Migration 为 Schema 权威；
ORM/Query Builder 不允许自动同步生产 Schema；
Migration 支持事务、验证、重放和升级测试。
```

### Artifact

```text
本地开发实现使用 temp write + fsync + atomic rename + SHA-256；
生产敏感 Artifact 默认加密；
所有实现遵守统一 Artifact Store 接口；
本地路径不是 Archive 长期可靠副本。
```

## 10.4 ADR 分类

发现差异时使用：

```text
implementation-detail
ADR-required
design-baseline-change
```

`design-baseline-change` 必须停止对应工作，不能由执行代理自行批准。

---

# 11. Mandatory Read-only Audit

在任何设计安装或工具修改前完成只读审计。

## 11.1 Repository Architecture

记录：

- monorepo/单应用；
- API 入口；
- Web/UI 入口；
- Worker/后台任务入口；
- module boundaries；
- configuration；
- dependency injection；
- build system；
- package layout；
- CI；
- deployment。

输出：

```text
delivery/preparation/evidence/repository-inventory.md
```

## 11.2 Current Domain Inventory

至少检索并核实：

```text
StoredMigrationSession
EnvironmentPlan
ApplyRun
ActionRun
ServiceStack
InventoryGraph
Snapshot
VerificationResult
RollbackResult
Artifact
SecretRef
```

每项记录：

| Field | Requirement |
|---|---|
| Current name | 真实类型、接口或表 |
| Code path | 文件和符号 |
| Responsibility | 根据代码总结 |
| Persistence | DB、JSON、文件、内存 |
| Lifecycle | 当前状态和变化 |
| API | 创建、读取、修改入口 |
| Tests | Test ID 和路径 |
| Authority | 当前是否权威 |
| Risk | 与目标设计差异 |
| Confidence | high/medium/low |

## 11.3 Current API Inventory

生成：

```text
delivery/preparation/evidence/api/current-api-inventory.json
```

至少包含：

- method；
- path；
- operation；
- handler；
- auth；
- request；
- response；
- mutation；
- transaction；
- idempotency；
- optimistic lock；
- long-running；
- test coverage；
- deprecation。

## 11.4 Current Database Inventory

输出：

```text
delivery/preparation/evidence/database/current-database-inventory.md
```

包括：

- engine/version；
- tables/schema；
- primary keys；
- JSON documents；
- migrations；
- indexes；
- transaction boundaries；
- optimistic concurrency；
- audit；
- run state；
- in-memory authority；
- file-backed state；
- backup/restore。

## 11.5 Current Execution Chain

实际追踪：

```text
HTTP
→ Plan lookup
→ Approval validation
→ Apply
→ Side effect
→ Result persistence
→ Verification
→ Rollback
→ Report
```

明确：

- HTTP 生命周期绑定；
- in-memory state；
- API restart behavior；
- Worker 是否存在；
- retry；
- timeout；
- checkpoint；
- reconciliation；
- unknown outcome；
- report evidence source。

## 11.6 Current UI Workflow

只读审计：

- Project/Session 入口；
- Discovery；
- Plan；
- Approval；
- Apply；
- Progress；
- Verify；
- Rollback；
- Report；
- risk display；
- false-success risk。

本阶段不改 UI。

## 11.7 Legacy Documentation and Evidence Inventory

必须审计：

- 项目已有 `docs/` 与 Integrated 包的逐文件差异；
- 文件 Hash 和 Git history；
- 旧文档全仓引用；
- active、current、historical、generated、ephemeral 分类；
- `LEGACY_FILE_DISPOSITION.csv` 完整性；
- 项目新增但未在旧 ZIP 中出现的文档；
- 旧 `product.md`、`system-design.md`、`operations.md`、`validation.md`、`web-ui.md` 等迁移状态；
- historical reports 的当前事实重验证需求；
- generated certification 的重新生成方式；
- ephemeral outputs 是否已移除。

输出：

```text
delivery/preparation/07-legacy-document-disposition.md
delivery/preparation/08-current-implementation-guide-register.md
delivery/preparation/95-document-migration-traceability.md
delivery/preparation/evidence/legacy-docs/
delivery/preparation/evidence/historical-validation/
```

## 11.8 Baseline Tests

发现并运行官方命令：

- lint；
- formatting check；
- typecheck；
- unit；
- integration；
- API；
- web；
- E2E；
- migration；
- scenario；
- security scan；
- build。

结果分类：

```text
PASS
FAIL-existing
SKIPPED-environment
NOT-CONFIGURED
```

输出：

```text
delivery/preparation/evidence/tests/baseline-test-report.md
```

不得为了取得绿色基线而先修改代码。

---

# 12. Implementation Planning Rules

## 12.1 必须先生成计划

在第一次写操作前创建：

```text
delivery/preparation/03-implementation-plan.md
```

计划至少包括：

- 当前事实；
- 设计差异；
- 修改文件；
- 文档迁移；
- ADR；
- 工具依赖；
- CI；
- 验证命令；
-风险；
- 回退；
- Commit 切分；
- 时间顺序；
- Stop Conditions。

## 12.2 设计差异

创建：

```text
delivery/preparation/04-design-delta.md
```

每项差异包含：

- design source；
- current implementation；
- difference；
- classification；
- decision；
- ADR/defect；
- impact；
- status。

## 12.3 风险登记

创建：

```text
delivery/preparation/05-risk-register.md
```

至少覆盖：

- 覆盖用户已有 docs；
- 设计和代码事实混淆；
- 工具链污染生产依赖；
- Secret 泄漏到 Evidence；
- Reference DDL 被误当生产 Migration；
- CI 时间增长；
- 旧 Phase 路线残留；
- 错误关闭开放问题；
- Gap Matrix 证据不足；
- Golden Build 范围扩张。

## 12.4 决策日志

创建：

```text
delivery/preparation/06-decision-log.md
delivery/preparation/07-legacy-document-disposition.md
delivery/preparation/08-current-implementation-guide-register.md
delivery/preparation/95-document-migration-traceability.md
```

记录：

- 决策 ID；
-日期；
-背景；
-选择；
-原因；
-ADR；
-影响；
-可逆性。

---

# 13. Work Packages

所有 Work Package 使用统一编号。

---

## WP0 Baseline and Audit

### 目标

建立可重复的仓库、环境、测试和事实基线。

### 工作

- Entry Assessment；
- repository snapshot；
- toolchain；
- current architecture；
- current API；
- current DB；
- current execution；
- current UI；
- current tests；
- Evidence index；
- existing docs inventory and tree hash；
- existing delivery/artifact inventory；
- legacy references and project-only documents。

### Verdict

```text
PASS
FAIL
BLOCKED
```

Preparation 中 WP0 不能 `PASS-WITH-DEBT`，因为后续工作依赖真实基线。

---

## WP1 Design, Decisions, and Invariants

### 目标

建立唯一设计事实源，并关闭 Phase 0 阻断决策。

### 工作

- 安装 Integrated Design Baseline 并正式采用 v1.2；
- 对比项目已有 docs，禁止盲目覆盖；
- 验证每个旧文件 disposition 和迁移追踪；
- 区分 normative/current/historical/generated/ephemeral；
- 验证 Source of Truth 含 `docs/15-experience`；
- 验证 Capability Publication、Preview、Review 和 Promotion Governance；
- 验证 current guides metadata 和退休阶段；
- 验证 historical evidence 不进入 active authority；
- canonical terms 和 state naming；
- Preparation + Phase 0–10；
- ADR-001 onward；
- OQ-002/OQ-003/OQ-004；
- design defects；
- invariant review；
- 旧 Product Modes、旧 Phase、旧领域名和旧主入口退休。

### 输出

```text
docs/**
delivery/preparation/04-design-delta.md
delivery/preparation/05-risk-register.md
delivery/preparation/06-decision-log.md
delivery/preparation/93-defect-register.md
delivery/preparation/07-legacy-document-disposition.md
delivery/preparation/08-current-implementation-guide-register.md
delivery/preparation/95-document-migration-traceability.md
```

---

## WP2 Persistence and Data Migration

### Preparation 适用范围

不实施生产数据库。

本 WP 负责：

- 审计当前数据库；
- 关闭 Migration 工具决策；
- 验证 Reference DDL；
- 明确 Reference DDL 与 production Migration 边界；
- 审计 SQLite/文件/内存当前权威；
- 更新 current-code-migration-plan；
- 为 Phase 0 提供数据迁移输入。

### 明确禁止

- 把 Reference DDL 直接复制成生产 Migration；
- 改变当前数据库权威；
- backfill 用户数据；
-引入新生产表。

---

## WP3 Domain Model and State Machines

### Preparation 适用范围

不实现领域模型。

本 WP 负责：

- 验证核心对象定义完整；
- 检查聚合边界；
- 检查状态机；
- 检查术语；
- 检查 DDL/OpenAPI/Schema 枚举一致；
- 记录当前对象到目标对象映射；
- 确认 Phase 1 输入。

### 明确禁止

- 创建生产 EnvironmentProject、Blueprint、PlanRevision 新代码；
- 改写当前领域行为。

---

## WP4 Application Services and Transactions

### Preparation 适用范围

只读审计。

负责：

- 当前 command/query/use case；
- 当前 transaction boundary；
- current Apply orchestration；
- current Outbox/Inbox；
- current Idempotency；
- current API-to-domain coupling；
- Phase 0/1 gap。

标记：

```text
NOT-APPLICABLE for production implementation
PASS for audit completion
```

---

## WP5 API and Machine-readable Contracts

### 目标

确保设计 API 可被工具使用，并明确当前 API 差距。

### 工作

- current API inventory；
- OpenAPI parse；
- lint；
- bundle；
- `$ref`；
- operationId uniqueness；
- path params；
- examples；
- error responses；
- auth/permissions；
- Idempotency-Key；
- If-Match；
- long-running model；
- codegen/mock smoke；
- current-to-target mapping；
- Capability Package → Certification → Catalog Preview → Diff → Admin Review → Promotion Draft → Explicit Promotion；
- Preview 不修改 Runtime Catalog；
- Promotion 不自动 enable；
- 旧 Catalog certification 只作为 historical snapshot；
- 新认证按 Detect/Build/Migrate/Capture/Restore/Verify/Rollback 分维度。

### 输出

```text
delivery/preparation/evidence/api/
```

---

## WP6 Runtime, Worker, Capability, Adapter, or Provider

### Preparation 适用范围

只读审计当前：

- synchronous Apply；
- process-local state；
- SSH；
- package execution；
- Artifact；
- verification；
- rollback；
- worker/background process；
- adapters/providers。

不实现：

- durable worker；
- queue；
- lease；
- new adapter；
- Secret Provider；
- Dataset Provider。

Verdict 可以是：

```text
PASS for audit
NOT-APPLICABLE for implementation
```

并必须解释。

---

## WP7 UI and User Workflow

### Preparation 适用范围

本 WP 不实施 UI，但必须完成两类审计。

#### 目标体验规范验证

检查：

- Assessment-first；
- Product Experience Principles；
- Information Architecture；
- Candidate Review and Explainability；
- Plan/Approval/Run 区分；
- Trust Ladder；
- Failure/Recovery/Support；
- Capability Governance Experience；
- Design System、Accessibility、i18n；
- Experience → Domain → API → UI → Test → Evidence 追踪。

#### 当前 Web 实现审计

重新验证 `current-web-implementation.md` 中：

- 页面和 route；
- navigation；
- components；
- CSS/design-system 路径；
- smoke command；
- 当前 Workbench IA；
- 能力夸大和 false-success risk；
- 与目标 Experience Baseline 的差距。

输出：

```text
delivery/preparation/evidence/experience/
delivery/preparation/08-current-implementation-guide-register.md
```

Verdict 必须分别记录：

```text
Target Experience Audit: PASS/PASS-WITH-DEBT/FAIL
Current Web Revalidation: PASS/PASS-WITH-DEBT/FAIL
Implementation: NOT-APPLICABLE
```

## WP8 Compatibility, Backfill, Feature Flags, and Legacy Migration

### 目标

建立当前模型到目标模型的真实迁移策略。

更新：

```text
docs/12-roadmap/current-to-target-gap-matrix.md
docs/12-roadmap/current-code-migration-plan.md
```

必须覆盖：

- current authority；
- target authority；
- KEEP/ADAPT/REPLACE/REMOVE/NEW；
- compatibility adapter；
- feature flag；
- backfill；
- shadow read/write；
- bounded dual-write exception；
- cutover gate；
- rollback gate；
- telemetry；
- deletion condition；
- final retirement Phase 10。

长期双写必须明确禁止。

本 WP 同时负责文档 Legacy：

- old docs authority；
- old links and entrypoints；
- old Phase names；
- old product modes；
- old domain terms；
- current implementation guides；
- historical evidence；
- generated outputs；
- ephemeral outputs；
- compatibility stubs and retirement gates。

旧 active 文档删除前必须证明：稳定内容已合并、当前运行说明有替代、历史证据已归档、全仓引用已迁移、CI 不再依赖、用户新增内容未丢失。

---

## WP9 Security, Authorization, Secrets, and Audit

### 目标

完成 Preparation 安全基线和决策。

检查：

- authentication；
- authorization；
- workspace scope；
- high-risk approval；
- Secret handling；
- redaction；
- evidence sanitization；
- SSH trust；
- Artifact encryption；
- command injection；
- SSRF；
- path traversal；
- unsafe deserialization；
- supply chain；
- audit；
- privacy/deletion。

执行：

- Secret canary；
- credential pattern scan；
- Evidence sanitization review；
- dependency/tooling risk review。

不实施完整生产 RBAC。

---

## WP10 Observability, Operations, Repair, and Runbooks

### Preparation 适用范围

审计当前：

- logs；
- metrics；
- tracing；
- health；
- background jobs；
- run inspection；
- support bundle；
- repair；
- backup/restore；
- incident response。

为 Phase 0 创建输入，不实现完整运维能力。

同时为设计验证工具提供：

- clear logs；
- non-zero exit；
- machine-readable summary；
- local/CI parity。

---

## WP11 Tests, Failure Injection, Performance, and Security Validation

### 目标

验证设计资产和当前基线，不进行产品故障注入。

必须执行：

- Markdown validation；
- Mermaid rendering；
- OpenAPI validation；
- JSON Schema positive/negative；
- Reference DDL apply/constraint tests；
- baseline regression；
- Secret scan；
- CI-equivalent local run；
- documentation validation performance baseline；
- 旧 active root 文档不存在或只有批准的短期迁移桩；
- historical reports 不被 active docs index 当成事实源；
- 所有 `current-*` 文件明确非目标权威并绑定当前 HEAD；
- generated outputs 不在 active docs；
- ephemeral harness outputs 不存在；
- `docs/15-experience` links 和 Source of Truth 完整；
- Experience、Domain、API 无冲突；
- Capability Preview 不等于 Runtime Enablement；
- `Maintain` 不再作为一级产品模式；
- Phase 10 路线全仓一致。

### 性能基线

记录：

- 文档验证总时长；
- Mermaid render 时长；
- OpenAPI lint/bundle 时长；
- DDL disposable DB 时长；
- CI 预计增加时长；
- Artifact 大小。

Preparation 不需要产品吞吐性能测试，但必须避免设计验证 CI 不可接受地缓慢。

---

## WP12 Documentation and Specification Synchronization

### 目标

确保所有修复在事实源和衍生文档中同步。

检查：

- Overall Design；
- leaf specs；
- OpenAPI；
- JSON Schema；
- Reference DDL catalog；
- ADR；
- Open Questions；
- Roadmap；
- Acceptance；
- Capability Matrix；
- Operations；
- Testing；
- phase route；
- terminology。

新增：

```text
docs/13-acceptance/preparation-design-baseline.md
```

该文档成为正式 Preparation Acceptance Contract。

---

## WP13 Stabilization, Closure, and Handoff

### 目标

停止增加范围，完成全量验证、报告、提交和交接。

工作：

- clean-state validation；
- flaky investigation；
- DDL reapply；
- OpenAPI rebundle；
- Mermaid rerender；
- Secret scan；
- diff review；
- evidence hashing；
- acceptance traceability；
- defect closure；
- deferred work；
- atomic commits；
- closure report；
- handoff manifest。

---

# 14. Persistence and Migration Requirements

Preparation 不修改生产 Schema，但必须：

1. 确认当前 Schema 权威；
2. 记录 Migration 机制；
3. 关闭显式 SQL Migration 决策；
4. 验证 Reference DDL；
5. 检查：
   - UUID；
   - workspace scope；
   - revision；
   - version；
   - hash；
   - FK；
   - unique；
   - partial unique；
   - index；
   - optimistic concurrency；
   - outbox/inbox；
   - queue/lease；
   - retention；
   - no cross-module cascade。
6. 验证：
   - multi-Blueprint Plan；
   - independent Rollback Run；
   - shared resource lock；
   - Snapshot failure boundary；
   - WorkerLease authority。
7. 明确 Phase 0 将怎样把 Reference DDL 转成正式 Migration；
8. 不声称 Reference DDL 已经是生产实现。

默认验证环境可使用 PostgreSQL 16，但必须标注：

```text
validation target, not final support commitment
```

---

# 15. Domain and State Machine Requirements

必须检查所有主要实体的：

- responsibility；
- fields；
- invariants；
- aggregate root；
- lifecycle；
- legal transitions；
- preconditions；
- emitted events；
- terminal states；
- recoverable states；
- forbidden transitions；
- persistence boundary。

至少包括：

```text
EnvironmentProject
EnvironmentEndpoint
EnvironmentSnapshot
CandidateGeneration
WorkloadCandidate
CandidateReviewSession
Workload
WorkloadBlueprintRevision
DecisionSetRevision
PlanRevision
PlanApproval
ExecutionRun
StageRun
ActionRun
ActionAttempt
DatasetMigrationRun
TransferSession
SecretDeliveryRun
CutoverRun
ArchiveVersion
RestoreDrillRun
```

正式状态统一 kebab-case。

---

# 16. Application Service Requirements

Preparation 只审计，不实现。

必须记录当前：

- command handlers；
- transaction boundaries；
- API mutation flow；
- process-local orchestration；
- audit event；
- idempotency；
- optimistic concurrency；
- cross-module coupling；
- current report generation。

输出 Phase 0/1 的输入约束。

---

# 17. API and Contract Requirements

OpenAPI 验证至少包括：

- OpenAPI 3.1 parse；
- `$ref` resolve；
- lint；
- bundle；
- operationId uniqueness；
- path parameter consistency；
- request/response examples；
- schema validation；
- mock or codegen smoke；
- security scheme；
- permissions；
- mutation headers；
- 401/403/404/409/412/422；
- 202 long-running model；
- SSE/event subscriptions；
- deprecation metadata。

每个 mutation 设计应能回答：

- route；
- operationId；
- permission；
- Idempotency-Key；
- If-Match/expected version；
- transaction；
- events；
- audit；
- errors；
- async result；
- compatibility。

本阶段不要求实现设计 OpenAPI 的全部路由。

---

# 18. Runtime, Worker, Adapter, or Provider Requirements

Preparation 只审计现状。

需要确认：

- 当前外部副作用执行入口；
- before-state；
- precondition；
- postcondition；
- retry；
- timeout；
- reconciliation；
- resumability；
- checkpoint；
- resource lock；
- failure class；
- rollback；
- unknown outcome；
- evidence；
- redaction。

任何当前路径缺失上述能力，都必须进入 Gap Matrix，而不是被描述成已支持。

---

# 19. UI and User Workflow Requirements

本阶段不实施 UI。

必须审计 UI 是否：

- 将 Plan 当成执行证据；
- 将 Apply exit code 当成业务成功；
- 展示审批；
- 展示风险；
- 展示未知状态；
- 展示恢复选择；
- 展示 Verify/Rollback；
- 暗示不存在的 Migration/Capture 能力。

发现“能力夸大”必须登记 P1 或 P2，依据误导风险判断。

---

# 20. Security and Audit Requirements

必须完成：

1. Authentication baseline ADR；
2. workspace/tenant boundary 审计；
3. Secret 数据流审计；
4. Evidence 脱敏；
5. SSH host key 和 credential reference 审计；
6. Artifact 加密默认；
7. command injection 风险；
8. path traversal；
9. SSRF；
10. unsafe deserialization；
11. dependency supply chain；
12. high-risk approval；
13. audit integrity；
14. privacy/retention；
15. deletion semantics。

任何真实 Secret 泄漏为 P0，Preparation 必须 FAIL。

---

# 21. Observability and Operations Requirements

设计验证和审计工具必须提供：

- structured output 或清晰文本；
- non-zero error；
- correlation/run ID 可选；
- elapsed time；
- artifact paths；
- summary；
- no Secret；
- local/CI parity。

审计当前系统是否具备：

- logs；
- metrics；
- tracing；
- health；
- stuck-state；
- admin inspection；
- repair；
- runbook；
- backup/restore。

缺失项进入 Phase 0/2/9 对应 Gap。

---

# 22. Compatibility and Legacy Migration

Gap Matrix 必须为关键旧对象明确：

```text
StoredMigrationSession → EnvironmentProject
ServiceStack → WorkloadCandidate
EnvironmentPlan → PlanRevision
ApplyRun → ExecutionRun
legacy ActionRun → ActionRun + ActionAttempt
Verify result → VerificationResult / verification Run
Rollback result → independent rollback ExecutionRun
local Plan/Report files → ArtifactRecord / ReportArtifact
SQLite/document state → PostgreSQL authoritative state
```

每项包括：

- current authority；
- target authority；
- compatibility adapter；
- feature flag；
- backfill；
- shadow policy；
- dual-write rule；
- cutover gate；
- rollback gate；
- usage telemetry；
- deletion condition；
- retirement phase。

默认最终清理阶段：

```text
Phase 10
```

但某些旧路径可以在更早 Phase 删除，只要 Exit Gate 明确。

---

# 23. Testing Matrix

建立 Acceptance Traceability：

```text
delivery/preparation/94-acceptance-traceability.md
```

格式：

| Acceptance ID | Requirement | Design Source | Implementation/Artifact | Test | Evidence | Status |
|---|---|---|---|---|---|---|

至少包含：

- Entry；
- docs installation；
- Source of Truth；
- terms；
- phase route；
- ADR；
- Open Questions；
- Gap Matrix；
- Markdown；
- Mermaid；
- OpenAPI；
- JSON Schema；
- DDL；
- Golden Build freeze；
- templates；
- CI；
- baseline tests；
- security；
- commits；
- Closure；
- Handoff。

每个 Test 必须记录：

- command；
- tool version；
- environment；
- result；
- exit code；
- evidence；
- acceptance ID。

---

# 24. Failure Injection and Recovery

Preparation 不对生产系统执行破坏性故障注入。

但必须测试设计验证工具的失败行为：

1. broken Markdown link；
2. duplicate document ID；
3. invalid front matter；
4. invalid Mermaid；
5. broken OpenAPI `$ref`；
6. duplicate operationId；
7. invalid JSON Schema example；
8. invalid DDL constraint；
9. PostgreSQL unavailable；
10. CI command interruption；
11. evidence path missing；
12. Secret canary detection；
13. stale generated bundle；
14. non-clean working tree。

每个工具必须：

- 在错误时 non-zero exit；
- 指出具体文件；
- 不修改源文件；
- 不泄漏 Secret；
- 支持重新运行。

---

# 25. Performance and Capacity Baseline

记录设计治理工具的基线：

| Check | Metric |
|---|---|
| Markdown validation | elapsed time |
| Mermaid rendering | elapsed time and output size |
| OpenAPI lint/bundle | elapsed time and bundle size |
| JSON Schema tests | elapsed time |
| DDL disposable validation | startup/apply/test elapsed time |
| Full design CI | total elapsed time |
| Evidence bundle | total size |
| Docs package | file count and total size |

目标不是优化到极限，而是识别：

- CI 是否过慢；
- 是否需要缓存；
- 是否生成巨大文件；
- 是否重复安装重依赖；
- 是否影响开发循环。

超出仓库可接受范围时登记 P2，并给出缓存或拆分建议。

---

# 26. Documentation and Machine-readable Specification Sync

必须同步：

- `docs/README.md`；
- governance；
- Overall Design；
- leaf specs；
- state machines；
- OpenAPI；
- JSON Schema；
- Reference DDL；
- ADR；
- Open Questions；
- Roadmap；
- phase exit criteria；
- acceptance；
- capability matrix；
- operations；
- testing；
- delivery templates。

必须新增或确认：

```text
docs/13-acceptance/preparation-design-baseline.md
delivery/README.md
delivery/templates/phase-delivery-contract.md
delivery/templates/phase-charter-template.md
delivery/templates/entry-assessment-template.md
delivery/templates/phase-execution-and-closure-prompt-template.md
delivery/templates/implementation-plan-template.md
delivery/templates/design-delta-template.md
delivery/templates/risk-register-template.md
delivery/templates/decision-log-template.md
delivery/templates/work-package-template.md
delivery/templates/evidence-index-template.md
delivery/templates/closure-report-template.md
delivery/templates/handoff-manifest-template.yaml
delivery/templates/deferred-work-template.md
delivery/templates/defect-register-template.md
delivery/templates/acceptance-traceability-template.md
delivery/history/README.md
artifacts/generated/README.md
```

Preparation 阶段目录必须为：

```text
delivery/preparation/
├── 00-phase-charter.md
├── 01-entry-assessment.md
├── 02-execution-and-closure-prompt.md
├── 03-implementation-plan.md
├── 04-design-delta.md
├── 05-risk-register.md
├── 06-decision-log.md
├── 07-legacy-document-disposition.md
├── 08-current-implementation-guide-register.md
├── work-packages/
├── evidence/
├── 90-closure-report.md
├── 91-handoff-manifest.yaml
├── 92-deferred-work.md
├── 93-defect-register.md
└── 94-acceptance-traceability.md
```

---

# 27. Commit Strategy

推荐原子提交：

## Commit 1

```text
docs: adopt EnvForge integrated design baseline v1.2
```

包括：

- 文档安装；
- 旧文档迁移；
- docs index；
- Preparation Acceptance。

## Commit 2

```text
docs: close preparation architecture decisions
```

包括：

- ADR；
- Open Questions；
-相关事实源同步。

## Commit 3

```text
docs: bind design baseline to current repository
```

包括：

- Gap Matrix；
- current-code migration；
- Golden Build freeze；
- repository audit summaries。

## Commit 4

```text
tooling: validate EnvForge design specifications
```

包括：

- Markdown；
- Mermaid；
- OpenAPI；
- JSON Schema；
- Reference DDL；
- tool versions。

## Commit 5

```text
ci: enforce design baseline validation
```

包括：

- CI；
- local command；
- cache/lockfile；
- reports。

## Commit 6

```text
delivery: establish phase delivery governance
```

包括：

- contract；
- templates；
- Preparation delivery structure；
- Evidence index。

## Commit 7

```text
docs: migrate and classify legacy documentation
```

包括：

- disposition；
- Experience Design；
- current guides；
- history；
- generated policy；
- legacy link migration。

## Commit 8

```text
docs: close EnvForge preparation phase
```

包括：

- final validation；
- Closure Report；
- Handoff Manifest；
- Deferred Work；
- Defect Register；
- Acceptance Traceability。

允许更细拆分，不允许一个无关的大提交。

不得：

- force push；
- rewrite unrelated history；
- 自动 push，除非用户明确要求；
- 混入产品功能代码。

---

# 28. Stabilization Rules

进入稳定期后停止新增范围。

必须执行：

- clean checkout 或等价验证；
- full docs validation；
- Mermaid rerender；
- OpenAPI rebundle；
- JSON Schema rerun；
- DDL drop/recreate/reapply；
- baseline tests rerun；
- CI-equivalent local run；
- Secret scan；
- diff review；
- dead link and stale output review；
- evidence hash；
- flaky investigation；
- tool version confirmation；
- working tree review。

Preparation 稳定期不得新增新的总体设计主题。

发现新问题：

- P0/P1：修复后重新全量验证；
- P2/P3：登记 Deferred Work 和目标 Phase。

---

# 29. Acceptance Traceability

Preparation Acceptance ID：

| ID | Requirement |
|---|---|
| PREP-001 | Entry Assessment 为 ENTRY-PASS |
| PREP-002 | Integrated 包 Hash 和来源完整 |
| PREP-003 | Design Baseline 正式采用 v1.2 |
| PREP-004 | 设计文档进入实际仓库且项目新增文档未丢失 |
| PREP-005 | Source of Truth 无双重权威 |
| PREP-006 | 唯一路线为 Preparation + Phase 0–10 |
| PREP-007 | Canonical 术语和状态检查通过 |
| PREP-008 | ADR 状态和索引一致 |
| PREP-009 | OQ-002、OQ-003、OQ-004 已关闭 |
| PREP-010 | 其他 Open Questions 有 owner、deadline、impact |
| PREP-011 | Current-to-Target Gap Matrix 绑定真实代码 |
| PREP-012 | 当前 API/DB/执行/UI/测试完成审计 |
| PREP-013 | Markdown 验证通过 |
| PREP-014 | Mermaid 正式渲染通过 |
| PREP-015 | OpenAPI lint/bundle/example/codegen smoke 通过 |
| PREP-016 | JSON Schema 正反例通过 |
| PREP-017 | Reference DDL 在真实 PostgreSQL 通过 |
| PREP-018 | Golden Build v1 已冻结 |
| PREP-019 | Phase Delivery Contract 1.1 与模板落地 |
| PREP-020 | 设计验证进入 CI |
| PREP-021 | Baseline tests 已记录且无 Preparation 新回归 |
| PREP-022 | Security/Secret canary 通过 |
| PREP-023 | Performance/capacity baseline 已记录 |
| PREP-024 | 旧 docs 每个文件均有 disposition |
| PREP-025 | 稳定旧设计已合入目标事实源 |
| PREP-026 | Current Implementation Guides 已在当前 HEAD 重验证 |
| PREP-027 | Historical Evidence 已隔离且关键事实已重验证 |
| PREP-028 | Generated Artifacts 已移出 active docs 且可重建 |
| PREP-029 | Ephemeral Outputs 已移除或明确排除 |
| PREP-030 | `docs/15-experience` 与 Source of Truth Map 一致 |
| PREP-031 | Experience Traceability 建立 |
| PREP-032 | Capability Publication/Preview/Promotion 治理通过 |
| PREP-033 | 所有旧 active 文档引用已清理或有批准迁移桩 |
| PREP-034 | Document Migration Traceability 完整 |
| PREP-035 | 无 P0/P1；Atomic commits、Closure、Handoff 完整，Phase 0 输入形成 |

不得在没有当前证据时标记 PASS。

# 30. Closure Criteria

## 30.1 Work Package Verdict

每个 WP 使用：

```text
PASS
PASS-WITH-DEBT
FAIL
BLOCKED
NOT-APPLICABLE
```

`PASS-WITH-DEBT` 只允许 P2/P3，且必须包含：

- owner；
- target phase；
- due gate；
- risk；
- workaround。

## 30.2 Phase Verdict

### PASS

只有：

- PREP-001 至 PREP-035 全部 PASS；
- 所有 required WP PASS 或合规 N/A；
- 无 P0/P1；
- 没有 Secret 泄漏；
- 没有产品功能透支；
- Evidence 可重放；
- working tree 状态明确；
- Handoff 可供 Phase 0 使用。

输出：

```text
PASS — Ready to generate Phase 0 Execution and Closure Prompt
```

### PARTIAL

存在实质成果，但：

- 外部工具阻塞；
- Acceptance 未全部满足；
- 有未关闭 P1；
- Handoff 不足；
- 不能安全解锁 Phase 0。

输出：

```text
PARTIAL — Phase 0 remains locked
```

### FAIL

包括：

- Source of Truth 未解决；
- Phase 路线双重定义；
- P0；
- Secret 泄漏；
- DDL/OpenAPI 核心不可解析；
- Gap Matrix 无真实证据；
- 修改了生产行为；
- Closure 虚假；
- baseline 不可复现。

输出：

```text
FAIL — Preparation remediation required
```

下一 Phase 不得在 PARTIAL 或 FAIL 后开始。

---

# 31. Closure Report Format

必须填写：

```markdown
# EnvForge Preparation Closure Report

## 1. Result
PASS | PARTIAL | FAIL

## 2. Baseline
- repository:
- initial branch:
- initial HEAD:
- initial remote HEAD:
- initial working tree:
- design baseline:
- design package hash:
- delivery contract:
- toolchain:
- database:
- API version:
- schema version:
- baseline tests:

## 3. Entry Assessment
- verdict:
- blockers:
- allowed debt:
- evidence:

## 4. Scope Executed
- completed work packages:
- N/A work packages:
- omitted work:
- reasons:

## 5. Design Inputs
- documents read:
- hashes:
- source-of-truth result:
- conflicts found:

## 6. Design Deltas
| ID | Classification | Description | Decision | ADR/Defect | Status |
|---|---|---|---|---|---|

## 7. Repository Audit
- architecture:
- domain:
- API:
- database:
- execution:
- UI:
- artifact:
- security:
- observability:
- tests:
- CI:

## 8. Decisions Closed
| OQ | Decision | ADR | Affected Sources | Status |
|---|---|---|---|---|

## 9. Current-to-Target Gap
- mapped objects:
- high-risk gaps:
- authority transitions:
- compatibility adapters:
- feature flags:
- backfills:
- legacy retirement gates:

## 10. Documentation Adoption
- installed:
- migrated:
- superseded:
- archived:
- source-of-truth verification:
- terminology:
- phase route:

## 11. Legacy Documentation Migration
- disposition coverage:
- stable content extraction:
- retired active paths:
- compatibility stubs:
- document migration traceability:

## 12. Current Implementation Guides
| Guide | Verified Commit | Result | Retirement Phase | Evidence |
|---|---|---|---|---|

## 13. Historical Evidence Revalidation
| Historical Source | Historical Commit | Current Fact | Revalidation | Result | Evidence |
|---|---|---|---|---|---|

## 14. Generated Artifact Policy
- generated locations:
- generation commands:
- stale checks:
- historical snapshots:

## 15. Experience Design Adoption
- source-of-truth:
- traceability:
- current Web gap:

## 16. Capability Publication Governance
- certification model:
- preview/diff/review:
- promotion and enablement separation:

## 17. Machine-readable Validation
### Markdown
### Mermaid
### OpenAPI
### JSON Schema
### Reference DDL
### CI

For each:
- command
- tool version
- environment
- exit code
- result
- evidence
- SHA-256
- acceptance IDs

## 18. Golden Build Freeze
- target:
- runtime:
- fixture:
- dataset:
- secrets:
- verification:
- rollback:
- crash points:
- deferred scope:

## 19. Security Review
- authentication:
- authorization:
- workspace scope:
- secrets:
- redaction:
- SSH trust:
- artifact encryption:
- supply chain:
- findings:

## 20. Observability and Operations
- current state:
- validation tooling:
- runbooks:
- gaps:

## 21. Tests Executed
| Test ID | Command | Environment | Result | Evidence | Acceptance |
|---|---|---|---|---|---|

## 22. Failure-path Validation
| Scenario | Expected | Actual | Evidence | Result |
|---|---|---|---|---|

## 23. Performance and Capacity
| Check | Result | Evidence |
|---|---|---|

## 24. Acceptance Traceability
- total:
- passed:
- failed:
- blocked:
- traceability path:

## 25. Defects and Resolutions
| ID | Severity | Description | Resolution | Status | Target Phase |
|---|---|---|---|---|---|

## 26. Known Limitations
- ...

## 27. Deferred Work
- ...

## 28. Evidence Bundle
| ID | Path | SHA-256 | Classification | Acceptance |
|---|---|---|---|---|

## 29. Commits
| Commit | Description | Checks |
|---|---|---|

## 30. Final Repository State
- final branch:
- final HEAD:
- working tree:
- tests:
- design validation:
- CI-equivalent result:

## 31. Handoff Readiness
- manifest:
- Phase 0 inputs:
- blocking conditions:
- prompt generation:

## 32. Final Verdict
PASS | PARTIAL | FAIL
```

---

# 32. Handoff Requirements

必须创建：

```text
delivery/preparation/91-handoff-manifest.yaml
```

格式至少为：

```yaml
phase: preparation
verdict:
design_baseline: "1.2"
delivery_contract: "EF-DELIVERY-CONTRACT-001@1.1"
initial_head:
final_head:
schema_version:
api_version:
artifact_or_archive_format_versions: []
feature_flags: []
authoritative_write_paths: []
authoritative_read_paths: []
deprecated_paths: []
new_capabilities:
  - integrated-design-baseline-adopted
  - experience-design-baseline
  - capability-publication-governance
  - repository-gap-matrix
  - design-validation-ci
  - phase-delivery-governance
experience_baseline: []
legacy_document_migration: []
retired_document_paths: []
remaining_document_compatibility_stubs: []
current_implementation_guides: []
historical_evidence_used: []
historical_facts_revalidated: []
generated_artifact_policy: []
capability_publication_governance: []
certification_status: []
known_debt: []
open_questions: []
required_next_actions: []
blocking_conditions: []
phase_0_required_inputs:
  migration_tool:
  authentication_baseline:
  artifact_store_baseline:
  repository_paths: []
  current_database:
  current_api:
  baseline_test_commands: []
  accepted_adrs: []
evidence_index:
closure_report:
```

只有 Verdict 为 PASS 时：

```yaml
blocking_conditions: []
```

并允许：

```yaml
required_next_actions:
  - generate-phase-0-execution-and-closure-prompt
```

Handoff Manifest 是后续生成 Phase 0 Prompt 的首要输入。

---

# 33. Final Execution Instruction

现在执行 Preparation。

严格顺序：

```text
Entry Assessment
→ WP0 Baseline and Audit
→ WP1 Design, Decisions, and Invariants
→ WP2 Persistence and Data Migration Audit
→ WP3 Domain and State Machine Audit
→ WP4 Application Service Audit
→ WP5 API and Contract Validation
→ WP6 Runtime and Adapter Audit
→ WP7 UI Workflow Audit
→ WP8 Compatibility and Legacy Migration
→ WP9 Security and Audit
→ WP10 Observability and Operations
→ WP11 Tests, Failure Paths, Performance, Security
→ WP12 Documentation Synchronization
→ WP13 Stabilization, Closure, and Handoff
```

开始时必须：

1. 只读审计；
2. 清点项目已有 docs/delivery/artifacts，生成 Hash 和引用清单；
3. 运行 baseline tests；
4. 生成 Entry Assessment；
5. 生成 Implementation Plan、Legacy Disposition 和 Migration Traceability；
6. 确认 `ENTRY-PASS`；
7. 然后才修改文件。

遇到普通实现细节，依据事实源和仓库现状做最佳工程判断。

遇到以下事项必须停止对应修改并登记：

- 核心不变量变化；
- 产品范围变化；
- 安全边界变化；
- 聚合所有权变化；
- 生命周期语义变化；
- Phase 路线变化；
- Source of Truth 无法判定。

不得开始 Phase 0 产品功能。

最终目标：

```text
用真实仓库事实、正式决策、机器验证、完整证据、
Acceptance Traceability、Legacy Document Traceability、原子提交、Closure Report 和 Handoff Manifest，
证明 EnvForge 已达到可生成并执行 Phase 0 Prompt 的状态。
```
