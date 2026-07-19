---
id: EF-TEST-009
title: 端到端场景
version: '1.1'
status: accepted
classification: normative
owners:
- qa
- product
- architecture
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- end-to-end test scenarios
---


# 端到端场景

## Golden Build

Manual/Confirmed Blueprint → Target Snapshot → Plan/Approval → Durable Run → Secret → systemd/Nginx/PostgreSQL → HTTP+DB transaction → ExecutionCommitRecord → rollback rehearsal。

## Golden Migration

Source Discovery/Blueprint → Target Prepare → filesystem initial sync → final transaction-consistent PostgreSQL dump/restore → drain/quiesce → authority → Nginx/manual DNS → business verify → observation → CutoverCommitRecord → source retention。

## Golden Preserve & Restore

Capture → encrypted signed ArchiveVersion → two replica policy → Full/Sampled Scrub → isolated business Restore Drill → SourceReleaseCommitRecord → destroy source test VM → import/restore to new target → ExecutionCommitRecord。

每个场景还包含失败分支、cleanup 和 evidence bundle，详见 `13-acceptance`。
