# EnvForge Product Design

EnvForge's product direction is:

~~~text
Production Linux Environment Rebuild Platform
~~~

It is not:

~~~text
general server panel
remote SSH executor
backup-only tool
Ansible replacement
Terraform replacement
~~~

EnvForge turns unknown Linux servers into reviewed, reproducible, verifiable
migration plans.

EnvForge 把不可控的旧 Linux 服务器，转化为可审查、可重建、可验证、可审计的环境计划。

## Product modes

1. Read-only Assessment
2. Plan-only Mode
3. Controlled Apply

The default entry point is Read-only Assessment. Apply is available only after a
reviewable immutable Environment Plan is approved.

## Product maturity questions

These questions are the acceptance criteria for the next productization phase:

1. 用户第一次用它，能不能马上获得价值？
2. 用户敢不敢把服务器交给它？
3. 用户能不能理解它为什么这样判断？
4. 失败时用户能不能知道怎么处理？
5. 别人能不能为它贡献能力？
6. 团队能不能把它纳入生产流程？

## Design map

- [Product Strategy](./product-strategy.md)
- [First-run Experience](./first-run-experience.md)
- [Trust Model](./trust-model.md)
- [Explainability](./explainability.md)
- [Failure, Repair, and Support Experience](./failure-recovery-support.md)
- [Service Stack Model](./service-stack-model.md)
- [Review Inbox](./review-inbox.md)
- [Golden Scenarios](./golden-scenarios.md)
- [Capability Ecosystem](./capability-ecosystem.md)
- [Production Adoption](./production-adoption.md)
- [Quality Harness](./quality-harness.md)
- [Product Roadmap](./roadmap.md)
