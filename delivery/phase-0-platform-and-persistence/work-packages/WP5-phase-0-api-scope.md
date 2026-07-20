# WP5 Phase 0 API Scope

## Implemented operations

| Operation | Route | Auth/workspace | Mutation contract |
|---|---|---|---|
| CreateProject | `POST /api/v1/projects` | session + trusted membership | Idempotency-Key; 201/200 replay |
| ListProjects | `GET /api/v1/projects` | session + membership | bounded page envelope |
| GetProject | `GET /api/v1/projects/{projectId}` | session + workspace | ETag |
| UpdateProject | `PATCH /api/v1/projects/{projectId}` | session + workspace | Idempotency-Key + If-Match; 412 on stale version |
| BindEndpointToProject | `POST /api/v1/projects/{projectId}/endpoints` | session + workspace | Idempotency-Key + If-Match; same-workspace FK |
| ListProjectEndpoints | `GET /api/v1/projects/{projectId}/endpoints` | session + workspace | bounded page envelope |
| CreateFoundationHashVerification | `POST /api/v1/platform/operations/hash-verification` | admin + workspace | Idempotency-Key; committed durable operation; 202 |
| GetFoundationOperation | `GET /api/v1/platform/operations/{operationId}` | admin + workspace | stable operation result |
| GetFoundationMetrics | `GET /api/v1/platform/metrics` | admin + workspace | bounded workspace counts |
| Liveness/Readiness | `GET /api/v1/health/live`, `ready` | operational | readiness fails when PostgreSQL/migration state is unavailable |

All errors use `application/problem+json`; cross-workspace lookup is non-
enumerating. The only public long operation is a safe internal platform hash
verification. It cannot execute SSH, Plan actions, datasets, Cutover, Archive,
or Restore.

## Existing-adapt / deferred

The legacy `/api` surface is unchanged. OpenAPI operations for Snapshot,
Candidate, Blueprint, Plan, Execution, Dataset, Secret, Cutover, and Archive are
target contracts deferred to their roadmap phases and are not falsely exposed
by the Phase 0 router. Endpoint creation remains an internal service/import
foundation; no test-only endpoint creation route was added.
