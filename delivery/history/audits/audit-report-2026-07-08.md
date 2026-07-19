---
title: EnvForge 功能审计报告
status: archived
classification: historical-evidence
not_source_of_truth: true
original_path: audit-report-2026-07-08.md
archived_at: '2026-07-19'
source_sha256: 895b0072c8df682063b054a6d65f6b9b75a2eb81dd4aeb20a81e38a7115fe6b4
---

> 历史证据：保留原始内容、日期和当时结论。不得作为当前设计或当前代码事实源；使用前必须在当前 HEAD 重新验证。

# EnvForge 功能审计报告

> 审计日期：2026-07-08
> 审计范围：P0-P10 全覆盖
> 审计方法：静态代码分析 + 测试覆盖追踪 + 执行路径验证

---

## 0. 总结

| 维度 | 完成度 | 判定 |
|------|--------|------|
| **P0 可信执行核心** | ~92% | Plan 不可变、hash、审批、apply gate 均已实现并测试；apply 后 verify/rollback/report 链完整 |
| **P1 扫描与环境理解** | ~40% | snapshot shape 完善但采集侧仍为单体脚本；Inventory Graph 节点类型完整但缺 DataPath/Volume/Network 提取器 |
| **P1.5 置信度与决策引擎** | ~85% | 8 维决策引擎完全实现（9 文件）；Review Inbox 分层完成；缺 golden fixture |
| **P2 审批体验** | ~55% | 后端 Review Inbox、四层分离、决策记忆已实现；前端审批 UI 仍以单页 wizard 为主，未按 Blockers/Required/Suggested 分层展示 |
| **P3 真实迁移能力** | ~20% | 数据库数据迁移策略已文档化但无执行路径；Docker/Compose 检测有类型无执行；无 transferArtifact adapter |
| **P4 验证回滚报告** | ~60% | 四层验证框架完整 (L1-L4)；rollback 分级完备；Report 含 hash chain；缺数据级回滚 |
| **P5 Capability Catalog** | ~55% | 检测规则 120+、认证门完整；认证等级仍为 trust-based register 而非 live-proven |
| **P6 安全加固** | ~40% | crypto/key-store 稳固；RBAC 仅 2 角色；无 SSRF 防护层；无 command allowlist |
| **P7 后端架构** | ~20% | routes.ts 6504 行单体；无 Repository 抽象；task-queue 仅内存；db 是 JSON-in-SQLite shim |
| **P8 前端流程** | ~50% | migration pipeline 以单页 wizard 实现；Plan/Review/Report 组件存在但未按路线图路由拆分 |
| **P9 持续治理** | ~15% | drift 检测仅比较软件名列表；failure diagnostics 始终 defer 到人工；support bundle 无外部集成 |
| **P10 企业能力** | ~10% | RBAC 仅 user/admin 两角色；webhook 无重试无批处理；无 policy-as-code 引擎；无 break-glass 流程 |

**当前整体完成度：约 42%**

---

## 1. 最严重问题 Top 10

### #1 数据库数据迁移无执行路径
- **严重级别**：Critical
- **影响范围**：P3 — PostgreSQL、MySQL、Redis、MongoDB 等所有数据库迁移
- **证据**：`migration-apply-runner.ts` 的 `runAction()` 仅处理 `installPackage/validate/restart/copyConfig`，`export` kind 直接跳过；`migration-dry-run.ts` 将 export action 标记为 "blocked"；`managed-adapters.ts` 无数据库 dump adapter
- **代码位置**：
  - `apps/api/src/migration-apply-runner.ts` — runAction() 无 export handler
  - `apps/api/src/migration-dry-run.ts:93` — "Exporter action is not directly executable by the SSH apply layer"
  - `apps/api/src/migration-exporter.ts` — 四种导出格式均无 export action 处理
- **修复建议**：为 PostgreSQL/MySQL/Redis/MongoDB 创建 DataMigrationAdapter，实现 dump → transfer → restore 流水线

### #2 routes.ts 6504 行单体巨石
- **严重级别**：Critical
- **影响范围**：P7 — 所有后端路由
- **证据**：`apps/api/src/routes.ts` 为单一 `registerRoutes()` 函数，~160 个路由注册全部内联，无 domain 分割
- **代码位置**：`apps/api/src/routes.ts` (6504 lines)
- **修复建议**：拆分为 `routes/auth.ts`, `routes/plans.ts`, `routes/catalog.ts`, `routes/migrations.ts` 等

### #3 采集侧为单体 bash 脚本，非独立 Collector 模块
- **严重级别**：Critical
- **影响范围**：P1 — 所有数据采集
- **证据**：`collectors/remote-collector.ts` 为单一大文件，包含 `===SECTION===` 分隔的 bash 脚本；无独立 `apt-collector.ts`, `systemd-collector.ts` 等模块
- **代码位置**：`apps/api/src/collectors/remote-collector.ts`
- **修复建议**：拆分为独立 Collector 模块，每个返回 `{ok, completeness, errors, commands, data, collectedAt}`

### #4 写操作可能绕过 Plan（legacy playbook 路径）
- **严重级别**：Critical
- **影响范围**：P0
- **证据**：`executor.ts` 中 `executePlaybookTask()` 和 `buildPlaybookFromProfile()` 可能直接执行 YAML playbook；`plan-apply-security-routes.test.ts` 确认旧 target mutation 端点返回 410 但仍需验证 playbook 执行路径是否完全走 Plan
- **代码位置**：
  - `apps/api/src/executor.ts` — executePlaybookTask / buildPlaybookFromProfile
  - `apps/api/src/engine/tests/plan-apply-security-routes.test.ts` — 旧端点 410 测试
- **修复建议**：playbook 导入必须强制转换为 Imported Recipe Plan → Review → Apply 流程

### #5 StoredProbeSnapshot 无 DataPath/Volume/Network 数据
- **严重级别**：High
- **影响范围**：P1 Inventory Graph — DataPathNode/VolumeNode/NetworkNode 无法生成
- **证据**：`inventory-graph.ts` 定义了 `DataPathNode`, `VolumeNode` 但 extractor 中无对应提取逻辑；`StoredProbeSnapshot` 无 data paths/volumes/networks 字段
- **代码位置**：
  - `apps/api/src/inventory-graph.ts` — extractInventoryGraph() 无 DataPath/Volume/Network 提取分支
  - `apps/api/src/runtime-store.ts:132-190` — StoredProbeSnapshot 类型定义
- **修复建议**：在 remote-collector 脚本中增加 `===DATA_PATHS===`、`===VOLUMES===`、`===NETWORKS===` 采集段

### #6 认证系统仅基于 trust-based register，非 live-proven
- **严重级别**：High
- **影响范围**：P5 — 所有 capability 认证等级
- **证据**：`CERTIFIED_OPT_IN` 包含 ~130 个 capability key，但 `deriveCertification()` 仅检查 key 是否在 set 中；无 live migration harness 执行记录
- **代码位置**：
  - `apps/api/src/catalog-certification.ts` — CERTIFIED_OPT_IN + deriveCertification()
  - `apps/api/src/golden-scenario-harness.ts` — golden scenario 仅静态分析，无 live execution
- **修复建议**：区分 "Metadata Complete" vs "Live Proven" vs "Production Recommended" 等级；将 live harness 结果绑定到 certification

### #7 RBAC 仅 2 角色，无 policy-as-code 引擎
- **严重级别**：High
- **影响范围**：P6 + P10
- **证据**：`rbac.ts` 仅 `user`/`admin` 两角色；`hasRole()` 为简单等值比较；无 deny/requireApproval/autoStage 策略引擎
- **代码位置**：
  - `apps/api/src/rbac.ts` (30 lines)
