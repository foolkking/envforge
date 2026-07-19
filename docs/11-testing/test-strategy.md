---
id: EF-TEST-001
title: 测试策略
version: '1.1'
status: accepted
classification: normative
owners:
- qa
- architecture
- security
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-005
- ADR-007
source_of_truth_for:
- test strategy
- release evidence
---


# 测试策略

## 目标

证明领域不变量、确定性编译、持久执行、数据完整性、安全边界和真实恢复，而不只证明代码路径被调用。

## 测试层次

| 层次 | 证据 | 发布门禁 |
|---|---|---|
| Unit/Property | 不变量、Hash、DAG、策略 | 每次 PR |
| State Machine | 合法/非法转换矩阵 | 每次状态变化 |
| Compiler Golden | 固定输入→Plan/Hash | Compiler/Capability 变更 |
| Adapter Contract | inspect/execute/reconcile/rollback/redaction | Capability 晋级 |
| PostgreSQL/API Integration | 约束、事务、幂等、权限 | 每次 Phase |
| Disposable VM | 真实 SSH/systemd/Nginx/DB/Docker | Supported/Certified |
| Failure Injection | crash/network/provider/disk | Durable/Cutover/Archive Gate |
| Security | authz、Secret canary、supply chain | Release |
| E2E Golden | Build/Migration/Preserve Restore | Phase Exit |

## Evidence Bundle

每次 Phase Acceptance 保存：commit、config/fixture version、test commands、machine image/digest、Run/Plan/Report Hash、failure injection results、logs（脱敏）、limitations 和 PASS/PARTIAL/FAIL。

测试全绿不等于 Capability Certified；认证还要求真实支持矩阵和已知限制。


## 旧 Harness 迁移

旧命令、场景和 disposable-target 规则保留于 [`current-harness-guide.md`](current-harness-guide.md)，仅作为当前实现说明。历史 Fixture 必须映射到 Acceptance ID 后才能作为新 Phase 证据；timestamped run output 默认属于 CI Artifact，不进入 active docs。
