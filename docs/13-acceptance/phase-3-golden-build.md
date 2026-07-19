---
id: EF-ACC-004
title: Phase 3：Golden Build 验收
version: '1.1'
status: accepted
classification: normative
owners:
- qa
- architecture
- engineering
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- Phase 3 acceptance
---

# Phase 3：Golden Build 验收

## 目标

在空 Linux Target 从 Blueprint 完成真实 Build、Secret 交付、业务验证、Commit 和 before-state Rollback。

## 固定环境

- Ubuntu 22.04/24.04 x86_64 VM；
- Nginx、Node.js 或 Python app、PostgreSQL、systemd；
- User Input/Target Existing/Regenerate Secret；
- 外部 HTTP probe。

## 执行步骤

1. 记录仓库 HEAD、设计版本、migration version、Capability manifest 和 Feature Flags。
2. 从干净环境部署/升级本 Phase 产物。
3. 执行基线和成功路径。
4. 执行并发、重放、权限和故障注入。
5. 收集 Evidence Bundle，执行清理并确认无敏感材料残留。

## 必须通过

- Plan stages/actions 与 Golden Fixture 一致；
- 目标用户/目录/package/config/unit/route/db 正确；
- nginx -t、systemd active、HTTP expected body/TLS、DB auth + isolated write/read/delete 通过；
- Secret canary 无泄漏；
- ExecutionCommitRecord once-only；
- Rollback 恢复目标 before-state，不删除原有资源；
- partial rollback 明确。

## 故障注入

- Config write 后 kill；
- package 已存在；
- Secret provider unavailable/expired；
- service start fail；
- Verification fail；
- rollback 中 kill Worker。

## Evidence Bundle

- Plan/Approval/Run/Commit hashes、VM before/after inventory、verification evidence、redaction scan、rollback report。

## 非目标

Source Discovery、initial/final sync、Traffic Cutover、Archive。

## 判定

- **PASS**：全部 required 检查和故障断言通过，无 P0/P1 安全或数据风险。
- **PARTIAL**：仅非关键 optional 项失败；不能解锁依赖此能力的生产声明。
- **FAIL**：任何 required、数据完整性、Secret、状态机或恢复断言失败。
