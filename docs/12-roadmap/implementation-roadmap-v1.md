---
id: EF-ROAD-001
title: 实施路线 v1.1
version: '1.1'
status: accepted
classification: normative
owners:
- architecture
- product
- engineering
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-005
source_of_truth_for:
- implementation roadmap
---


# 实施路线 v1.1

这是唯一 Phase 编号体系。旧的“Phase 1 Discovery / Phase 2 Planning / Phase 7 合并 Restore”已废弃。

| 阶段 | 目标 | 主要输出 | 强制前置 |
|---|---|---|---|
| Preparation | 设计基线与交付治理 | Markdown、ADR、Gap、Prompt/Closure 模板 | 无 |
| Phase 0 | 平台与持久化基座 | PostgreSQL、Artifact、Audit、Outbox、Idempotency、API/Worker 骨架 | Preparation |
| Phase 1 | 核心领域与 Planning | Project→Blueprint→Decision→Plan→Approval | Phase 0 |
| Phase 2 | Durable Execution | Run/DAG/Queue/Lease/Fencing/Checkpoint/Recovery/Report | Phase 1 |
| Phase 3 | Golden Build | systemd/Nginx/App/PostgreSQL/Secret/Verify/Rollback | Phase 2 |
| Phase 4 | Discovery/Review | Snapshot→Evidence→Candidate→Review→Blueprint | Phase 3 |
| Phase 5 | Dataset Engine | Filesystem/PostgreSQL/Volume/Transfer/Commit | Phase 3/4 |
| Phase 6 | Live Migration | Quiesce/Authority/Traffic/Observe/Commit/Rollback | Phase 5 |
| Phase 7 | Capture/Archive | Encrypted Archive/Replica/Scrub/Repair/Import | Phase 5 + Secret/Verification |
| Phase 8 | Restore/Source Release | Restore Drill/Restore/Release Commit | Phase 7 |
| Phase 9 | 生产强化 | RBAC/HA/Certification/Scale/Ecosystem | Phase 3–8 |
| Phase 10 | 系统集成、Legacy Retirement 与 GA Closure | 全场景集成、旧权威路径删除、格式冻结、升级演练、RC Soak、GA Closure | Phase 0–9 全部 PASS |

## 阶段执行方式

每个 Phase 按 Work Package 纵向交付：Schema → Domain → Application → API → Worker/Adapter → UI → Migration → Tests → Docs → Closure Report。最终执行 Prompt 必须基于上一阶段真实仓库 HEAD、Closure Report、Evidence Bundle 和 Handoff Manifest 生成。Phase 10 不增加主要能力，只完成集成、旧路径退出和 GA 收尾。

## 禁止透支

- Phase 2 前不得声称 Durable execution；
- Phase 3 前不得声明 Verified Build；
- Phase 5 前不得声明数据迁移；
- Phase 6 前不得声明 Live Migration；
- Phase 7 前普通上传不得称 Environment Archive；
- Phase 8 前无 Restore Drill 不得建议释放源；
- Phase 10 前不得宣称所有 legacy authority 已移除或产品达到 GA。
