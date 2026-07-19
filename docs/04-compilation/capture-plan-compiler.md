---
id: EF-COMP-004
title: Capture Plan Compiler
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
source_of_truth_for:
- CapturePlanCompiler
---


# Capture Plan Compiler

## 范围

Capture 生成不可变 ArchiveVersion；没有 Target Host 和 Traffic Switch。它必须保存未来无法可靠重新获取的 Deployment、Config、Dataset、Recovery Metadata 和 Secret Recovery Policy。

## 阶段

```text
SOURCE_PREFLIGHT → ARCHIVE_STORAGE_PREFLIGHT
→ CAPTURE_DEPLOYMENT_ARTIFACTS → INITIAL_DATA_CAPTURE
→ SOURCE_QUIESCE → FINAL_DATA_CAPTURE → CAPTURE_CONFIG/METADATA
→ BUILD_PRIVATE_MANIFEST → ENCRYPT/SIGN → REPLICATE
→ VERIFY_OBJECTS/KEY/REPLICAS → SCRUB/OPTIONAL_DRILL
→ SOURCE_RELEASE_READINESS
```

## 编译规则

- Capture readiness 是最严格模式；Critical Unassigned Evidence、未知加密密钥或 required Dataset 缺失为 Hard Blocker。
- Secret 默认保存 Requirement/Provider/Recovery Policy，不保存明文；Encrypted Escrow 需显式 Policy。
- Manifest 绑定 Blueprint、Dataset、Artifact、Consistency、Compatibility、Verification、Encryption 和 Hash。
- 上传成功不能生成 available；需要 Integrity/Replica Gate。

## 输出

Archive storage actions、Dataset capture contracts、Manifest/Encryption/Signature/Replica contracts、Scrub policy、Restore Requirements 和 Source Release Gates。

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
