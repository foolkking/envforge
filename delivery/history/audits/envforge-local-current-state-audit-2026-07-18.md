---
title: EnvForge 本地现状取证审计报告
status: archived
classification: historical-evidence
not_source_of_truth: true
original_path: audits/envforge-local-current-state-audit-2026-07-18.md
archived_at: '2026-07-19'
source_sha256: b4d5c4f72ac7b8ac7cd77bf17541aae81eb2b4e9dddc2e873051ba18fe8c0c15
---

> 历史证据：保留原始内容、日期和当时结论。不得作为当前设计或当前代码事实源；使用前必须在当前 HEAD 重新验证。

# EnvForge 本地现状取证审计报告

审计日期：2026-07-18

审计分支：`main`

审计 Commit：`a77f597b6f23a8d05d8186ad18ddf7b8a8f9190f`

审计性质：只读取证、测试与安全的本地只读运行；不是发布认证，也不是功能验收
报告结论：**当前是有限场景的迁移产品**，更准确地说，是一个带真实审批/哈希/有限 SSH 执行链的环境盘点与软件重建系统；它尚不能迁移完整业务、真实数据、Secret、Cutover 或长期存档。

## 1. 审计方法、边界与证据等级

本报告以当前生产代码和真实调用链为首要证据，其次是当前测试、当前安全本地运行、Git 状态。README、旧审计、TODO、类型、UI 文案、fixture 和 mock 只用于定位，不用于单独证明能力存在。

成熟度采用用户指定定义：

| 等级 | 本报告中的使用方式 |
|---|---|
| M0 | 没有找到生产对象或生产路径 |
| M1 | 只有类型、字段、UI、说明、策略或计划壳 |
| M2 | 有真实逻辑，但生产链断开或依赖生产不会生成的输入 |
| M3 | 生产调用链已连接，且有单元/集成测试；仍需说明 mock 边界 |
| M4 | 本轮从本地 UI/API 实际完成完整流程 |
| M5 | 本轮有 disposable target/live harness 的真实迁移与验证证据 |

本轮没有向外部服务器发起连接或写操作，没有运行 live/certification harness，没有 Apply，没有修改产品代码、schema、测试或前端。仓库根目录存在 `.env`，本报告只记录其存在，不读取或输出内容；所有本地 API/Web 尝试均改用隔离的审计目录和禁用外部 OAuth/SMTP 的环境变量。

## 2. Git 与本地环境基线

| 项目 | 事实 |
|---|---|
| 分支 | `main` |
| HEAD | `a77f597b6f23a8d05d8186ad18ddf7b8a8f9190f` |
| 与远端关系 | 审计开始时 `main...origin/main`，ahead/behind 为 0/0 |
| 审计开始时 tracked diff | 无 |
| 审计前既有 untracked | `docs/audit-report-2026-07-08.md` |
| 本轮允许新增 | 本报告 |
| Node | `v20.13.1` |
| npm | `10.5.2` |
| 根 `.env` | 存在；未读取、未输出，可能影响未隔离启动 |
| 外部 SSH/DB/对象存储 | 未连接 |

审计开始时最近提交包含 Phase 7R-A/B/C 和 Phase 7R-0，但这些历史报告没有覆盖本轮代码事实判断。

## 3. 仓库、技术栈与真实架构

```text
当前技术栈：npm workspaces + TypeScript
API 框架：Fastify 4 + ssh2
Web 框架：React 18 + Vite
数据库：SQLite；核心 runtime document 存于 system_kv，另有关系表
任务队列：legacy task 使用进程内 Map/FIFO；Environment Plan Apply 不走队列
对象存储：不存在；Plan artifact 和 snapshot 使用本地文件系统
实时进度机制：legacy task 有 SSE；Environment Plan Apply 没有 SSE/WebSocket 进度
认证方式：Bearer web session / API token，用户与 session 持久化到 runtime DB
测试框架：node:test；Web 为 Playwright
本地启动方式：npm run dev:api / npm run dev:web；生产构建 npm run build
```

工作区：`apps/api`、`apps/web`、`packages/core`、`packages/collectors`、`packages/restorers`、`packages/cli`。仓库还包含 capability manifests、golden fixtures、scenario harness、Dockerfile 与 compose 文件。

当前真实主链是：

```text
React Web
→ apps/web/src/api.ts
→ apps/api/src/routes.ts（约 6,168 行、228 个 route registration，仍是单体）
→ environment-plan / migration-classifier / inventory-graph 等 domain 函数
→ plan-store / runtime-store
→ SQLite system_kv + 本地 artifact-store
→ POST /api/plans/:id/apply 内同步 executeEnvironmentPlan()
→ managed adapter / ssh2
→ 独立请求触发 Verify 或 Rollback
→ GET report 时动态生成 PlanReport
```

缺失层：没有通用 Project 聚合层，没有 durable Plan worker，没有对象存储，没有 Transfer/Checkpoint/Cutover 层。`apps/api/src/server.ts:22,44,50` 会在注册路由和 listen 前等待 `initializeDatabase()`；但 JSON migration、task healing 和部分 rule loading 位于 listen 后（`server.ts:56-65`），ready 语义并非所有后台初始化均完成。

Plan artifact 是本地 content-addressed 文件，带 SHA-256 和 `0600` 权限（`apps/api/src/artifact-store.ts:14-86`），不是长期 archive/object storage。SQLite 核心文档由 `db-sqlite.ts:167-184` 的 `system_kv` 与 `db-store.ts:25-47` 读写；写串行依赖进程内 Mutex，不是多进程 CAS。

## 4. 核心领域对象现状

| 对象 | 是否存在 | 成熟度 | 主要字段/语义 | 持久化位置 | 真实使用位置 | 主要缺口 |
|---|---|---:|---|---|---|---|
| Project | NOT FOUND | M0 | 无 | 无 | 无 | 用户直接操作 Plan |
| Migration Project | PARTIAL | M1 | `StoredMigrationSession` 仅是 pipeline session | SQLite runtime document | Migrate 页面/API | 不是通用 Project，无生命周期/资产聚合 |
| Build Project | NOT FOUND | M0 | 无 | 无 | 无 | Build 直接创建 Plan |
| Environment Plan | PASS | M3 | type/status/items/actions/target/approval/hash/artifacts | SQLite | Build/Migrate 共用 | 无版本与 target drift 失效 |
| Draft Plan | PARTIAL | M1 | 只有同一 Plan 的 draft/review status | SQLite | Plan 状态机 | 无可编辑草稿对象 |
| Approved Plan | PASS | M3 | 同一 Plan 上的 approval record + approvedPlanHash | SQLite | review/apply gate | 非独立对象 |
| Plan Version | NOT FOUND | M0 | 无 version/parent/revision | 无 | 无 | 目标变化只能建新 Plan，系统不自动版本化 |
| Artifact | PASS | M3 | id/path/hash/kind/action binding | 本地 FS + Plan metadata | imported recipe/config change/apply | 非长期存储；迁移 config 未绑定内容 |
| Execution Run | NOT FOUND | M0 | 无统一 Run | 无 | 无 | Apply/Verify/Rollback 没有统一 run 模型 |
| Apply Run | PASS | M3 | planId/hash/idempotency/status/result | SQLite | apply claim/finalize | 同步 HTTP；崩溃后无恢复 |
| Verification Run | PARTIAL | M2 | 最近一次 verify result 数组 | Plan record | `/verify` | 无 runId/历史/恢复 |
| Rollback Run | PARTIAL | M2 | 最近一次 rollback result 数组 | Plan record | `/rollback` | 无 runId；结果语义不可靠 |
| Snapshot | PASS | M3 | StoredProbeSnapshot、collector status/error/completeness、surfaces | connection record/SQLite | assessment/graph/routes | 不是数据备份；另有孤立 CLI manifest |
| Inventory Graph | PASS | M3 | 15 node kinds、typed relations、completeness | 不持久化，按 snapshot 派生 | assessment/read routes | 不进入 migration planner；部分边只 fixture 可达 |
| Service Stack | PARTIAL | M3 | service + package/port/config/container + enriched refs/confidence | 不持久化，派生 | assessment/read routes | 不是 Workload；不进入 Plan |
| Workload | NOT FOUND | M0 | 无正式对象 | 无 | 无 | 无业务级聚合/审批/执行 |
| Workload Blueprint | NOT FOUND | M0 | 无 | 无 | 无 | 无部署方法生成 |
| Dataset | NOT FOUND | M0 | 只有 DataPath/Volume 和策略 decision | 无一等对象 | assessment | 无 manifest/transfer/consistency |
| SecretRef | PASS | M3 | sourceLocation/fingerprint/redacted | Snapshot/Graph | assessment | 只有引用，无交付 |
| Secret Requirement | NOT FOUND | M0 | 无 | 无 | 无 | 无 provider、注入、清理、验证 |
| Transfer Session | NOT FOUND | M0 | 无 | 无 | 无 | 无文件/数据库/volume 传输 |
| Checkpoint | NOT FOUND | M0 | 无 | 无 | 无 | 无 byte/step resume |
| Cutover | NOT FOUND | M0 | 无状态机 | 无 | 只有 catalog review 文案 | 无 drain/final sync/traffic switch |
| Report | PARTIAL | M3 | planId/hash/applyRun/artifacts/actionRuns/verify | GET 时动态投影 | Plan Center/report route | 非不可变完成证书；可在 Apply 前生成 |
| Audit Event | PARTIAL | M2 | Plan history、ActionRun、decision/admin audit 分散存在 | SQLite | 多个子域 | 无统一 append-only audit ledger |
| Capability | PASS | M3 | CatalogItem/manifest/certification/permissions/gates | code + runtime catalog | Build/catalog | “official”不等于 live proven |
| Capture Archive | NOT FOUND | M0 | 无 | 无 | 无 | 无真实封存物 |
| Restore Plan | PARTIAL | M2 | stages/actions/dryRunOnly | CLI/local JSON | 旧 `/api/restore/plan` 与 CLI | 与 Environment Plan/Apply 分离；`--apply` 明确未实现 |

