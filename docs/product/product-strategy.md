# Product Strategy: From Unknown Servers to Trusted Migration Plans

EnvForge serves operators who need to understand and move existing Linux
environments without turning migration into blind remote execution.

## Target users

- DevOps
- SRE
- Infrastructure teams
- Security teams
- Internal platform teams
- Migration consultants

## Core value proposition

把不可控的历史服务器，变成可审计、可重建、可验证的环境计划。

EnvForge reduces migration uncertainty, catches missed manual work, avoids
unsafe ad-hoc operations, makes historical servers rebuildable, makes migration
auditable, and makes failures explainable and recoverable.

## Near-term strongest entry point

~~~text
Linux server migration assessment + reviewable migration plan
~~~

Product principle:

~~~text
Assess first. Plan second. Apply only when trusted.
~~~

EnvForge should not first optimize for:

~~~text
supporting 100 software packages
piling up more catalog items
becoming a server control panel
becoming a general SSH executor
~~~

## Differentiation

### Compared with Ansible

Ansible is execution automation.

EnvForge infers environments from unknown servers, organizes evidence, compresses
migration decisions, generates reviewable plans, and executes only after
approval.

### Compared with Terraform

Terraform manages cloud resources and declarative infrastructure.

EnvForge manages services, configuration, data, evidence, and migration workflow
inside existing Linux hosts.

### Compared with server panels

Server panels tend to operate directly on machines.

EnvForge creates a reviewable Plan first, then executes, verifies, rolls back,
and reports.

### Compared with backup tools

Backup tools copy data.

EnvForge reconstructs environment intent, service relationships, configuration
strategy, migration decisions, and verification process.
