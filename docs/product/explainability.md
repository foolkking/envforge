# Explainability

Question:

~~~text
用户能不能理解它为什么这样判断？
~~~

EnvForge should not only show confidence numbers. It should show:

- Decision
- Evidence
- Confidence
- Risk
- Reason
- Alternative
- Required user input

Every service stack needs to explain:

- 系统为什么识别出它？
- 证据有哪些？
- 置信度为什么高/低？
- 风险来自哪里？
- 为什么需要审批？
- 推荐策略是什么？
- 用户有哪些选择？

Mature product behavior is not “I decide for you”; it is “I let you trust the
decision.”

成熟产品不是“我帮你决定”，而是“我让你相信这个决定”。

## Example: PostgreSQL Database

Decision:

~~~text
Requires data migration strategy confirmation.
~~~

Why:

- postgresql.service is active
- port 5432 is listening
- /var/lib/postgresql exists
- pg_hba.conf and postgresql.conf found
- component contains stateful data

Confidence:

~~~text
High
~~~

Risk:

~~~text
High
~~~

Risk reasons:

- Direct file copy may corrupt data if PostgreSQL is running
- Version mismatch may break restore
- Data volume size unknown
- Backup freshness unknown

Recommended strategy:

~~~text
Use pg_dump/pg_restore for logical migration.
~~~

Alternatives:

1. pg_dump/pg_restore
2. physical base backup
3. record-only
4. manual follow-up
