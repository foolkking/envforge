---
id: EF-ACC-003
title: Phase 2：Durable Execution 验收
version: '1.1'
status: accepted
classification: normative
owners:
- qa
- architecture
- engineering
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- Phase 2 acceptance
---

# Phase 2：Durable Execution 验收

## 目标

证明 Approved Plan 在独立 Worker 中可靠执行，API/Worker 崩溃不会丢失或盲目重复副作用。

## 固定环境

- PostgreSQL Queue；
- 两个 Worker；
- InspectTarget/EnsureDirectory 测试 Adapter；
- 可模拟 applied/partial/unknown 的远端 fixture。

## 执行步骤

1. 记录仓库 HEAD、设计版本、migration version、Capability manifest 和 Feature Flags。
2. 从干净环境部署/升级本 Phase 产物。
3. 执行基线和成功路径。
4. 执行并发、重放、权限和故障注入。
5. 收集 Evidence Bundle，执行清理并确认无敏感材料残留。

## 必须通过

- Claim 使用 SKIP LOCKED；同一 Run 单一有效 Lease；
- fencing 单调，旧 Worker 写入被拒绝；
- Queue row Claim 不删除，终态正确；
- Pause/Resume 经 checkpoint 和 requeue；
- Cancel/Retry/Blocked 符合状态机；
- unknown outcome 必须 reconcile；
- Report 只包含实际 Event/Attempt/Verification。

## 故障注入

- Action 前、side effect 后、receipt 前、checkpoint 前/后 kill Worker；
- Heartbeat 丢失；
- 两 Worker 同时 Claim；
- DB 响应丢失。

## Evidence Bundle

- Run/Action/Attempt/Event/Checkpoint rows、external state、fencing rejection、SSE replay、ReportArtifact。

## 非目标

完整 systemd/Nginx/PostgreSQL Build、Dataset、Cutover。

## 判定

- **PASS**：全部 required 检查和故障断言通过，无 P0/P1 安全或数据风险。
- **PARTIAL**：仅非关键 optional 项失败；不能解锁依赖此能力的生产声明。
- **FAIL**：任何 required、数据完整性、Secret、状态机或恢复断言失败。
