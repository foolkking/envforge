---
id: EF-ARCH-007
title: 信任边界
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
- ADR-009
source_of_truth_for:
- trust boundaries
---


# 信任边界

| 边界 | 受保护资产 | 主要威胁 | 强制控制 |
|---|---|---|---|
| Browser ↔ API | Session、审批、Secret 输入 | CSRF、重放、XSS、日志泄漏 | TLS、CSRF、MFA/reauth、no-store、一次性 Token |
| API ↔ PostgreSQL | Plan/Run/Audit 权威状态 | SQL 注入、越权、篡改 | 参数化 SQL、workspace scope、最小 DB role、备份 |
| Worker ↔ PostgreSQL | Claim/Lease/Checkpoint | 旧 Worker 写入、双执行 | claim token、monotonic fencing、CAS |
| Worker ↔ Endpoint | SSH Credential、目标副作用 | MITM、命令注入、权限滥用 | Host Key、结构化 Adapter、sudo allowlist、审计 |
| Worker ↔ Secret Provider | Workload Secret | 明文持久化、Token 泄漏 | JIT handle、短租约、redaction、revoke |
| Archive Service ↔ Repository/KMS | Archive 内容、DEK | 替换、损坏、Key loss | Hash、Signature、Envelope Encryption、Scrub |
| Capability Supply Chain | 可执行 Adapter | 恶意更新、版本漂移 | 签名、版本绑定、认证、SBOM、禁用任意插件 |

信任边界的控制和验证方法由 `09-security` 细化。