### 核心对象问题的明确答案

1. Build 和 Migrate 最终都使用 `EnvironmentPlan`；前置输入不同。
2. 一旦 Migrate session 被提升为 Environment Plan，两者共用 review/apply/verify/rollback/report routes。
3. 没有 Project 层；用户直接操作 Build Plan，Migrate 只有 session。
4. Plan 不支持版本；每次重新规划产生新 ID。
5. approved payload 通过 freeze、planHash、artifactHash 和 create-only store 保护，成熟度 M3。
6. 更换 targetConnectionId 必须新 Plan；同一 connection 的 snapshot 变化不会自动失效旧 Plan。
7. ApplyRun 与 Plan 分离；VerifyRun/RollbackRun 没有独立对象。
8. ApplyRun/ActionRun 持久化；active execution 不可恢复。
9. 浏览器刷新后可重新读取已完成结果；API 重启可重新打开数据库，但不会恢复正在执行的 Apply。
10. 动态 Report 引用当前 Plan/hash/artifacts/ActionRuns/ApplyRun；ActionRun 没有 applyRunId，重复运行的强关联仍不足。

## 5. Build 当前真实能力

Build 的 Web 路径是 `CapabilityCatalogPage` → 创建 `rebuild` 或 `imported-recipe` Plan → `PlanReviewPanel` review/apply → Plans Center 独立 verify/rollback/report。Build 创建 Plan 前必须已有 target connection。

### 5.1 输入能力

| 输入 | 状态 | 成熟度 | 事实 |
|---|---|---:|---|
| certified Capability Catalog | PASS | M3 | 单项/批量创建 rebuild Plan |
| 软件目录 | PARTIAL | M3 | 只面向 certified catalog item；非通用任意包工作负载 |
| Recipe / YAML | PARTIAL | M3 | configurable item 可渲染、冻结为 artifact，经 approved artifact adapter 执行 |
| 模板 | PARTIAL | M2/M3 | 预定义 capability/recipe；无通用 Workload template |
| 用户自定义配置 | PARTIAL | M3 | 显式 config-change 有 artifact；Build catalog 通用配置不足 |
| Docker Compose | PARTIAL | M1 | 可预览/下载，不接 Build Apply |
| 自定义 systemd 服务 | NOT FOUND | M0 | 没有通用 Build 输入/部署闭环 |
| 源码仓库 | NOT FOUND | M0 | 无 clone/build/deploy 链 |
| Secret | NOT FOUND | M0 | 只有 gate/文案，无 delivery |
| 目标机参数 | PARTIAL | M3 | connection + distro/preflight；不是完整 target blueprint |

### 5.2 输出与执行

Build 能生成 frozen Plan、approval gates、planHash、artifactHash、包安装/删除、有限 service restart/enable、显式 config change、显式 raw reviewed command、verify command 和 rollback metadata。它不能通用生成/执行用户组、完整 systemd unit、Compose 项目、firewall/TLS delivery、Secret Requirement、数据恢复或业务事务。

| Build 输出 | 状态 | 成熟度 | 说明 |
|---|---|---:|---|
| Draft Plan | PARTIAL | M1 | 同一 Plan 的初始状态，不是可编辑/版本化对象 |
| 不可变 Approved Plan | PASS | M3 | approval 绑定 planHash，payload create-only |
| 安装包动作 | PASS | M3 | apt/dnf 等有限映射 |
| 配置动作 | PARTIAL | M3 | 显式 config-change 有 artifact；通用 catalog/migration config 不完整 |
| 用户/组动作 | NOT FOUND | M0 | 无通用 Build action |
| systemd 动作 | PARTIAL | M2/M3 | enable/restart 等命令；不生成完整 unit/drop-in |
| Docker 动作 | PARTIAL | M2/M3 | Docker host/package 或 image pull；非 Compose workload |
| Docker Compose 动作 | NOT FOUND | M0/M1 | 只有 preview/download |
| 防火墙/TLS 动作 | PARTIAL | M1/M2 | 零散 catalog command/gate，非通用交付 |
| Secret Requirement | NOT FOUND | M0 | 无交付对象 |
| Verify 动作 | PARTIAL | M2/M3 | command-level，存在 fail-open 边界 |
| Rollback 动作 | FAIL | M2 | 有反向命令，但不构成安全业务回滚 |

生产 Apply 入口确实重新校验 Plan、approval、target 和 Artifact hash，然后通过 ssh2 adapter 执行动作（`engine/managed-execution.ts`、`managed-adapters.ts`）。但本轮没有 disposable target，相关测试使用 adapter/SSH stub，因此定为 M3，不是 M4/M5。

| Capability/场景 | Detect | Plan | Apply | Verify | Rollback | Live Proven | 成熟度 |
|---|---|---|---|---|---|---|---:|
| Nginx 软件环境 | PARTIAL | PASS | PARTIAL | PARTIAL | FAIL | NOT FOUND | M3 |
| PostgreSQL 软件环境（不含数据） | PARTIAL | PASS | PARTIAL | PARTIAL | FAIL | NOT FOUND | M3 |
| Docker 主机软件 | PARTIAL | PASS | PARTIAL | PARTIAL | FAIL | NOT FOUND | M3 |
| Docker Compose 项目 | PARTIAL | PARTIAL | NOT FOUND | NOT FOUND | NOT FOUND | NOT FOUND | M1/M2 |
| configurable imported recipe | NOT APPLICABLE | PASS | PARTIAL | FAIL | NOT FOUND | NOT FOUND | M3 |
| 自定义源码 + systemd 业务 | NOT FOUND | NOT FOUND | NOT FOUND | NOT FOUND | NOT FOUND | NOT FOUND | M0 |

