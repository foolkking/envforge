---
id: EF-COMP-GUIDE-001
title: Capability 编写指南
version: '1.1'
status: accepted
classification: informative-current-implementation
owners:
- capability
- engineering
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- current capability contributor guide
current_implementation_as_of: '2026-07-19'
target_architecture_authority: false
verified_against_commit: a0a9a69cefc0888c32e9fb2ef3f5ca5416a4a254
retirement_phase: phase-10
---

# Capability 编写指南

> 本文包含当前代码基线的贡献者信息。Manifest 最终合同以 [`capability-sdk-and-certification.md`](capability-sdk-and-certification.md) 为准，当前路径和命令必须在 Preparation 中复核。

## 1. 历史目录约定

```text
capabilities/official/nginx/
├── capability.yaml
├── README.md
├── fixtures/
└── tests/
```

成熟实现可包含 detection、planning、execution、verification 和 rollback adapter，但不得把任意脚本直接暴露为公共 mutation API。

## 2. 当前历史路径

```text
capabilities/schema/capability.schema.json
apps/api/src/capability-certification.ts
apps/api/src/capability-catalog-preview.ts
```

历史命令：

```bash
npm run test:capabilities
npm run preview:capabilities
npm run test:golden
```

## 3. 开发流程

1. 定义 stable ID、publisher、version；
2. 只声明已有证据支持的能力维度；
3. 声明 OS/architecture/runtime；
4. 声明权限、资源键、Gate 和风险；
5. 提供 fixtures、negative cases、redaction canary；
6. 提供 plan/adapter contract tests；
7. 运行认证；
8. 生成 Preview；
9. 提交 Review，不自动启用。

## 4. 安全边界

- Collector 默认只读；
- Planning 只产生结构化合同；
- Execution 只在 Approved Plan 的 Worker Context 中运行；
- Secret 通过 SecretHandle；
- raw shell 需要 ReviewedCommandAction；
- package docs/fixtures 不得包含真实凭据。

## 5. 官方示例

旧基线包含 `official.nginx` 和 `official.postgresql`。它们是迁移参考，不自动代表新维度已经 `certified`；必须按新 Capability Matrix 重新认证。
