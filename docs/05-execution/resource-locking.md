---
id: EF-EXEC-007
title: 资源锁
version: '1.1'
status: accepted
classification: normative
owners:
- backend
- platform
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-004
source_of_truth_for:
- resource locking
---


# 资源锁

## 锁模型

`resource_lock_heads` 为每个 resource key 提供序列化头和 epoch；`resource_leases` 允许多个 read holder，write/exclusive acquisition 在锁住 head 后检查所有未过期 holder。

## 资源键

`endpoint`, `package-manager`, `systemd-daemon`, `config-path`, `service`, `dataset`, `postgres-cluster/database`, `docker-volume`, `traffic-route`, `secret-provider-ref`, `archive-version/object`。

## 顺序

默认锁序：`endpoint → shared-service → dataset → component → path`。Action 必须预声明所有 key，按规范排序获取；动态未知锁需释放后重规划，不能逆序追加。

## Lease

锁具有 fencing epoch 和过期时间。Recovery 可以回收，但外部副作用仍需 reconcile。Rollback 具有更高优先级，不得抢占不可中断 Action，只能在安全边界获得锁。