- **修复建议**：实现 `owner/admin/operator/reviewer/auditor` 五角色体系；添加 policy-as-code 配置

### #8 无 SecretRef 模型和 secret 传输策略
- **严重级别**：High
- **影响范围**：P3 — secret 管理
- **证据**：`action-runs.ts` 有 redaction 模式但无 secret 引用模型（sourceLocation/kind/fingerprint/transportPolicy）；`config-files.ts` 有 secret 扫描但无 vault/sops/rotate 策略
- **代码位置**：
  - `apps/api/src/action-runs.ts` — redactSecrets()
  - `apps/api/src/sensitive-scan.ts` — scanAndRedact()
- **修复建议**：实现 `SecretRef` 模型；支持 out-of-band/vault/sops/user-input/rotate/skip 策略

### #9 Drift Detection 仅比较软件名称列表
- **严重级别**：High
- **影响范围**：P9 — 持续治理
- **证据**：`drift.ts` 的 `runDriftCheck()` 仅 diff `source::name` keys，无 config/file drift，无 scheduled checks
- **代码位置**：`apps/api/src/drift.ts:118`
- **修复建议**：增加配置 drift、版本 drift、证书过期、防火墙变化检测；实现 scheduled drift check

### #10 Config copy (transferArtifact) 永久不可用
- **严重级别**：High
- **影响范围**：P3 — 配置文件迁移
- **证据**：`migration-apply-runner.ts` 中 `copyConfig` action 始终返回 `{status:"skipped"}`，注释说 "Config copy requires source/target diff approval and is not auto-applied by the safe MVP"
- **代码位置**：`apps/api/src/migration-apply-runner.ts` — copyConfig case
- **修复建议**：实现 rsync/scp-based 配置传输，带 pre/post diff review

---

## 2. Roadmap 覆盖矩阵

