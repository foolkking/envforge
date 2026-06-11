# Operations

This document contains runtime, deployment, and maintenance notes. It is the
successor to the previous deployment/self-hosting documents.

## Runtime model

EnvForge is a Node application with:

- Fastify API serving backend routes;
- Vite-built React frontend;
- SQLite runtime persistence;
- encrypted local credential metadata;
- SSH access to managed/source hosts.

Do not commit local runtime files:

- `.env`, `.env.*` except `.env.example`;
- `data/envforge.db*`;
- `data/keys/*`;
- `logs/`;
- timestamped `docs/harness-reports/<runId>/`.

## Environment

Use `.env.example` as the template. Secrets must stay local or be provided by
deployment secret management.

Common settings include:

| Setting | Purpose |
|---|---|
| API host/port | Fastify bind address |
| Public URL/origin | Browser/API URL mapping |
| SQLite path | Runtime database |
| Credential encryption key | AES-256-GCM credential storage |
| SMTP settings | Optional email notifications |
| OAuth provider settings | Optional login providers |

Never store real tokens, private keys, or production host credentials in docs.

## Local development

```bash
npm install
npm run build:server
npm run dev:api
npm run dev:web
```

Useful checks:

```bash
npm run typecheck
npm run test --workspace @fool/api
npm run catalog:check
npm run certification:check
```

## Docker deployment

The repository contains Docker-related files:

- `Dockerfile`
- `.dockerignore`
- `docker-compose.yml`
- `docker-compose.demo.yml`

Typical flow:

```bash
docker compose build
docker compose up -d
docker compose logs -f
```

For public deployment, terminate TLS at a reverse proxy such as Nginx, Caddy, or
Traefik. Keep EnvForge's public origin, API origin, and cookie/security settings
consistent.

## Self-hosting checklist

| Step | Check |
|---|---|
| Runtime | Node >= 20 or container runtime available |
| Secrets | `.env` populated from `.env.example` |
| Storage | Persistent volume for SQLite/data |
| Backup | Scheduled DB/data backup |
| Network | API/web ports reachable behind proxy |
| Auth | Admin account and OAuth/email settings verified |
| SSH | Target hosts use least-privilege access where possible |
| Logs | Rotation and retention configured |

## Backups

Use the provided backup script when possible:

```bash
npm run backup:db
```

Back up:

- SQLite database;
- encrypted credential metadata;
- generated reports you want to retain;
- deployment `.env` through a secure secret backup path.

Do not back up transient logs as durable docs unless they are part of a curated
incident record.

## Operational SOPs

### SQLite WAL bloat

Cause: long-running transactions or heavy write load.

Action:

```sql
PRAGMA wal_checkpoint(TRUNCATE);
```

Then inspect active workers and SSH tasks.

### Search/index drift

If local search/index queues are used and drift occurs, reset failed queue
entries and rerun the worker. Prefer scripted recovery over manual DB edits.

### Notification queue backlog

Inspect by status, resolve SMTP/provider failures, then retry dead-letter items.
Do not blindly replay a queue while the provider is still failing.

### Failed apply/verify

Use Plan details and generated reports first. If verification failed, prefer a
Repair Plan or rollback path rather than ad hoc host edits.

## Security notes

- Public landing must not include tokens, hostnames, private IPs, keys, or email
  verification codes.
- Install/bootstrap scripts that require credentials should be generated after
  login with short-lived tokens and hidden by default.
- Destructive actions require confirmation and audit log entries.
- Plan reports must redact secrets in command output and diffs.
