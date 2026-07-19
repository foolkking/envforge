---
id: EF-COMP-005
title: Restore Plan Compiler
version: '1.1'
status: accepted
classification: normative
owners:
- backend
- archive
- architecture
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-008
- ADR-009
- ADR-010
source_of_truth_for:
- RestorePlanCompiler
---


# Restore Plan Compiler

## 范围

Restore 消费一个特定 ArchiveVersion，并针对当前 Target Snapshot 重新编译。不得重放 Capture Actions。

## 阶段

```text
VERIFY_ARCHIVE → TARGET_PREFLIGHT → RESOLVE_COMPATIBILITY
→ PREPARE_TARGET → RECONSTRUCT_DEPLOYMENT_ARTIFACTS
→ INSTALL_RUNTIME → RESTORE_CONFIG → RESTORE_DATASETS
→ BIND_SECRETS → ACTIVATE_DEPENDENCIES/APPLICATION
→ VERIFY_DATA → VERIFY_BUSINESS → OBSERVE
→ EXECUTION_COMMIT → CLEANUP
```

## 编译规则

- Manifest Root、Signature、Key Availability、required objects 和 Reader Version 必须验证。
- Archive Artifact 优先；允许的升级/转换必须成为显式 Action、Risk 和 Rollback Limitation。
- Required Secret 必须有可用 Provider/Recovery Strategy。
- 部分恢复必须解析依赖；排除 required Dataset 时只能标记数据提取或 incomplete，不能成功恢复 Workload。
- 没有原 Source 回滚；Rollback 仅恢复 Target before-state。

## Commit

Required Dataset/Business Verification 与 Observation 满足后创建 `ExecutionCommitRecord(commitType=restore)`。

## 输入绑定

所有输入保存 ID + Hash；Capability 保存 implementation version/hash 和认证范围。任何 Material Drift、绑定 Artifact 过期或 Policy 变化均要求新 Plan Revision。

## 输出结构

- `planStages`
- `planActions` 与 `planActionDependencies`
- `datasetExecutionContracts`
- `secretExecutionContracts`
- 模式特定 Contract
- `verificationExecutionContract`
- `rollbackExecutionContract`
- `manualSteps`
- `gates, risks, limitations, estimates, compilerTrace`

## 错误与 Gate

- Hard Blocker：不能由风险接受绕过。
- Review Required：需要明确人工决定，决定后新 DecisionSet/Plan Revision。
- Warning：可以继续，但必须进入 Plan Review 和 Report。
- Compiler Internal Error：不创建 Plan；保存脱敏诊断和 input hash。

## 测试

每个 Compiler 必须有 Golden Fixture：固定输入、期望 Action/Edge/Contract、Plan Hash、Gate、Risk 和 Rollback；Property Test 验证 DAG 无环、required contract 有实现、Hash 稳定且输入敏感。
