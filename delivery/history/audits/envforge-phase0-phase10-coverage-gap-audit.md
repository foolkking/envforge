# EnvForge Phase 0–10 需求覆盖与缺口审计

## 1. 审计结论

结论不是“Phase 0–10 已经能够完整覆盖最初讨论的全部需求和想法”。

更准确的判断是：

- **核心架构闭环大体覆盖**：Project/Blueprint/Plan/Run 的方向、持久执行、文件与 PostgreSQL 数据迁移、Cutover、业务验证、Archive、Scrub、Restore Drill、Restore、Source Release、生产硬化和 GA Closure 都有对应阶段。
- **若严格按最初痛点和后续全部设计决策验收，仍存在多个会让阶段 PASS 但用户目标没有真正实现的缺口。**
- **Phase 0 和 Phase 2 基本可靠；最需要修改的是 Phase 1、Phase 4、Phase 7、Phase 8、Phase 9。**
- Phase 3、Phase 5、Phase 6 不是方向错误，而是认证范围太窄或用户承诺需要进一步限定。
- Phase 10 只能做最终集成和关闭，不能弥补前面缺失的核心产品能力。

本审计基于：

- `phase0-phase10.zip` SHA-256：`5576688b1b68652e6ffa0994956a0f3ed6ddf9ecce1d1a3e19c3b212744c863d`
- `ChatGPT-虚拟机换机痛点分析 (5).md` SHA-256：`ce424d13f10770ea47d8c385f5f7eb3897b99127e33c67ac20d544b8684a4988`
- ZIP 内 Phase 0–10 共 11 份 Prompt 的逐份文本审计。

本审计不代表这些 Phase 已经执行通过，也不代表当前代码已经实现；它判断的是：**即使执行者完全遵守这些 Prompt，是否仍可能遗漏最初需求。**

---

## 2. 覆盖状态总表