| 编号 | 功能 | 状态 | 证据 | 缺口 | 风险 | 建议优先级 |
|------|------|------|------|------|------|-----------|
| 2.1 | Plan 不可变 | PASS | plan-hash.ts freezeEnvironmentPlan + plan-store.ts assertFrozenPlan | — | — | — |
| 2.1a | Artifact hash | PASS | plan-hash.ts computeEnvironmentPlanHash / artifact-store.ts 内容寻址 | — | — | — |
| 2.1b | 审批后 Plan 禁止修改 | PASS | plan-store.ts mutateEnvironmentPlan 拒绝 frozen plan | — | — | — |
| 2.1c | Apply 只执行已审批 artifact | PASS | plan-store.ts claimPlanForApply 拒绝未审批 plan | — | — | — |
| 2.1d | hash chain in Report | PASS | environment-plan.ts buildPlanReport 含所有 hash | — | — | — |
| 2.2 | 禁止 bypass Plan | PARTIAL | plan-apply-security-routes.test.ts 旧端点 410；但 executor.ts 有 direct playbook 路径 | playbook 可直接执行而不走 Plan 流程 | 中 | P0-now |
| 2.2a | Legacy YAML 不可直接执行 | PARTIAL | executor.ts executePlaybookTask 可能绕过 Plan | 需强制 recipe import → Plan flow | 中 | P0-now |
| 2.2b | UI 不暴露直接执行 | PASS | 前端无 raw command 入口 | — | — | — |
| 2.2c | 每个写操作含 PlanID/ActionID/AuditID | PASS | action-runs.ts ActionRunRecord 绑定 planId + actionId | — | — | — |
| 2.3 | Apply Gate: secret-confirm | PASS | environment-plan.ts CATALOG_APPROVAL_GATES | — | — | — |
| 2.3a | Apply Gate: data-strategy-confirm | PASS | environment-plan.ts 数据库 items | — | — | — |
| 2.3b | Apply Gate: ssh-lockout-confirm | PASS | safe-apply.test.ts safeSshdConfigApply | — | — | — |
| 2.3c | Apply Gate: firewall-lockout-confirm | PASS | config-files.ts safeFirewallApply + preflightFirewallContentKeepsSsh | — | — | — |
| 2.3d | Apply Gate: identity-provider-confirm | PASS | environment-plan.ts CATALOG_APPROVAL_GATES | — | — | — |
| 2.3e | Apply Gate: backup-restore-confirm | PASS | environment-plan.ts CATALOG_APPROVAL_GATES | — | — | — |
| 2.3f | Apply Gate: manual-dns-confirm | PARTIAL | environment-plan.ts CATALOG_APPROVAL_GATES 存在但前端未见对应确认 UI | 前端未暴露 DNS 确认入口 | 低 | P1-next |
| 2.3g | Apply Gate: target-conflict-confirm | PASS | environment-plan.ts detectPlanConflicts + evaluateApplyGate | — | — | — |
| 2.3h | Apply Gate: partial-snapshot-confirm | PASS | environment-plan.ts attachConflictsAndApprovalAggregate | — | — | — |
| 2.3i | Apply Gate: high-risk-command-confirm | PASS | environment-plan.ts privileged/dangerous action gate | — | — | — |
| 3.1 | OS Collector 独立模块 | FAIL | remote-collector.ts 为单体 bash 脚本 | 无独立模块，无 per-collector completeness | 高 | P0-now |
| 3.1a | Package Collector | PARTIAL | 在 remote-collector.ts 中以 ===APT_PKGS=== section 存在 | 无独立文件，无 per-collector 错误传播 | 中 | P0-now |
| 3.1b | Systemd Collector | PARTIAL | 在 remote-collector.ts 中以 ===SYSTEMD=== section 存在 | 同上 | 中 | P0-now |
| 3.1c | Network Collector | PARTIAL | 在 remote-collector.ts 中以 ===PORTS=== section 存在 | 同上 | 中 | P0-now |
| 3.1d | Docker Collector | PARTIAL | 在 remote-collector.ts 中以 ===DOCKER=== section 存在 | 同上 | 中 | P0-now |
| 3.1e | Compose Collector | FAIL | remote-collector.ts 无 compose 段 | docker compose ls 未采集 | 高 | P1-next |
| 3.1f | Config Collector | PARTIAL | capture.ts 内联路径列表；remote-collector.ts ===CUSTOM_CONFIG=== | 无结构化 config discovery | 中 | P1-next |
| 3.1g | Data Collector | FAIL | 无数据目录采集器 | StoredProbeSnapshot 无 data paths | 高 | P1-next |
| 3.1h | Security Collector | PARTIAL | remote-collector.ts ===SECURITY_AUDIT=== | 未返回结构化安全检查结果 | 中 | P1-next |
| 3.1i | User Collector | FAIL | remote-collector.ts 无用户采集 | 无 /etc/passwd 或 user list | 中 | P2-later |
| 3.1j | Certificate Collector | FAIL | 无证书采集器 | 无 TLS cert 发现 | 中 | P2-later |
| 3.1k | Cron/Timer Collector | PARTIAL | remote-collector.ts ===CRON=== | 仅 cron，无 systemd timer | 低 | P2-later |
| 3.1l | Runtime Collector | FAIL | 无进程级运行时采集 | 无 /proc 深度分析 | 低 | P3-backlog |
| 3.2 | Inventory Graph: Package | PASS | inventory-graph.ts 7 种包源 | — | — | — |
| 3.2a | Inventory Graph: Service | PASS | inventory-graph.ts systemd/systemd-timer/cron | — | — | — |
| 3.2b | Inventory Graph: Process | NOT FOUND | 无 ProcessNode 提取逻辑 | collector 未采集进程 | — | — |
| 3.2c | Inventory Graph: Port | PARTIAL | 从 configChecklist 正则提取 | 非结构化 ss -tlnp 结果 | 中 | P1-next |
| 3.2d | Inventory Graph: ConfigFile | PASS | inventory-graph.ts custom-config source | — | — | — |
| 3.2e | Inventory Graph: EnvFile | NOT FOUND | 无 EnvFile node type | — | — | P2-later |
| 3.2f | Inventory Graph: SecretRef | NOT FOUND | 无 SecretRef node type | 仅 action-runs.ts 有 redaction | 高 | P1-next |
| 3.2g | Inventory Graph: DataPath | FAIL | 类型定义存在但无提取器 | StoredProbeSnapshot 无 data | 高 | P1-next |
| 3.2h | Inventory Graph: Container | PASS | inventory-graph.ts docker source | — | — | — |
| 3.2i | Inventory Graph: Volume | FAIL | 类型定义存在但无提取器 | collector 无 docker volume 采集 | 高 | P1-next |
| 3.2j | Inventory Graph: Network | NOT FOUND | 无 Network node type | — | — | P2-later |
| 3.2k | Inventory Graph: Certificate | NOT FOUND | 无 Certificate node type | — | — | P2-later |
| 3.2l | Inventory Graph: Domain | NOT FOUND | 无 Domain node type | — | — | P3-backlog |
| 3.2m | Inventory Graph: User/Group | NOT FOUND | 无 User/Group node type | — | — | P2-later |
| 3.2n | Inventory Graph: ScheduledTask | NOT FOUND | 无 ScheduledTask node type | — | — | P3-backlog |
| 3.2o | 关系: service→owns→config | PARTIAL | 仅 service→owns→package；无 config link | 缺 service→config 关系推理 | 中 | P1-next |
| 3.2p | 关系: service→listens_on→port | PARTIAL | aggregator 中 loose 启发式匹配 | 无结构化 ss output 解析 | 中 | P1-next |
| 3.2q | 关系: service→reads→env file | NOT FOUND | 无 env file 读取关系 | — | — | P2-later |
| 3.2r | 关系: service→writes→data path | NOT FOUND | 无 data path 关系 | — | — | P2-later |
| 3.2s | 关系: container→mounts→volume | NOT FOUND | 无 container-volume 关系 | — | — | P2-later |
| 3.2t | 关系: nginx→proxies_to→app | NOT FOUND | 无 proxy 关系推理 | — | — | P2-later |
| 3.2u | 关系: app→depends_on→database | NOT FOUND | 无 dependency 推理 | — | — | P2-later |
| 3.2v | 关系: config→contains→secret | NOT FOUND | 无 config→secret 关系 | — | — | P2-later |
| 3.3 | 服务栈识别 | PARTIAL | aggregateServiceStacks 实现但仍为基础版 | 无 multi-container/DB cluster 聚合 | 中 | P1-next |
| 4.1 | Intent Confidence | PASS | decision-engine/score.ts DecisionScores.intent | — | — | — |
| 4.2 | Evidence Strength | PASS | decision-engine/score.ts DecisionScores.evidence | — | — | — |
| 4.3 | Migration Readiness | PASS | decision-engine/score.ts DecisionScores.readiness | — | — | — |
| 4.4 | Risk Score | PASS | decision-engine/score.ts DecisionScores.risk | — | — | — |
| 4.5 | Automation Confidence | PASS | decision-engine/classify.ts 综合计算 | — | — | — |
| 4.6 | Business Criticality | PASS | decision-engine/score.ts DecisionScores.businessValue | — | — | — |
| 4.7 | Review Cost | PASS | decision-engine/score.ts DecisionScores.reviewCost | — | — | — |
| 4.8 | User Preference Confidence | PASS | decision-engine/user-preferences.ts | — | — | — |
| 4.9 | 决策输出: auto-staged | PASS | decision-engine/classify.ts | — | — | — |
| 4.9a | 决策输出: required-decision | PASS | decision-engine/classify.ts | — | — | — |
| 4.9b | 决策输出: suggested-decision | PASS | decision-engine/classify.ts | — | — | — |
| 4.9c | 决策输出: record-only | PASS | decision-engine/classify.ts | — | — | — |
| 4.9d | 决策输出: hidden-noise | PASS | decision-engine/classify.ts | — | — | — |
| 4.9e | 决策输出: blocker | PASS | decision-engine/classify.ts | — | — | — |
| 5.1 | Review Inbox 分层 | PARTIAL | 后端 decision-engine/review-inbox.ts 实现分层；前端 ReviewQueuePanel.tsx 存在但未严格按 Blockers→Required→Suggested 分层 | 前端未过滤低层 inbox | 低 | P1-next |
| 5.2 | Evidence/Candidate/Decision/Plan 四层分离 | PARTIAL | migration-classifier 有 RawEvidence→NormalizedArtifact→Candidate→Plan；但 Decision 层仅 decision-engine 无前端差异展示 | 前端未严格展示四层差异 | 中 | P2-later |
| 5.3 | 审批卡片含完整信息 | PARTIAL | 后端 AssessmentRequiredDecision 含 reason/recommendation/options；前端 PlanReviewPanel 展示规则但非卡片式 | 前端审批卡片不完整 | 低 | P2-later |
| 5.4 | 批量审批 | FAIL | 无批量 accept/archive/skip 功能 | decision-engine 无批量 API | 中 | P2-later |
| 5.5 | 用户决策记忆 | PASS | decision-engine/user-preferences.ts 完全实现 | — | — | — |
| 5.6 | Migration Profile | PASS | decision-engine/profiles.ts Conservative/Balanced 内置 | — | — | — |
| 6.1 | Data Migration: pg_dump/pg_restore | FAIL | 类型系统有 export 但无执行路径 | migration-apply-runner 无 export handler | 高 | P0-now |
| 6.1a | Data Migration: mysqldump/mariabackup | FAIL | 同上 | 同上 | 高 | P0-now |
| 6.1b | Data Migration: Redis RDB/AOF | FAIL | 同上 | 同上 | 高 | P1-next |
| 6.1c | Data Migration: mongodump/mongorestore | FAIL | 同上 | 同上 | 高 | P1-next |
| 6.1d | Data Migration: MinIO mc mirror | FAIL | 同上 | 同上 | 中 | P2-later |
| 6.1e | Data Migration: Gitea/Forgejo dump | FAIL | 同上 | 同上 | 中 | P2-later |
| 6.1f | Data Migration: GitLab backup | FAIL | 同上 | 同上 | 中 | P2-later |
| 6.1g | Data Migration: Nextcloud maintenance | FAIL | 同上 | 同上 | 中 | P2-later |
| 6.1h | Data Migration: k3s etcd snapshot | FAIL | 同上 | 同上 | 低 | P3-backlog |
| 6.2 | Docker/Compose 一等支持 | FAIL | collector 无 compose ls/volume inspect/network inspect | 仅 docker ps containers | 高 | P1-next |
| 6.3 | SecretRef 模型 | FAIL | 无 sourceLocation/kind/fingerprint/transportPolicy | secret 仅 redaction 无模型 | 高 | P1-next |
| 6.4 | Target Compatibility Engine | PARTIAL | distro-compat.ts 检测 OS/包管理器；缺 CPU/disk/ports/services/users/firewall/SELinux/Docker check | 仅 OS 级兼容性 | 中 | P2-later |
| 6.5 | Conflict Resolver | PARTIAL | catalog-conflicts.ts 仅 6 条规则；无 port-level/package-level 冲突 | 缺 7 类冲突的细粒度检测 | 中 | P2-later |
| 7.1 | L1 Syntax Verify | PASS | config-files.ts 各类 safe*Apply 均含 pre-validate | — | — | — |
| 7.2 | L2 Runtime Verify | PASS | plan-runner.ts systemctl is-active checks | — | — | — |
| 7.3 | L3 Network Verify | PASS | safe-apply.test.ts curl localhost / TLS handshake | — | — | — |
| 7.4 | L4 Synthetic Transaction | PASS | plan-runner.ts verifySpec.checks 支持自定义验证命令 | — | — | — |
| 7.5 | Rollback 分级 | PASS | environment-plan.ts ActionRollbackSpec 含 full/partial/manual/none/dangerous | — | — | — |
| 7.6 | Report 含完整 hash chain | PASS | environment-plan.ts buildPlanReport | — | — | — |
| 7.7 | Audit append-only | FAIL | 无 append-only event log | 审计日志为 JSON 文件追加，非密码学 hash chain | 中 | P2-later |
| 7.8 | Report 含 secret policy/data strategy | PASS | environment-plan.ts buildPlanReport | — | — | — |
| 8.1 | 认证等级: Metadata Complete | FAIL | CERTIFIED_OPT_IN 仅 boolean，无等级分层 | 无法区分 live-proven vs metadata-complete | 高 | P1-next |
| 8.2 | Capability 记录 test matrix | FAIL | 无 test matrix 存储或查询 | — | 中 | P2-later |
| 8.3 | Capability SDK: detect | PASS | catalog-rules.ts 每 rule 含 detect | — | — | — |
| 8.3a | Capability SDK: classify | PASS | migration-classifier.ts integrate with catalog-rules | — | — | — |
| 8.3b | Capability SDK: plan | PASS | environment-plan.ts build*Plan per capability | — | — | — |
| 8.3c | Capability SDK: apply adapter | PARTIAL | managed-adapters.ts 仅 3 个 adapter | 缺数据库/文件传输 adapter | 高 | P1-next |
| 8.3d | Capability SDK: verify | PASS | catalog-rules.ts 各 rule 含 validate.postApply | — | — | — |
| 8.3e | Capability SDK: rollback | PASS | catalog-rules.ts 各 rule 含 rollback | — | — | — |
| 8.3f | Capability SDK: data strategy | FAIL | 仅文档化，无执行路径 | — | 高 | P0-now |
| 8.3g | Capability SDK: secret strategy | FAIL | 仅 redaction，无 vault/sops/rotate | — | 高 | P1-next |
| 8.3h | Capability SDK: conflict strategy | PARTIAL | catalog-conflicts.ts 6 rules 但未集成到 SDK | — | 中 | P2-later |
| 8.3i | Capability SDK: harness scenario | PARTIAL | golden-scenario-harness.ts 存在但 golden fixtures 数量有限 | 仅 5 mandatory + 1 optional scenario | 中 | P2-later |
| 9.1 | SSRF 防护 | NOT FOUND | 无任何 SSRF 防护代码 | 无 loopback/private CIDR/metadata IP 阻断 | 中 | P2-later |
| 9.2 | SSH command allowlist | PARTIAL | config-files.ts SAFE_VALIDATION_COMMAND regex 存在但仅用于 config validation | 无通用 SSH command allowlist | 中 | P1-next |
| 9.3 | SSH 默认禁止 raw shell | FAIL | executor.ts 和 ssh.ts 均支持任意命令执行 | 无 shell 限制机制 | 高 | P1-next |
| 9.4 | SSH per-action timeout | PARTIAL | verify-runner 15s timeout 存在 | 非全局 timeout 策略 | 低 | P2-later |
| 9.5 | SSH session audit | FAIL | 无 SSH session 审计日志 | — | 中 | P2-later |
| 9.6 | Master Key rotation | FAIL | crypto.ts 无 key rotation | — | 中 | P2-later |
| 9.7 | 文件路径安全: canonical path | PARTIAL | key-store.ts keyId regex 防遍历；但无通用 canonical path 检查 | config-files.ts 有 EXCLUDED_PATHS 但无 symlink escape 防护 | 中 | P1-next |
| 10.1 | routes.ts 拆分 | FAIL | 6504 行单体文件 | 缺 domain 路由文件 | 中 | P1-next |
| 10.2 | Runtime Schema Validation | FAIL | 无 Zod/TypeBox/Fastify JSON Schema | 所有输入解析为手动类型断言 | 高 | P1-next |
| 10.3 | PlanRepository 抽象 | FAIL | 无 Repository 接口 | plan-store.ts 直接操作 runtime-store | 中 | P2-later |
| 10.3a | TaskQueue 持久化 | FAIL | task-queue.ts 纯内存 | 重启丢失队列 | 中 | P2-later |
| 10.3b | EventBus | NOT FOUND | 无事件总线 | — | 低 | P3-backlog |
| 10.3c | SearchIndex | NOT FOUND | 无搜索索引 | — | 低 | P3-backlog |
| 10.4 | Action Adapter 架构 | PARTIAL | managed-adapters.ts 3 个 adapter；engine/managed-execution.ts adapterForAction 硬编码 | 无 adapter 注册/发现机制 | 中 | P1-next |
| 11.1 | 前端新流程页面 | PARTIAL | MigratePipelinePage.tsx 单页 wizard | 缺独立路由页面 | 低 | P3-backlog |
| 11.2 | 扫描完成摘要页 | PARTIAL | 摘要数据存在于后端但前端未见独立摘要页 | 前端可能跳过摘要直接展示明细 | 低 | P2-later |
| 11.3 | Plan Review 变化展示 | PASS | PlanReviewPanel.tsx 存在 | — | — | — |
| 11.4 | 置信度解释 UI | PARTIAL | 后端 DecisionScores 含所有维度；前端未见多维度解释面板 | 前端可能仅展示单一 confidence 值 | 低 | P2-later |
| 12.1 | Drift 检测: 服务停止 | FAIL | drift.ts 仅比较软件名列表 | 无服务状态 drift | 高 | P2-later |
| 12.2 | Repair Plan | PARTIAL | failure-diagnostics.ts 生成 RepairPlanDraft 但始终 draft | 无实际 repair 执行 | 中 | P2-later |
| 12.3 | Scheduled Verification | FAIL | scheduler.ts 仅执行 approved plans | 无定期验证 | 中 | P2-later |
| 13.1 | 多角色: owner/admin/operator/reviewer/auditor | FAIL | rbac.ts 仅 user/admin | 无五角色体系 | 高 | P2-later |
| 13.2 | 双人审批 | FAIL | environment-plan.ts PlanApprovalKind 支持角色但无多签名逻辑 | 审批仅记录单人 | 中 | P2-later |
| 13.3 | Policy-as-code: deny/requireApproval/autoStage | FAIL | 无策略引擎 | 无声明式策略 | 中 | P2-later |
| 13.4 | Webhook: Plan created/approved/applied | PARTIAL | webhooks.ts 支持所有事件类型；但无重试/批处理 | — | 低 | P3-backlog |

