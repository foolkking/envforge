# Trust Model

Question:

~~~text
用户敢不敢把服务器交给它？
~~~

Trust is built through a visible ladder:

~~~text
Level 1: Read-only Assessment
Level 2: Plan-only Mode
Level 3: Controlled Apply
~~~

## Level 1: Read-only Assessment

~~~text
EnvForge will not modify your server.
~~~

Read-only mode may read:

- OS metadata
- running services
- open ports
- package list
- Docker metadata
- selected config paths
- certificate metadata
- database presence indicators
- security baseline hints

By default, it must not read:

- private keys
- database table contents
- full secret values
- application user data
- arbitrary home directory content

## Level 2: Plan-only Mode

~~~text
Plan-only Mode generates reviewable migration plans without applying them.
~~~

It shows:

- actions
- diffs
- risks
- required gates
- artifacts
- verification steps
- rollback boundaries

## Level 3: Controlled Apply

~~~text
Controlled Apply executes only approved immutable Plans.
~~~

Current P0 security kernel:

- Immutable Environment Plan
- canonical planHash
- hash-bound approval
- artifact-bound apply
- apply body allowlist
- atomic apply claim
- idempotency-bound apply run
- Managed Execution
- ActionRunRecord
- legacy direct mutation disabled

Deployment boundary:

~~~text
Current atomic apply claim is guaranteed within a single API process runtime store.
Multi-process or multi-replica deployments must replace the runtime mutex with a durable transactional claim mechanism, such as database compare-and-set, row-level locking, or unique apply-run constraints.
~~~

Do not describe the current implementation as a distributed lock.
