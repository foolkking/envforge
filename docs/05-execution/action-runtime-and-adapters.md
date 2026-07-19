---
id: EF-EXEC-003
title: Action Runtime 与 Adapter
version: '1.1'
status: accepted
classification: normative
owners:
- backend
- capability
- security
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-006
- ADR-007
source_of_truth_for:
- ActionRuntime
- ExecutionAdapter
---


# Action Runtime 与 Adapter

## Runtime Context

提供只读 PlanAction、Run/Attempt ID、fencing token、Deadline、Cancellation Token、Artifact Port、SecretHandle Port、Endpoint Session、Evidence Writer 和 Structured Logger。

## Adapter 合同

```ts
interface ExecutionAdapter<I,R> {
  inspect(ctx, input:I): Promise<ObservedState>;
  precondition(ctx, input:I): Promise<CheckResult>;
  execute(ctx, input:I): Promise<ExecutionReceipt<R>>;
  reconcile(ctx, input:I, receipt?:PartialReceipt): Promise<ReconcileResult>;
  postcondition(ctx, input:I, receipt:R): Promise<CheckResult>;
  rollback?(ctx, beforeState, receipt): Promise<ExecutionReceipt>;
  cleanup?(ctx, receipt): Promise<void>;
}
```

## Receipt

Receipt 不含 Secret，必须包含 idempotency identity、observed external identifiers、before/after state hash、Artifact refs、side-effect classification 和 Adapter version。

## 命令执行

优先结构化系统 API。`ReviewedCommandAction` 是例外：固定 Artifact、参数 Schema、禁止 Secret argv、redaction、timeout、working directory、expected exit/postcondition、rollback 和审批 Gate。

## 权限

Adapter 声明最小 sudo command/resource 范围。Worker 不提供通用 root shell。临时文件使用受控目录、权限和 cleanup evidence。