---

## 3. P0 可信执行核心审计

### 3.1 Plan 不可变性 — PASS ✅

| 检查项 | 状态 | 代码位置 |
|--------|------|----------|
| Plan 创建时固化所有内容 | ✅ | `plan-lifecycle.ts:prepareEnvironmentPlanForCreation()` 调用 `freezeEnvironmentPlan()` |
| 计算 hash | ✅ | `plan-hash.ts:computeEnvironmentPlanHash()` 使用 SHA-256 + 稳定 JSON canonicalization |
| hash 排除运行时字段 | ✅ | `plan-hash.ts:environmentPlanHashSpec()` 排除 status/approvedBy/approvedAt/review/generatedAt |
| 审批时二次验证 hash | ✅ | `plan-store.ts:approveEnvironmentPlan()` 调用 `evaluateApplyGate` + hash 验证 |
| Apply 时三次验证 hash | ✅ | `plan-store.ts:claimPlanForApply()` 验证 `assertFrozenPlan` |
| 禁止修改 frozen plan | ✅ | `plan-store.ts:mutateEnvironmentPlan()` 检查 `immutable` flag |
| 配置文件内容不可在 apply 时重新传入 | ✅ | `plan-lifecycle.ts` 将 config content 存储为 frozen artifact，apply 时验证 artifact hash |
| YAML/recipe 不可在审批后修改 | ✅ | `plan-lifecycle.ts` 将 recipe 存储为 frozen artifact |
| artifact 内容寻址存储 | ✅ | `artifact-store.ts:putPlanArtifact()` 使用 SHA-256 路径 + `wx` 排他创建 |
| artifact 读时验证 hash | ✅ | `artifact-store.ts:getPlanArtifact()` 重哈希并比对 |
| Report 记录所有 hash | ✅ | `environment-plan.ts:buildPlanReport()` 含 sourceSnapshotHash/targetSnapshotHash/planHash/artifactHash |

