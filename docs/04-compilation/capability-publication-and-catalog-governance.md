---
id: EF-COMP-009
title: Capability 发布与 Catalog 治理
version: '1.1'
status: accepted
classification: normative
owners:
- architecture
- capability
- security
- qa
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-005
source_of_truth_for:
- capability publication
- catalog promotion governance
---

# Capability 发布与 Catalog 治理

## 1. 目的

定义 Capability Package 从开发、认证、Preview、Review 到显式 Promotion 的安全流程。该流程不是 Marketplace、远程 Registry 或动态第三方代码执行。

## 2. 生命周期

```text
draft package
→ local validation
→ certification evidence
→ deterministic catalog preview
→ human diff review
→ promotion request draft
→ approval
→ controlled publication
→ support matrix update
→ deprecation/retirement
```

## 3. Preview 合同

Preview 输入绑定 package ID/version/implementationHash、certification evidence 和 current catalog version。输出是不可变、确定性、脱敏 Artifact：

- operation: create/update/no-op/blocked；
- proposed capability dimensions；
- detect/service/workload mappings；
- permissions；
- required gates；
- risk changes；
- rollback/verification claim；
- before/after diff；
- blockers/warnings；
- `enabledByDefault=false`；
- `runtimeEnabled=false`。

Preview 不得修改 Runtime Catalog、Plan、Approval、Run 或目标主机。

## 4. Promotion Request

Promotion Request 是 Review Draft，不是发布命令。至少绑定：Preview Hash、target catalog version、reviewers、risk delta、permission delta、support dimension delta、evidence refs、expiry。

## 5. 阻断规则

- certification failed；
- namespace/publisher 不匹配；
-未声明 read/write/command permission；
- write 无 gate；
- execution 绕过 Plan/Managed Runtime；
-风险无证据降低；
- required verification/rollback 被移除；
- Secret Sentinel 命中；
- Artifact 非确定性；
-动态加载未经审核代码。

## 6. 发布

受控发布必须：

1. 验证 Preview Hash 未变化；
2. 验证目标 Catalog 未发生 material drift；
3. 记录 Approval；
4. 以原子方式写入版本化 Catalog；
5. 更新 Capability Support Matrix；
6. 执行 catalog/compiler regression；
7. 保留回滚到旧 Catalog version 的能力。

发布不会更新活动 Plan/Run；新 Plan 才能选择新版本。

## 7. 用户展示

普通用户只看到符合模式和风险策略的版本；管理员看到完整 evidence、preview、diff、promotion 和 deprecation。

## 8. 生成物

生成文件不得放入 active design docs。CI 生成物进入 `artifacts/generated/` 或 CI Artifact；若作为发布证据，必须绑定 commit、tool version、input hash 和 release ID。