| 需求领域 | 当前主要 Phase | 判断 | 说明 |
|---|---|---|---|
| PostgreSQL 权威平台、Artifact、Audit、Outbox、基础 Project/Endpoint | Phase 0 | 覆盖 | 基座明确，边界较好 |
| Workload、Blueprint、DecisionSet、Plan Revision、Approval | Phase 1 | 部分覆盖 | 主对象存在，但 Project Type/ProjectLink、完整 Blueprint 子合同和 Placement 不够强制 |
| Durable Queue、Lease/Fencing、Checkpoint、Crash Recovery | Phase 2 | 覆盖 | 是整套 Prompt 中最完整的部分之一 |
| Golden Build 真实执行闭环 | Phase 3 | 覆盖但范围窄 | 证明一个 systemd Web 栈，不等于 Build 广而全 |
| Discovery、Graph、Candidate、Review、Promotion | Phase 4 | 部分覆盖且风险高 | 缺少最初已确定的 Candidate Builder 强弱关系规则和深度 Collector 合同 |
| Filesystem、PostgreSQL dump/restore、Docker local volume | Phase 5 | 覆盖限定场景 | 能做有停机迁移；不覆盖 PostgreSQL logical replication/近零停机 |
| Drain、Quiesce、Authority、Traffic、Observation、Rollback | Phase 6 | 核心覆盖 | Golden 场景强，但只有 systemd app，未证明 Docker Compose 和 24h 后验证 |
| Capture、Archive、Encryption、Replica、Scrub、Repair、Drill | Phase 7 | 大部分覆盖 | 缺控制面丢失后的正式 Archive Import/Export；源机独立封存旅程未成为必验场景 |
| Restore 和 Source Release | Phase 8 | 覆盖但阶段设计有问题 | 两个高风险闭环过度合并；破坏性 Source Release 早于 Phase 9 生产安全硬化 |
| HA、DR、安全、供应链、Capability Governance、UX 硬化 | Phase 9 | 部分覆盖且范围过大 | 没有明确补齐 Build 广度、Compose/MySQL/Redis、Vault/SOPS 和任务中心 UX |
| 最终格式冻结、Legacy Retirement、GA | Phase 10 | 覆盖终态关闭 | 只能验证已有能力，不能补缺失能力 |
| 目标机从换机任务开始绑定 | Phase 0/1/4/6 | **未完整覆盖** | Phase 4 仍是单 Endpoint Assessment-first；目标兼容仍可能过晚 |
| 以换机项目为用户主心智、Project 派生关系 | Phase 0/1 | **未完整覆盖** | 没有 ProjectLink、不可变 Project Type 和 Assessment→Migration/Capture 正式链路 |
| 自定义服务的完整运行合同 | Phase 1/4/6 | **未完整覆盖** | systemd unit/drop-in/环境/依赖/安全上下文/部署来源没有强制验收 |
| 临时运行状态的 EphemeralStatePolicy | Phase 1/4/6 | **明显不足** | Drain 有实现，但 Blueprint/Discovery 没有系统表达 PID、事务、锁、会话、active job 的处理策略 |
| 配置与部署材料闭环 | Phase 4/6/7 | **部分覆盖** | Archive 阶段强；Live Migration 前的 sanitized Config/Deployment Artifact 获取不足 |
| 数据量、写入率、迁移时间、停机估算 | Phase 1/5/6 | **部分覆盖** | 有通用 estimate/ETA，但没有独立估算器和准确性验收 |
| Secret Provider 用户输入/目标已有/再生成 | Phase 3 | 覆盖 | 可支撑 Golden 流程 |
| Vault/SOPS/轮换/长期恢复 Provider | Phase 9 前后 | **未覆盖或仅治理** | Phase 3 明确排除，后续没有要求新增真实 Provider |
| PostgreSQL 近零停机迁移 | 无 | **未覆盖，且被设计明确延后** | 目前最终完整 dump/restore，停机与数据库规模相关 |
| Docker Compose 完整 Build/Migrate/Archive/Restore | 无完整纵向 Phase | **未完整覆盖** | Docker volume 有，但 Compose 应用完整闭环未认证 |
| MySQL/MariaDB、Redis/Valkey 深度迁移 | 无 | **未覆盖** | 属于早期 P1 扩展想法，不在现有 GA 必验范围 |
| Archive 自描述、控制面丢失后重新导入 | Phase 7/8 | **关键缺口** | 原设计明确要求，Prompt 没有正式 Import Existing Archive 闭环 |
| 用户 Archive 导出与 BYOS/托管边界 | Phase 7 | **部分覆盖** | 有对象存储/副本，但产品提供者边界和可移植导出未锁定 |
| 只有源服务器、无目标的直接 Preserve 旅程 | Phase 7/8 | **实现可能具备，认证不足** | Golden Capture 来源是 Phase 6 committed target，不是独立 legacy source-only 项目 |
| 15 分钟观察 + 24 小时复查 | Phase 6/8 | **部分覆盖** | 15 分钟 Observation 和 24h Source Retention 有；没有明确 24h 业务复验 Gate |
| 普通用户只处理 3–5 个关键决策 | Phase 4/9 | **未形成验收** | 有 Candidate Review，但无决策预算/复杂度标准 |
| 任务中心 IA、简化导航、空状态、Dashboard | Phase 9 | **仅原则覆盖** | IA convergence 太泛，可能只做 Design System 而不改变产品心智 |
| 全磁盘/整机镜像兜底 | 无 | **未覆盖，且正式定位不做磁盘镜像工具** | 需要明确保持非目标或增加独立可选能力 |
| Ticket、Webhook/CI、Policy-as-code、Marketplace | Phase 9 部分 | **未全部覆盖** | 属于企业扩展想法，不应被当作 v1 核心闭环已完成 |

---

## 3. 最高优先级缺口

### GAP-01：Project 模式和 ProjectLink 没有真正落地

最初确定的产品模型不是只有一个 `EnvironmentProject.type` 字段，而是：

- 用户层四种模式：Assessment、Build、Live Migration、Preserve & Restore；
- 领域层五种 Project Type：assessment、build、migration、capture、restore；
- Project Type 创建后不可变；
- Assessment 通过 `ProjectLink` 派生 Migration/Capture；
- Capture 通过 Archive 派生多个 Restore Project；
- Project 是工作空间，Plan 是合同，Run 是执行。

当前 Prompt：

