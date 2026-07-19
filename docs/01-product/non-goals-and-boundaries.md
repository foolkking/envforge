---
id: EF-PROD-005
title: 非目标与产品边界
version: '1.1'
status: accepted
classification: normative
owners:
- product
- architecture
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- non-goals
---


# 非目标与产品边界

EnvForge v1 不承诺：

- 自动理解并无损迁移任意私有软件；
- 默认零停机、双活、多主或跨地域数据库迁移；
- 取代 Kubernetes、Terraform、Ansible、完整 CMDB、APM 或企业备份套件；
- 无用户确认时执行高风险迁移；
- 保存源环境全部 Secret 明文；
- 运行未经审核的任意第三方 Shell 插件；
- 首期微服务化或全面 Event Sourcing；
- 对无限未来平台和格式提供绝对恢复保证。

## 责任边界

- EnvForge 证明其实际收集、执行和验证的内容，不证明未知或未授权资源。
- 用户负责外部 Provider 账户、第三方 SaaS 凭据和法律合规决策。
- `SourceReleaseCommitRecord` 表示满足当时 Policy，不是永久兼容保证。
- Manual Step 必须机器验证；无法验证时结果明确为 manual/unknown。
