# Generated Artifacts

本目录用于本地或 CI 生成的机器输出，不是设计事实源。

要求：

- 输出由命令重建，不手工编辑；
- 绑定 commit、tool version、input hash 和 schema version；
- 通过 Secret/PII 扫描；
- 非发布证据默认不提交 Git；
- 发布证据进入 versioned evidence bundle；
- Runtime Catalog 不读取未经 review/promotion 的 preview output。

旧 `docs/generated/catalog-certification.*` 已迁入 `delivery/history/catalog-certification-snapshots/`，只能作为历史快照。