### 5.3 Build 的重要执行边界

- `backupFile`、`restoreFile`、`createDirectory` 等动作词汇没有对应通用 managed 执行能力；`transferArtifact` 也没有数据传输实现。
- generic adapter 没有 verify command 时会把“apply assumed sufficient”当成功；多个检查只执行第一个，很多 catalog 检查包含 `|| true`。
- imported recipe runner 可以记录 `verifyFailed` 但仍返回 `ok: true`；recipe adapter只读 `lastApply.ok`，存在假成功路径（`engine/runner.ts:279-350`、`engine/managed-execution.ts:155-176`）。
- Apply 成功即把 Plan 标为 `succeeded`；显式 `/verify` 是后续人工请求，不是自动 commit gate。
- 手工 rollback 对 package 未使用 ActionRun 的 `existedBefore` 快照，可能卸载目标原有包；rollback 部分失败仍可能把 Plan 写为 `rolled-back`。

## 6. Migrate、业务识别与工作负载

真实源分析链：connection → SSH collector → persisted snapshot → candidate report → assessment/graph/stack → decisions → target selection → migration Plan promotion。Raw Evidence、Candidate、Decision、Plan 都存在，但 planner 只消费 `snapshot.software` 与 `configChecklist`（`migration-classifier.ts:223-245`），不消费 InventoryGraph/ServiceStack。

Config/Data decision 被持久化并影响 readiness，但不改变 actions。migration session 的旧 Apply route 返回 410；用户必须将 session 提升为统一 Environment Plan。

### 6.1 关系覆盖

| 关系 | 当前能否提取 | 提取器/数据来源 | 当前测试 | 是否参与 Plan |
|---|---|---|---|---|
| service → package | PARTIAL | 名称启发式；software/systemd | synthetic graph tests | 否 |
| service → config | FAIL | 文件名包含 service 名；live collector 基本不生成所需 config node | fixture | 否 |
| service → port | FAIL | 理论经 process→port；live process 不带 listeningPorts | 手工注入字段 | 否 |
| service → process | PARTIAL | binary basename 与 unit 同名 | unit test | 否 |
| service → env file | FAIL | 需要 envFile.serviceName；live parser不填 | 手工注入字段 | 否 |
| service → data path | PARTIAL | WorkingDirectory/ExecStart 路径或目录名启发式 | unit test | 否 |
| service → secret | PARTIAL | env/config→fingerprint；service→env 通常断开 | redaction tests | 否 |
| reverse proxy → upstream | NOT FOUND | 无 extractor | 无 | 否 |
| application → database | NOT FOUND | `dependsOn` 只声明，未生成 | 无 | 否 |
| container → volume | FAIL | 需要 containerNames；live volume parser不填 | fixture | 否 |
| container → network | FAIL | 需要 containers/subnet；live parser不填 | fixture | 否 |
| workload → domain | NOT FOUND | 无 Workload | 无 | 否 |
| workload → certificate | NOT FOUND | 无 Workload | 无 | 否 |
| domain → certificate | PARTIAL | path/SAN 匹配 | unit test | 否 |
| service → scheduled task | PARTIAL | task→service/process | unit test | 否 |
| service → user/group | PARTIAL | user→process 间接边 | unit test | 否 |

ServiceStack 只有 service 拥有 package 或 port 时才会输出。自定义 systemd app 即使出现在 service 列表，也经常不会成为 stack。`service-stack-phase5.test.ts` 手工注入了 live collector 不会产生的 `listeningPorts`、`envFile.serviceName` 等字段，不能证明生产采集链能重建同样关系。

### 6.2 自部署个人网站判定

`Nginx → reverse proxy → Node/Python app → PostgreSQL → uploads → .env → domain/TLS → cron` **不能**被识别为一个完整业务工作负载：

- Nginx、Node/PostgreSQL 更可能成为分散 package/service/candidate。
- 自定义 systemd unit 只采 unit 名和有限 WorkingDirectory/ExecStart 派生路径，不采完整 unit/drop-in/dependencies。
- `.env` 只保留 key names/fingerprint，通常不绑定 service。
- domain、certificate、cron 是独立 evidence；无 Workload 聚合。
- 无 proxy upstream、application→database、部署来源推断。
- 无 Git/Package/Container/Binary/目录复制来源分类，无自动部署方法生成。
- 无法识别时，系统可让用户对 unknown/candidate/config/data 做人工 decision，但这些 decision 不会补全可执行 Workload blueprint。

结论：当前能识别“环境中的技术对象及若干弱关系”，不能识别并迁移完整业务。

## 7. 服务状态取证

### 7.1 可重建期望状态

当前真实采集只有：running/enabled service 名称、部分 WorkingDirectory/ExecStart 派生目录、进程 executable token、粗粒度 cron/timer、进程用户。没有完整采集 disabled/inactive/failed、load state/substate、unit file 内容、drop-in、ExecStartPre/ExecStop、WorkingDirectory 原始合同、User/Group、Environment/EnvironmentFile 归属、Restart/RestartSec、Wants/Requires/After/Before、limits/cgroup/security capability、socket activation、timer 状态、container restart policy/healthcheck/Compose depends_on/mount/network membership。

因此“active”只证明采集时服务运行，不等于可以恢复期望状态。

### 7.2 持久与临时状态

| 状态类型 | 当前采集 | 当前建模 | 当前参与 Plan | 当前可恢复 | 缺口 |
|---|---|---|---|---|---|
| 软件定义 | PASS | package/service/candidate | 是 | PARTIAL | 仅有限 catalog 软件 |
| 配置元数据 | PARTIAL | config bundle/path | readiness/review | FAIL | migration config bytes/artifact 缺失 |
| 持久文件数据 | PARTIAL | DataPath + size | strategy decision | FAIL | 无 transfer/manifest/checksum |
| 数据库状态 | PARTIAL | database candidate/dry-run intent | review/gate | FAIL | 无 dump/restore/data verify |
| Docker volume | PARTIAL | Volume metadata | strategy decision | FAIL | 无 container mapping/backup/restore |
| 服务期望状态 | PARTIAL | enabled/running 名称 | 仅 catalog restart | FAIL | unit/dependency/restart policy 缺失 |
| 临时进程状态 | PARTIAL | PID/user/CPU/MEM/executable | 否 | FAIL | 无 process tree/args/resume |
| 请求/连接/事务/锁 | NOT FOUND | 无 | 否 | NOT APPLICABLE | 应 drain/quiesce，不应复制 |
| 内存 cache/session/queue/leader | NOT FOUND | 无 | 否 | NOT APPLICABLE | 应外置持久化或重启重建 |
| Cutover 生命周期 | NOT FOUND | 无 | 否 | FAIL | 无状态机 |

瞬时状态中 HTTP 请求、TCP 连接、数据库活动事务、文件锁、leader election、in-memory session/cache、未持久化队列、当前 worker job、临时文件与正在执行的 timer 不应直接“迁移”；合理方法是 drain、quiesce、checkpoint 到持久存储或明确丢弃后 restart。当前系统既未编排这些步骤，也没有向用户形成完整、强制的限制合同。

当前系统迁移的主要是：**软件定义 + 少量配置/数据元数据 + 采集时服务状态证据**；不是持久数据、完整服务期望状态或临时运行状态。

## 8. 数据迁移真实能力

| 数据类型 | Detect | Plan | Execute | Resume | Verify | Rollback | Live Proven |
|---|---|---|---|---|---|---|---|
| PostgreSQL | PARTIAL M2/M3 | PARTIAL M3 dry-run | NOT FOUND M0 | M0 | M0 | M0 | M0 |
| 文件数据集 | PARTIAL M2/M3 | PARTIAL M1/M2 | M0 | M0 | M0 | M0 | M0 |
| Docker Volume | PARTIAL M2 | PARTIAL M1/M2 | M0 | M0 | M0 | M0 | M0 |

