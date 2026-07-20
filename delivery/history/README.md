# EnvForge 历史证据

本目录保存旧审计、规划、实现和关闭报告。文件保留原始结论，但不是当前事实源。

## 使用规则

1. 引用时同时记录 original path、source SHA-256 和原 commit；
2. 任何当前能力断言必须重新验证；
3. 旧 Phase 编号仅表示历史；
4. 不从历史报告复制 Secret 或生产主机信息；
5. 当前设计、API 和 Migration 以 `docs/` 的事实源为准。

`capability-preview-snapshots/` 保存项目历史生成物；当前 preview 只能进入 `artifacts/generated/` 或 CI Artifact，不能直接启用 Runtime Catalog。

## Phase 0-10 requirement and revision evidence

The following files are historical, non-authoritative evidence. Current target
design remains under `docs/`, while Phase entry uses the canonical source index.

- `requirements/chatgpt-vm-migration-pain-analysis-5.md`
- `audits/envforge-phase0-phase10-coverage-gap-audit.md`
- `phase-prompt-revisions/envforge-phase0-phase10-v1.1-change-log.md` (when supplied)
- `phase-prompt-revisions/envforge-phase0-phase10-v1.1-SHA256SUMS` (when supplied)
- `phase-prompt-revisions/envforge-phase0-phase10-v1.1-validation-report.json` (when supplied)
