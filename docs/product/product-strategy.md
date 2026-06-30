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

Core values:

- 降低迁移不确定性
- 减少人工漏项
- 避免误操作
- 让历史服务器可重建
- 让迁移过程可审计
- 让失败变得可解释和可恢复

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

Ansible 是执行自动化。

EnvForge 是从未知服务器反推环境、整理证据、压缩迁移决策、生成可审查计划，并在审批后受控执行。

Ansible is execution automation.

EnvForge infers environments from unknown servers, organizes evidence, compresses
migration decisions, generates reviewable plans, and executes only after
approval.

### Compared with Terraform

Terraform 管云资源和声明式基础设施。

EnvForge 管已有 Linux 主机内部的服务、配置、数据、证据和迁移流程。

Terraform manages cloud resources and declarative infrastructure.

EnvForge manages services, configuration, data, evidence, and migration workflow
inside existing Linux hosts.

### Compared with server panels

服务器面板倾向于直接操作机器。

EnvForge 先生成可审查 Plan，再执行、验证、回滚和报告。

Server panels tend to operate directly on machines.

EnvForge creates a reviewable Plan first, then executes, verifies, rolls back,
and reports.

### Compared with backup tools

备份工具复制数据。

EnvForge 重建环境意图、服务关系、配置策略、迁移决策和验证过程。

Backup tools copy data.

EnvForge reconstructs environment intent, service relationships, configuration
strategy, migration decisions, and verification process.
