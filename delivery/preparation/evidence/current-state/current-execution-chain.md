
# Current Execution Chain

```text
HTTP POST /api/plans/:id/apply
→ authenticate and owner-scope lookup
→ recompute/freeze Plan hash and validate approval
→ claim persisted StoredApplyRun / idempotency key
→ executeEnvironmentPlan() in the API process
→ managed adapter / SSH side effect
→ persist ActionRunRecord and finalize ApplyRun
→ separate HTTP verify or rollback command
→ dynamically build Plan report from stored Plan/current evidence
```

Current protections include approved Plan/hash binding, artifact hash checks, immutable stored Plan fields, action IDs, direct-playbook rejection, and redaction tests. Current gaps relative to the target are: no independent durable worker, lease/fencing, durable ActionAttempt queue, checkpoint/resume, reconciliation for unknown outcomes, independent rollback ExecutionRun, immutable ReportArtifact, Dataset transfer, Cutover, or Archive.

The legacy task queue is process-local and has SSE, while Environment Plan Apply is synchronous and does not use that queue. API restart can recover persisted Plan/Apply records but cannot resume an interrupted action from a durable checkpoint.