| 策略 | 是否存在真实执行路径 | 当前事实 |
|---|---|---|
| `none` | 否 | 可作为 catalog/decision 语义，未执行数据动作 |
| `recreate` | PARTIAL | 软件/服务可重建；没有一等 Dataset recreate executor |
| logical dump/restore | 否 | PostgreSQL 只有 sanitized、blocked command template |
| official backup/restore | 否 | 多数只在 catalog audit/review 文案和 gate 中 |
| quiesced rsync | 否 | `rsync-copy` 可被选择，但没有 quiesce/rsync/final sync executor |
| snapshot/volume | 否 | 无 volume snapshot/backup/restore path |
| replication | 否 | 无 replication session/WAL/lag/cutover |
| manual | PARTIAL M2 | 可记录人工 decision/review，不会自动完成 |
| blocked | PASS M3 | 安全阻断状态真实存在；它证明“不能执行”，不是迁移能力 |

### 8.1 PostgreSQL

`postgres-data-migration.ts` 只构造 intent 和 sanitized command templates；所有 template 都有 `blocked: true`，dry-run 有 `executionBlocked: true`。没有真实 DB connection、pg_dump、pg_dumpall、pg_basebackup、pg_restore、psql、artifact storage、transfer、cleanup、table/row/extension verification。

当前可发现 package/service、catalog config/data paths，并可能估算路径或 volume bytes；不采 database list、roles、grants、extensions、encoding/locale、tablespaces、精确 data size、active connections。catalog 中的 `psql -c 'select 1'` 是软件验证命令或说明，不是已执行的数据迁移闭环。

### 8.2 文件数据集

collector 只扫描若干常见根目录的一级目录并用 `du` 给出粗略 size。没有 include/exclude、symlink policy、完整 owner/mode、ACL/xattr、sparse/large-file 处理、checksum、rsync executor、partial/final sync、冲突、源目标一致性验证。

### 8.3 Docker Volume

能采 name/driver/scope/mountpoint 的有限元数据；live parser 不提供可靠 container mapping。没有 backup、transfer、restore、target conflict 或 verification。

明确答案：

1. 当前主要是让用户选择/确认策略，没有数据执行器。
2. 只对部分路径有粗略 size，不能可靠估算完整业务数据量。
3. 不能估算可信停机窗口。
4. 有 process evidence，但不能可靠发现“正在写该 dataset”的进程。
5. 不支持 initial sync + final sync。
6. 不支持一致性冻结/quiesce。
7. 不验证源目标数据一致。
8. 中断后无 transfer checkpoint/resume；只能人工重来。

## 9. Secret 交付链

| 环节 | 当前实现 | 成熟度 | 代码/测试证据 | 缺口 |
|---|---|---:|---|---|
| 发现 Secret 引用 | PASS | M3 | EnvFile key names + SecretRef fingerprint | 不代表值可恢复 |
| 不保存明文 | PASS | M3 | collector/graph redaction tests | 只覆盖该采集链 |
| Secret Requirement | NOT FOUND | M0 | 无正式对象 | 无 required-at-restore contract |
| Provider 选择 | NOT FOUND | M0 | 仅 `secret-out-of-band` decision | 无 user-input/Vault/SOPS/target-existing/regenerate/rotate adapter |
| Apply 前检查 | PARTIAL | M2 | config decision/readiness gate | 不检查真实 Secret 是否存在 |
| 执行时获取 | NOT FOUND | M0 | 无 | 无 provider fetch |
| 注入目标 | NOT FOUND | M0 | 无 | 无 target materialization |
| 服务验证 | NOT FOUND | M0 | 无 continuity check | 缺失 Secret 不能被可靠拦截 |
| 临时材料清理 | NOT FOUND | M0 | 无 | 无生命周期 |
| Report 只记录策略 | PARTIAL | M2/M3 | review/gate projection | 没有交付结果可记录 |

Snapshot 的结构化 EnvFile/SecretRef 路径不保存值。Plan artifact 对显式 config/recipe 有哈希保护，但 rendered YAML 或用户变量仍可能包含用户输入；显式 verify/rollback 的 stdout/stderr 只截断、不统一 redaction，存在敏感输出落库/API 返回风险。当前没有能力保证数月后重新提供 Secret。

## 10. 目标机兼容性与冲突

目标机出现位置：Build 在 Plan 前必须选择；Migrate 在源 scan/assessment/decision 后、Plan promotion 前必须选择。

Build 有 distro 探测、package manager compatibility、preflight，以及根据 target snapshot `software` 精确名称推断已有 capability 和 catalog conflict。UI 把成功取得 distro 当作“Target Snapshot done”，这不等于完整目标快照。

| 兼容性项 | 当前覆盖 |
|---|---|
| OS/distro/package manager | PARTIAL/PASS；规则比对 |
| CPU architecture | snapshot 可采，未形成完整 Plan gate |
| systemd | preflight/readiness 可探测，迁移 Plan 不建模 unit 合同 |
| kernel/libc/filesystem | NOT FOUND 或只有原始 snapshot 信息 |
| disk/memory | snapshot 可见，未形成容量规划/强 gate |
| port/user/group/path/service name | 只有 catalog conflict/零散 review；无完整目标冲突引擎 |
| database version | NOT FOUND |
| Docker/security module/firewall/certificate/domain/external dependency | 零散 catalog 文案/规则；无统一 compatibility result |

当前结果主要是 compatible/untested/unsupported 与 catalog conflict/gate，不支持完整的 requires conversion/manual/blocked compatibility envelope。targetConnectionId 进入 Plan hash；同 connection 的 target snapshot 改变不会自动让旧 Plan 失效、生成 PlanVersion 或要求重新审批。

## 11. Cutover

| Cutover 阶段 | 当前实现 | 成熟度 | 证据 | 缺口 |
|---|---|---:|---|---|
| 目标预部署 | PARTIAL | M3 | package/service Environment Plan | 非业务预部署 |
| initial sync | NOT FOUND | M0 | 无 | 无数据传输 |
| 预切换验证 | PARTIAL | M3 | catalog command/systemctl/curl | 非业务合同 |
| 等待维护窗口 | NOT FOUND | M0 | 只有 review 文案 | 无 scheduler/state |
| source drain | NOT FOUND | M0 | 无 | 无请求/队列处理 |
| stop accepting writes/quiesce | NOT FOUND | M0 | 无 | 无一致性点 |
| final sync | NOT FOUND | M0 | 无 | 无 |
| start target | PARTIAL | M3 | catalog restart/enable | 无依赖顺序 |
| DNS/IP/LB/代理切换 | NOT FOUND | M0 | 只有 Pi-hole/AdGuard 等 review 文案 | 无执行/回滚 |
| 业务验证 | PARTIAL | M2/M3 | 个别 curl | 无 synthetic transaction |
| observation window | NOT FOUND | M0 | 无 | 无 commit deadline |
| commit migration | NOT FOUND | M0 | 无 | 无状态 |
| source resume | NOT FOUND | M0 | 无 | 无 |
| rollback | PARTIAL | M2/M3 | package/config generic | 无 data/traffic rollback |

没有正式 Cutover 对象或可恢复状态机。普通 Action 列表不构成可恢复 Cutover 编排。

## 12. Verification 与 Rollback

| 验证类型 | 状态 | 事实 |
|---|---|---|
| artifact/config hash | PASS | Apply 前 plan/artifact hash 校验 |
| config syntax | PARTIAL | nginx -t 等 catalog command |
| process/service | PARTIAL | systemctl is-active 或 fallback |
| network | PARTIAL | 个别端口/HTTP 命令 |
| TLS | PARTIAL | 证书元数据/个别命令，无完整端到端 gate |
| data | FAIL | 无 dump restore 后一致性验证 |
| dependency | FAIL | 无 Workload dependency contract |
| synthetic business transaction | NOT FOUND | 无用户定义 write/read/delete 成功条件 |

