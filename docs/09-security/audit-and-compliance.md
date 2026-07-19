---
id: EF-SEC-008
title: 审计与合规
version: '1.1'
status: accepted
classification: normative
owners: [security, backend, operations]
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: [ADR-007, ADR-010]
source_of_truth_for: [AuditRecord, audit retention]
---

# 审计与合规

## 1. AuditRecord

记录 actor、workspace、action、resource、project/run、request/idempotency、before/after state hash、reason、approval reference、source IP/session、occurredAt 和 redacted metadata。Audit append-only，与高风险命令同事务或通过可靠事件生成。

## 2. 必审计操作

认证失败、权限拒绝、Host Key 变更、Blueprint confirm、Plan compile/approve/revoke、Run control、Secret bind/supply/rotate/revoke、Cutover start/commit/rollback、Archive key recovery/delete、Source Release、Break Glass、Policy 变化和管理员修复。

## 3. 不可包含

Secret 明文、Provider Token、私钥、数据库行、完整请求 body、解密 Manifest。对敏感 reference 使用 hash/opaque ID。

## 4. 不可抵赖性

Commit/Approval/Source Release 绑定 actor identity、step-up authentication、Plan/Manifest hash 和时间。高风险记录可周期性签名/导出到 WORM 存储。[建议方案] Phase 9 启用外部 SIEM export。

## 5. 保留与访问

保留由 Workspace Policy 和法规决定；Run/Commit/Security 记录不得因 Project archive 删除。Audit 读取需要独立权限，所有导出本身被审计。

## 6. 合规边界

EnvForge 提供控制和证据，不自动宣称符合某项法规。部署方负责数据地域、保留期、合法基础和访问流程；产品文档必须区分 capability 与 certification。

## 7. 验收

高风险命令成功/失败均有 Audit；Redaction 测试无 Secret；修改审计表被数据库权限阻止并告警；导出可验证 record count/hash chain。
