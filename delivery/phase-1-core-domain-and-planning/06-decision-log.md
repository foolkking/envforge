# Phase 1 Decision Log

| ID | Decision | Reason | Reversible |
|---|---|---|---|
| PH1-D-001 | New Phase 1 writes are PostgreSQL-only | Preserve single authority and Phase 0 transaction guarantees | feature-flag rollback for reads only |
| PH1-D-002 | Blueprint/Decision/Plan canonical content is JSONB plus SHA-256 | Matches ADR-008 and Phase 0 canonicalizer | schema-versioned |
| PH1-D-003 | Compiler uses stable derived UUIDs for persisted action identity | Random IDs must not affect semantic Plan hash | yes, before Phase 2 |
| PH1-D-004 | Plan compilation is a ControlPlaneOperation topic | Required separation from ExecutionRun | no without ADR |
| PH1-D-005 | Legacy ServiceStack import creates review-required draft only | Boundary inference is not trusted enough for confirmation | yes |
| PH1-D-006 | No Prompt body is committed | Required by external Overlay | no for this delivery |