`nginx -t`、`systemctl is-active`、部分 curl/health、`psql SELECT 1` 文案或命令存在；docker health、TLS 和 DB check 仅零散 capability 命令。它们最多证明语法/进程/端口，不能证明业务数据和用户流程可用。

具体边界：`nginx -t` 和部分 `systemctl is-active` 可成为 action verify；Docker 通常退化为 `docker ps`/endpoint；TLS 主要是证书元数据而非握手/域名全链验证；PostgreSQL 最多是 `psql -c 'select 1'` 或 service fallback。table count、row count、extension 对比、用户定义 HTTP check、write/read/delete transaction 均未形成正式成功合同。

验证失败不会形成自动 rollback/commit 状态机。Rollback 没有 full/partial/manual/none/dangerous 的可靠一等分类；service 状态 rollback 明确为人工，data/cutover 后新写入没有处理。当前 rollback 主要是有限反向命令或 `.envforge.bak`，不是业务回滚。

## 13. 进度、检查点和断点续传

| 能力 | 当前实现 | 是否持久化 | 重启后恢复 | 测试 | 成熟度 |
|---|---|---|---|---|---:|
| ApplyRun claim/result | PASS | 是 | 只可读取终态 | 集成测试 | M3 |
| ActionRun terminal record | PASS | 是 | 可读取 | 集成测试 | M3 |
| Plan durable queue/worker | NOT FOUND | 否 | 否 | 无 | M0 |
| Plan 实时进度 | NOT FOUND | 否 | 否 | 无 | M0 |
| legacy task SSE | PARTIAL | history 是，queue 否 | running 被标 failed | tests | M2/M3 |
| idempotency | PASS | 是 | 可拒绝重复 | tests | M3 |
| retry/timeout/cancel | PARTIAL | 零散 | 不恢复 | tests/stubs | M2 |
| checkpoint/resume | NOT FOUND | 否 | 否 | 无 | M0 |
| transfer manifest/chunk/checksum/bandwidth | NOT FOUND | 否 | 否 | 无 | M0 |
| browser reconnect | PARTIAL | 可重查完成结果 | active apply 无可靠订阅 | smoke 未启动 | M2 |
| API/worker crash recovery | FAIL | running claim可遗留 | 无 resume | 无 live test | M0/M1 |

实际 Apply 链为：approved Plan → 同步 HTTP handler claim → execute actions → terminal ActionRun → finalize ApplyRun → response。浏览器关闭而 API 仍活着时调用“可能继续”，但没有后台任务保证；API 重启会让 active Plan/ApplyRun 停在 applying/running，没有恢复扫描。当前既不是 byte-resumable，也不是 step-resumable；是 restart-required/manual。

## 14. Preserve & Restore / 只有源服务器

已有近似基础：`SnapshotManifest` 类型、local JSON snapshot store、纯函数 `createRestorePlan()`、旧 `/api/restore/plan`、CLI `restore` dry-run。它们是 M1/M2 的 metadata/plan primitive。

| 能力 | 状态 | 事实 |
|---|---|---|
| Capture Plan | NOT FOUND | 无一致性 capture 计划 |
| 部署材料 | FAIL | collector manifest 的 `files` 默认空 |
| 长期数据存储 | NOT FOUND | 无 object storage |
| Dataset Manifest | NOT FOUND | `SyncedFileRef` 只有类型，生产不填 |
| Secret 恢复策略 | PARTIAL M1 | redaction/out-of-band 文案，无交付 |
| 数据一致性点 | NOT FOUND | 无 quiesce/snapshot |
| manifest/hash | PARTIAL M1/M2 | 文件类型有 sha256；无真实 archive |
| archive encryption | NOT FOUND | `encrypted` 仅字段 |
| retention/delete | NOT FOUND | 无 archive lifecycle |
| integrity scrub | NOT FOUND | 无 |
| compatibility envelope | NOT FOUND | 无可长期解释的目标边界 |
| Restore Plan | PARTIAL M2 | 只生成 stages/labels；config action无内容 |
| Restore Apply | NOT FOUND | CLI `--apply` 明确 throw |
| restore drill | NOT FOUND | 无 live proof |
| 释放源服务器门禁 | NOT FOUND | 无 completeness/restore-drill gate |

没有目标机时，可以保存源 connection snapshot、assessment 和 decisions；但其中没有真实数据、配置材料、Secret、版本锁定、一致性点或长期存储。Snapshot 不能长期作为恢复材料，Plan artifact 只适合当前本地 Apply。当前绝不能据此安全释放旧服务器。

## 15. 前端真实流程

```text
Build 当前实际步骤：选择目标 → certified catalog → distro/preflight → 创建 Plan → Plan Center review/apply → 手工 verify/rollback/report
Migrate 当前实际步骤：source → analysis → select → unknown → config/data → plan → target → “apply” → report
Plan 当前承担的职责：冻结输入、风险/冲突/gate、审批、hash、有限动作执行入口
Run 当前展示方式：Plans Runs 页主要显示 legacy /api/tasks；不是 Plan Apply journal
目标机首次出现位置：Build 在 Plan 前；Migrate 在源分析/决策之后、Plan promotion 前
数据策略出现位置：Migrate Config/Data decision；只持久化策略
Secret 处理位置：Migrate 的 secret-out-of-band decision
Cutover 是否有页面：无
业务验证是否有页面：只有 Plan verify/result，不是业务成功合同
封存恢复是否有入口：无正式 Web 入口
```

| 页面/步骤 | 当前数据来源 | 状态 | 实际证明边界 |
|---|---|---|---|
| Dashboard | 真实 Plan/connection/snapshot API | PASS M3 | 状态是 Plan 派生，不是业务 E2E |
| Build | 真实 catalog/compatibility/Plan API | PARTIAL M3 | 没有本轮 live target |
| Migrate Source/Scan | 真实 connection/session/snapshot API | PARTIAL M3 | 浏览器测试未跑真实 collector |
| Analysis/Selection/Unknown | 真实 assessment/decision API | PARTIAL M3 | 仍以候选技术对象为主 |
| Config/Data | 真实 decision 持久化 | PARTIAL M3 | 只存策略，不执行 config/data |
| Target/Dry-run | 真实 target ownership/readiness API | PARTIAL M2/M3 | 不是 target compatibility simulation |
| Plan | 真实 Environment Plan API | PASS M3 | 无版本/Project |
| Apply | Plan Center 调真实 API；Migrate 页只 promote | PARTIAL M3/M2 | Migrate 文案有假完成风险 |
| Verify/Report | 真实 Plan API | PARTIAL M2/M3 | 非业务级完成合同 |
| Capability/Admin | 真实 catalog/governance API | PASS M3 | certification 不等于 live Apply |
| Cutover | 无页面 | NOT FOUND M0 | 无 |
| Archive/Restore | 无页面 | NOT FOUND M0 | 旧 API/CLI primitive 未接 Web |

重要 UI 假完成风险：

- Migrate 页面 `runApply()` 实际只创建 migration Environment Plan 并跳转 Plan Center；`applyResult` 从未被赋值。
- Plan Recipes 多目标 “Apply reviewed plan” 的非 dry-run 分支只创建未审批 Plan，没有 review/apply。
- Build loading 文案使用 applying，但批量动作只创建 Plan。
- Build 把取得 distro 当完整 Target Snapshot completed。
- Runs 页是 legacy task history；SSE client 没接当前 Plan Apply。
- Migrate future steps 在 session 建立后可点击，主要依赖后端 readiness，不是前端状态机闭环。

本轮 Web smoke 未能启动浏览器：Playwright Chromium executable 缺失，16/16 在 launch 前失败。现有 12 个页面 smoke 只验证渲染；4 个 assessment-review 用 `page.route` mock 核心 migration API，不证明真实 collector/Migrate/Apply。

## 16. 测试与本地运行结果

