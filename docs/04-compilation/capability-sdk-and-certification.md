---
id: EF-COMP-008
title: Capability SDK 与认证
version: '1.1'
status: accepted
classification: normative
owners:
- architecture
- capability
- qa
- security
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-005
- ADR-006
source_of_truth_for:
- Capability SDK
- capability certification
---


# Capability SDK 与认证

## 分层接口

- `DetectionAdapter`：从 Snapshot/Evidence 产生正规化事实和关系。
- `PlanningAdapter`：兼容性、Action 模板、Dataset/Secret/Verification/Rollback 编译。
- `ExecutionAdapter`：precondition、execute、reconcile、postcondition、rollback、cleanup。

Adapter 不直接访问其他模块私有表；通过 Artifact Store、SecretHandle、ActionRuntimeContext 和 EvidenceWriter。

## Manifest

包含 ID、version、implementationHash、supported OS/runtime、mode dimensions、required privileges、resource keys、side-effect classification、resumability、certification evidence、SBOM/signature。

## 认证

分别认证 Detect/Build/Migrate/Capture/Restore/Verify/Rollback。认证需要 Golden Fixture、真实 VM、Crash Matrix、Redaction、权限最小化和已知限制。Plan 绑定认证版本；活动 Run 不自动升级。


## Package 最小构成

一个可发布 Package 至少包含 Manifest、文档、Fixture、positive/negative tests、权限和风险声明。成熟 Package 可以实现 Detection/Planning/Execution Adapter，但任何执行代码只能通过 Approved Plan 和 ActionRuntimeContext。

## 贡献者指南与旧实现

当前历史路径和命令记录于 [`capability-authoring-guide.md`](capability-authoring-guide.md)；旧 Runtime Catalog 记录于 [`current-capability-catalog-guide.md`](current-capability-catalog-guide.md)。二者是 informative，不能用于提高认证等级。

## 发布

认证完成后仍需经过 [`capability-publication-and-catalog-governance.md`](capability-publication-and-catalog-governance.md) 的 Preview、Review 和 Promotion。认证证据不等于自动启用。