- Phase 0 只做 Project minimum envelope；
- Phase 1 主要实现 Workload/Blueprint/Plan；
- 后续 Phase 几乎不出现 ProjectLink、派生关系和模式专属生命周期。

风险：执行者可以做出所有数据库表和 Run，却仍保留 Build/Migrate/Plan 分散页面，没有真正形成“换机任务”。

**修改：**

在 Phase 1 增加必做工作包：

```text
EnvironmentProject full lifecycle
ProjectType immutable rule
ProjectEndpointBinding
ProjectLink
Project mode state machines
Assessment → Migration/Capture derivation
Archive → Restore derivation
one active live run per project/plan
Project summary/read model
mode-specific permissions and APIs
```

增加 Acceptance：

```text
PH1-036 Project type immutability
PH1-037 ProjectLink derivation and lineage
PH1-038 Mode-specific project lifecycle
PH1-039 Project/Plan/Run boundary
PH1-040 Assessment-to-Migration/Capture API
PH1-041 Archive-to-Restore API contract
```

---

### GAP-02：目标机仍可能出现得太晚

最初痛点明确要求迁移任务开始时绑定源机和目标机，尽早得到 CPU/OS/磁盘/inode/内存/端口/用户/路径/数据库版本等冲突。

当前 Phase 4 流程是：

```text
Connect Endpoint → Assessment → Snapshot → Graph → Candidate → Review → Blueprint
```

它是正确的 Assessment 流程，但不是完整的 Migration Project 流程。Phase 5/6 才强依赖 Source/Target，因此产品仍可能先做完源分析，再发现目标不兼容。

**修改：**

Phase 4 同时提供两条只读流程：

```text
Assessment Project:
Source only → Assessment → Blueprint

Migration Preparation Project:
Source + Target at creation
→ dual Snapshot collection
→ source Workload Candidate
→ target compatibility overlay
→ target conflict questions
→ migration readiness preview
```

目标允许暂缺，但必须显示 `TARGET_REQUIRED_BEFORE_FINAL_REVIEW`，不得生成可批准 Migration Plan。

新增 Acceptance：

```text
PH4-033 Migration Project binds source and target early
PH4-034 Dual-endpoint read-only assessment
PH4-035 Target conflict overlay before Blueprint/Decision completion
PH4-036 Target drift invalidates compatibility preview
PH4-037 No final migration readiness without target Snapshot
```

---

### GAP-03：Phase 4 的 Candidate Builder 过于泛化

最初设计已经明确：

- 先规范化实体，再提取强关系/弱关系；
- Nginx proxy_pass→socket→process→systemd 是强关系；
- 名称相似只是弱关系；
- 自动合并至少有一条 `confidence >= 0.90` 的强关系；
- 共享数据库、共享 Nginx、跨 Compose Volume 不能自动合并；
- Collector 不完整时必须 `unknown`，不能当 absent；
- 用户修正要形成持久 `WorkloadClassificationRule`；
- 首期不能自动确认 Blueprint。

Phase 4 Prompt 只要求“dependency hints、Candidate rules/model、split/merge”，没有把这些规则变成硬性实现与 Acceptance。

风险：执行者可以用简单名称聚类或 LLM 输出 Candidate，通过现有 PH4 Acceptance，却无法可靠识别个人网站。

**修改：**

Phase 4 必须新增 `Workload Candidate Builder Contract`：

- 标准实体：systemd unit、process、socket、package、config、directory、env-file、secret-ref、database、container、compose-project、volume、network、Nginx server/upstream、domain、certificate、cron/timer、user/group、external endpoint；
- 强关系和弱关系注册表；
- relation evidence、ruleId、confidence、explanation；
- anchor detection；
- shared-resource detection；
- automatic merge threshold；
- conflict and question generation；
- persistent user classification rules；
- candidate generation parity：测试字段必须来自真实 Collector 输出，不允许只靠人工注入。

新增必验场景：

1. Nginx → custom systemd app → PostgreSQL → uploads → `.env` requirements → timer；
2. 两个网站共享 Nginx；
3. 两个应用共享 PostgreSQL 实例；
4. Compose Project + exclusive volumes；
5. 跨 Compose 共享 Volume；
6. 无 systemd 的手工进程；
7. Collector permission denied；
8. 名称相似但无强关系，必须不合并。

