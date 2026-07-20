# EnvForge Phase 0 Charter

- Phase: Platform and Persistence Foundation
- Delivery contract: `EF-DELIVERY-CONTRACT-001@1.1`
- Design baseline: EnvForge Integrated Design Baseline v1.2
- External prompt: `EF-DELIVERY-PHASE-0-001@1.1`
- External prompt SHA-256: `06f0434369918b186378658fe505a7a45258551211d6ce908fb42c799e6ffacc`
- Prompt body stored in repository: no, per the accepted external-prompt policy

Phase 0 establishes PostgreSQL authority for new foundation resources, explicit
SQL migrations, workspace-scoped repositories, artifact integrity, atomic
event/audit/outbox writes, inbox deduplication, API idempotency/CAS, and separate
API/dispatcher/projection process entrypoints. It does not implement Planning,
ExecutionRun, Dataset, Secret Delivery, Cutover, Archive, Restore, or target SSH
side effects.
