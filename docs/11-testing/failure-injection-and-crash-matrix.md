---
id: EF-TEST-006
title: 故障注入与 Crash Matrix
version: '1.1'
status: accepted
classification: normative
owners:
- qa
- backend
- platform
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-004
- ADR-007
source_of_truth_for:
- failure injection
- crash matrix
---


# 故障注入与 Crash Matrix

| 注入点 | 故障 | 必须证明 |
|---|---|---|
| API command commit 前/后 | process kill | 幂等响应、不重复资源 |
| Worker claim 后 | kill -9 | Lease expiry、新 fencing、旧写拒绝 |
| Action side effect 后 receipt 前 | network loss | reconcile applied，不重放 |
| Checkpoint 前/后 | DB failure | 不虚报进度；可恢复 |
| Transfer part 中 | SSH drop | 目标 Hash 驱动 resume |
| Source quiesced 后 | Worker kill | 优先恢复/继续，不普通暂停 |
| Traffic API timeout | response loss | inspect source/target/mixed/unknown |
| Target writes 后 | verification fail | 先 freeze/reconcile 再 rollback |
| Archive upload/scrub | object corruption/key outage | degraded/repair/corrupt/unrecoverable 正确 |

Crash 测试必须保存 Run Event、Attempt、Checkpoint、external state 和 final report。
