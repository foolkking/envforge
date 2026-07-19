---
id: EF-OPS-004
title: 控制面备份与恢复
version: '1.1'
status: proposed
classification: normative
owners: [operations, platform, archive]
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: [ADR-003, ADR-009]
source_of_truth_for: [control plane backup, control plane recovery]
---

# 控制面备份与恢复

> 本文命令为 reference runbook；实际命令必须由部署方式和已接受 migration 版本生成。

## 1. 保护范围

PostgreSQL（聚合、Run、Event、Audit、Artifact index）、Artifact Store、配置和公钥、OIDC/Vault/KMS provider references、Capability manifest/signatures。数据库备份不包含 Workload Secret 明文；Key Provider 自身按其产品灾备策略保护。

## 2. 目标

[建议方案] PostgreSQL RPO ≤ 15 分钟、RTO ≤ 2 小时；Artifact index 与对象一致性恢复后 30 分钟内完成 health scan。具体值在 Phase 9 SLO 评审冻结。

## 3. 备份操作

1. 验证 PITR/WAL archive 健康、上次 base backup 和 restore test。
2. 创建一致性 PostgreSQL base backup；保存 DB version、migration version、LSN 和 checksum。
3. 验证 Artifact Store versioning/replica 和 inventory export。
4. 导出非敏感部署配置、签名公钥、Capability catalog 和 provider reference。
5. 加密备份并写跨故障域；记录 `control-plane.backup.completed` Audit。

示例检查（illustrative）：

```bash
pg_isready
psql "$DSN" -c "select current_setting('server_version'), pg_current_wal_lsn();"
sha256sum backup-manifest.json
```

## 4. 恢复顺序

1. 宣告维护模式，阻止新命令和 Worker Claim。
2. 在隔离环境恢复 PostgreSQL 到目标时间点，验证 checksum/migrations。
3. 连接 Artifact Store，只读执行 inventory/head/hash sampling。
4. 启动 API read-only；禁止直接启动高风险 Worker。
5. 列出所有非终态 ControlPlaneOperation、ExecutionRun、WorkerLease 和 ResourceLease。
6. 启动 Recovery Coordinator；逐 Run inspect external state，分类 resume/retry/rollback/block。
7. 重建 Projection，并对比事件 sequence 和权威状态。
8. 执行安全/一致性 smoke tests 后逐步开启普通 Worker，再开启 Critical capability pool。
9. 形成 Recovery Report 和 Incident/Postmortem。

## 5. Archive 独立恢复

控制面永久丢失时，使用 Repository + Archive Header + Key Provider + Archive Reader 导入 EnvironmentArchive/ArchiveVersion。此过程必须验证 signature、manifest root、key availability 和 replica；不能从对象前缀猜测业务结构。

## 6. 演练

至少季度执行 PostgreSQL restore，半年执行“控制面全失 + Archive import”演练。演练保存时间、RPO/RTO、缺失对象、活动 Run recovery decision、Projection rebuild 和 Evidence Bundle。

## 7. 禁止事项

- 不在未知活动 Cutover 上直接启动新 Worker。
- 不通过修改 Run state 跳过 reconciliation。
- 不把控制面备份当作 Environment Archive 的唯一恢复方式。
