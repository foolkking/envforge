---
id: EF-TEST-008
title: Capability 认证
version: '1.1'
status: accepted
classification: normative
owners: [qa, capability, architecture, security]
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: [ADR-005, ADR-006]
source_of_truth_for: [capability certification evidence]
---

# Capability 认证

认证维度独立：Detect、Build、Migrate、Capture、Restore、Verify、Rollback。一个 Capability Detect Certified 不代表 Migration Supported。

## 1. 等级

`experimental -> preview -> supported -> certified -> deprecated`。只有 Certified 可用于默认自动高风险 Cutover；Preview 需要显式风险接受。

## 2. 必要证据

- supported OS/runtime/version matrix；
- Detection precision/recall fixture；
- deterministic compiler golden fixtures；
- Adapter Contract Suite；
- disposable VM E2E；
- crash/failure matrix；
- privilege/redaction/security tests；
- rollback classification evidence；
- known limitations 和 unsupported cases；
- implementation hash、SBOM、signature。

## 3. 版本规则

认证绑定 Capability implementation hash 和测试环境版本。扩展 supported range 或改变副作用语义需重新认证。活动 Run 固定旧版本；撤销版本阻止新 Plan/Run，但不改写历史报告。

## 4. 结果记录

`CapabilityCertificationRecord` 包含维度、等级、evidence artifact refs、test run IDs、reviewers、validity window、revocation reason。UI 支持矩阵直接读取该记录。

## 5. 失效

关键 CVE、数据损坏缺陷、错误 rollback 声明或测试环境不可复现会将认证降级/撤销，并触发受影响 Plan/Archive 查询和通知。