根目录不存在 `test:api` 和 `test:web` scripts；实际映射是 API=`npm test`/`npm run test --workspace @fool/api`，Web=`npm run smoke:web`。

| 测试类型 | 命令 | 结果 | 是否 mock 核心执行 | 实际证明 | 没证明 |
|---|---|---|---|---|---|
| Typecheck | `npm run typecheck` | PASS, exit 0 | N/A | 所有 workspace TS 通过 | 运行能力 |
| Build | `npm run build` | PASS, exit 0 | N/A | 全 workspace 构建；Web 有 >500k chunk warning | 迁移成功 |
| API 全量 | `npm test` | PASS 1001/1001, 0 skipped | 大量远端 adapter/stub | 当前控制流、route、store、model regression | live SSH/data/Cutover |
| Collector 专项 | `node --test ...collector... data-surfaces...` | PASS 106/106 | command result fixture | modular collector/completeness/surface parser | 真实远端完整关系 |
| Plan 安全专项 | `node --test ...phase1... plan-security... managed-plan...` | PASS 28/28 | adapter mock | bypass/hash/approval/artifact gate | disposable target Apply |
| Graph/Migrate/Postgres 专项 | `node --test ...inventory... service-stack... migration... postgres...` | PASS 132/132 | synthetic snapshot/adapter mock | extraction/route/contracts/dry-run blocked | 业务识别和数据迁移 |
| Golden fixture | `npm run test:golden` | PASS 5/5 + failure 5/5 | fixture expectation | assessment/report projection | SSH/Plan/Apply/真实 verify |
| Capability certification | `npm run test:capabilities` | PASS 2/2 | manifest validation | nginx/postgresql schema/gates标记 official | live apply/verify；manifest 明示未 live proven |
| Web smoke | `npm run smoke:web`（隔离 env） | FAIL 16/16，浏览器未启动 | 4 条 assessment 测试会 mock 核心 API | 仅证明本机缺 Chromium | 不能评价页面运行成败，更不证明 Apply |
| dry-run scenario | `npm run harness:scenario -- build-nginx-success`（正确隔离配置） | FAIL 0/1，fresh store 中 `.map` of undefined | dry-run 会合成 ActionRuns | 暴露 harness clean-start 缺陷 | 没执行 SSH/Apply |
| 本地 API 只读 | 启动 `apps/api/dist/server.js` 后 GET health/ready/catalog | PASS 200/200/200，catalog 105；同 DB 重启仍 ready | 否 | API/SQLite bootstrap/read-only catalog 可运行 | 登录、Plan、SSH、Apply |
| Live harness | 未执行 | NOT APPLICABLE | N/A | 无 | 无 M5 证据 |

日志保存在本地被忽略的 `.tmp_logs/current-state-audit-*.log`。第一次 harness 探索命令曾把 `FOOL_RUNTIME_DB` 错设为 `.sqlite`，导致 SQLite 文件被 legacy JSON parser 读取；该结果被分类为审计环境配置错误。按项目真实 `.json` 配置契约重跑后仍在 fresh runtime catalog 路径以 `Cannot read properties of undefined (reading 'map')` 失败，这才是本报告记录的 harness 结果。两次都未进入 SSH 或 Apply。

审计前不存在 `docs/harness-reports`；本轮失败的 dry-run 只生成被 gitignore 的 summary，不能作为 live proof。

## 17. 五条端到端调用链

### 链路 A：Build

| 阶段 | 入口 | 核心函数 | 持久化 | 测试 | 实际运行 | 状态 |
|---|---|---|---|---|---|---|
| 创建 Build | Catalog Web | create rebuild Plan | Plan/SQLite | API tests | 未实操登录流程 | PASS M3 |
| 选择 Capability | certified catalog | listCatalog/buildRebuildPlan | catalog/Plan | 2 certification tests | read-only catalog 200 | PASS M3 |
| 生成 Plan | POST `/api/plans` | prepare/freeze/store | 是 | 1001 suite | 未创建 | PASS M3 |
| Approve | POST `/review` | evaluate gate/approve | 是 | 28 security | 未创建 | PASS M3 |
| Apply | POST `/apply` | executeEnvironmentPlan | ApplyRun/ActionRun | adapter mock | 未执行 SSH | PARTIAL M3 |
| Verify | POST `/verify` | verifyPlanAndPersist | 最近结果 | tests/stub | 未执行 | PARTIAL M2/M3 |
| Report | GET `/report` | buildPlanReport | 动态派生 | tests | 未执行 | PARTIAL M3 |

### 链路 B：普通软件迁移

| 阶段 | 入口 | 核心函数 | 持久化 | 测试 | 实际运行 | 状态 |
|---|---|---|---|---|---|---|
| 扫描源机 | connection probe | collectRemoteSnapshot | snapshot | collector fixtures | 未 SSH | PARTIAL M3 |
| 发现 package/service | snapshot | classifyMigrationCandidates | candidate report | tests | 未 SSH | PASS M3 |
| 用户选择 | decision route | store decision | 是 | routes tests | 未 UI | PASS M3 |
| 生成 Plan | session promotion | migrationPlanToEnvironmentPlan | 是 | tests | 未创建 | PASS M3 |
| 目标安装 | Plan Apply | package adapter | runs | mock | 未 SSH | PARTIAL M3 |
| Verify | Plan verify | catalog command | result | mock | 未 SSH | PARTIAL M2/M3 |

### 链路 C：自部署个人网站

| 阶段 | 入口/核心 | 持久化 | 测试 | 实际运行 | 状态 |
|---|---|---|---|---|---|
| Nginx/package/service | software/systemd collector | snapshot | fixture | 未 SSH | PARTIAL |
| 自定义 systemd app | unit 名 + 弱 process/path heuristic | snapshot | synthetic | 未 SSH | PARTIAL |
| app dir/uploads/.env | DataPath/EnvFile | snapshot | fixture | 未 SSH | PARTIAL |
| PostgreSQL/domain/TLS/cron | 分散 nodes | snapshot/derived graph | synthetic | 未 SSH | PARTIAL |
| 聚合 Workload | 无 | 无 | 无 | 无 | NOT FOUND |
| 生成业务 Plan | planner 不消费 graph/stack | 无 | 无 | 无 | FAIL |

### 链路 D：PostgreSQL 数据迁移

| 阶段 | 入口 | 核心函数 | 持久化 | 测试 | 实际运行 | 状态 |
|---|---|---|---|---|---|---|
| detect | candidate/surface | classifier | snapshot | PASS | 未 SSH | PARTIAL |
| plan | data decision | buildPostgresDataMigrationIntent/DryRun | assessment evidence | PASS blocked | 本地纯函数 | PARTIAL M3 |
| dump | 无 | 只有 blocked template | 无 | assert blocked | 无 | NOT FOUND |
| store/transfer | 无 | 无 | 无 | 无 | 无 | NOT FOUND |
| restore | 无 | 只有 blocked template | 无 | assert blocked | 无 | NOT FOUND |
| verify data | 无 | 无 | 无 | 无 | 无 | NOT FOUND |
| report | catalog strategy projection | buildPlanReport | 动态 | tests | 无 live | PARTIAL M2 |

### 链路 E：服务运行状态

| 阶段 | 入口 | 核心函数 | 持久化 | 测试 | 实际运行 | 状态 |
|---|---|---|---|---|---|---|
| active service | systemctl lists | remote collector | snapshot | fixture | 未 SSH | PARTIAL |
| capture desired state | 名称/少量路径 | parsers | snapshot | tests | 未 SSH | FAIL |
| quiesce/drain | 无 | 无 | 无 | 无 | 无 | NOT FOUND |
| preserve durable state | DataPath metadata only | graph | snapshot | synthetic | 无 bytes | FAIL |
| recreate service | catalog restart | Plan adapter | runs | mock | 未 SSH | PARTIAL |
| start | systemctl command | adapter | ActionRun | mock | 未 SSH | PARTIAL |
| verify | command/is-active | plan runner | result | mock | 未 SSH | PARTIAL |
| traffic switch | 无 | 无 | 无 | 无 | 无 | NOT FOUND |

