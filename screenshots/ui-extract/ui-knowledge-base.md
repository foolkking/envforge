# Web UI Knowledge Base

## 1. 应用概览
- 产品名称：EnvForge
- 应用地址：http://127.0.0.1:5173/
- 登录方式：账号密码 / OAuth / Bearer token；本次 admin token 已脱敏为 `<ADMIN_TOKEN_REDACTED>`
- 当前登录角色：admin；另覆盖 anonymous 截图；user 权限基于导航、API gate 和代码推断
- 目标用户：Linux 服务器运维人员、迁移执行者、平台管理员、能力规则维护者
- 核心任务：采集源环境证据，选择已认证能力，生成/审查/执行 Rebuild Plan，查看迁移/重建/修复报告，维护能力规则和 Full Migration 标准
- 顶层信息架构：Dashboard / Migrate / Build / Plans / Reports / Capability Admin
- 主要业务对象：ConnectionProfile、HostSnapshot、CatalogItem / Capability、CapabilityRequirement、CapabilityStandardProfile、EnvironmentPlan、PlanRun、Schedule、DriftReport、Webhook、Report、Suggestion、PackageIntegration、AdminAuditLog
- 提取说明：已覆盖 desktop 1440x900 与 mobile 390x844；截图前后结合页面可见文本、DOM/可访问结构、API 调用和代码映射整理。删除、发布、回滚、Webhook 外发、真实 apply 等危险动作只记录入口和确认流程，未实际确认。

## 2. 全局导航结构
- Dashboard（user/admin，默认落点）：工作区汇总、快捷入口、Inbox、账号安全。状态入口：`page=dashboard`
- Migrate（user/admin）：源 VM 连接、采集、上传快照。状态入口：`page=machine`
- Build（anonymous/user/admin）：已认证能力选择和 Rebuild Plan 创建。状态入口：`page=market`
- Plans（user/admin）：二级 tab 为 Plans / Runs / Schedules / Drift / Webhooks / Reports。状态入口：`page=playbooks`
- Reports（user/admin）：独立只读报告中心。状态入口：`page=reports`
- Capability Admin（admin only）：二级 tab 为 Overview / Rule Registry / Standards / Suggestion Inbox / Package Integrations / Users & Queues。状态入口：`page=catalog`

```text
EnvForge
├─ Dashboard [user, admin] default
│  ├─ Inbox drawer
│  └─ Account & Security
├─ Migrate [user, admin]
├─ Build [anonymous limited, user, admin]
├─ Plans [user, admin]
│  ├─ Plans
│  ├─ Runs
│  ├─ Schedules
│  ├─ Drift
│  ├─ Webhooks
│  └─ Reports
├─ Reports [user, admin]
└─ Capability Admin [admin]
   ├─ Overview
   ├─ Rule Registry
   ├─ Standards
   ├─ Suggestion Inbox
   ├─ Package Integrations
   └─ Users & Queues
```

## 3. 页面清单
### Page: 匿名首页 / 登录入口
- 路径 / 状态入口：http://127.0.0.1:5173/，无 localStorage session
- 角色权限：anonymous
- 页面目的：让未登录访问者看到 EnvForge 的外壳、账号菜单、登录/注册/OAuth 入口；不暴露需要用户数据的工作台能力。
- 主要区域：Sidebar shell / Topbar / Account menu / AuthDialog
- 核心组件：buttons / forms / modal / account menu
- 可见文案摘要：EnvForge、Linux 环境重建与迁移平台、Login/Register、GitHub/Google OAuth provider、账号密码字段。
- 主要操作：打开登录弹窗 / 切换注册 / 发起 GitHub/Google OAuth / 请求密码重置
- 表单字段：登录：账号/邮箱、密码、2FA/恢复码（需要时） / 注册：用户名/邮箱/密码/验证码（两步注册） / 密码重置：邮箱、重置 token、新密码
- 表格列：无
- 过滤器 / 搜索：无
- 弹窗 / 抽屉：AuthDialog
- 空状态：临时运行库数据较稀疏，Plans/Runs/Reports/Audit 等区域可见空状态。
- 加载状态：API-backed 页面会先显示 Loading/刷新中状态；截图均在请求稳定后采集。
- 错误状态：未主动触发真实失败；代码和 UI 模式显示错误通常为红色 banner、inline error 或 403 Admin only。
- 关联 API：
- GET /api/auth/providers：渲染 OAuth provider 按钮；决定 GitHub/Google 是否可见
- POST /api/auth/login：账号密码登录；返回 session 或 2FA/enroll 中间态
- POST /api/auth/register/start, /api/auth/register/verify：两步注册；发送/验证邮箱验证码
- POST /api/auth/password-reset/request, /api/auth/password-reset/confirm：密码重置；生成并确认 reset token
- 截图：
  - desktop: E:/1project/EnvForge/screenshots/ui-extract/anonymous-home-desktop.png
  - mobile: E:/1project/EnvForge/screenshots/ui-extract/anonymous-login-dialog-mobile.png
  - other: E:/1project/EnvForge/screenshots/ui-extract/anonymous-login-dialog-desktop.png
- 大模型理解备注：
- 这是权限边界入口，不等同于用户工作台。
- OAuth 回调会把 token 放入前端可读状态；报告中已脱敏。

