---
id: EF-ACC-GOLD-001
title: Golden Build v1
version: '1.1'
status: accepted
classification: normative
owners:
- qa
- product
- engineering
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-004
- ADR-005
- ADR-006
- ADR-007
- ADR-010
source_of_truth_for:
- Golden Build acceptance
---

# Golden Build v1

## 1. 目的

证明 EnvForge 能够将一个已确认的 `WorkloadBlueprintRevision` 编译为不可变 Build Plan，经审批后由独立 Worker 在空目标机可靠执行，并以业务验证、`ExecutionCommitRecord` 和不可变 `ReportArtifact` 证明结果。

## 2. 固定 Fixture

| 项目 | 固定值 |
|---|---|
| 目标系统 | Ubuntu 24.04 LTS x86_64，最小安装 |
| 运行时 | Node.js 22 LTS 或 Python 3.12，测试运行固定一种 |
| 服务管理 | systemd |
| 入口 | Nginx |
| 数据库 | PostgreSQL 16 |
| 文件 Dataset | `/var/lib/envforge-golden/uploads` |
| 应用端口 | 仅监听 localhost 的固定测试端口 |
| Secret | User Input 数据库密码；Regenerate Session Secret |
| Verification | target-local、control-plane、external HTTP probe |
| 目标 before-state | 一个必须保留的用户、一个无关 package、一个无关 Nginx route 和一个受保护文件 |

Fixture 必须通过代码或版本化镜像构建，保存镜像版本、初始化脚本 Hash 和测试数据 Hash。

## 3. 输入合同

- 一个 `confirmed` 的 Blueprint Revision；
- 一个 finalized Target Snapshot；
- 一个 DecisionSet Revision；
- 所有 required Secret Provider Binding；
- Capability versions；
- Build Policy、Approval Policy 和 Verification Contract。

Plan 输入的 Revision ID、内容 Hash、Target Snapshot Hash、Capability version 和 Policy version 必须出现在 `PlanRevision.inputBindings`。

## 4. 正常流程

1. 创建 Build Project 并绑定 Target Endpoint；
2. 导入或人工确认 Blueprint Revision；
3. 采集 Target Snapshot；
4. 完成 Compatibility 和 Readiness；
5. 创建 DecisionSet Revision；
6. 编译 Build Plan，并验证相同输入产生相同 Plan Hash；
7. 提交审批并创建有效 PlanApproval；
8. `POST /plans/{planRevisionId}/runs` 创建 ExecutionRun；
9. Worker Claim、创建 Lease 并执行 Action DAG；
10. 在 Secret Gate 中提交一次性 Secret；
11. 完成 runtime、config、systemd、Nginx 和数据库初始化；
12. 执行 required Verification；
13. 创建一次且仅一次的 `ExecutionCommitRecord`；
14. 生成不可变 `ReportArtifact`；
15. 在目标快照副本上创建独立 Rollback Run，验证 before-state 恢复。

## 5. Required Action 范围

至少覆盖：

```text
InspectTarget
EnsureUser
EnsureDirectory
InstallPackage
DeployArtifact
WriteConfig
BindSecret
InstallSystemdUnit
ReloadSystemd
EnableService
StartService
InstallNginxRoute
ReloadNginx
VerifyProcess
VerifyHttp
VerifyDatabase
CommitBuild
```

每个 Action 必须绑定 Plan Action Key、Adapter Version、precondition、postcondition、resumability、retry/reconcile policy 和 rollback definition。

## 6. Required Verification

| 检查 | 通过标准 |
|---|---|
| Nginx syntax | `nginx -t` 成功，且 active config Hash 与 Plan Artifact 一致 |
| systemd | unit 为 active，MainPID 属于预期 cgroup，重启后可恢复 |
| HTTP | 外部探针返回预期状态、Header 和内容摘要 |
| PostgreSQL | 应用凭据连接成功，执行隔离 write/read/delete transaction |
| 文件 Dataset | 应用可创建、读取、删除测试文件，owner/mode 正确 |
| Artifact | 已部署 Artifact Hash 与 Plan 绑定值一致 |
| Secret | 日志、Event、Checkpoint、Report 和支持包中不存在 canary Secret |
| before-state | 无关用户、package、route 和受保护文件保持不变 |

Required Verification 失败不得创建 Commit Record。

## 7. 故障注入矩阵

每轮从干净 Fixture 重建，并至少在以下点终止 Worker：

- `WriteConfig` 产生副作用前；
- 配置写入后、Checkpoint 前；
- `BindSecret` 注入后、验证前；
- `StartService` 成功后、Action 响应前；
- `VerifyDatabase` 中；
- Commit 事务前；
- Rollback Action 中。

每轮验证：Lease 过期、Fencing 拒绝旧 Worker、Reconciliation 结果、重复副作用、Run 状态和 Report 真实性。

## 8. Rollback 断言

- 只删除本 Plan 创建的资源；
- 恢复配置和服务 before-state；
- 不卸载目标原有 package；
- 已存在用户和目录不被错误删除；
- 不能自动恢复的副作用必须输出 `partial` 或 `manual-required`；
- Rollback 使用独立 ExecutionRun，并引用原 Run Hash、完成 Action 和 before-state Artifact。

## 9. Evidence Bundle

必须保存：

- Blueprint、DecisionSet、Plan、Approval 的 ID 和 Hash；
- Run/Stage/Action/Attempt/Event 全量导出；
- Lease 和 Fencing 记录；
- before/after Snapshot 摘要；
- Verification Results；
- Secret canary 扫描报告；
- Commit Record；
- Rollback Report；
- Artifact Hash 清单；
- Fixture 和测试工具版本。

## 10. 判定

### PASS

正常轮只创建一个 Commit；所有 required Verification 通过；故障轮可安全恢复或明确阻塞；Rollback 符合分类；无 Secret 泄漏；Evidence Bundle 完整。

### PARTIAL

核心 Build 成功，但存在未解决的非 required Verification、手工 rollback 或证据缺口。PARTIAL 不允许声明 Golden Build Certified。

### FAIL

出现重复不可控副作用、虚假成功、Commit 条件绕过、before-state 破坏、Secret 泄漏或 Worker 接管错误。
