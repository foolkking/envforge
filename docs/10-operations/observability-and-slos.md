---
id: EF-OPS-002
title: 可观测性与 SLO
version: '1.1'
status: proposed
classification: normative
owners: [operations, platform, product]
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: [ADR-004, ADR-007]
source_of_truth_for: [observability, SLO]
---

# 可观测性与 SLO

## 1. SLI

| 领域 | SLI |
|---|---|
| API | command availability/latency、4xx/5xx、idempotency conflict |
| Queue | depth、oldest age、claim latency、starvation |
| Worker | heartbeat age、lease expiry、fencing rejection、recovery time |
| Action | duration、retry/reconcile/unknown outcome、rollback result |
| Transfer | verified throughput、part retry、checksum mismatch、ETA error |
| Secret | provider availability、lease renewal、cleanup failure、leak incident |
| Cutover | critical section duration、downtime budget、rollback deadline、authority unknown |
| Archive | complete replicas、scrub age/failure、repair latency、key availability、drill age |

## 2. 建议 SLO

[建议方案] 控制面月可用性 99.9%；接受的 command 不丢失；Critical lease expiry 60 秒内检测、5 分钟内进入恢复决策；Archive health 15 分钟内更新；Secret plaintext log incidents = 0。具体预算在 Phase 9 基于容量测试冻结。

外部 SSH/DNS/Vault/S3 可用性不计入平台 availability，但应单独记录 dependency SLI 和 Report limitation。

## 3. Error Budget

超预算时暂停非必要功能发布，优先修复可靠性。数据完整性、Secret 泄漏、错误 Commit 不允许用普通 error budget 接受。

## 4. Dashboard

Global health、Queue/Worker、Critical Runs、Provider、Archive health、Security alerts。Run ID 等高基数维度放 Timeline/Trace，不作为 Prometheus label。

## 5. Alert

SEV-1：split brain、wrong authority、archive unrecoverable、secret leak、commit without gates。SEV-2：critical run blocked/lease expired、replica below minimum、scrub failed。告警包含 runbook link 和 correlation ID。

## 6. 验收

通过故障注入证明指标和告警在目标检测时间内出现，Run Timeline 能从 Event 重建，Dashboard 不泄露 Workspace/Secret 高基数信息。
