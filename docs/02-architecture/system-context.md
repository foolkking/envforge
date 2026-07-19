---
id: EF-ARCH-002
title: 系统上下文
version: '1.1'
status: accepted
classification: normative
owners:
- architecture
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-002
- ADR-006
source_of_truth_for:
- system context
---


# 系统上下文

EnvForge 位于用户、Linux 环境、对象存储、Secret/Key Provider、Traffic Provider 和外部验证探针之间。

## 外部参与者

| 参与者 | 输入 | 输出/风险 |
|---|---|---|
| Operator | Endpoint、Review、Decision、Run 命令 | 需要清晰风险、进度和恢复边界 |
| Approver | Plan、Risk、Commit/Release 请求 | 高风险操作不可由普通执行者隐式批准 |
| Source Linux | Snapshot、Artifact、Dataset | 最小化变更；Host Key 和权限需验证 |
| Target Linux | Build/Restore/Migration Actions | before-state、资源锁和幂等 |
| Archive Repository | 对象上传、读取、复制 | 远端完整性、保留和删除证明 |
| Secret/Key Provider | JIT Secret、wrap/unwrap | 明文不得进入控制面持久化 |
| Traffic Provider | Route inspect/switch/rollback | 超时结果未知时必须 reconcile |
| Verification Probe | 外部业务检查 | 本地成功不能替代外部路径成功 |

## 上下文约束

- EnvForge 是控制和证据系统，不是业务流量数据面。
- Agentless SSH 是 v1 默认；外部 Provider 失败不得破坏权威 Run 状态。
- Archive 必须在控制面数据库丢失后仍可导入。

图：[`diagrams/system-context.mmd`](diagrams/system-context.mmd)。
