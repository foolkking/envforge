---
id: EF-GOV-003
title: 设计事实源映射
version: '1.1'
status: accepted
classification: normative
owners:
- architecture
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-001
source_of_truth_for:
- source of truth mapping
---


# 设计事实源映射

## 权威映射

| 设计主题 | 唯一权威来源 | 说明 |
|---|---|---|
| 产品体验、信息架构和交互安全 | [`15-experience/README.md`](../15-experience/README.md) | 不重新定义领域/API；current implementation 文档为 informative |
| 产品模式、输入输出和边界 | [`01-product/product-modes.md`](../01-product/product-modes.md) | Overall Design 只做摘要 |
| 术语和 canonical names | [`terminology-and-naming.md`](terminology-and-naming.md) | 代码、DDL、API 必须一致 |
| 领域对象与不变量 | `03-domain/*.md` | 类型字段和关系由对象文件定义 |
| 正式状态和转换 | [`03-domain/state-machines.md`](../03-domain/state-machines.md) | Mermaid 仅为衍生视图 |
| Blueprint 编译 | `04-compilation/*.md` | 各 Compiler 文件分别权威 |
| Capability 发布与 Catalog Promotion | [`04-compilation/capability-publication-and-catalog-governance.md`](../04-compilation/capability-publication-and-catalog-governance.md) | Preview/Review/Promotion 安全边界 |
| 执行算法 | `05-execution/*.md` | Queue/Lease/Retry/Recovery 分文件权威 |
| Dataset/Secret/Cutover/Archive | `06-subsystems/*.md` | 对应领域文件定义对象，子系统文件定义算法 |
| 数据库逻辑模型 | [`07-persistence/database-schema-catalog.md`](../07-persistence/database-schema-catalog.md) | SQL 是阶段性 reference DDL，只有阶段接受后才可作为 migration 基线 |
| API 契约 | [`08-api/openapi/openapi.yaml`](../08-api/openapi/openapi.yaml) | 资源说明文档解释语义，不改变 OpenAPI |
| 安全控制 | `09-security/*.md` | Threat Model 与控制矩阵必须同步 |
| 运维步骤 | `10-operations/*.md` | 需要实际命令、回滚和证据 |
| 测试与认证 | `11-testing/*.md` | Acceptance 引用，不复制测试语义 |
| 唯一实施路线 | [`12-roadmap/implementation-roadmap-v1.md`](../12-roadmap/implementation-roadmap-v1.md) | Preparation + Phase 0–10 |
| 阶段退出证据 | `13-acceptance/*.md` | 不重新定义领域状态 |
| 决策理由 | `14-adr/*.md` | Accepted ADR 优先于旧说明 |

## 冲突优先级

1. Accepted ADR；
2. 对应主题的 accepted 叶子规范；
3. 已接受的 OpenAPI、数据库 migration 或机器可读 Schema；
4. Overall Solution Design 集成视图；
5. Roadmap、Acceptance、图和示例。

若较低层内容与更高层冲突，不允许静默修补。应创建 Design Defect，更新权威源、衍生文档和验证器。

## 当前实现与历史证据

- `current-*` 和 `*-guide` 文件若标记 `target_architecture_authority: false`，只描述旧代码基线；目标规范优先。
- `delivery/history/` 保留审计和旧 Phase 证据，不是事实源。
- `artifacts/generated/` 和 CI Artifact 是可重建输出，不手工维护。

## 可执行规范状态

- `openapi.yaml`：v1.1 API 设计契约，路径覆盖本版本已定义资源；未实施接口可通过 Capability/Phase 标记控制。
- `ddl/*.sql`：reference DDL。Phase Acceptance 通过并转换为仓库 migration 后，生产 migration 才是该版本实际数据库事实源。
