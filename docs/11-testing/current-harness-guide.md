---
id: EF-TEST-GUIDE-001
title: 当前 Harness 指南
version: '1.1'
status: accepted
classification: informative-current-implementation
owners:
- qa
- engineering
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- current legacy test harness guide
current_implementation_as_of: '2026-07-19'
target_architecture_authority: false
verified_against_commit: a0a9a69cefc0888c32e9fb2ef3f5ca5416a4a254
retirement_phase: phase-10
---

# 当前 Harness 指南

> 本文记录旧基线命令和 Fixture。最终测试合同以 `11-testing` 的 normative 文档和 `13-acceptance` 为准。

## 1. 历史命令

```bash
npm run test:golden
npm run harness:scenarios
npm run harness:scenario
npm run harness:target:check
npm run harness:certify
npm run harness:certify:dry-run
npm run harness:ubuntu:provision
npm run harness:register
npm run harness:ubuntu:destroy
```

Preparation 必须核实哪些命令仍存在、是否需要凭据以及是否会产生副作用。

## 2. 旧场景

历史场景覆盖 Nginx/Docker、Nginx/Caddy 冲突、Keycloak/Authelia、SSH hardening、Redis/PostgreSQL 数据策略和 LEMP/LAMP 组合。它们是测试资产来源，不自动等同新 Golden Build/Migration/Preserve Restore 验收。

## 3. Target 安全

Live Target 必须 disposable，能够证明不是生产主机，具备受控 SSH/sudo、无 package manager lock、网络可用和确定性 baseline。任何 production marker、未知用户数据或破坏风险都必须拒绝。

## 4. 报告

Timestamped Harness 输出是本地/CI Artifact，不是 durable docs。发布证据必须绑定 commit、Fixture、target image、commands、redaction scan 和 verdict。

## 5. 迁移要求

- 将旧 Fixture 映射到新 Acceptance ID；
- 补充 Durable Worker、Checkpoint、Secret、Dataset、Cutover、Archive 和 Restore failure injection；
- 临时失败 summary 不进入 active docs；
- 旧“Full Migration Certified”结果按新维度重新认证。
