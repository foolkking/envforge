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

## Golden failure fixtures

Prompt4 extends the same `npm run test:golden` entry with five deterministic
failure fixtures under `fixtures/golden-scenarios/failures/`:

| Failure fixture | Automated assertion | Limitation |
|---|---|---|
| Nginx config validation | `config-invalid`, likely causes, diff/repair/manual actions, no rollback before reload, draft-only repair | no target config restore or reload |
| Docker secret missing | `secret-missing`, out-of-band decision, record-only/manual boundary, sentinel redaction | no secret provisioning or Compose startup |
| PostgreSQL backup unknown | `data-risk`, backup/restore decision, record-only safe default | no dump, transfer, restore, or data verification |
| Collector partial | `collector-failed`, timeout evidence, absence is not inferred, read-only reassessment | no live reconnect or permission repair |
| Verification service unhealthy | `verification-failed`, Action/verification evidence explanation, conservative rollback boundary | no live service repair or rollback |

Every failure fixture produces JSON and Markdown Support Bundles, checks raw
secret sentinels are absent, and declares that it creates no Plan, Approval,
Apply Run, ActionRunRecord, repair execution, rollback execution, or target
mutation. These fixtures prove diagnostic/report behavior, not production-ready
automatic recovery.
