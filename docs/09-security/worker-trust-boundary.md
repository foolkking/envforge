---
id: EF-SEC-006
title: Worker 信任边界
version: '1.1'
status: accepted
classification: normative
owners:
- security
- platform
- backend
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-004
- ADR-006
- ADR-007
source_of_truth_for:
- worker security
---


# Worker 信任边界

Worker 是高权限执行主体，应与 API 网络/身份隔离。Worker 只能 Claim 其 capability pool、workspace policy 和 risk class 允许的 Run。

## 控制

- 独立服务身份和短期 Credential；
- fencing/lease；
- 只读 Plan、typed Action Runtime；
- 最小 sudo allowlist 和 Host Key pinning；
- 文件系统沙箱/受控 temp；
- egress allowlist；
- no general database write，使用 application service/repository；
- logs 默认 redacted。

## Worker compromise

撤销 Worker Credential、expire leases/increment fencing、暂停高风险 Queue、审查所有 Attempt/Provider token、轮换相关 Endpoint Credential。旧 Worker 不能凭缓存 token 写新状态。
