---
id: EF-SEC-005
title: Secret 与密钥安全
version: '1.1'
status: accepted
classification: normative
owners:
- security
- backend
- archive
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-009
source_of_truth_for:
- secret security
- key management
---


# Secret 与密钥安全

## 分类

Control-plane Credential、Workload Secret、Archive KEK/DEK、Recovery Key 分开管理。普通数据库只保存 Provider 引用、wrapped key、fingerprint 和状态。

## 生命周期

create/import → validate → JIT resolve → scoped use → rotate/renew → revoke/destroy → audit。SecretHandle 使用后销毁；动态 Lease 到期前 renew 或重新 resolve。

## 存储和传输

TLS；临时文件优先 tmpfs/0600；禁止 argv/shell history；Provider Token 不进入 Workload Archive。Archive 使用 envelope encryption；wrapped DEK 可持久化，KEK 不在 Archive。

## 日志和支持包

结构化字段剔除、known value fingerprint、connection string/PEM/entropy 检测、长度限制。安全测试使用 Canary Secret，扫描 stdout/stderr/Event/DB/Artifact/Telemetry。
