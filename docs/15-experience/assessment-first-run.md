---
id: EF-EXP-003
title: 首次 Assessment 体验
version: '1.1'
status: accepted
classification: normative
owners:
- product
- design
- discovery
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- assessment first-run experience
---

# 首次 Assessment 体验

## 1. 目标

首次体验的成功标准不是执行迁移，而是用户在十分钟内获得可信的环境认知，并能导出一份不夸大能力的 Assessment Report。

## 2. 推荐十分钟路径

| 时间 | 用户体验 | 系统对象 |
|---|---|---|
| 0–1 分钟 | 创建 Assessment Project、添加 Source Endpoint、确认 read-only policy | EnvironmentProject、EnvironmentEndpoint |
| 1–4 分钟 | 采集 OS、service、port、package、container、config/data hint 和 security evidence | ControlPlaneOperation、EnvironmentSnapshot |
| 4–6 分钟 | 展示 Evidence Graph、Collector completeness 和 Candidate 摘要 | Evidence、CandidateGeneration |
| 6–8 分钟 | 展示风险、共享资源、未知项、关键问题和 migration readiness | WorkloadCandidate、Review Items |
| 8–10 分钟 | 导出 Report，或进入 Candidate Review | Assessment Report、CandidateReviewSession |

时间是体验目标，不是每种主机的硬 SLO。大型或高延迟主机应展示预计进度和已完成分区。

## 3. Source 权限披露

连接前必须明确展示 EnvForge 将读取与不会读取的范围。

默认可以读取：

- OS/architecture/init；
- package/service/process/socket metadata；
- selected config metadata；
- container/compose metadata；
- certificate metadata；
- database presence/version/size hint；
- security baseline metadata。

默认不得读取或持久化：

- private-key 内容；
- database row 内容；
-完整 Secret 值；
-未授权的用户数据；
-任意 home directory 内容。

## 4. 进度与不完整性

Collector 状态应按 section 展示：`not-started | running | complete | partial | failed | skipped-by-policy`。任何 section 失败必须进入 Snapshot completeness，不得形成空数组假成功。

## 5. 首份输出

Assessment Report 至少回答：

- 主要 Workload 候选；
- 关键 service/runtime/data/endpoint；
- Evidence 完整性；
- 共享或冲突资源；
- Critical Questions；
- 可能的 Build/Migration/Capture readiness；
- 尚未支持的能力；
- 推荐下一步。

Report 必须脱敏，且导出操作不得创建 Plan、Approval、Run 或目标副作用。

## 6. 首要 CTA

建议顺序：

1. `Assess a server`；
2. `Review candidates`；
3. `Create a planning project`。

`Apply`、`Migrate now`、`Release source` 不得出现在首次 Assessment 主操作中。

## 7. 验收

Phase 4 Acceptance 应证明：

- 全流程只读；
- Snapshot immutable；
- 不完整 Collector 明确显示；
- Candidate 不自动执行；
- Report 不含 Secret；
- 缺少证据时使用 unknown；
- UI 不夸大 readiness。