---

### GAP-04：完整 systemd/运行合同和 EphemeralStatePolicy 不足

最初设计把运行状态分为：

- 可重建期望状态；
- 持久业务状态；
- 临时运行状态。

当前 Phase 6 能执行 Drain/Quiesce，但 Phase 1/4 没有强制实现完整 `EphemeralStatePolicy`，Phase 4 只写了 `systemd units`，没有字段级最低合同。

**必须补齐的 systemd 字段：**

```text
unit file and drop-ins
ExecStart / ExecStartPre / ExecStop
WorkingDirectory
User / Group
Environment and EnvironmentFile references
Restart / RestartSec
Wants / Requires / After / Before
TimeoutStart/Stop
resource limits
security context/capabilities
ReadWritePaths/StateDirectory/RuntimeDirectory
socket activation
timer activation
enabled/disabled/masked/static state
```

**EphemeralStatePolicy 必须覆盖：**

```text
active HTTP requests → drain
DB transactions → wait/terminate/manual
file writers and locks → quiesce
in-memory sessions → externalize/discard/manual
cache → rebuild/warm
active worker jobs → drain/checkpoint/requeue/manual
leader election → restart/re-elect
cron/timer currently running → wait/abort/manual
unpersisted queue → blocker or explicit loss policy
```

修改 Phase 1 的 Blueprint Schema 和 Acceptance；修改 Phase 4 Collector；Phase 6 必须证明这些策略真实驱动 Drain，而不是写死 fixture 命令。

---

### GAP-05：自定义应用的部署来源和配置材料闭环不足

最初设计要求判断每个应用通过哪种方式重建：

```text
package
git
container-image
compose
binary-artifact
directory-artifact
manual/unknown
```

Phase 3 的 Golden Build 主要是已知 Artifact；Phase 4 只有 `application directories` 和 `selected config metadata`；Phase 6 侧重 Cutover。Live Migration 中缺少明确的“从源端形成可审查 Deployment/Config Artifact”的硬性工作包。

**修改：**

Phase 1 增加字段级 `DeploymentContract` 和 `ConfigContract` Acceptance。

Phase 4 增加只读、受保护的材料采集：

- Git remote（去除凭据）、commit、dirty state、submodule、lockfile、build scripts；
- Docker image digest、Compose 文件、profiles、networks、volumes、healthcheck；
- binary/artifact checksum、动态库依赖；
- directory classification；
- Nginx sanitized config Artifact；
- systemd unit/drop-in Artifact；
- `.env` 只抽取键名和 SecretRequirement，不捕获值；
- 配置中的旧 IP、主机名、路径和端口形成 transform requirements。

Phase 6 增加：

```text
reviewed Deployment Artifact
reviewed Config Artifact
source hash → normalized template → target render → syntax verify
```

没有这些材料时，自定义应用只能标记 `manual` 或 `blocked`，不能声称自动迁移。

---

### GAP-06：Build “广而全”没有被任何后续 Phase 补齐

Phase 3 正确地只证明一个 Golden Build，但 Phase 9 和 Phase 10 又禁止新增重大能力，因此整套 Phase 完成后仍可能只有：

```text
Nginx + systemd Node/Python app + PostgreSQL + file dataset
```

这不等于最初提出的 Build 应覆盖较广的软件、运行时和服务。

**修改选择：**

推荐修改 Phase 9：允许“新增经过既有 SDK 的 Adapter/Capability”，但禁止新增核心生命周期。增加 `Build Breadth Certification Wave`。

最低建议矩阵：

```text
Package/runtime:
Nginx, Caddy, Node.js, Python, Docker Engine, PostgreSQL, Redis/Valkey, common CLI

Deployment archetypes:
package service
custom systemd app from Git/artifact
static site
Docker container
Docker Compose project

Verification:
syntax + runtime + network + basic workload-specific probe
```

每项必须明确 Build/Detect/Migrate/Data/Cutover/Archive/Restore 的独立认证维度，不能因为 Build Certified 就显示为 Migration Certified。

---

### GAP-07：Docker Compose 完整纵向闭环没有认证