### Page: Dashboard
- 路径 / 状态入口：page=dashboard；登录后默认落点
- 角色权限：user, admin
- 页面目的：个人工作台：整合当前用户、角色、目标主机、快照、Plan、报告、通知、账号安全和活动统计。
- 主要区域：Workspace Summary / Quick Actions / Runtime Notices / My Snapshots / My Reports / Inbox / Notifications / Account & Security / Recent Plan Activity
- 核心组件：summary cards / buttons / forms / checkboxes / drawer / empty states
- 可见文案摘要：Dashboard、Workspace Summary、Current user/role/target host、Quick Actions、Runtime Notices、Account & Security、No snapshots yet、No plans yet。
- 主要操作：Connect new VM / Collect HostSnapshot / Create Build Plan / View Plan Review / Open recent Report / 保存个人资料 / 发送邮箱验证码 / 更新密码 / 开启 2FA / 绑定 GitHub/Google / 删除账号（危险，未确认）
- 表单字段：个人资料：display name、username、avatar URL、默认 SSH 用户、bio / 邮箱变更：新邮箱、验证码 / 账号安全：当前密码、新密码、2FA/恢复码 / 通知偏好：@提及、评论回复、建议状态、发布结果
- 表格列：活动统计卡：连接机器、上传配置、Playbook、执行任务、OAuth 登录、API Tokens
- 过滤器 / 搜索：无
- 弹窗 / 抽屉：Inbox drawer / Account menu
- 空状态：临时运行库数据较稀疏，Plans/Runs/Reports/Audit 等区域可见空状态。
- 加载状态：API-backed 页面会先显示 Loading/刷新中状态；截图均在请求稳定后采集。
- 错误状态：未主动触发真实失败；代码和 UI 模式显示错误通常为红色 banner、inline error 或 403 Admin only。
- 关联 API：
- GET/PATCH /api/me：读取/保存账号资料；当前用户和安全设置
- GET /api/connections：读取目标主机；当前 target host 和快照入口
- GET /api/plans：读取最近计划；Pending Plan / Recent Plan Activity
- GET /api/me/inbox, /api/me/inbox/unread-count：读取通知；通知数量和抽屉列表
- POST/PUT /api/me/password, /api/me/2fa/*, /api/me/notification-prefs：安全设置；密码、2FA、通知偏好
- 截图：
  - desktop: E:/1project/EnvForge/screenshots/ui-extract/dashboard-desktop.png
  - mobile: E:/1project/EnvForge/screenshots/ui-extract/dashboard-mobile.png
  - other: E:/1project/EnvForge/screenshots/ui-extract/dashboard-inbox-drawer-desktop.png, E:/1project/EnvForge/screenshots/ui-extract/account-menu-desktop.png
- 大模型理解备注：
- 原 Account 一级导航已折叠到 Dashboard。
- Dashboard 是导航枢纽，不直接执行真实变更；危险操作需要二次认证。

### Page: Migrate
- 路径 / 状态入口：page=machine
- 角色权限：user, admin
- 页面目的：源环境证据入口：连接 Linux VM、只读采集 HostSnapshot、上传已有 snapshot，并把源环境转换为后续计划证据。
- 主要区域：Connection profile / Connection detail / Inventory / config panels / Terminal / log / Upload snapshot
- 核心组件：connection form / buttons / status badges / inventory panels / terminal panel / empty state
- 可见文案摘要：Connect source Linux VM、Host/Port/Username、Collect HostSnapshot、Upload snapshot、Connection status、source collection is read-only。
- 主要操作：新增连接 / 选择连接 / reprobe / capture/scan / 上传 VM snapshot / 更新连接 / 删除连接（危险，未确认）
- 表单字段：连接：host、port、username、password 或 private key path/passphrase / 上传快照：snapshot JSON/metadata
- 表格列：连接/快照摘要 / 软件清单、配置检查、迁移候选
- 过滤器 / 搜索：连接选择器
- 弹窗 / 抽屉：Connection detail panel
- 空状态：临时运行库数据较稀疏，Plans/Runs/Reports/Audit 等区域可见空状态。
- 加载状态：API-backed 页面会先显示 Loading/刷新中状态；截图均在请求稳定后采集。
- 错误状态：未主动触发真实失败；代码和 UI 模式显示错误通常为红色 banner、inline error 或 403 Admin only。
- 关联 API：
- POST /api/connections/connect：创建连接并采集；连接档案和 HostSnapshot
- GET/PATCH/DELETE /api/connections, /api/connections/:id：连接列表/更新/删除；左侧/详情连接状态
- POST/GET /api/connections/:id/reprobe, /api/connections/:id/capture：重新探测/采集；软件、服务、配置证据
- POST/GET /api/connections/:id/upload-snapshot, /api/profiles：上传或读取快照 profile；后续 migration/build 数据源
- 截图：
  - desktop: E:/1project/EnvForge/screenshots/ui-extract/migrate-desktop.png
  - mobile: E:/1project/EnvForge/screenshots/ui-extract/migrate-mobile.png
- 大模型理解备注：
- Migrate 强调只读源采集。目标变更必须转入 Environment Plan / Apply Gate。
- 真实 SSH、私钥、主机名/IP 在报告中应脱敏。

### Page: Build / Certified Capabilities
- 路径 / 状态入口：page=market
- 角色权限：anonymous, user, admin
- 页面目的：用户侧能力选择界面：只展示 Full Migration Certified 能力，用于生成 Rebuild Plan。未认证/缺失能力留在 Capability Admin，不出现在普通 Build 列表。
- 主要区域：Build Mode stepper / Search / Category filters / Certified-only banner / Capability list / Selected drawer / active task / Guide / Configure modal
- 核心组件：workflow stepper / search box / filter pills / capability cards / badges / markdown overlay / configure form / plan review panel
- 可见文案摘要：Certified Capabilities、Build only shows capabilities that passed Full Migration Certified、runtime/database/security/network/container/developer/service、Add/Create Plan、Guide。
- 主要操作：搜索能力 / 按类别过滤 / 选择/取消选择能力 / 打开 guide / 配置变量 / 创建 Rebuild Plan / 运行 preflight / 进入 Plan Review / 取消 active task（非破坏性取消请求）
- 表单字段：搜索框 / ConfigureRunPanel：按 vars-schema 动态生成字段 / PlanReviewPanel：风险确认、冲突处理、审批 gate
- 表格列：无
- 过滤器 / 搜索：全文搜索 / category filter：runtime/database/security/network/container/developer/service
- 弹窗 / 抽屉：MarkdownOverlay guide/comments/suggest / ConfigureRunPanel / PlanReviewPanel
- 空状态：临时运行库数据较稀疏，Plans/Runs/Reports/Audit 等区域可见空状态。
- 加载状态：API-backed 页面会先显示 Loading/刷新中状态；截图均在请求稳定后采集。
- 错误状态：未主动触发真实失败；代码和 UI 模式显示错误通常为红色 banner、inline error 或 403 Admin only。
- 关联 API：
- GET /api/catalog：读取 certified-only catalog；能力卡片列表
- GET /api/catalog/:id/guide：打开能力文档；MarkdownOverlay
- GET/POST /api/catalog/:id/vars-schema, /api/catalog/:id/preview：配置变量并预览 playbook；ConfigureRunPanel
- GET /api/build/:targetId/suggestions：基于目标主机推荐能力；Build 建议
- POST /api/plans, /api/plans/:id/review, /api/plans/:id/apply：创建、审查、应用计划；Rebuild Plan 生命周期
- GET /api/connections/:id/preflight, /api/connections/:id/distro：目标检查与发行版兼容性；兼容性/执行前置状态
- 截图：
  - desktop: E:/1project/EnvForge/screenshots/ui-extract/build-desktop.png
  - mobile: E:/1project/EnvForge/screenshots/ui-extract/build-mobile.png
- 大模型理解备注：
- 不要把 Build catalog 与管理员 Rule Registry 混淆：Build 是 certified-only 消费端。
- 创建计划后仍需 Plan Review 和 Apply Gate，不能直接真实执行。

### Page: Plans / Environment Plans
- 路径 / 状态入口：page=playbooks tab=Plans
- 角色权限：user, admin
- 页面目的：Plan 生命周期中心：列出、筛选、查看和恢复持久化 Environment Plans，支撑 review → apply → verify → rollback → report 闭环。
- 主要区域：Plans tab bar / Plan filters / Plan list / Plan detail aside / Plan Review panel / Report preview
- 核心组件：tabs / filter pills / plan cards / detail panel / status chips / buttons
- 可见文案摘要：Environment Plans、all/migration/rebuild/change/remove/repair/imported-recipe、No Environment Plans yet、Pick a plan to inspect actions。
- 主要操作：刷新 / 按类型筛选 / 选择计划 / 重新验证 / 回滚（危险，未确认真实执行） / 查看报告 / 从失败 verify 生成 Repair Plan
- 表单字段：PlanReviewPanel：审批、风险确认、冲突确认
- 表格列：计划列表：name、type、status、updatedAt、verify/rollback counts / 详情：actions、verify results、rollback results、history
- 过滤器 / 搜索：Plan type filter
- 弹窗 / 抽屉：PlanReviewPanel
- 空状态：临时运行库数据较稀疏，Plans/Runs/Reports/Audit 等区域可见空状态。
- 加载状态：API-backed 页面会先显示 Loading/刷新中状态；截图均在请求稳定后采集。
- 错误状态：未主动触发真实失败；代码和 UI 模式显示错误通常为红色 banner、inline error 或 403 Admin only。
- 关联 API：
- GET/POST /api/plans：列出或创建计划；计划列表
- GET /api/plans/:id：计划详情；actions、verify、rollback、history
- POST /api/plans/:id/review：审查批准/拒绝；Apply Gate 前置状态
- POST /api/plans/:id/apply：应用计划；执行任务/门禁结果
- POST/GET /api/plans/:id/verify, /api/plans/:id/rollback, /api/plans/:id/repair-from-verify, /api/plans/:id/report：验证/回滚/修复/报告；生命周期后续状态
- 截图：
  - desktop: E:/1project/EnvForge/screenshots/ui-extract/plans-desktop.png
  - mobile: E:/1project/EnvForge/screenshots/ui-extract/plans-mobile.png
- 大模型理解备注：
- 该页不创建业务能力，只承载生命周期操作。
- 回滚和 apply 属于高风险动作，提取时只观察按钮和门禁流程。

### Page: Plans / Runs
- 路径 / 状态入口：page=playbooks tab=Runs
- 角色权限：user, admin
- 页面目的：查看计划运行历史或任务执行状态；当前临时数据为空。
- 主要区域：Runs tab / run list / empty state
- 核心组件：tabs / table/list / empty state
- 可见文案摘要：Runs、No runs / empty state。
- 主要操作：查看运行历史 / 刷新/进入详情（有数据时）
- 表单字段：无
- 表格列：运行列：run id、plan、status、started/finished、result（有数据时）
- 过滤器 / 搜索：无
- 弹窗 / 抽屉：无
- 空状态：临时运行库数据较稀疏，Plans/Runs/Reports/Audit 等区域可见空状态。
- 加载状态：API-backed 页面会先显示 Loading/刷新中状态；截图均在请求稳定后采集。
- 错误状态：未主动触发真实失败；代码和 UI 模式显示错误通常为红色 banner、inline error 或 403 Admin only。
- 关联 API：
- GET /api/plan-runs 或 /api/plans/:id history：读取运行历史；Runs tab
- 截图：
  - desktop: E:/1project/EnvForge/screenshots/ui-extract/plans-runs-desktop.png
  - mobile: E:/1project/EnvForge/screenshots/ui-extract/plans-runs-mobile.png
- 大模型理解备注：
- 当前未触达非空运行详情，需要 seed 运行记录或真实执行任务。

### Page: Plans / Schedules
- 路径 / 状态入口：page=playbooks tab=Schedules
- 角色权限：user, admin
- 页面目的：维护计划调度：定义 cron、目标连接、playbook/plan 触发。
- 主要区域：Schedules list / Create schedule form
- 核心组件：tabs / form / buttons / table/list / empty state
- 可见文案摘要：Schedules、Create schedule、enabled、cron、target、playbook。
- 主要操作：创建调度 / 启用/禁用 / 删除调度（危险，未确认） / 刷新
- 表单字段：name、cron、timezone、target connection、playbook/plan、enabled
- 表格列：Schedule：name、cron、target、enabled、last run/next run
- 过滤器 / 搜索：无
- 弹窗 / 抽屉：无
- 空状态：临时运行库数据较稀疏，Plans/Runs/Reports/Audit 等区域可见空状态。
- 加载状态：API-backed 页面会先显示 Loading/刷新中状态；截图均在请求稳定后采集。
- 错误状态：未主动触发真实失败；代码和 UI 模式显示错误通常为红色 banner、inline error 或 403 Admin only。
- 关联 API：
- GET/POST/PATCH/DELETE /api/schedules, /api/schedules/:id：调度 CRUD；Schedules tab
- 截图：
  - desktop: E:/1project/EnvForge/screenshots/ui-extract/plans-schedules-desktop.png
  - mobile: E:/1project/EnvForge/screenshots/ui-extract/plans-schedules-mobile.png
- 大模型理解备注：
- 调度会触发真实任务，提取中不创建会执行的调度。

### Page: Plans / Drift
- 路径 / 状态入口：page=playbooks tab=Drift
- 角色权限：user, admin
- 页面目的：设置目标主机漂移基线并运行 drift check，把未授权变化转为 review/repair 线索。
- 主要区域：Connection selector / baseline card / drift report
- 核心组件：tabs / selector / buttons / diff summary / empty state
- 可见文案摘要：Drift、Set baseline、Run drift check、Review unauthorised change。
- 主要操作：选择连接 / 设置基线 / 运行 drift check / 将漂移生成 change/repair plan（有数据时）
- 表单字段：连接选择
- 表格列：Drift report：added/removed packages、config drift、services
- 过滤器 / 搜索：connection selector
- 弹窗 / 抽屉：无
- 空状态：临时运行库数据较稀疏，Plans/Runs/Reports/Audit 等区域可见空状态。
- 加载状态：API-backed 页面会先显示 Loading/刷新中状态；截图均在请求稳定后采集。
- 错误状态：未主动触发真实失败；代码和 UI 模式显示错误通常为红色 banner、inline error 或 403 Admin only。
- 关联 API：
- POST/GET /api/connections/:id/drift/baseline, /api/connections/:id/drift：设置基线/运行漂移检查；Drift report 与 webhook 触发
- 截图：
  - desktop: E:/1project/EnvForge/screenshots/ui-extract/plans-drift-desktop.png
  - mobile: E:/1project/EnvForge/screenshots/ui-extract/plans-drift-mobile.png
- 大模型理解备注：
- 需要已有连接和前后快照才能看到非空 drift。

### Page: Plans / Webhooks
- 路径 / 状态入口：page=playbooks tab=Webhooks
- 角色权限：user, admin
- 页面目的：维护出站通知 webhook，订阅 task.completed、task.failed、drift.detected、schedule.fired 等事件。
- 主要区域：Webhook list / Create webhook form / test result
- 核心组件：tabs / form / checkboxes / buttons / table/list
- 可见文案摘要：Webhooks、URL、Secret、Events、Test、Delete。
- 主要操作：创建 webhook / 启用/禁用 / 测试 webhook（会发出请求，提取中未执行真实外发） / 删除 webhook（危险，未确认）
- 表单字段：label、url、secret、events、enabled
- 表格列：Webhook：label、url、events、enabled、last status
- 过滤器 / 搜索：无
- 弹窗 / 抽屉：无
- 空状态：临时运行库数据较稀疏，Plans/Runs/Reports/Audit 等区域可见空状态。
- 加载状态：API-backed 页面会先显示 Loading/刷新中状态；截图均在请求稳定后采集。
- 错误状态：未主动触发真实失败；代码和 UI 模式显示错误通常为红色 banner、inline error 或 403 Admin only。
- 关联 API：
- GET/POST/PATCH/DELETE/POST /api/webhooks, /api/webhooks/:id, /api/webhooks/:id/test：Webhook CRUD/测试；通知订阅和测试结果
- 截图：
  - desktop: E:/1project/EnvForge/screenshots/ui-extract/plans-webhooks-desktop.png
  - mobile: E:/1project/EnvForge/screenshots/ui-extract/plans-webhooks-mobile.png
- 大模型理解备注：
- URL、secret 属敏感数据，报告必须脱敏。

### Page: Plans / Reports
- 路径 / 状态入口：page=playbooks tab=Reports
- 角色权限：user, admin
- 页面目的：在 Plans 中查看计划报告证据；与独立 Reports 页面共享报告数据。
- 主要区域：Report list / Report detail / empty state
- 核心组件：tabs / report list / markdown/text panel / empty state
- 可见文案摘要：Reports、No reports yet、View report。
- 主要操作：选择报告 / 查看 Markdown 报告 / 复制/下载（有数据时）
- 表单字段：无
- 表格列：Report：plan、type、updatedAt、status
- 过滤器 / 搜索：无
- 弹窗 / 抽屉：无
- 空状态：临时运行库数据较稀疏，Plans/Runs/Reports/Audit 等区域可见空状态。
- 加载状态：API-backed 页面会先显示 Loading/刷新中状态；截图均在请求稳定后采集。
- 错误状态：未主动触发真实失败；代码和 UI 模式显示错误通常为红色 banner、inline error 或 403 Admin only。
- 关联 API：
- GET /api/plans/:id/report, /api/plans：读取计划报告；报告证据内容
- 截图：
  - desktop: E:/1project/EnvForge/screenshots/ui-extract/plans-reports-desktop.png
  - mobile: E:/1project/EnvForge/screenshots/ui-extract/plans-reports-mobile.png
- 大模型理解备注：
- 报告是证据视图，不提供 apply/edit。

### Page: Reports
- 路径 / 状态入口：page=reports
- 角色权限：user, admin
- 页面目的：独立只读报告中心，查看迁移、重建、修复报告和执行证据。
- 主要区域：Report filters/list / Report detail / Evidence summary
- 核心组件：list / buttons / markdown/text panel / empty state
- 可见文案摘要：Reports、Select a plan/report、No reports yet。
- 主要操作：刷新计划 / 选择计划 / 查看报告详情
- 表单字段：无
- 表格列：Report/Plan：name、type、status、updatedAt
- 过滤器 / 搜索：plan/report selector（有数据时）
- 弹窗 / 抽屉：无
- 空状态：临时运行库数据较稀疏，Plans/Runs/Reports/Audit 等区域可见空状态。
- 加载状态：API-backed 页面会先显示 Loading/刷新中状态；截图均在请求稳定后采集。
- 错误状态：未主动触发真实失败；代码和 UI 模式显示错误通常为红色 banner、inline error 或 403 Admin only。
- 关联 API：
- GET /api/plans, /api/plans/:id/report：列出计划并读取报告；只读报告页面
- 截图：
  - desktop: E:/1project/EnvForge/screenshots/ui-extract/reports-desktop.png
  - mobile: E:/1project/EnvForge/screenshots/ui-extract/reports-mobile.png
- 大模型理解备注：
- Reports 不承担执行动作；对大模型来说它是审计/证据出口。

### Page: Capability Admin / Overview
- 路径 / 状态入口：page=catalog tab=overview
- 角色权限：admin
- 页面目的：管理员能力规则治理总览：认证覆盖率、not-ready 数量、P0 backlog、待处理建议和缺失要求。
- 主要区域：Stats cards / P0 table / Missing requirements / admin tablist
- 核心组件：tabs / cards / tables / badges / buttons
- 可见文案摘要：Capability Admin、Overview、Certified coverage、P0 backlog、missing requirements、Build only shows certified capabilities。
- 主要操作：查看待升级能力 / 复制缺失项 / 生成升级 prompt
- 表单字段：无
- 表格列：P0 backlog：Capability、Category、Missing、Status / Missing requirements
- 过滤器 / 搜索：无
- 弹窗 / 抽屉：无
- 空状态：临时运行库数据较稀疏，Plans/Runs/Reports/Audit 等区域可见空状态。
- 加载状态：API-backed 页面会先显示 Loading/刷新中状态；截图均在请求稳定后采集。
- 错误状态：未主动触发真实失败；代码和 UI 模式显示错误通常为红色 banner、inline error 或 403 Admin only。
- 关联 API：
- GET /api/catalog/certification, /api/admin/suggestions：读取治理概览和建议数量；覆盖率和 backlog
- 截图：
  - desktop: E:/1project/EnvForge/screenshots/ui-extract/capability-admin-desktop.png
  - mobile: E:/1project/EnvForge/screenshots/ui-extract/capability-admin-mobile.png
  - other: E:/1project/EnvForge/screenshots/ui-extract/admin-overview-desktop.png, E:/1project/EnvForge/screenshots/ui-extract/admin-overview-mobile.png
- 大模型理解备注：
- 这是管理员入口；普通 user 会被重定向到 Build 或收到 Admin only。

### Page: Capability Admin / Rule Registry
- 路径 / 状态入口：page=catalog tab=registry
- 角色权限：admin
- 页面目的：全量能力规则注册表：展示所有能力的认证状态、类别、缺失项和详情入口，包含未认证能力。
- 主要区域：Search / status/category filters / rules table / detail panel
- 核心组件：tabs / search box / filter pills / table / badges
- 可见文案摘要：Rule Registry、Search、service/network/database/container/security/developer/runtime、Capability、Type、Status、Missing。
- 主要操作：搜索 / 按类别/状态过滤 / 查看规则详情 / 复制缺失项
- 表单字段：搜索框
- 表格列：Rules table：Capability、Type/Category、Certification Status、Missing requirements、Actions
- 过滤器 / 搜索：搜索 / category filter / status filter
- 弹窗 / 抽屉：detail drawer/panel（有行详情时）
- 空状态：临时运行库数据较稀疏，Plans/Runs/Reports/Audit 等区域可见空状态。
- 加载状态：API-backed 页面会先显示 Loading/刷新中状态；截图均在请求稳定后采集。
- 错误状态：未主动触发真实失败；代码和 UI 模式显示错误通常为红色 banner、inline error 或 403 Admin only。
- 关联 API：
- GET /api/catalog/certification：读取全量认证注册表；规则表和缺失项
- 截图：
  - desktop: E:/1project/EnvForge/screenshots/ui-extract/admin-registry-desktop.png
  - mobile: E:/1project/EnvForge/screenshots/ui-extract/admin-registry-mobile.png
- 大模型理解备注：
- Registry 是管理员治理面，不能作为普通 Build 列表来源。

### Page: Capability Admin / Standards
- 路径 / 状态入口：page=catalog tab=standards
- 角色权限：admin
- 页面目的：线上维护的版本化标准层：维护 standard profile、每能力 requirement draft、simulation runs、published versions、rollback history 和 audit log。
- 主要区域：Profile selector / Capability selector / Standard profiles table/editor / Section editor / Version history / Run history / Audit log
- 核心组件：tabs / selectors / tables / forms / status cards / buttons / badges
- 可见文案摘要：Versioned standards layer、Full Migration Certified v1/v2、New profile、Clone draft、Clone active、Edit、certified、Published version、Draft、13/13 Sections、Last simulation。
- 主要操作：New profile / Clone draft / Clone active / Edit profile / 选择 capability / Mark all satisfied/pending / Save draft / Simulate / Publish（危险，未确认） / Rollback（危险，未确认）
- 表单字段：Profile editor：key、name、description、status、sections / Requirement section editor：section status、notes、evidence、rule overlay
- 表格列：Standard profiles：Profile、Key、Status、Sections、Updated、Action / Version history：Version、Status、Published / Runs：Result、Sections、At / Audit log：Action、Target、Old/New、Feedback、Timestamp
- 过滤器 / 搜索：Profile selector / Capability selector / section status filter
- 弹窗 / 抽屉：Profile editor / section editor
- 空状态：临时运行库数据较稀疏，Plans/Runs/Reports/Audit 等区域可见空状态。
- 加载状态：API-backed 页面会先显示 Loading/刷新中状态；截图均在请求稳定后采集。
- 错误状态：未主动触发真实失败；代码和 UI 模式显示错误通常为红色 banner、inline error 或 403 Admin only。
- 关联 API：
- GET/POST /api/admin/capability-standards：列出/创建 profile；profile 表与 active profile
- PATCH /api/admin/capability-standards/:id：更新 profile；状态、名称、sections
- POST /api/admin/capability-standards/:id/clone：克隆 draft/active；版本化标准迭代
- GET /api/admin/capabilities/:id/requirements：读取某能力要求详情；draft/current/projected sections
- PATCH /api/admin/capabilities/:id/requirements/draft：保存 requirement draft；草稿状态
- POST /api/admin/capabilities/:id/certification/simulate：模拟认证；simulation run / section coverage
- POST /api/admin/capabilities/:id/requirements/publish：发布版本；published version 和 audit
- POST /api/admin/capabilities/:id/rollback-version：回滚版本；恢复旧要求版本
- GET /api/admin/capabilities/:id/certification/runs, /api/admin/capability-audit-log：读取运行与审计；治理追踪
- 截图：
  - desktop: E:/1project/EnvForge/screenshots/ui-extract/admin-standards-desktop.png
  - mobile: E:/1project/EnvForge/screenshots/ui-extract/admin-standards-mobile.png
- 大模型理解备注：
- 这是本轮新增的核心“线上维护版本化标准层”。
- Publish/Rollback 会改变治理状态，UI 提取中只记录流程，不确认执行。

### Page: Capability Admin / Suggestion Inbox
- 路径 / 状态入口：page=catalog tab=suggestions
- 角色权限：admin
- 页面目的：处理用户提交的能力建议、组合调整和规则缺口反馈。
- 主要区域：Status filter / suggestions table / feedback actions
- 核心组件：tabs / filters / table / buttons / empty state
- 可见文案摘要：Suggestion Inbox、pending/accepted/rejected、Accept、Reject、feedback。
- 主要操作：按状态筛选 / 接受建议（未确认真实处理） / 拒绝建议（未确认真实处理） / 填写反馈
- 表单字段：feedback textarea / input
- 表格列：Suggestions：User、Capability/Combo、Type、Status、Created、Feedback、Actions
- 过滤器 / 搜索：status filter：pending/accepted/rejected
- 弹窗 / 抽屉：无
- 空状态：临时运行库数据较稀疏，Plans/Runs/Reports/Audit 等区域可见空状态。
- 加载状态：API-backed 页面会先显示 Loading/刷新中状态；截图均在请求稳定后采集。
- 错误状态：未主动触发真实失败；代码和 UI 模式显示错误通常为红色 banner、inline error 或 403 Admin only。
- 关联 API：
- GET/POST /api/admin/suggestions, /api/admin/suggestions/:id/process：读取/处理建议；建议队列和反馈状态
- 截图：
  - desktop: E:/1project/EnvForge/screenshots/ui-extract/admin-suggestions-desktop.png
  - mobile: E:/1project/EnvForge/screenshots/ui-extract/admin-suggestions-mobile.png
- 大模型理解备注：
- 普通用户提交建议的入口在 guide/comments/suggest overlay；管理员在这里 triage。

### Page: Capability Admin / Package Integrations
- 路径 / 状态入口：page=catalog tab=integrations
- 角色权限：admin
- 页面目的：查看规则级跨发行版包名、服务名、二进制、配置路径、端口、验证、回滚和数据策略映射。
- 主要区域：Search/filter / integration list/table / detail panel / raw rule JSON
- 核心组件：tabs / search box / table / detail panel / badges / code block
- 可见文案摘要：Package Integrations、package map、service map、config files、validate、rollback、data strategy、raw rule JSON。
- 主要操作：搜索 / 筛选 hasRule/withoutRule/status / 选择 capability / 查看 rule detail
- 表单字段：搜索框
- 表格列：Integrations：Capability、Category、Rule status、Packages、Services、Configs、Ports
- 过滤器 / 搜索：search / status/hasRule filter
- 弹窗 / 抽屉：detail panel
- 空状态：临时运行库数据较稀疏，Plans/Runs/Reports/Audit 等区域可见空状态。
- 加载状态：API-backed 页面会先显示 Loading/刷新中状态；截图均在请求稳定后采集。
- 错误状态：未主动触发真实失败；代码和 UI 模式显示错误通常为红色 banner、inline error 或 403 Admin only。
- 关联 API：
- GET /api/admin/package-integrations, /api/admin/package-integrations/:capabilityId：读取集成映射/详情；规则级包支持矩阵
- 截图：
  - desktop: E:/1project/EnvForge/screenshots/ui-extract/admin-integrations-desktop.png
  - mobile: E:/1project/EnvForge/screenshots/ui-extract/admin-integrations-mobile.png
- 大模型理解备注：
- 这里是规则治理，不是主机包管理器；不要把 package map 当作当前机器已安装包。

### Page: Capability Admin / Users & Queues
- 路径 / 状态入口：page=catalog tab=users-queues
- 角色权限：admin
- 页面目的：查看维护者、reviewer、admin 的能力分配、建议负载、backlog 和治理队列。
- 主要区域：Users table / Queues table
- 核心组件：tabs / tables / badges / empty/loading state
- 可见文案摘要：Users & Queues、User、Role、Assigned capabilities、Open suggestions、Review load、Queue、Priority、Owner group、Next action。
- 主要操作：查看分配 / 查看队列负载 / 识别 P0/P1 队列
- 表单字段：无
- 表格列：Users：Name、Role、Assigned、Open suggestions、Backlog、Review load、Last active / Queues：Name、Type、Open items、Priority、Oldest item、Owner group、Status、Next action
- 过滤器 / 搜索：无
- 弹窗 / 抽屉：无
- 空状态：临时运行库数据较稀疏，Plans/Runs/Reports/Audit 等区域可见空状态。
- 加载状态：API-backed 页面会先显示 Loading/刷新中状态；截图均在请求稳定后采集。
- 错误状态：未主动触发真实失败；代码和 UI 模式显示错误通常为红色 banner、inline error 或 403 Admin only。
- 关联 API：
- GET /api/admin/capability-users, /api/admin/capability-queues：读取人员和队列；维护者和队列分配
- 截图：
  - desktop: E:/1project/EnvForge/screenshots/ui-extract/admin-users-queues-desktop.png
  - mobile: E:/1project/EnvForge/screenshots/ui-extract/admin-users-queues-mobile.png
- 大模型理解备注：
- 这是运营视图，不直接编辑用户权限；当前界面以查看为主。

## 4. 组件库归纳
### Buttons
- 视觉用途：主按钮为绿色实心，次级操作为浅色边框；危险按钮在当前数据下多为禁用或需要二次确认。
- 交互行为：触发导航、保存、刷新、模拟、发布、回滚、测试 Webhook、开启 2FA 等。危险动作只记录流程，不实际确认。
- 复用页面：Dashboard、Migrate、Build、Plans、Capability Admin
- 状态变体：default、hover、disabled、busy/loading、destructive
- 相关文案：Connect new VM、Collect HostSnapshot、Create Build Plan、Save draft、Simulate、Publish、Rollback

### Tabs
- 视觉用途：一级导航在左侧 sidebar；二级 tab 使用横向 tablist，当前 tab 有下划线/高亮。
- 交互行为：切换同一页面内部的数据域，不刷新浏览器地址；Capability Admin 和 Plans 的 tab 会触发懒加载 API。
- 复用页面：Plans、Capability Admin
- 状态变体：active、inactive、badge count
- 相关文案：Plans、Runs、Schedules、Drift、Webhooks、Reports、Overview、Rule Registry、Standards

### Tables
- 视觉用途：浅色表头、细边框、紧凑行高，适合管理后台扫描。
- 交互行为：行可点击或带操作按钮；部分表格配合搜索/状态筛选；当前未观察到分页控件，部分 API 支持 cursor/limit。
- 复用页面：Rule Registry、Standards、Suggestion Inbox、Package Integrations、Users & Queues、Plans
- 状态变体：loaded、empty、filtered empty
- 相关文案：Capability、Type、Status、Missing、Version、Published、User、Role、Load、Queue

### Forms
- 视觉用途：label 在上、输入框在下；移动端单列，桌面端部分双列。
- 交互行为：提交前有基本空值校验；认证、连接、账号资料、调度、Webhook、标准 profile/section 均用表单。
- 复用页面：AuthDialog、Dashboard Account & Security、Migrate、Schedules、Webhooks、Standards
- 状态变体：empty、filled、validation error、saving
- 相关文案：Email / username、Password、Host、Port、Username、Webhook URL、Profile、Capability

### Cards
- 视觉用途：8px 左右圆角、白底浅边框；用于汇总指标、能力条目、Plan 条目。
- 交互行为：展示摘要或作为详情入口；Build 卡片可选择能力或打开 guide/configure。
- 复用页面：Dashboard、Build、Plans、Capability Admin Overview
- 状态变体：normal、selected、certified、not-ready、empty
- 相关文案：Current user、Pending Plan、Full Migration Certified

### Modals / Drawers
- 视觉用途：AuthDialog 为居中弹窗；Inbox 为侧向抽屉；Markdown guide / configure / review 面板为覆盖层或内嵌面板。
- 交互行为：打开后提取对应 DOM/可见文本；关闭不改变业务数据。删除、发布、支付、真实执行等危险确认未被确认。
- 复用页面：Global、Build、Plans、Dashboard
- 状态变体：open、closed、loading、error
- 相关文案：Sign in、Register、Inbox / Notifications、Plan Review

### Badges / Status indicators
- 视觉用途：小号圆角标签，颜色区分 admin、active、draft、certified、pending、warning。
- 交互行为：表达权限、认证、运行状态和缺失项，不单独触发动作。
- 复用页面：Global topbar、Build、Plans、Capability Admin
- 状态变体：admin、active、draft、certified、pending、none
- 相关文案：admin、certified、draft、active、13/13 sections

### Filters / Search boxes
- 视觉用途：搜索框 + pill/button filter；移动端换行堆叠。
- 交互行为：在前端过滤能力/规则/建议/集成项，或通过 API query 过滤建议。
- 复用页面：Build、Rule Registry、Suggestion Inbox、Package Integrations、Plans
- 状态变体：all、category selected、status selected、no match
- 相关文案：Search、runtime、database、security、pending

### Empty / Error banners
- 视觉用途：空状态为灰色提示文本；错误为红色/橙色 banner。
- 交互行为：稀疏临时数据下多处显示 No plans / No reports；错误状态未主动破坏性触发。
- 复用页面：Dashboard、Plans、Reports、Suggestions
- 状态变体：empty、connection-error、403 admin only、validation error
- 相关文案：No plans yet.、No reports yet.、Admin only.

## 5. 关键用户流程
### 登录
- 起点：匿名首页账号菜单
- 前置条件：无需登录；OAuth provider 取决于配置
- 步骤：打开 Account menu → 点击 Login/Register → 输入账号密码或进入 OAuth → 如要求 2FA，提交 TOTP/恢复码 → 登录成功后进入 Dashboard
- 中间状态：2FA pending、enrollment required、login error
- 成功状态：local session 建立，topbar 显示用户和角色
- 失败状态：AuthDialog inline error
- 涉及页面：anonymous-auth、dashboard
- 涉及 API：/api/auth/providers、/api/auth/login、/api/auth/login/2fa、/api/auth/session
- 截图索引：E:/1project/EnvForge/screenshots/ui-extract/anonymous-login-dialog-desktop.png、E:/1project/EnvForge/screenshots/ui-extract/dashboard-desktop.png

### 连接并采集源 VM
- 起点：Migrate
- 前置条件：已登录；有可用 SSH 凭据或可上传 snapshot
- 步骤：填写 host/port/user/auth → Connect & collect → 查看连接状态 → reprobe/capture HostSnapshot → 在 Dashboard/Build/Plans 使用采集证据
- 中间状态：probing/loading、connection error、snapshot empty
- 成功状态：连接和 HostSnapshot 写入 runtime store
- 失败状态：连接错误 banner 或表单错误
- 涉及页面：migrate、dashboard
- 涉及 API：/api/connections/connect、/api/connections/:id/reprobe、/api/connections/:id/capture
- 截图索引：E:/1project/EnvForge/screenshots/ui-extract/migrate-desktop.png

### 创建 Rebuild Plan
- 起点：Build
- 前置条件：建议已登录并选择 target connection；匿名只能浏览有限内容
- 步骤：搜索/筛选 certified capability → 选择能力 → 按 vars-schema 配置变量（可选） → 创建 Environment Plan → Plan Review 确认风险/冲突 → Apply Gate 后才可执行
- 中间状态：compatibility check、selected drawer、review required、apply gate refused
- 成功状态：生成 rebuild plan 并进入 Plans 生命周期
- 失败状态：缺少登录/连接、schema 校验失败或 apply gate 拒绝
- 涉及页面：build、plans
- 涉及 API：/api/catalog、/api/catalog/:id/preview、/api/plans、/api/plans/:id/review、/api/plans/:id/apply
- 截图索引：E:/1project/EnvForge/screenshots/ui-extract/build-desktop.png、E:/1project/EnvForge/screenshots/ui-extract/plans-desktop.png

### Plan 生命周期
- 起点：Plans
- 前置条件：已有 Environment Plan
- 步骤：选择 Plan → 查看 actions/risk/verify/history → Review approve/reject → Apply/dry-run → Verify → 必要时 Repair from verify 或 Rollback → 查看 Report
- 中间状态：draft、needs-review、approved、applying、verified、failed
- 成功状态：计划完成并有报告证据
- 失败状态：verify failed、rollback failed 或 gate refused
- 涉及页面：plans、plans-reports、reports
- 涉及 API：/api/plans/:id、/api/plans/:id/review、/api/plans/:id/apply、/api/plans/:id/verify、/api/plans/:id/rollback、/api/plans/:id/report
- 截图索引：E:/1project/EnvForge/screenshots/ui-extract/plans-desktop.png、E:/1project/EnvForge/screenshots/ui-extract/reports-desktop.png

### 调度 / 漂移 / Webhook 运维
- 起点：Plans 二级 tabs
- 前置条件：已登录；需要连接或外部 webhook URL
- 步骤：Schedules 创建/启停任务 → Drift 设置 baseline 并检查 → Webhooks 创建订阅并可测试 → 事件触发后回写运行/通知/报告
- 中间状态：empty schedule、baseline missing、webhook disabled、test failed
- 成功状态：调度、漂移和通知进入可观察状态
- 失败状态：外部 URL 不可达、缺少连接、权限不足
- 涉及页面：plans-schedules、plans-drift、plans-webhooks
- 涉及 API：/api/schedules、/api/connections/:id/drift、/api/webhooks
- 截图索引：E:/1project/EnvForge/screenshots/ui-extract/plans-schedules-desktop.png、E:/1project/EnvForge/screenshots/ui-extract/plans-drift-desktop.png、E:/1project/EnvForge/screenshots/ui-extract/plans-webhooks-desktop.png

### 管理员维护版本化标准层
- 起点：Capability Admin / Standards
- 前置条件：admin role；Bearer <ADMIN_TOKEN_REDACTED>
- 步骤：选择 profile 和 capability → 克隆或新建标准 profile → 编辑 requirement sections → Save draft → Simulate → Publish → 必要时 Rollback → 查看 audit log
- 中间状态：draft、active、retired、simulation none、section pending/satisfied
- 成功状态：发布版本记录治理状态，Build certified-only gate 按新标准工作
- 失败状态：403、profile 不可变、section 不满足、publish 拒绝
- 涉及页面：capability-admin-standards
- 涉及 API：/api/admin/capability-standards、/api/admin/capabilities/:id/requirements/draft、/api/admin/capabilities/:id/certification/simulate、/api/admin/capabilities/:id/requirements/publish、/api/admin/capability-audit-log
- 截图索引：E:/1project/EnvForge/screenshots/ui-extract/admin-standards-desktop.png

### 管理员建议处理
- 起点：Capability Admin / Suggestion Inbox
- 前置条件：admin role；存在用户建议
- 步骤：按状态筛选 → 查看建议内容 → 填写反馈 → Accept 或 Reject → 建议状态进入用户 inbox
- 中间状态：pending、accepted、rejected
- 成功状态：建议被处理并产生反馈
- 失败状态：403 或处理 API 失败
- 涉及页面：capability-admin-suggestions、dashboard
- 涉及 API：/api/admin/suggestions、/api/admin/suggestions/:id/process、/api/me/inbox
- 截图索引：E:/1project/EnvForge/screenshots/ui-extract/admin-suggestions-desktop.png、E:/1project/EnvForge/screenshots/ui-extract/dashboard-inbox-drawer-desktop.png

## 6. 权限矩阵
| 功能 | anonymous | user | admin | 备注 |
|---|---|---|---|---|
| 匿名访问应用 shell / 登录入口 | 允许 | 已登录后不需要 | 已登录后不需要 | token/密码/验证码不写入报告 |
| Build certified catalog 浏览 | 可见受限 | 可见并可选择 | 可见并可选择 | 只展示 Full Migration Certified 能力 |
| 创建 Rebuild Plan | 不可执行 | 允许，需 target connection | 允许，需 target connection | 仍需 Review / Apply Gate |
| Dashboard / Account / Inbox | 不可访问 | 自己的数据 | 自己的数据 + admin role 标识 | 账号删除需二次认证 |
| Migrate 连接和采集 | 不可访问 | 允许自己的连接 | 允许自己的连接 | 源采集只读；真实 SSH 凭据脱敏 |
| Plans 生命周期 | 不可访问 | 自己的 plans | 自己的 plans | apply/rollback 为危险动作，提取未确认执行 |
| Schedules / Drift / Webhooks | 不可访问 | 自己的资源 | 自己的资源 | Webhook 测试可能外发，提取未执行 |
| Reports | 不可访问 | 自己的报告 | 自己的报告 | 只读证据视图 |
| Capability Admin | 不可见/403 | 不可见/403 | 允许 | main.tsx 和 API 双层 gate |
| Rule Registry 全量规则 | 不可访问 | 不可访问 | 允许 | 包含未认证/not-ready 能力 |
| Versioned standards layer | 不可访问 | 403 | create/edit/clone/simulate/publish/rollback/audit | Publish/Rollback 改变治理状态 |
| Suggestion Inbox 处理 | 不可访问 | 只能提交/查看自己的建议 | 处理全部建议 | 处理结果可进入用户 inbox |
| Package Integrations / Users & Queues | 不可访问 | 不可访问 | 查看 | 当前界面以治理查看为主 |

## 7. API 与界面映射
| 页面 / 组件 | API | 方法 | 触发动作 | 返回数据用途 |
|---|---|---|---|---|
| AuthDialog | /api/auth/providers | GET | 打开登录弹窗 | 渲染 OAuth provider |
| AuthDialog | /api/auth/login, /api/auth/login/2fa, /api/auth/session | POST/GET | 登录/2FA/session 恢复 | 建立当前角色 |
| Dashboard | /api/me, /api/me/* | GET/PATCH/POST/PUT/DELETE | 打开工作台或保存安全设置 | 账号资料、安全、通知偏好 |
| Dashboard Inbox | /api/me/inbox, /api/me/inbox/:id/read | GET/POST/DELETE | 打开通知抽屉/标记已读/删除 | 通知列表和未读数 |
| Migrate | /api/connections/connect, /api/connections/:id/reprobe, /api/connections/:id/capture | POST/GET | 连接/探测/采集 | 连接状态和 HostSnapshot |
| Build | /api/catalog, /api/catalog/:id/guide, /api/catalog/:id/vars-schema, /api/catalog/:id/preview | GET/POST | 浏览/打开 guide/配置变量/预览 | 能力卡片、文档、动态表单 |
| Build / Plans | /api/plans, /api/plans/:id/review, /api/plans/:id/apply | POST | 创建计划/审查/应用 | Environment Plan 生命周期 |
| Plans | /api/plans, /api/plans/:id, /api/plans/:id/verify, /api/plans/:id/rollback, /api/plans/:id/report | GET/POST | 列表/详情/验证/回滚/报告 | 计划状态、结果和证据 |
| Schedules | /api/schedules, /api/schedules/:id | GET/POST/PATCH/DELETE | 创建/启停/删除调度 | 计划自动化 |
| Drift | /api/connections/:id/drift/baseline, /api/connections/:id/drift | POST/GET | 设置基线/检查漂移 | 漂移报告 |
| Webhooks | /api/webhooks, /api/webhooks/:id/test | GET/POST/PATCH/DELETE | 管理/测试通知 | 外部事件通知 |
| Capability Admin Overview / Registry | /api/catalog/certification | GET | 打开管理员页或 Registry | 全量认证状态与缺失项 |
| Standards | /api/admin/capability-standards, /api/admin/capabilities/:id/requirements* | GET/POST/PATCH | profile / requirement 维护 | 版本化标准、草稿、发布、回滚、审计 |
| Suggestion Inbox | /api/admin/suggestions, /api/admin/suggestions/:id/process | GET/POST | 筛选/处理建议 | 建议队列状态 |
| Package Integrations | /api/admin/package-integrations, /api/admin/package-integrations/:id | GET | 打开集成映射/详情 | 包、服务、配置、数据策略规则 |
| Users & Queues | /api/admin/capability-users, /api/admin/capability-queues | GET | 打开运营视图 | 维护者和队列分配 |

## 8. 截图索引
| 编号 | 页面 | 状态 | 视口 | 文件路径 | 说明 |
|---|---|---|---|---|---|
| S01 | 匿名首页 / 登录入口 | 未登录首页 | desktop 1440x900 | E:/1project/EnvForge/screenshots/ui-extract/anonymous-home-desktop.png | 未登录 shell、导航与账号入口 |
| S02 | 匿名首页 / 登录入口 | 登录弹窗 | desktop 1440x900 | E:/1project/EnvForge/screenshots/ui-extract/anonymous-login-dialog-desktop.png | AuthDialog：账号密码、注册/OAuth 入口 |
| S03 | 匿名首页 / 登录入口 | 登录弹窗 | mobile 390x844 | E:/1project/EnvForge/screenshots/ui-extract/anonymous-login-dialog-mobile.png | 移动端 AuthDialog 布局 |
| S04 | Dashboard | 默认工作台 | desktop 1440x900 | E:/1project/EnvForge/screenshots/ui-extract/dashboard-desktop.png | 工作区汇总、快捷操作、账号安全 |
| S05 | Dashboard | 默认工作台 | mobile 390x844 | E:/1project/EnvForge/screenshots/ui-extract/dashboard-mobile.png | 移动端 Dashboard |
| S06 | Dashboard | Inbox drawer | desktop 1440x900 | E:/1project/EnvForge/screenshots/ui-extract/dashboard-inbox-drawer-desktop.png | 通知抽屉 |
| S07 | 全局 | Account menu | desktop 1440x900 | E:/1project/EnvForge/screenshots/ui-extract/account-menu-desktop.png | 账号菜单、登录状态和退出入口 |
| S08 | Migrate | 默认页 | desktop 1440x900 | E:/1project/EnvForge/screenshots/ui-extract/migrate-desktop.png | 连接、采集、上传快照 |
| S09 | Migrate | 默认页 | mobile 390x844 | E:/1project/EnvForge/screenshots/ui-extract/migrate-mobile.png | 移动端 Migrate |
| S10 | Build | Certified capabilities | desktop 1440x900 | E:/1project/EnvForge/screenshots/ui-extract/build-desktop.png | 已认证能力列表和 Rebuild Plan 创建入口 |
| S11 | Build | Certified capabilities | mobile 390x844 | E:/1project/EnvForge/screenshots/ui-extract/build-mobile.png | 移动端长列表 |
| S12 | Plans | Plans tab | desktop 1440x900 | E:/1project/EnvForge/screenshots/ui-extract/plans-desktop.png | Environment Plans 列表和详情区域 |
| S13 | Plans | Plans tab | mobile 390x844 | E:/1project/EnvForge/screenshots/ui-extract/plans-mobile.png | 移动端 Plans |
| S14 | Plans / Runs | Runs tab | desktop 1440x900 | E:/1project/EnvForge/screenshots/ui-extract/plans-runs-desktop.png | 运行历史空状态 |
| S15 | Plans / Runs | Runs tab | mobile 390x844 | E:/1project/EnvForge/screenshots/ui-extract/plans-runs-mobile.png | 移动端 Runs |
| S16 | Plans / Schedules | Schedules tab | desktop 1440x900 | E:/1project/EnvForge/screenshots/ui-extract/plans-schedules-desktop.png | 调度列表和创建表单 |
| S17 | Plans / Schedules | Schedules tab | mobile 390x844 | E:/1project/EnvForge/screenshots/ui-extract/plans-schedules-mobile.png | 移动端 Schedules |
| S18 | Plans / Drift | Drift tab | desktop 1440x900 | E:/1project/EnvForge/screenshots/ui-extract/plans-drift-desktop.png | 漂移基线和检查入口 |
| S19 | Plans / Drift | Drift tab | mobile 390x844 | E:/1project/EnvForge/screenshots/ui-extract/plans-drift-mobile.png | 移动端 Drift |
| S20 | Plans / Webhooks | Webhooks tab | desktop 1440x900 | E:/1project/EnvForge/screenshots/ui-extract/plans-webhooks-desktop.png | Webhook 列表、创建、测试入口 |
| S21 | Plans / Webhooks | Webhooks tab | mobile 390x844 | E:/1project/EnvForge/screenshots/ui-extract/plans-webhooks-mobile.png | 移动端 Webhooks |
| S22 | Plans / Reports | Reports tab | desktop 1440x900 | E:/1project/EnvForge/screenshots/ui-extract/plans-reports-desktop.png | 计划内报告证据入口 |
| S23 | Plans / Reports | Reports tab | mobile 390x844 | E:/1project/EnvForge/screenshots/ui-extract/plans-reports-mobile.png | 移动端计划报告 |
| S24 | Reports | 独立报告页 | desktop 1440x900 | E:/1project/EnvForge/screenshots/ui-extract/reports-desktop.png | 只读报告列表/详情 |
| S25 | Reports | 独立报告页 | mobile 390x844 | E:/1project/EnvForge/screenshots/ui-extract/reports-mobile.png | 移动端报告页 |
| S26 | Capability Admin | 默认概览 | desktop 1440x900 | E:/1project/EnvForge/screenshots/ui-extract/capability-admin-desktop.png | 管理员工作台默认视图 |
| S27 | Capability Admin | 默认概览 | mobile 390x844 | E:/1project/EnvForge/screenshots/ui-extract/capability-admin-mobile.png | 移动端管理员工作台 |
| S28 | Capability Admin / Overview | Overview tab | desktop 1440x900 | E:/1project/EnvForge/screenshots/ui-extract/admin-overview-desktop.png | 覆盖率、P0 backlog、缺失项 |
| S29 | Capability Admin / Overview | Overview tab | mobile 390x844 | E:/1project/EnvForge/screenshots/ui-extract/admin-overview-mobile.png | 移动端 Overview |
| S30 | Capability Admin / Rule Registry | Rule Registry tab | desktop 1440x900 | E:/1project/EnvForge/screenshots/ui-extract/admin-registry-desktop.png | 能力规则注册表 |
| S31 | Capability Admin / Rule Registry | Rule Registry tab | mobile 390x844 | E:/1project/EnvForge/screenshots/ui-extract/admin-registry-mobile.png | 移动端规则表 |
| S32 | Capability Admin / Standards | Standards tab | desktop 1440x900 | E:/1project/EnvForge/screenshots/ui-extract/admin-standards-desktop.png | 版本化标准层 |
| S33 | Capability Admin / Standards | Standards tab | mobile 390x844 | E:/1project/EnvForge/screenshots/ui-extract/admin-standards-mobile.png | 移动端 Standards |
| S34 | Capability Admin / Suggestion Inbox | Suggestion Inbox tab | desktop 1440x900 | E:/1project/EnvForge/screenshots/ui-extract/admin-suggestions-desktop.png | 建议处理队列 |
| S35 | Capability Admin / Suggestion Inbox | Suggestion Inbox tab | mobile 390x844 | E:/1project/EnvForge/screenshots/ui-extract/admin-suggestions-mobile.png | 移动端建议队列 |
| S36 | Capability Admin / Package Integrations | Package Integrations tab | desktop 1440x900 | E:/1project/EnvForge/screenshots/ui-extract/admin-integrations-desktop.png | 规则级包/服务/配置映射 |
| S37 | Capability Admin / Package Integrations | Package Integrations tab | mobile 390x844 | E:/1project/EnvForge/screenshots/ui-extract/admin-integrations-mobile.png | 移动端集成映射 |
| S38 | Capability Admin / Users & Queues | Users & Queues tab | desktop 1440x900 | E:/1project/EnvForge/screenshots/ui-extract/admin-users-queues-desktop.png | 维护者和队列分配 |
| S39 | Capability Admin / Users & Queues | Users & Queues tab | mobile 390x844 | E:/1project/EnvForge/screenshots/ui-extract/admin-users-queues-mobile.png | 移动端 Users & Queues |

## 9. 大模型可读 JSON
```json
{
  "app": {
    "name": "EnvForge",
    "purpose": "Linux 环境重建、迁移计划、执行证据和能力规则治理平台。",
    "roles": [
      "anonymous",
      "user",
      "admin"
    ],
    "currentRole": "admin（临时本地 token 已脱敏）",
    "url": "http://127.0.0.1:5173/",
    "extraction": {
      "language": "中文",
      "viewports": [
        "desktop 1440x900",
        "mobile 390x844"
      ],
      "screenshotDir": "E:/1project/EnvForge/screenshots/ui-extract",
      "method": "已通过浏览器自动化访问页面、截图，并结合 DOM/可见文本/API/源码映射整理；危险动作未确认执行。"
    },
    "businessObjects": [
      "ConnectionProfile",
      "HostSnapshot",
      "CatalogItem / Capability",
      "CapabilityRequirement",
      "CapabilityStandardProfile",
      "EnvironmentPlan",
      "PlanRun",
      "Schedule",
      "DriftReport",
      "Webhook",
      "Report",
      "Suggestion",
      "PackageIntegration",
      "AdminAuditLog"
    ]
  },
  "navigation": [
    {
      "id": "dashboard",
      "label": "Dashboard",
      "entry": "page=dashboard",
      "default": true,
      "roles": [
        "user",
        "admin"
      ],
      "children": [],
      "notes": "登录后默认落点；Account/Inbox 折叠在此。"
    },
    {
      "id": "machine",
      "label": "Migrate",
      "entry": "page=machine",
      "roles": [
        "user",
        "admin"
      ],
      "children": [],
      "notes": "源 VM 连接、采集、上传快照。"
    },
    {
      "id": "market",
      "label": "Build",
      "entry": "page=market",
      "roles": [
        "anonymous",
        "user",
        "admin"
      ],
      "children": [],
      "notes": "普通用户 certified-only 能力选择页。"
    },
    {
      "id": "playbooks",
      "label": "Plans",
      "entry": "page=playbooks",
      "roles": [
        "user",
        "admin"
      ],
      "children": [
        "Plans",
        "Runs",
        "Schedules",
        "Drift",
        "Webhooks",
        "Reports"
      ],
      "notes": "计划生命周期中心。"
    },
    {
      "id": "reports",
      "label": "Reports",
      "entry": "page=reports",
      "roles": [
        "user",
        "admin"
      ],
      "children": [],
      "notes": "独立只读报告中心。"
    },
    {
      "id": "catalog",
      "label": "Capability Admin",
      "entry": "page=catalog",
      "roles": [
        "admin"
      ],
      "children": [
        "Overview",
        "Rule Registry",
        "Standards",
        "Suggestion Inbox",
        "Package Integrations",
        "Users & Queues"
      ],
      "notes": "管理员能力规则治理；非 admin 不可见/不可访问。"
    }
  ],
  "pages": [
    {
      "id": "anonymous-auth",
      "name": "匿名首页 / 登录入口",
      "entry": "http://127.0.0.1:5173/，无 localStorage session",
      "roles": [
        "anonymous"
      ],
      "purpose": "让未登录访问者看到 EnvForge 的外壳、账号菜单、登录/注册/OAuth 入口；不暴露需要用户数据的工作台能力。",
      "regions": [
        "Sidebar shell",
        "Topbar",
        "Account menu",
        "AuthDialog"
      ],
      "components": [
        "buttons",
        "forms",
        "modal",
        "account menu"
      ],
      "visibleTextSummary": "EnvForge、Linux 环境重建与迁移平台、Login/Register、GitHub/Google OAuth provider、账号密码字段。",
      "actions": [
        "打开登录弹窗",
        "切换注册",
        "发起 GitHub/Google OAuth",
        "请求密码重置"
      ],
      "forms": [
        "登录：账号/邮箱、密码、2FA/恢复码（需要时）",
        "注册：用户名/邮箱/密码/验证码（两步注册）",
        "密码重置：邮箱、重置 token、新密码"
      ],
      "tables": [],
      "filters": [],
      "modalsDrawers": [
        "AuthDialog"
      ],
      "states": {
        "loading": "API-backed 页面会先显示 Loading/刷新中状态；截图均在请求稳定后采集。",
        "empty": "临时运行库数据较稀疏，Plans/Runs/Reports/Audit 等区域可见空状态。",
        "error": "未主动触发真实失败；代码和 UI 模式显示错误通常为红色 banner、inline error 或 403 Admin only。",
        "success": "API 200 后呈现 settled state；保存/模拟/发布等会刷新表格或显示结果区域。"
      },
      "apis": [
        {
          "api": "/api/auth/providers",
          "method": "GET",
          "action": "渲染 OAuth provider 按钮",
          "use": "决定 GitHub/Google 是否可见"
        },
        {
          "api": "/api/auth/login",
          "method": "POST",
          "action": "账号密码登录",
          "use": "返回 session 或 2FA/enroll 中间态"
        },
        {
          "api": "/api/auth/register/start, /api/auth/register/verify",
          "method": "POST",
          "action": "两步注册",
          "use": "发送/验证邮箱验证码"
        },
        {
          "api": "/api/auth/password-reset/request, /api/auth/password-reset/confirm",
          "method": "POST",
          "action": "密码重置",
          "use": "生成并确认 reset token"
        }
      ],
      "screenshots": [
        "E:/1project/EnvForge/screenshots/ui-extract/anonymous-home-desktop.png",
        "E:/1project/EnvForge/screenshots/ui-extract/anonymous-login-dialog-desktop.png",
        "E:/1project/EnvForge/screenshots/ui-extract/anonymous-login-dialog-mobile.png"
      ],
      "llmNotes": [
        "这是权限边界入口，不等同于用户工作台。",
        "OAuth 回调会把 token 放入前端可读状态；报告中已脱敏。"
      ]
    },
    {
      "id": "dashboard",
      "name": "Dashboard",
      "entry": "page=dashboard；登录后默认落点",
      "roles": [
        "user",
        "admin"
      ],
      "purpose": "个人工作台：整合当前用户、角色、目标主机、快照、Plan、报告、通知、账号安全和活动统计。",
      "regions": [
        "Workspace Summary",
        "Quick Actions",
        "Runtime Notices",
        "My Snapshots / My Reports",
        "Inbox / Notifications",
        "Account & Security",
        "Recent Plan Activity"
      ],
      "components": [
        "summary cards",
        "buttons",
        "forms",
        "checkboxes",
        "drawer",
        "empty states"
      ],
      "visibleTextSummary": "Dashboard、Workspace Summary、Current user/role/target host、Quick Actions、Runtime Notices、Account & Security、No snapshots yet、No plans yet。",
      "actions": [
        "Connect new VM",
        "Collect HostSnapshot",
        "Create Build Plan",
        "View Plan Review",
        "Open recent Report",
        "保存个人资料",
        "发送邮箱验证码",
        "更新密码",
        "开启 2FA",
        "绑定 GitHub/Google",
        "删除账号（危险，未确认）"
      ],
      "forms": [
        "个人资料：display name、username、avatar URL、默认 SSH 用户、bio",
        "邮箱变更：新邮箱、验证码",
        "账号安全：当前密码、新密码、2FA/恢复码",
        "通知偏好：@提及、评论回复、建议状态、发布结果"
      ],
      "tables": [
        "活动统计卡：连接机器、上传配置、Playbook、执行任务、OAuth 登录、API Tokens"
      ],
      "filters": [],
      "modalsDrawers": [
        "Inbox drawer",
        "Account menu"
      ],
      "states": {
        "loading": "API-backed 页面会先显示 Loading/刷新中状态；截图均在请求稳定后采集。",
        "empty": "临时运行库数据较稀疏，Plans/Runs/Reports/Audit 等区域可见空状态。",
        "error": "未主动触发真实失败；代码和 UI 模式显示错误通常为红色 banner、inline error 或 403 Admin only。",
        "success": "API 200 后呈现 settled state；保存/模拟/发布等会刷新表格或显示结果区域。"
      },
      "apis": [
        {
          "api": "/api/me",
          "method": "GET/PATCH",
          "action": "读取/保存账号资料",
          "use": "当前用户和安全设置"
        },
        {
          "api": "/api/connections",
          "method": "GET",
          "action": "读取目标主机",
          "use": "当前 target host 和快照入口"
        },
        {
          "api": "/api/plans",
          "method": "GET",
          "action": "读取最近计划",
          "use": "Pending Plan / Recent Plan Activity"
        },
        {
          "api": "/api/me/inbox, /api/me/inbox/unread-count",
          "method": "GET",
          "action": "读取通知",
          "use": "通知数量和抽屉列表"
        },
        {
          "api": "/api/me/password, /api/me/2fa/*, /api/me/notification-prefs",
          "method": "POST/PUT",
          "action": "安全设置",
          "use": "密码、2FA、通知偏好"
        }
      ],
      "screenshots": [
        "E:/1project/EnvForge/screenshots/ui-extract/dashboard-desktop.png",
        "E:/1project/EnvForge/screenshots/ui-extract/dashboard-mobile.png",
        "E:/1project/EnvForge/screenshots/ui-extract/dashboard-inbox-drawer-desktop.png",
        "E:/1project/EnvForge/screenshots/ui-extract/account-menu-desktop.png"
      ],
      "llmNotes": [
        "原 Account 一级导航已折叠到 Dashboard。",
        "Dashboard 是导航枢纽，不直接执行真实变更；危险操作需要二次认证。"
      ]
    },
    {
      "id": "migrate",
      "name": "Migrate",
      "entry": "page=machine",
      "roles": [
        "user",
        "admin"
      ],
      "purpose": "源环境证据入口：连接 Linux VM、只读采集 HostSnapshot、上传已有 snapshot，并把源环境转换为后续计划证据。",
      "regions": [
        "Connection profile",
        "Connection detail",
        "Inventory / config panels",
        "Terminal / log",
        "Upload snapshot"
      ],
      "components": [
        "connection form",
        "buttons",
        "status badges",
        "inventory panels",
        "terminal panel",
        "empty state"
      ],
      "visibleTextSummary": "Connect source Linux VM、Host/Port/Username、Collect HostSnapshot、Upload snapshot、Connection status、source collection is read-only。",
      "actions": [
        "新增连接",
        "选择连接",
        "reprobe",
        "capture/scan",
        "上传 VM snapshot",
        "更新连接",
        "删除连接（危险，未确认）"
      ],
      "forms": [
        "连接：host、port、username、password 或 private key path/passphrase",
        "上传快照：snapshot JSON/metadata"
      ],
      "tables": [
        "连接/快照摘要",
        "软件清单、配置检查、迁移候选"
      ],
      "filters": [
        "连接选择器"
      ],
      "modalsDrawers": [
        "Connection detail panel"
      ],
      "states": {
        "loading": "API-backed 页面会先显示 Loading/刷新中状态；截图均在请求稳定后采集。",
        "empty": "临时运行库数据较稀疏，Plans/Runs/Reports/Audit 等区域可见空状态。",
        "error": "未主动触发真实失败；代码和 UI 模式显示错误通常为红色 banner、inline error 或 403 Admin only。",
        "success": "API 200 后呈现 settled state；保存/模拟/发布等会刷新表格或显示结果区域。"
      },
      "apis": [
        {
          "api": "/api/connections/connect",
          "method": "POST",
          "action": "创建连接并采集",
          "use": "连接档案和 HostSnapshot"
        },
        {
          "api": "/api/connections, /api/connections/:id",
          "method": "GET/PATCH/DELETE",
          "action": "连接列表/更新/删除",
          "use": "左侧/详情连接状态"
        },
        {
          "api": "/api/connections/:id/reprobe, /api/connections/:id/capture",
          "method": "POST/GET",
          "action": "重新探测/采集",
          "use": "软件、服务、配置证据"
        },
        {
          "api": "/api/connections/:id/upload-snapshot, /api/profiles",
          "method": "POST/GET",
          "action": "上传或读取快照 profile",
          "use": "后续 migration/build 数据源"
        }
      ],
      "screenshots": [
        "E:/1project/EnvForge/screenshots/ui-extract/migrate-desktop.png",
        "E:/1project/EnvForge/screenshots/ui-extract/migrate-mobile.png"
      ],
      "llmNotes": [
        "Migrate 强调只读源采集。目标变更必须转入 Environment Plan / Apply Gate。",
        "真实 SSH、私钥、主机名/IP 在报告中应脱敏。"
      ]
    },
    {
      "id": "build",
      "name": "Build / Certified Capabilities",
      "entry": "page=market",
      "roles": [
        "anonymous",
        "user",
        "admin"
      ],
      "purpose": "用户侧能力选择界面：只展示 Full Migration Certified 能力，用于生成 Rebuild Plan。未认证/缺失能力留在 Capability Admin，不出现在普通 Build 列表。",
      "regions": [
        "Build Mode stepper",
        "Search",
        "Category filters",
        "Certified-only banner",
        "Capability list",
        "Selected drawer / active task",
        "Guide / Configure modal"
      ],
      "components": [
        "workflow stepper",
        "search box",
        "filter pills",
        "capability cards",
        "badges",
        "markdown overlay",
        "configure form",
        "plan review panel"
      ],
      "visibleTextSummary": "Certified Capabilities、Build only shows capabilities that passed Full Migration Certified、runtime/database/security/network/container/developer/service、Add/Create Plan、Guide。",
      "actions": [
        "搜索能力",
        "按类别过滤",
        "选择/取消选择能力",
        "打开 guide",
        "配置变量",
        "创建 Rebuild Plan",
        "运行 preflight",
        "进入 Plan Review",
        "取消 active task（非破坏性取消请求）"
      ],
      "forms": [
        "搜索框",
        "ConfigureRunPanel：按 vars-schema 动态生成字段",
        "PlanReviewPanel：风险确认、冲突处理、审批 gate"
      ],
      "tables": [],
      "filters": [
        "全文搜索",
        "category filter：runtime/database/security/network/container/developer/service"
      ],
      "modalsDrawers": [
        "MarkdownOverlay guide/comments/suggest",
        "ConfigureRunPanel",
        "PlanReviewPanel"
      ],
      "states": {
        "loading": "API-backed 页面会先显示 Loading/刷新中状态；截图均在请求稳定后采集。",
        "empty": "临时运行库数据较稀疏，Plans/Runs/Reports/Audit 等区域可见空状态。",
        "error": "未主动触发真实失败；代码和 UI 模式显示错误通常为红色 banner、inline error 或 403 Admin only。",
        "success": "API 200 后呈现 settled state；保存/模拟/发布等会刷新表格或显示结果区域。"
      },
      "apis": [
        {
          "api": "/api/catalog",
          "method": "GET",
          "action": "读取 certified-only catalog",
          "use": "能力卡片列表"
        },
        {
          "api": "/api/catalog/:id/guide",
          "method": "GET",
          "action": "打开能力文档",
          "use": "MarkdownOverlay"
        },
        {
          "api": "/api/catalog/:id/vars-schema, /api/catalog/:id/preview",
          "method": "GET/POST",
          "action": "配置变量并预览 playbook",
          "use": "ConfigureRunPanel"
        },
        {
          "api": "/api/build/:targetId/suggestions",
          "method": "GET",
          "action": "基于目标主机推荐能力",
          "use": "Build 建议"
        },
        {
          "api": "/api/plans, /api/plans/:id/review, /api/plans/:id/apply",
          "method": "POST",
          "action": "创建、审查、应用计划",
          "use": "Rebuild Plan 生命周期"
        },
        {
          "api": "/api/connections/:id/preflight, /api/connections/:id/distro",
          "method": "GET",
          "action": "目标检查与发行版兼容性",
          "use": "兼容性/执行前置状态"
        }
      ],
      "screenshots": [
        "E:/1project/EnvForge/screenshots/ui-extract/build-desktop.png",
        "E:/1project/EnvForge/screenshots/ui-extract/build-mobile.png"
      ],
      "llmNotes": [
        "不要把 Build catalog 与管理员 Rule Registry 混淆：Build 是 certified-only 消费端。",
        "创建计划后仍需 Plan Review 和 Apply Gate，不能直接真实执行。"
      ]
    },
    {
      "id": "plans",
      "name": "Plans / Environment Plans",
      "entry": "page=playbooks tab=Plans",
      "roles": [
        "user",
        "admin"
      ],
      "purpose": "Plan 生命周期中心：列出、筛选、查看和恢复持久化 Environment Plans，支撑 review → apply → verify → rollback → report 闭环。",
      "regions": [
        "Plans tab bar",
        "Plan filters",
        "Plan list",
        "Plan detail aside",
        "Plan Review panel",
        "Report preview"
      ],
      "components": [
        "tabs",
        "filter pills",
        "plan cards",
        "detail panel",
        "status chips",
        "buttons"
      ],
      "visibleTextSummary": "Environment Plans、all/migration/rebuild/change/remove/repair/imported-recipe、No Environment Plans yet、Pick a plan to inspect actions。",
      "actions": [
        "刷新",
        "按类型筛选",
        "选择计划",
        "重新验证",
        "回滚（危险，未确认真实执行）",
        "查看报告",
        "从失败 verify 生成 Repair Plan"
      ],
      "forms": [
        "PlanReviewPanel：审批、风险确认、冲突确认"
      ],
      "tables": [
        "计划列表：name、type、status、updatedAt、verify/rollback counts",
        "详情：actions、verify results、rollback results、history"
      ],
      "filters": [
        "Plan type filter"
      ],
      "modalsDrawers": [
        "PlanReviewPanel"
      ],
      "states": {
        "loading": "API-backed 页面会先显示 Loading/刷新中状态；截图均在请求稳定后采集。",
        "empty": "临时运行库数据较稀疏，Plans/Runs/Reports/Audit 等区域可见空状态。",
        "error": "未主动触发真实失败；代码和 UI 模式显示错误通常为红色 banner、inline error 或 403 Admin only。",
        "success": "API 200 后呈现 settled state；保存/模拟/发布等会刷新表格或显示结果区域。"
      },
      "apis": [
        {
          "api": "/api/plans",
          "method": "GET/POST",
          "action": "列出或创建计划",
          "use": "计划列表"
        },
        {
          "api": "/api/plans/:id",
          "method": "GET",
          "action": "计划详情",
          "use": "actions、verify、rollback、history"
        },
        {
          "api": "/api/plans/:id/review",
          "method": "POST",
          "action": "审查批准/拒绝",
          "use": "Apply Gate 前置状态"
        },
        {
          "api": "/api/plans/:id/apply",
          "method": "POST",
          "action": "应用计划",
          "use": "执行任务/门禁结果"
        },
        {
          "api": "/api/plans/:id/verify, /api/plans/:id/rollback, /api/plans/:id/repair-from-verify, /api/plans/:id/report",
          "method": "POST/GET",
          "action": "验证/回滚/修复/报告",
          "use": "生命周期后续状态"
        }
      ],
      "screenshots": [
        "E:/1project/EnvForge/screenshots/ui-extract/plans-desktop.png",
        "E:/1project/EnvForge/screenshots/ui-extract/plans-mobile.png"
      ],
      "llmNotes": [
        "该页不创建业务能力，只承载生命周期操作。",
        "回滚和 apply 属于高风险动作，提取时只观察按钮和门禁流程。"
      ]
    },
    {
      "id": "plans-runs",
      "name": "Plans / Runs",
      "entry": "page=playbooks tab=Runs",
      "roles": [
        "user",
        "admin"
      ],
      "purpose": "查看计划运行历史或任务执行状态；当前临时数据为空。",
      "regions": [
        "Runs tab",
        "run list / empty state"
      ],
      "components": [
        "tabs",
        "table/list",
        "empty state"
      ],
      "visibleTextSummary": "Runs、No runs / empty state。",
      "actions": [
        "查看运行历史",
        "刷新/进入详情（有数据时）"
      ],
      "forms": [],
      "tables": [
        "运行列：run id、plan、status、started/finished、result（有数据时）"
      ],
      "filters": [],
      "modalsDrawers": [],
      "states": {
        "loading": "API-backed 页面会先显示 Loading/刷新中状态；截图均在请求稳定后采集。",
        "empty": "临时运行库数据较稀疏，Plans/Runs/Reports/Audit 等区域可见空状态。",
        "error": "未主动触发真实失败；代码和 UI 模式显示错误通常为红色 banner、inline error 或 403 Admin only。",
        "success": "API 200 后呈现 settled state；保存/模拟/发布等会刷新表格或显示结果区域。"
      },
      "apis": [
        {
          "api": "/api/plan-runs 或 /api/plans/:id history",
          "method": "GET",
          "action": "读取运行历史",
          "use": "Runs tab"
        }
      ],
      "screenshots": [
        "E:/1project/EnvForge/screenshots/ui-extract/plans-runs-desktop.png",
        "E:/1project/EnvForge/screenshots/ui-extract/plans-runs-mobile.png"
      ],
      "llmNotes": [
        "当前未触达非空运行详情，需要 seed 运行记录或真实执行任务。"
      ]
    },
    {
      "id": "plans-schedules",
      "name": "Plans / Schedules",
      "entry": "page=playbooks tab=Schedules",
      "roles": [
        "user",
        "admin"
      ],
      "purpose": "维护计划调度：定义 cron、目标连接、playbook/plan 触发。",
      "regions": [
        "Schedules list",
        "Create schedule form"
      ],
      "components": [
        "tabs",
        "form",
        "buttons",
        "table/list",
        "empty state"
      ],
      "visibleTextSummary": "Schedules、Create schedule、enabled、cron、target、playbook。",
      "actions": [
        "创建调度",
        "启用/禁用",
        "删除调度（危险，未确认）",
        "刷新"
      ],
      "forms": [
        "name、cron、timezone、target connection、playbook/plan、enabled"
      ],
      "tables": [
        "Schedule：name、cron、target、enabled、last run/next run"
      ],
      "filters": [],
      "modalsDrawers": [],
      "states": {
        "loading": "API-backed 页面会先显示 Loading/刷新中状态；截图均在请求稳定后采集。",
        "empty": "临时运行库数据较稀疏，Plans/Runs/Reports/Audit 等区域可见空状态。",
        "error": "未主动触发真实失败；代码和 UI 模式显示错误通常为红色 banner、inline error 或 403 Admin only。",
        "success": "API 200 后呈现 settled state；保存/模拟/发布等会刷新表格或显示结果区域。"
      },
      "apis": [
        {
          "api": "/api/schedules, /api/schedules/:id",
          "method": "GET/POST/PATCH/DELETE",
          "action": "调度 CRUD",
          "use": "Schedules tab"
        }
      ],
      "screenshots": [
        "E:/1project/EnvForge/screenshots/ui-extract/plans-schedules-desktop.png",
        "E:/1project/EnvForge/screenshots/ui-extract/plans-schedules-mobile.png"
      ],
      "llmNotes": [
        "调度会触发真实任务，提取中不创建会执行的调度。"
      ]
    },
    {
      "id": "plans-drift",
      "name": "Plans / Drift",
      "entry": "page=playbooks tab=Drift",
      "roles": [
        "user",
        "admin"
      ],
      "purpose": "设置目标主机漂移基线并运行 drift check，把未授权变化转为 review/repair 线索。",
      "regions": [
        "Connection selector",
        "baseline card",
        "drift report"
      ],
      "components": [
        "tabs",
        "selector",
        "buttons",
        "diff summary",
        "empty state"
      ],
      "visibleTextSummary": "Drift、Set baseline、Run drift check、Review unauthorised change。",
      "actions": [
        "选择连接",
        "设置基线",
        "运行 drift check",
        "将漂移生成 change/repair plan（有数据时）"
      ],
      "forms": [
        "连接选择"
      ],
      "tables": [
        "Drift report：added/removed packages、config drift、services"
      ],
      "filters": [
        "connection selector"
      ],
      "modalsDrawers": [],
      "states": {
        "loading": "API-backed 页面会先显示 Loading/刷新中状态；截图均在请求稳定后采集。",
        "empty": "临时运行库数据较稀疏，Plans/Runs/Reports/Audit 等区域可见空状态。",
        "error": "未主动触发真实失败；代码和 UI 模式显示错误通常为红色 banner、inline error 或 403 Admin only。",
        "success": "API 200 后呈现 settled state；保存/模拟/发布等会刷新表格或显示结果区域。"
      },
      "apis": [
        {
          "api": "/api/connections/:id/drift/baseline, /api/connections/:id/drift",
          "method": "POST/GET",
          "action": "设置基线/运行漂移检查",
          "use": "Drift report 与 webhook 触发"
        }
      ],
      "screenshots": [
        "E:/1project/EnvForge/screenshots/ui-extract/plans-drift-desktop.png",
        "E:/1project/EnvForge/screenshots/ui-extract/plans-drift-mobile.png"
      ],
      "llmNotes": [
        "需要已有连接和前后快照才能看到非空 drift。"
      ]
    },
    {
      "id": "plans-webhooks",
      "name": "Plans / Webhooks",
      "entry": "page=playbooks tab=Webhooks",
      "roles": [
        "user",
        "admin"
      ],
      "purpose": "维护出站通知 webhook，订阅 task.completed、task.failed、drift.detected、schedule.fired 等事件。",
      "regions": [
        "Webhook list",
        "Create webhook form",
        "test result"
      ],
      "components": [
        "tabs",
        "form",
        "checkboxes",
        "buttons",
        "table/list"
      ],
      "visibleTextSummary": "Webhooks、URL、Secret、Events、Test、Delete。",
      "actions": [
        "创建 webhook",
        "启用/禁用",
        "测试 webhook（会发出请求，提取中未执行真实外发）",
        "删除 webhook（危险，未确认）"
      ],
      "forms": [
        "label、url、secret、events、enabled"
      ],
      "tables": [
        "Webhook：label、url、events、enabled、last status"
      ],
      "filters": [],
      "modalsDrawers": [],
      "states": {
        "loading": "API-backed 页面会先显示 Loading/刷新中状态；截图均在请求稳定后采集。",
        "empty": "临时运行库数据较稀疏，Plans/Runs/Reports/Audit 等区域可见空状态。",
        "error": "未主动触发真实失败；代码和 UI 模式显示错误通常为红色 banner、inline error 或 403 Admin only。",
        "success": "API 200 后呈现 settled state；保存/模拟/发布等会刷新表格或显示结果区域。"
      },
      "apis": [
        {
          "api": "/api/webhooks, /api/webhooks/:id, /api/webhooks/:id/test",
          "method": "GET/POST/PATCH/DELETE/POST",
          "action": "Webhook CRUD/测试",
          "use": "通知订阅和测试结果"
        }
      ],
      "screenshots": [
        "E:/1project/EnvForge/screenshots/ui-extract/plans-webhooks-desktop.png",
        "E:/1project/EnvForge/screenshots/ui-extract/plans-webhooks-mobile.png"
      ],
      "llmNotes": [
        "URL、secret 属敏感数据，报告必须脱敏。"
      ]
    },
    {
      "id": "plans-reports",
      "name": "Plans / Reports",
      "entry": "page=playbooks tab=Reports",
      "roles": [
        "user",
        "admin"
      ],
      "purpose": "在 Plans 中查看计划报告证据；与独立 Reports 页面共享报告数据。",
      "regions": [
        "Report list",
        "Report detail / empty state"
      ],
      "components": [
        "tabs",
        "report list",
        "markdown/text panel",
        "empty state"
      ],
      "visibleTextSummary": "Reports、No reports yet、View report。",
      "actions": [
        "选择报告",
        "查看 Markdown 报告",
        "复制/下载（有数据时）"
      ],
      "forms": [],
      "tables": [
        "Report：plan、type、updatedAt、status"
      ],
      "filters": [],
      "modalsDrawers": [],
      "states": {
        "loading": "API-backed 页面会先显示 Loading/刷新中状态；截图均在请求稳定后采集。",
        "empty": "临时运行库数据较稀疏，Plans/Runs/Reports/Audit 等区域可见空状态。",
        "error": "未主动触发真实失败；代码和 UI 模式显示错误通常为红色 banner、inline error 或 403 Admin only。",
        "success": "API 200 后呈现 settled state；保存/模拟/发布等会刷新表格或显示结果区域。"
      },
      "apis": [
        {
          "api": "/api/plans/:id/report, /api/plans",
          "method": "GET",
          "action": "读取计划报告",
          "use": "报告证据内容"
        }
      ],
      "screenshots": [
        "E:/1project/EnvForge/screenshots/ui-extract/plans-reports-desktop.png",
        "E:/1project/EnvForge/screenshots/ui-extract/plans-reports-mobile.png"
      ],
      "llmNotes": [
        "报告是证据视图，不提供 apply/edit。"
      ]
    },
    {
      "id": "reports",
      "name": "Reports",
      "entry": "page=reports",
      "roles": [
        "user",
        "admin"
      ],
      "purpose": "独立只读报告中心，查看迁移、重建、修复报告和执行证据。",
      "regions": [
        "Report filters/list",
        "Report detail",
        "Evidence summary"
      ],
      "components": [
        "list",
        "buttons",
        "markdown/text panel",
        "empty state"
      ],
      "visibleTextSummary": "Reports、Select a plan/report、No reports yet。",
      "actions": [
        "刷新计划",
        "选择计划",
        "查看报告详情"
      ],
      "forms": [],
      "tables": [
        "Report/Plan：name、type、status、updatedAt"
      ],
      "filters": [
        "plan/report selector（有数据时）"
      ],
      "modalsDrawers": [],
      "states": {
        "loading": "API-backed 页面会先显示 Loading/刷新中状态；截图均在请求稳定后采集。",
        "empty": "临时运行库数据较稀疏，Plans/Runs/Reports/Audit 等区域可见空状态。",
        "error": "未主动触发真实失败；代码和 UI 模式显示错误通常为红色 banner、inline error 或 403 Admin only。",
        "success": "API 200 后呈现 settled state；保存/模拟/发布等会刷新表格或显示结果区域。"
      },
      "apis": [
        {
          "api": "/api/plans, /api/plans/:id/report",
          "method": "GET",
          "action": "列出计划并读取报告",
          "use": "只读报告页面"
        }
      ],
      "screenshots": [
        "E:/1project/EnvForge/screenshots/ui-extract/reports-desktop.png",
        "E:/1project/EnvForge/screenshots/ui-extract/reports-mobile.png"
      ],
      "llmNotes": [
        "Reports 不承担执行动作；对大模型来说它是审计/证据出口。"
      ]
    },
    {
      "id": "capability-admin-overview",
      "name": "Capability Admin / Overview",
      "entry": "page=catalog tab=overview",
      "roles": [
        "admin"
      ],
      "purpose": "管理员能力规则治理总览：认证覆盖率、not-ready 数量、P0 backlog、待处理建议和缺失要求。",
      "regions": [
        "Stats cards",
        "P0 table",
        "Missing requirements",
        "admin tablist"
      ],
      "components": [
        "tabs",
        "cards",
        "tables",
        "badges",
        "buttons"
      ],
      "visibleTextSummary": "Capability Admin、Overview、Certified coverage、P0 backlog、missing requirements、Build only shows certified capabilities。",
      "actions": [
        "查看待升级能力",
        "复制缺失项",
        "生成升级 prompt"
      ],
      "forms": [],
      "tables": [
        "P0 backlog：Capability、Category、Missing、Status",
        "Missing requirements"
      ],
      "filters": [],
      "modalsDrawers": [],
      "states": {
        "loading": "API-backed 页面会先显示 Loading/刷新中状态；截图均在请求稳定后采集。",
        "empty": "临时运行库数据较稀疏，Plans/Runs/Reports/Audit 等区域可见空状态。",
        "error": "未主动触发真实失败；代码和 UI 模式显示错误通常为红色 banner、inline error 或 403 Admin only。",
        "success": "API 200 后呈现 settled state；保存/模拟/发布等会刷新表格或显示结果区域。"
      },
      "apis": [
        {
          "api": "/api/catalog/certification, /api/admin/suggestions",
          "method": "GET",
          "action": "读取治理概览和建议数量",
          "use": "覆盖率和 backlog"
        }
      ],
      "screenshots": [
        "E:/1project/EnvForge/screenshots/ui-extract/capability-admin-desktop.png",
        "E:/1project/EnvForge/screenshots/ui-extract/capability-admin-mobile.png",
        "E:/1project/EnvForge/screenshots/ui-extract/admin-overview-desktop.png",
        "E:/1project/EnvForge/screenshots/ui-extract/admin-overview-mobile.png"
      ],
      "llmNotes": [
        "这是管理员入口；普通 user 会被重定向到 Build 或收到 Admin only。"
      ]
    },
    {
      "id": "capability-admin-registry",
      "name": "Capability Admin / Rule Registry",
      "entry": "page=catalog tab=registry",
      "roles": [
        "admin"
      ],
      "purpose": "全量能力规则注册表：展示所有能力的认证状态、类别、缺失项和详情入口，包含未认证能力。",
      "regions": [
        "Search",
        "status/category filters",
        "rules table",
        "detail panel"
      ],
      "components": [
        "tabs",
        "search box",
        "filter pills",
        "table",
        "badges"
      ],
      "visibleTextSummary": "Rule Registry、Search、service/network/database/container/security/developer/runtime、Capability、Type、Status、Missing。",
      "actions": [
        "搜索",
        "按类别/状态过滤",
        "查看规则详情",
        "复制缺失项"
      ],
      "forms": [
        "搜索框"
      ],
      "tables": [
        "Rules table：Capability、Type/Category、Certification Status、Missing requirements、Actions"
      ],
      "filters": [
        "搜索",
        "category filter",
        "status filter"
      ],
      "modalsDrawers": [
        "detail drawer/panel（有行详情时）"
      ],
      "states": {
        "loading": "API-backed 页面会先显示 Loading/刷新中状态；截图均在请求稳定后采集。",
        "empty": "临时运行库数据较稀疏，Plans/Runs/Reports/Audit 等区域可见空状态。",
        "error": "未主动触发真实失败；代码和 UI 模式显示错误通常为红色 banner、inline error 或 403 Admin only。",
        "success": "API 200 后呈现 settled state；保存/模拟/发布等会刷新表格或显示结果区域。"
      },
      "apis": [
        {
          "api": "/api/catalog/certification",
          "method": "GET",
          "action": "读取全量认证注册表",
          "use": "规则表和缺失项"
        }
      ],
      "screenshots": [
        "E:/1project/EnvForge/screenshots/ui-extract/admin-registry-desktop.png",
        "E:/1project/EnvForge/screenshots/ui-extract/admin-registry-mobile.png"
      ],
      "llmNotes": [
        "Registry 是管理员治理面，不能作为普通 Build 列表来源。"
      ]
    },
    {
      "id": "capability-admin-standards",
      "name": "Capability Admin / Standards",
      "entry": "page=catalog tab=standards",
      "roles": [
        "admin"
      ],
      "purpose": "线上维护的版本化标准层：维护 standard profile、每能力 requirement draft、simulation runs、published versions、rollback history 和 audit log。",
      "regions": [
        "Profile selector",
        "Capability selector",
        "Standard profiles table/editor",
        "Section editor",
        "Version history",
        "Run history",
        "Audit log"
      ],
      "components": [
        "tabs",
        "selectors",
        "tables",
        "forms",
        "status cards",
        "buttons",
        "badges"
      ],
      "visibleTextSummary": "Versioned standards layer、Full Migration Certified v1/v2、New profile、Clone draft、Clone active、Edit、certified、Published version、Draft、13/13 Sections、Last simulation。",
      "actions": [
        "New profile",
        "Clone draft",
        "Clone active",
        "Edit profile",
        "选择 capability",
        "Mark all satisfied/pending",
        "Save draft",
        "Simulate",
        "Publish（危险，未确认）",
        "Rollback（危险，未确认）"
      ],
      "forms": [
        "Profile editor：key、name、description、status、sections",
        "Requirement section editor：section status、notes、evidence、rule overlay"
      ],
      "tables": [
        "Standard profiles：Profile、Key、Status、Sections、Updated、Action",
        "Version history：Version、Status、Published",
        "Runs：Result、Sections、At",
        "Audit log：Action、Target、Old/New、Feedback、Timestamp"
      ],
      "filters": [
        "Profile selector",
        "Capability selector",
        "section status filter"
      ],
      "modalsDrawers": [
        "Profile editor / section editor"
      ],
      "states": {
        "loading": "API-backed 页面会先显示 Loading/刷新中状态；截图均在请求稳定后采集。",
        "empty": "临时运行库数据较稀疏，Plans/Runs/Reports/Audit 等区域可见空状态。",
        "error": "未主动触发真实失败；代码和 UI 模式显示错误通常为红色 banner、inline error 或 403 Admin only。",
        "success": "API 200 后呈现 settled state；保存/模拟/发布等会刷新表格或显示结果区域。"
      },
      "apis": [
        {
          "api": "/api/admin/capability-standards",
          "method": "GET/POST",
          "action": "列出/创建 profile",
          "use": "profile 表与 active profile"
        },
        {
          "api": "/api/admin/capability-standards/:id",
          "method": "PATCH",
          "action": "更新 profile",
          "use": "状态、名称、sections"
        },
        {
          "api": "/api/admin/capability-standards/:id/clone",
          "method": "POST",
          "action": "克隆 draft/active",
          "use": "版本化标准迭代"
        },
        {
          "api": "/api/admin/capabilities/:id/requirements",
          "method": "GET",
          "action": "读取某能力要求详情",
          "use": "draft/current/projected sections"
        },
        {
          "api": "/api/admin/capabilities/:id/requirements/draft",
          "method": "PATCH",
          "action": "保存 requirement draft",
          "use": "草稿状态"
        },
        {
          "api": "/api/admin/capabilities/:id/certification/simulate",
          "method": "POST",
          "action": "模拟认证",
          "use": "simulation run / section coverage"
        },
        {
          "api": "/api/admin/capabilities/:id/requirements/publish",
          "method": "POST",
          "action": "发布版本",
          "use": "published version 和 audit"
        },
        {
          "api": "/api/admin/capabilities/:id/rollback-version",
          "method": "POST",
          "action": "回滚版本",
          "use": "恢复旧要求版本"
        },
        {
          "api": "/api/admin/capabilities/:id/certification/runs, /api/admin/capability-audit-log",
          "method": "GET",
          "action": "读取运行与审计",
          "use": "治理追踪"
        }
      ],
      "screenshots": [
        "E:/1project/EnvForge/screenshots/ui-extract/admin-standards-desktop.png",
        "E:/1project/EnvForge/screenshots/ui-extract/admin-standards-mobile.png"
      ],
      "llmNotes": [
        "这是本轮新增的核心“线上维护版本化标准层”。",
        "Publish/Rollback 会改变治理状态，UI 提取中只记录流程，不确认执行。"
      ]
    },
    {
      "id": "capability-admin-suggestions",
      "name": "Capability Admin / Suggestion Inbox",
      "entry": "page=catalog tab=suggestions",
      "roles": [
        "admin"
      ],
      "purpose": "处理用户提交的能力建议、组合调整和规则缺口反馈。",
      "regions": [
        "Status filter",
        "suggestions table",
        "feedback actions"
      ],
      "components": [
        "tabs",
        "filters",
        "table",
        "buttons",
        "empty state"
      ],
      "visibleTextSummary": "Suggestion Inbox、pending/accepted/rejected、Accept、Reject、feedback。",
      "actions": [
        "按状态筛选",
        "接受建议（未确认真实处理）",
        "拒绝建议（未确认真实处理）",
        "填写反馈"
      ],
      "forms": [
        "feedback textarea / input"
      ],
      "tables": [
        "Suggestions：User、Capability/Combo、Type、Status、Created、Feedback、Actions"
      ],
      "filters": [
        "status filter：pending/accepted/rejected"
      ],
      "modalsDrawers": [],
      "states": {
        "loading": "API-backed 页面会先显示 Loading/刷新中状态；截图均在请求稳定后采集。",
        "empty": "临时运行库数据较稀疏，Plans/Runs/Reports/Audit 等区域可见空状态。",
        "error": "未主动触发真实失败；代码和 UI 模式显示错误通常为红色 banner、inline error 或 403 Admin only。",
        "success": "API 200 后呈现 settled state；保存/模拟/发布等会刷新表格或显示结果区域。"
      },
      "apis": [
        {
          "api": "/api/admin/suggestions, /api/admin/suggestions/:id/process",
          "method": "GET/POST",
          "action": "读取/处理建议",
          "use": "建议队列和反馈状态"
        }
      ],
      "screenshots": [
        "E:/1project/EnvForge/screenshots/ui-extract/admin-suggestions-desktop.png",
        "E:/1project/EnvForge/screenshots/ui-extract/admin-suggestions-mobile.png"
      ],
      "llmNotes": [
        "普通用户提交建议的入口在 guide/comments/suggest overlay；管理员在这里 triage。"
      ]
    },
    {
      "id": "capability-admin-integrations",
      "name": "Capability Admin / Package Integrations",
      "entry": "page=catalog tab=integrations",
      "roles": [
        "admin"
      ],
      "purpose": "查看规则级跨发行版包名、服务名、二进制、配置路径、端口、验证、回滚和数据策略映射。",
      "regions": [
        "Search/filter",
        "integration list/table",
        "detail panel",
        "raw rule JSON"
      ],
      "components": [
        "tabs",
        "search box",
        "table",
        "detail panel",
        "badges",
        "code block"
      ],
      "visibleTextSummary": "Package Integrations、package map、service map、config files、validate、rollback、data strategy、raw rule JSON。",
      "actions": [
        "搜索",
        "筛选 hasRule/withoutRule/status",
        "选择 capability",
        "查看 rule detail"
      ],
      "forms": [
        "搜索框"
      ],
      "tables": [
        "Integrations：Capability、Category、Rule status、Packages、Services、Configs、Ports"
      ],
      "filters": [
        "search",
        "status/hasRule filter"
      ],
      "modalsDrawers": [
        "detail panel"
      ],
      "states": {
        "loading": "API-backed 页面会先显示 Loading/刷新中状态；截图均在请求稳定后采集。",
        "empty": "临时运行库数据较稀疏，Plans/Runs/Reports/Audit 等区域可见空状态。",
        "error": "未主动触发真实失败；代码和 UI 模式显示错误通常为红色 banner、inline error 或 403 Admin only。",
        "success": "API 200 后呈现 settled state；保存/模拟/发布等会刷新表格或显示结果区域。"
      },
      "apis": [
        {
          "api": "/api/admin/package-integrations, /api/admin/package-integrations/:capabilityId",
          "method": "GET",
          "action": "读取集成映射/详情",
          "use": "规则级包支持矩阵"
        }
      ],
      "screenshots": [
        "E:/1project/EnvForge/screenshots/ui-extract/admin-integrations-desktop.png",
        "E:/1project/EnvForge/screenshots/ui-extract/admin-integrations-mobile.png"
      ],
      "llmNotes": [
        "这里是规则治理，不是主机包管理器；不要把 package map 当作当前机器已安装包。"
      ]
    },
    {
      "id": "capability-admin-users-queues",
      "name": "Capability Admin / Users & Queues",
      "entry": "page=catalog tab=users-queues",
      "roles": [
        "admin"
      ],
      "purpose": "查看维护者、reviewer、admin 的能力分配、建议负载、backlog 和治理队列。",
      "regions": [
        "Users table",
        "Queues table"
      ],
      "components": [
        "tabs",
        "tables",
        "badges",
        "empty/loading state"
      ],
      "visibleTextSummary": "Users & Queues、User、Role、Assigned capabilities、Open suggestions、Review load、Queue、Priority、Owner group、Next action。",
      "actions": [
        "查看分配",
        "查看队列负载",
        "识别 P0/P1 队列"
      ],
      "forms": [],
      "tables": [
        "Users：Name、Role、Assigned、Open suggestions、Backlog、Review load、Last active",
        "Queues：Name、Type、Open items、Priority、Oldest item、Owner group、Status、Next action"
      ],
      "filters": [],
      "modalsDrawers": [],
      "states": {
        "loading": "API-backed 页面会先显示 Loading/刷新中状态；截图均在请求稳定后采集。",
        "empty": "临时运行库数据较稀疏，Plans/Runs/Reports/Audit 等区域可见空状态。",
        "error": "未主动触发真实失败；代码和 UI 模式显示错误通常为红色 banner、inline error 或 403 Admin only。",
        "success": "API 200 后呈现 settled state；保存/模拟/发布等会刷新表格或显示结果区域。"
      },
      "apis": [
        {
          "api": "/api/admin/capability-users, /api/admin/capability-queues",
          "method": "GET",
          "action": "读取人员和队列",
          "use": "维护者和队列分配"
        }
      ],
      "screenshots": [
        "E:/1project/EnvForge/screenshots/ui-extract/admin-users-queues-desktop.png",
        "E:/1project/EnvForge/screenshots/ui-extract/admin-users-queues-mobile.png"
      ],
      "llmNotes": [
        "这是运营视图，不直接编辑用户权限；当前界面以查看为主。"
      ]
    }
  ],
  "components": [
    {
      "type": "Buttons",
      "visual": "主按钮为绿色实心，次级操作为浅色边框；危险按钮在当前数据下多为禁用或需要二次确认。",
      "behavior": "触发导航、保存、刷新、模拟、发布、回滚、测试 Webhook、开启 2FA 等。危险动作只记录流程，不实际确认。",
      "reuse": [
        "Dashboard",
        "Migrate",
        "Build",
        "Plans",
        "Capability Admin"
      ],
      "states": [
        "default",
        "hover",
        "disabled",
        "busy/loading",
        "destructive"
      ],
      "copy": [
        "Connect new VM",
        "Collect HostSnapshot",
        "Create Build Plan",
        "Save draft",
        "Simulate",
        "Publish",
        "Rollback"
      ]
    },
    {
      "type": "Tabs",
      "visual": "一级导航在左侧 sidebar；二级 tab 使用横向 tablist，当前 tab 有下划线/高亮。",
      "behavior": "切换同一页面内部的数据域，不刷新浏览器地址；Capability Admin 和 Plans 的 tab 会触发懒加载 API。",
      "reuse": [
        "Plans",
        "Capability Admin"
      ],
      "states": [
        "active",
        "inactive",
        "badge count"
      ],
      "copy": [
        "Plans",
        "Runs",
        "Schedules",
        "Drift",
        "Webhooks",
        "Reports",
        "Overview",
        "Rule Registry",
        "Standards"
      ]
    },
    {
      "type": "Tables",
      "visual": "浅色表头、细边框、紧凑行高，适合管理后台扫描。",
      "behavior": "行可点击或带操作按钮；部分表格配合搜索/状态筛选；当前未观察到分页控件，部分 API 支持 cursor/limit。",
      "reuse": [
        "Rule Registry",
        "Standards",
        "Suggestion Inbox",
        "Package Integrations",
        "Users & Queues",
        "Plans"
      ],
      "states": [
        "loaded",
        "empty",
        "filtered empty"
      ],
      "copy": [
        "Capability",
        "Type",
        "Status",
        "Missing",
        "Version",
        "Published",
        "User",
        "Role",
        "Load",
        "Queue"
      ]
    },
    {
      "type": "Forms",
      "visual": "label 在上、输入框在下；移动端单列，桌面端部分双列。",
      "behavior": "提交前有基本空值校验；认证、连接、账号资料、调度、Webhook、标准 profile/section 均用表单。",
      "reuse": [
        "AuthDialog",
        "Dashboard Account & Security",
        "Migrate",
        "Schedules",
        "Webhooks",
        "Standards"
      ],
      "states": [
        "empty",
        "filled",
        "validation error",
        "saving"
      ],
      "copy": [
        "Email / username",
        "Password",
        "Host",
        "Port",
        "Username",
        "Webhook URL",
        "Profile",
        "Capability"
      ]
    },
    {
      "type": "Cards",
      "visual": "8px 左右圆角、白底浅边框；用于汇总指标、能力条目、Plan 条目。",
      "behavior": "展示摘要或作为详情入口；Build 卡片可选择能力或打开 guide/configure。",
      "reuse": [
        "Dashboard",
        "Build",
        "Plans",
        "Capability Admin Overview"
      ],
      "states": [
        "normal",
        "selected",
        "certified",
        "not-ready",
        "empty"
      ],
      "copy": [
        "Current user",
        "Pending Plan",
        "Full Migration Certified"
      ]
    },
    {
      "type": "Modals / Drawers",
      "visual": "AuthDialog 为居中弹窗；Inbox 为侧向抽屉；Markdown guide / configure / review 面板为覆盖层或内嵌面板。",
      "behavior": "打开后提取对应 DOM/可见文本；关闭不改变业务数据。删除、发布、支付、真实执行等危险确认未被确认。",
      "reuse": [
        "Global",
        "Build",
        "Plans",
        "Dashboard"
      ],
      "states": [
        "open",
        "closed",
        "loading",
        "error"
      ],
      "copy": [
        "Sign in",
        "Register",
        "Inbox / Notifications",
        "Plan Review"
      ]
    },
    {
      "type": "Badges / Status indicators",
      "visual": "小号圆角标签，颜色区分 admin、active、draft、certified、pending、warning。",
      "behavior": "表达权限、认证、运行状态和缺失项，不单独触发动作。",
      "reuse": [
        "Global topbar",
        "Build",
        "Plans",
        "Capability Admin"
      ],
      "states": [
        "admin",
        "active",
        "draft",
        "certified",
        "pending",
        "none"
      ],
      "copy": [
        "admin",
        "certified",
        "draft",
        "active",
        "13/13 sections"
      ]
    },
    {
      "type": "Filters / Search boxes",
      "visual": "搜索框 + pill/button filter；移动端换行堆叠。",
      "behavior": "在前端过滤能力/规则/建议/集成项，或通过 API query 过滤建议。",
      "reuse": [
        "Build",
        "Rule Registry",
        "Suggestion Inbox",
        "Package Integrations",
        "Plans"
      ],
      "states": [
        "all",
        "category selected",
        "status selected",
        "no match"
      ],
      "copy": [
        "Search",
        "runtime",
        "database",
        "security",
        "pending"
      ]
    },
    {
      "type": "Empty / Error banners",
      "visual": "空状态为灰色提示文本；错误为红色/橙色 banner。",
      "behavior": "稀疏临时数据下多处显示 No plans / No reports；错误状态未主动破坏性触发。",
      "reuse": [
        "Dashboard",
        "Plans",
        "Reports",
        "Suggestions"
      ],
      "states": [
        "empty",
        "connection-error",
        "403 admin only",
        "validation error"
      ],
      "copy": [
        "No plans yet.",
        "No reports yet.",
        "Admin only."
      ]
    }
  ],
  "workflows": [
    {
      "name": "登录",
      "start": "匿名首页账号菜单",
      "preconditions": [
        "无需登录；OAuth provider 取决于配置"
      ],
      "steps": [
        "打开 Account menu",
        "点击 Login/Register",
        "输入账号密码或进入 OAuth",
        "如要求 2FA，提交 TOTP/恢复码",
        "登录成功后进入 Dashboard"
      ],
      "intermediateStates": [
        "2FA pending",
        "enrollment required",
        "login error"
      ],
      "successState": "local session 建立，topbar 显示用户和角色",
      "failureState": "AuthDialog inline error",
      "pages": [
        "anonymous-auth",
        "dashboard"
      ],
      "apis": [
        "/api/auth/providers",
        "/api/auth/login",
        "/api/auth/login/2fa",
        "/api/auth/session"
      ],
      "screenshots": [
        "E:/1project/EnvForge/screenshots/ui-extract/anonymous-login-dialog-desktop.png",
        "E:/1project/EnvForge/screenshots/ui-extract/dashboard-desktop.png"
      ]
    },
    {
      "name": "连接并采集源 VM",
      "start": "Migrate",
      "preconditions": [
        "已登录",
        "有可用 SSH 凭据或可上传 snapshot"
      ],
      "steps": [
        "填写 host/port/user/auth",
        "Connect & collect",
        "查看连接状态",
        "reprobe/capture HostSnapshot",
        "在 Dashboard/Build/Plans 使用采集证据"
      ],
      "intermediateStates": [
        "probing/loading",
        "connection error",
        "snapshot empty"
      ],
      "successState": "连接和 HostSnapshot 写入 runtime store",
      "failureState": "连接错误 banner 或表单错误",
      "pages": [
        "migrate",
        "dashboard"
      ],
      "apis": [
        "/api/connections/connect",
        "/api/connections/:id/reprobe",
        "/api/connections/:id/capture"
      ],
      "screenshots": [
        "E:/1project/EnvForge/screenshots/ui-extract/migrate-desktop.png"
      ]
    },
    {
      "name": "创建 Rebuild Plan",
      "start": "Build",
      "preconditions": [
        "建议已登录并选择 target connection；匿名只能浏览有限内容"
      ],
      "steps": [
        "搜索/筛选 certified capability",
        "选择能力",
        "按 vars-schema 配置变量（可选）",
        "创建 Environment Plan",
        "Plan Review 确认风险/冲突",
        "Apply Gate 后才可执行"
      ],
      "intermediateStates": [
        "compatibility check",
        "selected drawer",
        "review required",
        "apply gate refused"
      ],
      "successState": "生成 rebuild plan 并进入 Plans 生命周期",
      "failureState": "缺少登录/连接、schema 校验失败或 apply gate 拒绝",
      "pages": [
        "build",
        "plans"
      ],
      "apis": [
        "/api/catalog",
        "/api/catalog/:id/preview",
        "/api/plans",
        "/api/plans/:id/review",
        "/api/plans/:id/apply"
      ],
      "screenshots": [
        "E:/1project/EnvForge/screenshots/ui-extract/build-desktop.png",
        "E:/1project/EnvForge/screenshots/ui-extract/plans-desktop.png"
      ]
    },
    {
      "name": "Plan 生命周期",
      "start": "Plans",
      "preconditions": [
        "已有 Environment Plan"
      ],
      "steps": [
        "选择 Plan",
        "查看 actions/risk/verify/history",
        "Review approve/reject",
        "Apply/dry-run",
        "Verify",
        "必要时 Repair from verify 或 Rollback",
        "查看 Report"
      ],
      "intermediateStates": [
        "draft",
        "needs-review",
        "approved",
        "applying",
        "verified",
        "failed"
      ],
      "successState": "计划完成并有报告证据",
      "failureState": "verify failed、rollback failed 或 gate refused",
      "pages": [
        "plans",
        "plans-reports",
        "reports"
      ],
      "apis": [
        "/api/plans/:id",
        "/api/plans/:id/review",
        "/api/plans/:id/apply",
        "/api/plans/:id/verify",
        "/api/plans/:id/rollback",
        "/api/plans/:id/report"
      ],
      "screenshots": [
        "E:/1project/EnvForge/screenshots/ui-extract/plans-desktop.png",
        "E:/1project/EnvForge/screenshots/ui-extract/reports-desktop.png"
      ]
    },
    {
      "name": "调度 / 漂移 / Webhook 运维",
      "start": "Plans 二级 tabs",
      "preconditions": [
        "已登录；需要连接或外部 webhook URL"
      ],
      "steps": [
        "Schedules 创建/启停任务",
        "Drift 设置 baseline 并检查",
        "Webhooks 创建订阅并可测试",
        "事件触发后回写运行/通知/报告"
      ],
      "intermediateStates": [
        "empty schedule",
        "baseline missing",
        "webhook disabled",
        "test failed"
      ],
      "successState": "调度、漂移和通知进入可观察状态",
      "failureState": "外部 URL 不可达、缺少连接、权限不足",
      "pages": [
        "plans-schedules",
        "plans-drift",
        "plans-webhooks"
      ],
      "apis": [
        "/api/schedules",
        "/api/connections/:id/drift",
        "/api/webhooks"
      ],
      "screenshots": [
        "E:/1project/EnvForge/screenshots/ui-extract/plans-schedules-desktop.png",
        "E:/1project/EnvForge/screenshots/ui-extract/plans-drift-desktop.png",
        "E:/1project/EnvForge/screenshots/ui-extract/plans-webhooks-desktop.png"
      ]
    },
    {
      "name": "管理员维护版本化标准层",
      "start": "Capability Admin / Standards",
      "preconditions": [
        "admin role",
        "Bearer <ADMIN_TOKEN_REDACTED>"
      ],
      "steps": [
        "选择 profile 和 capability",
        "克隆或新建标准 profile",
        "编辑 requirement sections",
        "Save draft",
        "Simulate",
        "Publish",
        "必要时 Rollback",
        "查看 audit log"
      ],
      "intermediateStates": [
        "draft",
        "active",
        "retired",
        "simulation none",
        "section pending/satisfied"
      ],
      "successState": "发布版本记录治理状态，Build certified-only gate 按新标准工作",
      "failureState": "403、profile 不可变、section 不满足、publish 拒绝",
      "pages": [
        "capability-admin-standards"
      ],
      "apis": [
        "/api/admin/capability-standards",
        "/api/admin/capabilities/:id/requirements/draft",
        "/api/admin/capabilities/:id/certification/simulate",
        "/api/admin/capabilities/:id/requirements/publish",
        "/api/admin/capability-audit-log"
      ],
      "screenshots": [
        "E:/1project/EnvForge/screenshots/ui-extract/admin-standards-desktop.png"
      ]
    },
    {
      "name": "管理员建议处理",
      "start": "Capability Admin / Suggestion Inbox",
      "preconditions": [
        "admin role",
        "存在用户建议"
      ],
      "steps": [
        "按状态筛选",
        "查看建议内容",
        "填写反馈",
        "Accept 或 Reject",
        "建议状态进入用户 inbox"
      ],
      "intermediateStates": [
        "pending",
        "accepted",
        "rejected"
      ],
      "successState": "建议被处理并产生反馈",
      "failureState": "403 或处理 API 失败",
      "pages": [
        "capability-admin-suggestions",
        "dashboard"
      ],
      "apis": [
        "/api/admin/suggestions",
        "/api/admin/suggestions/:id/process",
        "/api/me/inbox"
      ],
      "screenshots": [
        "E:/1project/EnvForge/screenshots/ui-extract/admin-suggestions-desktop.png",
        "E:/1project/EnvForge/screenshots/ui-extract/dashboard-inbox-drawer-desktop.png"
      ]
    }
  ],
  "permissions": [
    {
      "feature": "匿名访问应用 shell / 登录入口",
      "anonymous": "允许",
      "user": "已登录后不需要",
      "admin": "已登录后不需要",
      "notes": "token/密码/验证码不写入报告"
    },
    {
      "feature": "Build certified catalog 浏览",
      "anonymous": "可见受限",
      "user": "可见并可选择",
      "admin": "可见并可选择",
      "notes": "只展示 Full Migration Certified 能力"
    },
    {
      "feature": "创建 Rebuild Plan",
      "anonymous": "不可执行",
      "user": "允许，需 target connection",
      "admin": "允许，需 target connection",
      "notes": "仍需 Review / Apply Gate"
    },
    {
      "feature": "Dashboard / Account / Inbox",
      "anonymous": "不可访问",
      "user": "自己的数据",
      "admin": "自己的数据 + admin role 标识",
      "notes": "账号删除需二次认证"
    },
    {
      "feature": "Migrate 连接和采集",
      "anonymous": "不可访问",
      "user": "允许自己的连接",
      "admin": "允许自己的连接",
      "notes": "源采集只读；真实 SSH 凭据脱敏"
    },
    {
      "feature": "Plans 生命周期",
      "anonymous": "不可访问",
      "user": "自己的 plans",
      "admin": "自己的 plans",
      "notes": "apply/rollback 为危险动作，提取未确认执行"
    },
    {
      "feature": "Schedules / Drift / Webhooks",
      "anonymous": "不可访问",
      "user": "自己的资源",
      "admin": "自己的资源",
      "notes": "Webhook 测试可能外发，提取未执行"
    },
    {
      "feature": "Reports",
      "anonymous": "不可访问",
      "user": "自己的报告",
      "admin": "自己的报告",
      "notes": "只读证据视图"
    },
    {
      "feature": "Capability Admin",
      "anonymous": "不可见/403",
      "user": "不可见/403",
      "admin": "允许",
      "notes": "main.tsx 和 API 双层 gate"
    },
    {
      "feature": "Rule Registry 全量规则",
      "anonymous": "不可访问",
      "user": "不可访问",
      "admin": "允许",
      "notes": "包含未认证/not-ready 能力"
    },
    {
      "feature": "Versioned standards layer",
      "anonymous": "不可访问",
      "user": "403",
      "admin": "create/edit/clone/simulate/publish/rollback/audit",
      "notes": "Publish/Rollback 改变治理状态"
    },
    {
      "feature": "Suggestion Inbox 处理",
      "anonymous": "不可访问",
      "user": "只能提交/查看自己的建议",
      "admin": "处理全部建议",
      "notes": "处理结果可进入用户 inbox"
    },
    {
      "feature": "Package Integrations / Users & Queues",
      "anonymous": "不可访问",
      "user": "不可访问",
      "admin": "查看",
      "notes": "当前界面以治理查看为主"
    }
  ],
  "apiMappings": [
    {
      "surface": "AuthDialog",
      "api": "/api/auth/providers",
      "method": "GET",
      "trigger": "打开登录弹窗",
      "use": "渲染 OAuth provider"
    },
    {
      "surface": "AuthDialog",
      "api": "/api/auth/login, /api/auth/login/2fa, /api/auth/session",
      "method": "POST/GET",
      "trigger": "登录/2FA/session 恢复",
      "use": "建立当前角色"
    },
    {
      "surface": "Dashboard",
      "api": "/api/me, /api/me/*",
      "method": "GET/PATCH/POST/PUT/DELETE",
      "trigger": "打开工作台或保存安全设置",
      "use": "账号资料、安全、通知偏好"
    },
    {
      "surface": "Dashboard Inbox",
      "api": "/api/me/inbox, /api/me/inbox/:id/read",
      "method": "GET/POST/DELETE",
      "trigger": "打开通知抽屉/标记已读/删除",
      "use": "通知列表和未读数"
    },
    {
      "surface": "Migrate",
      "api": "/api/connections/connect, /api/connections/:id/reprobe, /api/connections/:id/capture",
      "method": "POST/GET",
      "trigger": "连接/探测/采集",
      "use": "连接状态和 HostSnapshot"
    },
    {
      "surface": "Build",
      "api": "/api/catalog, /api/catalog/:id/guide, /api/catalog/:id/vars-schema, /api/catalog/:id/preview",
      "method": "GET/POST",
      "trigger": "浏览/打开 guide/配置变量/预览",
      "use": "能力卡片、文档、动态表单"
    },
    {
      "surface": "Build / Plans",
      "api": "/api/plans, /api/plans/:id/review, /api/plans/:id/apply",
      "method": "POST",
      "trigger": "创建计划/审查/应用",
      "use": "Environment Plan 生命周期"
    },
    {
      "surface": "Plans",
      "api": "/api/plans, /api/plans/:id, /api/plans/:id/verify, /api/plans/:id/rollback, /api/plans/:id/report",
      "method": "GET/POST",
      "trigger": "列表/详情/验证/回滚/报告",
      "use": "计划状态、结果和证据"
    },
    {
      "surface": "Schedules",
      "api": "/api/schedules, /api/schedules/:id",
      "method": "GET/POST/PATCH/DELETE",
      "trigger": "创建/启停/删除调度",
      "use": "计划自动化"
    },
    {
      "surface": "Drift",
      "api": "/api/connections/:id/drift/baseline, /api/connections/:id/drift",
      "method": "POST/GET",
      "trigger": "设置基线/检查漂移",
      "use": "漂移报告"
    },
    {
      "surface": "Webhooks",
      "api": "/api/webhooks, /api/webhooks/:id/test",
      "method": "GET/POST/PATCH/DELETE",
      "trigger": "管理/测试通知",
      "use": "外部事件通知"
    },
    {
      "surface": "Capability Admin Overview / Registry",
      "api": "/api/catalog/certification",
      "method": "GET",
      "trigger": "打开管理员页或 Registry",
      "use": "全量认证状态与缺失项"
    },
    {
      "surface": "Standards",
      "api": "/api/admin/capability-standards, /api/admin/capabilities/:id/requirements*",
      "method": "GET/POST/PATCH",
      "trigger": "profile / requirement 维护",
      "use": "版本化标准、草稿、发布、回滚、审计"
    },
    {
      "surface": "Suggestion Inbox",
      "api": "/api/admin/suggestions, /api/admin/suggestions/:id/process",
      "method": "GET/POST",
      "trigger": "筛选/处理建议",
      "use": "建议队列状态"
    },
    {
      "surface": "Package Integrations",
      "api": "/api/admin/package-integrations, /api/admin/package-integrations/:id",
      "method": "GET",
      "trigger": "打开集成映射/详情",
      "use": "包、服务、配置、数据策略规则"
    },
    {
      "surface": "Users & Queues",
      "api": "/api/admin/capability-users, /api/admin/capability-queues",
      "method": "GET",
      "trigger": "打开运营视图",
      "use": "维护者和队列分配"
    }
  ],
  "screenshotIndex": [
    {
      "id": "S01",
      "page": "匿名首页 / 登录入口",
      "state": "未登录首页",
      "viewport": "desktop 1440x900",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/anonymous-home-desktop.png",
      "note": "未登录 shell、导航与账号入口"
    },
    {
      "id": "S02",
      "page": "匿名首页 / 登录入口",
      "state": "登录弹窗",
      "viewport": "desktop 1440x900",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/anonymous-login-dialog-desktop.png",
      "note": "AuthDialog：账号密码、注册/OAuth 入口"
    },
    {
      "id": "S03",
      "page": "匿名首页 / 登录入口",
      "state": "登录弹窗",
      "viewport": "mobile 390x844",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/anonymous-login-dialog-mobile.png",
      "note": "移动端 AuthDialog 布局"
    },
    {
      "id": "S04",
      "page": "Dashboard",
      "state": "默认工作台",
      "viewport": "desktop 1440x900",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/dashboard-desktop.png",
      "note": "工作区汇总、快捷操作、账号安全"
    },
    {
      "id": "S05",
      "page": "Dashboard",
      "state": "默认工作台",
      "viewport": "mobile 390x844",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/dashboard-mobile.png",
      "note": "移动端 Dashboard"
    },
    {
      "id": "S06",
      "page": "Dashboard",
      "state": "Inbox drawer",
      "viewport": "desktop 1440x900",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/dashboard-inbox-drawer-desktop.png",
      "note": "通知抽屉"
    },
    {
      "id": "S07",
      "page": "全局",
      "state": "Account menu",
      "viewport": "desktop 1440x900",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/account-menu-desktop.png",
      "note": "账号菜单、登录状态和退出入口"
    },
    {
      "id": "S08",
      "page": "Migrate",
      "state": "默认页",
      "viewport": "desktop 1440x900",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/migrate-desktop.png",
      "note": "连接、采集、上传快照"
    },
    {
      "id": "S09",
      "page": "Migrate",
      "state": "默认页",
      "viewport": "mobile 390x844",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/migrate-mobile.png",
      "note": "移动端 Migrate"
    },
    {
      "id": "S10",
      "page": "Build",
      "state": "Certified capabilities",
      "viewport": "desktop 1440x900",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/build-desktop.png",
      "note": "已认证能力列表和 Rebuild Plan 创建入口"
    },
    {
      "id": "S11",
      "page": "Build",
      "state": "Certified capabilities",
      "viewport": "mobile 390x844",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/build-mobile.png",
      "note": "移动端长列表"
    },
    {
      "id": "S12",
      "page": "Plans",
      "state": "Plans tab",
      "viewport": "desktop 1440x900",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/plans-desktop.png",
      "note": "Environment Plans 列表和详情区域"
    },
    {
      "id": "S13",
      "page": "Plans",
      "state": "Plans tab",
      "viewport": "mobile 390x844",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/plans-mobile.png",
      "note": "移动端 Plans"
    },
    {
      "id": "S14",
      "page": "Plans / Runs",
      "state": "Runs tab",
      "viewport": "desktop 1440x900",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/plans-runs-desktop.png",
      "note": "运行历史空状态"
    },
    {
      "id": "S15",
      "page": "Plans / Runs",
      "state": "Runs tab",
      "viewport": "mobile 390x844",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/plans-runs-mobile.png",
      "note": "移动端 Runs"
    },
    {
      "id": "S16",
      "page": "Plans / Schedules",
      "state": "Schedules tab",
      "viewport": "desktop 1440x900",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/plans-schedules-desktop.png",
      "note": "调度列表和创建表单"
    },
    {
      "id": "S17",
      "page": "Plans / Schedules",
      "state": "Schedules tab",
      "viewport": "mobile 390x844",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/plans-schedules-mobile.png",
      "note": "移动端 Schedules"
    },
    {
      "id": "S18",
      "page": "Plans / Drift",
      "state": "Drift tab",
      "viewport": "desktop 1440x900",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/plans-drift-desktop.png",
      "note": "漂移基线和检查入口"
    },
    {
      "id": "S19",
      "page": "Plans / Drift",
      "state": "Drift tab",
      "viewport": "mobile 390x844",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/plans-drift-mobile.png",
      "note": "移动端 Drift"
    },
    {
      "id": "S20",
      "page": "Plans / Webhooks",
      "state": "Webhooks tab",
      "viewport": "desktop 1440x900",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/plans-webhooks-desktop.png",
      "note": "Webhook 列表、创建、测试入口"
    },
    {
      "id": "S21",
      "page": "Plans / Webhooks",
      "state": "Webhooks tab",
      "viewport": "mobile 390x844",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/plans-webhooks-mobile.png",
      "note": "移动端 Webhooks"
    },
    {
      "id": "S22",
      "page": "Plans / Reports",
      "state": "Reports tab",
      "viewport": "desktop 1440x900",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/plans-reports-desktop.png",
      "note": "计划内报告证据入口"
    },
    {
      "id": "S23",
      "page": "Plans / Reports",
      "state": "Reports tab",
      "viewport": "mobile 390x844",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/plans-reports-mobile.png",
      "note": "移动端计划报告"
    },
    {
      "id": "S24",
      "page": "Reports",
      "state": "独立报告页",
      "viewport": "desktop 1440x900",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/reports-desktop.png",
      "note": "只读报告列表/详情"
    },
    {
      "id": "S25",
      "page": "Reports",
      "state": "独立报告页",
      "viewport": "mobile 390x844",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/reports-mobile.png",
      "note": "移动端报告页"
    },
    {
      "id": "S26",
      "page": "Capability Admin",
      "state": "默认概览",
      "viewport": "desktop 1440x900",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/capability-admin-desktop.png",
      "note": "管理员工作台默认视图"
    },
    {
      "id": "S27",
      "page": "Capability Admin",
      "state": "默认概览",
      "viewport": "mobile 390x844",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/capability-admin-mobile.png",
      "note": "移动端管理员工作台"
    },
    {
      "id": "S28",
      "page": "Capability Admin / Overview",
      "state": "Overview tab",
      "viewport": "desktop 1440x900",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/admin-overview-desktop.png",
      "note": "覆盖率、P0 backlog、缺失项"
    },
    {
      "id": "S29",
      "page": "Capability Admin / Overview",
      "state": "Overview tab",
      "viewport": "mobile 390x844",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/admin-overview-mobile.png",
      "note": "移动端 Overview"
    },
    {
      "id": "S30",
      "page": "Capability Admin / Rule Registry",
      "state": "Rule Registry tab",
      "viewport": "desktop 1440x900",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/admin-registry-desktop.png",
      "note": "能力规则注册表"
    },
    {
      "id": "S31",
      "page": "Capability Admin / Rule Registry",
      "state": "Rule Registry tab",
      "viewport": "mobile 390x844",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/admin-registry-mobile.png",
      "note": "移动端规则表"
    },
    {
      "id": "S32",
      "page": "Capability Admin / Standards",
      "state": "Standards tab",
      "viewport": "desktop 1440x900",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/admin-standards-desktop.png",
      "note": "版本化标准层"
    },
    {
      "id": "S33",
      "page": "Capability Admin / Standards",
      "state": "Standards tab",
      "viewport": "mobile 390x844",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/admin-standards-mobile.png",
      "note": "移动端 Standards"
    },
    {
      "id": "S34",
      "page": "Capability Admin / Suggestion Inbox",
      "state": "Suggestion Inbox tab",
      "viewport": "desktop 1440x900",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/admin-suggestions-desktop.png",
      "note": "建议处理队列"
    },
    {
      "id": "S35",
      "page": "Capability Admin / Suggestion Inbox",
      "state": "Suggestion Inbox tab",
      "viewport": "mobile 390x844",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/admin-suggestions-mobile.png",
      "note": "移动端建议队列"
    },
    {
      "id": "S36",
      "page": "Capability Admin / Package Integrations",
      "state": "Package Integrations tab",
      "viewport": "desktop 1440x900",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/admin-integrations-desktop.png",
      "note": "规则级包/服务/配置映射"
    },
    {
      "id": "S37",
      "page": "Capability Admin / Package Integrations",
      "state": "Package Integrations tab",
      "viewport": "mobile 390x844",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/admin-integrations-mobile.png",
      "note": "移动端集成映射"
    },
    {
      "id": "S38",
      "page": "Capability Admin / Users & Queues",
      "state": "Users & Queues tab",
      "viewport": "desktop 1440x900",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/admin-users-queues-desktop.png",
      "note": "维护者和队列分配"
    },
    {
      "id": "S39",
      "page": "Capability Admin / Users & Queues",
      "state": "Users & Queues tab",
      "viewport": "mobile 390x844",
      "filePath": "E:/1project/EnvForge/screenshots/ui-extract/admin-users-queues-mobile.png",
      "note": "移动端 Users & Queues"
    }
  ],
  "openQuestions": [
    "临时运行库数据稀疏，真实连接、非空 Plan runs、报告详情、失败状态、rollback 结果需要 seed 数据或受控测试环境后补截图。",
    "本轮以 admin token 覆盖全量界面，并截图 anonymous；user 角色差异主要基于导航/API 403/代码推断，未单独以 user token 重跑全量截图。",
    "内置 Browser 插件在本环境不可用，截图由外部浏览器调试协议完成；产物路径和 PNG 文件已落盘。"
  ]
}
```
