# Review Inbox

Decision Engine should not expose 500 scan findings directly. Its product form
is a Review Inbox that compresses evidence into a small number of key decisions.

Review Inbox answers:

- 我现在需要做哪些决定？
- 为什么这些决定重要？
- 默认安全选择是什么？
- 如果我不处理会怎样？

## Item types

- required-decision
- suggested-decision
- blocker
- manual-confirmation
- policy-violation
- record-only

## Example

Decision:

~~~text
PostgreSQL data migration strategy
~~~

Why this needs review:

~~~text
This service contains stateful data and cannot be safely migrated by config copy alone.
~~~

Evidence:

- postgresql.service active
- 5432 listening
- /var/lib/postgresql detected
- config files found

Recommended:

~~~text
pg_dump/pg_restore
~~~

Options:

1. Use pg_dump/pg_restore
2. Use physical backup
3. Record only, do not migrate
4. Mark as manual

Default safe choice:

~~~text
Record only until backup freshness is confirmed.
~~~

Review Inbox connects:

~~~text
Collector Evidence
Service Stack
Decision Engine
Environment Plan
Team Approval
~~~

## Web productization baseline

Prompt2B+C embeds Review Inbox in the Migrate Assessment experience. Inbox
items join to Service Stacks through the backend candidate id and therefore show
related evidence, confidence, risks, recommendation, alternatives, default safe
choice, unresolved impact, and decision history without exposing raw scanner
result spam as the primary UI.

Supported actions use existing Decision Engine and migration-session contracts:

- accept a supported recommendation and record its session decision or data
  strategy for a future Plan-only draft;
- choose a backend-provided alternative;
- keep a component record-only;
- assign manual follow-up;
- defer an Inbox item;
- optionally remember an advisory preference.

Review completion is not Environment Plan approval. A remembered preference is
not Apply authorization. No Inbox action creates an Approval or Apply Run, and
Controlled Apply still requires a separately approved immutable Plan.
