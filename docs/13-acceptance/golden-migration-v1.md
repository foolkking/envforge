---
id: EF-ACC-GOLD-002
title: Golden Migration v1
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
- ADR-011
source_of_truth_for:
- Golden Migration acceptance
---

# Golden Migration v1

## 1. 目的

证明 EnvForge 能在明确停机窗口内，将一个有状态 Web Workload 从 Source 迁移到 Target，并以 Dataset Commit、Write Authority、Traffic Evidence、Business Verification、Observation 和 `CutoverCommitRecord` 证明目标已成为权威环境。

## 2. 固定 Fixture

| 项目 | 固定值 |
|---|---|
| Source/Target | Ubuntu 24.04 x86_64 |
| Workload | Nginx + systemd app + PostgreSQL 16 + uploads + timer |
| Source 数据 | 固定数据库行、文件对象和可校验业务摘要 |
| 持续写入 | 版本化写入模拟器，记录 transaction/file sequence |
| 流量 | Nginx Provider；结构化手工 DNS 作为第二轮 |
| 探针 | target-local、control-plane、至少两个 external probes |
| Observation | 最少 15 分钟，30 秒采样 |
| 源保留 | Commit 后至少 24 小时的测试策略 |

## 3. 前置条件

- Source Workload 已由 Candidate Review 形成 confirmed Blueprint；
- Source/Target Snapshot finalized；
- Migration Readiness 为 planner-ready；
- initial filesystem sync 完成；
- PostgreSQL 最终完整事务一致 dump/restore 所需时间已测量；
- required Secret 可获得；
- Traffic before-state 可读取；
- Source Resume 和 Rollback Plan 已通过预检。

## 4. 正常流程

1. 编译、审批 Migration Plan；
2. 准备 Target runtime、config、Secret 和被动服务；
3. 执行 uploads initial sync；
4. 执行 PostgreSQL restore rehearsal，不把第二次 `pg_dump` 描述为增量；
5. 等待 Maintenance Window；
6. Drain 新请求、暂停 timer/worker，并等待 active work 达到阈值；
7. 撤销 Source Write Authority，验证 writer 已 quiesced；
8. 执行最终事务一致 PostgreSQL dump/restore 和 uploads final sync；
9. 为所有 required Dataset 创建 Dataset Commit；
10. 被动启动 Target 并完成 pre-authority 验证；
11. 授予 Target Write Authority；
12. 切换 Nginx route 或完成结构化手工 DNS；
13. 执行业务 read/write/delete 与文件上传交易；
14. 启动 Target Write Monitor；
15. 完成 Observation；
16. 创建一次且仅一次的 Cutover Commit；
17. 启用 Target timer，进入 Source Retention。

## 5. 必须证明的安全不变量

- Source 与 Target 的权威写入区间不重叠；
- Final Sync 仅在 Source Authority 为 `none` 后执行；
- 所有 required Dataset Commit 先于 Target Authority 和 Commit；
- Traffic Switch 不等于 Commit；
- DNS mixed propagation 期间 Source 只能代理、只读或维护，不能独立写；
- 无 `CutoverCommitRecord` 时 UI/API/Report 不显示 Migration Completed；
- Target 新写入能够被高置信度检测，或 Rollback 自动降级为 manual。

## 6. Required Verification

- Source baseline 与 Target 业务响应对比；
- PostgreSQL schema、extensions、selected row count、sequence 和业务 transaction；
- uploads Manifest 和应用读写；
- external HTTP/TLS；
- Nginx active route；
- timer 在 Commit 前 disabled、Commit 后仅 Target enabled；
- Source Resume 测试；
- Target Write Monitor；
- Observation 中成功率、延迟、重启、数据库错误和 backlog。

## 7. 故障注入

至少覆盖：

- Drain 超时；
- Source quiesced 后 Worker 崩溃；
- final transfer 中断；
- PostgreSQL restore 成功但响应丢失；
- Target 启动失败；
- Traffic Provider 请求超时且结果未知；
- Post-switch required Verification 失败；
- Observation 中错误率越界；
- Rollback 中 Worker 崩溃。

Recovery Coordinator 必须读取真实 Source、Target、Dataset 和 Traffic 状态，而不是只信任数据库 state。

## 8. Rollback 演练

### 场景 A：Traffic 已切换但无目标新写入

冻结 Target → 撤销 Target Authority → 恢复 Source → 验证 Source → 切回流量 → 外部验证。

### 场景 B：已检测到目标新写入

冻结 Target → 计算 Data Reconciliation → 执行 reverse-sync/export-import 或标记 manual → 用户确认数据损失策略 → 恢复 Source → 验证。

禁止先切回流量、后处理数据。

## 9. Evidence Bundle

包含 Plan/Approval Hash、Dataset Runs/Commits、Consistency Checkpoint、Authority Records、Traffic before/after Snapshot、external probe、Target Write observations、Observation samples、Commit/Rollback Record、Source retention 和完整 Event Timeline。

## 10. 判定

### PASS

正常迁移成功且 Commit once-only；故障轮安全继续、恢复 Source 或进入明确 manual；无 split brain；数据验证和业务验证通过；证据完整。

### PARTIAL

迁移完成但自动 rollback、DNS 传播或 Target Write detection 仅达到 manual/low confidence。不得标记 Migration Certified。

### FAIL

出现权威写入重叠、Final Sync 顺序错误、虚假完成、不可解释数据丢失、Traffic 不确定仍盲目继续，或 Source 无法按合同恢复。