Preserve & Restore 链在 Snapshot metadata 后即断开：没有一致性 capture、数据/部署材料上传、长期存储、integrity scrub 或未来 Restore Apply。

## 18. 当前实现能力矩阵

### A. Build

| 功能 | 状态 | 成熟度 | 代码证据 | 测试证据 | 本地实际证据 | 主要缺口 |
|---|---|---:|---|---|---|---|
| certified catalog browse | PASS | M3 | catalog routes/Web | API/cert tests | catalog 200/105 | official≠live proven |
| target distro/preflight | PARTIAL | M3 | distro/preflight routes | route tests | 未 SSH | 非完整 target snapshot |
| Plan generation | PASS | M3 | environment-plan | API tests | 未登录实操 | 无 Project/Version |
| approval/hash/artifact gate | PASS | M3 | plan lifecycle/store | 28/28 | 未实操 | target snapshot drift |
| package/service Apply | PARTIAL | M3 | managed adapters | mock | 未 SSH | 无 current live proof |
| config Apply | PARTIAL | M3 | config-change artifact | tests | 未 SSH | 非通用 Build 配置 |
| Compose/custom app/source | NOT FOUND | M0/M1 | preview only | UI source tests | 无 | 无 executor |
| Verify | PARTIAL | M2/M3 | plan runner | mock | 无 | shallow/fail-open paths |
| Rollback | FAIL | M2 | reverse commands | mock | 无 | 可误删/假 rolled-back |
| Report | PARTIAL | M3 | dynamic PlanReport | tests | 无 | 非业务证书 |

### B. Live Migrate

| 功能 | 状态 | 成熟度 | 代码证据 | 测试证据 | 本地实际证据 | 主要缺口 |
|---|---|---:|---|---|---|---|
| 源扫描 | PASS | M3 | SSH collector | 106/106 parser | 未 SSH | 无 live evidence |
| 目标扫描 | PARTIAL | M2/M3 | distro/preflight/connection | routes | 未 SSH | migration Plan不消费完整 target |
| 服务识别 | PARTIAL | M3 | software/systemd/graph | synthetic | 无 | 关系弱 |
| 自定义应用 | FAIL | M1/M2 | unit/path evidence | fixture | 无 | 无 Workload |
| 工作负载聚合 | FAIL | M2 | ServiceStack只读 projection | synthetic | 无 | 不进 Plan |
| 配置 | FAIL | M2 | copyConfig mapping | tests偏 plan shape | 无 | 无 path/content/artifact |
| 数据 | FAIL | M1/M2 | decisions/dry-run | blocked tests | 无 | 无 executor |
| Secret | FAIL | M1/M2 | SecretRef/out-of-band | redaction | 无 | 无 delivery |
| 服务状态 | FAIL | M2 | running/enabled evidence | fixtures | 无 | 无 desired-state restore |
| initial/final sync | NOT FOUND | M0 | 无 | 无 | 无 | 无 transfer |
| Cutover | NOT FOUND | M0 | 无 | 无 | 无 | 无状态机 |
| 业务验证 | FAIL | M1/M2 | command/curl | mock | 无 | 无 transaction |
| rollback | FAIL | M2 | generic reverse | mock | 无 | 无 data/traffic rollback |
| progress/resume | FAIL | M1/M2 | sync HTTP/legacy SSE | unit | 无 | 无 durable worker/checkpoint |
| Report | PARTIAL | M3 | dynamic report | tests | 无 | 可超出真实执行事实 |

### C. Preserve & Restore

| 功能 | 状态 | 成熟度 | 代码证据 | 测试证据 | 本地实际证据 | 主要缺口 |
|---|---|---:|---|---|---|---|
| Capture Plan | NOT FOUND | M0 | 无 | 无 | 无 | 无一致性编排 |
| 部署材料 | FAIL | M1 | files 字段默认空 | 无 live | 无 | 无捕获 |
| 长期数据存储 | NOT FOUND | M0 | 无 object store | 无 | 无 | 无 |
| Secret 恢复策略 | PARTIAL | M1 | out-of-band 文案 | redaction tests | 无 | 无 provider |
| 数据一致性 | NOT FOUND | M0 | 无 | 无 | 无 | 无 quiesce |
| manifest/hash | PARTIAL | M1/M2 | SnapshotManifest/SyncedFileRef | pure tests | 无 archive | 类型未落地 |
| encryption | NOT FOUND | M0 | 字段而已 | 无 | 无 | 无 key lifecycle |
| retention/delete | NOT FOUND | M0 | 无 | 无 | 无 | 无 |
| integrity scrub | NOT FOUND | M0 | 无 | 无 | 无 | 无 |
| compatibility envelope | NOT FOUND | M0 | 无 | 无 | 无 | 无 |
| Restore Plan | PARTIAL | M2 | restorers pure builder | unit | 无 | 不接 Environment Plan |
| restore drill | NOT FOUND | M0 | 无 | 无 | 无 | 无 M5 |
| 释放源服务器门禁 | NOT FOUND | M0 | 无 | 无 | 无 | 高数据丢失风险 |

## 19. 最严重问题 Top 20

| # | 标题 | 严重级别 | 模式 | 当前事实与代码证据 | 用户影响 | 数据丢失 | 无法恢复服务 | 假完成 | 建议方向（本轮未实现） |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | Migration planner 不消费 Graph/Stack | Critical | Live Migrate | `migration-classifier.ts:223-245` 只读 software/configChecklist | 技术对象无法成为业务 Plan | 是，遗漏 dataset | 是 | 是 | 先定义可执行 Workload/Dataset contract |
| 2 | 数据策略无执行器 | Critical | Live Migrate | decisions 只影响 readiness；Postgres 永久 blocked | UI选了策略但无数据移动 | 是 | 是 | 是 | 建立一致性/transfer/verify 最小闭环 |
| 3 | migration config copy 不可执行 | Critical | Live Migrate | 映射丢 configPaths，adapter 缺 path/content | Plan 可生成但 Apply 失败 | 可能 | 是 | 是 | 以受审 artifact 绑定 config bytes/path |
| 4 | 无 Cutover/drain/final sync | Critical | Live Migrate | 无对象/状态机/执行路径 | 无法安全切流和停写 | 是 | 是 | 是 | 显式 cutover state machine 与 rollback window |
| 5 | 存档只有 metadata | Critical | Preserve & Restore | manifest `files` 默认空，CLI apply throw | 释放旧机后无法恢复 | 是 | 是 | 是 | Capture archive + object storage + restore drill |
| 6 | recipe verify 失败仍可能 Apply success | Critical | Build/Shared | runner `verifyFailed` 仍 ok；adapter忽略 | 失败环境显示成功 | 可能 | 是 | 是 | verify 必须决定 run terminal status |
| 7 | Rollback 可能卸载目标原有包 | Critical | Build/Shared | 手工 rollback 不使用 existedBefore | 破坏目标环境 | 可能 | 是 | 否 | rollback 强绑定 ActionRun provenance |
| 8 | 无 Workload/自定义应用闭环 | High | Live Migrate | 无 Workload；无 proxy→upstream/app→DB | 个人网站被拆成零件 | 是 | 是 | 是 | 先补业务关系与人工补全合同 |
| 9 | Secret 只有引用、无交付 | High | Shared | SecretRef/out-of-band，无 Requirement/Provider | 目标服务无法启动 | 否 | 是 | 是 | SecretRequirement + runtime-only provider |
| 10 | Apply 无 durable worker/resume | High | Shared | 同步 HTTP；重启不 heal ApplyRun | 中断可永久卡 applying | 传输未来会有 | 是 | 是 | durable claim/heartbeat/checkpoint |
| 11 | Rollback 失败仍可标 rolled-back | High | Shared | rollback result与 Plan terminal state脱节 | 用户误以为已恢复 | 可能 | 是 | 是 | terminal state基于逐项结果 |
| 12 | 验证不是业务级 | High | Shared | 缺省成功、首个 check、`|| true`、无 transaction | 服务 active 被误当业务成功 | 可能 | 是 | 是 | 用户定义 business success contract |
| 13 | systemd 期望状态采集不足 | High | Live Migrate | 仅 running/enabled名与少量路径 | 自定义服务不能重建 | 否 | 是 | 是 | 采 unit/drop-in/dependency/security contract |
| 14 | 目标兼容性过浅且不失效旧 Plan | High | Shared | distro/software name；无 snapshot version hash | 目标漂移后仍可用旧批准 | 可能 | 是 | 是 | target snapshot identity + new PlanVersion |
| 15 | Graph/Stack 测试输入高于 live collector 输出 | High | Live Migrate | tests手填 listeningPorts/env service/container mapping | 测试绿色高估生产识别 | 间接 | 是 | 是 | 加 production collector→graph contract fixtures |
| 16 | 无数据一致性与 initial/final sync | High | Live Migrate | 无 quiesce/checksum/transfer | 活跃写入下必然有漂移 | 是 | 是 | 是 | dataset consistency policy |
| 17 | Web “Apply”文案并未 Apply | High | Shared | Migrate只 promote；multi-target recipe只 create Plan | 用户误判执行状态 | 间接 | 是 | 是 | UI动作名称与真实状态严格一致 |
| 18 | Report 可声明未执行的数据策略 | High | Shared | report 从 catalog audit 派生 dump-restore 等 | 审计材料夸大能力 | 是 | 是 | 是 | Report 仅陈述 observed ActionRun evidence |
| 19 | Verify/Rollback 输出 redaction 不统一 | High | Shared | 只截断 stdout/stderr | 敏感信息可能落库/API | 否 | 否 | 否 | 所有持久输出统一 redaction |
| 20 | 无统一 Project/Version/Run，routes 单体 | Medium | Shared | 无 Project/PlanVersion；routes约6168行 | 生命周期难以解释/维护 | 否 | 间接 | 是 | 在能力闭环后再做有边界的领域拆分 |