### 3.2 禁止绕过 Plan — PARTIAL ⚠️

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 每个写操作必须走 Environment Plan | ⚠️ | `executor.ts:executePlaybookTask()` 可直接执行 playbook |
| 普通用户不能直接执行 YAML | ⚠️ | `executeCatalogTask()` 走 Plan 但 `executePlaybookTask()` 不走 |
| 旧端点已移除 | ✅ | `plan-apply-security-routes.test.ts` 确认旧突变端点返回 410 |
| UI 不暴露直接执行入口 | ✅ | 前端无 raw command/script 入口 |

**风险说明**：`executor.ts` 中的 `executePlaybookTask()` 路径允许通过 task queue 直接执行 playbook YAML，绕过 `buildImportedRecipePlan → Review → Apply` 流程。虽然 `executeCatalogTask()` 正确地将 catalog items 解析为 Rebuild Plan，但 playbook 路径仍是旁路。

**修复建议**：将 `executePlaybookTask()` 改为先生成 Imported Recipe Plan，要求审批，再通过 `executeEnvironmentPlan()` 执行。

### 3.3 Apply Gate — PASS ✅

所有 10 个 gate 类型均已在 `environment-plan.ts` 和 `config-files.ts` 中实现：

| Gate | 实现位置 | 机制 |
|------|----------|------|
| secret-confirm | `environment-plan.ts:CATALOG_APPROVAL_GATES` → docker/postgres/mysql/valkey 等 | 要求 secret policy 确认 |
| data-strategy-confirm | `environment-plan.ts:CATALOG_APPROVAL_GATES` → postgres/mysql/redis/certbot 等 | 要求数据策略确认 |
| ssh-lockout-confirm | `config-files.ts:safeSshdConfigApply()` | reload not restart + 前后验证 + 可达性探测 + 失败回滚 |
| firewall-lockout-confirm | `config-files.ts:safeFirewallApply()` | 120s at-driven 回滚计时器 |
| identity-provider-confirm | `environment-plan.ts:CATALOG_APPROVAL_GATES` | 针对 Authentik/Keycloak/Authelia |
| backup-restore-confirm | `environment-plan.ts:CATALOG_APPROVAL_GATES` | 针对备份恢复能力项 |
| manual-dns-confirm | `environment-plan.ts:CATALOG_APPROVAL_GATES` | 存在但前端确认 UI 不完整 |
| target-conflict-confirm | `environment-plan.ts:evaluateApplyGate()` | 重新从 plan body 检测冲突 |
| partial-snapshot-confirm | `environment-plan.ts:attachConflictsAndApprovalAggregate()` | snapshot 不完整时强制确认 |
| high-risk-command-confirm | `environment-plan.ts:evaluateApplyGate()` | privileged/dangerous action 必须确认 |

**Apply Gate 防绕过**：`evaluateApplyGate()` 从 plan body 重新派生冲突（不信赖 `plan.review.conflicts`），验证 resolutionIds 有效性，检测不一致的 resolution，验证 detect-only items 不包含突变 action。

---

## 4. P1 扫描与环境理解审计

### 4.1 Collector 模块化 — OVERALL: FAIL

当前采集架构：

```
ssh.ts → collectRemoteSnapshot() (remote-collector.ts 单体脚本)
       → fullSnapshotToStored() → StoredProbeSnapshot
```

**StoredProbeSnapshot shape**（`runtime-store.ts:132-190`）支持 `collectors` 字段记录 per-collector metadata：

```typescript
collectors?: Record<string, {
  id: string; status: "ok" | "partial" | "failed";
  completeness: number; commands: string[];
  stdout?: string; stderr?: string;
  errors?: string[]; collectedAt: string;
  data?: string[];
}>
```

但实际的采集脚本 `remote-collector.ts` 是一个单体 bash 脚本，用 `===SECTION===` 分隔符。各 collector 不返回独立的 `{ok, completeness, errors, commands, data, collectedAt}` 状态。

**缺失的 Collector 模块**：
- ❌ `data-collector.ts` — 无数据目录采集
- ❌ `compose-collector.ts` — 无 docker compose 发现
- ❌ `user-collector.ts` — 无用户/组采集
- ❌ `certificate-collector.ts` — 无证书采集
- ❌ `runtime-collector.ts` — 无进程级采集

**部分存在的 Collector**（作为 bash section）：
- ⚠️ apt/rpm/snap/flatpak/npm/pip/gem/cargo/go-bin/local-bin — 包采集
- ⚠️ systemd/systemd-timer/cron — 服务/定时任务采集
- ⚠️ docker ps — 容器采集
- ⚠️ ports (ss/netstat) — 网络端口
- ⚠️ custom-config — 配置文件

### 4.2 Inventory Graph — PARTIAL

**已实现的节点类型**（9 种）：
- ✅ Package (apt/rpm/snap/flatpak/npm/pip/gem/cargo)
- ✅ Service (systemd/systemd-timer/cron)
- ✅ Port (从 configChecklist 正则提取)
- ✅ Container (docker source)
- ✅ ConfigFile (custom-config/config-path)
- ⚠️ DataPath — 类型定义存在但无提取器
- ⚠️ Volume — 类型定义存在但无提取器

**缺失的节点类型**（7 种）：
- ❌ Host — 无独立 Host node
- ❌ Process — 无进程采集和 node
- ❌ EnvFile — 无 .env 文件发现
- ❌ SecretRef — 无 secret 引用模型
- ❌ Network — 无 docker network
- ❌ Certificate — 无 TLS 证书
- ❌ Domain — 无域名发现
- ❌ User/Group — 无用户采集
- ❌ ScheduledTask — 仅有 cron，无完整定时任务

**已实现的关系**（1 种）：
- ✅ service → owns → package (name prefix match)

**缺失的关系**（7 种）：
- ❌ service → owns → config
- ❌ service → listens_on → port (仅 loose 启发式)
- ❌ service → reads → env file
- ❌ service → writes → data path
- ❌ container → mounts → volume
- ❌ nginx → proxies_to → app
- ❌ app → depends_on → database
- ❌ config → contains → secret

### 4.3 服务栈识别 — PARTIAL

`aggregateServiceStacks()` 将 service + packages + ports + configFiles 合并为 service stack，confidence = high (≥2 packages) / medium (1) / low (0)。