Phase 5 认证的是 Docker local volume，不是 Compose Workload；Phase 6 Golden Migration 是 systemd app。最初目标用户和 MVP 想法明确包含 Docker Compose。

**修改：**

增加第二条必验场景，可放在 Phase 6 或 Phase 9：

```text
Golden Migration v1B:
Nginx or route
+ Docker Compose application
+ env_file Secret requirements
+ PostgreSQL/Redis container or external DB
+ bind mounts
+ named local volumes
+ healthcheck
+ restart policy
+ network
+ business transaction
+ Cutover and rollback
```

Capture/Restore 也必须复用该场景，证明 Compose 文件、镜像 digest、volume、Secret、network 和 healthcheck 可恢复。

---

### GAP-08：数据库迁移只覆盖有停机的最终完整 dump/restore

Phase 5 明确禁止把第二次 `pg_dump` 称为增量，这是正确的诚实设计。但它意味着大数据库的最终停机可能很长。

因此当前 Phase 0–10 **不能承诺**：

- PostgreSQL 初始复制 + 最终几分钟 catch-up；
- 近零停机；
- 84GB 数据库 3–6 分钟停机。

处理方式二选一：

1. 把限制明确写入 Support Matrix 和 UI：`logical-dump-restore, downtime proportional to final full dump and restore`；
2. 增加新的 `postgresql-logical-replication` Capability 阶段，包含 initial copy、LSN/catch-up、replication slot、DDL 限制、sequence、large object、rollback 和 Cutover。

若用户的核心商业承诺包含低停机，大概率需要新增 Phase 5B/6B，而不是把它塞进 Phase 9。

---

### GAP-09：迁移估算没有成为独立、可校准能力

Prompt 有 `capacity/time estimate`、ETA 和 downtime budget，但缺少：

- 写入速率测量；
- 带宽探测；
- dump/restore profile；
- 目标磁盘和 inode headroom；
- initial/final delta 估算；
- 估算置信区间和假设；
- 执行后误差对比；
- 估算准确性 Acceptance。

**修改 Phase 5/6：**增加 `MigrationEstimate`：

```text
source bytes/items
daily/current write rate
measured network throughput
dump generation rate
restore rate
target capacity/inode headroom
initial sync ETA
final sync or final dump ETA
predicted downtime range
confidence and assumptions
calibration version
actual-vs-estimated result
```

Golden 测试应定义允许误差范围，超出范围不得在 UI 给出高置信度。

---

### GAP-10：Secret Provider 范围止于最小 Slice

Phase 3 提供 user-input、target-existing、regenerate，足够 Golden Build 和基本 Restore，但最初明确讨论过 Vault、SOPS、轮换和长期恢复。

Phase 9 当前只做轮换/安全硬化，没有要求实现 Vault/SOPS Provider。

**修改 Phase 9：**至少增加：

```text
SOPS file provider
Vault-compatible provider
out-of-band/manual attestation provider
rotate-after-restore workflow
provider outage/revocation/lease expiry tests
```

Cloud Secret Manager 可继续标记 post-GA。

---

### GAP-11：Archive Import/Export 和控制面丢失恢复缺失

最初 Archive 设计要求：

```text
Archive Header + Manifest + Key Provider + Archive Reader
```

应在控制面数据库完全丢失时重新导入 Archive。当前 Phase 7 只有 legacy backup import/re-ingest 的零散描述，没有正式的：

```text
Import Existing Archive
Repository scan
Header discovery
Signature validation
Manifest decryption
Archive/Revision/Replica index rebuild
Scrub
Create Restore Project
```

这会削弱长期保存承诺。用户的数据还在对象存储，但 EnvForge DB 丢失时可能无法恢复索引。

**修改 Phase 7：**新增 Archive Import/Export 工作包和 Acceptance：

```text
PH7-031 Self-describing Archive Header
PH7-032 Export portable Archive descriptor
PH7-033 Import Existing Archive into empty control plane
PH7-034 Signature/key/manifest verification during import
PH7-035 Rebuild Archive/Replica/Object indexes
PH7-036 Scrub after import
PH7-037 Create Restore Project from imported Archive
```

Phase 8 Restore 必须增加一个 round：从空控制面导入 Archive 后恢复。

