# EnvForge 历史证据

本目录保存旧审计、规划、实现和关闭报告。文件保留原始结论，但不是当前事实源。

## 使用规则

1. 引用时同时记录 original path、source SHA-256 和原 commit；
2. 任何当前能力断言必须重新验证；
3. 旧 Phase 编号仅表示历史；
4. 不从历史报告复制 Secret 或生产主机信息；
5. 当前设计、API 和 Migration 以 `docs/` 的事实源为准。

`capability-preview-snapshots/` 保存项目历史生成物；当前 preview 只能进入 `artifacts/generated/` 或 CI Artifact，不能直接启用 Runtime Catalog。
