# Golden Scenarios

EnvForge should not initially chase support for 100 software packages. It should
go deep on a small number of high-value scenarios.

Each golden scenario needs:

- demo lab
- fixture
- scan
- plan
- dry-run/apply
- verify
- report
- failure example

## 1. 旧 VPS 迁移到新 VPS / Legacy VPS to new VPS

Covers:

- Nginx / Caddy
- Certbot
- Docker Compose
- PostgreSQL / MySQL
- Redis
- UFW
- SSH
- systemd services

## 2. Docker Compose 应用重建 / Docker Compose application rebuild

Covers:

- compose files
- env files
- volumes
- networks
- image digests
- reverse proxy labels
- healthchecks
- depends_on
- restart policies

## 3. 数据库安全迁移 / Safe database migration

Covers:

- PostgreSQL
- MySQL/MariaDB
- Redis
- backup
- transfer
- restore
- verify
- rollback boundary

## 4. 服务器环境盘点报告 / Server environment assessment report

Covers:

- 服务栈识别
- 端口
- 配置
- 数据目录
- secret 风险
- 安全基线
- 迁移建议

## 5. 迁移后持续验证 / Post-migration continuous verification

Covers:

- 服务健康
- 端口状态
- 证书有效期
- 配置 drift
- Docker container health
- 数据库可访问性
- backup freshness

## Golden Scenario Lab baseline

Prompt3 establishes five deterministic product-level fixtures under
`fixtures/golden-scenarios/`. Run the lab with:

```bash
npm run test:golden
```

The runner calls the real migration classifier, Assessment projection,
Decision Engine Review-Inbox eligibility contract, migration plan-only
projection, and JSON/Markdown Assessment report builders. It does not copy
classification or report logic into fixture assertions.

| Scenario | Automated baseline | Current limitation |
|---|---|---|
| Legacy VPS | web/app/database/cache/security/network/scheduled stacks, required decisions, relationships, plan-only projection, reports, redaction | no live target Apply, database transfer, certificate issuance, verify, or rollback |
| Docker Compose app | Compose/runtime stack, `.env` secret-out-of-band review, volume/data evidence, image/network/health metadata, reports | no live Docker daemon, volume transfer, container startup, or target health check |
| Safe database migration | PostgreSQL, MySQL/MariaDB and Redis statefulness; PostgreSQL logical dump recommendation; backup/restore decisions; no raw config-copy recommendation | no backup consistency, transfer, restore, query verification, or rollback execution |
| Assessment-only inventory | server/service summary, ports, configs, unknown/manual item, evidence quality, reports, successful-empty Docker semantics | no Plan, Approval, dry-run, Apply, or target mutation by design |
| Post-migration verification | service, port, certificate, config drift, Docker health, database connectivity and backup-freshness evidence expectations | fixture expectation only; continuous scheduling and live remediation are not implemented |

Every fixture declares its expected service stacks, Review decisions,
readiness, collectors, report content, redaction sentinels, read-only security
boundary, and limitations. The lab asserts the report boundary:

```text
This assessment was generated in read-only mode.
No apply run was created.
No target mutation was performed.
Sensitive values are redacted by default.
```

This product-level lab complements rather than replaces the existing 109
capability Plan/dry-run scenarios under `scripts/harness/scenarios/`.