---

### GAP-12：直接“只有一台源服务器”的 Preserve 用户旅程没有成为必验链路

Phase 7 Golden Archive 的 Capture source 是 Phase 6 committed target。这能证明 Archive 技术，但不能完整证明用户最初提出的：

```text
只有旧服务器
→ Assessment
→ Candidate Review
→ Confirmed Blueprint
→ Capture
→ Archive
→ Source Release
→ 数月后新目标 Restore
```

**修改 Phase 7/8：**增加第二条 mandatory E2E：

```text
Legacy-like source-only VM
→ Phase 4 Assessment and Candidate Review
→ linked Capture Project
→ no target endpoint
→ Archive Commit + Scrub + Drill
→ Source Release Readiness
→ source network removed or VM destroyed in fixture
→ empty control plane optional Archive Import
→ new Restore Project
→ clean target restore
→ business verification
```

这才直接证明“空窗期没有服务器”场景。

---

### GAP-13：Phase 8 把 Restore 和破坏性 Source Release 合并，且早于 Phase 9 硬化

Restore 是恢复能力；Source Release 是不可逆高风险资源销毁。二者放在同一 Phase，会导致：

- Scope 过大；
- 一个闭环可能掩盖另一个闭环的债务；
- Source Release 在 RBAC、双人审批、供应链和生产事故流程全面硬化前已经成为可用产品能力。

**修改：**

不必重编号，但必须增加两个独立子 Verdict：

```text
PH8-RESTORE: PASS/PARTIAL/FAIL
PH8-SOURCE-RELEASE: PASS/PARTIAL/FAIL
```

Phase 8 中 Source Release 只允许：

- disposable fixture certification；
- production Feature Flag default off；
- readiness/quarantine/grace period；
- exact provider resource preview。

Phase 9 完成 RBAC、双人审批、Incident、DR、安全和 Provider certification 后，才能执行 `Production Adoption Enablement`。

---

### GAP-14：迁移后的 24 小时复查没有成为 Gate

Phase 6 有最短 15 分钟 Observation 和 24 小时 Source Retention，但用户最初提出了迁移后 24 小时复查。

**修改 Phase 6/8：**

新增 `PostCutoverVerificationSchedule`：

```text
immediate
15 minutes
1 hour
24 hours
before source release
```

检查：

- HTTP/TLS/business probes；
- DB/read-write health；
- upload/read；
- background jobs/timers；
- error rate；
- target writes；
- source traffic/write absence；
- certificate and DNS state。

24h 检查失败应阻止 Source Release，但不改写 CutoverCommit 历史。

---

### GAP-15：任务中心 UX 没有足够明确的验收

Phase 9 写了 `IA convergence` 和 Design System，但可能只完成组件库、无障碍和视觉统一，仍保留技术工作台心智。

最初产品痛点要求：

- 源/目标从任务开始；
- 用户操作的是 Workload，不是 package/port；
- 常见黄金路径只需约 3–5 个关键决策；
- 默认只显示 blocker、系统不敢决定的事项和推荐摘要；
- Evidence/Graph/Action 折叠；
- 执行显示真实 Timeline、速度、ETA、Checkpoint；
- Dashboard 优先任务、维护窗口、失败和待释放源机；
- Build/Migrate/Plan/Run/Report 不再作为混乱的一级心智；
- 用户文案不混用内部英文术语。

**修改 Phase 9：**增加 `Product Experience Closure`，不要只写 Design System：

```text
project-centered IA
four user modes
mode-specific project overview
source/target first step for migration
actionable blocker inbox
key-decision budget for Golden flows
advanced evidence/details disclosure
operation timeline
empty-state task CTA
dashboard operational priorities
terminology/localization glossary
no UI capability overclaim
```

新增可量化 Acceptance：

- Golden Migration 首次配置的 required user decisions 不超过 5 个，除非 fixture 显式制造冲突；
- 所有 required blocker 可从项目 Overview 一次定位；
- 不需要进入独立 Plans/Runs 页面才能完成项目；
- Candidate/Plan/Action 技术字段默认折叠；
- UI 文案与 machine code 分离；
- 用户测试能正确回答“下一步是什么、何时停机、如何回滚、何时可释放源机”。

