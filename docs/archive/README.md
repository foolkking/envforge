---
id: EF-ARCHIVE-DOC-001
title: 历史文档归档说明
version: '1.1'
status: accepted
classification: informative
owners:
- architecture
- engineering
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- historical documentation policy
---

# 历史文档归档说明

Active design facts 不存放在本目录。历史审计、旧 Phase 报告和 superseded 设计迁入 `delivery/history/`，以保留时间、commit、命令和当时结论。

历史文件必须明确：

- `classification: historical-evidence` 或等价标记；
- `status: archived`；
- `not_source_of_truth: true`；
- 原始路径和 Hash；
- 如适用，`superseded_by`。

不得重写历史结果使其看起来符合当前设计。Active 文档引用历史事实时，应重新验证当前 HEAD。
