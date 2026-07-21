# Current Execution Audit

At initial HEAD, target mutation flows through stored immutable legacy Environment Plans and managed ActionRun records. Execution is coupled to the API/runtime SQLite store and guarded by an in-process mutex; there is no PostgreSQL ExecutionRun queue, worker lease, fencing token, durable attempt history, or crash-safe unknown-outcome reconciliation. Verify and rollback are invoked by the legacy managed execution path. That path remains isolated and is not promoted into Phase 2.

Phase 0 provides PostgreSQL transactions, Artifact metadata, Outbox/Inbox and separate dispatcher entrypoints. Phase 1 provides immutable Plan/Approval hashes and a deterministic approved Build fixture. These are the integration boundaries for the new kernel.