---

## 4. Phase-by-Phase 修改结论

### Phase 0 — 基本保持

**优点：** PostgreSQL authority、Artifact、Audit、Outbox/Inbox、CAS、基础 Project/Endpoint、Worker skeleton 边界清楚。

**只需增加：**

- Project `type` enum 必须预留五种正式类型；
- ProjectEndpoint role 支持 source/target；
- 为 Phase 1 ProjectLink 和 mode state machine 保留正确约束；
- 不在 Phase 0 实现业务状态。

Phase 0 不应被迫重新承担产品逻辑。

### Phase 1 — 必须修改

增加：

- EnvironmentProject 完整模式生命周期；
- ProjectLink；
- WorkloadPlacement 基础模型：observed/planned/active/standby/archived/released；
- Blueprint 完整子合同；
- DeploymentContract、ConfigContract、RuntimeContract；
- EphemeralStatePolicy；
- CompatibilityEnvelope 字段级合同；
- MigrationEstimate 合同；
- mode-specific Project API/UI；
- field-level schema/acceptance，不允许只存任意 JSONB。

### Phase 2 — 基本保持

Phase 2 的 durable kernel 足够完整。增加两点即可：

- Project/Plan 级一个活动 Live Run 的强约束；
- Critical Section recovery priority 和 post-cutover scheduled verification task 的通用调度支持。

### Phase 3 — 保持 Golden Build，但明确只是窄 Slice

增加：

- DeploymentContract 对 Git/artifact/systemd 的真实实现；
- 构建前 Target Snapshot 完整绑定；
- 文档和 UI 明确 `Golden Build Certified != broad Build support`；
- 为后续 Compose Adapter 保留结构化接口。

不要在 Phase 3 一次性塞入所有软件。

### Phase 4 — 必须大幅修改

增加：

- dual-endpoint migration preparation；
- deep systemd/Nginx/Postgres/Compose collector；
- Candidate Builder 强弱关系注册表；
- 共享资源和持久用户归属规则；
- deployment source；
- sanitized config/deployment artifacts；
- observed WorkloadPlacement；
- target compatibility overlay；
- exact personal website and Compose candidate fixtures；
- production Collector parity tests。

### Phase 5 — 功能强，但要补估算和承诺边界

增加：

- preflight profile and MigrationEstimate；
- write-rate and bandwidth observation；
- actual-vs-estimated calibration；
- clearer downtime contract；
- PostgreSQL dump/restore support level wording。

近零停机若是硬需求，新增 Phase 5B，而不是篡改 dump/restore 含义。

### Phase 6 — 核心强，补第二场景和后续复查

增加：

- Docker Compose Golden Migration；
- 24h scheduled business re-verification；
- direct integration with early target compatibility；
- config/deployment artifact materialization；
- user-defined business success criteria 从 Project 初期进入 Plan；
- exact actual downtime vs budget/estimate report。

### Phase 7 — 必须补 Archive portability

增加：

- direct source-only Capture E2E；
- self-describing Archive Header；
- Archive Export/Import；
- empty control-plane index rebuild；
- BYOS/hosted repository policy；
- imported Archive Scrub；
- Restore Project creation from imported Archive。

### Phase 8 — 需要拆分子 Gate

增加：

- Restore 与 Source Release 独立 Verdict；
- Source Release production disabled until Phase 9；
- Archive Import → Restore round；
- 24h post-cutover verification gate；
- source-only Preserve journey completion。

### Phase 9 — 必须重新收敛并允许 Capability 扩展

当前范围极大，建议至少分成两个 Closure Gate：

```text
PH9-A Reliability/Security/Operations
PH9-B Capability/Product Experience/RC
```

增加：

- Build Breadth Certification Wave；
- Docker Compose full lifecycle；
- Vault/SOPS providers；
- target compatibility conversion matrix；
- Ubuntu 22.04→24.04 support round；
- optional MySQL/MariaDB logical migration and Redis explicit support level；
- Project-centered UX closure；
- Source Release production adoption；
- post-cutover scheduled verification operations。

将 Non-goal 从“不得新增重大业务能力”改为：

