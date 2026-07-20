# EnvForge Post-Preparation Requirement Gap Addendum

## 1. Status

```yaml
id: EF-POST-PREPARATION-REQ-GAP-001
version: "1.0"
status: accepted-input-for-phase-0-to-10
preparation_reexecution_required: false
```

Preparation 已完成。本文件不修改 Preparation 的历史事实，只把原始换机需求与覆盖审计中确认的缺口作为 Phase 0–10 的强制增量基线。

## 2. Product Definition

EnvForge v1 的目标不是“扫描服务器并安装软件”，而是：

> 将服务器上的业务运行事实转换为用户可理解的 Workload、版本化 Blueprint 和不可变 Plan；由持久 Run 安全地重建软件、配置和服务期望状态，迁移数据和 Secret，处理临时运行状态，完成 Cutover、业务验证、观察和回滚；在没有目标服务器时，将环境封存为可校验、可导入、可长期恢复的 Archive。

## 3. Mandatory Product Modes

用户层：

```text
Analyze existing server
Build new environment
Migrate to another server
Save now and restore later
```

领域层：

```text
assessment
build
migration
capture
restore
```

Capture 与 Restore 是独立 Project，通过 EnvironmentArchiveRevision 关联。

## 4. Non-negotiable Object Boundaries

```text
Project = user lifecycle workspace
Snapshot = immutable observed facts
Candidate = reversible inference from one Snapshot generation
Workload = stable business identity
BlueprintRevision = immutable rebuild/runtime/data/verification contract
DecisionSetRevision = immutable user decisions
PlanRevision = immutable target-specific execution contract
ExecutionRun = durable execution instance
ReportArtifact = immutable evidence-based statement
ArchiveRevision = durable portable recovery asset
```

## 5. Mandatory User-goal Capabilities

1. 迁移项目早期绑定源与目标，目标 Snapshot 进入最终 Review 和 Plan；
2. 用户审批 Workload，不审批 package/port/raw Evidence；
3. 自定义 systemd/Compose 应用能够识别部署来源、配置、数据、Secret、域名、证书和定时任务；
4. 服务状态区分 desired、durable 和 ephemeral；
5. Dataset 是真实执行产品，包含估算、initial/final sync、quiesce、verification 和 resume；
6. Secret 是 Requirement → Provider Binding → Fetch → Injection → Validation → Cleanup/Rotation；
7. Cutover 是一等状态机，包含 authority、traffic、business verification、observation 和 rollback；
8. 执行持久、可恢复、可观察，浏览器和 Worker 重启不丢任务；
9. Preserve 可以在没有 Target 时完成；
10. Archive 自描述、加密、可 Scrub、可在空控制面导入；
11. Restore 每次针对新 Target 重新编译；
12. Source Release 是独立高风险动作，生产启用在 Phase 9；
13. Capability 支持必须按维度声明；
14. Build 广而全，Migration 少而深；
15. Golden 非冲突场景 required decisions 默认不超过 5；
16. UI 以 Project 和下一任务为中心；
17. T+1h/T+24h 和 Source Release 前进行长期复验；
18. Phase 10 逐项处置原始需求，不允许模糊“covered”。

## 6. Required Phase Corrections

```text
Phase 0  — baseline hashes, Project/Link/schema reservations, delayed work persistence
Phase 1  — full Project model, Placement, Runtime/Deployment/Config/Ephemeral contracts
Phase 2  — one active live Run, delayed verification, structured manual actions
Phase 3  — narrow Golden Build scope, Git/artifact reproducibility, full desired state
Phase 4  — target early, dual assessment, strong/weak relations, shared resources, custom app
Phase 5  — MigrationEstimate, writer ownership, exact PostgreSQL support boundary
Phase 6  — contract-derived quiesce, Compose migration, long-term verification, timeline UX
Phase 7  — source-only Preserve, portable Archive Header, empty-control-plane import
Phase 8  — Restore/release split, imported Archive Restore, production release disabled
Phase 9  — 9A reliability/security + 9B capability/product, Build breadth, SOPS/Vault
Phase 10 — original requirement traceability and final independent product E2E
```

## 7. Phase Entry Rule

每个 Phase Entry 必须验证：

- 本文件 Hash；
- Original Requirement Matrix Hash；
- 上一 Phase Handoff 中 `PH*-GAP-*` 结果；
- 无新增 P0/P1；
- 不把前一 Phase 的 PARTIAL 当成 PASS。

## 8. Phase Closure Rule

任何 Phase 只有在原 Acceptance 与本包新增 `PH*-GAP-*` Acceptance 均满足时才可 PASS。

## 9. Support Boundary

以下能力除非另有正式认证，不属于默认 GA：

- PostgreSQL logical replication/near-zero downtime；
- MySQL/MariaDB、Gitea、WordPress、Nextcloud、MinIO 深度迁移；
- 自动多云 DNS/LB/EIP；
- 跨 CPU 架构自动转换；
- 广泛 Linux 发行版；
- 整机镜像通用恢复；
- active-active；
- Marketplace/任意第三方插件。

它们必须在 Phase 10 标记为 Experimental、Deferred 或 Non-goal。
