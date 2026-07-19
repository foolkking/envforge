---
id: EF-COMP-001
title: Blueprint 编译总览
version: '1.1'
status: accepted
classification: normative
owners:
- architecture
- backend
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-008
source_of_truth_for:
- PlanCompiler
- blueprint compilation
---


# Blueprint 编译总览

## 目标

将一个或多个 Confirmed `WorkloadBlueprintRevision`、`DecisionSetRevision`、Source/Target Snapshot 或 ArchiveVersion、Compatibility Result、Capability Catalog 和 Policy 编译为不可变 `PlanRevision`。

```ts
interface PlanCompilerInput {
  projectId: string;
  projectType: 'build'|'migration'|'capture'|'restore';
  workloadBlueprintRevisionIds: string[];
  decisionSetRevisionId: string;
  sourceSnapshotRef?: HashRef;
  targetSnapshotRef?: HashRef;
  archiveVersionRef?: HashRef;
  compatibilityResultRef?: HashRef;
  capabilityCatalogRef: HashRef;
  policyRef: HashRef;
}
```

## 统一编译阶段

1. Validate immutable input bindings and readiness.
2. Resolve Workload dependency graph and selected scope.
3. Resolve target/archive compatibility and conflicts.
4. Resolve DecisionSet and risk acceptances.
5. Select certified Capability implementations and versions.
6. Compile resource intents and system identities.
7. Compile DatasetExecutionContracts.
8. Compile SecretExecutionContracts.
9. Compile runtime, traffic and Cutover contracts as applicable.
10. Compile Verification and Rollback contracts.
11. Build stages, PlanActions, dependencies, gates and locks.
12. Canonicalize, validate, hash and persist compiler trace.

## Blueprint 字段映射

| Blueprint contract | Plan output |
|---|---|
| Identity/SystemIdentity | Inspect/Create/Map user/group/UID/GID actions |
| Runtime | Runtime install、service definition、enable/start/readiness |
| Deployment | Package/Git/Artifact/OCI/Compose actions |
| Config | copy/template/merge/regenerate/reuse/manual + backup/atomic write/syntax/rollback |
| Dataset | DatasetExecutionContract + stage gates，不以命令文本替代 |
| SecretRequirement | SecretExecutionContract + provider binding + availability gate |
| Endpoint | port/firewall/proxy/TLS/DNS intents |
| ScheduledTask | install disabled、source pause、post-commit enable |
| Dependencies | DAG edge、stage gate、resource lock |
| EphemeralState | drain/quiesce/checkpoint/rebuild/discard/manual |
| CompatibilityEnvelope | preflight、conversion、blocker、risk |
| Verification | pre/post action、pre/post cutover、observation、final checks |
| Recovery | before-state、rollback action、irreversible classification |

## 编译结果

`compiled | review-required | blocked`。Blocked 不创建可执行 Plan。Review-required Plan 可被审查，但只有清除 required review 后才可 submit approval。

## 确定性

相同 canonical input、Compiler Version、Capability Implementation Hash 和 Policy 产生相同 Plan Hash。时间、随机 ID 和显示顺序不得进入 Hash；PlanAction IDs 使用稳定派生键。

## 伪代码

```text
validate(input)
ready = evaluateReadiness(input.blueprints, input.mode)
if ready.blocked: return blocked(ready.blockers)
graph = resolveWorkloadGraph(input.blueprints)
compat = resolveCompatibility(graph, targetOrArchive)
decisions = applyDecisionSet(compat, input.decisionSet)
capabilities = selectCapabilities(graph, decisions, catalog, policy)
contracts = compileContracts(graph, decisions, capabilities)
dag = buildAndValidateDAG(contracts)
plan = canonicalize(bindings, contracts, dag, gates, risks, trace)
return persistImmutablePlan(plan, sha256(plan))
```
