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
