---
id: EF-COMP-002
title: Build Plan Compiler
version: '1.1'
status: accepted
classification: normative
owners:
- backend
- architecture
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-005
- ADR-008
- ADR-010
source_of_truth_for:
- BuildPlanCompiler
---


# Build Plan Compiler

## 范围

Build 从 Blueprint 在一个 Target 创建新的 Placement。不得生成 Source Drain、Initial/Final Sync、Source Resume 或权威转移。Dataset 来源仅允许 `empty | seed | uploaded | target-existing`。

## 阶段

```text
TARGET_PREFLIGHT → PREPARE_IDENTITY → PREPARE_STORAGE
→ INSTALL_RUNTIME → DEPLOY → CONFIGURE → INITIALIZE_DATA
→ BIND_SECRETS → ACTIVATE → VERIFY → EXECUTION_COMMIT → CLEANUP
```

## 典型字段映射

| 输入 | Action/Contract |
|---|---|
| Runtime package | InspectPackage → InstallPackage |
| systemd service | EnsureUser/Directory → InstallSystemdUnit → Reload → Enable/Start |
| Nginx endpoint | InstallNginxRoute → SyntaxCheck → Reload → HTTP/TLS Verify |
| PostgreSQL empty/seed | EnsureDatabase/Role → Apply Schema/Seed → DB Verify |
| Config | CaptureBeforeState → AtomicWriteConfig → Syntax/Postcondition |
| Secret | Secret Gate → Resolve → Materialize → Restart/Reload → Auth Verify |

## 冲突策略

目标已有资源默认 `block`，除非 DecisionSet 明确 `reuse | backup-and-replace | rename | manual`。Rollback 只删除本 Plan 创建的资源，恢复 before-state，不能卸载目标原有软件。

## Commit

Required Verification、Artifact Integrity 和 Rollback State 均满足后创建 `ExecutionCommitRecord(commitType=build)`；没有 Commit 不得创建成功 Placement。

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
