# Failure, Repair, and Support Experience

Question:

~~~text
失败时用户能不能知道怎么处理？
~~~

A failure should not stop at:

~~~text
Command failed: exit code 1
~~~

Failure events should include:

- What failed
- Where it failed
- What was being attempted
- Impact
- Likely causes
- Evidence
- Recommended next actions
- Can retry?
- Can skip?
- Can rollback?
- Can generate repair plan?

## Example: Nginx validation failure

~~~text
Nginx configuration validation failed.
~~~

Step:

~~~text
Validate generated Nginx configuration before reload.
~~~

Command:

~~~text
nginx -t
~~~

Result:

~~~text
Failed with exit code 1.
~~~

Likely causes:

1. Referenced certificate path does not exist on target.
2. Included upstream config was not migrated.
3. Target Nginx version does not support a directive.

Impact:

~~~text
Nginx was not reloaded. Existing target service state was not changed.
~~~

Recommended actions:

- View config diff
- Reissue certificates on target
- Skip HTTPS server block for now
- Generate Repair Plan
- Mark as manual follow-up

Rollback:

~~~text
Not required. No write was applied after validation failure.
~~~

## Repair and support artifacts

Repair Plan should turn failure evidence into a new reviewable Environment Plan.
It must not bypass the immutable Plan flow.

Failure support must explicitly design:

- Repair Plan
- Support Bundle
- Redacted logs
- ActionRunRecord evidence

Support Bundle should include:

- plan metadata
- planHash
- approvedPlanHash
- applyRunId
- ActionRunRecord evidence
- redacted stdout/stderr
- snapshot summary
- collector completeness
- artifact hashes
- verification result
- EnvForge version
- catalog version

Redaction is default. Support bundles must not leak secrets.

## Implemented baseline (Prompt4)

The Failure / Repair / Support baseline now provides:

- `FailureDiagnostic` taxonomy and explanation cards covering collector,
  configuration, command, artifact, permission, secret, data-safety, service,
  verification, manual, and unknown failures;
- draft-only `RepairPlanDraft` suggestions whose target-changing steps state
  that they require review and a separately approved immutable Environment
  Plan;
- read-only `GET /api/migration/sessions/:sessionId/failures`;
- read-only JSON/Markdown Support Bundle export at
  `GET /api/migration/sessions/:sessionId/support-bundle?format=...`;
- a Migrate-local Web panel showing what/where/attempt/impact, likely causes,
  evidence, recommended actions, retry/skip/rollback boundaries, repair draft,
  and Support Bundle export;
- golden failure fixtures for Nginx validation, Docker secret handling,
  PostgreSQL backup freshness, partial collection, and unhealthy verification.

Support Bundle export defaults to redaction and can include Plan hashes,
artifact hashes, Apply/ActionRun evidence, assessment/service stacks, review
decisions, collector completeness, verification, diagnostics, and version
metadata when that evidence is available. Assessment-only sessions remain valid
without Plan or Apply metadata.

The safety boundary is deliberate:

```text
Repair Plan = draft/suggestion only
Retry = explanation only unless an existing approved execution policy permits it
Rollback = recorded boundary explanation, not a claim that recovery ran
Support Bundle = read-only redacted export
```

No diagnostic or export route creates an Approval, Apply Run,
ActionRunRecord, repair execution, rollback execution, or target mutation. Full
automatic repair and rollback remain future work.