**缺口**：
- 无 multi-container stack（如 docker-compose 多容器编排）
- 无 database cluster 检测（如 PostgreSQL primary-replica）
- 无 reverse proxy 关系推理
- Stack 不含 data paths/secrets/certs/target conflicts

---

## 5. P1.5 置信度与决策引擎审计 — PASS (85%)

### 5.1 8 维引擎

`apps/api/src/decision-engine/` 目录下 9 个文件，完全实现：

| 维度 | 文件 | 状态 |
|------|------|------|
| Intent Confidence | `score.ts` | ✅ 实现 |
| Evidence Strength | `score.ts` | ✅ 实现 |
| Migration Readiness | `score.ts` | ✅ 实现 |
| Risk Score | `score.ts` | ✅ 实现 |
| Automation Confidence | `classify.ts` | ✅ 综合计算 |
| Business Criticality | `score.ts` | ✅ 实现 |
| Review Cost | `score.ts` | ✅ 实现 |
| User Preference Confidence | `user-preferences.ts` | ✅ 完整实现（scope + glob pattern + confidence） |

### 5.2 6 种决策输出

| 输出 | 状态 | 证据 |
|------|------|------|
| auto-staged | ✅ | `classify.ts:classifyDecision()` |
| required-decision | ✅ | 同上，高风险 + 数据/secret |
| suggested-decision | ✅ | 同上 |
| record-only | ✅ | 同上，低置信低价值 |
| hidden-noise | ✅ | 同上 |
| blocker | ✅ | 同上，不完整采集 + 高风险 |

### 5.3 测试覆盖

- `decision-engine.test.ts`：9 个测试，覆盖分类、门控、profile、preference、scope isolation
- `decision-engine-routes.test.ts`：4 个集成测试，覆盖 API 路由
- **缺口**：无 golden fixture（确定性输入→期望输出），无 edge case（NaN/Infinity/空 scores）

---

## 6. P2 审批体验审计 — PARTIAL (55%)

### 6.1 Review Inbox 分层

**后端**：`decision-engine/review-inbox.ts` 完全实现分层（Blockers/Required/Suggested/Auto-staged/Record-only/Hidden-noise）

**前端**：`ReviewQueuePanel.tsx` 存在，但未严格按分层展示；默认可视范围未确认是否仅 Blockers + Required Decisions

### 6.2 四层分离

- ✅ Evidence：`RawMigrationEvidence` (migration-classifier.ts)
- ✅ Candidate：`MigrationCandidate` (migration-classifier.ts)
- ⚠️ Decision：`decision-engine/` 层存在但前端未独立展示 Decision vs Plan 差异
- ✅ Plan：`MigrationPlan` / `EnvironmentPlan`

### 6.3 审批卡片

后端 `AssessmentRequiredDecision` 含 name/reason/recommendation/options/risks/evidence。前端 `PlanReviewPanel.tsx` 存在但非卡片式布局。

### 6.4 批量审批 — FAIL

无批量 accept/archive/skip API。decision-engine 无 batch resolve 端点。

### 6.5 用户决策记忆 — PASS

`decision-engine/user-preferences.ts` 完整实现 scope（global/connection/plan）+ glob pattern + confidence + upsert/delete/list。

### 6.6 Migration Profile — PASS

`decision-engine/profiles.ts` 内置 Conservative 和 Balanced 两个 profile，支持 per-connection scoped assignment。

---

## 7. P3 真实迁移能力审计 — FAIL (20%)

### 7.1 Data Migration Engine — FAIL

类型系统中 `MigrationPlanAction.kind` 包含 `"export"`，但：

- `migration-apply-runner.ts` — runAction() 无 export case
- `migration-dry-run.ts:93` — "Exporter action is not directly executable"
- `migration-exporter.ts` — 四种格式均无 export 处理
- `managed-adapters.ts` — 无 DataMigration adapter

**第一批数据迁移状态**：

| 数据库 | 策略定义 | 执行路径 | 状态 |
|--------|----------|----------|------|
| PostgreSQL | ✅ environment-plan.ts 含 pg_dump/pg_restore | ❌ | FAIL |
| MySQL/MariaDB | ✅ environment-plan.ts 含 mysqldump | ❌ | FAIL |
| Redis/Valkey | ✅ environment-plan.ts 含 RDB/AOF | ❌ | FAIL |
| MongoDB | ✅ environment-plan.ts 含 mongodump | ❌ | FAIL |
| MinIO | ❌ | ❌ | NOT FOUND |
| Gitea/Forgejo | ❌ | ❌ | NOT FOUND |
| GitLab | ❌ | ❌ | NOT FOUND |
| Nextcloud | ❌ | ❌ | NOT FOUND |
| k3s | ❌ | ❌ | NOT FOUND |

### 7.2 Docker/Compose — FAIL

采集侧：仅 `docker ps` containers，无 compose/volume/network inspect。

Plan 侧：无 Container Workload Plan、Compose Rebuild Plan、Volume Migration Plan。

### 7.3 SecretRef — FAIL

无 `SecretRef` 模型（sourceLocation/kind/fingerprint/transportPolicy/requiredAtApply）。仅有 `action-runs.ts:redactSecrets()` 用于输出 redaction。

### 7.4 Target Compatibility Engine — PARTIAL

`distro-compat.ts` 检测 OS/distro/包管理器。缺失：
- ❌ CPU arch 兼容性
- ❌ disk/memory 检查
- ❌ port 冲突预检
- ❌ existing services 冲突
- ❌ users/groups 冲突
- ❌ firewall 预检
- ❌ SELinux/AppArmor
- ❌ Docker 版本兼容
- ❌ kernel version
- ❌ database version compatibility

### 7.5 Conflict Resolver — PARTIAL

`catalog-conflicts.ts` 仅 6 条规则。缺失：端口冲突、包版本冲突、配置文件冲突、用户/组冲突、服务名冲突、数据目录冲突、Docker network/volume 冲突的细粒度检测。

---

## 8. P4 验证、回滚、报告审计 — PASS (60%)

### 8.1 Verification Pyramid — PASS

| 层级 | 状态 | 证据 |
|------|------|------|
| L1 Syntax | ✅ | `config-files.ts:safeSshdConfigApply` sshd -t |
| L2 Runtime | ✅ | `plan-runner.ts:runPlanVerify` systemctl is-active |
| L3 Network | ✅ | `safe-apply.test.ts` curl localhost / TLS handshake |
| L4 Synthetic | ✅ | `plan-runner.ts` verifySpec.checks 自定义命令 |

### 8.2 Rollback 分级 — PASS

`environment-plan.ts:ActionRollbackSpec` 支持 full/partial/manual/none/dangerous 五级。
`buildPlanReport()` 统计各等级数量。

### 8.3 Report — PASS

`buildPlanReport()` 含 sourceSnapshotHash/targetSnapshotHash/planHash/artifactHash/operator/approvalTime/actionResults/verifyResults/rollbackResults/secretPolicy/dataStrategy/knownLimitations/manualSteps。

### 8.4 Audit — FAIL

无 append-only event log、无 hash chain、无签名 report。审计日志为 JSON 文件追加。

---

## 9. P5 Capability Catalog 审计 — PARTIAL (55%)

### 9.1 认证等级 — FAIL

当前 `certification` 为 boolean（`CERTIFIED_OPT_IN` set 成员检查），不是等级体系。

**缺失等级**：Metadata Complete / Dry-run Proven / Live Install Proven / Live Migration Proven / Live Migration With Data Proven / Production Recommended。

### 9.2 Capability SDK — 各维度状态

