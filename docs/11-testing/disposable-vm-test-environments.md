---
id: EF-TEST-005
title: Disposable VM 测试环境
version: '1.1'
status: accepted
classification: normative
owners: [qa, platform, capability]
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: [ADR-005, ADR-006]
source_of_truth_for: [disposable VM fixtures]
---

# Disposable VM 测试环境

## 1. 固定镜像

至少覆盖 Ubuntu 22.04/24.04、Debian 12、x86_64。镜像以 digest 固定，初始化脚本和 fixture 数据版本化。VM 提供 systemd、Nginx、PostgreSQL 14–16、Docker Compose、Node.js/Python 示例应用。

## 2. 拓扑

- Build：Control Plane + 空 Target。
- Migration：Source + Target + Traffic Proxy/DNS stub + external probe。
- Archive：Source + S3-compatible store + isolated Restore Target。

网络支持注入延迟、断开、DNS 缓存和 provider timeout；磁盘支持容量限制和 bit corruption。

## 3. 生命周期

创建 → verify image/clock/SSH host key → seed data/secrets → run scenario → collect evidence → cleanup。失败 cleanup 产生告警，不允许残留生产 credential。

## 4. 可复现性

记录 image digest、kernel、package versions、fixture commit、random seed、time zone 和 Capability hash。CI 与本地运行使用相同定义。

## 5. 禁止替代

容器模拟不能替代 systemd、真实 filesystem ownership、SSH reconnect、PostgreSQL restore 和 host reboot 测试；可以用于快速单元/集成层，但认证必须经过真实 VM。
