---
id: EF-SUB-004
title: Secret Provider 模型
version: '1.1'
status: accepted
classification: normative
owners:
- security
- backend
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-009
source_of_truth_for:
- SecretProvider
- SecretProviderBinding
---


# Secret Provider 模型

## 类型

`user-input | target-existing | regenerate | vault | sops | out-of-band | cloud-secret-manager | envforge-managed-escrow | custom`。

v1 必做：User Input、Target Existing、Regenerate；Vault/SOPS 在 Golden Build 后按认证推进。Managed Escrow 不默认开放。

## Provider 接口

`capabilities, validateBinding, resolve, rotate?, revoke?`。SecretHandle 具有 expiry、scoped use callback 和 destroy。

## Binding

保存 requirement、provider config ref、provider secret/version ref、resolution mode、availability、rotation、fallback 和 status。Provider Config 只能保存非敏感参数和控制面 Credential 引用。

## Provider 特性

- User Input：一次性 token、no-store、request log 禁用、消费后销毁。
- Target Existing：只验证存在、权限和 consumer access，不返回明文。
- Regenerate：仅用于连续性允许的 Secret；结果应存入长期 Provider 或一次性揭示。
- Vault：处理 lease/renew/revoke/version。
- SOPS：受控内存解密，必要落盘只能 tmpfs。
- Out-of-band：结构化 Manual Gate + machine evidence。

## Shared Secret

共享 Secret 必须声明 owner、consumer 和 rotation coupling；同一 provider ref 使用资源锁，禁止多个 Plan 独立轮换。