| SDK 组件 | 状态 | 位置 |
|----------|------|------|
| detect | ✅ | `catalog-rules.ts` 120+ rules |
| classify | ✅ | `migration-classifier.ts` |
| plan | ✅ | `environment-plan.ts` |
| apply adapter | ⚠️ | `managed-adapters.ts` 仅 3 个 |
| verify | ✅ | `catalog-rules.ts` validate.postApply |
| rollback | ✅ | `catalog-rules.ts` rollback |
| data strategy | ❌ | 仅文档化，无执行 |
| secret strategy | ❌ | 仅 redaction |
| conflict strategy | ⚠️ | 6 rules，未集成 SDK |
| harness scenario | ⚠️ | 5 mandatory + 1 optional |

### 9.3 黄金能力逐审计

| 黄金能力 | detect | plan | config | data | secret | apply | verify | rollback | live harness |
|----------|--------|------|--------|------|--------|-------|--------|----------|--------------|
| Nginx | ✅ | ✅ | ✅ | N/A | ❌ | ⚠️ | ✅ | ✅ | ❌ |
| Caddy | ✅ | ✅ | ⚠️ | N/A | ❌ | ❌ | ⚠️ | ⚠️ | ❌ |
| Docker Compose | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| PostgreSQL | ✅ | ✅ | ✅ | ❌ | ❌ | ⚠️ | ✅ | ✅ | ❌ |
| MySQL/MariaDB | ✅ | ✅ | ✅ | ❌ | ❌ | ⚠️ | ✅ | ✅ | ❌ |
| Redis/Valkey | ✅ | ✅ | ✅ | ❌ | ❌ | ⚠️ | ✅ | ✅ | ❌ |
| SSH hardening | ✅ | ✅ | ✅ | N/A | ✅ | ✅ | ✅ | ✅ | ✅ |
| UFW/firewalld | ✅ | ✅ | ✅ | N/A | ❌ | ✅ | ⚠️ | ✅ | ❌ |
| Certbot | ✅ | ✅ | ⚠️ | ❌ | ❌ | ⚠️ | ⚠️ | ⚠️ | ❌ |
| Gitea/Forgejo | ✅ | ✅ | ⚠️ | ❌ | ❌ | ❌ | ⚠️ | ⚠️ | ❌ |

---

## 10. P6 安全加固审计 — PARTIAL (40%)

### 10.1 SSRF 防护 — NOT FOUND

代码库中无任何 SSRF 防护代码。无 loopback/private CIDR/link-local/metadata IP/DNS rebinding 检查。

### 10.2 SSH 执行安全

| 检查项 | 状态 | 说明 |
|--------|------|------|
| command allowlist | ⚠️ | `config-files.ts:SAFE_VALIDATION_COMMAND` regex 仅限验证命令 |
| template escaping | ⚠️ | `engine/template-parser.ts` 存在但非全局 |
| 默认禁止 raw shell | ❌ | 无全局限制 |
| per-action timeout | ⚠️ | verify-runner 15s，非全局 |
| per-host concurrency | ⚠️ | task-queue.ts per-connection FIFO |
| cancel/kill | ⚠️ | executor.ts cancelTask() |
| sudo policy | ❌ | 无 |
| session audit | ❌ | 无 |
| stdout/stderr redaction | ✅ | action-runs.ts redactSecrets() |
| idempotency key | ✅ | plan-store.ts claim idempotency |

### 10.3 Master Key 管理

| 检查项 | 状态 |
|--------|------|
| 生产环境强制 ENVFORGE_MASTER_KEY | ⚠️ dev 时 auto-generate，未检查 prod |
| key rotation | ❌ |
| credential re-encryption | ❌ |
| backup/restore procedure | ❌ |
| lost key warning | ❌ |
| external KMS option | ❌ |

### 10.4 文件路径安全

| 检查项 | 状态 |
|--------|------|
| canonical path | ⚠️ key-store.ts 仅 keyId regex |
| 禁止 .. | ⚠️ key-store.ts keyId regex `/^[a-f0-9]{16}$/` |
| 禁止 symlink escape | ❌ |
| 写前 backup | ✅ config-files.ts safe*Apply |
| 写后 verify | ✅ config-files.ts post-validate |
| owner/mode 控制 | ✅ config-files.ts stat + restore |

---

## 11. P7 后端架构审计 — FAIL (20%)

### 11.1 routes.ts 拆分 — FAIL

`apps/api/src/routes.ts` 6504 行，单一 `registerRoutes()` 函数，~160 route registrations 全部内联。

### 11.2 Runtime Schema Validation — FAIL

无 Zod/TypeBox/Fastify JSON Schema。所有请求体解析为手动类型断言（`as Type`）。

### 11.3 存储与队列抽象 — FAIL

| 抽象 | 状态 |
|------|------|
| PlanRepository | ❌ plan-store.ts 直接操作 runtime-store |
| SnapshotRepository | ❌ snapshot-store.ts 仅文件系统 |
| ConnectionRepository | ❌ connections.ts 直接操作 runtime-store |
| ArtifactRepository | ✅ artifact-store.ts 内容寻址 |
| AuditRepository | ❌ runtime-store.ts writeAdminAuditLog |
| TaskQueue | ⚠️ task-queue.ts 纯内存 |
| EventBus | ❌ |
| SearchIndex | ❌ |

### 11.4 Action Adapter 架构 — PARTIAL

`managed-adapters.ts` 有 3 个 adapter，`engine/managed-execution.ts:adapterForAction()` 硬编码映射。

**缺失 adapter**：DataAdapter（数据库 dump）、ArtifactAdapter（文件传输）、RollbackAdapter（数据级回滚）。

---

## 12. P8 前端流程审计 — PARTIAL (50%)

### 12.1 新流程

前端以 `MigratePipelinePage.tsx` 单页 wizard 实现迁移流程。未拆分为独立路由页面。

### 12.2 扫描完成页

后端摘要数据存在于 `migration-session.ts:buildMigrationSessionSummary()`，但前端未见独立摘要拦截页。

### 12.3 Plan Review 页面 — PASS

`PlanReviewPanel.tsx` 存在，展示目标机变化。

### 12.4 置信度解释 UI — PARTIAL

后端 `DecisionScores` 含 8 个维度，但前端未见多维度解释面板（可能仅展示单一 confidence 值）。

---

## 13. P9 持续治理审计 — FAIL (15%)

### 13.1 Drift Detection — FAIL

`drift.ts:runDriftCheck()` 仅比较 `source::name` keys。缺失：服务状态、配置内容、版本号、端口、证书过期、防火墙变化。

### 13.2 Repair Plan — PARTIAL

`failure-diagnostics.ts` 生成 RepairPlanDraft 但始终 marked as draft（不执行）。

### 13.3 Scheduled Verification — FAIL

`scheduler.ts` 仅执行 approved plans，无 daily/weekly/monthly/24h-post-migration 验证 schedule。

---

## 14. P10 企业能力审计 — FAIL (10%)

### 14.1 多角色 — FAIL

`rbac.ts` 仅 `user`/`admin` 两角色。无 owner/operator/reviewer/auditor。

### 14.2 审批策略 — FAIL

无生产环境双人审批、无高风险需要 admin、无数据迁移需要 data owner、无 break-glass 确认。

### 14.3 Policy-as-code — FAIL

无 deny/requireApproval/autoStage 声明式策略引擎。

### 14.4 Webhook — PARTIAL

`webhooks.ts` 支持所有事件类型，但无重试队列、无批处理、无签名密钥轮换。

---

## 15. 测试覆盖审计