## 20. 十六个最终问题的明确答案

1. **当前 Build 可以用于什么真实场景？** 可以为已认证 catalog 中的有限软件环境生成、审批并通过生产 SSH adapter 执行包安装/服务命令/少量受审配置；本轮没有 live target 证明，只能定 M3。
2. **当前 Build 不能用于什么？** 不能可靠创建完整自定义应用、Compose 工作负载、Secret/data、业务验证和安全 rollback，也不能称生产闭环。
3. **当前 Migrate 实际迁移了什么？** 生产代码能把 package/service candidate 转成受控包安装和少量 restart/validate；本轮未实际对目标执行。
4. **当前 Migrate 没迁移什么？** 真实配置内容、文件数据、数据库数据、Docker volume、Secret、完整 systemd 定义、依赖顺序、流量和瞬时状态。
5. **能否完整迁移自部署个人网站？** 不能。
6. **能否迁移 PostgreSQL 真实数据？** 不能；只有永久 executionBlocked 的 dry-run evidence。
7. **能否恢复 systemd 服务期望状态？** 不能；只保留 running/enabled 名称和少量启发式证据。
8. **能否迁移瞬时状态？** 不能。
9. **哪些瞬时状态应 drain/quiesce/restart？** 请求、TCP 连接、DB transaction、锁、leader、内存 session/cache、未持久化 queue、active job/timer；这些原则上不应复制。
10. **能否完成真实 Cutover？** 不能。
11. **能否证明业务可用？** 不能；最多证明语法、进程或个别 endpoint。
12. **浏览器关闭、SSH 中断或 worker 重启后能否继续？** 已完成结果可重读；active Apply 没有 durable worker/checkpoint/resume，不能保证继续。
13. **能否先封存、释放旧机器、未来恢复？** 不能，且这样做有直接数据丢失风险。
14. **最接近完整闭环的黄金场景？** certified catalog 软件包 → frozen Plan → approval/hash → 目标包安装/服务命令 → 命令级 verify → dynamic report；仍缺 live proof 和业务验证。
15. **当前最应该暂停开发什么？** 暂停扩大 catalog、UI完成度、泛化插件和宽泛重构；先不要继续增加“可选择但不可执行”的数据/Secret/Cutover文案。
16. **下一阶段规划前还缺哪些事实？** 至少需要一个受控 disposable Ubuntu target 的 package Build 实测；一个真实自定义 systemd+Nginx+app+Postgres fixture；真实数据量/一致性/停机测量；crash/restart 行为；Secret provider 安全设计；restore drill 的最小验收合同。

## 21. 可直接用于后续规划的事实

- Environment Plan approval、planHash、artifactHash 和禁用 legacy mutation routes 是真实生产边界。
- Build/Migrate 在 promotion 后共用同一 Plan 执行 API。
- 没有 Project、PlanVersion、Workload、Dataset、SecretRequirement、TransferSession、Checkpoint、Cutover、CaptureArchive。
- InventoryGraph/ServiceStack 是真实只读派生层，但 planner 不消费。
- PostgreSQL 迁移明确 non-executing。
- migration config decision 与 data decision 不生成完整可执行动作。
- Plan Apply 同步执行，不走 durable worker/SSE。
- completed ApplyRun/ActionRun 持久化；active run 不恢复。
- Preserve Snapshot 是 metadata，不是 archive。
- Web 中有多个把 create/promote Plan 称为 Apply 的文案/流程。
- 当前 checkout 没有可接受的 live target report；本轮 dry-run harness clean-start 失败。
- API 全量 1001/1001 绿色不等于迁移闭环。

## 22. 审计可信度与未验证范围

高可信结论：对象是否存在、production route/planner/adapter 调用关系、Graph/Stack 是否进入 Plan、PostgreSQL executionBlocked、队列/持久化模型、测试结果、只读 API 启动结果。

中可信结论：远端 collector 在不同 Linux distro/systemd/Docker 版本上的实际输出质量，因为本轮没有 SSH 到 disposable target。

未能验证：真实 SSH Apply、sudo/package manager 行为、真实 Nginx/PostgreSQL/Docker build、网络/防火墙影响、真实 rollback、业务 transaction、browser UI 运行、live Migrate、Cutover、crash recovery、Secret delivery、restore drill。

受限原因：禁止外部写操作且没有当前 live disposable target；Playwright Chromium 未安装；现有 dry-run harness 在 fresh store 初始化阶段失败。

## 23. 反假完成复核

- 本报告所有 PASS 都附有生产代码、测试或本地只读 API 证据。
- 没有核心能力标为 M4/M5。
- 没有把 schema/type/字段当能力。
- 没有把 unit test、fixture、manifest official 标记当 live migration。
- 没有把 service active 当期望状态恢复。
- 已显式检查数据一致性、瞬时状态、Cutover、重启、源机释放风险。
- 未输出 Secret、密码、Token、私钥或 `.env` 内容。
- 未修改任何产品代码、测试、schema 或 UI。

## 24. 最终判断

唯一选择：**当前是有限场景的迁移产品。**

理由：它超过纯设计/评估原型——已有真实 SSH collector、持久 Snapshot、Environment Plan、approval/hash/artifact gate、有限 managed execution、Verify/Report route 和大量集成测试；但它实际闭环的对象主要是软件包和少量服务/配置动作。完整业务识别、配置内容迁移、数据/Secret、服务期望状态、Cutover、业务验证、durable resume、长期封存恢复均未实现或未连接生产 Plan，且本轮没有任何 M4/M5 live 证明。因此不能称“可执行的完整 Build 产品”“可用于生产的迁移产品”或“可靠封存恢复产品”。
