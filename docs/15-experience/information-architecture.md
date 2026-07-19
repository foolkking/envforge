---
id: EF-EXP-002
title: 信息架构
version: '1.1'
status: accepted
classification: normative
owners:
- product
- design
- frontend
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- information architecture
- navigation model
---

# 信息架构

## 1. 顶层原则

不同入口可以产生不同类型的 Project、Blueprint 或 Plan，但审批、执行、验证和报告必须汇入统一生命周期视图。不得在 Assessment、Build、Migration 页面各自复制一套 Apply/Verify/Report。

## 2. 推荐导航

```text
Workspace
├── Dashboard
├── Projects
│   ├── Assessments
│   ├── Builds
│   ├── Migrations
│   ├── Captures
│   └── Restores
├── Workloads
│   ├── Candidates and Reviews
│   ├── Workloads
│   └── Blueprints
├── Plans and Runs
│   ├── Plans
│   ├── Approvals
│   ├── Runs
│   ├── Verification
│   └── Reports
├── Archives
│   ├── Archive Versions
│   ├── Scrub and Repair
│   └── Restore Drills
├── Capabilities
└── Administration
```

产品可根据用户规模合并次级导航，但不得破坏对象关系。

## 3. Dashboard

Dashboard 是注意力和状态入口，而不是营销页。至少展示：

- blocked/review-required 项；
- active/stuck Runs；
- Verification 失败；
- Archive health；
- upcoming maintenance window；
- recent commits/rollbacks；
- Security/Audit 告警。

## 4. Project 页面

Project 页面负责目标、输入、当前 Revision 指针和生命周期，不复制对象完整编辑器。应提供来源链：

```text
Project → Snapshot/Archive → Workload/Blueprint → DecisionSet → Plan → Run → Commit/Report
```

## 5. Workloads 页面

- Candidates：机器推断和 unresolved evidence；
- Reviews：merge/split/assign/shared/exclude/answer；
- Workload：稳定业务身份；
- Blueprint：不可变目标无关合同和 Revision 历史。

## 6. Plans and Runs

Plan 详情负责：输入绑定、Diff、Actions、Gates、Risks、Approval 和 compatibility。Run 详情负责真实执行 Timeline、Stage、Action、Attempt、Lease、Checkpoint、Verification 和 Report。

Plan 不显示为“正在执行”；Run 不允许编辑 Plan。

## 7. Archives

Archive 页面必须区分：

- uploaded；
- manifest verified；
- key available；
- replica healthy；
- scrub result；
- restore drill result；
- source release readiness。

“上传完成”不得显示成“可安全删除源服务器”。

## 8. Admin 与 Capability

Capability 页面展示认证维度、版本、权限、风险、Fixture 和证据。Admin 可以查看实验/预览能力、Catalog Preview 和 Promotion Draft；普通用户只看到满足当前模式和风险策略的版本。

## 9. 深链接和迁移

旧 `/app/reports`、旧 Migrate/Build 内嵌 Apply 页面等路径需要重定向到新对象页面。重定向必须保留 Project、Plan 或 Run ID，并在 Phase 10 移除过期兼容路径。
