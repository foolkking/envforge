# Outbox and Inbox Evidence

`dispatchOnce()` is exercised for both independent roles:

- operation worker claims `foundation.operation.requested` with a short lease;
- projection consumer claims Project and Endpoint topics;
- duplicate publish is deduplicated by Inbox identity;
- expired claims are reclaimable;
- claim token fencing prevents a stale worker from completing a newer claim;
- unsupported schema reaches dead-letter after the configured attempt threshold;
- Project version gaps fail instead of silently skipping an event;
- operation attempts and worker audit evidence are persisted.

The worker processes are `apps/api/src/platform-worker.ts` and
`apps/api/src/platform-projection.ts`. They are independent processes, but this
is not the Phase 2 durable Action/Execution worker, WorkerLease, Fencing or
Checkpoint implementation.
