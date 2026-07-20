---
id: EF-OPS-GUIDE-001
title: 当前运行时运维指南
version: '1.1'
status: accepted
classification: informative-current-implementation
owners:
- operations
- engineering
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- current legacy runtime operations
current_implementation_as_of: '2026-07-19'
target_architecture_authority: false
verified_against_commit: a0a9a69cefc0888c32e9fb2ef3f5ca5416a4a254
retirement_phase: phase-10
---

> Phase 0 update (2026-07-20): the opt-in PostgreSQL foundation, process
> commands, authority boundary, backup/restore procedure, and failure recovery
> are documented in [`phase-0-platform-operations.md`](phase-0-platform-operations.md).
> Existing SQLite paths remain active for legacy resources and are not silently
> dual-written.

# 当前运行时运维指南

> 本文是旧代码基线的临时运行手册。目标部署和运维以本目录其他规范为准。Preparation 必须在实际 HEAD 上确认所有命令。

## 1. 历史运行模型

旧 EnvForge 是 Node/TypeScript 应用：Fastify API、Vite/React Web、SQLite Runtime Store、本地加密 Credential Metadata、Agentless SSH。

## 2. 不得提交的运行文件

```text
.env / .env.*（除示例）
data/envforge.db*
data/keys/*
logs/
timestamped harness output
```

## 3. 历史开发命令

```bash
npm install
npm run build:server
npm run dev:api
npm run dev:web
npm run typecheck
npm run test --workspace @fool/api
npm run catalog:check
npm run certification:check
```

## 4. 历史容器部署

仓库曾包含 `Dockerfile`、`.dockerignore`、`docker-compose.yml` 和 demo compose。典型命令：

```bash
docker compose build
docker compose up -d
docker compose logs -f
```

公开部署应通过反向代理 TLS，并保证 public origin、API origin 和 Cookie 配置一致。

## 5. 备份

历史命令：

```bash
npm run backup:db
```

迁移前至少备份 SQLite DB、credential metadata、需要保留的 Report 和安全的部署 Secret 备份。不得把 `.env` 明文加入文档或普通 Artifact。

## 6. 旧 SQLite SOP

WAL 墑大时可在确认无长事务后执行：

```sql
PRAGMA wal_checkpoint(TRUNCATE);
```

任何手工操作前应停止可能写入的进程并保留副本。Phase 0 迁移到 PostgreSQL 后，本节必须更新或退休。

## 7. 失败处理

旧 Apply/Verify 失败时先查看 Plan/Report，不要直接远程修改主机。现阶段的 Repair/Retry 能力必须依据真实代码，不能使用目标设计文档假定已经存在。

## 8. 安全

- 不在 public 页面显示 token、host、private IP 或 verification code；
- credential bootstrap 使用短期值并隐藏；
- destructive action 需要确认和 audit；
- command output/diff 必须 redacted。

## 9. 退休

当 PostgreSQL、独立 Worker、新 Artifact Store 和正式 Deployment Guide 成为权威后，本文件逐段删除；最晚在 Phase 10 退休。