> 不得新增新的核心生命周期；允许基于已冻结 SDK 和合同增加受控 Adapter、Provider 和 Capability certification。

### Phase 10 — 保持终态关闭，但增加原始需求追踪 Gate

增加：

- `Original Requirement Traceability Matrix`；
- 每项标记 `GA-supported / limited / experimental / deferred / rejected`；
- 不允许把 deferred idea 写成已完成；
- Direct Source-only Preserve E2E；
- Docker Compose E2E；
- Archive Import E2E；
- target-at-project-start UX acceptance；
- 关键决策预算 acceptance；
- 24h post-cutover gate evidence。

Phase 10 不得自己实现缺失能力。

---

## 5. 仍然不会由 Phase 0–10 完成的想法

除非按上述修改扩展，以下想法不会全部完成：

1. PostgreSQL logical replication/近零停机；
2. MySQL/MariaDB 全闭环；
3. Redis/Valkey 持久数据和共享场景全闭环；
4. Gitea/Forgejo、WordPress、Nextcloud、MinIO 深度 Capability；
5. 多云 DNS/LB/EIP 自动 Provider；
6. x86→ARM 自动转换；
7. 跨多种 Linux 发行版的广泛认证；
8. 全磁盘/VM Image 兜底；
9. 可选远端 Agent；
10. Ticket/CMDB/Policy-as-code/Webhook/CI 完整企业集成；
11. Marketplace 和动态第三方插件；
12. Active-active、Weighted Canary、多主数据库；
13. 多区域控制面和跨租户去重。

这些有些是最初的扩展想法，有些已被正式设计列为非目标。必须在 GA Support Matrix 中明确，不能说“全部需求已经完成”。

---

## 6. Preparation 已完成后的处理方式

不需要重新执行整个 Preparation，也不应改写已经关闭的 Preparation Evidence/Handoff。

在执行 Phase 0 前增加一个不可变 Addendum：

```text
delivery/phase-0-platform-and-persistence/00a-post-preparation-requirement-gap-addendum.md
```

内容包含：

- 原始分析文件 Hash；
- phase ZIP Hash；
- 本审计报告 Hash；
- 新增/修改的跨阶段要求；
- 受影响的 Phase Prompt versions；
- 受影响的 normative docs/OpenAPI/Reference DDL；
- 只需重新验证的 Preparation 项；
- 不重跑的 Preparation 项；
- Phase 0 Entry 必须确认的 blocker。

若修改了 Preparation 已验证过的 Reference DDL、OpenAPI 或 Schema，执行一次**定向 Delta Validation**：

- docs link/terminology validation；
- OpenAPI/schema validation；
- Reference DDL clean apply；
- contract examples；
- hash/index regeneration。

这不是重新执行 Preparation，而是把新的 Design Delta 合法地带入 Phase 0。

---

## 7. 建议的最终判定

### 可以确认的部分

按现有 Prompt 执行，理论上可以完成一条强安全边界的限定场景：

```text
Ubuntu 24.04 x86_64
Nginx + systemd app + PostgreSQL 16 + uploads + timer/worker
→ Build
→ Assessment/Candidate Review
→ Filesystem/PostgreSQL/Docker-volume data engine
→ bounded-downtime Cutover
→ business verification/rollback
→ Archive/Scrub/Drill
→ Restore
→ Source Release
→ production hardening
→ GA closure
```

### 不能确认的部分

不能确认它会自动完成：

- 用户最初要求的所有产品体验；
- Build 广而全；
- Docker Compose 完整纵向闭环；
- Vault/SOPS；
- MySQL/Redis；
- 近零停机 PostgreSQL；
- 控制面丢失后的 Archive Import；
- 独立 source-only Preserve 用户旅程；
- 24h 业务复查；
- 任务中心、低决策量 UI；
- 全磁盘镜像和所有企业扩展。

因此，Phase 0–10 目前应被描述为：

> **能够覆盖 EnvForge v1 的核心限定闭环，但尚不能覆盖最初对话中的全部需求和扩展想法。必须先修正 Phase 1、4、7、8、9，并对 Phase 3、5、6 的认证范围做补强或明确限制，才能把“核心限定闭环完成”升级为“最初需求基本完整落地”。**
