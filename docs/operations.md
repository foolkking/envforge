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

## Inventory Graph & Service Stack API

*Added 2026-07-09 — Phase 6-B routes documented.*

Three routes expose the typed inventory graph and enriched service stack
data built by `extractInventoryGraph()` and `aggregateServiceStacks()`.

### Routes

| Method | Path | Auth | Response |
|---|---|---|---|
| GET | `/api/migration/sessions/:sessionId/inventory-graph` | Bearer | `{ graph: InventoryGraph }` |
| GET | `/api/migration/sessions/:sessionId/service-stacks` | Bearer | `{ stacks: ServiceStack[] }` |
| GET | `/api/connections/:id/inventory-graph` | Bearer | `{ graph: InventoryGraph }` |

### Error Responses

| Code | Condition |
|---|---|
| 401 | Missing or invalid bearer token |
| 404 | Session/connection not found for the authenticated user |
| 400 | No snapshot available — probe the connection first |

Cross-user isolation: the connection inventory-graph route filters by
`c.userId === user.id`; requesting another user's connection returns 404.

### InventoryGraph Shape

```ts
interface InventoryGraph {
  hostname: string;       // hostname of the probed machine
  capturedAt: string;     // ISO 8601 timestamp of probe
  completeness: number;   // 0–1 collector completeness score
  nodes: InventoryNode[]; // always array (may be empty)
  rels: InventoryRel[];   // always array (may be empty)
}
```

Each `InventoryNode` has: `id`, `kind` (one of 15 node kinds), `label`, `evidence`.

### ServiceStack Shape

Each stack has **9 core fields** (always present):

- `id`, `label`, `service`, `packages`, `ports`, `configFiles`, `containers`, `confidence`, `reasoning`

Plus **10 optional enrichment fields** (present or `undefined`, never empty arrays):

- `processes`, `dataPaths`, `envFiles`, `secretRefs`, `volumes`, `networks`, `certificates`, `domains`, `usersGroups`, `scheduledTasks`

Plus `enrichment` metadata:

- `version`: always `"phase5.stack.v1"`
- `sourceGraphNodeCount`, `sourceGraphEdgeCount`: integer counts
- `enrichmentWarnings`: string array (may be empty)

Empty-state: when a snapshot has no software/services, routes return
200 with `{ graph: { nodes: [], rels: [] } }` or `{ stacks: [] }`.

### Secret Safety

- `SecretRef` nodes store only `fingerprint` (DJB2 hash), `sourceLocation` (path), `redacted: true` — never raw credential values.
- `EnvFileRef` nodes store only `keyCount: number` — never key names.
- Route responses are verified at test time to contain no password/token/private-key patterns.

### Assessment & Support Bundle Enrichment

- `AssessmentSummary.enrichedStacks?: ServiceStack[]` — optional field computed during assessment. Present when a snapshot with software exists; `undefined` otherwise.
- `SupportBundle.enrichedStacks?: ServiceStack[]` — auto-propagated from assessment's `enrichedStacks` when available. Can be explicitly overridden via `BuildSupportBundleInput.enrichedStacks`.
- `SupportBundle.inventoryGraph?: InventoryGraph` — reserved for future use; currently always `undefined` in API responses (the support bundle route does not re-extract the graph).

### Backward Compatibility

All Phase 6-B fields and routes are additive:
- Existing routes and response shapes unchanged.
- Optional fields are `undefined` when data is unavailable.
- Frontend types do not consume these fields yet — safe to iterate.

### References

- Phase 6-A planning: `docs/phase6-a-planning-report-2026-07-09.md`
- Phase 6-B implementation: `docs/phase6-b-implementation-report-2026-07-09.md`
- Phase 6-C evidence: `docs/phase6-c-browser-api-evidence-closure-2026-07-09.md`
- Phase 7-A hardening plan: `docs/phase7-a-production-consumer-hardening-planning-2026-07-09.md`
