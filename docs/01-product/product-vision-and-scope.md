---
id: EF-PROD-001
title: 产品愿景与范围
version: '1.1'
status: accepted
classification: normative
owners:
- product
- architecture
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-001
- ADR-005
source_of_truth_for:
- product vision
- scope
---


# 产品愿景与范围

EnvForge 是以 Workload 为中心的自托管 Linux 环境生命周期平台。它把服务器事实转化为可解释的 Blueprint，把用户决策编译成不可变 Plan，并通过持久 Run、验证和恢复证据证明结果。

## 要解决的问题

- 服务器换机不是磁盘复制：业务状态分布在软件、配置、数据、Secret、入口、任务和外部依赖中。
- 手工脚本缺少边界、审批、幂等、Checkpoint、回滚和证据。
- 备份成功不能证明业务可恢复。
- 目标启动不等于业务可用，流量切换不等于迁移提交。

## 核心价值

1. 可解释发现；2. 业务合同化；3. 确定性编译；4. 持久执行；5. 数据一致性；6. 单写 Cutover；7. 可证明恢复。

## v1 黄金范围

Ubuntu/Debian x86_64、Agentless SSH、systemd、Nginx、Node.js/Python、自定义二进制、PostgreSQL 14–16、Docker Compose local volume、filesystem、S3-compatible Archive、User Input/Target Existing/Regenerate Secret。

精确认证范围由 [`capability-support-policy.md`](capability-support-policy.md) 和 Support Matrix 决定。


## 产品体验承诺

EnvForge 的价值顺序为 `Insight → Explanation → Decision → Approval → Execution → Verification → Recovery Evidence`。首次用户应先获得只读 Assessment 价值，而不是被引导立即 Apply。完整体验合同见 [`15-experience/product-experience-principles.md`](../15-experience/product-experience-principles.md)。

## 差异化

- 相比 Ansible：EnvForge 从未知主机提取证据、确认业务边界并编译可审查合同；
- 相比 Terraform：EnvForge 关注现存主机内部 Workload、数据、Secret 和 Cutover；
- 相比 Server Panel：EnvForge 不提供绕过 Plan/Approval 的直接主机操作；
- 相比 Backup：EnvForge 保存和验证可重建合同，而不只复制字节。
