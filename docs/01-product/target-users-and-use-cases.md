---
id: EF-PROD-002
title: 目标用户与使用场景
version: '1.1'
status: accepted
classification: normative
owners:
- product
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- target users
- use cases
---


# 目标用户与使用场景

## 目标用户

- 管理 1–数十台 Linux VPS 的个人开发者和小团队；
- 自托管网站、API、数据库和 Compose 服务的运维人员；
- 需要换机、复制环境、释放服务器成本或建立可验证恢复资产的用户；
- 需要审计、审批、可恢复执行和业务验证，而不是单次脚本的人。

## 关键场景

| 场景 | 用户目标 | 成功结果 |
|---|---|---|
| 了解旧服务器 | 找到业务、共享资源和遗漏风险 | Confirmed Workload Blueprint |
| 新建副本 | 在空目标重建服务 | Verified Build + Commit |
| 更换 VPS | 最小化停机并保留回滚窗口 | Cutover Commit + Source Retention |
| 暂停服务器费用 | 保存服务后删除源 VM | Source Release Commit |
| 灾难恢复 | 控制面或原主机丢失后恢复 | Imported Archive + Verified Restore |
| 合规审计 | 证明谁批准、执行和验证 | Immutable ReportArtifact + Audit Events |

## 用户体验原则

普通视图展示业务、阻塞项、停机和回滚能力；高级视图展示合同；专家视图展示 DAG、Hash、Checkpoint 和 Evidence。系统不得用“成功”掩盖部分验证、未知副作用或未满足的支持范围。
