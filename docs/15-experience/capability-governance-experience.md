---
id: EF-EXP-008
title: Capability 治理体验
version: '1.1'
status: accepted
classification: normative
owners:
- product
- design
- capability
- security
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- capability governance user experience
---

# Capability 治理体验

## 1. 用户与管理员分离

普通用户只看到符合当前模式、目标环境和风险策略的 Capability 维度。管理员可以查看 experimental/preview、认证缺口、权限、Fixture 和 Promotion Draft。

## 2. 普通用户展示

Capability 必须按维度显示：

```text
detect | build | migrate | capture | restore | verify | rollback
```

每个维度显示：状态、版本、支持矩阵、限制、风险和认证证据。不得把总等级简化成“已支持所有迁移”。

## 3. Admin 信息架构

建议包括：

- Overview；
- Capability Registry；
- Certification Evidence；
- Preview and Diff；
- Promotion Requests；
- Policy/Standards；
- Contributors/Owners；
- Deprecated Versions。

Admin 不是目标主机包管理器，不提供任意安装/卸载入口。

## 4. Preview

Preview 是从已认证 package 生成的确定性审查 Artifact。界面必须明确：

- runtime unchanged；
- enabledByDefault=false；
- config catalog unchanged；
- no Plan approval；
- no Run created；
- no dynamic plugin loaded。

## 5. Promotion Draft

Promotion Request 只是 Draft，包含 diff、风险变化、权限变化、Gate 变化、支持维度和证据。Draft 必须经过明确 review/approval 才能进入受控发布流程。

## 6. Blocking

以下情况阻止 Promotion：

- Certification failed；
- official namespace publisher 不匹配；
- write permission 无 Gate；
- apply 无 Plan/Managed Execution boundary；
- required Gate 被移除；
- 风险被无证据降级；
- Secret canary 泄漏；
- rollback claim 超过证据；
- output 不确定或包含机器特定路径。

## 7. 历史

Capability version、preview、promotion、certification 和 deprecation 必须可审计。活动 Plan/Run 仍绑定旧版本，不自动升级。
