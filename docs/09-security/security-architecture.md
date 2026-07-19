---
id: EF-SEC-001
title: 安全架构
version: '1.1'
status: accepted
classification: normative
owners:
- security
- architecture
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-006
- ADR-007
- ADR-009
source_of_truth_for:
- security architecture
- security control baseline
---


# 安全架构

## 安全目标

1. 保护 Plan/Run/Commit/Audit 权威状态不被越权修改；
2. Secret、SSH Credential、Archive Key 不进入非授权持久化面；
3. 阻止未审批、越范围或未知副作用的远端操作；
4. 保证高风险操作可归责、可验证和可恢复；
5. 控制 Capability/Adapter 供应链风险；
6. 在控制面或单个存储副本失效时保持恢复能力。

## 资产等级

| 资产 | 等级 | 典型控制 |
|---|---|---|
| Workload Secret、KEK/DEK、SSH Credential | Critical | JIT、KMS/Vault、短租约、禁止日志 |
| Plan Approval、Commit、Write Authority | Critical | RBAC、MFA、once-only、Audit、Hash |
| Dataset/Archive Artifact | High/Critical | 加密、Hash、Replica、Scrub、retention |
| Snapshot/Evidence/路径/域名 | High | workspace isolation、加密/最小展示 |
| Run Event/Report | High | append-only、redaction、immutable artifact |

## 分层控制

- Identity Plane：OIDC/本地账户、MFA、短 Session、reauth。
- Control Plane：RBAC/ABAC、CAS、idempotency、audit、policy。
- Execution Plane：Worker identity、fencing、structured actions、least privilege。
- Secret/Key Plane：Provider refs、SecretHandle、envelope encryption。
- Artifact Plane：atomic publish、content/stored hash、repository policy。
- Supply Chain：signed build、SBOM、pinned Adapter、certification。

## 安全门禁

安全要求必须进入 Compiler Gate、Execution preflight、Commit Gate 和 Capability Certification，而不是仅写在运维手册。
