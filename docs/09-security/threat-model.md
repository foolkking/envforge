---
id: EF-SEC-002
title: 威胁模型
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
- threat model
---


# 威胁模型

方法：STRIDE + 数据损失/恢复失败专项。每个威胁记录资产、攻击面、控制、验证和残余风险。

| ID | 威胁 | 影响 | 强制控制 | 验证 |
|---|---|---|---|---|
| T-001 | 账户劫持批准高风险 Plan | 远端破坏/数据丢失 | MFA、reauth、分离审批、Audit | 权限/E2E 测试 |
| T-002 | SSH MITM/Host Key 漂移 | 命令发到错误主机 | Host Key pinning、变更重新信任 | Adapter test |
| T-003 | 恶意/被篡改 Adapter | 任意命令/泄密 | 签名、Hash 绑定、SBOM、认证、禁动态插件 | Supply-chain test |
| T-004 | 旧 Worker 在 Lease 后继续写 | 双执行/状态破坏 | monotonic fencing、CAS、reconcile | Crash matrix |
| T-005 | Secret 出现在日志/Queue | 凭据泄漏 | JIT handle、redaction、no body logging | Canary secret scan |
| T-006 | Provider API 超时导致重复切流/轮换 | Split brain/锁死 | idempotency + inspect/reconcile | Fault injection |
| T-007 | Archive 对象替换/损坏 | 恢复失败 | ciphertext/plaintext hash、signature、replica/scrub | Corruption test |
| T-008 | Key Provider 永久不可用 | Archive unrecoverable | key availability test、recovery key、multi-domain policy | Restore drill |
| T-009 | 跨 Workspace IDOR | 数据/Secret 泄漏 | workspace-scoped FK/query、RLS gate、authz | Tenant tests |
| T-010 | Command injection | 远端执行 | structured Action、typed args、ReviewedCommand policy | Fuzz/security test |
| T-011 | Restore Drill 访问生产外部系统 | 支付/邮件/Queue 副作用 | egress isolation、sandbox provider、scheduler disabled | Drill isolation test |
| T-012 | 删除/retention 错误 | 永久数据丢失 | legal hold、two-person delete、reference check、deletion record | Delete rehearsal |

## 残余风险

Agentless SSH 不能提供远端硬件级 fencing；不支持的外部系统可能只能 manual verification；用户丢失唯一 Recovery Key 时无法恢复。这些必须在 Risk/Report 中明确。