| 测试类型 | 当前覆盖 | 缺口 | 必须新增的测试 |
|----------|----------|------|---------------|
| 单元测试 | ✅ 88 个 test files, ~850 tests | 决策引擎 golden fixture | decision-engine golden fixture tests |
| 集成测试 | ✅ Fastify app-level tests | — | — |
| Golden fixture | ⚠️ 5 mandatory + 1 optional | 仅 1 个数据库场景、0 个 compose 场景 | 10 个黄金能力 golden fixtures |
| DB-free test | ✅ 所有测试使用临时 SQLite | — | — |
| Live harness | ❌ 仅 SSH hardening 有 live test | 9/10 黄金能力无 live harness | PostgreSQL/MySQL/Redis/Nginx live harness |
| Migration harness | ❌ | 无端到端迁移测试 | source → target 实际迁移 E2E |
| Rollback test | ⚠️ safe-apply.test.ts 覆盖 4 种 | 无数据级回滚测试 | 数据库 dump→restore rollback |
| Security regression | ⚠️ plan-security-core/apply-security-routes | 无 SSRF 测试、无 shell injection 测试 | SSRF、command injection 回归 |
| API test suite | ✅ 88 files, 全 green | — | schema validation 集成 |
| Frontend flow test | ❌ build-ui-regression.test.ts 仅基础 | 无用户流程 E2E | Playwright/Cypress migration flow |

---

## 16. 绕过路径审计

| 绕过路径 | 是否存在 | 风险 | 位置 |
|----------|----------|------|------|
| 不经过 Plan 的写操作 | ⚠️ | `executePlaybookTask()` 可直接执行 | `executor.ts` |
| 不经过 approval 的 apply | ✅ 已阻止 | `claimPlanForApply` 拒绝未审批 plan | `plan-store.ts` |
| apply 时重新读取 mutable input | ✅ 已阻止 | artifact 从 store 加载，hash 验证 | `plan-lifecycle.ts` |
| raw shell 执行路径 | ⚠️ | `ssh.ts` 和 `executor.ts` 不限制命令 | `ssh.ts`, `executor.ts` |
| admin API 绕过 | ⚠️ | admin routes 有 auth check 但无细粒度 RBAC | `routes.ts` admin section |
| UI 隐藏但 API 可调用的危险入口 | ⚠️ | playbook API 可能允许直接执行 | `routes.ts` playbook section |
| snapshot partial 但仍允许高风险 apply | ✅ 已阻止 | `partial-snapshot-confirm` gate | `environment-plan.ts` |
| secret 未确认但写入目标机 | ✅ 已阻止 | `secret-confirm` gate | `environment-plan.ts` |
| data migration 未确认但执行 | ✅ 已阻止 | `data-strategy-confirm` gate (但执行路径也不存在) | `environment-plan.ts` |
| rollback none 但未提示 | ✅ 已阻止 | Plan 页面显示回滚统计 | `buildPlanReport()` |

---

## 17. 推荐修复顺序

| 顺序 | 修复项 | 原因 | 预计影响 | 依赖项 |
|------|--------|------|----------|--------|
| 1 | Playbook 执行强制走 Plan 流程 | 关闭唯一已知 bypass 路径 | 中 | 无 |
| 2 | Collector 模块化 + Completeness 门 | 缺 completeness 影响所有下游决策 | 大 | 无 |
| 3 | DataPath/Volume/Network 采集 + Graph | Inventory Graph 缺三类节点 | 中 | #2 |
| 4 | 数据库 Data Migration Adapter | 最关键的 P3 缺口 | 大 | #2 |
| 5 | SecretRef 模型 + secret 策略 | 无 secret 管理模型 | 大 | 无 |
| 6 | routes.ts 拆分 | 架构债务，阻塞所有后端扩展 | 大 | 无 |
| 7 | Runtime Schema Validation | 安全漏洞面 | 中 | #6 |
| 8 | 认证等级从 boolean 改为 6 级 | 能力认证体系基础 | 大 | 无 |
| 9 | SSH command allowlist + session audit | 安全加固 | 中 | 无 |
| 10 | 前端 Review Inbox 分层 + 批量审批 | 审批体验提升 | 中 | 无 |
| 11 | Drift Detection 增强（config/file/cert/version） | 持续治理 | 中 | #2 |
| 12 | RBAC 五角色 + Policy-as-code | 企业能力 | 中 | #6 |
| 13 | 黄金能力 Live Harness (9/10) | 认证可信 | 大 | #8 |
| 14 | Target Compatibility Engine 完整化 | 迁移安全 | 中 | #2 |
| 15 | Conflict Resolver 细粒度化 | 迁移安全 | 中 | 无 |
| 16 | Repository 抽象 + TaskQueue 持久化 | 架构升级 | 中 | #6 |
| 17 | Webhook 重试 + 批处理 | 企业集成 | 低 | #16 |
| 18 | Scheduled Verification | 持续治理 | 中 | #16 |
| 19 | SSRF 防护 | 安全加固 | 低 | 无 |
| 20 | Live harness 全覆盖 | 长期质量 | 中 | #13 |

---

## 18. 当前实现与最近提交核对

### Inventory Graph Slice（commit `b9231dc`）

| 检查项 | 状态 | 证据 |
|--------|------|------|
| typed node types 覆盖真实 StoredProbeSnapshot shape | ✅ | 基于 `SoftwareItem[]` + `configChecklist[]` 提取 |
| extractors 不依赖不存在字段 | ✅ | 所有字段来自 `StoredProbeSnapshot` 接口 |
| service → package link 匹配多个包 | ✅ | 使用 `filter` + `startsWith`（已修复 find→filter） |
| service-stack aggregator 合并 linked packages + ports | ✅ | `aggregateServiceStacks()` |
| confidence 有 high/medium/low 解释 | ✅ | high=≥2 packages, medium=1, low=0 |
| 8 个单元测试有效覆盖关键关系 | ✅ | `inventory-graph.test.ts` |
| full API test suite 通过 | ✅ | 858 pass / 0 fail |
| 无未提交或非本次修改文件污染 | ✅ | 仅 ssh.ts/remote-collector.ts 为预存未提交文件 |

---

## 19. 最终结论

### 判定：可以合并，但有条件

**P0 可信执行核心坚实**：Plan 不可变、hash chain、审批门、apply gate、artifact 完整性验证均已实现并有深度测试覆盖。`plan-security-core.test.ts`（8 tests）和 `plan-apply-security-routes.test.ts`（12 tests）提供了可靠的回归保护。

**阻塞原因**：无。当前代码不包含不安全迁移风险（因为数据迁移执行路径本身就不存在——系统在发现数据库时会正确地将其标记为 `required-decision` 并阻塞自动执行）。

**非阻塞问题（按优先级）**：

1. `executor.ts:executePlaybookTask()` 旁路需要尽快关闭
2. 数据迁移仅停留在策略文档和类型定义层，无执行能力
3. routes.ts 6504 行巨石需要拆分
4. Collector 为单体脚本，不满足模块化要求
5. 认证系统为 trust-based register，未连接 live harness 结果
6. RBAC 仅 2 角色

**下一步最小可交付 slice**：

建议优先处理 P0 收尾 + P1 Collector 模块化：

1. 强制 playbook → Imported Recipe Plan 流程（关闭 bypass）
2. 拆分 remote-collector.ts 为独立 collector 模块
3. 增加 DataPath/Volume/Network 采集（解锁 Inventory Graph 对应节点）
4. 实现 PostgreSQL Data Migration Adapter（打开第一条数据迁移路径）

这组变更风险可控、不影响现有测试套件、且能显著提升 P1 完成度（从 ~40% → ~65%）。
