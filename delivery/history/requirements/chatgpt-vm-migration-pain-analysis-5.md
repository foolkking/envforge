# 虚拟机换机痛点分析

**User:** Anonymous  
**Created:** 7/18/2026 12:56:52  
**Updated:** 7/20/2026 10:06:17  
**Exported:** 7/20/2026 10:07:44  
**Link:** [https://chatgpt.com/g/g-p-6a5cfd1e09b08191ab9d7adb7dac3ea4/c/6a5b0755-3024-83ec-982e-7da47fe3fa69](https://chatgpt.com/g/g-p-6a5cfd1e09b08191ab9d7adb7dac3ea4/c/6a5b0755-3024-83ec-982e-7da47fe3fa69)  

## Prompt:
2026/7/18 12:56:48

我目前想做一个类似虚拟机换机的项目，这是相关的一些设计内容，但是这个系统当前并不能很好的解决当前虚拟机换机的痛点，请你分析，这是部分部署的网站https://envforge.king.2bd.net
你可以通过账号（邮箱：fool.king.max+kkk@gmail.com 密码：12345678）进入网站点击测试

[Attachment: ChatGPT-EnvForge 2.json]

[Attachment: ChatGPT-EnvForge 1.json]

## Response:
2026/7/18 12:56:52

我会把两部分合起来看：一是你上传的产品/开发设计记录，二是实际部署站点里的完整操作链路。重点会落在“虚拟机换机真正要解决的用户痛点、当前产品为什么没闭环、哪些功能看起来有但实际不够用”这三层。

我已确认当前公开仓库与部署站点是同一套 EnvForge 产品。设计方向本身很明确：从旧 VM 采集证据，生成可审查的环境计划，再执行、验证和报告；接下来我会重点核对“产品声明”和“用户实际能完成的换机任务”之间的落差。

> **检查文件并提取消息统计信息**
>
>
> **检查文件并提取消息统计信息**
>
> 
>
> **检查消息并识别设计痛点**
>
>
> **检查消息并识别设计痛点**
>
> 
>
> **正在搜索网页**
>
> [EnvForge - Linux Environment Migration and Rebuild](https://envforge.king.2bd.net/)
>
> **搜索网页和 envforge.king.2bd.net**
>
> 
>
> **检查网站响应代码**
>
>
> **检查网站响应代码**
>
> 
>
> **搜索EnvForge网站相关页面**
>
> [Web会員マイページ](https://wsrv2.aztower.net/eps/szy/login)
> [ログイン | サイボウズのクラウドサービス](https://www.cybozu.com/jp/login/index.html)
> [PassLogic Login](https://secure3.medience.co.jp/ui/?sso-vpn=vpn)
> [[M] ORG - Log in](https://orgbd.net/)
> [https://rk2.jp/mugen/RKNET/Views/WF/Login.aspx](https://rk2.jp/mugen/RKNET/Views/WF/Login.aspx)
> [Convi.BASE にログインする](https://manual.cbee.jp/userguide/01/01-01.html)
> [ログインページ](https://member.flpj.co.jp/membersite/membersite.php)
> [ENVシステム: ログイン](https://env-furontenken.jp/)
> [会員ログイン画面](https://www.ms-anshin.com/customer/login/)
>
> **搜索多个网站和文档页面**
>
> 
>
> **正在搜索网页**
>
> [envforge/screenshots at main · foolkking/envforge · GitHub](https://github.com/foolkking/envforge/tree/main/screenshots)
>
> **搜索网页和 github.com**
>
> 
>
> **标记文件行号并获取相关结果**
>
>
> **标记文件行号并引用相关内容**
>
> 
>
> 思考了 3m 19s

## 总体判断

EnvForge 的技术方向没有错，但**产品重心偏了**。

现在它更像一个“安全迁移审计与计划工作台”：

> 扫描证据 → 判断置信度 → 审批 → 生成不可变计划 → 执行门禁 → 验证与报告

而用户真正购买“虚拟机换机工具”时，想完成的是：

> 新旧机器连接 → 自动识别业务 → 确认少数关键决策 → 搬数据 → 切流量 → 验证业务 → 出问题立即回退

仓库也明确把产品定义为 Linux VM 迁移和重建平台，并强调任何修改必须经过 Plan、Review、Apply、Verify 和 Report。这个安全内核是非常有价值的，但目前它占据了太多产品前台，真正影响换机成功率的“目标机兼容、数据一致性、停机窗口、切流、断点续传和业务验证”还没有成为核心体验。([GitHub](https://github.com/foolkking/envforge))

我的主观评分：

| 维度 | 当前评价 |
|---|---:|
| 产品技术方向 | 8/10 |
| 安全与审计设计 | 8/10 |
| 视觉和界面一致性 | 7/10 |
| 决策效率 | 4.5/10 |
| 真实换机闭环能力 | 3.5/10 |
| 普通运维用户易用性 | 4/10 |

目前更准确的产品阶段是：

**“具备较强安全内核的迁移评估与计划产品”，还不是“能够稳定完成换机的迁移产品”。**

我能访问部署站点并确认应用在线，但当前浏览工具不能向登录表单输入账号、建立交互式认证会话。因此下面的评估主要基于当前公开仓库、产品文档、最新 UI 截图以及你上传的开发和审计记录，而不是一次完整的登录后人工点击录像。

---

# 一、当前没有解决好的核心换机痛点

## 1. 目标机出现得太晚

当前迁移流程先连接旧机器、采集、分析、选择、处理未知项和配置数据，直到后面才进入“目标/Dry-run”。截图中的流程甚至把目标机放在第 7 步。([GitHub](https://github.com/foolkking/envforge/blob/main/screenshots/smoke/phase78-migrate-initial.png?raw=true))

但换机的第一个问题不是：

> 旧机器上有什么？

而是：

> 这些东西能不能在这台新机器上运行？

目标机应该在任务开始时就加入，并立即检查：

- CPU 架构是否一致；
- OS 和发行版差异；
- 磁盘空间和 inode；
- 内存与 swap；
- 数据库主版本兼容；
- 端口、用户、组、目录冲突；
- Docker、systemd、SELinux/AppArmor；
- 公网 IP、内网 IP、域名和防火墙；
- 新机器是否已经存在同名服务或数据。

**结果影响：**用户可能花很长时间完成旧机分析和审批，直到执行前才发现目标机根本不兼容。

### 建议

第一步直接改为：

> 创建换机任务：选择源机器 + 目标机器 + 换机目标

并在任何迁移选择之前生成：

- 目标兼容度；
- 阻塞项；
- 预计可自动迁移比例；
- 预计数据量；
- 预计停机时间；
- 需要人工处理的项目。

---

## 2. 当前审批对象仍然太技术化

选择页面已经比“逐个包审批”有所改善，但用户仍在面对 PostgreSQL、Node.js/npm、Modern CLI Tools 等 capability 卡片，以及“加入迁移、仅记录、跳过、证据”等按钮。每张卡又显示意图、准备度、风险等百分比。([GitHub](https://github.com/foolkking/envforge/blob/main/screenshots/smoke/migrate-select-final.png?raw=true))

这仍然是系统内部视角。

用户通常不会思考：

> 我要不要迁移 postgresql-client 这个包？

用户会思考：

> 我要不要把这个博客系统搬过去？  
> 数据库要不要一起搬？  
> 域名什么时候切换？  
> 最多允许停机多久？

虽然你上传的规划已经明确要求从 package、service、port、config、data、cert、secret 合并为服务栈，并让用户审批服务栈而不是单项证据，但这套理念还没有完全成为前台的主要交互对象。`ChatGPT-EnvForge 2.json`

### 建议

把审批主对象改成：

- 网站业务：Nginx + Node.js + PostgreSQL；
- Docker Compose 工作负载；
- Git 服务：Gitea + 数据库 + repositories；
- 监控栈；
- 缓存栈；
- 自定义应用；
- 系统基础能力。

一个服务栈只让用户做四类决定：

1. 是否迁移；
2. 数据怎么迁；
3. secret 怎么提供；
4. 切换和回滚怎么做。

包、端口、配置文件应折叠到“证据”里，而不是成为首要决策。

---

## 3. 数据迁移目前更像“策略选择”，不是“迁移执行产品”

配置/数据页面已经能识别 PostgreSQL 数据路径，并提供“备份恢复、同步复制、手工迁移、阻断”等选项，这是正确的方向。([GitHub](https://github.com/foolkking/envforge/blob/main/screenshots/smoke/phase78-config-data.png?raw=true))

但对于真实换机，用户还需要看到：

- 数据总量；
- 最近修改时间；
- 当前写入速率；
- 数据一致性策略；
- 是否需要停止服务；
- 初次全量同步耗时；
- 最终增量同步耗时；
- 预计停机窗口；
- dump 文件存放位置；
- 目标磁盘需求；
- 传输是否加密；
- 中断后是否可继续；
- 恢复失败怎么重试；
- 恢复后如何校验；
- 源数据何时解除冻结。

此前审计也指出，数据库数据迁移曾经只有策略描述，没有真实执行路径；后续虽然完成了大量 Inventory Graph 和服务栈工作，但上传记录仍把 PostgreSQL Data Migration Adapter 视为最重要的后续闭环之一。`ChatGPT-EnvForge 2.json`

### 建议

每个数据集应成为一等对象：

```text
数据集：PostgreSQL / app_production
大小：84 GB
当前写入：约 2.4 MB/s
推荐策略：初次 dump + 最终停写增量
预计全量耗时：42 分钟
预计停机：3-6 分钟
验证：数据库启动、SELECT 1、表数量、关键表行数
回滚：目标停止，恢复源服务与流量
```

不能只让用户选择“备份恢复”，系统必须告诉他**会执行什么、需要多久、什么时候停机，以及如何证明数据没有丢失**。

---

## 4. 缺少真正的 Cutover--换机最关键的阶段

当前主流程强调 Migrate、Build、Review、Apply、Verify、Report；文档与 UI 对安全计划描述得很完整。([GitHub](https://github.com/foolkking/envforge/blob/main/docs/web-ui.md))

但“Apply”不是换机。

换机通常需要：

1. 降低 DNS TTL；
2. 在目标机完成预部署；
3. 进行第一次全量数据同步；
4. 做目标端预验证；
5. 进入维护窗口；
6. 停止或冻结源服务写入；
7. 最终增量同步；
8. 启动目标服务；
9. 切换 DNS、反向代理、负载均衡或浮动 IP；
10. 做业务验证；
11. 观察一段时间；
12. 确认关闭源机器或触发回滚。

这些应该是一个明确的 **Cutover Plan**，而不是隐藏在若干 Apply Action 中。

### 建议

新增一等产品对象：

```text
Cutover Plan
├── 预切换准备
├── 初始数据同步
├── 维护模式 / 停止写入
├── 最终增量同步
├── 流量切换
├── 业务验证
├── 观察窗口
└── 关闭源机 / 回滚
```

每一步需要：

- 前置条件；
- 开始时间；
- 超时；
- 成功标准；
- 自动/人工；
- 回滚点；
- 是否允许跳过。

---

## 5. 验证偏“基础设施正确”，缺少“业务真的可用”

产品规划里已经定义了语法、运行时、网络和合成交易四层验证，这是正确的。`ChatGPT-EnvForge 2.json`

但用户最终关心的不是：

> systemctl 显示 active。

而是：

> 用户能不能打开网站、登录、写入数据、上传文件、发送邮件？

每个服务栈必须提供业务级验证模板，例如：

| 工作负载 | 应验证 |
|---|---|
| Nginx 网站 | HTTP 状态、页面关键字、TLS、重定向 |
| API 服务 | 健康接口、鉴权、写入再读取 |
| PostgreSQL | SELECT 1、数据库列表、关键表行数 |
| Gitea | 登录、仓库列表、clone 测试 |
| Nextcloud | 登录、文件读取、上传下载 |
| Redis | PING、key 数量、读写测试 |
| 定时任务 | timer/cron 是否存在、下一执行时间 |
| 邮件服务 | SMTP 握手、测试消息投递 |

### 建议

在任务开始时就让用户选择或填写：

> “迁移完成后，什么结果代表成功？”

这样验证条件才能在 Plan 中固化，而不是执行结束后才临时判断。

---

## 6. Secret 被正确阻断，但还缺少可操作的交付流程

当前界面会把 secret 标记为 review/blocker，这是安全的。配置页面也明确要求 secret review。([GitHub](https://github.com/foolkking/envforge/blob/main/screenshots/smoke/phase78-config-data.png?raw=true))

但用户需要一个清晰的解决流程：

- 从旧机读取但不保存明文；
- 只显示指纹和来源；
- 选择处理方式；
- 在执行前按需提供；
- 写入后验证；
- 可选择立即轮换；
- 报告里只记录策略和指纹，不记录值。

推荐的交互：

```text
DATABASE_PASSWORD
来源：/opt/app/.env
当前值：不会显示或复制
处理方式：
○ 执行时手工输入
○ 从 Vault 获取
○ 从 SOPS 文件获取
○ 在目标机重新生成
○ 迁移后立即轮换
○ 跳过并阻止启动
```

目前“发现 secret 并阻断”做得比“帮助用户安全解决 secret”更成熟。

---

## 7. 缺少传输进度、检查点和断点续传体验

换机可能持续几十分钟甚至数小时。用户需要知道：

- 当前在哪个工作负载；
- 当前传输了多少；
- 速度；
- 剩余时间；
- 哪一步正在执行；
- 是否可以暂停；
- SSH 断开后是否继续；
- 重连后从哪里恢复；
- 哪些工作已经完成；
- 哪个检查点可回滚。

现在 Apply Readiness 页面主要展示 blockers 和 warnings，Apply/Verify/Report 数量，而不是一条真实迁移时间线。([GitHub](https://github.com/foolkking/envforge/blob/main/screenshots/smoke/phase78-apply-readiness.png?raw=true))

### 建议

执行页采用任务时间线：

```text
✓ 创建目标目录
✓ 安装 PostgreSQL 16
✓ 写入配置
● 传输初始数据 61.4 / 84 GB，72 MB/s，约 5 分钟
○ 停止源数据库写入
○ 最终同步
○ 启动目标数据库
○ 数据完整性验证
○ 切换应用连接
```

每个步骤都应有：

- 日志；
- 重试；
- 跳转到问题；
- 检查点；
- 失败原因；
- 建议修复；
- “修复后从此处继续”。

---

# 二、当前 UI/UX 的具体问题

## 做得好的部分

界面视觉上已经形成了稳定的运维工作台风格：

- 左侧导航稳定；
- 页面结构清晰；
- 状态色使用克制；
- blocker、warning 和风险相对醒目；
- 没有把直接安装和远程修改作为主操作；
- Plan 的安全边界在产品中比较明确。

这与设计文档提出的“operations review workbench，而不是营销页或普通服务器面板”基本一致。([GitHub](https://github.com/foolkking/envforge/blob/main/docs/web-ui.md))

## 1. 流程模型不一致

设计文档写的是六步：

> Migrate → Build → Review → Apply → Verify → Report

实际迁移页面又是九步：

> 连接机 → 分析 → 选择 → 未知项 → 配置/数据 → 计划 → 目标/Dry-run → 执行 → 报告

同时一级导航中还有独立的 Migrate、Build、Plans、Reports。([GitHub](https://github.com/foolkking/envforge/blob/main/docs/web-ui.md))

用户很难理解：

- Build 和 Migrate 的边界；
- “计划”为什么既是迁移步骤，又有独立 Plans 页面；
- Review 在哪里发生；
- Verify 为什么有时属于执行，有时属于 Plans；
- Report 为什么既是最后一步，又有独立导航。

### 建议

面向普通用户只保留：

- 换机任务；
- 环境模板；
- 历史与报告。

进入一个换机任务后，所有步骤都在任务内完成。Plan 可以作为内部安全内核和高级审查页面存在，不必成为普通用户的主要心智模型。

---

## 2. 决策数量仍然过多

在选择页面，每个 capability 都有多个动作；页面顶部又展示已选、待审查、阻塞、配置风险和计划项等数字。([GitHub](https://github.com/foolkking/envforge/blob/main/screenshots/smoke/migrate-select-final.png?raw=true))

问题不是信息不够，而是用户不知道：

> 我下一步究竟只需要处理什么？

建议默认只展示：

1. 必须处理的阻塞；
2. 系统不敢替用户决定的事项；
3. 系统推荐摘要。

其余内容折叠到：

- 自动包含；
- 仅记录；
- 已忽略；
- 原始证据。

常见场景最好只让用户做 3-5 个决定。

---

## 3. 百分比缺少可行动解释

类似：

- 意图 99%；
- 准备度 49%；
- 意图 75%；
- 准备度 69%。

这些数字看起来专业，但用户不知道 49% 的准备度意味着：

- 缺配置？
- 缺数据策略？
- 缺 secret？
- 目标机不兼容？
- 没有回滚？
- 迁移能力未经验证？

### 建议

把百分比改成结果和原因：

```text
建议迁移
证据充分

还不能执行：
- 数据策略未确认
- 目标 PostgreSQL 版本未检查
- 数据库密码需要执行时提供
```

百分比可以放在“为什么”展开项里，而不是成为主视觉。

---

## 4. 中英文和内部术语混用

中文界面中仍出现：

- capability；
- ConfigBundle；
- apply；
- verify；
- dry-run；
- catalog-owned；
- user-created；
- 英文 blocker 消息。

例如 Apply Readiness 截图中的主要阻塞说明几乎全部是英文。([GitHub](https://github.com/foolkking/envforge/blob/main/screenshots/smoke/phase78-apply-readiness.png?raw=true))

这些术语适合开发者和平台工程师，但不适合普通 VPS 或中小团队运维用户。

建议用户层统一为：

| 内部术语 | 用户文案 |
|---|---|
| Capability | 可迁移能力 / 工作负载组件 |
| Environment Plan | 换机方案 |
| Apply | 开始执行 |
| Verify | 验证新机器 |
| ConfigBundle | 配置组 |
| Data Strategy | 数据迁移方式 |
| Dry-run | 执行前检查 |
| Blocker | 必须先解决 |
| Record-only | 只记录，不迁移 |

---

## 5. 空状态暴露了大量“有入口、没闭环”的功能

Plans、Runs、Reports 等截图中存在大片空白区域，部分页面只有一句介绍，没有明确的下一步引导。([GitHub](https://github.com/foolkking/envforge/blob/main/screenshots/ui-extract/plans-desktop.png?raw=true))

这会让产品显得“功能很多”，但也让用户怀疑这些入口是否真的可用。

### 建议

在闭环没有完成前，减少一级入口。

空状态必须提供任务导向：

```text
还没有换机任务
连接一台旧机器和一台目标机器，EnvForge 会分析服务、数据和风险。
[创建第一个换机任务]
```

而不是同时展示“新建计划草稿、导入 Recipe、Migration、Rebuild、Change、Remove、Repair”等内部分类。

---

## 6. Dashboard 把运维任务和账户设置混在一起

Dashboard 截图中，右侧账户、安全、OAuth、API Token 等大量设置占据了主要工作区域，导致真正的迁移提醒、阻塞和最近任务被弱化。([GitHub](https://github.com/foolkking/envforge/blob/main/screenshots/ui-extract/dashboard-desktop.png?raw=true))

Dashboard 应优先回答：

- 哪个换机任务需要我处理？
- 哪个任务即将进入维护窗口？
- 哪个迁移失败了？
- 哪个验证没有通过？
- 哪台旧机还没有关闭？
- 哪些目标机出现漂移？

账户设置应放进独立抽屉或设置页面。

---

# 三、推荐重新定义产品主流程

## 新流程：以“换机任务”为中心

### 第 1 步：创建换机任务

用户只填写：

- 源机器；
- 目标机器；
- 换机类型；
- 可接受停机时间；
- 计划切换时间；
- 是否保留源机器作为回滚。

换机类型可以是：

- 同配置复制；
- 跨发行版升级；
- 云厂商迁移；
- VPS 升配；
- 从裸机迁到 Docker；
- 仅评估，不执行。

### 第 2 步：自动生成环境地图

结果不先展示几百条 evidence，而是先展示：

```text
发现 5 个工作负载
- Web 应用：Nginx + Node.js
- PostgreSQL 数据库
- Redis 缓存
- Docker Compose 监控栈
- 3 个系统定时任务

数据量：84 GB
预计自动迁移：82%
预计停机：4-8 分钟
必须处理：4 项
```

### 第 3 步：处理三个决策组

#### A. 迁移哪些业务

以服务栈选择，不以包选择。

#### B. 数据和 Secret 怎么处理

集中决策，不散落在多个页面。

#### C. 怎么切换和回滚

包括维护时间、DNS、IP、源机保留时间和回滚触发条件。

### 第 4 步：执行前演练

展示：

- 源目标差异；
- 将安装什么；
- 将写入哪些文件；
- 会打开哪些端口；
- 数据迁移方式；
- 预计时间；
- 预计停机；
- 每一步验证；
- 每一步回滚能力。

按钮不要叫“继续”，应叫：

> 解决 3 个阻塞  
> 运行执行前检查  
> 安排维护窗口  
> 批准换机方案

### 第 5 步：分阶段执行

不要一次点击 Apply 后黑盒运行。

分为：

1. 准备目标机；
2. 初始同步；
3. 预验证；
4. 进入维护窗口；
5. 最终同步；
6. 切换流量；
7. 业务验证。

### 第 6 步：观察和回滚窗口

迁移成功不等于任务结束。

至少支持：

- 15 分钟即时观察；
- 24 小时复查；
- 来源机器保持待机；
- 自动检查服务、证书、端口和业务探针；
- 明确“继续观察”“完成换机”“立即回滚”。

### 第 7 步：完成和交接

报告应包含：

- 新旧环境对照；
- 迁移了什么；
- 没迁移什么；
- 数据校验结果；
- secret 处理策略；
- 切换时间；
- 实际停机；
- 异常和人工步骤；
- 回滚窗口；
- 旧机关闭清单。

---

# 四、建议保留和复用的现有能力

不要推翻目前已经做好的架构。

以下能力应该保留为底层内核：

- 不可变 Plan；
- artifact hash；
- approval gate；
- partial snapshot gate；
- secret 和数据策略确认；
- 审计事件；
- 验证层级；
- 回滚等级；
- Capability Catalog；
- Inventory Graph；
- service stack aggregator；
- Review Inbox；
- 报告链路。

你上传的记录显示项目已经投入大量工作在 Collector 完整度、Inventory Graph、服务栈聚合和决策引擎上，这些都可以继续使用。问题主要不是“这些能力没价值”，而是**它们当前直接暴露给用户，尚未被组合成一个真正的换机任务体验**。`ChatGPT-EnvForge 2.json`

建议产品分层：

```text
用户层：换机任务 / 工作负载 / 数据 / 切换 / 验证
------------------------------------------------
编排层：Migration Project / Cutover Plan / Checkpoint
------------------------------------------------
安全层：Immutable Plan / Approval / Gate / Audit
------------------------------------------------
执行层：Action Adapter / Data Adapter / Verify / Rollback
------------------------------------------------
证据层：Collector / Snapshot / Inventory Graph
```

---

# 五、最值得先做的 MVP 场景

不要继续平均扩展所有 capability。

先完整做通一个黄金场景：

## 推荐场景

**Nginx + Docker Compose 应用 + PostgreSQL 数据库，从旧 Ubuntu VPS 搬到新 Ubuntu VPS。**

它覆盖：

- 软件安装；
- 服务栈识别；
- 配置迁移；
- Docker/Compose；
- 数据库；
- secret；
- 数据同步；
- 端口；
- TLS；
- 域名；
- 停机窗口；
- 验证；
- 回滚。

### 这个场景的验收标准

用户能够：

1. 同时连接源机和目标机；
2. 自动识别成一个完整业务栈；
3. 只做不超过 5 个关键决策；
4. 看到数据量和预计停机；
5. 先完成目标机预部署；
6. 完成 PostgreSQL dump/restore；
7. 完成 Compose 重建；
8. 在维护窗口进行最终同步；
9. 切换域名或代理；
10. 自动验证 HTTP、TLS、容器、数据库；
11. 出错时回滚；
12. 得到完整报告。

只有这个场景真实跑通，EnvForge 才真正开始解决“换机”的核心痛点。

---

# 六、推荐开发优先级

## P0：先形成真实换机闭环

1. 源机和目标机从任务开始就绑定；
2. 目标兼容性与冲突检查；
3. 工作负载/服务栈成为主要审批对象；
4. PostgreSQL 真实 dump、transfer、restore、verify；
5. rsync 进度、重试、断点续传；
6. Cutover Plan；
7. Checkpoint 与恢复执行；
8. 业务级验证；
9. 明确的回滚触发条件；
10. 迁移执行时间线。

## P1：覆盖常见生产场景

- Docker Compose；
- MySQL/MariaDB；
- Redis；
- 文件数据集；
- Secret 执行时输入与 Vault/SOPS；
- DNS/TLS；
- 维护窗口；
- 迁移后 24 小时验证。

## P2：企业和平台能力

- 双人审批；
- RBAC；
- Change Window；
- Ticket 集成；
- 多副本任务队列；
- Policy-as-code；
- Webhook/CI；
- 长期 Drift 和 Repair Plan。

当前不建议把主要资源继续投入：

- Marketplace；
- 动态第三方插件；
- 更多管理后台页面；
- 更细的 capability 分类；
- 大量视觉重构；
- 普通用户不需要的治理配置。

---

# 最终结论

EnvForge 当前最大的优势是：

> 它认真解决了“如何安全地修改目标机器”。

当前最大的缺陷是：

> 它还没有完整解决“如何让业务从旧机器可靠地切换到新机器”。

下一阶段不应继续把产品扩展成更复杂的“迁移管理平台”，而应该收缩目标，围绕一个真实场景把下面这条链路跑通：

> 源目标配对 → 自动识别业务栈 → 数据与停机方案 → 预部署 → 最终同步 → 切流 → 业务验证 → 回滚窗口 → 完成报告

做到这一点后，现有的 Inventory Graph、Plan、审批、验证和审计能力都会真正转化成用户价值。现在的问题不是底层设计太少，而是**用户目标上方堆了太多内部系统概念，而最关键的切换编排和数据闭环还不够强**。

---

**Sources:**

- [GitHub - foolkking/envforge: Self-hosted VM/server configuration management website · GitHub](https://github.com/foolkking/envforge)

## Prompt:
2026/7/18 13:35:39

目标机出现得太晚，你建不建议将所有build和migrate界面的最终结果的输出都转为计划，然后在计划 中完成后续操作可以吗？
当前审批对象仍然太技术化，对，这是一个很严重的问题，很多时候迁移只考虑到了软件本身，但是如果这个服务是自己部署的，具体该怎么迁移，迁移后如何自动化部署，数据能否完整迁移过去，这是一个很需要考虑的问题，核心的目标就是解决这个问题，但是目前还没有想法怎么做，你可以仔细给我思考一下
3. 数据迁移目前更像“策略选择”，不是“迁移执行产品”，这是针对数据库等等服务的一个很重要的加强，之前只考虑到了软件本身，这是非常错误的
缺少真正的 Cutover——换机最关键的阶段，验证偏“基础设施正确”，缺少“业务真的可用”，请你帮我分析该怎么做
Secret 被正确阻断，但还缺少可操作的交付流程、缺少传输进度、检查点和断点续传体验，这是一个漫长且全面的工作需要考虑，因为换机要考虑的东西有很多
另外  当前我是不是应该对某个服务如各种数据库、个人网页所部署的内容、另外的服务进行深入的分析和处理，到底该怎么全面的提取并且部署完成？

## Response:
2026/7/18 13:35:44

我建议把这个问题当成一次产品架构重构，而不是继续给现有流程补页面：先统一 Build/Migrate 的输出模型，再把“服务迁移”从软件清单提升为可重建的业务工作负载，最后补齐数据、切换、验证和回滚闭环。

关键结论先给你：**可以统一转成 Plan，但不能把 Plan 变成一个包办所有交互的“大杂烩页面”。**更稳妥的结构是“换机项目负责探索与协作，Plan 负责固化可执行承诺，Run 负责实际执行与恢复”。这样既统一 Build/Migrate，又不会破坏你已经建立的不可变审批内核。

> **统一架构设计与文件检索**
>
>
> **统一架构设计并支持文件检索**
>
> 
>
> **规划与迁移分析**
>
> 我认为需要提供深入的回答，提出架构计划以及分阶段的路线图。迁移项目应该是顶层计划，避免让计划过载，并且应该遵循固定的流程。
>
> **规划了迁移分析**
>
> 
>
> **计算迁移项目的操作和状态管理**
>
>
> **计算迁移项目操作、审计和验证步骤**
>
> 
>
> **迁移计划与蓝图**
>
> 我认为需要一种分层的迁移方法，从标准化迁移方式到添加自定义功能，每个服务都是独立的、高效的，并以明确的步骤和验证契约确保顺利迁移。
>
> **制定迁移计划与蓝图**
>
> 
>
> 思考了 1m 38s

## 一、Build 和 Migrate 是否都应该汇聚到 Plan？

**建议统一，但要区分“换机项目、计划、执行”三个层次。**

最容易犯的错误，是把所有功能都塞进 Plan 页面，最后 Plan 同时承担扫描、编辑、审批、执行、进度、验证和报告，变成另一个复杂工作台。

更合理的关系是：

```text
换机项目 Migration Project
├── 源机器与目标机器
├── 环境扫描与服务识别
├── 用户决策
├── Draft Plan v1 / v2 / v3
├── Approved Plan
├── Execution Run
├── Cutover Run
└── Verification / Report
```

### 三个核心对象

| 对象 | 是否可修改 | 主要职责 |
|---|---:|---|
| Migration Project | 可以 | 扫描、分析、选择服务、补充信息、解决冲突 |
| Draft Plan | 可以重新生成 | 展示系统准备怎样执行 |
| Approved Plan | 不可修改 | 固化真正允许执行的动作 |
| Execution Run | 只能记录状态 | 执行、重试、恢复、进度、日志 |
| Report | 不可修改 | 最终结果、验证和审计 |

也就是说：

> **所有 Build 和 Migrate 都产生 Draft Plan，但用户不应该在 Approved Plan 上继续编辑。**

发生以下任何变化时，都应生成新的 Plan 版本：

- 修改目标机器；
- 修改数据迁移方式；
- 重新扫描源机器；
- 目标机器状态变化；
- 修改 secret 交付方式；
- 修改服务选择；
- 修改切换策略；
- 修改验证条件。

例如：

```text
Plan v3：已批准
目标机器重新扫描后发现 5432 端口冲突

系统行为：
Plan v3 标记为 superseded
生成 Plan v4
要求重新审查冲突处理
```

不能在原 Plan 上偷偷修改。

你之前的设计已经明确要求区分 Evidence、Candidate、Decision 和 Plan，并且要求用户审批服务栈、数据策略、secret 和冲突，而不是审批单个包或端口。这个方向应该保留。`ChatGPT-EnvForge 2.json`

---

## 二、Build 和 Migrate 应该如何统一？

两者入口不同，但输出应该相同。

### Build

输入来源是“用户期望”：

```text
模板 / Recipe / Capability
+ 用户配置
+ 目标机器状态
→ Draft Plan
```

例如：

> 在一台新 Ubuntu 服务器上部署 Nginx + PostgreSQL + Gitea。

### Migrate

输入来源是“旧机器真实状态”：

```text
源机器 Snapshot
+ Inventory Graph
+ 工作负载识别
+ 用户决策
+ 目标机器状态
→ Draft Plan
```

例如：

> 把旧服务器上的 Gitea、PostgreSQL、仓库文件和 Nginx 配置搬到新服务器。

### 最终统一编译链路

```text
Build Specification ─────┐
                         ├→ Workload Blueprint
Migration Assessment ────┘
                                ↓
                       Target Compatibility
                                ↓
                         Execution Plan
                                ↓
                       Approval / Immutable
                                ↓
                    Prepare → Cutover → Verify
```

因此，Build 和 Migrate 不应该分别维护两套执行体系。

它们只应有不同的“输入解析器”，后面共同使用：

- 相同的 Workload 模型；
- 相同的 Data Migration Engine；
- 相同的 Secret 交付；
- 相同的 Target Compatibility；
- 相同的 Action Adapter；
- 相同的 Verification；
- 相同的 Rollback；
- 相同的 Report。

### 导航上的建议

不再将 Build 和 Migrate 作为两个完全分离的大模块。

可以改成：

```text
新建项目
├── 迁移现有服务器
├── 从模板创建新环境
├── 从已有计划重建
└── 仅评估
```

后台分别标记：

```ts
origin: "migration" | "build" | "rebuild" | "repair"
```

但都进入同一种 Project 和 Plan。

---

# 三、真正的核心不是“软件迁移”，而是“工作负载重建”

现在最大的认知转变应该是：

> **不能再把 Nginx、PostgreSQL、Node.js 看成三个软件。要把它们识别为一个业务系统的组成部分。**

例如一个个人网站，真实结构可能是：

```text
个人博客
├── Nginx
│   ├── 域名 blog.example.com
│   ├── TLS 证书
│   └── 反向代理到 127.0.0.1:3000
├── Node.js 应用
│   ├── /opt/blog
│   ├── package-lock.json
│   ├── systemd blog.service
│   ├── .env
│   └── 上传目录 /var/lib/blog/uploads
├── PostgreSQL
│   ├── blog_production 数据库
│   ├── blog 用户
│   └── PostgreSQL 版本与扩展
└── 定时任务
    └── 每日备份
```

用户的决策对象应该是：

> 迁移“个人博客”

而不是：

- 迁移 Nginx；
- 迁移 nodejs；
- 迁移 npm；
- 迁移 postgresql-client；
- 迁移 3000 端口；
- 迁移某个 service 文件。

你现有的 Inventory Graph 已经在朝这个方向建立 process、dataPath、envFile、secretRef、volume、network、domain、certificate 和 scheduledTask 等节点与关系，这是必要底座。`ChatGPT-EnvForge 2.json`

但图谱只是“发现事实”。下一步必须形成一个更高层的对象：

## Workload Blueprint

```ts
interface WorkloadBlueprint {
  id: string;
  name: string;
  archetype: WorkloadArchetype;

  runtime: RuntimeContract;
  artifacts: ArtifactContract[];
  services: ServiceContract[];
  configs: ConfigContract[];
  datasets: DatasetContract[];
  secrets: SecretRequirement[];
  endpoints: EndpointContract[];
  dependencies: DependencyContract[];
  identities: IdentityContract[];
  scheduledTasks: ScheduledTaskContract[];

  deployment: DeploymentContract;
  verification: VerificationContract;
  cutover?: CutoverContract;
  rollback: RollbackContract;

  confidence: ConfidenceExplanation;
  unresolvedQuestions: RequiredDecision[];
}
```

这才应该是连接“扫描结果”和“执行计划”的中间层。

---

# 四、系统该如何识别一个自部署服务？

不能只依赖包管理器。

自部署服务往往没有正式软件包，甚至可能只是：

```text
/opt/myapp
/usr/bin/python /opt/myapp/app.py
systemd service
.env 文件
Nginx 反代
PostgreSQL 数据库
```

建议采用五层识别方法。

## 第 1 层：发现运行入口

从以下证据寻找真正运行的应用：

- systemd unit；
- Docker container；
- Docker Compose；
- 进程树；
- 监听端口；
- supervisor；
- pm2；
- cron/timer；
- init script；
- 用户级 systemd；
- 开机启动脚本。

对于 systemd 服务，重点提取：

```text
ExecStart
ExecStartPre
WorkingDirectory
User / Group
Environment
EnvironmentFile
RuntimeDirectory
StateDirectory
ReadWritePaths
Requires / After
Restart
```

例如：

```ini
[Service]
User=blog
WorkingDirectory=/opt/blog
EnvironmentFile=/etc/blog/blog.env
ExecStart=/usr/bin/node /opt/blog/server.js
```

系统由此可以推断：

- 应用目录：`/opt/blog`；
- 运行时：Node.js；
- 配置入口：`/etc/blog/blog.env`；
- 服务用户：`blog`；
- 启动命令：`node server.js`。

---

## 第 2 层：识别应用类型

根据目录和运行命令识别应用原型：

| 证据 | 推断类型 |
|---|---|
| package.json / package-lock.json | Node.js |
| requirements.txt / pyproject.toml | Python |
| composer.json | PHP |
| Gemfile | Ruby |
| go.mod | Go |
| Cargo.toml | Rust |
| Dockerfile | 容器化应用 |
| compose.yaml | Compose 工作负载 |
| index.html + 静态文件 | 静态网站 |
| 可执行二进制 + systemd | 独立二进制服务 |
| wp-config.php | WordPress |
| config/app.ini + repositories | Gitea/Forgejo |

分类结果不需要百分之百正确，但必须给出：

```text
识别结果：自定义 Node.js Web 应用
置信度：高

证据：
- systemd ExecStart 使用 /usr/bin/node
- WorkingDirectory 为 /opt/blog
- 发现 package.json 和 package-lock.json
- Nginx 将 blog.example.com 代理到 127.0.0.1:3000
```

---

## 第 3 层：识别部署来源

这是目前很容易遗漏的一层。

系统必须判断这个应用应该如何在目标机重建：

### A. 从源码重新构建

发现：

- Git repository；
- commit；
- lock file；
- build script；
- deployment documentation。

执行：

```text
clone/fetch
→ checkout approved commit
→ install locked dependencies
→ build
→ deploy artifact
```

### B. 从容器镜像部署

发现：

- image name；
- image digest；
- compose 文件；
- volume；
- environment；
- network；
- healthcheck。

执行：

```text
pull exact digest
→ create volumes/network
→ inject secret
→ compose up
```

### C. 从软件包重新安装

例如 PostgreSQL、Nginx、Redis：

```text
安装兼容版本
→ 生成配置
→ 恢复数据
→ 启动验证
```

### D. 复制现有构建产物

例如没有源码的闭源二进制：

```text
复制 binary/artifact
→ 校验 checksum
→ 恢复依赖库
→ 配置 systemd
```

### E. 无法可靠重建

例如只有杂乱目录，依赖未知。

此时不能假装能自动迁移，应输出：

```text
部署来源不明确
推荐：辅助迁移

需要用户确认：
- /opt/app 是否是完整发布目录？
- 是否还有外部构建服务器？
- 目标机是否允许复制现有二进制？
```

---

## 第 4 层：识别数据和可变状态

必须区分：

```text
代码 / 构建产物：可重新生成
配置：可模板化
Secret：执行时提供
数据：必须保持完整
缓存：通常可重建
日志：通常仅归档
临时文件：不迁移
```

例如 `/opt/blog` 下面不能整目录盲目复制。

应该分类：

```text
/opt/blog/server.js       → 应用代码
/opt/blog/node_modules    → 目标机重建
/opt/blog/uploads         → 用户数据，必须同步
/opt/blog/cache           → 可重建
/opt/blog/.env            → SecretRef，不直接复制
/opt/blog/logs            → 可选归档
```

分类证据可以来自：

- 文件修改频率；
- 进程打开文件；
- systemd StateDirectory；
- 容器 bind mount；
- 应用配置；
- 数据库连接；
- 目录名称；
- capability 规则。

推断不充分时必须向用户提问，而不是自行决定。

---

## 第 5 层：生成部署合同

每个工作负载最终必须形成一个可执行部署合同：

```text
1. 安装 Node.js 22
2. 创建用户 blog
3. 创建 /opt/blog 和 /var/lib/blog/uploads
4. 从 Git 获取 commit abc123
5. npm ci
6. npm run build
7. 写入 systemd unit
8. 执行时提供 DATABASE_URL
9. 恢复 uploads 数据
10. 启动 blog.service
11. 写入 Nginx 配置
12. 执行 nginx -t
13. 请求本地健康检查
14. 切换域名流量
15. 验证业务页面
```

这比“迁移 Node.js 软件”高了一个完整产品层级。

---

# 五、是否应该对每种数据库和服务做深入处理？

**应该，但不能无限地为每个软件写一套完全独立的迁移系统。**

建议采用三层架构。

## 第一层：通用工作负载模型

所有服务都共享：

- detect；
- classify；
- config；
- data；
- secret；
- dependency；
- deploy；
- verify；
- rollback；
- report。

这层负责流程统一。

## 第二层：服务原型 Adapter

例如：

- Package Service；
- Custom Systemd App；
- Docker Container；
- Docker Compose Workload；
- Static Website；
- Database；
- File Service；
- Reverse Proxy；
- Scheduled Workload。

这层解决 60%-80% 的共性。

## 第三层：深度 Capability

高价值服务需要专门适配：

- PostgreSQL；
- MySQL/MariaDB；
- Redis/Valkey；
- Nginx；
- Caddy；
- Docker Compose；
- Gitea/Forgejo；
- WordPress；
- Nextcloud；
- MinIO。

每个 Capability 都应该实现：

```text
detect
classify
compatibility
plan
config migration
data migration
secret requirements
cutover
verify
rollback
live harness
```

你原来的 Capability SDK 方向是对的，但认证标准必须从“能识别、能安装”提升到“能带数据迁移、能验证业务、能回滚”。已有设计也提出了 Live Migration With Data Proven 和 Production Recommended 等等级。`ChatGPT-EnvForge 2.json`

---

# 六、数据库迁移必须升级成完整 Data Migration Engine

不能再只是一个下拉框：

```text
○ dump/restore
○ rsync
○ manual
```

必须将数据集建模成独立对象。

## Dataset Contract

```ts
interface DatasetContract {
  id: string;
  workloadId: string;

  kind:
    | "postgresql"
    | "mysql"
    | "redis"
    | "filesystem"
    | "object-storage"
    | "docker-volume";

  source: DatasetSource;
  estimatedSize: number;
  writerProcesses: string[];
  consistencyRequirement: "crash-consistent" | "application-consistent";

  strategy: DataMigrationStrategy;
  initialSync?: DataSyncStep;
  quiesce?: QuiesceStep;
  finalSync?: DataSyncStep;
  restore: RestoreStep;
  verification: DataVerification[];
  rollback: DataRollback;
}
```

## 数据迁移生命周期

```text
Discover
→ Preflight
→ Prepare target
→ Initial copy
→ Quiesce source
→ Final copy
→ Restore/Activate
→ Verify
→ Commit or Rollback
```

### PostgreSQL 的真实迁移需要处理

不能只执行 `pg_dump`。

必须分析：

- PostgreSQL 源版本和目标版本；
- 数据库列表；
- roles；
- grants；
- ownership；
- extensions；
- encoding / locale；
- tablespaces；
- large objects；
- sequence；
- 数据大小；
- 当前连接；
- 是否存在持续写入；
- 允许停机时间。

策略选择应该由系统根据条件推荐：

| 条件 | 推荐 |
|---|---|
| 数据量较小、允许停机 | pg_dump / pg_restore |
| 版本跨度较大 | logical dump |
| 数据量很大、版本兼容 | physical backup |
| 停机要求低 | replication / initial sync + final cutover |
| 目标已有数据库 | conflict resolution |
| 无可靠备份能力 | blocker |

### 数据验证不能只做 `SELECT 1`

至少应该包括：

- 数据库可以连接；
- schema 数量；
- table 数量；
- extension；
- role；
- 关键表行数；
- sequence 状态；
- 用户指定的校验 SQL；
- 应用连接测试。

例如：

```text
验证结果
✓ PostgreSQL 启动成功
✓ blog_production 可连接
✓ 42 张表全部存在
✓ users 表行数：18,421 → 18,421
✓ posts 表行数：74,212 → 74,212
✓ pg_trgm 扩展存在
✓ 应用可完成一次读写测试
```

---

# 七、Cutover 应该成为一等产品对象

Cutover 不能只是 Plan 里几个 Action。

建议定义：

```ts
interface CutoverContract {
  maintenanceWindow?: TimeWindow;
  maximumDowntime?: number;

  preconditions: CutoverCheck[];
  sourceFreeze: SourceFreezeStrategy;
  finalSync: FinalSyncStrategy;
  trafficSwitch: TrafficSwitchStrategy;
  verification: VerificationContract;
  observationWindow: number;

  commitConditions: Condition[];
  rollbackConditions: Condition[];
  rollbackDeadline?: Date;
}
```

## 标准 Cutover 状态机

```text
READY
  ↓
PREPARING_TARGET
  ↓
INITIAL_SYNC_COMPLETE
  ↓
PRE_CUTOVER_VERIFIED
  ↓
WAITING_FOR_WINDOW
  ↓
SOURCE_QUIESCED
  ↓
FINAL_SYNC_COMPLETE
  ↓
TARGET_ACTIVATED
  ↓
TRAFFIC_SWITCHED
  ↓
BUSINESS_VERIFYING
  ↓
OBSERVING
  ├──→ COMMITTED
  └──→ ROLLING_BACK → ROLLED_BACK
```

## Cutover 前必须满足

- 目标机准备完成；
- 初始数据同步完成；
- Secret 全部可用；
- 数据库兼容检查通过；
- 所有预验证通过；
- 回滚方式明确；
- 维护窗口确认；
- DNS TTL 已按需降低；
- 源机器仍可恢复；
- 用户确认允许停写。

## 流量切换方式

需要支持不同 adapter：

- DNS 修改；
- 负载均衡器后端切换；
- Nginx upstream 切换；
- 浮动 IP；
- 云厂商弹性 IP；
- 手工切换。

不能自动化的，也应该作为结构化人工步骤：

```text
人工步骤：修改 Cloudflare A 记录
期望目标：203.0.113.10
完成后点击“已完成并验证”
系统将继续检测 DNS 和 HTTPS
```

## 回滚不是“重新运行反向命令”

真正的回滚应该回答：

- 数据是否已经在目标端产生新写入；
- 流量切回源机后，目标端新数据怎么办；
- 源数据库是否仍可写；
- DNS 缓存多久恢复；
- 哪些操作不可逆；
- 回滚期限是多久。

数据库发生双向写入后，回滚往往不是自动的，因此必须把回滚等级明确展示为：

```text
全自动
需要停止服务
需要人工数据合并
不可安全回滚
```

---

# 八、验证必须从“机器正常”升级到“业务成功”

建议定义六层验证。

## L1：Artifact 与配置完整性

- 文件 checksum；
- owner/mode；
- 配置是否渲染完整；
- Secret 是否全部绑定；
- 镜像 digest 是否一致。

## L2：语法验证

- `nginx -t`；
- `postgresql.conf` 检查；
- `docker compose config`；
- systemd unit verify。

## L3：运行时验证

- service active；
- container healthy；
- process 存在；
- 无 restart loop；
- 日志中没有 fatal error。

## L4：网络和依赖验证

- 端口监听；
- localhost 请求；
- TLS handshake；
- 应用可以连接数据库；
- 外部依赖可达。

## L5：数据验证

- 数据库对象；
- 行数；
- 文件数量；
- checksum；
- object count；
- 用户指定查询。

## L6：业务合成验证

例如个人网站：

```text
GET /
→ 状态码 200
→ 页面包含预期标题

GET /api/health
→ 数据库连接正常

登录测试账号
→ 创建一条临时记录
→ 读取成功
→ 删除临时记录
```

系统不可能自动理解所有任意应用，因此业务验证应有三个来源：

1. Capability 自带；
2. 系统根据 Nginx、端口和 healthcheck 推断；
3. 用户补充自定义验证。

创建项目早期就应该问：

> 迁移完成后，什么结果代表业务成功？

而不是 Apply 完成后才临时验证。

---

# 九、Secret 交付应设计成“需求绑定”，而不是复制文件

Secret 模型应分为三层：

```text
SecretRef
源机器发现的引用和指纹

SecretRequirement
目标部署需要哪个 Secret

SecretProviderBinding
执行时从哪里获得
```

例如：

```text
Secret Requirement
名称：DATABASE_PASSWORD
用于：blog.service
目标位置：/etc/blog/blog.env
执行前必须可用：是

提供方式：
○ 执行时输入
○ Vault
○ SOPS
○ 目标机已有
○ 自动重新生成
○ 迁移后轮换
○ 跳过并阻止启动
```

完整状态：

```text
Unresolved
→ Bound
→ Available
→ Injected
→ Validated
→ Rotated（可选）
```

必须保证：

- 不在 Snapshot 保存明文；
- 不在 Plan artifact 保存明文；
- 不在日志显示；
- 不在 Report 显示；
- 只在执行时短暂取得；
- 写入后验证目标服务能使用；
- 必要时立即轮换；
- Run 结束后清除临时材料。

Plan 保存的是：

```text
Secret 已批准通过 user-input 提供
fingerprint: sha256:...
requiredAtStep: restore-application
```

不是 secret value。

---

# 十、进度、检查点和断点续传怎么设计？

核心不是做一个进度条，而是建立**可恢复执行引擎**。

## 每个 Action 必须具备

```ts
interface ExecutableAction {
  id: string;
  planId: string;
  workloadId: string;

  preconditions: Condition[];
  idempotencyKey: string;

  execute: ActionSpec;
  verify: VerifySpec[];

  timeout: number;
  retryPolicy: RetryPolicy;

  checkpoint?: CheckpointSpec;
  rollback?: RollbackSpec;

  resumability:
    | "byte-resumable"
    | "step-resumable"
    | "restart-required"
    | "manual";
}
```

这里必须诚实地区分：

### Byte-resumable

例如：

- rsync partial；
- 分块文件传输；
- 对象存储 mirror。

可以从字节或文件块继续。

### Step-resumable

例如数据库 dump 已经生成，网络传输中断。

可以继续传输 dump 文件，但不能从 `pg_dump` 的任意字节继续生成。

### Restart-required

例如某些 logical restore 中断后，需要清理目标数据库并重新 restore。

### Manual

例如某些第三方服务官方备份失败，需要用户处理。

不要在 UI 上笼统显示“支持断点续传”。

---

## Transfer Session

大文件传输应建模为：

```text
Transfer Session
├── 文件清单 manifest
├── 每个文件 checksum
├── 已完成块
├── 当前速度
├── 带宽限制
├── 并发数
├── 重试次数
├── 源端状态
└── 目标端状态
```

支持：

- chunk hash；
- 传输后校验；
- 失败文件单独重试；
- SSH 断开后重新建立 session；
- 浏览器关闭不影响后台任务；
- 用户重连后恢复 UI；
- 可暂停；
- 可取消；
- 可设置带宽。

## 执行日志必须持久化

不能让执行依赖浏览器连接。

```text
API 创建 Execution Run
→ Task Queue
→ Worker 执行
→ Journal 持久化
→ UI 订阅状态
```

用户刷新页面后仍然看到：

```text
PostgreSQL dump：完成
Transfer：61.4 GB / 84 GB
Restore：未开始
Checkpoint：initial-sync-complete
```

已有规划中提出 live disposable-target lab，用受控目标验证从扫描、审批、不可变 Plan、Apply、Verification 到 Report 的完整路径，这种端到端实验是后续每个深度 Capability 的最低验收方式。`ChatGPT-EnvForge 1.json`

---

# 十一、Plan 内应该包含什么？

建议 Plan 是一份完整的“执行合同”。

```ts
interface EnvironmentPlan {
  id: string;
  version: number;
  projectId: string;
  origin: "build" | "migration" | "rebuild" | "repair";

  sourceSnapshotHash?: string;
  targetSnapshotHash: string;

  workloadBlueprints: WorkloadBlueprintRef[];
  decisions: DecisionRecord[];

  targetChanges: TargetChangeSummary;

  actions: ActionDAG;
  datasets: DatasetContract[];
  secretRequirements: SecretRequirement[];
  secretBindings: SecretProviderBindingMetadata[];

  cutover?: CutoverContract;
  verification: VerificationContract;
  rollback: RollbackContract;

  estimates: {
    transferBytes?: number;
    preparationDuration?: number;
    downtimeRange?: DurationRange;
  };

  gates: ApplyGate[];
  knownLimitations: string[];

  artifactHash: string;
  status: "draft" | "review" | "approved" | "superseded";
}
```

Plan Review 页面不要再以技术 Action 为主，而应先显示：

```text
本次换机将迁移 3 个工作负载

个人博客
- 重新部署 Node.js 应用
- 恢复 PostgreSQL 数据库
- 同步 18 GB 上传文件
- 重新签发 TLS 证书
- 预计停机 4-8 分钟

监控系统
- 使用 Docker Compose 重建
- 恢复 4 GB volume
- 不迁移历史日志

系统工具
- 自动安装 12 个必要软件包
```

展开后再看具体 Action。

---

# 十二、建议先深入做哪些服务？

不要一开始做“各种数据库、各种网页、各种服务”。

建议选择能验证产品核心价值的纵向场景。

## 第一个黄金场景

### 自部署个人网站

```text
Nginx
+ 自定义 Node.js 或 Python systemd 应用
+ PostgreSQL
+ uploads 文件目录
+ .env Secret
+ 域名与 TLS
+ cron/timer
```

这个场景能迫使系统解决：

- 自定义应用识别；
- 服务边界；
- 代码与数据区分；
- runtime 重建；
- config；
- secret；
- PostgreSQL；
- 文件增量同步；
- Nginx；
- TLS；
- cutover；
- 业务验证；
- 回滚。

它比单独做 PostgreSQL 更能证明 EnvForge 是换机产品，而不是数据库备份工具。

## 第二个黄金场景

### Docker Compose 应用

```text
compose.yaml
+ env_file
+ bind mounts
+ named volumes
+ PostgreSQL/Redis container
+ reverse proxy labels
```

## 第三个黄金场景

### Gitea/Forgejo

因为它包含：

- 应用；
- 数据库；
- Git repositories；
- 配置；
- Secret；
- SSH；
- HTTP；
- 官方备份；
- 业务验证。

---

# 十三、推荐实施顺序

## Phase 1：统一产品对象和流程

完成：

- Migration Project；
- Build/Migrate 统一生成 Draft Plan；
- Plan version；
- Approved Plan immutable；
- Target 从项目开始绑定；
- 新导航和任务流程。

这阶段不做新的迁移 Adapter。

## Phase 2：Workload Blueprint

完成：

- 工作负载模型；
- Custom Systemd App 识别；
- 反向代理关联；
- runtime/artifact/config/data/secret 分类；
- 自动化等级；
- unresolved questions。

## Phase 3：Data Migration Engine Core

先完成：

- Dataset Contract；
- 文件数据集；
- PostgreSQL；
- initial sync；
- quiesce；
- final sync；
- restore；
- data verify；
- rollback classification。

## Phase 4：Durable Execution

完成：

- Action DAG；
- journal；
- checkpoint；
- retry；
- idempotency；
- transfer session；
- 进度；
- reconnect；
- resume classification。

## Phase 5：Cutover 和业务验证

完成：

- Cutover Contract；
- maintenance window；
- source freeze；
- final sync；
- traffic switch；
- synthetic verification；
- observation；
- commit/rollback。

## Phase 6：第一个完整黄金场景

完整跑通：

```text
旧 Ubuntu VPS
→ Nginx + Custom App + PostgreSQL + Uploads
→ 新 Ubuntu VPS
```

验收不能只靠 unit test。

必须包含：

- disposable source；
- disposable target；
- 实际数据；
- 传输中断；
- 恢复；
- 验证失败；
- rollback；
- 最终 report。

---

# 最重要的产品决策

你现在不应该继续问：

> 还需要多识别哪些软件？

而应该问：

> 对一个被识别出的业务系统，EnvForge 是否能解释它如何运行、哪些内容必须迁移、如何在目标机重建、何时停止写入、如何切换流量、如何证明业务成功、失败后如何恢复？

因此最终建议是：

1. **Build 和 Migrate 统一汇聚到 Draft Plan。**
2. **所有后续执行都引用 Approved Plan，但执行过程属于 Run，不修改 Plan。**
3. **以 Migration Project 作为用户工作空间。**
4. **把审批对象从软件改为 Workload Blueprint。**
5. **采用通用模型 + 服务原型 + 深度 Capability，而不是为所有软件硬编码。**
6. **先做一个自部署个人网站的端到端黄金场景。**
7. **只有同时解决应用重建、数据、Secret、Cutover、业务验证和回滚，才算真正完成一次服务迁移。**

EnvForge 最终的核心能力不应该是“识别服务器安装了什么”，而应该是：

> **把一台服务器上的业务运行事实，编译成一份能够在目标机器上安全重建、迁移数据、完成切换并证明业务可用的不可变执行计划。**

## Prompt:
2026/7/18 14:24:34

还有一个问题，如果用户只有一台服务器，它需要能够将所部署的服务存到我的系统里，然后该所存储的服务和数据能够完美的兼容到它申请的下一台机器，也就是说这有一个空窗期它可能没用服务器。对于所存的服务和数据的完整性和可保持性等等需要考虑清楚。
build主要是接受新的软件服务所以没必要考虑历史数据什么的，所以范围可以广而全，但是migrate应该是包含原机器的服务和数据，这个任务该怎么分析还是一个值得考虑的问题，请你帮我整理清楚

## Response:
2026/7/18 14:24:39

这个场景应该单独成为第三种产品模式，而不是硬塞进现有 Migrate：**用户先把一台仍在运行的服务器“封存”为可恢复环境，之后可能隔几天或几个月再恢复到新机器。**我会先把 Build、在线 Migrate、离线封存恢复三者的边界理清，再给出统一的数据模型和产品流程。

> **考虑恢复战略**
>
> 我在思考如何用“兼容性封装”方案确保未来应用恢复稳定，建议采用逐层恢复策略：原生重建、容器化、全虚拟机镜像回退。这样能够确保数据迁移的灵活性。
>
> **考虑恢复战略**
>
> 
>
> **制定迁移与保存策略**
>
> 我考虑提供清晰的步骤和架构，确保"构建广泛，深度迁移，安全归档"的策略，强调“环境胶囊”存储。考虑到不同步骤的详细计划，逐步实现。
>
> **制定迁移和保存策略**
>
> 
>
> 思考了 1m 6s

你的新场景不是普通备份，也不是在线换机，而是：

> **先把当前服务器上的业务完整封存，允许旧服务器被释放；未来再申请一台新服务器，把业务恢复并重新上线。**

它应该成为 EnvForge 的第三种核心模式。

# 一、把产品明确拆成三种任务

| 模式 | 输入 | 是否包含历史数据 | 是否立即有目标机 | 核心结果 |
|---|---|---:|---:|---|
| Build | 用户期望、模板、软件选择 | 否 | 是 | 在目标机创建新环境 |
| Live Migrate | 源机器 + 目标机器 | 是 | 是 | 搬迁、切流、验证、回滚 |
| Preserve & Restore | 只有源机器 | 是 | 否 | 封存环境，未来恢复到新机器 |

建议产品入口改成：

```text
创建项目
├── 创建新环境
├── 将现有服务器迁移到新服务器
├── 保存当前服务器，稍后恢复
└── 仅分析服务器
```

三种模式共享底层 Plan、执行、验证和报告，但生命周期不同。

---

# 二、只有一台服务器时，需要新增“环境封存”能力

可以把封存产物称为：

- Environment Capsule；
- Portable Environment；
- Recovery Bundle；
- 中文可以叫“环境存档”或“可恢复环境”。

我更建议用户界面叫：

> **可恢复环境**

因为它比“备份”表达得更准确：里面不只有文件和数据库，还有服务如何运行、未来如何重新部署。

## 正确流程

```text
源服务器
   ↓
分析业务和依赖
   ↓
生成封存计划
   ↓
预复制数据
   ↓
停止或冻结写入
   ↓
最终一致性采集
   ↓
加密上传并封存
   ↓
完整性验证
   ↓
可选：自动恢复演练
   ↓
确认可以释放旧服务器
```

几天或几个月后：

```text
用户申请新服务器
   ↓
选择已保存的可恢复环境
   ↓
分析目标机兼容性
   ↓
生成恢复计划
   ↓
恢复软件、配置、数据和 Secret
   ↓
启动服务
   ↓
业务验证
   ↓
重新上线
```

这里不能只有一个跨越几个月的 Plan。

应该生成两个独立的不可变计划：

1. **Capture Plan**：从旧服务器采集并封存；
2. **Restore Plan**：在未来某一台具体目标机上恢复。

因为未来目标机器、系统版本、CPU 架构和软件仓库都可能变化，不能在封存时提前固化恢复动作。

---

# 三、可恢复环境里究竟需要保存什么？

不能只保存磁盘文件，也不能只保存扫描结果。

建议由六部分组成。

## 1. Workload Blueprint：业务如何运行

记录：

- 业务名称；
- 服务入口；
- systemd unit；
- Docker/Compose；
- 启动命令；
- 工作目录；
- 服务用户和用户组；
- 监听端口；
- 反向代理关系；
- 域名；
- 定时任务；
- 数据库依赖；
- 外部依赖；
- 服务启动顺序；
- 健康检查方式。

例如：

```text
个人博客
├── Nginx：blog.example.com → 127.0.0.1:3000
├── blog.service：Node.js /opt/blog/server.js
├── PostgreSQL：blog_production
├── 上传目录：/var/lib/blog/uploads
├── Secret：DATABASE_URL、SESSION_SECRET
└── 定时任务：每日数据库备份
```

## 2. Deployment Artifacts：重建业务需要的材料

包括：

- Git repository 和 commit；
- lock file；
- 编译产物；
- 自定义二进制；
- Docker image digest；
- 必要时保存 Docker image；
- 软件包版本；
- 软件源信息；
- systemd unit；
- Compose 文件；
- Nginx 配置；
- 安装和构建命令。

原则是：

> 能重新构建的内容优先保存“来源与版本”，无法稳定重新获得的内容同时保存实际 artifact。

例如 Node.js 应用不能只记录“安装 Node.js”，还应保存：

```text
Git commit: abc123
Node.js: 22.4.1
package-lock.json checksum
npm build command
构建产物 checksum
```

## 3. Mutable State：真正不能丢的数据

包括：

- 数据库；
- 用户上传文件；
- Docker volumes；
- 对象存储数据；
- Git repositories；
- 应用状态目录；
- 必要的日志或审计记录。

必须排除或单独分类：

- cache；
- tmp；
- node_modules；
- 可重新生成的构建缓存；
- 系统日志；
- session 临时文件。

否则存档会非常庞大，而且恢复后可能带入无效状态。

## 4. Configuration

配置要区分：

- 可直接恢复的配置；
- 需要针对新机器重新渲染的配置；
- 包含 Secret 的配置；
- 包含旧 IP、旧路径、旧主机名的配置。

不能把所有配置原样复制。

例如：

```text
server_name blog.example.com;        → 可以复用
proxy_pass http://127.0.0.1:3000;    → 需要验证
listen 192.0.2.10:443;               → 必须重新映射
ssl_certificate /旧路径/...;          → 可能重新签发
```

## 5. Secret Requirements

默认不建议把 Secret 明文打包进环境存档。

应保存：

- Secret 名称；
- 来源位置；
- 指纹；
- 使用者；
- 目标注入位置；
- 未来从哪里获得；
- 是否需要轮换；
- 是否允许保存加密副本。

例如：

```text
DATABASE_PASSWORD
用途：blog.service
原来源：/etc/blog/blog.env
保存策略：不保存明文
未来恢复：用户输入
迁移完成后：建议轮换
```

用户明确要求托管 Secret 时，必须使用独立加密存储、独立密钥和严格访问控制，不能和普通数据包混放。

## 6. Verification Contract

环境存档里必须同时保存“未来怎样判断恢复成功”。

例如：

```text
基础设施验证
- blog.service active
- PostgreSQL active
- 80/443/3000 端口符合预期

数据验证
- blog_production 有 42 张表
- posts 表至少有 74,212 行
- uploads 文件数量为 18,942
- uploads manifest checksum 匹配

业务验证
- 首页返回 200
- 页面包含网站标题
- 登录接口成功
- 创建并读取一条临时记录
```

没有验证规则，就无法证明未来恢复的业务与原业务一致。

---

# 四、不能承诺“完美兼容任何下一台机器”

这个目标需要调整为：

> **完整保存业务，并在未来针对具体目标机器重新计算兼容性和恢复计划。**

任意未来服务器不可能保证完美兼容，例如：

- 原机器是 x86，新机器是 ARM；
- 原系统是 Ubuntu，新系统是 Alpine；
- 软件包已经从仓库下架；
- 数据库版本跨度过大；
- 应用依赖旧版 glibc；
- 内核模块不兼容；
- 许可证绑定机器标识；
- 外部 API 或软件源已经消失。

因此，存档时必须生成一个 **Compatibility Envelope，兼容性边界**。

## 建议记录

```text
CPU architecture：x86_64
最低内存：4 GB
最低磁盘：120 GB
推荐系统：Ubuntu 22.04/24.04
文件系统要求：支持 POSIX 权限
运行时：Node.js 22
数据库：PostgreSQL 15
必需 CPU 特性：无
必需内核模块：无
外部依赖：
- GitHub repository
- npm registry
- Cloudflare DNS
```

未来用户选择新服务器时，系统输出：

```text
兼容
兼容但需要转换
需要人工处理
无法恢复
```

而不是简单显示一个百分比。

---

# 五、建议采用“三层可恢复策略”

为了避免未来软件源失效或运行环境变化，重要服务不能只有一种恢复方式。

## 第一层：原生重建

首选方式：

```text
安装软件
→ 获取源码或 artifact
→ 恢复配置
→ 恢复数据
→ 启动验证
```

优势是可维护、可升级、适配新系统。

## 第二层：保存精确运行材料

同时保存：

- Docker image；
- 自定义二进制；
- 构建产物；
- 软件包文件；
- lock file；
- 精确依赖版本。

防止未来上游资源消失。

## 第三层：整机镜像兜底

对于无法理解或无法重建的遗留服务，可以额外保存：

- 磁盘镜像；
- VM 镜像；
- 文件系统快照。

但整机镜像只能是兜底，不能作为默认主方案，因为它：

- 跨云厂商兼容差；
- 跨架构困难；
- 启动驱动可能不同；
- 包含大量无效数据；
- 不容易检查 Secret；
- 很难升级和长期维护。

建议每个工作负载显示：

```text
主要恢复方式：原生重建
备用方式：保存构建 artifact
最终兜底：完整磁盘镜像
```

---

# 六、封存时如何保证完整性？

这是该模式最重要的安全问题，因为旧服务器一旦释放，错误可能无法补救。

需要建立五层完整性。

## 1. 发现完整性

系统是否识别了所有运行中的业务：

- 每个监听端口是否有归属；
- 每个长期运行进程是否有归属；
- 每个 systemd service 是否已分类；
- 每个 Docker volume 是否有归属；
- 每个数据目录是否已分类；
- 每个数据库是否已处理；
- 每个 Secret 引用是否已处理；
- 每个域名是否有归属。

未知项不能静默忽略。

必须显示：

```text
仍有 3 个未归属对象：
- 进程 /opt/unknown/worker
- 数据目录 /srv/archive
- 监听端口 9102

在确认前，不建议释放旧服务器。
```

## 2. 应用一致性

复制正在写入的数据并不一定有效。

例如：

- 直接复制 PostgreSQL 数据目录可能不一致；
- Redis AOF 可能正在写；
- SQLite 文件可能被应用持有；
- 上传目录在复制过程中可能新增文件。

因此需要：

```text
初始预复制
→ 停止写入或进入维护模式
→ 最终增量复制
→ 创建一致性标记
```

数据库必须使用对应的备份或快照机制。

## 3. 传输完整性

数据应采用：

- 分块上传；
- content-addressed storage；
- 每块 checksum；
- 文件 manifest；
- 断点续传；
- 上传完成后重新校验；
- 压缩前后校验；
- 加密前后明确校验范围。

最终存档包含一个签名 manifest：

```text
archiveId
workloadIds
artifact hashes
dataset manifests
file count
total bytes
source snapshot hash
capture plan hash
capture time
encryption metadata
signature
```

## 4. 存储持久性

你的系统不能只把这些数据放在普通本地磁盘。

至少需要：

- 对象存储；
- 多副本或纠删码；
- 版本控制；
- 防止误删除；
- 定期 integrity scrub；
- 数据保留策略；
- 到期提醒；
- 存储费用预估；
- 用户可导出；
- 删除前二次确认；
- 审计日志。

重要存档建议支持跨区域副本或用户自带对象存储。

## 5. 恢复可用性

文件 checksum 正确，不代表业务能恢复。

因此完整性等级应分级：

| 等级 | 含义 |
|---|---|
| Captured | 已上传 |
| Integrity Verified | 文件和数据校验通过 |
| Restore Plan Ready | 已具备恢复方案 |
| Restore Simulated | 已完成静态模拟和兼容检查 |
| Restore Tested | 已在临时目标实际恢复 |
| Production Ready | 实际恢复和业务验证均通过 |

只有显示为 `Restore Tested`，用户才能对未来恢复有较高信心。

---

# 七、必须增加“可以安全释放服务器”门禁

封存页面最后不能只显示：

> 上传成功。

而应显示：

```text
是否建议释放旧服务器：暂不建议

阻塞项：
- PostgreSQL 恢复测试未通过
- /srv/archive 尚未确认用途
- SESSION_SECRET 没有未来提供方式

已完成：
- 128 GB 数据上传
- 所有文件 checksum 通过
- Node.js 应用部署材料完整
- Nginx 配置完整
```

当所有关键项完成后：

```text
环境封存状态：可以释放旧服务器

证据：
✓ 所有业务已归属
✓ 所有关键数据已一致性采集
✓ 数据完整性验证通过
✓ Secret 恢复策略已确认
✓ 恢复计划可以生成
✓ 临时目标恢复演练通过
```

即使全部通过，文案也不应该承诺绝对无风险，而应说明：

> 根据当前采集结果和恢复测试，可以安全释放旧服务器。外部服务、域名注册商和第三方账号不属于存档内容。

---

# 八、Build 和 Migrate 应该明确采用不同的能力策略

你的判断是正确的：

> Build 可以广而全；Migrate 必须少而深。

## Build 的产品目标

Build 解决：

> 用户想要一个什么样的新环境？

特点：

- 没有历史数据；
- 不需要发现未知业务；
- 不需要 Cutover；
- 不需要恢复旧状态；
- 可以通过通用软件目录覆盖大量软件；
- 主要风险是安装、配置和兼容性。

Build 可以采用：

```text
软件目录
+ 模板
+ 通用 Package/Container Adapter
+ 用户参数
→ Build Plan
```

它可以支持较多软件：

- Nginx；
- Caddy；
- Node.js；
- Python；
- Docker；
- PostgreSQL；
- Redis；
- 常用 CLI；
- 开发环境；
- 监控工具。

即使某个软件只有安装、启动和基础验证，也可能已经对 Build 有价值。

## Migrate 的产品目标

Migrate 解决：

> 当前业务怎样运行，怎样在不丢状态的情况下在另一台机器重现？

特点：

- 必须理解源机器；
- 必须识别工作负载；
- 必须处理自部署应用；
- 必须区分代码、配置、数据、缓存和 Secret；
- 必须考虑一致性；
- 必须处理目标兼容；
- 必须验证业务；
- 必须考虑 Cutover 和回滚。

因此 Migrate 不应该追求支持几百个软件。

应该追求：

> 对少量高价值工作负载，完成真正端到端的迁移。

---

# 九、建议重新定义 Capability 的认证维度

同一个 Capability 在 Build 和 Migrate 中的能力等级不同。

例如 PostgreSQL：

```text
Build 支持：可以安装和初始化
Migration 支持：可以分析数据库和生成计划
Data Migration 支持：可以 dump、transfer、restore
Cutover 支持：可以停止写入并最终同步
Verified Migration：可以完成数据和业务验证
Archive/Restore 支持：可以长期封存并恢复
```

建议认证拆为：

| 认证 | 含义 |
|---|---|
| Build Certified | 可以可靠安装和配置 |
| Detection Certified | 可以可靠识别现有服务 |
| Migration Planning Certified | 可以生成迁移计划 |
| Data Migration Certified | 可以迁移真实数据 |
| Cutover Certified | 可以完成一致性切换 |
| Archive/Restore Certified | 可以长期封存并恢复 |
| Production Migration Certified | 有真实端到端测试 |

这样不会因为某个服务“支持 Build”，就在 Migrate 中错误显示为完整支持。

---

# 十、Migrate 到底应该怎样分析？

建议形成明确的九阶段分析流程。

## 阶段 1：发现运行对象

扫描：

- systemd；
- process；
- Docker；
- Compose；
- port；
- cron/timer；
- reverse proxy；
- database；
- data path；
- domain；
- certificate。

输出原始 Evidence。

## 阶段 2：形成依赖图

建立关系：

```text
Nginx
  → proxies_to → Node App
Node App
  → reads → .env
  → writes → uploads
  → depends_on → PostgreSQL
PostgreSQL
  → stores → blog_production
```

## 阶段 3：聚合成 Workload

将依赖对象合并成：

```text
工作负载：个人博客
```

而不是单独展示每个软件。

## 阶段 4：分类内容

对每个文件、目录和服务分类：

- 可重建；
- 必须复制；
- 必须逻辑导出；
- Secret；
- 可忽略；
- 未知。

## 阶段 5：判断部署来源

识别：

- Git；
- Container；
- Package；
- Binary；
- 完整目录复制；
- 无法确定。

## 阶段 6：建立恢复模型

回答：

- 未来如何安装；
- 使用哪个版本；
- 需要哪些 artifact；
- 如何恢复数据；
- 如何提供 Secret；
- 如何启动；
- 如何验证。

## 阶段 7：建立目标兼容约束

即使当前还没有目标机器，也先记录最低要求和兼容边界。

## 阶段 8：计算迁移或封存就绪度

维度应包括：

```text
业务识别完整度
部署可重现性
数据发现完整度
数据一致性能力
Secret 可恢复性
外部依赖可用性
目标兼容性
验证覆盖
回滚能力
```

## 阶段 9：只让用户处理真正无法自动判断的事项

例如：

```text
/opt/blog/uploads 是否包含必须保留的用户文件？
SESSION_SECRET 未来希望怎样提供？
blog.example.com 是否仍会继续使用？
迁移后是否允许重新签发 TLS 证书？
```

不要问用户是否迁移 `postgresql-client`。

---

# 十一、建议形成三个不同的 Plan

不要让一个 Plan 同时承担所有场景。

## Build Plan

```text
目标机器
+ 软件与配置
+ Secret Requirements
+ 验证
```

不包含历史数据迁移和 Cutover。

## Live Migration Plan

```text
源机器
+ 目标机器
+ Workload Blueprints
+ Data Migration
+ Secret
+ Cutover
+ Verification
+ Rollback
```

## Capture Plan / Restore Plan

Capture Plan：

```text
源机器
+ 需要封存的工作负载
+ 数据一致性策略
+ 存档存储
+ 完整性验证
```

Restore Plan：

```text
可恢复环境
+ 新目标机器
+ 兼容转换
+ 部署
+ 数据恢复
+ Secret
+ 业务验证
```

它们可以共享同一个基础接口，但字段和 gate 不同。

---

# 十二、建议的第一个完整实现

现在最适合做的并不是继续扩大 Build 软件目录，也不是同时支持所有数据库。

建议先完整实现一个贯穿三种模式的黄金工作负载：

```text
Nginx
+ 自定义 Node.js/Python systemd 应用
+ PostgreSQL
+ 用户上传目录
+ .env Secret
+ 域名/TLS
+ cron/timer
```

它应同时支持：

### Build

从模板创建一个全新的相同架构网站。

### Live Migrate

从旧服务器迁移到同时存在的新服务器。

### Preserve & Restore

先封存旧服务器，删除服务器，未来再恢复。

完成这一场景后，EnvForge 才真正拥有一个可复用的核心迁移框架。

---

# 十三、最终产品结构建议

```text
Environment Project
├── 模式
│   ├── Build
│   ├── Live Migrate
│   └── Preserve & Restore
│
├── Workload Blueprints
├── Evidence / Inventory Graph
├── User Decisions
│
├── Plans
│   ├── Build Plan
│   ├── Migration Plan
│   ├── Capture Plan
│   └── Restore Plan
│
├── Runs
│   ├── Build Run
│   ├── Capture Run
│   ├── Restore Run
│   └── Cutover Run
│
└── Verification / Report
```

其中还需要一个独立页面：

```text
可恢复环境库
├── 个人博客生产环境
│   ├── 封存时间
│   ├── 数据大小
│   ├── 完整性状态
│   ├── 最近校验时间
│   ├── 恢复测试状态
│   ├── 兼容性要求
│   └── 创建恢复项目
```

# 核心结论

你的范围应该这样收敛：

- **Build：广而全。**解决新软件和新环境的安装、配置与验证，不负责历史状态。
- **Live Migrate：少而深。**必须完整理解业务、数据、Secret、依赖、Cutover、验证与回滚。
- **Preserve & Restore：最强调完整性。**它允许用户暂时没有服务器，因此必须解决长期存储、数据一致性、恢复材料、兼容性边界、密钥管理和恢复演练。

EnvForge 不应该把“服务器里有哪些软件”存下来，而应该把下面四件事一起保存：

> **业务是什么、如何部署、状态在哪里、如何证明恢复成功。**

只有这四部分都完整，用户才可以安全地释放旧服务器，并在未来的一台新机器上把业务真正恢复回来。

## Prompt:
2026/7/18 14:41:24

你说的很对，具体该怎么做呢？我将需要你综合以上给一个系统的方案，但是在这之前，请你给我一个prompt了解当前项目的近况（本地）以及一些实际的功能实现情况给出来，让他输出，我将将这个实际情况给你，然后由你规划。另外请注意迁移不仅仅是迁移软件和数据，还有正在运行的服务状态等等

## Response:
2026/7/18 14:41:31

我会把这个 prompt 设计成一次“本地现状取证”，不是让 agent 继续开发。它需要同时核对代码、测试、数据库/存储结构、前端流程和真实执行路径，并专门审计进程状态、服务启动方式、运行依赖、临时状态和恢复能力。

下面这份 prompt 只做**现状审计和取证**，不允许 agent 顺手继续开发，也不允许根据字段名或旧报告判断“已完成”。它会重点区分 Build、在线迁移、离线封存恢复，并单独审计服务运行状态、数据一致性和恢复能力。此前记录里已经出现过“代码或测试存在，但真实闭环未完成”的情况，因此这次要求按代码、集成测试和本地实际运行三个证据等级输出。`ChatGPT-EnvForge 2.json`

**document: **

你现在位于 EnvForge 项目的本地代码仓库中。

本次任务不是继续开发功能，而是对当前本地项目进行一次完整、可复核的“现状取证审计”，为下一阶段产品架构规划提供真实依据。

请不要根据旧审计报告、README、TODO、类型定义、UI 文案或历史对话直接判断功能已完成。必须检查当前本地代码、真实调用路径、测试和在安全条件下可执行的本地运行结果。

本次审计尤其需要回答：

1. 当前 Build 到底已经能够完成什么？
2. 当前 Migrate 到底已经能够完成什么？
3. 当前系统是否已经能识别一个完整业务，而不只是识别软件包？
4. 当前是否真正迁移配置、数据、Secret、服务状态和运行依赖？
5. 当前 Plan、Run、Apply、Verify、Rollback 是否形成真实闭环？
6. 当前是否支持只有源服务器、暂时没有目标服务器的“封存后恢复”场景？
7. 当前采集的“服务状态”具体包含什么？
8. 哪些功能只是模型、字段、UI 或测试桩，哪些已经本地实际运行证明？
9. 当前代码距离以下三种产品模式分别还有多远：
   - Build：创建全新环境；
   - Live Migrate：源机和目标机同时在线迁移；
   - Preserve & Restore：先封存源机，未来再恢复到新机器。

---

# 一、审计约束

## 1. 本轮禁止事项

本轮不要实现新功能。

禁止：

- 重构代码；
- 修复发现的问题；
- 修改数据库 schema；
- 修改前端流程；
- 修改测试以让失败测试通过；
- 新增假的 mock 证明功能存在；
- 执行真实服务器迁移；
- 对外部服务器执行写操作；
- 删除、reset、stash 或覆盖当前工作树；
- 提交或 push 代码；
- 输出任何 Secret、密码、Token、私钥或完整凭据；
- 把 TODO、接口、类型、schema、按钮、静态页面当成完整实现；
- 把 unit test 当成真实迁移证明；
- 把 dry-run 当成实际 Apply；
- 把“可以生成计划”当成“可以完成迁移”；
- 把“采集到服务 active”当成“可以恢复服务运行状态”。

只允许：

- 读取代码；
- 搜索调用关系；
- 运行已有类型检查和测试；
- 启动已有本地开发环境；
- 使用项目已有 fixture、demo、smoke、harness；
- 调用只读 API；
- 在不会修改外部系统的前提下运行本地流程；
- 生成本次审计报告文件。

如果某个测试或启动命令可能修改真实数据、连接真实服务器或触发 Apply，先不要运行，并在报告中说明原因。

## 2. 保护当前工作树

开始前运行：

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git log --oneline -15
git diff --stat
```

记录：

- 当前分支；
- 当前 commit；
- 未提交文件；
- 哪些修改不是本次审计产生的；
- 是否存在未跟踪文件；
- 是否存在本地配置可能影响测试结果。

不得清理或修改这些文件。

## 3. 证据等级

每个功能必须标记一个实现成熟度：

| 等级 | 含义 |
|---|---|
| M0 | 没有找到 |
| M1 | 只有类型、schema、字段、文档、UI 壳或 TODO |
| M2 | 有真实逻辑，但未连接完整调用链 |
| M3 | 已连接调用链，并有单元或集成测试 |
| M4 | 可通过本地 UI/API 完成完整流程 |
| M5 | 有 disposable target、live harness 或真实端到端迁移证明 |

任何 M1 都不能称为“已实现”。

任何 M2 都必须说明链路断在哪里。

任何 M3 都必须说明测试是否 mock 了核心执行器。

任何 M4 都必须给出实际操作步骤和结果。

任何 M5 都必须给出 harness、fixture、执行日志和验证结果。

功能状态只能使用：

- PASS
- PARTIAL
- FAIL
- NOT FOUND
- NOT APPLICABLE

---

# 二、仓库和架构基线

先梳理当前项目结构。

至少检查：

- package.json / workspace 配置；
- apps/api；
- apps/web；
- shared packages；
- collector；
- inventory graph；
- confidence/decision engine；
- plan；
- artifact；
- executor；
- task queue / worker；
- runtime store；
- audit/report；
- capability SDK/catalog；
- tests；
- fixtures；
- harness；
- generated artifacts；
- database migrations；
- Docker Compose 或本地基础设施。

输出：

```text
当前技术栈：
API 框架：
Web 框架：
数据库：
任务队列：
对象存储：
实时进度机制：
认证方式：
测试框架：
本地启动方式：
```

绘制当前真实调用关系：

```text
Web
→ API Route
→ Domain Service
→ Repository/Store
→ Plan/Artifact
→ Queue/Executor
→ Remote Action
→ Verify
→ Report/Audit
```

如果某一层不存在，明确标记。

特别检查是否仍然存在超大型单体 routes 文件，以及此前规划的 routes 拆分是否实际完成。

---

# 三、核心领域对象现状

查找并列出当前项目真实存在的核心对象。

至少检查：

- Project；
- Migration Project；
- Build Project；
- Environment Plan；
- Draft Plan；
- Approved Plan；
- Plan Version；
- Artifact；
- Execution Run；
- Apply Run；
- Verification Run；
- Rollback Run；
- Snapshot；
- Inventory Graph；
- Service Stack；
- Workload；
- Workload Blueprint；
- Dataset；
- SecretRef；
- Secret Requirement；
- Transfer Session；
- Checkpoint；
- Cutover；
- Report；
- Audit Event；
- Capability；
- Capture Archive；
- Restore Plan。

对每个对象输出：

| 对象 | 是否存在 | 成熟度 | 主要字段 | 持久化位置 | 真实使用位置 | 缺口 |
|---|---|---|---|---|---|---|

必须回答：

1. Build 和 Migrate 当前是否使用同一种 Plan？
2. Build 和 Migrate 后续是否共用同一 Apply/Verify/Report 执行链？
3. 是否存在 Project 层，还是用户直接操作 Plan？
4. Plan 是否支持版本？
5. Approved Plan 是否不可变？
6. 目标机变化后是否会生成新 Plan？
7. Run 是否与 Plan 分离？
8. Run 的状态是否持久化？
9. 浏览器刷新或 API 重启后，Run 是否还能恢复？
10. Report 是否引用准确的 Plan、Artifact 和 Run？

---

# 四、Build 当前真实能力审计

Build 的定义：

> 用户选择新的软件、服务或模板，在目标机器上创建一个没有历史业务状态的新环境。

请追踪至少一条 Build 的完整路径：

```text
Web 入口
→ API
→ Build 输入
→ Plan 生成
→ Review/Approval
→ Apply
→ Verify
→ Report
```

检查：

## 1. 输入能力

当前 Build 支持哪些输入？

- 软件目录；
- Capability Catalog；
- Recipe；
- YAML；
- 模板；
- 用户自定义配置；
- Docker Compose；
- 自定义 systemd 服务；
- 源码仓库；
- Secret；
- 目标机参数。

## 2. 输出能力

Build 是否生成：

- Draft Plan；
- 不可变 Approved Plan；
- 安装包动作；
- 配置动作；
- 用户/组动作；
- systemd 动作；
- Docker/Compose 动作；
- 防火墙动作；
- TLS 动作；
- Secret Requirement；
- Verify 动作；
- Rollback 动作。

## 3. 实际执行能力

选择至少一个已有官方 Capability，例如 Nginx、PostgreSQL 或 Docker Compose，判断：

- 是否只生成 catalog preview；
- 是否只生成计划；
- 是否能够真实 Apply；
- Apply 是否执行真实结构化 Action；
- 是否需要目标机；
- 是否有 disposable target harness；
- 是否有业务验证；
- 是否有真实 rollback。

输出 Build 支持矩阵：

| Capability/场景 | Detect | Plan | Apply | Verify | Rollback | Live Proven | 成熟度 |
|---|---|---|---|---|---|---|---|

---

# 五、Migrate 当前真实能力审计

Migrate 的定义：

> 理解源服务器上已有的业务、服务、配置、数据和运行依赖，并在目标机器上重建和迁移。

不要只审计软件包。

## 1. 源机器分析流程

追踪：

```text
连接源机器
→ Collector
→ Snapshot
→ Inventory Graph
→ Service Stack / Workload
→ User Decisions
→ Target Analysis
→ Migration Plan
```

明确当前是否真正产生：

- 原始 Evidence；
- Candidate；
- Decision；
- Plan。

检查是否仍然将以下对象直接作为用户主要审批项：

- 单个包；
- 单个端口；
- 单个配置文件；
- 单个证书；
- 原始进程；
- 原始扫描证据。

## 2. 工作负载识别

检查当前是否存在真正的 Workload 或 Service Stack 聚合。

至少验证以下场景是否能被聚合：

```text
Nginx
→ reverse proxy
→ Node/Python application
→ PostgreSQL
→ uploads directory
→ .env Secret
→ domain/TLS
→ cron/timer
```

必须给出当前代码能够识别的关系：

- service → package；
- service → config；
- service → port；
- service → process；
- service → env file；
- service → data path；
- service → secret；
- reverse proxy → upstream；
- application → database；
- container → volume；
- workload → domain；
- workload → certificate；
- service → scheduled task；
- service → user/group。

对每种关系输出：

| 关系 | 当前能否提取 | 提取器 | 数据来源 | 测试 | 是否参与计划 |
|---|---|---|---|---|---|

特别回答：

1. 是否可以把一个个人网站识别为一个业务工作负载？
2. 是否仍然只是将 Nginx、Node.js、PostgreSQL 分别列出？
3. 是否能够识别自定义 systemd 应用？
4. 是否能够判断代码目录、数据目录、缓存目录和日志目录？
5. 是否能够识别应用的部署来源：Git、Package、Container、Binary 或目录复制？
6. 是否能够生成未来的自动部署方法？
7. 如果无法识别，当前是否会要求用户补充信息？

---

# 六、正在运行的服务状态审计

迁移不仅包含软件和数据，还包含“服务如何运行”和“迁移时正在发生什么”。

请不要把 PID 或 active 状态简单理解为可迁移状态。

将服务状态分为四类审计。

## A. 可重建的期望状态

检查是否采集：

- service enabled/disabled；
- active/inactive/failed；
- systemd load state；
- systemd substate；
- unit file；
- drop-in；
- ExecStart / ExecStartPre / ExecStop；
- WorkingDirectory；
- User / Group；
- Environment；
- EnvironmentFile；
- Restart policy；
- RestartSec；
- dependencies；
- Wants/Requires/After/Before；
- resource limits；
- cgroup；
- capability/security settings；
- socket activation；
- timer activation；
- autostart configuration；
- container restart policy；
- healthcheck；
- Compose depends_on；
- mounted volumes；
- network membership。

判断这些状态是否最终进入 Workload 和 Plan。

## B. 持久业务状态

检查是否识别：

- 数据库；
- 文件数据；
- Docker volume；
- 上传目录；
- 消息队列持久化数据；
- Git repository；
- 对象存储；
- SQLite；
- application state directory；
- spool；
- durable sessions；
- timer/cron 的持久状态。

判断是否有真实迁移策略。

## C. 临时运行状态

检查是否采集或处理：

- PID；
- process tree；
- 当前命令行；
- 内存缓存；
- 当前 TCP 连接；
- 正在处理的 HTTP 请求；
- 数据库活动事务；
- 文件锁；
- leader election；
- in-memory session；
- 未持久化队列；
- 当前 worker job；
- 临时文件；
- 当前定时任务执行；
- container transient runtime state。

必须明确：

- 哪些状态可以重建；
- 哪些状态必须 drain；
- 哪些状态必须 quiesce；
- 哪些状态不能迁移；
- 哪些状态会丢失；
- 当前系统是否向用户解释这些限制。

## D. 服务生命周期和切换状态

检查当前是否支持：

- source drain；
- maintenance mode；
- stop accepting writes；
- stop service；
- final sync；
- start target；
- health gate；
- traffic switch；
- observation window；
- source resume；
- rollback。

输出服务状态覆盖矩阵：

| 状态类型 | 当前采集 | 当前建模 | 当前参与 Plan | 当前可恢复 | 缺口 |
|---|---|---|---|---|---|

并给出结论：

```text
当前系统迁移的主要是：
- 软件定义；
- 配置；
- 持久数据；
- 服务期望状态；
- 临时运行状态；
- 或以上哪些组合。
```

---

# 七、数据迁移真实能力

不要只检查是否存在 `DataMigrationStrategy` 枚举。

检查以下策略是否存在真实执行路径：

- none；
- recreate；
- logical dump/restore；
- official backup/restore；
- quiesced rsync；
- snapshot/volume；
- replication；
- manual；
- blocked。

至少深度审计：

## PostgreSQL

检查真实路径是否包含：

- detect server/client；
- version；
- database list；
- roles；
- grants；
- extensions；
- encoding/locale；
- tablespaces；
- data size；
- active connections；
- dump；
- artifact storage；
- transfer；
- restore；
- verification；
- cleanup；
- rollback classification；
- report。

明确是否真实执行：

- pg_dump；
- pg_dumpall；
- pg_restore；
- psql；
- SELECT 1；
- table count；
- row count；
- extension check。

## 文件数据集

检查：

- 数据目录识别；
- include/exclude；
- symlink；
- owner/mode；
- xattr/ACL；
- sparse file；
- large file；
- checksum；
- rsync；
- partial transfer；
- final sync；
- conflict；
- verification。

## Docker Volume

检查：

- volume discovery；
- ownership；
- driver；
- container mapping；
- backup；
- transfer；
- restore；
- target conflict；
- verification。

输出：

| 数据类型 | Detect | Plan | Execute | Resume | Verify | Rollback | Live Proven |
|---|---|---|---|---|---|---|---|

特别回答：

1. 当前是否只让用户选择策略，但没有执行器？
2. 当前是否能估算数据量？
3. 当前是否能估算停机窗口？
4. 当前是否能发现写入进程？
5. 当前是否支持 initial sync + final sync？
6. 当前是否支持一致性冻结？
7. 当前是否验证源目标数据一致？
8. 当前中断后如何恢复？

---

# 八、Secret 当前交付流程

检查当前是否只有 SecretRef，还是存在完整交付链。

追踪：

```text
发现 Secret 引用
→ 不保存明文
→ 生成 Secret Requirement
→ 用户选择 Provider
→ Apply 前检查
→ 执行时获取
→ 注入目标
→ 服务验证
→ 清理临时材料
→ Report 只记录策略
```

检查 Provider：

- user-input；
- Vault；
- SOPS；
- target-existing；
- regenerate；
- rotate；
- skip；
- out-of-band。

输出：

| 环节 | 当前实现 | 代码证据 | 测试 | 缺口 |
|---|---|---|---|---|

检查：

- Snapshot 是否可能保存 Secret 明文；
- Plan artifact 是否保存 Secret 明文；
- 日志是否 redaction；
- Report 是否泄露；
- 浏览器/API 是否会重复返回；
- 临时文件是否清理；
- Secret 缺失是否阻止启动；
- Secret 是否能在恢复数月后重新提供。

---

# 九、目标机兼容性和冲突

检查目标机什么时候进入当前流程。

明确：

- 创建项目时；
- 扫描之后；
- Plan 之前；
- Apply 之前；
- 或只有 Dry-run 时。

检查兼容性覆盖：

- OS/distro；
- CPU architecture；
- package manager；
- systemd；
- kernel；
- libc；
- disk；
- memory；
- filesystem；
- port；
- user/group；
- path；
- service name；
- database version；
- Docker；
- security module；
- firewall；
- certificate；
- domain；
- external dependency。

检查输出是否支持：

- compatible；
- warning；
- requires conversion；
- requires manual；
- blocked。

检查目标机 Snapshot 变化后：

- 是否使旧 Plan 失效；
- 是否重新计算冲突；
- 是否生成新 Plan 版本；
- 是否需要重新批准。

---

# 十、Cutover 当前能力

搜索：

```text
cutover
quiesce
drain
maintenance
freeze
final sync
traffic switch
dns
load balancer
floating ip
observation
commit migration
rollback deadline
```

检查是否存在正式 Cutover 对象或状态机。

当前是否支持：

1. 目标机预部署；
2. 初始数据同步；
3. 预切换验证；
4. 等待维护窗口；
5. 源端停止写入；
6. 最终同步；
7. 启动目标业务；
8. DNS/IP/代理切换；
9. 业务验证；
10. 观察窗口；
11. 提交迁移；
12. 恢复源端。

如果只有普通 Action，请判断它们是否形成可恢复的 Cutover 编排。

输出：

| Cutover 阶段 | 当前实现 | 成熟度 | 证据 | 缺口 |
|---|---|---|---|---|

---

# 十一、验证和回滚

检查当前 Verification 是否覆盖：

- artifact/config；
- syntax；
- process/service；
- network；
- TLS；
- data；
- dependency；
- synthetic business transaction。

至少检查：

- nginx -t；
- systemctl is-active；
- docker health；
- curl；
- TLS；
- database connection；
- SELECT 1；
- table/row verification；
- user-defined HTTP check；
- write/read/delete transaction。

判断：

1. 当前验证是否只证明服务启动？
2. 是否能证明业务真实可用？
3. 用户是否能定义“迁移成功条件”？
4. 验证失败是否自动阻止 commit？
5. 验证失败是否触发 rollback 建议？
6. rollback 是否区分 full/partial/manual/none/dangerous？
7. 数据切换后产生的新写入如何处理？
8. 当前 rollback 是否只是反向执行命令？

---

# 十二、执行进度、检查点和断点续传

检查：

- task queue；
- worker；
- run journal；
- progress event；
- WebSocket/SSE/polling；
- idempotency；
- retry；
- timeout；
- cancel；
- checkpoint；
- resume；
- transfer manifest；
- checksum；
- chunk；
- bandwidth limit；
- browser reconnect；
- API restart recovery；
- worker crash recovery。

选择一条实际执行链回答：

```text
Plan 已批准
→ Apply API
→ claim
→ Run 创建
→ Action 执行
→ 状态持久化
→ 进度发布
→ 失败
→ 重试或恢复
→ Verify
→ Report
```

输出：

| 能力 | 当前实现 | 是否持久化 | 重启后是否恢复 | 测试 | 成熟度 |
|---|---|---|---|---|---|

必须区分：

- byte-resumable；
- step-resumable；
- restart-required；
- manual。

不要笼统声称“支持断点续传”。

---

# 十三、只有源服务器的封存恢复场景

审计当前项目是否已经存在以下概念或近似能力：

- Capture Plan；
- Environment Archive；
- Environment Capsule；
- Recovery Bundle；
- Backup Artifact；
- Object Storage；
- Dataset Manifest；
- Restore Plan；
- Retention；
- Integrity Scrub；
- Restore Drill；
- Archive Encryption；
- User Export；
- Archive Delete；
- Compatibility Envelope。

检查当前是否能完成：

```text
源机器
→ 分析所有业务
→ 生成封存计划
→ 一致性采集数据
→ 保存部署材料
→ 保存配置
→ 保存恢复所需元数据
→ 保存验证合同
→ 上传到长期存储
→ 完整性校验
→ 释放旧服务器
```

未来：

```text
选择环境存档
→ 连接新目标机
→ 重新计算兼容性
→ 生成 Restore Plan
→ 恢复服务和数据
→ 注入 Secret
→ 验证业务
```

必须回答：

1. 当前系统是否支持源机没有同时存在的目标机？
2. 当前 Snapshot 能否长期作为恢复材料？
3. 当前 Artifact 是否只适合短期 Apply？
4. 当前是否保存实际数据，还是只保存元数据？
5. 当前是否有对象存储？
6. 当前是否有加密、校验、保留和删除机制？
7. 当前是否能证明存档未来可恢复？
8. 当前是否有 restore drill？
9. 当前是否记录兼容性边界？
10. 当前是否能阻止用户在存档不完整时释放旧服务器？

---

# 十四、前端真实流程

启动本地 Web/API，如果安全且可行。

记录实际页面、路由和操作流程。

至少检查：

- Dashboard；
- Build；
- Migrate；
- Scan；
- Selection；
- Unknown Items；
- Config/Data；
- Target/Dry-run；
- Plan；
- Apply；
- Verify；
- Report；
- Capability；
- Archive/Restore（如果存在）。

必须输出：

```text
Build 当前实际步骤：
Migrate 当前实际步骤：
Plan 当前承担的职责：
Run 当前展示方式：
目标机首次出现位置：
数据策略出现位置：
Secret 处理位置：
Cutover 是否有页面：
业务验证是否有页面：
封存恢复是否有入口：
```

判断 UI 中是否存在：

- 后端没有能力的按钮；
- 只有静态数据的页面；
- 使用 mock 的页面；
- 显示“完成”但没有真实执行；
- 仍然让用户审批单个技术对象；
- percentage 没有行动解释；
- Build/Migrate/Plan 概念混乱。

如果有已有 E2E 或 smoke 测试，运行并说明它验证了什么、没有验证什么。

---

# 十五、测试与本地实际验证

根据项目实际 package manager 运行适用命令。

先检查 package.json scripts，再执行等价命令。

至少尝试：

```bash
npm run typecheck
npm test
npm run test:api
npm run test:web
npm run build
```

如果使用 pnpm、yarn 或 bun，改用实际命令。

额外检查并运行存在的：

```text
collector tests
inventory graph tests
service stack tests
decision engine tests
plan lifecycle tests
artifact tamper tests
apply gate tests
data migration tests
transfer tests
checkpoint/resume tests
verification tests
rollback tests
capability tests
golden fixture
smoke tests
E2E tests
live harness
disposable target lab
```

对每种测试输出：

| 测试类型 | 命令 | 通过/失败 | 是否 mock 核心执行 | 实际证明了什么 | 没证明什么 |
|---|---|---|---|---|---|

如果全量测试很多，只记录测试数量、失败数量和关键失败，不要粘贴全部日志。

任何失败都必须保留，不要修复。

---

# 十六、必须追踪的端到端调用链

至少完成下面五条调用链审计。

## 链路 A：Build

```text
创建 Build
→ 选择 Capability
→ 生成 Plan
→ Approve
→ Apply
→ Verify
→ Report
```

## 链路 B：普通软件迁移

```text
扫描源机器
→ 发现 package/service
→ 用户选择
→ 生成 Migration Plan
→ 在目标机安装
→ Verify
```

## 链路 C：自部署个人网站

```text
Nginx
→ 自定义 systemd 应用
→ 应用目录
→ .env
→ PostgreSQL
→ uploads
→ domain/TLS
→ cron
→ Workload
→ Plan
```

判断当前链路在哪里断开。

## 链路 D：PostgreSQL 数据迁移

```text
detect
→ plan
→ dump
→ store/transfer
→ restore
→ verify data
→ report
```

## 链路 E：服务运行状态

```text
source active service
→ capture desired state
→ quiesce/drain
→ preserve durable state
→ recreate target service
→ start
→ verify
→ traffic switch
```

对每条链路输出：

| 阶段 | 入口 | 核心函数 | 持久化 | 测试 | 实际运行 | 状态 |
|---|---|---|---|---|---|---|

---

# 十七、当前实现能力矩阵

最终输出三张矩阵。

## A. Build

| 功能 | 状态 | 成熟度 | 代码证据 | 测试证据 | 本地实际证据 | 主要缺口 |
|---|---|---|---|---|---|---|

## B. Live Migrate

至少包含：

- 源扫描；
- 目标扫描；
- 服务识别；
- 自定义应用；
- 工作负载聚合；
- 配置；
- 数据；
- Secret；
- 服务状态；
- initial sync；
- final sync；
- Cutover；
- 业务验证；
- rollback；
- progress/resume；
- Report。

## C. Preserve & Restore

至少包含：

- Capture Plan；
- 部署材料；
- 长期数据存储；
- Secret 恢复策略；
- 数据一致性；
- manifest/hash；
- encryption；
- retention；
- integrity scrub；
- compatibility envelope；
- Restore Plan；
- restore drill；
- 释放源服务器门禁。

---

# 十八、输出最严重问题 Top 20

每项包含：

- 标题；
- 严重级别：Critical / High / Medium / Low；
- 所属模式：Build / Live Migrate / Preserve & Restore / Shared；
- 当前事实；
- 代码证据；
- 用户影响；
- 是否会造成数据丢失；
- 是否会造成服务无法恢复；
- 是否会造成“假完成”；
- 建议方向，但不要修改代码。

优先识别：

- 只迁软件、不迁业务；
- 数据迁移没有执行；
- 不能识别自定义应用；
- 临时运行状态没有处理；
- 服务启停顺序丢失；
- active 状态被误当作可迁移状态；
- 目标机出现过晚；
- 没有 Cutover；
- 没有业务验证；
- 没有持久 Run；
- 中断后无法恢复；
- Secret 无交付；
- 存档无法证明可恢复；
- UI 声称完成但后端没有闭环。

---

# 十九、最终结论必须回答

请明确回答以下问题，不要使用模糊表述。

1. 当前 Build 可以用于什么真实场景？
2. 当前 Build 不能用于什么场景？
3. 当前 Migrate 实际迁移了什么？
4. 当前 Migrate 没有迁移什么？
5. 当前能否完整迁移一个自部署个人网站？
6. 当前能否迁移 PostgreSQL 真实数据？
7. 当前能否恢复 systemd 服务的期望运行状态？
8. 当前能否迁移正在运行的瞬时状态？
9. 哪些瞬时状态原则上不应该直接迁移，而应通过 drain/quiesce/restart 处理？
10. 当前能否完成真实 Cutover？
11. 当前能否证明迁移后业务可用？
12. 当前能否在浏览器关闭、SSH 中断或 worker 重启后继续任务？
13. 当前能否让用户先封存服务器、释放旧机器、未来恢复？
14. 当前最接近完整闭环的黄金场景是什么？
15. 当前最应该暂停开发的功能是什么？
16. 当前下一阶段规划前还缺哪些事实？

---

# 二十、严格输出格式

请生成：

```text
docs/audits/envforge-local-current-state-audit-2026-07-18.md
```

如果目录不存在，可以只创建审计目录和报告文件，不要修改产品代码。

同时在终端回复中完整输出以下精简摘要，便于直接复制给另一个规划 agent。

# EnvForge 本地现状取证报告

## 0. 审计环境

- 分支：
- Commit：
- 工作树状态：
- Node/package manager：
- 数据库/外部依赖：
- 可以运行的本地环境：
- 无法运行的部分：

## 1. 一句话结论

用一句话描述 EnvForge 当前到底是什么产品。

## 2. 三种模式成熟度

| 模式 | 当前成熟度 | 当前真实可做 | 最关键断点 |
|---|---|---|---|
| Build | | | |
| Live Migrate | | | |
| Preserve & Restore | | | |

## 3. 当前真实实现

只写有代码和测试证据的能力。

## 4. 当前只有模型/UI/测试桩的能力

明确列出假完成风险。

## 5. 当前服务状态覆盖

- 可重建期望状态：
- 持久业务状态：
- 临时运行状态：
- drain/quiesce/cutover：
- 当前缺口：

## 6. 当前数据迁移能力

- PostgreSQL：
- 文件数据：
- Docker Volume：
- 一致性：
- 断点续传：
- 数据验证：

## 7. 当前工作负载识别能力

- 已支持节点：
- 已支持关系：
- 是否能识别个人网站：
- 是否能识别自定义应用：
- 是否能生成自动部署方法：
- 当前断点：

## 8. Plan 与执行链

- Build/Migrate 是否统一：
- Plan 是否不可变：
- Plan 是否版本化：
- Run 是否分离：
- Run 是否持久：
- Apply 是否真实：
- Verify 是否业务级：
- Rollback 是否真实：

## 9. 封存恢复能力

- 是否存在：
- 当前可复用基础：
- 缺失对象：
- 是否可以安全释放源服务器：
- 最大风险：

## 10. Top 20 问题

按严重级别排序。

## 11. 测试结果

- Typecheck：
- Unit：
- API：
- Web：
- E2E：
- Harness：
- 总通过：
- 总失败：
- 没有被测试证明的核心路径：

## 12. 端到端链路断点

- Build：
- 普通迁移：
- 个人网站：
- PostgreSQL：
- 服务运行状态：
- Preserve & Restore：

## 13. 可直接用于后续规划的事实清单

只写事实，不写愿景。

## 14. 审计可信度

- 高可信结论：
- 中可信结论：
- 未能验证：
- 验证受限原因：

## 15. 最终判断

只能选择一个：

- 当前主要是设计/评估原型；
- 当前是可执行的 Build 产品；
- 当前是有限场景的迁移产品；
- 当前是可用于生产的迁移产品；
- 当前已支持可靠封存恢复。

说明理由。

---

# 二十一、反假完成要求

最终提交报告前，再检查一次：

1. 每个 PASS 是否有代码证据？
2. 每个 M4 是否真的从本地 UI/API 运行？
3. 每个 M5 是否有 live harness？
4. 是否把 schema 当成功能？
5. 是否把 unit test 当成端到端？
6. 是否把服务 active 当成服务状态迁移？
7. 是否忽略了数据一致性？
8. 是否忽略了临时运行状态？
9. 是否忽略了 Cutover？
10. 是否忽略了浏览器关闭和 worker 重启？
11. 是否忽略了源服务器释放后的不可逆风险？
12. 是否输出了任何 Secret？
13. 是否修改了产品代码？
14. 是否对无法验证的功能明确标记 NOT FOUND 或 PARTIAL？

最后运行：

```bash
git status --short
git diff --stat
git diff --check
```

确认除审计报告外，没有产生任何项目代码修改。

不要 commit，不要 push。

最终回复必须包含：

- 审计报告路径；
- 当前 commit；
- 测试结果；
- 三种模式成熟度；
- Top 10 问题；
- 最终判断；
- 无法验证的部分。

把 agent 返回的**精简摘要、三张能力矩阵、Top 20 问题和端到端链路断点**发给我即可；测试失败日志只需保留关键部分，不必粘贴全部。

## Prompt:
2026/7/18 17:03:36

请你综合当前项目情况和我刚刚的想法与你的意见进行汇总分析，你需要做的就是汇总分析我的功能需求设计等等有哪些方面的问题和设计需要确定，是一个大的方面，包含上面每一个点的实现，我一会会基于这个汇总与你进行更细致的对话讨论确定该怎么做
# EnvForge 本地现状取证报告

完整报告：[envforge-local-current-state-audit-2026-07-18.md](</E:/1project/EnvForge/docs/audits/envforge-local-current-state-audit-2026-07-18.md>)

## 0. 审计环境

- 分支：`main`
- Commit：`a77f597b6f23a8d05d8186ad18ddf7b8a8f9190f`
- 工作树状态：无 tracked 修改；保留既有 `docs/audit-report-2026-07-08.md`，本轮仅新增审计报告
- Node/package manager：Node `v20.13.1`、npm `10.5.2`
- 数据库/外部依赖：本地 SQLite；外部 SSH、数据库和对象存储均未连接
- 可以运行的本地环境：typecheck、build、API 全量测试、专项测试、golden fixture、只读 API
- 无法运行的部分：Playwright Chromium 缺失；dry-run harness 在 clean store 初始化时失败；live harness、真实 Apply 和外部迁移按安全边界未执行

## 1. 一句话结论

EnvForge 当前是一个具备真实采集、审批、哈希保护和有限 SSH 软件动作执行链的环境盘点/重建系统，但还不是能够迁移完整业务、数据、Secret、Cutover 或长期存档的生产迁移平台。

## 2. 三种模式成熟度

| 模式 | 当前成熟度 | 当前真实可做 | 最关键断点 |
|---|---|---|---|
| Build | PARTIAL，M3 | certified catalog → frozen Plan → approval → 有限包/服务/配置动作 | 无当前 live target 证明；验证和回滚不可靠 |
| Live Migrate | PARTIAL，M2–M3 | 源扫描、Snapshot、Candidate、Decision、有限软件重建 Plan | Planner 不消费 Graph/ServiceStack；配置、数据、Secret、Cutover 不闭环 |
| Preserve & Restore | FAIL，M1；可靠恢复为 M0 | 保存 metadata snapshot、生成 plan-only RestorePlan | 不保存真实数据/部署材料，无对象存储、加密、scrub 或 Restore Apply |

## 3. 当前真实实现

- SSH collector 生产路径、Snapshot 持久化及 collector completeness。
- Process、DataPath、EnvFile、SecretRef、Volume、Network、Certificate、Domain、UserGroup、ScheduledTask surfaces。
- InventoryGraph、ServiceStack 聚合和生产只读路由。
- Build/Migrate 共用的 Environment Plan。
- planHash、artifactHash、approval binding 和 legacy mutation 410 边界。
- 持久 ApplyRun/ActionRun、幂等记录及有限 package/service/config adapter。
- 独立 Verify、Rollback 和动态 Plan Report 路由。
- PostgreSQL non-executing dry-run evidence。
- 本地 API health/ready/catalog：`200/200/200`，catalog 105 项；SQLite 重启后仍 ready。

## 4. 当前只有模型/UI/测试桩的能力

- Project、PlanVersion、Workload、Workload Blueprint、Dataset。
- Secret Requirement、Provider、交付和注入。
- Transfer Session、Checkpoint、byte/step resume。
- Cutover、drain、quiesce、initial/final sync、traffic switch。
- Capture Archive、长期对象存储、Restore Drill。
- PostgreSQL dump/transfer/restore。
- Docker Volume 和文件数据迁移。
- 多个 Graph/ServiceStack 测试手工注入了 live collector 不会产生的关联字段。
- Migrate 页面“Apply”实际只创建 Plan；多目标 recipe “Apply reviewed”也只创建未审批 Plan。

## 5. 当前服务状态覆盖

- 可重建期望状态：仅 running/enabled unit 名、少量 WorkingDirectory/ExecStart 派生路径和 catalog restart 命令。
- 持久业务状态：仅 DataPath、粗略 size 和 Volume metadata，不保存数据字节。
- 临时运行状态：PID、user、CPU/MEM、executable token；不处理连接、事务、锁、内存 session/cache 或 active job。
- drain/quiesce/cutover：NOT FOUND。
- 当前缺口：完整 unit/drop-in、User/Group、EnvironmentFile 归属、Restart policy、依赖顺序、container health/restart/volume/network 关系均不能可靠恢复。

## 6. 当前数据迁移能力

- PostgreSQL：只有 `executionBlocked=true` 的结构化 dry-run；无真实 pg 工具、连接、传输或数据验证。
- 文件数据：只识别部分目录和粗略大小；无 rsync、checksum、ACL/xattr、partial/final sync。
- Docker Volume：只有有限 metadata；无备份、传输或恢复。
- 一致性：无 quiesce、snapshot consistency point 或写入进程 gate。
- 断点续传：无。
- 数据验证：无 table/row/extension 或源目标 checksum 验证。

## 7. 当前工作负载识别能力

- 已支持节点：package、service、port、process、container、configFile 及十类扩展 surface。
- 已支持关系：部分 service/package/process/data path、env/secret、container/volume/network、domain/certificate、scheduled task 关系。
- 是否能识别个人网站：不能识别为单一完整业务。
- 是否能识别自定义应用：只能获得零散 systemd/process/path evidence。
- 是否能生成自动部署方法：不能。
- 当前断点：缺少 reverse proxy→upstream、application→database 和 Workload 对象；Graph/ServiceStack 不进入 Migration Plan。

## 8. Plan 与执行链

- Build/Migrate 是否统一：是，promotion 后统一为 Environment Plan。
- Plan 是否不可变：是，M3。
- Plan 是否版本化：否。
- Run 是否分离：ApplyRun 分离；Verify/Rollback 无独立 Run。
- Run 是否持久：终态持久；active execution 不可恢复。
- Apply 是否真实：存在真实 SSH adapter 路径，但本轮无 M4/M5 live 证明。
- Verify 是否业务级：否。
- Rollback 是否真实：只有有限反向动作，存在误删原有包和假 `rolled-back` 风险。

## 9. 封存恢复能力

- 是否存在：可靠 Preserve & Restore 不存在。
- 当前可复用基础：metadata Snapshot、redaction、纯函数 RestorePlan、本地 artifact hash。
- 缺失对象：Capture Plan、Archive、Dataset Manifest、object storage、retention、scrub、compatibility envelope、Restore Run。
- 是否可以安全释放源服务器：不可以。
- 最大风险：Snapshot 不包含真实配置和数据，释放源机可能造成永久数据丢失。

## 10. Top 10 问题

1. **Critical**：Migration planner 不消费 InventoryGraph/ServiceStack。
2. **Critical**：数据策略只记录决策，没有任何数据执行器。
3. **Critical**：migration config action 缺少 path/content/artifact，真实 Apply 不闭环。
4. **Critical**：没有 Cutover、drain、quiesce 或 final sync。
5. **Critical**：Preserve Snapshot 只有 metadata，不能作为恢复材料。
6. **Critical**：imported recipe 的 verify 失败仍可能显示 Apply 成功。
7. **Critical**：手工 rollback 可能卸载目标机原有软件包。
8. **High**：没有 Workload、自定义应用或完整个人网站识别。
9. **High**：Secret 只有引用和 out-of-band 文案，没有交付链。
10. **High**：Apply 是同步 HTTP 执行，没有 durable worker、checkpoint 或 crash recovery。

完整 Top 20 及影响、数据丢失、假完成字段见审计报告。

## 11. 测试结果

- Typecheck：PASS
- Build：PASS，Web 有大 chunk warning
- Unit/API：`1001/1001` PASS，0 skipped
- Collector 专项：`106/106` PASS
- Plan 安全专项：`28/28` PASS
- Graph/Migrate/PostgreSQL 专项：`132/132` PASS
- Golden fixture：`5/5 + 5/5` PASS
- Capability manifests：`2/2` PASS；不代表 live certification
- Web：16 项均因缺少 Chromium 在启动前失败，产品 UI 未验证
- E2E：现有所谓 E2E 主要是 server-side fixture/stub，不执行真实 SSH
- Harness：正确隔离配置下 `0/1`，fresh runtime catalog 初始化出现 `.map` of undefined
- 总通过：canonical API 1001；补充执行 278 次通过，但存在重叠
- 总失败：Web launch 16；dry-run harness 1
- 没有被测试证明的核心路径：真实 SSH Apply、数据传输、Cutover、业务事务、crash resume、Secret delivery、Restore Drill

## 12. 端到端链路断点

- Build：在 disposable target 实际 Apply、业务 Verify 和安全 Rollback 处断开。
- 普通迁移：可以到 package/service Plan；配置和数据动作断开。
- 个人网站：在 Workload 聚合及业务 Plan 前断开。
- PostgreSQL：在 blocked dry-run 后、dump 前断开。
- 服务运行状态：在完整 desired state capture 和 quiesce 前断开。
- Preserve & Restore：在 metadata Snapshot 后断开。

## 13. 可直接用于后续规划的事实清单

- Environment Plan 安全边界真实存在。
- Build/Migrate 最终共用同一 Plan 执行 API。
- Graph/ServiceStack 是只读派生层，不参与 planner。
- 当前没有真实数据迁移能力。
- 当前没有 Secret Transport。
- 当前没有 Cutover。
- 当前没有 active Run 恢复。
- 当前没有可恢复 Archive。
- API 全量绿色不能证明业务迁移闭环。
- 最接近闭环的是“认证软件包重建”，不是“完整业务迁移”。

## 14. 审计可信度

- 高可信结论：生产调用关系、领域对象、持久化、执行边界、测试结果、只读 API 运行。
- 中可信结论：远端 collector 在不同 Linux/systemd/Docker 环境中的实际输出质量。
- 未能验证：真实 Apply、真实 rollback、Web UI、数据迁移、Cutover、业务验证、Secret delivery、live harness 和 restore drill。
- 验证受限原因：安全边界禁止外部写操作；无 disposable target；本机缺 Playwright Chromium；dry-run harness clean-start 失败。

## 15. 最终判断

**当前是有限场景的迁移产品。**

它已经超过纯设计/评估原型，但闭环对象主要是软件包及少量服务/配置动作。它还不能被称为完整 Build 产品、可用于生产的迁移产品或可靠封存恢复产品。

未 commit，未 push，未修改任何产品代码。

[Attachment: 8bead08a-b983-4703-97e2-6580c02aff9c.md]

## Response:
2026/7/18 17:03:39

我会把这次汇总整理成一份“总体设计议题地图”：先界定当前产品真实边界，再统一三种产品模式、核心领域对象、迁移完整性、运行状态、数据、Secret、Cutover、执行恢复与长期封存，最后列出后续必须逐项拍板的设计问题。

> **考虑报告引用**
>
> 我正在思考是否需要引用文件中的行范围。文件没有行号标记，但我将尽量避免过度引用，只提及文件作为来源。
>
> **考虑报告引用**
>
> 
>
> 思考了 43s

下面这份汇总不是最终实施方案，而是一张后续产品、领域模型和技术架构讨论的“总地图”。其中既包含当前项目已经具备的基础，也包含所有必须补齐的能力和需要提前确定的产品边界。

**document: **

# EnvForge 下一阶段总体需求与系统设计议题汇总

## 一、总体结论

EnvForge 当前已经具备一个相对可靠的安全执行内核：

- 源服务器 SSH 采集；
- Snapshot 持久化；
- Inventory Graph 和 Service Stack 派生；
- Environment Plan；
- Plan Hash、Artifact Hash；
- Review、Approval 和 Apply Gate；
- 部分 package、service、config SSH Action；
- ApplyRun、ActionRun 和 Report。

但它当前真正闭环的主要对象仍是：

> 软件包、有限服务命令和少量配置动作。

它尚未真正闭环的对象包括：

- 完整业务工作负载；
- 自定义应用；
- 配置内容；
- 数据库真实数据；
- 文件数据；
- Docker Volume；
- Secret 交付；
- 服务完整期望状态；
- 运行中请求、事务和任务的处理；
- Cutover；
- 业务级验证；
- 可靠回滚；
- 断点续传；
- 任务崩溃恢复；
- 长期封存和未来恢复。

特别重要的是，当前 Inventory Graph 和 Service Stack 虽然已经存在，但仍是只读派生层，Migration Planner 并不消费它们；Migrate 生成计划时仍主要依赖软件列表和配置检查项。因此，目前系统能够“发现很多东西”，却不能把这些发现编译为完整业务迁移计划。`8bead08a-b983-4703-97e2-6580c02aff9c.md`

下一阶段真正需要完成的产品转变是：

> 从“扫描服务器并迁移软件”，转变为“理解业务如何运行，将其编译为可重建、可迁移、可验证、可回滚、可长期保存的环境合同”。

---

# 二、产品必须明确区分四种任务模式

## 1. Assessment：只分析

输入：

- 一台现有服务器；
- 不要求目标机；
- 不执行修改。

输出：

- 环境清单；
- 业务工作负载识别；
- 数据与 Secret 风险；
- 可迁移性；
- 兼容性要求；
- 预估复杂度；
- 未知项。

它的作用是回答：

> 这台机器里有什么？哪些可以自动重建？哪些数据不能丢？迁移难点是什么？

## 2. Build：创建全新环境

输入：

- 用户选择的软件、服务、模板；
- 一台新目标机器；
- 用户参数和 Secret。

特点：

- 没有历史数据；
- 不需要理解旧机器；
- 不需要 initial sync、final sync 或 Cutover；
- 可以支持较广的软件范围；
- 能力深度要求相对低。

输出：

```text
Build Specification
→ Build Plan
→ Approval
→ Apply Run
→ Verification
→ Report
```

Build 的核心价值是：

> 将用户想要的新环境可靠地安装和配置出来。

## 3. Live Migrate：在线迁移

输入：

- 一台仍在运行的源机器；
- 一台同时存在的目标机器；
- 用户允许的停机时间和切换方式。

特点：

- 必须理解历史状态；
- 必须迁移配置和数据；
- 必须处理正在发生的写入；
- 必须支持 initial sync 和 final sync；
- 必须支持 Cutover；
- 必须验证真实业务；
- 必须具备回滚窗口。

输出：

```text
Migration Project
→ Workload Blueprints
→ Migration Plan
→ Prepare Run
→ Initial Sync Run
→ Cutover Run
→ Verification Run
→ Observation
→ Commit / Rollback
```

Live Migrate 的核心价值是：

> 在可控停机和可回滚条件下，把一个正在运行的业务搬到另一台机器。

## 4. Preserve & Restore：先封存，未来恢复

输入阶段一：

- 只有源机器；
- 当前没有目标机器；
- 用户准备释放旧服务器。

输入阶段二：

- 数天或数月后出现一台新目标机器。

特点：

- 不能依赖源服务器未来仍然存在；
- 必须保存真实数据和部署材料；
- 必须长期保持完整性；
- 必须记录未来兼容边界；
- 必须进行恢复演练；
- 必须在旧服务器释放前给出安全门禁。

输出：

```text
Capture Project
→ Capture Plan
→ Capture Run
→ Environment Archive
→ Integrity Verification
→ Restore Drill
```

未来：

```text
Environment Archive
+ New Target
→ Compatibility Analysis
→ Restore Plan
→ Restore Run
→ Business Verification
```

该模式不能使用一个跨越几个月的 Plan。

必须分为：

- Capture Plan：针对当前源服务器；
- Restore Plan：针对未来具体目标服务器。

---

# 三、需要统一，但不能混为一体的核心对象

## 1. Environment Project

Project 是用户工作的容器，不应让用户直接围绕 Plan 管理整个流程。

Project 应包含：

- 模式；
- 源机器；
- 目标机器；
- Snapshot；
- Workload；
- 用户决策；
- Plan 历史；
- Run 历史；
- 验证结果；
- Report；
- Archive。

当前项目没有正式 Project 层，Build 直接创建 Plan，Migrate 只有 Pipeline Session，用户生命周期难以统一管理。`8bead08a-b983-4703-97e2-6580c02aff9c.md`

## 2. Evidence

来自实际服务器的原始事实：

- 软件；
- 服务；
- 进程；
- 端口；
- 文件；
- 数据目录；
- Secret 引用；
- Docker；
- 用户；
- 证书；
- 域名；
- 定时任务。

Evidence 只能描述“发现了什么”，不能直接作为用户审批对象。

## 3. Inventory Graph

用于表达技术对象之间的关系：

```text
service → process
service → config
service → port
service → data path
service → env file
application → database
reverse proxy → application
container → volume
domain → certificate
```

当前 Inventory Graph 已经具备大量节点，但部分生产关系无法从真实 Collector 输出中生成，部分测试依靠人工注入字段；而且 Graph 目前不进入 Planner。`8bead08a-b983-4703-97e2-6580c02aff9c.md`

## 4. Workload Blueprint

这是下一阶段最重要的新对象。

它不是技术对象集合，而是一个可部署、可迁移的业务单元。

例如：

```text
个人博客
├── Nginx
├── Node.js 自定义应用
├── PostgreSQL
├── 上传文件
├── .env Secret
├── 域名与 TLS
└── 定时任务
```

Workload Blueprint 至少需要包含：

- 业务名称；
- 类型；
- 运行入口；
- 服务；
- 运行时；
- 部署来源；
- 配置；
- 数据集；
- Secret；
- 外部依赖；
- 用户和权限；
- 网络入口；
- 域名和证书；
- 定时任务；
- 启动顺序；
- 健康检查；
- 业务验证；
- 数据迁移策略；
- Cutover 策略；
- 回滚能力；
- 识别置信度；
- 未解决问题。

没有 Workload Blueprint，系统只能继续迁移零散的软件和文件。

## 5. Decision

系统无法可靠判断的事情，应成为结构化决策：

- 是否迁移该工作负载；
- 哪些目录是业务数据；
- 数据使用何种迁移方式；
- Secret 如何提供；
- 目标冲突怎么处理；
- 是否允许停止写入；
- 是否允许重新签发证书；
- 域名如何切换；
- 最大停机时间；
- 验证失败后是否自动回滚。

Decision 不应该继续围绕单个 package、port 或 config file。

## 6. Draft Plan 与 Plan Version

Draft Plan 是系统根据当前事实和决策生成的执行方案。

以下任何内容变化，都必须生成新版本：

- 源 Snapshot；
- 目标 Snapshot；
- Workload；
- 数据策略；
- Secret Provider；
- 冲突处理；
- Cutover；
- 验证合同；
- 回滚策略。

当前 Plan 没有版本模型，目标状态变化也不会自动使已批准 Plan 失效，这是后续安全设计必须解决的问题。`8bead08a-b983-4703-97e2-6580c02aff9c.md`

## 7. Approved Plan

Approved Plan 是不可变执行合同。

它应固化：

- 输入 Snapshot Hash；
- Target Snapshot Hash；
- Workload Blueprint；
- 用户决策；
- Action DAG；
- Dataset Contract；
- Secret Requirement；
- Cutover Contract；
- Verification Contract；
- Rollback Contract；
- Artifact Hash；
- 限制与风险。

Approved Plan 不应承担：

- 执行进度；
- 重试状态；
- 日志；
- 当前传输字节数。

## 8. Run

执行状态必须属于 Run，不属于 Plan。

至少需要：

- Build Run；
- Prepare Run；
- Transfer Run；
- Apply Run；
- Cutover Run；
- Verification Run；
- Rollback Run；
- Capture Run；
- Restore Run。

当前只有 ApplyRun 和 ActionRun 相对持久，Verify 和 Rollback 只是 Plan 上的最近结果，活动中的 Apply 也无法在 API 重启后恢复。`8bead08a-b983-4703-97e2-6580c02aff9c.md`

## 9. Report

Report 必须只陈述真实执行证据。

不能把用户选择的策略、Catalog 声明或尚未执行的动作写成已经完成。

报告应基于：

- 实际 ActionRun；
- 实际 TransferRun；
- 实际 VerificationRun；
- 实际 CutoverRun；
- 实际 RollbackRun；
- 实际错误和人工步骤。

当前 Report 存在根据计划或 Catalog 推断尚未执行能力的风险，需要重新明确证据边界。`8bead08a-b983-4703-97e2-6580c02aff9c.md`

---

# 四、Build 和 Migrate 应共享什么、分开什么

## 应共享的底层能力

Build、Live Migrate 和 Restore 应共享：

- Target Compatibility；
- Workload Blueprint；
- Plan；
- Approval；
- Action Adapter；
- Secret Delivery；
- Verification；
- Rollback；
- Report；
- Capability SDK。

## 不应该共享的业务逻辑

### Build 不需要

- 源服务器扫描；
- 历史数据发现；
- initial sync；
- quiesce；
- final sync；
- Cutover；
- 源目标数据一致性；
- 源服务器回滚。

### Live Migrate 必须拥有

- 源环境理解；
- 数据发现；
- 数据一致性；
- 服务运行状态；
- initial sync；
- quiesce；
- final sync；
- traffic switch；
- observation；
- 源端恢复。

### Preserve & Restore 额外需要

- 长期对象存储；
- Archive Manifest；
- Archive Encryption；
- Retention；
- Integrity Scrub；
- Compatibility Envelope；
- Restore Drill；
- 源服务器释放门禁。

因此应采用：

```text
不同的输入编译器
→ 统一 Workload Blueprint
→ 不同 Plan 类型
→ 统一执行内核
```

而不是让 Build 和 Migrate 共用完全相同的浅层 Planner。

---

# 五、迁移对象必须从“软件”升级为“业务运行合同”

## 1. 部署来源

每个 Workload 必须说明未来如何重新获得应用：

- 系统软件包；
- Git repository；
- Docker image；
- Docker Compose；
- 自定义二进制；
- 已构建 artifact；
- 整个目录复制；
- 无法确定。

系统需要回答：

> 这个应用可以重新构建，还是必须保存现有产物？

## 2. 运行合同

每个服务需要记录：

- systemd unit；
- drop-in；
- ExecStart；
- ExecStartPre；
- ExecStop；
- WorkingDirectory；
- User；
- Group；
- EnvironmentFile；
- Restart Policy；
- resource limits；
- security settings；
- dependencies；
- service ordering；
- socket activation；
- timer activation。

当前只采 running/enabled 名称和少量路径，不能恢复完整服务期望状态。`8bead08a-b983-4703-97e2-6580c02aff9c.md`

## 3. 数据合同

区分：

- 代码；
- 构建产物；
- 配置；
- Secret；
- 持久数据；
- 缓存；
- 日志；
- 临时文件。

例如：

```text
/opt/blog/src            代码，可从 Git 恢复
/opt/blog/node_modules   可重建，不迁移
/var/lib/blog/uploads    业务数据，必须迁移
/opt/blog/.env           Secret，不保存明文
/var/cache/blog          缓存，可忽略
/var/log/blog            可选归档
```

## 4. 验证合同

每个 Workload 必须提前定义：

> 什么结果代表业务恢复成功？

例如：

- 首页返回 200；
- 页面包含特定内容；
- 登录成功；
- 数据库可读写；
- 上传文件可访问；
- 定时任务存在；
- TLS 正常；
- 外部依赖可用。

---

# 六、服务状态必须分成三类处理

“迁移正在运行的服务状态”不能理解为复制 PID、内存和连接。

## 1. 可重建的期望状态

应该采集并恢复：

- 服务是否启用；
- 启动方式；
- 运行用户；
- 工作目录；
- 环境变量引用；
- 依赖顺序；
- 自动重启；
- 资源限制；
- 健康检查；
- Docker restart policy；
- 网络和 volume；
- timer/cron。

这些是可以转化为 Plan 的状态。

## 2. 持久业务状态

必须迁移：

- 数据库；
- 文件数据；
- Docker Volume；
- Git 仓库；
- 对象存储；
- 消息队列持久化数据；
- durable session；
- application state。

这些需要 Dataset Contract 和一致性策略。

## 3. 临时运行状态

通常不应直接迁移：

- PID；
- TCP 连接；
- 当前 HTTP 请求；
- 数据库活动事务；
- 内存缓存；
- 文件锁；
- leader election；
- 未持久化队列；
- 当前 worker job；
- 正在运行的 cron job。

它们需要分类处理：

| 临时状态 | 正确处理 |
|---|---|
| HTTP 请求 | drain |
| DB 事务 | 等待完成或终止 |
| 文件写入 | quiesce + final sync |
| 内存缓存 | 重新预热 |
| 内存 session | 外置、允许失效或通知用户 |
| worker job | drain、checkpoint 或重新入队 |
| leader election | 目标启动后重新选举 |
| 文件锁 | 停止源服务后释放 |
| cron/timer | 避免源目标重复执行 |

需要新增一个明确对象：

```text
Ephemeral State Policy
```

它应描述：

- drain；
- quiesce；
- checkpoint；
- restart；
- discard；
- manual handling。

---

# 七、数据迁移必须成为独立执行引擎

当前数据功能主要停留在发现、决策和 blocked dry-run，PostgreSQL、文件和 Docker Volume 均没有真实执行链。`8bead08a-b983-4703-97e2-6580c02aff9c.md`

## 1. Dataset

每个数据集需要记录：

- 类型；
- 归属 Workload；
- 来源；
- 大小；
- 文件数量；
- writer processes；
- 一致性要求；
- 迁移策略；
- initial sync；
- quiesce；
- final sync；
- restore；
- verify；
- rollback。

## 2. 数据迁移生命周期

```text
Discover
→ Analyze Writers
→ Preflight
→ Prepare Target
→ Initial Sync
→ Quiesce
→ Final Sync
→ Activate
→ Verify
→ Commit / Rollback
```

## 3. 文件数据

需要确定：

- include/exclude；
- owner/mode；
- ACL/xattr；
- symlink；
- sparse file；
- checksum；
- chunk；
- rsync；
- partial transfer；
- final sync；
- target conflict；
- source/target manifest comparison。

## 4. PostgreSQL

不能只执行 `pg_dump`。

需要处理：

- 源目标版本；
- databases；
- roles；
- grants；
- extensions；
- locale/encoding；
- tablespaces；
- large objects；
- sequences；
- active connections；
- data size；
- dump format；
- transfer；
- restore；
- verification；
- cleanup；
- rollback。

## 5. Docker Volume

需要确定：

- volume driver；
- container mapping；
- ownership；
- running writer；
- archive method；
- transfer；
- restore；
- conflict；
- target verification。

## 6. 数据一致性等级

应明确区分：

- crash-consistent；
- filesystem-consistent；
- application-consistent；
- transaction-consistent；
- eventually consistent；
- manual verified。

用户必须看见系统实际提供的是哪一级。

---

# 八、Secret 必须从“发现引用”变成“完整交付链”

当前 SecretRef 和脱敏基础存在，但不存在 Secret Requirement、Provider、注入和清理。`8bead08a-b983-4703-97e2-6580c02aff9c.md`

需要建立：

```text
SecretRef
→ SecretRequirement
→ SecretProviderBinding
→ Runtime Fetch
→ Target Injection
→ Service Validation
→ Cleanup / Rotation
```

需要确定支持哪些 Provider：

- 执行时用户输入；
- Vault；
- SOPS；
- 目标机已有；
- 自动重新生成；
- 迁移后轮换；
- 手工 out-of-band。

必须明确：

- Snapshot 不保存明文；
- Plan 不保存明文；
- Report 不保存明文；
- 日志统一脱敏；
- 临时文件及时清理；
- Secret 不可用时阻止启动；
- 数月后的 Restore 如何重新获得 Secret。

对于 Preserve & Restore，还必须决定：

> EnvForge 是否托管 Secret 的加密副本，还是只保存恢复要求？

这是一个产品、安全、合规和责任边界问题，必须优先拍板。

---

# 九、目标兼容性必须前置并成为 Plan 的输入

## Build

目标机应在开始时出现，因为 Build 的所有动作都依赖目标环境。

## Live Migrate

目标机也不应该拖到所有源端决策之后。

推荐流程：

```text
创建迁移项目
→ 连接源机器
→ 同时连接或稍后补充目标机器
→ 源端分析
→ 目标兼容分析
→ Workload 和冲突决策
→ Plan
```

当目标暂时不存在时，可以继续完成：

- 源工作负载识别；
- 数据分析；
- Compatibility Envelope；
- 用户决策。

但不能生成最终 Approved Migration Plan。

## Compatibility Envelope

对于封存恢复场景，需要长期保存：

- CPU architecture；
- 最低内存；
- 最低磁盘；
- OS 范围；
- libc；
- kernel；
- filesystem；
- package manager；
- database version；
- required modules；
- external dependencies；
- license constraints。

未来目标机出现时，重新输出：

- compatible；
- compatible with conversion；
- requires manual；
- blocked。

不能承诺“完美兼容任何下一台服务器”。

正确承诺应该是：

> 完整保存恢复所需材料，并在未来对具体目标重新计算兼容性和转换方案。

---

# 十、Cutover 必须是一等状态机

当前没有 Cutover 对象、drain、quiesce、final sync、traffic switch 或 observation window。`8bead08a-b983-4703-97e2-6580c02aff9c.md`

建议状态：

```text
PREPARING_TARGET
→ INITIAL_SYNC
→ PRE_CUTOVER_VERIFY
→ WAITING_FOR_WINDOW
→ DRAINING
→ SOURCE_QUIESCED
→ FINAL_SYNC
→ TARGET_ACTIVATED
→ TRAFFIC_SWITCHED
→ BUSINESS_VERIFYING
→ OBSERVING
→ COMMITTED
```

失败分支：

```text
→ ROLLING_BACK
→ SOURCE_RESUMED
→ TRAFFIC_RESTORED
→ ROLLED_BACK
```

Cutover Contract 需要包括：

- 维护窗口；
- 最大停机；
- source drain；
- source freeze；
- final sync；
- traffic switch；
- DNS TTL；
- target activation；
- business verification；
- observation window；
- commit conditions；
- rollback conditions；
- rollback deadline。

需要决定首期支持哪些流量切换：

- 手工 DNS；
- Cloudflare；
- 云厂商弹性 IP；
- Nginx upstream；
- Load Balancer；
- 浮动 IP。

首期即使只支持“结构化人工步骤”，也必须纳入状态机和验证，而不是留在自由文本中。

---

# 十一、验证必须决定迁移是否成功

当前验证主要是命令级：

- systemctl；
- nginx -t；
- curl；
- 个别服务命令。

并存在 verify fail-open、只运行第一个检查和 `|| true` 等假成功风险。`8bead08a-b983-4703-97e2-6580c02aff9c.md`

建议建立六层 Verification Contract：

1. Artifact 与配置完整性；
2. 语法；
3. 服务和进程；
4. 网络与依赖；
5. 数据一致性；
6. 业务合成交易。

业务验证应支持：

- Capability 自带；
- 系统推断；
- 用户自定义。

Plan 批准前就应明确：

> 哪些验证失败会阻止 Cutover Commit？

验证结果不能只是 Report 的一个附加部分，而应直接驱动状态：

```text
VERIFY PASSED → OBSERVING
VERIFY FAILED → HOLD / ROLLBACK
```

---

# 十二、回滚必须基于真实执行前状态

当前 rollback 存在：

- 可能卸载目标机原有软件；
- 部分失败仍标记 rolled-back；
- 无数据和流量回滚；
- 无 rollback window；
- 无新写入处理。

这些不是 UI 问题，而是核心安全问题。`8bead08a-b983-4703-97e2-6580c02aff9c.md`

每个 Action 必须记录：

- existedBefore；
- previousValue；
- backupArtifact；
- previousServiceState；
- previousOwner/mode；
- previousTrafficTarget；
- reversibleUntil；
- rollback classification。

回滚等级：

- full；
- partial；
- manual；
- none；
- dangerous。

必须明确：

> 切换后目标机产生的新写入如何处理？

如果无法自动合并，就不能宣称自动回滚，应提示：

- 需要停止目标写入；
- 需要人工数据合并；
- 只能回滚流量，不能回滚数据；
- 超过时间后回滚失效。

---

# 十三、执行引擎必须持久、可恢复、可观察

当前 Apply 是同步 HTTP 执行，没有 durable worker、checkpoint 和 crash recovery。浏览器断开后可能继续，但没有可靠保证；API 重启后活动任务不能恢复。`8bead08a-b983-4703-97e2-6580c02aff9c.md`

后续需要：

```text
API
→ Durable Queue
→ Worker Claim
→ Heartbeat
→ Action Journal
→ Checkpoint
→ Progress Event
→ Retry / Resume
```

每个 Action 需要：

- idempotency key；
- precondition；
- timeout；
- retry policy；
- cancellation；
- checkpoint；
- verify；
- rollback；
- resumability classification。

断点能力必须诚实区分：

- byte-resumable；
- step-resumable；
- restart-required；
- manual。

UI 需要显示：

- 当前阶段；
- 当前 Workload；
- 当前 Action；
- 已传输字节；
- 速度；
- 预计剩余；
- checkpoint；
- 重试次数；
- 可否暂停；
- 可否安全取消；
- 从哪里恢复。

---

# 十四、Preserve & Restore 必须建立长期存档系统

当前 Snapshot 只有 metadata，不能作为恢复材料；当前 Plan Artifact 只是本地短期文件，也不能作为长期 Archive。`8bead08a-b983-4703-97e2-6580c02aff9c.md`

## Environment Archive 应包含

- Workload Blueprint；
- Deployment Artifact；
- Dataset Archive；
- Config Artifact；
- Secret Requirements；
- Compatibility Envelope；
- Verification Contract；
- Capture Report；
- Manifest；
- Hash；
- Signature；
- Encryption Metadata。

## 长期存储必须考虑

- 对象存储；
- 多副本；
- 跨区域；
- content-addressed storage；
- chunk hash；
- deduplication；
- versioning；
- retention；
- legal delete；
- user export；
- integrity scrub；
- storage cost；
- quota；
- encryption；
- key rotation；
- tenant isolation。

## 完整性等级

建议显示：

- Captured；
- Integrity Verified；
- Restore Plan Ready；
- Restore Simulated；
- Restore Tested；
- Production Ready。

旧服务器释放门禁必须至少检查：

- 所有业务已归属；
- 所有必要数据已采集；
- 数据一致性成立；
- Secret 恢复策略完成；
- Archive 校验完成；
- Restore Plan 可生成；
- 关键 Workload 恢复演练通过。

---

# 十五、Capability 需要拆分认证维度

当前 Catalog 中的 certified 或 official 不能证明真实迁移能力。`8bead08a-b983-4703-97e2-6580c02aff9c.md`

同一个 Capability 应分别标记：

- Build Certified；
- Detection Certified；
- Workload Mapping Certified；
- Migration Planning Certified；
- Data Migration Certified；
- Cutover Certified；
- Business Verification Certified；
- Rollback Certified；
- Archive/Restore Certified；
- Production Migration Certified。

例如 PostgreSQL 可以是：

```text
Build Certified：是
Detection Certified：是
Migration Planning：部分
Data Migration：否
Cutover：否
Archive/Restore：否
```

这能避免用户看到“支持 PostgreSQL”，却误认为真实数据也能迁移。

---

# 十六、前端需要从技术工作台转为项目生命周期

当前 UI 的主要问题包括：

- Build、Migrate、Plan 概念混乱；
- Migrate 的 Apply 实际只是创建 Plan；
- 部分 Build 文案说 applying，实际只创建 Plan；
- Runs 页面展示 legacy task，不是 Plan Apply；
- 用户仍面对较多技术对象；
- 没有 Cutover 页面；
- 没有业务验证页面；
- 没有 Archive/Restore 页面；
- 目标机在 Migrate 中出现偏晚。

这些会制造严重假完成感。`8bead08a-b983-4703-97e2-6580c02aff9c.md`

建议一级产品结构：

```text
项目
├── 创建新环境
├── 在线迁移
├── 保存后恢复
└── 仅分析

可恢复环境
计划与审批
运行记录
报告
能力目录
设置
```

一个项目内部再展示：

```text
Overview
Workloads
Decisions
Target
Plan
Execution
Cutover
Verification
Report
```

默认界面只展示：

- 必须处理；
- 系统推荐；
- 当前风险；
- 下一步操作。

Evidence、Graph、Action 等技术细节放入高级展开层。

---

# 十七、安全与责任边界必须提前确定

以下问题不能留到实现过程中临时决定。

## 1. EnvForge 是否托管用户数据？

选择之一：

- 仅支持用户自己的对象存储；
- EnvForge 托管；
- 两者都支持。

这将影响：

- 成本；
- 数据责任；
- 加密；
- 合规；
- 删除；
- 备份；
- 多租户隔离。

## 2. EnvForge 是否托管 Secret？

建议默认不托管明文，只保存 Requirement 和 Provider Binding。

如支持托管，需要独立 KMS、审计、轮换和紧急恢复。

## 3. 首期支持范围

建议主动限制：

- Ubuntu 22.04/24.04；
- x86_64；
- systemd；
- 标准 SSH；
- Nginx；
- 自定义 Node.js/Python 应用；
- PostgreSQL；
- 文件数据；
- 手工 DNS Cutover。

否则范围会迅速失控。

## 4. 迁移保证等级

需要定义产品承诺：

- Best-effort；
- Verified；
- Restore-tested；
- Production-supported。

不能对所有未知自定义应用承诺自动完整迁移。

## 5. 数据责任

需要明确：

- 系统发现不完整时是否允许继续；
- 用户是否可以强制忽略；
- 哪些 blocker 不可绕过；
- Archive 未测试时是否允许释放源服务器；
- 数据丢失责任如何提示。

---

# 十八、测试和验收体系必须重构

当前 1001 个 API 测试绿色，不能证明真实迁移闭环；Web smoke 未运行，dry-run harness clean-start 失败，也没有 disposable target 的 M4/M5 证据。`8bead08a-b983-4703-97e2-6580c02aff9c.md`

后续每一项能力都应分五层验证：

1. Unit；
2. Production-chain integration；
3. Collector → Graph → Workload contract fixture；
4. Disposable source/target harness；
5. Failure and rollback scenario。

黄金场景必须包括：

- 正常迁移；
- 网络中断；
- SSH 中断；
- API 重启；
- Worker 崩溃；
- 磁盘不足；
- Secret 缺失；
- 数据验证失败；
- Cutover 后业务失败；
- rollback；
- Preserve 后真实 Restore Drill。

---

# 十九、建议的第一个纵向黄金场景

建议首个完整场景固定为：

```text
Ubuntu 源服务器
├── Nginx
├── 自定义 Node.js 或 Python systemd 应用
├── PostgreSQL
├── 用户上传目录
├── .env Secret
├── 域名和 TLS
└── cron/timer
```

它必须同时覆盖：

## Build

在全新机器创建相同架构，但没有历史数据。

## Live Migrate

迁移应用、配置、数据库、上传文件，完成 Cutover 和业务验证。

## Preserve & Restore

先封存，删除源机器，未来恢复。

该场景能验证所有核心抽象：

- Workload；
- Deployment Artifact；
- Dataset；
- Secret；
- Desired Service State；
- Cutover；
- Business Verification；
- Rollback；
- Archive；
- Restore Drill。

---

# 二十、下一阶段必须逐项拍板的设计问题

## 产品层

1. 是否正式设立 Assessment、Build、Live Migrate、Preserve & Restore 四种模式？
2. 是否引入 Environment Project 作为统一入口？
3. Build 和 Migrate 是否继续分别作为一级导航？
4. 首期目标用户是个人 VPS、开发者还是生产团队？
5. 产品承诺是 best-effort 还是 production verified？

## 工作负载层

6. Workload 的最小边界是什么？
7. 自动聚合和用户手工合并如何结合？
8. 自定义 systemd 应用如何识别？
9. 如何识别部署来源？
10. 无法理解的工作负载如何降级？

## 服务状态层

11. systemd 需要采集到什么深度？
12. 哪些临时状态支持 drain？
13. 哪些状态明确不迁移？
14. cron/timer 如何避免重复执行？
15. active job 是否支持 checkpoint？

## 数据层

16. 首期支持哪些 Dataset？
17. PostgreSQL 首期使用哪种策略？
18. 是否先实现 dump/restore，后做 replication？
19. 文件同步采用 rsync 还是自有 chunk protocol？
20. 数据一致性等级如何向用户展示？
21. 如何估算停机时间？
22. 如何处理目标端已有数据？

## Secret 层

23. 是否托管 Secret？
24. 首期支持哪些 Provider？
25. Preserve 场景中 Secret 如何跨时间恢复？
26. 日志和报告如何统一脱敏？

## Cutover 层

27. 首期支持自动 DNS 还是只支持结构化人工步骤？
28. Observation Window 默认多久？
29. 哪些验证失败自动回滚？
30. 切换后产生新数据时如何回滚？

## 执行层

31. 使用什么 durable queue？
32. Worker 是否独立进程？
33. Checkpoint 粒度是什么？
34. 如何恢复卡在 applying 的旧 Run？
35. 进度使用 SSE、WebSocket 还是 polling？

## Archive 层

36. EnvForge 托管存储还是 BYOS？
37. Archive 是否支持去重？
38. 默认保留多久？
39. 如何定期 scrub？
40. 是否强制 Restore Drill 后才能释放服务器？
41. Archive 加密密钥由谁掌握？
42. 用户忘记密钥如何处理？

## 安全与治理

43. 哪些 blocker 永远不可绕过？
44. 是否允许管理员强制执行？
45. Plan Version 和 target drift 如何处理？
46. Report 是否需要签名？
47. 多租户数据如何隔离？

## 验收层

48. 第一个 M5 live harness 场景是什么？
49. 哪些失败场景必须进入发布门禁？
50. Capability 达到什么等级才能在 Migrate 中显示“支持”？

---

# 二十一、总体优先级判断

下一阶段不应该继续优先做：

- 扩大 Catalog 数量；
- 增加更多只有计划、没有执行器的数据策略；
- Marketplace；
- 动态插件；
- 大量 UI 美化；
- 泛化企业治理；
- 全面重构 routes；
- 更多只读 Graph 展示。

应该优先解决：

1. Project、Workload、Dataset、PlanVersion、Run 等核心对象；
2. Graph/ServiceStack 真正进入 Planner；
3. systemd 期望状态采集；
4. 配置 Artifact 闭环；
5. PostgreSQL 和文件数据迁移；
6. Secret Delivery；
7. Durable Worker、Checkpoint、Progress；
8. Cutover；
9. 业务验证；
10. 安全回滚；
11. Capture Archive 和 Restore Drill；
12. 第一个完整黄金场景。

---

# 二十二、最终产品定义建议

EnvForge 不应最终被定义为：

> 一个扫描服务器、安装软件和生成计划的工具。

更合理的定义是：

> EnvForge 将现有服务器上的业务运行事实，转换为可审查的工作负载蓝图和不可变环境计划，并负责安全地重建软件、恢复配置和数据、交付 Secret、处理运行状态、完成业务切换、验证结果、支持回滚，以及在没有目标服务器时将环境封存为未来可恢复的长期存档。

这一产品定义包含三层核心价值：

1. **理解业务，而不仅是识别软件。**
2. **迁移业务状态，而不仅是重新安装软件。**
3. **证明业务可恢复，而不仅是声称任务执行成功。**

下一轮讨论建议先确定“产品模式与核心对象”，再依次讨论 Workload、服务状态、数据、Cutover 和 Preserve & Restore；否则直接进入具体实现，很容易再次形成大量独立字段和页面，却没有真正的端到端闭环。

## Prompt:
2026/7/18 20:04:55

好的先确定“产品模式与核心对象”

## Response:
2026/7/18 20:04:57

这一轮我会直接给出一套可落地的“产品模式 + 核心对象”基线，并明确哪些应统一、哪些必须分开，以及当前对象如何迁移到新模型。

# EnvForge 产品模式与核心对象基线方案

## 一、先确定最重要的产品原则

EnvForge 不应该继续以 Build、Migrate、Plan、Apply 等页面功能为中心，而应改成：

> **一个 Environment Project 管理一次明确的环境操作，Project 中逐步形成不可变 Plan，再由 Run 执行，最后生成基于事实的 Report。**

统一主链路：

```text
Project
→ Discover / Define
→ Workload
→ Decisions
→ Plan Revision
→ Approval
→ Run
→ Verification
→ Report
```

当前项目已经有 Snapshot、Inventory Graph、Service Stack、Environment Plan、ApplyRun、ActionRun 等基础，但缺少统一 Project、PlanVersion、Workload、Dataset、SecretRequirement、Cutover 和完整 Run 模型；Graph 和 Service Stack 也还没有进入 Migration Planner。`8bead08a-b983-4703-97e2-6580c02aff9c.md`

因此，本轮建议正式确定以下三项：

1. **用户以 Project 为中心，而不是直接以 Plan 为中心。**
2. **Build、Migrate、Capture、Restore 都生成 Plan，但 Plan 类型不同。**
3. **Workload Blueprint 是连接扫描结果和执行计划的核心对象。**

---

# 二、产品模式最终建议

## 用户层保留四种入口

```text
创建项目
├── 分析现有服务器
├── 创建全新环境
├── 迁移到另一台服务器
└── 保存服务器，稍后恢复
```

对应四种用户能理解的产品模式：

| 用户模式 | 内部模式 | 源机器 | 目标机器 | 历史数据 |
|---|---|---:|---:|---:|
| 分析服务器 | Assessment | 必需 | 不需要 | 只分析 |
| 创建新环境 | Build | 不需要 | 必需 | 不迁移 |
| 在线迁移 | Live Migration | 必需 | 必需 | 必须迁移 |
| 保存后恢复 | Capture + Restore | Capture 时必需 | Restore 时必需 | 必须长期保存 |

## 内部实际上应有五种 Operation Type

Preserve & Restore 在产品入口上可以是一种模式，但在领域模型中必须分成两个独立操作：

```ts
type ProjectType =
  | "assessment"
  | "build"
  | "migration"
  | "capture"
  | "restore";
```

原因是：

- Capture 时还没有目标机器；
- Restore 可能发生在几个月后；
- 一个 Archive 未来可能被恢复多次；
- 每次恢复的目标机、兼容条件和 Plan 都不同；
- 不能让一个 Plan 跨越几个月保持有效。

正确关系：

```text
Capture Project
→ Environment Archive
→ Restore Project A
→ Restore Project B
```

而不是：

```text
一个长期不结束的 Preserve Plan
```

---

# 三、五种模式的准确边界

## 1. Assessment Project

### 目标

回答：

> 这台服务器上运行了什么？哪些是业务？哪些数据不能丢？未来迁移有多难？

### 必需输入

- Source Endpoint；
- Source Snapshot。

### 允许产生

- Evidence；
- Inventory Graph；
- Workload Candidate；
- Workload Blueprint；
- Compatibility Envelope；
- Assessment Report。

### 不允许产生

- 真实写操作；
- Apply；
- Cutover；
- Target Change；
- 数据传输。

### 可转化为

Assessment 完成后，用户可以创建：

- Migration Project；
- Capture Project。

但不是直接把 Assessment Project 改类型。

---

## 2. Build Project

### 目标

回答：

> 如何在一台新服务器上创建用户想要的新环境？

### 必需输入

- Target Endpoint；
- 用户选择的 Capability、模板或自定义定义；
- 用户配置；
- Secret Requirement。

### 不包含

- 源服务器；
- 历史数据发现；
- initial sync；
- final sync；
- source drain；
- Cutover；
- 源端回滚。

### 可以包含的数据

Build 仍然可能有数据库和文件，但它们属于：

- 初始化；
- seed data；
- 用户上传的导入数据；
- 模板数据；
- 空数据目录创建。

它不应该把这些叫作“历史数据迁移”。

建议区分：

```ts
type DatasetSource =
  | "empty"
  | "seed"
  | "uploaded"
  | "source-host"
  | "archive";
```

Build 只使用前三种。

---

## 3. Migration Project

### 目标

回答：

> 如何把一个正在运行的业务从源机器安全迁移到目标机器？

### 必需输入

- Source Endpoint；
- Target Endpoint；
- Source Snapshot；
- Target Snapshot；
- Workload Blueprint；
- 最大允许停机；
- 数据迁移策略；
- Cutover 策略；
- Verification Contract。

### 必须包含

- 数据发现；
- 配置迁移；
- Secret 交付；
- 服务期望状态；
- initial sync；
- quiesce/drain；
- final sync；
- target activation；
- traffic switch；
- business verification；
- observation；
- rollback。

如果不包含这些，只能叫“软件重建”，不能叫完整迁移。

---

## 4. Capture Project

### 目标

回答：

> 如何将当前服务器封存成未来可恢复的环境，并允许用户释放源服务器？

### 必需输入

- Source Endpoint；
- Source Snapshot；
- Workload Blueprint；
- Archive Storage；
- Capture Policy；
- Secret Preservation Policy。

### 必须包含

- 部署材料；
- 配置 Artifact；
- 数据集；
- 数据一致性点；
- Archive Manifest；
- Hash；
- 加密；
- 完整性验证；
- Compatibility Envelope；
- Verification Contract；
- Capture Report。

### 最终产物

不是普通 Snapshot，而是：

```text
Environment Archive
```

### 释放服务器门禁

Capture Project 不应该在“上传成功”后直接结束。

必须有：

```text
SAFE_TO_RELEASE_SOURCE
```

该状态至少要求：

- 必要 Workload 已确认；
- 关键数据已捕获；
- Archive Hash 验证通过；
- Secret 恢复策略已确认；
- Restore Plan 可以生成；
- 必要时 Restore Drill 已通过。

---

## 5. Restore Project

### 目标

回答：

> 如何把一个 Environment Archive 恢复到一台新的目标服务器？

### 必需输入

- Environment Archive；
- Target Endpoint；
- Target Snapshot；
- Secret Provider Binding；
- 兼容转换决策。

### 必须重新计算

- OS 兼容；
- CPU 架构；
- 软件版本；
- 数据库版本；
- 文件系统；
- 磁盘空间；
- 端口；
- 用户/组；
- 服务冲突；
- 路径冲突；
- 已失效外部依赖。

Restore 不能直接执行 Capture 时生成的旧动作。

必须生成新的：

```text
Restore Plan
```

---

# 四、不要把 Repair 和 Rebuild 设为新的一级模式

当前和未来可能还有：

- Rebuild；
- Repair；
- Drift Remediation；
- Clone；
- Scale-out。

建议暂时不作为一级产品模式。

它们可以由现有模式派生：

| 场景 | 建议映射 |
|---|---|
| 从已知 Blueprint 重建 | Build Project |
| 根据 Drift 修复目标 | Repair Plan，挂在原 Project/Environment 下 |
| 从 Archive 克隆新环境 | Restore Project |
| 重建失败机器 | Restore 或 Build |
| 创建第二台相同机器 | Build，输入来自 Blueprint |

这样避免产品模式无限增长。

---

# 五、核心对象应分成三层

## 第一层：用户生命周期对象

这些对象直接决定产品流程。

### 1. EnvironmentProject

所有工作的根对象。

```ts
interface EnvironmentProject {
  id: string;
  type:
    | "assessment"
    | "build"
    | "migration"
    | "capture"
    | "restore";

  name: string;
  status: ProjectStatus;

  sourceEndpointId?: string;
  targetEndpointId?: string;
  archiveId?: string;

  currentWorkloadRevisionId?: string;
  currentDecisionSetId?: string;
  currentPlanRevisionId?: string;

  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

Project 是可变工作空间。

它可以逐步新增：

- Snapshot；
- Workload；
- Decision；
- Draft Plan；
- Run；
- Report。

但它不能直接包含不可审计的任意修改。

### 2. EnvironmentEndpoint

代表源服务器或目标服务器。

```ts
interface EnvironmentEndpoint {
  id: string;
  role: "source" | "target";
  connectionId: string;

  currentSnapshotId?: string;
  lastSeenAt?: string;
  availability:
    | "online"
    | "offline"
    | "released"
    | "unknown";
}
```

Endpoint 和 Connection 不应完全等价。

Connection 是访问凭据和连接方式；Endpoint 是 Project 中的业务角色。

### 3. EnvironmentArchive

Capture 和 Restore 之间的桥梁。

```ts
interface EnvironmentArchive {
  id: string;
  sourceProjectId: string;
  sourceSnapshotId: string;
  workloadRevisionIds: string[];

  manifestArtifactId: string;
  compatibilityEnvelopeId: string;
  verificationContractId: string;

  status:
    | "capturing"
    | "verifying"
    | "ready"
    | "degraded"
    | "expired"
    | "deleted";

  integrityStatus:
    | "unverified"
    | "verified"
    | "restore-tested";

  createdAt: string;
}
```

---

## 第二层：环境理解与用户决策对象

### 4. Snapshot

Snapshot 是某个时间点的机器事实。

它必须不可修改，并有唯一 Hash。

```ts
interface EnvironmentSnapshot {
  id: string;
  endpointId: string;
  collectedAt: string;
  contentHash: string;
  completeness: number;
  collectorResults: CollectorResult[];
}
```

一个 Endpoint 可以有多个 Snapshot。

Plan 不能只引用 Endpoint：

```text
错误：
Plan → targetEndpointId

正确：
Plan → targetEndpointId + targetSnapshotId + targetSnapshotHash
```

否则目标机状态变化后，旧审批仍可能继续执行。

### 5. Evidence

Evidence 是 Snapshot 中的技术事实。

例如：

- package；
- service；
- process；
- port；
- config file；
- data path；
- secret ref；
- container；
- volume；
- domain；
- certificate。

Evidence 不应成为用户主要审批对象。

### 6. InventoryGraph

Graph 表达 Evidence 关系。

它是机器事实的派生视图，不是可执行计划。

Graph 负责回答：

- 端口是谁监听；
- 服务读取什么配置；
- 应用连接什么数据库；
- 容器使用什么 Volume；
- 域名对应什么入口。

### 7. WorkloadCandidate

Graph 推断出的候选业务。

例如：

```text
可能的业务：
Nginx + app.service + PostgreSQL + /srv/uploads
```

Candidate 允许不完整和不确定。

```ts
interface WorkloadCandidate {
  id: string;
  sourceSnapshotId: string;
  evidenceIds: string[];
  proposedName: string;
  proposedType: string;
  confidence: ConfidenceResult;
  unresolvedRelations: string[];
}
```

当前 Service Stack 更适合演进成 WorkloadCandidate，而不是直接当最终 Workload。

### 8. WorkloadBlueprint

经过系统推断和用户确认后形成的业务合同。

```ts
interface WorkloadBlueprint {
  id: string;
  revision: number;

  origin:
    | "discovered"
    | "catalog"
    | "template"
    | "archive"
    | "user-defined";

  name: string;
  archetype: string;

  components: WorkloadComponent[];
  runtime: RuntimeContract;
  deployments: DeploymentContract[];
  datasets: DatasetContract[];
  secrets: SecretRequirement[];
  endpoints: EndpointContract[];
  scheduledTasks: ScheduledTaskContract[];
  dependencies: DependencyContract[];

  verification: VerificationContract;
  confidence?: ConfidenceResult;
  unresolvedQuestions: RequiredDecision[];
}
```

WorkloadBlueprint 应同时服务于：

- Build；
- Migration；
- Capture；
- Restore。

区别只是 Blueprint 的来源不同：

| 模式 | Blueprint 来源 |
|---|---|
| Build | Catalog、模板、用户定义 |
| Migration | Snapshot、Graph、用户补全 |
| Capture | 已确认的源业务 |
| Restore | Archive 中被冻结的 Blueprint |

### 9. DecisionSet

不要把决策分散到多个页面和字段。

```ts
interface DecisionSet {
  id: string;
  projectId: string;
  revision: number;
  decisions: ProjectDecision[];
  completedAt?: string;
}
```

决策类型包括：

- workload selection；
- data strategy；
- secret strategy；
- conflict resolution；
- downtime；
- cutover；
- verification；
- rollback；
- unknown item classification。

Plan 必须引用一个明确的 DecisionSet Revision。

---

## 第三层：执行与证据对象

### 10. PlanRevision

不建议再用一个可变化的 Plan。

建议：

```ts
interface PlanRevision {
  id: string;
  projectId: string;
  revision: number;
  planType:
    | "build"
    | "migration"
    | "capture"
    | "restore"
    | "repair";

  status:
    | "draft"
    | "review-required"
    | "approved"
    | "superseded"
    | "revoked";

  sourceSnapshotRef?: SnapshotRef;
  targetSnapshotRef?: SnapshotRef;
  archiveRef?: ArchiveRef;

  workloadRevisionIds: string[];
  decisionSetId: string;

  actionGraph: ActionGraph;
  datasets: DatasetExecutionContract[];
  secretRequirements: SecretExecutionContract[];
  cutover?: CutoverContract;
  verification: VerificationContract;
  rollback: RollbackContract;

  planHash: string;
  artifactHashes: string[];
}
```

### 关键规则

- Plan Revision 一旦生成，不原地修改；
- 修改任何输入，生成新 Revision；
- Approved Revision 永久不可修改；
- 新 Revision 批准后，旧 Revision 自动 superseded；
- Run 只能引用 Approved Revision。

### 11. Approval

Approval 不要只是 Plan 上几个字段。

```ts
interface PlanApproval {
  id: string;
  planRevisionId: string;
  approvedPlanHash: string;
  approvedBy: string;
  approvedAt: string;
  satisfiedGates: string[];
}
```

未来支持双人审批时，不需要重构 Plan。

### 12. Run

统一执行实例。

```ts
interface ExecutionRun {
  id: string;
  projectId: string;
  planRevisionId: string;

  type:
    | "build"
    | "prepare"
    | "apply"
    | "transfer"
    | "cutover"
    | "verify"
    | "rollback"
    | "capture"
    | "restore";

  status:
    | "queued"
    | "claimed"
    | "running"
    | "paused"
    | "blocked"
    | "succeeded"
    | "failed"
    | "cancelled";

  startedAt?: string;
  finishedAt?: string;
  heartbeatAt?: string;
}
```

Apply、Verify 和 Rollback 不应继续分别挂在 Plan 上作为最近结果。

它们应该是独立 Run，并通过父子关系组成：

```text
Migration Execution
├── Prepare Run
├── Transfer Run
├── Cutover Run
├── Verification Run
└── Rollback Run
```

### 13. ActionRun

记录具体动作事实：

- 执行前状态；
- 执行命令或结构化 Adapter；
- 结果；
- 输出摘要；
- Artifact；
- Verification；
- Rollback 状态。

它是安全回滚和真实 Report 的依据。

### 14. ReportArtifact

Report 应在 Run 完成后生成不可变 Artifact。

```ts
interface ReportArtifact {
  id: string;
  projectId: string;
  planRevisionId: string;
  runIds: string[];

  reportHash: string;
  generatedAt: string;
  result:
    | "succeeded"
    | "partially-succeeded"
    | "failed"
    | "rolled-back";

  knownLimitations: string[];
  manualSteps: string[];
}
```

不能只根据 Plan 内容动态推断“执行了什么”。

---

# 六、哪些对象是根对象，哪些只是子对象？

为了避免数据库和 API 对象失控，建议只设九个根聚合：

1. EnvironmentProject；
2. EnvironmentEndpoint；
3. EnvironmentSnapshot；
4. WorkloadBlueprint；
5. DecisionSet；
6. PlanRevision；
7. ExecutionRun；
8. EnvironmentArchive；
9. ReportArtifact。

以下对象作为子对象或 Value Object：

- Evidence；
- InventoryGraph；
- WorkloadCandidate；
- DatasetContract；
- SecretRequirement；
- RuntimeContract；
- DeploymentContract；
- CutoverContract；
- VerificationContract；
- RollbackContract；
- Action；
- ActionRun。

这样既能表达完整能力，又不会把所有小概念都变成一级数据库资源。

---

# 七、对象之间的正式关系

```text
EnvironmentProject
├── Source Endpoint
├── Target Endpoint
├── Snapshots
├── Workload Blueprints
├── Decision Sets
├── Plan Revisions
├── Execution Runs
└── Reports
```

Capture 额外产生：

```text
Capture Project
→ Environment Archive
```

Restore 引用：

```text
Restore Project
→ Environment Archive
→ Target Endpoint
→ Target Snapshot
→ Restore Plan
```

Plan 的完整依赖关系：

```text
Plan Revision
├── Source Snapshot Hash
├── Target Snapshot Hash
├── Workload Blueprint Revisions
├── Decision Set Revision
├── Action Graph
├── Dataset Contracts
├── Secret Requirements
├── Cutover Contract
├── Verification Contract
└── Rollback Contract
```

Run：

```text
Run
→ exactly one Approved Plan Revision
```

绝不能：

```text
Run
→ 当前最新 Plan
```

否则执行过程中 Plan 变化会破坏审计边界。

---

# 八、模式与对象使用矩阵

| 对象 | Assessment | Build | Migration | Capture | Restore |
|---|---:|---:|---:|---:|---:|
| Source Endpoint | 必需 | 无 | 必需 | 必需 | 无 |
| Target Endpoint | 无 | 必需 | 必需 | 无 | 必需 |
| Source Snapshot | 必需 | 无 | 必需 | 必需 | Archive |
| Target Snapshot | 无 | 必需 | 必需 | 无 | 必需 |
| Inventory Graph | 必需 | 可选 | 必需 | 必需 | Archive 提供 |
| Workload Blueprint | 生成 | 输入 | 生成 | 生成并冻结 | 从 Archive 导入 |
| DecisionSet | 可选 | 必需 | 必需 | 必需 | 必需 |
| PlanRevision | 可选、只读建议 | Build | Migration | Capture | Restore |
| Dataset Contract | 分析 | 初始化 | 迁移 | 封存 | 恢复 |
| Cutover | 无 | 无 | 必需 | 无 | 通常无 |
| Environment Archive | 无 | 无 | 无 | 产生 | 消费 |
| Run | 分析 Run | Build Run | 多阶段 Run | Capture Run | Restore Run |

---

# 九、Project 和 Plan 的边界必须严格确定

## Project 可以修改

- 项目名称；
- Endpoint；
- 当前 Snapshot；
- Workload 识别；
- 用户决策；
- Draft Plan 选择；
- 维护窗口；
- 当前状态。

## Plan Revision 不可以修改

生成后即冻结：

- Snapshot 引用；
- Workload Revision；
- DecisionSet；
- Action；
- Dataset；
- Secret Requirement；
- Cutover；
- Verify；
- Rollback。

需要变更时：

```text
Plan Revision 3
→ Superseded

生成 Plan Revision 4
→ Review
→ Approve
```

## Run 不能修改 Plan

Run 只能：

- 执行动作；
- 记录结果；
- 暂停；
- 重试；
- 恢复；
- 失败；
- 回滚。

不能在执行过程中动态增加未审批 Action。

---

# 十、Project Type 是否允许修改？

建议：

> **Project Type 创建后不可修改。**

例如 Assessment 完成后，不把它改成 Migration。

正确做法：

```text
Assessment Project
→ Create linked Migration Project
```

优点：

- 保留原始审计；
- 不混淆生命周期；
- 可以从一次 Assessment 创建多个 Migration 或 Capture；
- 用户可以比较不同目标方案；
- 权限与 Report 更清晰。

关联字段：

```ts
interface ProjectLink {
  sourceProjectId: string;
  targetProjectId: string;
  relation:
    | "derived-from"
    | "restores-archive"
    | "retries"
    | "repairs";
}
```

---

# 十一、Plan 是否允许多次执行？

建议规则：

## Dry-run

同一个 Approved Plan 可以执行多次 Dry-run，但每次产生独立 Run。

## Live Run

同一个 Plan Revision：

- 可以只有一个活动 Live Run；
- 失败后优先恢复原 Run；
- 无法恢复时可以创建 Retry Run；
- Retry Run 必须重新检查 Snapshot Drift 和 Precondition；
- 如果输入环境发生实质变化，必须生成新 Plan Revision。

不能简单允许用户无限点击 Apply。

---

# 十二、Build 和 Migration 是否使用同一种 WorkloadBlueprint？

建议：**使用同一个 Blueprint Schema，但来源和允许字段不同。**

## Build Blueprint

通常明确：

- 要安装什么；
- 使用哪个模板；
- 目标状态是什么；
- 如何验证。

它可能没有：

- source evidence；
- data writers；
- quiesce；
- historical state。

## Discovered Blueprint

额外包含：

- source evidence；
- confidence；
- unresolved relations；
- inferred deployment source；
- existing datasets；
- ephemeral state policy。

因此可以在同一个模型中使用：

```ts
interface WorkloadBlueprint {
  origin: "catalog" | "template" | "discovered" | "archive";
  sourceEvidenceIds?: string[];
  confidence?: ConfidenceResult;
}
```

但不要为 Build 和 Migrate 创建两套完全独立的 Workload 类型。

---

# 十三、当前对象如何迁移到新模型

## 当前 `StoredMigrationSession`

演进为：

```text
EnvironmentProject(type = migration)
```

其中已有的 pipeline 状态可以暂时保留为 Project Workflow State。

## 当前 `EnvironmentPlan`

演进为：

```text
PlanRevision
```

新增：

- projectId；
- revision；
- planType；
- sourceSnapshotRef；
- targetSnapshotRef；
- workloadRevisionIds；
- decisionSetId；
- supersedesPlanId。

## 当前 `ApplyRun`

演进为统一：

```text
ExecutionRun(type = apply)
```

## 当前 Verify/Rollback 结果

不再直接覆盖 Plan 字段。

演进为：

```text
ExecutionRun(type = verify)
ExecutionRun(type = rollback)
```

## 当前 `ServiceStack`

不直接改名为 WorkloadBlueprint。

先演进为：

```text
WorkloadCandidate
```

因为当前 Service Stack：

- 关系不完整；
- 部分生产采集链不可达；
- 不进入 Planner；
- 缺少 Deployment、Dataset、Secret、Verification。

只有经过用户确认和补全，才生成 Blueprint。

## 当前 Inventory Graph

继续作为派生层保留。

但需要增加：

```text
Inventory Graph
→ Workload Candidate Builder
→ Workload Confirmation
→ Workload Blueprint
→ Planner
```

## 当前动态 Report

短期可以继续动态展示，但完成 Run 后必须生成不可变 ReportArtifact。

---

# 十四、建议立即锁定的设计决定

建议将以下结论作为下一阶段正式基线：

### 产品模式

1. 用户层使用四种模式：
   - Assessment；
   - Build；
   - Live Migration；
   - Preserve & Restore。

2. 领域层使用五种 Project Type：
   - assessment；
   - build；
   - migration；
   - capture；
   - restore。

3. Capture 和 Restore 是两个独立 Project，通过 Archive 关联。

### 核心对象

4. EnvironmentProject 是用户工作的根容器。

5. Snapshot 是不可变机器事实，Plan 必须引用具体 Snapshot Hash。

6. ServiceStack 演进为 WorkloadCandidate。

7. WorkloadBlueprint 是 Build、Migration、Capture、Restore 的共同核心。

8. DecisionSet 独立版本化。

9. Plan 使用 append-only PlanRevision。

10. Approved Plan 永远不可修改。

11. Run 与 Plan 分离。

12. Verify 和 Rollback 都改为独立 Run。

13. EnvironmentArchive 是长期恢复资产，不是 Snapshot 或普通 Artifact。

14. Report 必须最终成为不可变执行证据。

### 生命周期

15. Project Type 不允许原地修改，通过 Project Link 派生新项目。

16. 同一 Plan 只能有一个活动 Live Run。

17. 输入环境发生 Drift 后，必须重新生成 Plan Revision。

18. Restore 每次都必须针对具体目标生成新 Plan。

---

# 十五、这一轮暂时不要确定的内容

为了避免一次设计过深，以下内容先只保留接口位置，下一轮分别讨论：

- Workload 自动聚合算法；
- systemd 具体采集字段；
- Dataset 数据结构；
- PostgreSQL 迁移策略；
- Secret Provider；
- Cutover 状态机细节；
- Durable Queue 技术选型；
- Archive 对象存储方案；
- UI 具体页面；
- 数据库表设计。

这些都依赖本轮产品模式与对象边界。

---

# 十六、最终建议的领域结构

```text
EnvironmentProject
│
├── EnvironmentEndpoint
│   └── EnvironmentSnapshot
│       ├── Evidence
│       └── InventoryGraph
│
├── WorkloadCandidate
│   └── WorkloadBlueprint Revision
│
├── DecisionSet Revision
│
├── PlanRevision
│   ├── ActionGraph
│   ├── DatasetContract
│   ├── SecretRequirement
│   ├── CutoverContract
│   ├── VerificationContract
│   └── RollbackContract
│
├── ExecutionRun
│   ├── ActionRun
│   ├── TransferRun
│   ├── VerificationRun
│   └── RollbackRun
│
├── ReportArtifact
│
└── EnvironmentArchive
    └── 被 Restore Project 引用
```

## 本轮建议结论

产品模式与核心对象可以按上面的结构确定下来。

其中最关键的三项不可再改变：

> **Project 是工作空间，Plan 是不可变执行合同，Run 是真实执行实例。**

> **Workload Blueprint 是 Build、Migrate、Capture 和 Restore 的共同核心对象。**

> **Preserve & Restore 在用户层是一种需求，但在系统内部必须拆成 Capture Project、Environment Archive 和 Restore Project。**

下一步应确定 **Workload、Workload Candidate 与 Workload Blueprint 的边界和完整字段**，因为它决定 Inventory Graph 如何真正进入 Planner，也决定自定义网站、数据库、服务状态和数据如何被统一表达。

## Prompt:
2026/7/18 21:23:10

确定 Workload、Workload Candidate 与 Workload Blueprint 的边界和完整字段

## Response:
2026/7/18 21:23:13

我会先把三者的职责严格拆开：Candidate 负责“系统猜到了什么”，Workload 负责“这个业务是谁”，Blueprint 负责“这个业务如何被重建和验证”。然后给出完整字段、生命周期、晋升规则以及 Planner 的消费边界。

下面给出一套可以直接作为后续领域模型基线的定义。核心判断是：

> **Workload 是稳定的业务身份；Workload Candidate 是基于某次扫描产生的可推翻推断；Workload Blueprint 是经过确认、版本化、可供 Planner 消费的技术合同。**

当前 EnvForge 的 Service Stack 只能作为 Candidate 的前身，不能直接当 Blueprint，因为其关系不完整、部分测试输入高于真实 Collector 输出，而且尚未进入 Migration Planner。`8bead08a-b983-4703-97e2-6580c02aff9c.md`

**document: **

# EnvForge Workload 领域模型基线

## 一、三个对象的最终边界

| 对象 | 回答的问题 | 生命周期 | 是否可执行 | 是否版本化 |
|---|---|---|---:|---:|
| Workload Candidate | 系统猜测这里可能是什么业务？ | 绑定某次 Snapshot，可重新计算 | 否 | 算法批次版本 |
| Workload | 这个业务在 EnvForge 中是谁？ | 跨服务器、迁移、封存长期存在 | 否 | 稳定身份，不按技术变化改 ID |
| Workload Blueprint | 这个业务如何部署、运行、保存和验证？ | 每次技术定义变化产生新 Revision | 可被 Planner 消费，但不能直接执行 | 是，严格不可变 |

三者之间的关系：

```text
Snapshot + Inventory Graph
        ↓
Workload Candidates
        ↓ 用户确认、合并、拆分、补充
Workload
        ↓
Workload Blueprint Revision
        ↓
Decision Set + Target Snapshot
        ↓
Plan Revision
        ↓
Execution Run
```

必须严格禁止：

```text
Workload Candidate
→ 直接生成 Apply Action
```

Planner 只能消费已确认的 Blueprint Revision。

---

# 二、Workload 的准确含义

## 1. Workload 不是软件

以下都不是独立 Workload 的充分条件：

- 安装了 Nginx；
- 存在 PostgreSQL 包；
- 监听了 3000 端口；
- 存在一个 systemd unit；
- 存在一个 Docker container。

Workload 应表示一个用户能够理解、独立管理和验证的业务或平台服务。

例如：

```text
个人博客
公司内部 Git 服务
家庭相册
监控平台
共享 PostgreSQL 服务
反向代理平台
定时备份服务
```

## 2. Workload 的边界判断

一个对象是否应属于同一个 Workload，依次检查五个条件。

### 业务目标是否相同

这些组件是否共同提供一个用户可识别的功能？

例如：

```text
Nginx + Node.js + blog database + uploads
```

共同提供“个人博客”，可以属于同一个 Workload。

### 生命周期是否耦合

它们是否通常一起部署、升级、停止、迁移和恢复？

如果一个组件可以独立升级或由其他业务共同使用，更适合成为独立 Workload。

### 数据归属是否一致

数据是否明确属于同一个业务？

例如：

- `blog_production` 数据库属于博客；
- PostgreSQL 实例还承载其他业务时，实例本身是共享服务；
- 博客数据库是博客的数据集，不代表整个 PostgreSQL 服务都应被并入博客。

### Cutover 边界是否一致

迁移时它们是否需要一起进入维护、一起切换、一起验证？

若不需要，应拆分为多个 Workload，通过依赖关系关联。

### 运营负责人是否一致

是否由同一用户或团队维护？

不同负责人管理的服务即使运行在同一台机器，也不应被系统强行合并。

---

# 三、共享服务的处理原则

共享依赖是 Workload 边界最容易设计错误的地方。

## 1. 专用组件

如果 Nginx、数据库实例和 Redis 只服务一个应用，可以作为该 Workload 的内部组件。

```text
Blog Workload
├── Dedicated Nginx
├── Blog App
├── Dedicated PostgreSQL
└── Uploads
```

## 2. 共享组件

如果一个 PostgreSQL 实例承载多个数据库：

```text
Shared PostgreSQL Workload
├── blog_production dataset
├── gitea dataset
└── analytics dataset
```

应用 Workload 通过依赖引用它：

```text
Blog Workload
→ depends_on
→ Shared PostgreSQL Workload / blog_production
```

## 3. 外部依赖

如果数据库由云服务托管：

```text
Blog Workload
→ external_dependency
→ Managed PostgreSQL
```

EnvForge 只验证连接和 Secret，不迁移该数据库服务本身，除非用户明确创建相应迁移项目。

## 4. 组件所有权

所有 Component 和 Dataset 都必须标记：

```ts
type OwnershipMode =
  | "exclusive"
  | "shared"
  | "external"
  | "unknown";
```

这样可避免：

- 同一个目录被两个 Workload 重复复制；
- 同一个数据库实例被两个迁移计划重复停止；
- 共享 Nginx 被错误归入单个网站；
- 共享 cron 被重复创建。

---

# 四、Workload：稳定的业务身份

Workload 只负责表达：

> 这个业务是谁，它现在处于什么生命周期，当前采用哪一版 Blueprint。

它不保存完整配置、具体 Action 或当前进度。

```ts
interface Workload {
  id: string;
  workspaceId: string;

  identity: WorkloadIdentity;

  lifecycleStatus:
    | "active"
    | "inactive"
    | "archived"
    | "retired"
    | "unknown";

  currentBlueprintRevisionId?: string;

  placements: WorkloadPlacementRef[];

  projectLinks: WorkloadProjectLink[];

  archiveRefs: string[];

  lineage: WorkloadLineage;

  metadata: {
    tags: string[];
    labels: Record<string, string>;
    notes?: string;
  };

  createdAt: string;
  createdBy: string;
  updatedAt: string;
}
```

## 1. WorkloadIdentity

```ts
interface WorkloadIdentity {
  name: string;
  slug: string;

  kind:
    | "application"
    | "data-service"
    | "platform-service"
    | "container-stack"
    | "scheduled-service"
    | "infrastructure"
    | "custom";

  archetype?: string;
  description?: string;

  businessCriticality:
    | "low"
    | "medium"
    | "high"
    | "critical"
    | "unknown";

  owners: WorkloadOwner[];

  environment:
    | "development"
    | "testing"
    | "staging"
    | "production"
    | "personal"
    | "unknown";
}
```

`archetype` 可以是：

```text
custom-node-web-app
wordpress
gitea
postgresql-service
docker-compose-stack
shared-reverse-proxy
```

`kind` 是稳定的大分类，`archetype` 可以由 Capability 扩展。

## 2. WorkloadPlacementRef

Workload 需要跨源机器、目标机器和 Archive 保持身份，因此需要环境位置引用。

```ts
interface WorkloadPlacementRef {
  id: string;

  endpointId?: string;
  archiveId?: string;

  role:
    | "source"
    | "target"
    | "active"
    | "standby"
    | "archived";

  blueprintRevisionId: string;

  observedSnapshotId?: string;

  status:
    | "observed"
    | "planned"
    | "preparing"
    | "running"
    | "stopped"
    | "released"
    | "unknown";

  activatedAt?: string;
  deactivatedAt?: string;
}
```

Workload 本身不能直接保存：

- PID；
- 当前 CPU；
- 当前监听连接；
- 当前传输进度。

这些属于 Snapshot 或 Run。

## 3. WorkloadLineage

```ts
interface WorkloadLineage {
  createdFrom:
    | "candidate"
    | "catalog"
    | "template"
    | "archive"
    | "user";

  sourceCandidateIds?: string[];
  sourceWorkloadId?: string;
  clonedFromWorkloadId?: string;
  restoredFromArchiveId?: string;
}
```

## 4. Workload ID 什么时候改变

以下情况不改变 Workload ID：

- 从旧服务器迁到新服务器；
- 重新部署；
- 修改 Node.js 版本；
- 更换数据库版本；
- 从 systemd 改成 Docker；
- Capture 后 Restore；
- Blueprint Revision 更新。

以下情况应新建 Workload：

- 用户确认原来识别为一个业务的内容实际是两个业务；
- 一个系统拆成独立服务并拥有独立生命周期；
- 从模板创建一个新的独立副本；
- 用户明确克隆为另一个生产实例。

---

# 五、Workload Candidate：系统推断层

Candidate 表示：

> 系统根据特定 Snapshot、Graph 和识别算法提出的业务边界假设。

它可能错误，也允许彼此重叠。

```ts
interface WorkloadCandidate {
  id: string;
  projectId: string;

  sourceEndpointId: string;
  sourceSnapshotId: string;
  sourceSnapshotHash: string;

  generation: CandidateGenerationInfo;

  status:
    | "generated"
    | "under-review"
    | "accepted"
    | "merged"
    | "split"
    | "dismissed"
    | "superseded";

  proposedIdentity: ProposedWorkloadIdentity;

  componentCandidates: ComponentCandidate[];

  relationCandidates: RelationCandidate[];

  evidenceAssignments: EvidenceAssignment[];

  boundaryHypothesis: BoundaryHypothesis;

  confidence: CandidateConfidence;

  completeness: CandidateCompleteness;

  unresolvedQuestions: CandidateQuestion[];

  conflicts: CandidateConflict[];

  recommendations: CandidateRecommendation[];

  reviewResult?: CandidateReviewResult;

  candidateHash: string;

  createdAt: string;
  supersededAt?: string;
}
```

## 1. CandidateGenerationInfo

```ts
interface CandidateGenerationInfo {
  algorithmVersion: string;
  graphVersion: string;
  rulesetVersion: string;
  generatedAt: string;

  inputs: {
    snapshotIds: string[];
    graphHash: string;
    catalogVersion?: string;
  };
}
```

Candidate 必须记录算法版本，否则重新扫描后无法解释：

> 为什么上一次识别成一个服务，这一次识别成两个？

## 2. ProposedWorkloadIdentity

```ts
interface ProposedWorkloadIdentity {
  proposedName: string;

  proposedKind:
    | "application"
    | "data-service"
    | "platform-service"
    | "container-stack"
    | "scheduled-service"
    | "infrastructure"
    | "custom"
    | "unknown";

  proposedArchetype?: string;

  titleEvidenceIds: string[];
}
```

## 3. ComponentCandidate

```ts
interface ComponentCandidate {
  id: string;

  proposedType: ComponentType;
  proposedRole?: string;
  proposedName: string;

  evidenceIds: string[];

  ownership:
    | "exclusive"
    | "shared"
    | "external"
    | "unknown";

  required:
    | "required"
    | "optional"
    | "unknown";

  confidence: number;

  warnings: string[];
}
```

建议的 ComponentType：

```ts
type ComponentType =
  | "application-runtime"
  | "system-service"
  | "reverse-proxy"
  | "database-service"
  | "cache-service"
  | "message-broker"
  | "container"
  | "compose-project"
  | "package-set"
  | "certificate-service"
  | "scheduler"
  | "file-service"
  | "observability-agent"
  | "custom";
```

## 4. RelationCandidate

```ts
interface RelationCandidate {
  id: string;

  fromComponentId: string;
  toComponentId?: string;
  targetWorkloadCandidateId?: string;

  type:
    | "starts"
    | "depends-on"
    | "proxies-to"
    | "connects-to"
    | "reads"
    | "writes"
    | "mounts"
    | "exposes"
    | "scheduled-by"
    | "secured-by"
    | "owned-by";

  evidenceIds: string[];

  confidence: number;
  inferredBy: string;
  userConfirmed?: boolean;
}
```

## 5. EvidenceAssignment

Candidate 需要明确每条 Evidence 的归属，而不是只保存 Evidence 数组。

```ts
interface EvidenceAssignment {
  evidenceId: string;

  role:
    | "primary"
    | "supporting"
    | "shared-reference"
    | "possible"
    | "excluded";

  componentCandidateId?: string;

  confidence: number;
  reason: string;
}
```

规则：

- 同一个 Evidence 最多只能属于一个 Candidate 的 `primary`；
- 可以被多个 Candidate 作为 `shared-reference`；
- 用户确认排除后必须保留审计记录。

## 6. BoundaryHypothesis

```ts
interface BoundaryHypothesis {
  reasonsToGroup: string[];
  reasonsToSplit: string[];

  lifecycleCoupling:
    | "strong"
    | "medium"
    | "weak"
    | "unknown";

  dataOwnership:
    | "clear"
    | "mixed"
    | "shared"
    | "unknown";

  operationalOwnership:
    | "same-owner"
    | "multiple-owners"
    | "unknown";

  cutoverCoupling:
    | "must-move-together"
    | "can-move-separately"
    | "unknown";
}
```

## 7. CandidateConfidence

不能只有一个百分比。

```ts
interface CandidateConfidence {
  overall: number;

  dimensions: {
    identity: number;
    componentCoverage: number;
    relationStrength: number;
    dataOwnership: number;
    deploymentUnderstanding: number;
    runtimeUnderstanding: number;
  };

  explanation: string[];
}
```

## 8. CandidateCompleteness

```ts
interface CandidateCompleteness {
  collectorCompleteness: number;
  evidenceCoverage: number;

  hasRuntimeEntry: boolean;
  hasDeploymentSource: boolean;
  hasConfigCoverage: boolean;
  hasDatasetCoverage: boolean;
  hasSecretCoverage: boolean;
  hasEndpointCoverage: boolean;
  hasVerificationCandidate: boolean;

  missingSurfaces: string[];
}
```

## 9. CandidateQuestion

```ts
interface CandidateQuestion {
  id: string;

  type:
    | "confirm-boundary"
    | "classify-component"
    | "confirm-data"
    | "confirm-deployment-source"
    | "confirm-secret"
    | "confirm-dependency"
    | "confirm-endpoint"
    | "confirm-shared-service";

  question: string;

  affectedEvidenceIds: string[];
  affectedComponentIds: string[];

  blocking: boolean;

  suggestedAnswers: CandidateQuestionAnswer[];
}
```

问题应面向业务：

```text
“/var/lib/blog/uploads 是否属于个人博客的用户数据？”
```

而不是：

```text
“是否迁移 DataPath node dp-182？”
```

## 10. CandidateReviewResult

```ts
interface CandidateReviewResult {
  action:
    | "accept"
    | "merge"
    | "split"
    | "dismiss";

  resultingWorkloadIds?: string[];
  resultingBlueprintRevisionIds?: string[];

  mergedCandidateIds?: string[];

  evidenceOverrides: EvidenceAssignment[];

  reviewedBy: string;
  reviewedAt: string;
}
```

---

# 六、Candidate 的生命周期和操作

## 1. Accept

```text
Candidate
→ 创建 Workload
→ 创建 Blueprint Revision 1
```

## 2. Merge

例如系统分别识别：

- Nginx 网站；
- Node.js 服务；
- PostgreSQL 数据库。

用户确认它们属于一个个人博客：

```text
Candidate A
Candidate B
Candidate C
→ Merge Review
→ 一个 Workload
→ Blueprint Revision 1
```

原 Candidate 标记为 `merged`，不可删除。

## 3. Split

系统把一个共享 Nginx 和三个网站识别为一个 Candidate。

用户拆分为：

```text
Shared Reverse Proxy Workload
Blog Workload
Photo Workload
Wiki Workload
```

原 Candidate 标记为 `split`。

## 4. Dismiss

适用于：

- 系统噪声；
- 临时测试进程；
- 用户不需要迁移的工具；
- 已废弃服务。

Dismiss 不代表 Evidence 消失，只表示：

```text
不创建 Workload
```

## 5. Recompute

新 Snapshot 产生后，应生成新 Candidate Generation。

旧 Candidate 不原地更新：

```text
Candidate Generation 3
→ superseded

Candidate Generation 4
→ generated
```

已确认的 Workload 和 Blueprint 不会自动被新 Candidate 覆盖。

系统应生成 Drift 或 Blueprint Update Proposal。

---

# 七、Workload Blueprint：可重建技术合同

Blueprint 表示：

> 在不依赖某台特定服务器临时状态的情况下，如何定义、部署、运行、保存和验证这个 Workload。

Blueprint 不是 Plan。

Blueprint 描述“需要什么”，Plan 描述“针对这台目标机具体执行什么”。

```ts
interface WorkloadBlueprint {
  id: string;
  workloadId: string;

  revision: number;

  status:
    | "draft"
    | "confirmed"
    | "superseded"
    | "retired";

  origin:
    | "discovered"
    | "catalog"
    | "template"
    | "archive"
    | "user-defined";

  parentRevisionId?: string;

  identity: BlueprintIdentity;

  provenance: BlueprintProvenance;

  scope: BlueprintScope;

  components: WorkloadComponent[];

  runtimeContracts: RuntimeContract[];

  deploymentContracts: DeploymentContract[];

  configContracts: ConfigContract[];

  datasetContracts: DatasetContract[];

  secretRequirements: SecretRequirement[];

  endpointContracts: EndpointContract[];

  identityContracts: SystemIdentityContract[];

  scheduledTaskContracts: ScheduledTaskContract[];

  dependencies: DependencyContract[];

  externalDependencies: ExternalDependencyContract[];

  ephemeralStatePolicies: EphemeralStatePolicy[];

  compatibilityEnvelope: CompatibilityEnvelope;

  verificationContract: VerificationContract;

  operationalRequirements: OperationalRequirements;

  migrationRequirements?: MigrationRequirements;

  captureRequirements?: CaptureRequirements;

  unresolvedRequirements: BlueprintRequirement[];

  knownLimitations: KnownLimitation[];

  readiness: BlueprintReadiness;

  contentHash: string;

  createdAt: string;
  createdBy: string;
  confirmedAt?: string;
}
```

每个 Revision 生成后不可原地修改。

修改字段必须创建新 Revision。

---

# 八、Blueprint 顶层字段

## 1. BlueprintIdentity

```ts
interface BlueprintIdentity {
  name: string;
  kind: WorkloadIdentity["kind"];
  archetype?: string;
  description?: string;

  capabilityRefs: {
    capabilityId: string;
    capabilityVersion: string;
    role: "primary" | "supporting";
  }[];
}
```

一个 Blueprint 可以引用多个 Capability：

```text
custom-node-app
nginx
postgresql
certbot
```

Capability 不等于 Workload，只是实现知识来源。

## 2. BlueprintProvenance

```ts
interface BlueprintProvenance {
  basedOnCandidateIds: string[];

  sourceSnapshotRefs: {
    endpointId: string;
    snapshotId: string;
    snapshotHash: string;
  }[];

  sourceEvidenceIds: string[];

  sourceBlueprintRevisionId?: string;
  archiveId?: string;
  templateId?: string;

  userOverrides: UserOverrideRecord[];

  generatorVersion: string;
}
```

Build Blueprint 可以没有 Source Snapshot。

Migration、Capture 生成的 Blueprint 必须保留 Source Snapshot 和 Evidence 引用。

## 3. BlueprintScope

```ts
interface BlueprintScope {
  ownership:
    | "standalone"
    | "shared-service"
    | "dependent-workload"
    | "external-service";

  componentCount: number;

  requiredWorkloadDependencies: string[];

  optionalWorkloadDependencies: string[];

  sharedResourceRefs: SharedResourceRef[];
}
```

---

# 九、WorkloadComponent

Component 是 Workload 内部的功能部件，不应成为用户一级审批对象。

```ts
interface WorkloadComponent {
  id: string;

  type: ComponentType;
  name: string;
  role: string;

  ownership:
    | "exclusive"
    | "shared"
    | "external";

  required: boolean;

  runtimeContractIds: string[];
  deploymentContractIds: string[];
  configContractIds: string[];
  datasetContractIds: string[];
  secretRequirementIds: string[];
  endpointContractIds: string[];
  scheduledTaskContractIds: string[];

  dependencyIds: string[];

  sourceBindings: SourceComponentBinding[];

  desiredState:
    | "running"
    | "available-on-demand"
    | "scheduled"
    | "installed-only"
    | "disabled";

  migrationDisposition:
    | "rebuild"
    | "transfer"
    | "restore"
    | "reuse-target"
    | "external"
    | "skip"
    | "manual";

  evidenceIds: string[];

  knownLimitations: string[];
}
```

`SourceComponentBinding` 只描述源环境中的实现：

```ts
interface SourceComponentBinding {
  endpointId: string;
  snapshotId: string;

  serviceNames?: string[];
  processIds?: string[];
  containerIds?: string[];
  packageNames?: string[];
  paths?: string[];
}
```

Blueprint 不能保存 PID 作为未来恢复要求。

---

# 十、RuntimeContract

描述服务应该如何运行。

```ts
interface RuntimeContract {
  id: string;
  componentId: string;

  executionModel:
    | "systemd"
    | "container"
    | "compose"
    | "cron"
    | "timer"
    | "socket-activated"
    | "manual"
    | "external";

  entrypoint?: string[];
  workingDirectory?: string;

  runAs: {
    userRef?: string;
    groupRef?: string;
  };

  environmentRefIds: string[];

  startup: {
    enabled: boolean;
    restartPolicy:
      | "always"
      | "on-failure"
      | "never"
      | "unknown";

    restartDelaySeconds?: number;

    afterComponentIds: string[];
    beforeComponentIds: string[];

    startupTimeoutSeconds?: number;
    shutdownTimeoutSeconds?: number;
  };

  resourceRequirements: {
    minimumMemoryBytes?: number;
    recommendedMemoryBytes?: number;
    cpuLimit?: number;
    openFileLimit?: number;
  };

  securityContext: {
    privileged: boolean;
    capabilities: string[];
    readOnlyRootFilesystem?: boolean;
    allowedWritePaths: string[];
  };

  healthCheckRef?: string;

  sourceEvidenceIds: string[];
}
```

对于 systemd，应保存规范化合同，而不是只复制 unit 文本。

同时允许 ConfigContract 保存原始 unit Artifact 作为审计和兼容转换依据。

---

# 十一、DeploymentContract

描述如何获得和部署软件或应用。

```ts
interface DeploymentContract {
  id: string;
  componentId: string;

  method:
    | "package"
    | "git"
    | "container-image"
    | "compose"
    | "binary-artifact"
    | "directory-artifact"
    | "generated"
    | "manual";

  source: DeploymentSource;

  versionConstraint?: string;
  exactVersion?: string;
  digest?: string;

  build: {
    required: boolean;
    runtimeRequirements: string[];
    commands: string[];
    outputArtifactPaths: string[];
  };

  install: {
    targetPath?: string;
    requiredPackages: string[];
    generatedDirectories: string[];
  };

  portability:
    | "portable"
    | "requires-rebuild"
    | "architecture-specific"
    | "os-specific"
    | "unknown";

  fallbackArtifactRef?: string;

  validationCheckIds: string[];

  sourceEvidenceIds: string[];
}
```

`DeploymentSource`：

```ts
type DeploymentSource =
  | {
      type: "package";
      packageName: string;
      repository?: string;
    }
  | {
      type: "git";
      repository: string;
      commit: string;
      subdirectory?: string;
    }
  | {
      type: "container-image";
      image: string;
      digest: string;
    }
  | {
      type: "artifact";
      artifactRef: string;
      checksum: string;
    }
  | {
      type: "manual";
      instructions: string[];
    };
```

Blueprint 可以保存经过批准的构建命令定义，但不能保存目标机特定的 shell 展开结果。

具体 Action 由 Plan Compiler 生成。

---

# 十二、ConfigContract

```ts
interface ConfigContract {
  id: string;
  componentId: string;

  logicalName: string;

  sourcePath?: string;
  targetPathPolicy: {
    preferredPath?: string;
    allowRelocation: boolean;
  };

  format:
    | "env"
    | "ini"
    | "yaml"
    | "json"
    | "toml"
    | "nginx"
    | "systemd"
    | "text"
    | "binary"
    | "unknown";

  strategy:
    | "copy"
    | "template"
    | "regenerate"
    | "merge"
    | "target-existing"
    | "manual";

  artifactRef?: string;
  templateRef?: string;

  ownerRef?: string;
  groupRef?: string;
  mode?: string;

  containsSecretRequirementIds: string[];

  portabilityRules: ConfigPortabilityRule[];

  validationCheckIds: string[];

  sourceEvidenceIds: string[];
}
```

不能把 Secret 明文放进 `artifactRef`。

包含 Secret 的配置需要模板化或执行时注入。

---

# 十三、DatasetContract

Dataset 是 Workload 中真正需要保持的持久状态。

```ts
interface DatasetContract {
  id: string;

  name: string;

  ownerWorkloadId: string;
  ownerComponentId?: string;

  ownership:
    | "exclusive"
    | "shared"
    | "external";

  kind:
    | "filesystem"
    | "postgresql"
    | "mysql"
    | "redis"
    | "sqlite"
    | "object-storage"
    | "docker-volume"
    | "git-repository"
    | "message-store"
    | "custom";

  sourceLocation: DatasetLocation;

  estimatedSizeBytes?: number;
  estimatedFileCount?: number;

  writerComponentIds: string[];

  consistencyRequirement:
    | "crash-consistent"
    | "filesystem-consistent"
    | "application-consistent"
    | "transaction-consistent"
    | "eventually-consistent"
    | "manual";

  portability:
    | "logical"
    | "physical"
    | "file-copy"
    | "recreatable"
    | "external"
    | "unknown";

  supportedStrategies: DatasetStrategyCapability[];

  preferredStrategy?: string;

  targetRequirements: {
    minimumCapacityBytes?: number;
    requiredFilesystemFeatures: string[];
    requiredServiceVersions: string[];
  };

  verificationCheckIds: string[];

  rollbackCapability:
    | "full"
    | "partial"
    | "manual"
    | "none"
    | "unknown";

  sourceEvidenceIds: string[];
}
```

Blueprint 只描述策略能力和要求。

具体的：

- dump 命令；
- 目标路径；
- initial sync；
- final sync；
- 传输 Session；

属于 PlanRevision 和 Run。

---

# 十四、SecretRequirement

```ts
interface SecretRequirement {
  id: string;

  logicalName: string;
  purpose: string;

  consumerComponentIds: string[];

  sourceRefs: {
    sourceLocation: string;
    fingerprint?: string;
  }[];

  requiredAt:
    | "plan"
    | "prepare"
    | "restore"
    | "startup"
    | "verification";

  allowedProviders:
    | "user-input"
    | "vault"
    | "sops"
    | "target-existing"
    | "regenerate"
    | "out-of-band";

  preferredProvider?: string;

  injection:
    | "environment"
    | "file"
    | "stdin"
    | "command"
    | "external-reference";

  targetReference?: string;

  persistence:
    | "runtime-only"
    | "target-persistent"
    | "external-only";

  rotation:
    | "preserve"
    | "rotate-before-use"
    | "rotate-after-restore"
    | "regenerate";

  validationCheckIds: string[];

  required: boolean;

  sourceEvidenceIds: string[];
}
```

绝不能包含：

```ts
value: string;
```

Secret Provider Binding 属于 DecisionSet 或 Plan，不属于 Blueprint。

---

# 十五、EndpointContract

```ts
interface EndpointContract {
  id: string;
  componentId: string;

  name: string;

  protocol:
    | "http"
    | "https"
    | "tcp"
    | "udp"
    | "ssh"
    | "database"
    | "custom";

  bindPolicy:
    | "loopback"
    | "private"
    | "public"
    | "socket"
    | "dynamic";

  port?: number;
  socketPath?: string;

  exposure:
    | "internal"
    | "workload"
    | "host"
    | "public";

  domainRefs: string[];

  tls: {
    required: boolean;
    certificateStrategy?:
      | "preserve"
      | "reissue"
      | "target-existing"
      | "manual";
  };

  upstreamComponentIds: string[];
  downstreamComponentIds: string[];

  healthCheckId?: string;

  cutoverRequired: boolean;

  sourceEvidenceIds: string[];
}
```

---

# 十六、SystemIdentityContract

```ts
interface SystemIdentityContract {
  id: string;

  type: "user" | "group";

  name: string;

  sourceUid?: number;
  sourceGid?: number;

  portability:
    | "preserve-id"
    | "preserve-name"
    | "map-to-target"
    | "create-new"
    | "manual";

  homeDirectory?: string;
  shell?: string;

  memberships: string[];

  conflictPolicy:
    | "reuse"
    | "map"
    | "rename"
    | "block";

  requiredByComponentIds: string[];

  sourceEvidenceIds: string[];
}
```

---

# 十七、ScheduledTaskContract

```ts
interface ScheduledTaskContract {
  id: string;
  componentId?: string;

  type:
    | "cron"
    | "systemd-timer"
    | "application-scheduler"
    | "external";

  schedule: string;
  command?: string[];

  runAsUserRef?: string;
  workingDirectory?: string;

  concurrencyPolicy:
    | "allow"
    | "forbid"
    | "replace"
    | "unknown";

  migrationBehavior:
    | "disable-source-before-target"
    | "enable-after-cutover"
    | "preserve-disabled"
    | "manual";

  activeJobPolicy:
    | "wait"
    | "cancel"
    | "checkpoint"
    | "restart"
    | "manual";

  sourceEvidenceIds: string[];
}
```

---

# 十八、DependencyContract

```ts
interface DependencyContract {
  id: string;

  fromComponentId?: string;
  fromWorkloadId?: string;

  target:
    | {
        type: "component";
        componentId: string;
      }
    | {
        type: "workload";
        workloadId: string;
      }
    | {
        type: "external";
        externalDependencyId: string;
      };

  relationship:
    | "requires"
    | "connects-to"
    | "proxies-to"
    | "reads-from"
    | "writes-to"
    | "authenticated-by"
    | "scheduled-by";

  required:
    | "hard"
    | "soft"
    | "optional";

  startupDependency: boolean;
  runtimeDependency: boolean;
  migrationDependency: boolean;

  failureBehavior:
    | "block-startup"
    | "degraded"
    | "retry"
    | "manual";

  verificationCheckIds: string[];

  sourceEvidenceIds: string[];
}
```

---

# 十九、ExternalDependencyContract

```ts
interface ExternalDependencyContract {
  id: string;

  name: string;

  type:
    | "managed-database"
    | "object-storage"
    | "dns-provider"
    | "identity-provider"
    | "smtp"
    | "external-api"
    | "license-server"
    | "package-registry"
    | "source-repository"
    | "custom";

  endpoint?: string;

  credentialRequirementIds: string[];

  availabilityRequired:
    | "build-time"
    | "runtime"
    | "restore-time"
    | "verification-time";

  portabilityRisk:
    | "low"
    | "medium"
    | "high"
    | "unknown";

  validationCheckIds: string[];
}
```

---

# 二十、EphemeralStatePolicy

这是迁移“正在运行的服务状态”的关键合同。

它不保存瞬时状态内容，而是规定如何处理。

```ts
interface EphemeralStatePolicy {
  id: string;

  componentId: string;

  stateType:
    | "http-requests"
    | "tcp-connections"
    | "database-transactions"
    | "file-locks"
    | "memory-cache"
    | "memory-session"
    | "in-memory-queue"
    | "active-jobs"
    | "leader-election"
    | "temporary-files"
    | "active-scheduled-task"
    | "custom";

  durability:
    | "ephemeral"
    | "partially-durable"
    | "durable";

  handling:
    | "drain"
    | "quiesce"
    | "checkpoint"
    | "restart"
    | "rebuild"
    | "discard"
    | "manual";

  maximumDrainSeconds?: number;

  preCutoverCheckIds: string[];

  lossImpact:
    | "none"
    | "minor"
    | "user-visible"
    | "data-loss"
    | "unknown";

  userConfirmationRequired: boolean;

  notes: string[];
}
```

例如：

```text
HTTP 请求 → drain
PostgreSQL 事务 → wait/quiesce
内存缓存 → rebuild
内存 session → discard 或外置
worker job → checkpoint/requeue/manual
cron → source disable before target enable
```

---

# 二十一、CompatibilityEnvelope

Blueprint 需要描述自身的可移植边界，但不能绑定某台目标机器。

```ts
interface CompatibilityEnvelope {
  architectures: {
    supported: string[];
    blocked: string[];
  };

  operatingSystems: {
    supportedFamilies: string[];
    supportedVersions?: string[];
  };

  runtimeRequirements: {
    name: string;
    versionRange: string;
  }[];

  serviceVersionRequirements: {
    service: string;
    minimum?: string;
    maximum?: string;
    preferred?: string;
  }[];

  kernelRequirements: string[];
  libcRequirements: string[];

  filesystemRequirements: {
    minimumBytes?: number;
    requiredFeatures: string[];
    caseSensitivity?: "required" | "forbidden" | "either";
  };

  networkRequirements: {
    requiredPorts: number[];
    outboundDestinations: string[];
    publicIpRequired: boolean;
  };

  securityRequirements: {
    privilegedRequired: boolean;
    requiredCapabilities: string[];
    incompatibleSecurityModules: string[];
  };

  externalDependencyIds: string[];

  licensingConstraints: string[];

  portability:
    | "high"
    | "medium"
    | "low"
    | "unknown";
}
```

未来 Target Compatibility Engine 使用：

```text
Blueprint Compatibility Envelope
+
Target Snapshot
→ Compatibility Result
```

---

# 二十二、VerificationContract

```ts
interface VerificationContract {
  checks: VerificationCheck[];

  successPolicy:
    | "all-required"
    | "threshold"
    | "manual-approval";

  commitGate: boolean;

  observationRequirements?: {
    durationSeconds: number;
    checksRepeatedEverySeconds?: number;
  };
}
```

```ts
interface VerificationCheck {
  id: string;

  layer:
    | "artifact"
    | "syntax"
    | "runtime"
    | "network"
    | "dependency"
    | "data"
    | "business";

  name: string;

  targetComponentIds: string[];

  required: boolean;

  definition:
    | CommandCheckDefinition
    | HttpCheckDefinition
    | DatabaseCheckDefinition
    | FileCheckDefinition
    | ManualCheckDefinition;

  successCriteria: string;

  timeoutSeconds: number;

  sourceBaselineRef?: string;

  safeToRunRepeatedly: boolean;
}
```

Blueprint 保存验证定义。

具体目标 IP、命令模板展开和 Secret Binding 由 Plan 完成。

---

# 二十三、OperationalRequirements

```ts
interface OperationalRequirements {
  startupOrder: string[];
  shutdownOrder: string[];

  desiredAvailability:
    | "always-on"
    | "on-demand"
    | "scheduled"
    | "manual";

  maximumStartupSeconds?: number;
  maximumShutdownSeconds?: number;

  backupRequirements: {
    required: boolean;
    maximumDataLossSeconds?: number;
    maximumRecoverySeconds?: number;
  };

  observabilityRequirements: {
    requiredLogs: string[];
    requiredMetrics: string[];
    requiredHealthSignals: string[];
  };
}
```

---

# 二十四、MigrationRequirements

Blueprint 不保存完整 Cutover Plan，但需要保存迁移约束。

```ts
interface MigrationRequirements {
  downtimeTolerance:
    | "zero"
    | "seconds"
    | "minutes"
    | "hours"
    | "unspecified";

  sourceDrainRequired: boolean;
  sourceQuiesceRequired: boolean;
  initialSyncSupported: boolean;
  finalSyncRequired: boolean;

  trafficSwitchRequired: boolean;

  migrationOrderConstraints: string[];

  rollbackWindowRequired: boolean;

  userDecisionsRequired: string[];
}
```

具体维护时间、DNS 记录和目标 IP 属于 Migration Plan。

---

# 二十五、CaptureRequirements

```ts
interface CaptureRequirements {
  deploymentArtifactsRequired: boolean;
  configArtifactsRequired: boolean;

  datasetArchiveRequired: boolean;

  secretPreservation:
    | "requirements-only"
    | "encrypted-copy-allowed"
    | "external-provider-required";

  consistencyPointRequired: boolean;

  restoreDrill:
    | "required"
    | "recommended"
    | "optional";

  minimumIntegrityLevel:
    | "captured"
    | "hash-verified"
    | "restore-plan-ready"
    | "restore-tested";
}
```

---

# 二十六、BlueprintReadiness

Blueprint 是否可以交给 Planner，不能只依赖用户点击“确认”。

```ts
interface BlueprintReadiness {
  status:
    | "incomplete"
    | "review-required"
    | "planner-ready"
    | "blocked";

  dimensions: {
    componentCoverage: number;
    runtimeCoverage: number;
    deploymentCoverage: number;
    configCoverage: number;
    datasetCoverage: number;
    secretCoverage: number;
    dependencyCoverage: number;
    verificationCoverage: number;
  };

  blockers: string[];
  warnings: string[];
}
```

## Planner Ready 的最低条件

### Build

必须具备：

- 部署方法；
- 目标状态；
- 必要配置；
- Secret Requirement；
- 基础验证。

### Migration

额外必须具备：

- 数据集归属；
- 服务期望状态；
- writer 识别或人工确认；
- Ephemeral State Policy；
- 数据一致性要求；
- Cutover 需求；
- 业务验证。

### Capture

额外必须具备：

- 所有关键数据集；
- 部署材料；
- Secret 恢复策略；
- Compatibility Envelope；
- Restore Verification；
- 未归属 Evidence 处理结果。

---

# 二十七、Blueprint 中明确禁止保存的内容

不能保存：

- Secret 明文；
- 当前 PID；
- 当前 TCP 连接；
- 当前事务内容；
- 当前传输进度；
- 动态 Run 日志；
- 目标机具体执行命令；
- 临时签名 URL；
- SSH 凭据；
- 用户密码；
- 最新但未固定的软件版本；
- 未经审查的原始 shell；
- 目标机具体冲突处理结果。

这些属于：

- Secret Provider；
- Snapshot；
- Plan；
- Run；
- Connection；
- DecisionSet。

---

# 二十八、Planner 的正式输入边界

Migration Planner 不应再直接消费：

```text
snapshot.software[]
configChecklist[]
```

正式输入应为：

```ts
interface PlanCompilerInput {
  projectId: string;

  projectType:
    | "build"
    | "migration"
    | "capture"
    | "restore";

  workloadBlueprintRevisionIds: string[];

  decisionSetRevisionId: string;

  sourceSnapshotRef?: SnapshotRef;
  targetSnapshotRef?: SnapshotRef;
  archiveRef?: ArchiveRef;

  targetCompatibilityResult?: CompatibilityResult;
}
```

Planner 输出：

```text
Plan Revision
├── target-specific actions
├── Dataset Execution Contracts
├── Secret Provider Bindings
├── Transfer specifications
├── Cutover Contract
├── Verification Contract
└── Rollback Contract
```

Blueprint 自身不包含目标机具体动作。

---

# 二十九、从 Candidate 晋升到 Blueprint 的门禁

Candidate 只有满足以下条件才可晋升。

## 必须完成

- 用户确认业务边界；
- 所有关键 Component 已分类；
- 主要运行入口已识别；
- 数据路径已确认；
- Secret 引用已确认；
- 共享依赖已拆分或标记；
- 未归属高风险 Evidence 已处理；
- 基础验证方式已定义。

## 可以暂时不完整

- 目标机器兼容性；
- 具体数据执行策略；
- Secret Provider Binding；
- 维护窗口；
- DNS 切换动作。

这些属于 DecisionSet 和 Plan。

## 不允许晋升

- 关键数据目录用途未知；
- 无法确认数据库归属；
- 运行入口完全未知；
- Secret 可能丢失且无恢复方式；
- Collector completeness 太低；
- Workload 与共享服务边界冲突。

---

# 三十、Workload Candidate 与 Blueprint 的 UI 边界

## Candidate Review 页面

用户看到：

```text
可能识别到：个人博客

包括：
- Nginx 站点 blog.example.com
- blog.service
- PostgreSQL 数据库 blog_production
- /var/lib/blog/uploads
- 每日备份任务

需要确认：
- PostgreSQL 是否还服务其他业务？
- /srv/archive 是否属于该博客？
- SESSION_SECRET 未来如何提供？
```

用户操作：

- 确认；
- 合并；
- 拆分；
- 修改名称；
- 调整归属；
- 标记共享依赖；
- 排除噪声。

## Blueprint 页面

用户看到：

```text
个人博客：运行和恢复合同

部署：
- 从 Git commit abc123 构建
- Node.js 22
- systemd blog.service

数据：
- PostgreSQL blog_production
- uploads 18 GB

Secret：
- DATABASE_PASSWORD
- SESSION_SECRET

入口：
- blog.example.com
- HTTPS

验证：
- 首页 200
- 登录成功
- 数据库读写成功
```

Blueprint 页面不应展示大量 Graph Edge 和 PID。

---

# 三十一、当前代码到新模型的映射

| 当前对象 | 新对象 |
|---|---|
| InventoryGraph | 保留为 Evidence 关系层 |
| ServiceStack | WorkloadCandidate 的初始输入 |
| MigrationCandidate | ComponentCandidate 或 Candidate Signal |
| ConfigChecklist | CandidateQuestion / BlueprintRequirement |
| Migration Decision | DecisionSet 中的 Decision |
| CatalogItem | Blueprint Template / Capability Ref |
| EnvironmentPlan | PlanRevision |
| Snapshot SoftwareItem | Evidence |
| SecretRef | Blueprint SecretRequirement 的来源证据 |
| DataPath/Volume | Dataset Candidate 的来源证据 |

需要新增生产链：

```text
Collector
→ Snapshot
→ Inventory Graph
→ Workload Candidate Builder
→ Candidate Review
→ Blueprint Revision
→ Planner
```

---

# 三十二、首期 MVP 字段

完整模型可以按上面设计，但第一阶段实现必须控制范围。

## Workload MVP

- id；
- name；
- kind；
- archetype；
- lifecycleStatus；
- currentBlueprintRevisionId；
- placements；
- lineage。

## Candidate MVP

- snapshotId/hash；
- proposedIdentity；
- componentCandidates；
- evidenceAssignments；
- relationCandidates；
- confidence；
- completeness；
- unresolvedQuestions；
- status；
- reviewResult。

## Blueprint MVP

- identity；
- provenance；
- components；
- runtimeContracts；
- deploymentContracts；
- configContracts；
- datasetContracts；
- secretRequirements；
- endpointContracts；
- scheduledTaskContracts；
- dependencies；
- ephemeralStatePolicies；
- compatibilityEnvelope；
- verificationContract；
- readiness；
- contentHash。

首期可以暂缓：

- 完整资源限制；
- 完整安全上下文；
- 多租户共享资源调度；
- 高级 observability；
- 复杂许可证；
- 多区域部署；
- 自动伸缩；
- 高可用拓扑。

---

# 三十三、正式确定的设计结论

## Workload

- 是稳定业务身份；
- 可以跨迁移、Capture、Restore 长期存在；
- 不保存技术实现细节；
- 不随 Blueprint 更新更换 ID；
- 可以拥有多个 Placement。

## Workload Candidate

- 绑定 Source Snapshot；
- 可以错误和重叠；
- 可以合并、拆分、忽略；
- 不进入 Planner；
- 必须保存算法和 Evidence 来源；
- Service Stack 应演进为 Candidate，而不是直接变成 Workload。

## Workload Blueprint

- 是版本化、不可变的技术合同；
- 同一 Schema 服务于 Build、Migration、Capture 和 Restore；
- 可以来源于 Catalog、扫描、模板、Archive 或用户；
- 只描述目标无关的需求和恢复方法；
- 不包含目标机具体 Action；
- 只有 confirmed 且 planner-ready 的 Revision 能进入 Planner。

## Planner

- 不再直接消费软件列表；
- 必须消费 Blueprint Revision、DecisionSet 和 Snapshot Hash；
- 将目标无关合同编译成目标特定的 Plan Revision。

## 共享资源

- 专用组件可以放入应用 Workload；
- 共享组件必须成为独立 Workload 或 shared dependency；
- Dataset、Component 和 Evidence 都必须声明所有权；
- 禁止多个 Workload 对同一资源重复执行迁移。

## 运行状态

- 可重建期望状态进入 RuntimeContract；
- 持久状态进入 DatasetContract；
- 临时状态进入 EphemeralStatePolicy；
- 不尝试复制 PID、连接和内存状态。

下一步最适合确定的是 **Workload Candidate Builder 的识别和聚合规则**：系统如何从 systemd、进程、端口、Nginx、数据库、目录、Docker 和定时任务中形成候选业务，以及何时自动合并、何时必须询问用户。

## Prompt:
2026/7/18 21:31:08

确定Workload Candidate Builder 的识别和聚合规则：系统如何从 systemd、进程、端口、Nginx、数据库、目录、Docker 和定时任务中形成候选业务，以及何时自动合并、何时必须询问用户

## Response:
2026/7/18 21:31:13

这一轮我会把 Candidate Builder 定义成一套可执行的“证据→关系→候选→人工确认”规则，并明确每类信号的强弱、自动合并阈值、冲突处理和必须提问的场景。

下面这套规则的目标，是让系统先形成“可解释的候选业务”，而不是直接把所有技术对象强行拼成一个 Workload。当前项目的 Graph/ServiceStack 部分关系在真实 Collector 输出中并不稳定，部分测试依赖人工注入字段，因此 Candidate Builder 必须只使用可追溯 Evidence，并对推断关系保留置信度，不能把测试中的理想关系默认当成生产事实。`8bead08a-b983-4703-97e2-6580c02aff9c.md`

**document: **

# EnvForge Workload Candidate Builder 识别与聚合规则

## 一、Candidate Builder 的职责

Candidate Builder 的输入是：

```text
Environment Snapshot
+ Inventory Graph
+ Capability Detection Rules
+ 已保存的用户归属规则
```

输出是：

```text
Workload Candidates
+ Candidate Relations
+ Shared Service Candidates
+ Unassigned Evidence
+ Questions
+ Conflicts
```

Candidate Builder 不负责：

- 生成执行 Plan；
- 决定数据迁移策略；
- 决定 Secret Provider；
- 决定 Cutover；
- 直接执行迁移；
- 假设所有关系都正确。

它只回答：

> 根据当前证据，这些技术对象最可能共同构成哪些业务？

---

# 二、核心原则

## 1. 先建立关系，再聚合业务

不能根据名称相似就直接形成 Workload。

正确顺序：

```text
收集 Evidence
→ 标准化实体
→ 提取强关系
→ 提取弱关系
→ 找到业务锚点
→ 生成候选边界
→ 检测共享资源和冲突
→ 计算置信度
→ 自动确认或询问用户
```

## 2. 强关系优先，弱关系只用于辅助

例如：

```text
Nginx proxy_pass → 127.0.0.1:3000
```

是强关系。

而：

```text
服务名称 blog.service
目录名称 /var/lib/blog
```

只是名称相似的弱关系。

不能仅凭弱关系自动把目录归入服务。

## 3. 所有自动关系必须可解释

每条聚合关系必须包含：

```ts
interface CandidateEdgeEvidence {
  evidenceIds: string[];
  ruleId: string;
  confidence: number;
  explanation: string;
}
```

UI 应能显示：

> 系统将 `blog.service` 和 `blog.example.com` 归为同一候选，因为 Nginx 将该域名反向代理到 `blog.service` 监听的 3000 端口。

不能只显示：

> 置信度 87%。

## 4. 宁可留下未知项，也不能错误合并

错误遗漏通常可以由用户补充。

错误合并可能导致：

- 错误停止共享数据库；
- 错误复制其他业务数据；
- 错误迁移共享 Nginx；
- 错误删除目标环境资源；
- Cutover 时影响多个业务。

因此，涉及共享资源、数据归属和停止服务的关系，应采用保守策略。

---

# 三、Candidate Builder 的整体阶段

```text
Phase 1  Evidence Normalization
Phase 2  Entity Correlation
Phase 3  Relationship Extraction
Phase 4  Anchor Detection
Phase 5  Candidate Seeding
Phase 6  Candidate Expansion
Phase 7  Shared Resource Detection
Phase 8  Boundary Conflict Resolution
Phase 9  Confidence & Completeness
Phase 10 Question Generation
Phase 11 Candidate Publication
```

---

# 四、Phase 1：Evidence 标准化

不同 Collector 产生的数据必须先转换成统一实体。

## 标准实体类型

```ts
type EvidenceEntityType =
  | "systemd-unit"
  | "process"
  | "listening-socket"
  | "package"
  | "config-file"
  | "directory"
  | "file"
  | "environment-file"
  | "secret-reference"
  | "database-instance"
  | "database"
  | "database-role"
  | "container"
  | "compose-project"
  | "docker-volume"
  | "docker-network"
  | "nginx-server-block"
  | "nginx-upstream"
  | "domain"
  | "certificate"
  | "cron-job"
  | "systemd-timer"
  | "user"
  | "group"
  | "socket-unit"
  | "external-endpoint";
```

## 标准标识

每个实体应具有稳定的标准键。

例如：

```text
systemd-unit: system:blog.service
process: boot_id + pid
listening-socket: tcp:127.0.0.1:3000
directory: realpath:/var/lib/blog/uploads
container: docker:container-id
volume: docker-volume:blog_uploads
database: postgresql:instance-id:blog_production
nginx-block: config-file + line-range + server_name
cron-job: user + normalized-command + schedule
```

PID 不能作为长期身份，但可以用于同一次 Snapshot 的关联。

---

# 五、Phase 2：实体关联规则

## 1. systemd → process

### 强关系

满足任意一项：

- process cgroup 属于该 systemd unit；
- systemctl MainPID 与 process PID 相同；
- `/proc/<pid>/cgroup` 显示 unit 名；
- systemd DBus/unit status 明确关联。

置信度：

```text
0.98
```

### 中关系

- ExecStart 可执行文件和 process executable 完全一致；
- WorkingDirectory 与 process cwd 一致；
- process user 与 unit User 一致；
- 命令行参数与 ExecStart 高度一致。

置信度：

```text
0.70-0.90
```

### 弱关系

- unit 名称与 process executable basename 相似。

置信度：

```text
最高 0.40
```

仅弱关系不能自动聚合。

---

## 2. process → listening socket

### 强关系

通过以下方式确认：

- `/proc/<pid>/fd`；
- `ss -lntup` 显示 pid/process；
- `lsof -Pan -p <pid> -i`；
- container namespace 中的 PID 映射。

置信度：

```text
0.98
```

### 不可接受的推断

不能因为：

```text
Node.js 应用常使用 3000 端口
```

就建立关系。

---

## 3. systemd → config

### 强关系

来源：

- `EnvironmentFile=`；
- ExecStart 参数中的 `--config`、`-c`；
- unit/drop-in 明确指定路径；
- 应用启动命令引用配置文件；
- `systemctl cat` 中的路径；
- strace/进程打开文件证据，首期可不实现。

置信度：

```text
0.85-0.98
```

### 中关系

- Capability 明确规定默认配置路径；
- package ownership 显示配置属于该服务；
- 配置文件内容明确声明对应服务。

置信度：

```text
0.65-0.85
```

### 弱关系

- 文件名和服务名相似。

不能自动归属，只能形成建议。

---

## 4. process/systemd → directory

目录关系必须区分用途：

```ts
type DirectoryRole =
  | "working-directory"
  | "application-code"
  | "configuration"
  | "persistent-data"
  | "uploads"
  | "cache"
  | "logs"
  | "runtime"
  | "temporary"
  | "backup"
  | "unknown";
```

### 强关系

- systemd `WorkingDirectory`；
- systemd `StateDirectory`；
- systemd `CacheDirectory`；
- systemd `LogsDirectory`；
- systemd `RuntimeDirectory`；
- container bind mount；
- Compose volume；
- 应用配置明确声明；
- 数据库配置明确声明 data directory。

### 中关系

- process cwd；
- open file activity；
- Capability 默认路径；
- package path ownership；
- known application conventions。

### 弱关系

- 目录名与服务名一致；
- 目录修改时间与进程运行时间接近。

仅弱关系不得将目录标记为关键数据。

---

# 六、Phase 3：各技术来源的识别规则

# 1. systemd 识别

systemd 是非容器自部署应用的主要锚点。

## 必须采集

- unit name；
- description；
- enabled state；
- active state；
- load state；
- substate；
- unit file；
- drop-ins；
- MainPID；
- ExecStart；
- ExecStartPre；
- ExecStop；
- WorkingDirectory；
- User；
- Group；
- Environment；
- EnvironmentFile；
- StateDirectory；
- CacheDirectory；
- LogsDirectory；
- RuntimeDirectory；
- Requires；
- Wants；
- After；
- Before；
- PartOf；
- BindsTo；
- Restart；
- RestartSec；
- socket/timer triggers。

## systemd Candidate Seed 条件

以下 unit 可以独立成为候选种子：

- 非系统默认、长期运行的自定义 service；
- `/etc/systemd/system` 中的 unit；
- 指向 `/opt`、`/srv`、`/home`、`/usr/local` 的服务；
- 有监听端口的服务；
- 有专用数据目录的服务；
- 有独立域名入口的服务；
- Capability 识别为业务应用的服务。

以下通常不应独立成为 Candidate：

- `ssh.service`；
- `dbus.service`；
- `systemd-journald`；
- `cron.service`；
- 云厂商 agent；
- node exporter；
- 通用系统基础服务。

这些可以标记为：

```text
host-infrastructure
```

除非用户明确要求迁移。

## systemd 自动合并规则

可自动合并：

```text
app.service
+ app.socket
```

当：

- socket unit 明确 Activates app.service；
- service 和 socket 存在强依赖。

可自动关联但不一定合并：

```text
app.service
→ PostgreSQL
```

必须有数据库连接证据，且 PostgreSQL 是否专用需要单独判断。

---

# 2. 进程识别

进程只描述当前运行事实，不直接定义 Workload。

## 进程用于

- 找服务入口；
- 找监听端口；
- 找工作目录；
- 找可执行文件；
- 找运行用户；
- 找打开文件；
- 找父子进程；
- 找容器归属；
- 找可能的 writer。

## 进程树聚合

以下可自动归为同一 Runtime Component：

- 父子进程属于同一 systemd unit；
- master/worker 模式；
- gunicorn master + workers；
- nginx master + workers；
- PostgreSQL 主进程和子进程；
- Node cluster；
- Celery parent/worker；
- JVM 子线程不表现为独立进程。

不能把每个 worker 当独立 Component。

## 无 systemd 的进程

对于由以下方式启动的长期进程：

- nohup；
- screen/tmux；
- rc.local；
- shell script；
- 用户登录会话；
- PM2；
- Supervisor。

如果满足：

- 运行时间长；
- 有监听端口；
- 使用持久数据目录；
- 可识别工作目录；
- 有反向代理入口；

则形成 Candidate，但标记：

```text
runtimeManagement = unmanaged | supervisor | pm2 | unknown
```

并必须询问用户未来如何自动启动。

---

# 3. 端口识别

端口是关联关系，不是 Workload。

## 端口分类

```ts
type SocketExposure =
  | "loopback"
  | "private-network"
  | "public"
  | "container-internal"
  | "unix-socket";
```

## 重要规则

### loopback 端口

如：

```text
127.0.0.1:3000
```

若被 Nginx proxy_pass 引用，是强应用关联。

### 公网端口

如：

```text
0.0.0.0:8080
```

形成 Endpoint Candidate，需要判断是否直接业务入口。

### 数据库端口

如：

```text
127.0.0.1:5432
```

不能仅凭端口把所有应用与 PostgreSQL 关联。

必须结合：

- connection string；
- 配置文件；
- 环境变量；
- active connection；
- database user；
- database name。

---

# 4. Nginx 识别

Nginx 是网站 Workload 聚合的重要入口。

## 必须解析

- server block；
- `server_name`；
- listen；
- ssl_certificate；
- ssl_certificate_key 的 SecretRef；
- root；
- index；
- proxy_pass；
- fastcgi_pass；
- uwsgi_pass；
- grpc_pass；
- upstream；
- location；
- alias；
- auth；
- include；
- access_log/error_log；
- client upload settings。

## Nginx Anchor 规则

每个独立 `server_name` 集合通常形成一个 Web Entry Candidate。

例如：

```text
blog.example.com
www.blog.example.com
```

如果它们位于同一 server block、相同 root/upstream，可自动作为同一入口。

## Nginx 自动合并场景

### 反向代理应用

```text
server_name blog.example.com
proxy_pass http://127.0.0.1:3000
```

并且：

- 3000 端口由 app.service 监听；
- app.service 是非共享服务。

可以自动形成：

```text
Web Application Candidate
├── Nginx entry
└── app.service
```

### 静态网站

```text
server_name site.example.com
root /var/www/site
```

形成：

```text
Static Website Candidate
├── Nginx entry
└── /var/www/site
```

但必须进一步判断目录是否包含：

- 用户内容；
- 构建产物；
- 可重新生成静态文件。

### PHP 网站

```text
root /var/www/wordpress
fastcgi_pass unix:/run/php/php8.2-fpm.sock
```

结合：

- `wp-config.php`；
- WordPress 目录；
- 数据库配置；

可以识别 WordPress Candidate。

## 必须询问的 Nginx 场景

- 同一 server block 代理多个不相关 upstream；
- 同一 upstream 被多个域名使用；
- 同一域名同时提供多个应用路径；
- 共享 Nginx 为大量业务提供入口；
- proxy_pass 使用变量或动态 resolver；
- upstream 指向外部机器；
- root 目录归属不明确；
- TLS 证书覆盖多个不相关域名。

共享 Nginx 通常应成为：

```text
Shared Reverse Proxy Workload
```

应用 Workload 引用它，而不是把 Nginx 整体复制进每个应用。

---

# 5. 数据库识别

数据库需要分三层：

```text
Database Engine
→ Database Instance
→ Logical Database / Schema
```

不能把安装了 PostgreSQL 当作某个应用的数据库归属。

## PostgreSQL 必须采集

- cluster/instance；
- version；
- listen address；
- port；
- data directory；
- databases；
- roles；
- database owner；
- extensions；
- size；
- active connections；
- client addresses；
- application_name；
-配置中可见的连接来源。

## 应用 → 数据库强关系

满足任意：

- EnvironmentFile 中存在完整连接 URL；
- 配置文件明确 database name/host/port；
- 应用进程连接到 PostgreSQL，并可关联 database/user；
- Capability 明确解析出应用数据库配置。

置信度：

```text
0.90-0.99
```

## 中关系

- 应用用户和数据库 role 名相同；
- database name 与应用名相同；
- 应用 package 默认依赖本地 PostgreSQL；
- active connection 只能定位到 process，不能确定 database。

置信度：

```text
0.50-0.80
```

不能仅凭名称自动归属关键数据库。

## 数据库专用性判断

专用数据库实例可并入应用 Workload，需要同时满足：

- 只有一个业务数据库；
- 只有一个主要业务连接方；
- 服务生命周期与应用一致；
- 用户确认数据库实例不服务其他业务。

否则：

```text
Shared PostgreSQL Workload
```

各应用只引用自己的 Dataset。

## 必须询问

- 一个数据库被多个应用连接；
- 一个实例有多个无法归属的数据库；
- 数据库名称和应用名称不一致；
- 存在远程连接；
- 无法判断哪些数据库仍在使用；
- 数据库已停止但数据目录存在；
- 存在 replication、logical slot、standby；
- 实例同时承担系统和业务用途。

---

# 6. 目录识别

目录是最容易误判的数据来源。

## 目录角色识别优先级

```text
显式配置/运行合同
> mount/volume 关系
> 进程打开文件
> Capability 规则
> 路径规范
> 名称启发式
```

## 自动分类例子

### application-code

证据：

- Git repository；
- package.json；
- pyproject.toml；
- go.mod；
- Cargo.toml；
- build files；
- systemd WorkingDirectory；
- deploy manifest。

### persistent-data

证据：

- systemd StateDirectory；
- Compose volume；
- 数据库 data directory；
- 应用配置 upload/storage path；
- 持续写入；
- 不属于可重新生成缓存。

### cache

证据：

- CacheDirectory；
- `/var/cache`；
- 应用明确 cache 配置；
- 可重建特征。

### logs

证据：

- LogsDirectory；
- `/var/log`；
- Nginx access/error log；
- journald 输出。

### runtime

证据：

- RuntimeDirectory；
- `/run`；
- PID/socket 文件。

### backup

证据：

- 文件命名；
- cron dump；
- backup script 输出；
- 压缩归档。

## 目录自动归属条件

目录可以自动归入 Candidate，当：

- 存在一条强关系；
- 没有其他 Candidate 的强关系；
- 不属于共享父目录；
- ownership 不冲突。

## 必须询问

- 同一目录被多个服务写入；
- 父目录包含多个应用；
- `/srv`、`/opt` 下用途不明；
- 目录巨大但无明确 writer；
- 目录长期未修改但可能是归档；
- 数据目录和缓存目录混合；
- symlink 指向其他业务目录；
- mount point 属于外部磁盘；
- NFS/CIFS/对象挂载；
- 目录容量与文件数量异常；
- 用户 home 下同时存在代码和业务数据。

---

# 7. Docker 与 Compose 识别

## Compose Project

Compose Project 通常天然是 Candidate Seed。

必须采集：

- compose project name；
- compose files；
- service definitions；
- image + digest；
- build context；
- env_file；
- environment keys；
- ports；
- volumes；
- networks；
- depends_on；
- healthcheck；
- restart；
- labels；
- profiles；
- secrets/configs。

## 自动聚合

同一 Compose Project 中的 containers 默认属于同一 Candidate，除非：

- Compose 文件明显包含多个独立应用；
- 不同 profile 代表独立生命周期；
- 某个 service 是共享基础设施；
- 用户明确拆分。

## 独立 Docker Container

没有 Compose 的 container 可以形成 Candidate，如果：

- 有业务端口；
- 有专用 volume；
- 有可识别镜像；
- 有 restart policy；
- 有 domain/反向代理关联。

## Docker 共享资源

### Network

network 关系不代表同一 Workload。

很多无关 container 可能在同一默认网络。

### Volume

专用 named volume 可归入 Candidate。

多个 container 使用同一 volume 时：

- 若属于同一 Compose Project，可自动归入；
- 若跨 Project，必须询问；
- 如果是只读共享数据，需要标记 shared。

### Reverse proxy labels

Traefik、Caddy、Nginx Proxy Manager 标签可以建立强入口关系：

```text
domain
→ reverse proxy route
→ container
```

## 必须询问

- 一个 container 不属于 Compose；
- bind mount 路径用途不明；
- 同一个数据库 container 服务多个应用；
- 同一 volume 被多个项目使用；
- Compose 文件缺失；
- image tag 是 `latest` 且无 digest；
- build context 已不存在；
- env_file 缺失；
- container 是临时手工启动；
- 容器网络依赖外部 network。

---

# 8. 定时任务识别

定时任务不能只作为独立命令列表。

## 需要解析

- cron owner；
- schedule；
- command；
- working directory；
- environment；
- script path；
- output path；
- service control action；
- backup target；
- locking mechanism；
- systemd timer 对应 service；
- currently active state。

## 自动归属规则

### 强归属

- 命令调用某 Workload 的脚本路径；
- working directory 位于 Workload 目录；
- command 访问明确 Dataset；
- timer unit 对应 Workload service；
- 备份命令明确备份某数据库。

### 中归属

- 命令名称与 Workload 相似；
- 运行用户是 Workload 专用用户；
- 输出目录属于 Workload。

### 独立 Candidate

以下任务可能是独立 Scheduled Workload：

- 跨多个业务的系统备份；
- 日志归档；
- 全机同步；
- 定期数据采集；
- 自定义批处理；
- 没有长期运行服务的 ETL 任务。

## 必须询问

- cron 操作多个 Workload；
- 脚本内容不可读；
- 命令使用动态路径；
- 同一任务可能在目标重复运行；
- 活动任务可能超过迁移窗口；
- 任务依赖外部服务器；
- 任务同时负责备份和业务处理。

---

# 七、业务锚点 Anchor

Candidate 不应从任意实体开始扩张。

应先识别 Anchor。

## Anchor 类型

```ts
type WorkloadAnchorType =
  | "web-entry"
  | "managed-service"
  | "compose-project"
  | "business-container"
  | "database-service"
  | "scheduled-job"
  | "static-site"
  | "application-directory"
  | "known-capability";
```

## Anchor 优先级

```text
1. Compose Project
2. Nginx/Traefik/Caddy 业务入口
3. 自定义 systemd service
4. 有业务端口的 container
5. 已知应用 Capability
6. 独立数据库服务
7. 独立定时任务
8. 应用目录
```

## 不作为 Anchor

默认不作为业务 Anchor：

- 单个 package；
- 单个用户；
- 单个端口；
- 单个证书；
- 单个 SecretRef；
- 单个日志目录；
- 单个网络；
- 通用系统服务。

---

# 八、Candidate Seeding 规则

每个 Anchor 初始创建一个 Candidate Seed：

```ts
interface CandidateSeed {
  anchorEvidenceIds: string[];
  proposedKind: string;
  initialComponents: ComponentCandidate[];
  initialConfidence: number;
}
```

## Seed 去重

如果两个 Anchor 存在强关系：

```text
Nginx server block
→ proxy_pass
→ app.service
```

不要先永久创建两个 Candidate。

可以在 Seeding 阶段形成：

```text
one composite seed
```

但必须保留两个 Anchor。

---

# 九、Candidate Expansion 规则

Candidate 从 Anchor 向外扩张。

## 扩张顺序

```text
Runtime
→ Deployment
→ Config
→ Data
→ Secret
→ Endpoint
→ Scheduler
→ Dependencies
```

这个顺序很重要。

不能先根据目录名称聚合，再寻找运行入口。

## 扩张距离

建议图遍历最多三层，但不同边类型权重不同。

例如：

```text
Nginx server block
→ proxy_pass
→ process
→ systemd service
```

可以纳入。

但：

```text
service
→ package
→ shared library package
→ another service
```

不能继续扩张。

## 禁止传播边

以下关系不能用于 Candidate 扩张：

- same package manager；
- same Linux user，除非是专用用户且有其他证据；
- same Docker network；
- same parent directory；
- same certificate；
- same system package；
- same port number但不同地址；
- name similarity alone。

---

# 十、关系强度模型

建议为每类关系设基础权重。

| 关系 | 基础置信度 |
|---|---:|
| systemd MainPID/cgroup → process | 0.99 |
| process → socket | 0.98 |
| Nginx proxy_pass → exact socket | 0.98 |
| Compose project → container | 0.99 |
| container → declared volume | 0.98 |
| systemd EnvironmentFile | 0.97 |
| systemd WorkingDirectory | 0.95 |
| app config → database URL | 0.98 |
| systemd StateDirectory | 0.98 |
| timer → service | 0.99 |
| Git root → runtime working directory | 0.90 |
| Capability default path | 0.75 |
| process cwd | 0.75 |
| package ownership | 0.70 |
| matching service/user name | 0.45 |
| matching directory name | 0.35 |
| same Docker network | 0.15 |
| same parent directory | 0.10 |

不能简单相加超过 1。

可采用：

```text
combined confidence =
1 - Π(1 - independent evidence confidence)
```

但相关性较强的证据必须降权，避免名称相似被重复计算。

---

# 十一、自动合并规则

系统只有在边界风险较低时自动合并。

## 允许自动合并的条件

必须同时满足：

1. 至少有一条强关系，置信度 ≥ 0.90；
2. 没有共享资源冲突；
3. 没有另一 Candidate 的强归属；
4. 生命周期一致；
5. Cutover 行为一致；
6. 数据所有权无冲突；
7. 聚合后没有 Critical Question；
8. Collector Completeness 达到该规则最低要求。

## 自动合并典型场景

### 场景 A：Nginx + 自定义服务

```text
Nginx server block
→ proxy_pass 127.0.0.1:3000
→ process
→ blog.service
```

若 blog.service 不被其他入口使用：

```text
自动合并为 Web Application Candidate
```

### 场景 B：Compose Project

```text
compose project
→ containers
→ exclusive volumes
→ internal network
```

自动形成 Compose Candidate。

### 场景 C：systemd timer + service

```text
backup.timer
→ backup.service
```

自动形成一个 Scheduled Component 或 Scheduled Workload。

### 场景 D：静态网站

```text
Nginx server block
→ root /var/www/site
```

且该目录不被其他业务使用：

```text
自动形成 Static Site Candidate
```

---

# 十二、只能关联、不能自动合并的场景

以下关系可以建立 Dependency，但不能自动合成同一 Workload。

## 1. 应用 → 数据库

默认行为：

```text
Application Candidate
→ depends_on
→ Database Candidate
```

只有确认数据库实例专用后，才允许将数据库 Component 纳入应用 Blueprint。

## 2. 应用 → Redis

Redis 可能是：

- 专用 cache；
- 共享 session store；
- 共享 queue；
- 持久数据服务。

必须确认其用途和共享范围。

## 3. 应用 → Nginx

如果 Nginx 承载多个站点：

```text
Shared Reverse Proxy Candidate
```

应用只引用入口配置。

## 4. 多个容器 → 同一 Volume

跨 Compose Project 时不能自动合并。

## 5. 多个应用 → 同一目录

必须询问目录所有权。

## 6. 多个 cron → 同一脚本

可能是同一 Workload，也可能是共享运维脚本。

---

# 十三、必须询问用户的场景

用户问题分为五级。

## Level 1：阻塞边界问题

未回答前不能生成 Blueprint。

包括：

- 一个数据目录被多个 Candidate 使用；
- 数据库实例是否共享不明确；
- 一个端口对应多个可能服务；
- Nginx upstream 无法定位；
- Compose 文件不存在；
- 自定义服务启动方式未知；
- 关键应用目录用途未知；
- Secret 可能丢失且无恢复方式；
- 运行入口完全未知。

## Level 2：阻塞数据完整性问题

未回答前不能生成 Migration/Capture Plan。

包括：

- 哪些目录包含用户数据；
- 哪些数据库仍在使用；
- 是否允许停止写入；
- Redis 是否包含不可丢状态；
- SQLite 是否正在写；
- 当前 job 是否可以中断；
- 文件目录是否是缓存或持久数据；
- 外部挂载数据是否属于迁移范围。

## Level 3：阻塞服务恢复问题

包括：

- 服务未来如何启动；
- 是否依赖手工命令；
- 是否有缺失 unit；
- 环境变量从哪里获得；
- 启动顺序；
- 共享 service 是否由本项目管理；
- 当前 disabled service 是否需要保留 disabled。

## Level 4：建议确认

系统可以给推荐默认值，但允许用户稍后修改。

包括：

- Workload 名称；
- 业务重要等级；
- 日志是否归档；
- cache 是否跳过；
- 证书是否重新签发；
- 是否保留旧备份。

## Level 5：信息提示

不需要用户操作：

- 发现可重建缓存；
- 发现系统服务；
- 发现无业务关联 package；
- 发现已排除临时目录。

---

# 十四、问题生成规则

问题必须满足：

- 面向业务含义；
- 一次只问一个决策；
- 显示系统为何提问；
- 显示默认建议；
- 显示错误选择的风险；
- 支持“暂不确定”。

错误示例：

```text
是否合并 node-182 和 node-283？
```

正确示例：

```text
PostgreSQL 实例同时包含 blog_production 和 gitea 数据库。
它是否作为两个网站共享的数据库服务单独迁移？

推荐：作为共享数据库服务处理。
风险：如果并入个人博客，切换博客时可能影响 Gitea。
```

---

# 十五、共享资源检测规则

## 共享判定信号

一个实体满足任意条件时，进入 Shared Resource Review：

- 被两个以上 Candidate 通过强关系引用；
- 数据库实例包含多个业务数据库；
- Nginx 有多个业务 server block；
- Redis 有多个 client；
- 一个目录被多个服务写入；
- 一个 Docker Volume 被多个 Project 使用；
- 一个系统用户运行多个无关业务；
- 一个 cron 操作多个业务；
- 一个证书覆盖多个不同业务域名；
- 一个外部 IP/域名入口承载多个服务。

## 共享资源输出

```ts
interface SharedResourceCandidate {
  id: string;
  resourceEvidenceIds: string[];
  consumerCandidateIds: string[];

  proposedHandling:
    | "separate-workload"
    | "shared-component"
    | "external-dependency"
    | "duplicate-per-workload"
    | "manual";

  confidence: number;
  questions: CandidateQuestion[];
}
```

默认推荐：

| 共享资源 | 默认处理 |
|---|---|
| Nginx 多站点 | 独立 Shared Reverse Proxy Workload |
| PostgreSQL 多业务 | 独立 Data Service Workload |
| Redis 多业务 | 独立 Data/Cache Service Workload |
| Docker shared network | 不创建 Workload，仅保留关系 |
| 公共证书 | 独立证书策略或入口服务管理 |
| 共用备份任务 | 独立 Scheduled Workload |
| 公共用户 | Identity Contract，不作为 Workload |

---

# 十六、冲突处理

## 1. Evidence 归属冲突

同一个 Evidence 被两个 Candidate 标记为 exclusive。

处理：

```text
禁止自动确认
→ 生成 Ownership Conflict
→ 用户选择 exclusive/shared/external
```

## 2. 边界循环

例如：

```text
App A → DB B
DB B backup → script in App A
```

不能因为图中形成环就自动合并。

应按生命周期和所有权判断。

## 3. 名称冲突

两个不同应用都叫 `app`。

名称只用于展示，不用于强聚合。

## 4. 历史用户规则冲突

用户之前确认某目录属于 Workload A，新 Snapshot 显示 Workload B 正在写入。

处理：

```text
产生 Drift Conflict
不自动改归属
要求重新确认
```

---

# 十七、Candidate 置信度计算

Candidate 置信度应分维度。

```ts
interface CandidateScore {
  identity: number;
  boundary: number;
  runtime: number;
  deployment: number;
  dataOwnership: number;
  dependency: number;
  overall: number;
}
```

## 建议权重

```text
identity          15%
boundary          25%
runtime           20%
deployment        15%
dataOwnership     20%
dependency         5%
```

Migration/Capture 中数据所有权权重很高。

Build Candidate 不使用该评分。

## 自动确认阈值

即使 overall 很高，也不能完全自动创建 confirmed Blueprint。

建议：

```text
≥ 0.90
无 blocker
无 shared conflict
高 completeness
→ 标记“推荐确认”
```

用户仍需确认业务边界。

在未来成熟后，可支持：

```text
known capability + live proven rule
→ auto-confirm eligible
```

首期不要自动确认生产业务。

---

# 十八、Completeness 对自动聚合的影响

Collector 缺失不能被 Candidate Builder 当作“没有”。

例如：

- Nginx 配置无法读取；
- Docker 权限不足；
- 数据库无法连接；
- systemd unit 读取失败。

此时应输出：

```text
unknown
```

而不是：

```text
not present
```

## 自动合并最低条件

例如 Nginx → App 规则要求：

- Nginx config collector complete；
- listening socket collector complete；
- process-to-service correlation available。

如果其中一项失败：

```text
只能生成建议关系
不能自动合并
```

---

# 十九、用户修正和持久规则

用户对 Candidate 的修正不能只保存在本次页面。

应保存为：

```ts
interface WorkloadClassificationRule {
  id: string;
  scope:
    | "endpoint"
    | "workspace"
    | "workload";

  selector: EvidenceSelector;

  decision:
    | "belongs-to-workload"
    | "shared"
    | "exclude"
    | "separate-workload"
    | "external";

  workloadId?: string;

  createdBy: string;
  createdAt: string;
}
```

例如：

```text
/var/lib/blog/uploads
永远属于 Workload blog
```

但新 Snapshot 出现冲突时仍要提示，不可盲目覆盖。

---

# 二十、增量扫描和 Drift

Candidate Builder 每次扫描不应从零覆盖用户模型。

流程：

```text
New Snapshot
→ New Graph
→ New Candidate Generation
→ Compare with confirmed Blueprints
→ Drift Proposals
```

Drift 类型：

```ts
type WorkloadDriftType =
  | "new-component"
  | "removed-component"
  | "changed-runtime"
  | "new-dataset"
  | "new-secret"
  | "changed-endpoint"
  | "changed-dependency"
  | "ownership-conflict"
  | "unknown-evidence";
```

系统只生成：

```text
Blueprint Update Proposal
```

不能自动修改已确认 Blueprint。

---

# 二十一、典型识别示例

## 示例一：个人 Node.js 网站

发现：

```text
Nginx blog.example.com
proxy_pass 127.0.0.1:3000
3000 → node process
node process → blog.service
blog.service → /opt/blog
blog.service → /etc/blog/blog.env
blog.env → PostgreSQL blog_production
blog.service → /var/lib/blog/uploads
backup.timer → blog-backup.service
```

输出：

```text
Candidate：个人博客
Confidence：高

Components：
- Nginx Web Entry
- Node.js Application
- PostgreSQL Dataset Reference
- Upload Dataset
- Backup Scheduled Task

Questions：
- PostgreSQL 实例是否只服务该博客？
- SESSION_SECRET 未来如何提供？
```

如果 PostgreSQL 还有 Gitea：

```text
Blog Candidate
→ depends_on
→ Shared PostgreSQL Candidate
```

---

## 示例二：Docker Compose 服务

发现：

```text
compose project: immich
containers: server, machine-learning, redis, postgres
volumes: library, postgres
Traefik label: photos.example.com
```

输出：

```text
Candidate：Immich
Components：
- Compose Application
- Internal Redis
- Dedicated PostgreSQL
- Photo Library Dataset
- Public HTTPS Endpoint
```

如果 PostgreSQL container 同时被其他 Compose Project 使用：

```text
产生 Shared Database Conflict
必须询问
```

---

## 示例三：共享 Nginx

发现：

```text
blog.example.com → app1:3000
git.example.com → gitea:3001
photos.example.com → immich:2283
```

输出：

```text
Candidate A：Shared Reverse Proxy
Candidate B：Blog
Candidate C：Gitea
Candidate D：Immich
```

关系：

```text
B/C/D → exposed-through → A
```

不能把 Nginx 完整归入三个应用。

---

## 示例四：无法管理的进程

发现：

```text
nohup python app.py
cwd /home/user/app
port 8000
Nginx → 8000
uploads /home/user/app/uploads
```

输出：

```text
Candidate：Custom Python Web App
Confidence：中

Blocker：
- 未发现可靠的自动启动方式

Question：
- 目标机上应使用 systemd 管理该应用吗？
```

Candidate 可以成立，但 Blueprint 不能 planner-ready，直到部署和 Runtime Contract 补全。

---

# 二十二、Builder 输出模型

```ts
interface WorkloadCandidateBuildResult {
  projectId: string;
  endpointId: string;
  snapshotId: string;
  snapshotHash: string;

  generation: CandidateGenerationInfo;

  candidates: WorkloadCandidate[];

  sharedResources: SharedResourceCandidate[];

  unassignedEvidence: UnassignedEvidence[];

  conflicts: CandidateConflict[];

  questions: CandidateQuestion[];

  coverage: {
    totalEvidence: number;
    assignedEvidence: number;
    criticalUnassignedEvidence: number;
    unknownRuntimeCount: number;
    unknownDatasetCount: number;
  };

  resultHash: string;
}
```

---

# 二十三、Unassigned Evidence

所有 Evidence 不需要强制归属 Workload。

需要分类：

```ts
type UnassignedReason =
  | "host-infrastructure"
  | "system-package"
  | "temporary"
  | "noise"
  | "insufficient-evidence"
  | "user-excluded"
  | "potential-workload";
```

Critical Unassigned Evidence 包括：

- 长期运行的未知进程；
- 未归属公网端口；
- 大型未归属数据目录；
- 未归属数据库；
- 未归属 Docker Volume；
- 未归属定时任务；
- 未归属 SecretRef；
- 由业务用户运行的未知服务。

Migration 和 Capture 不允许忽略 Critical Unassigned Evidence。

用户必须：

- 归入 Workload；
- 标记共享；
- 标记外部；
- 明确排除并记录风险。

---

# 二十四、MVP 实现顺序

## Phase 1：生产 Evidence 契约

先补真实 Collector 输出：

- systemd MainPID/cgroup；
- 完整 unit/drop-in；
- process socket；
- Nginx server/upstream；
- container-volume-network；
- Compose project；
- EnvironmentFile；
- WorkingDirectory；
- cron/timer；
- database connection basics。

不要先写复杂聚合算法，否则仍会依赖测试手工字段。

## Phase 2：强关系图

只实现强关系：

- systemd → process；
- process → port；
- Nginx → port；
- Compose → container；
- container → volume；
- systemd → env/config/directory；
- timer → service；
- app config → database。

## Phase 3：Anchor 与 Candidate Seed

支持：

- Nginx Web App；
- Custom systemd App；
- Compose Project；
- Static Website；
- PostgreSQL Service；
- Scheduled Workload。

## Phase 4：Candidate Review

实现：

- accept；
- merge；
- split；
- dismiss；
- shared；
- evidence reassignment；
- questions。

## Phase 5：Blueprint Promotion

只有确认后的 Candidate 才创建 Blueprint。

## Phase 6：弱关系和学习规则

再增加：

- 名称启发式；
- 默认目录；
- package ownership；
- 用户保存规则；
- Drift Proposal。

---

# 二十五、首期自动化边界

首期允许自动形成 Candidate，但不允许自动确认 Blueprint。

系统可以说：

```text
高置信度识别到 3 个业务，建议确认。
```

不能直接说：

```text
已确定 3 个业务并准备迁移。
```

首期允许自动合并：

- systemd service + MainPID/process；
- process + listening port；
- Nginx proxy + exact port；
- Compose project + containers；
- container + exclusive volume；
- timer + service；
- static site + exact Nginx root。

首期必须询问：

- 应用和数据库是否属于同一生命周期；
- 数据库是否共享；
- 目录是否为关键数据；
- Redis 是否持久；
- 共享 Nginx 如何管理；
- 非 systemd 应用如何启动；
- 跨 Candidate 的 Volume/目录；
- 无法归属的关键 Evidence。

---

# 二十六、最终确定的规则

1. Candidate Builder 以强 Evidence 关系为主，不以名称相似为主。
2. systemd、Compose、Web Entry 是首要业务 Anchor。
3. Process 和 Port 只用于关联，不直接定义 Workload。
4. Nginx server block 应优先形成 Web Entry，不应把整个 Nginx 自动归入每个网站。
5. 数据库默认作为独立或共享服务，只有确认专用后才能并入应用 Workload。
6. 目录必须先分类代码、配置、数据、缓存、日志和临时状态。
7. Compose Project 默认是一个 Candidate，但共享数据库和 Volume 必须单独检测。
8. 定时任务必须关联其操作的业务和数据，并处理目标重复运行风险。
9. 同一 Evidence 不允许同时被多个 Workload exclusive 拥有。
10. 共享资源必须显式建模，不能通过重复复制解决。
11. Collector 不完整时输出 unknown，而不是 not present。
12. Candidate 可以自动生成和自动合并，但首期不能自动确认 Blueprint。
13. Critical Unassigned Evidence 必须阻止 Migration/Capture 进入 Planner。
14. 用户确认规则应持久化，但新证据冲突时必须重新询问。
15. 每次新 Snapshot 生成新的 Candidate Generation，不覆盖旧结果。
16. 已确认 Blueprint 不会被 Candidate Builder 自动修改，只生成 Drift Proposal。

下一步需要确定的是 **Candidate Review 与人工补全流程**：用户如何合并、拆分、调整证据归属、处理共享服务和回答问题，以及达到什么条件后 Candidate 才能晋升为 Planner-ready Blueprint。

## Prompt:
2026/7/18 21:36:10

确定 Candidate Review 与人工补全流程：用户如何合并、拆分、调整证据归属、处理共享服务和回答问题，以及达到什么条件后 Candidate 才能晋升为 Planner-ready Blueprint

## Response:
2026/7/18 21:36:13

这一轮我会把 Candidate Review 设计成一条严格的“确认边界—补全合同—解决共享—消除阻塞—生成 Blueprint Revision”的流程，并明确每一步允许的操作、审计记录和晋升门禁。

Candidate Review 的核心不是“审批系统识别结果”，而是：

> **让用户把不确定的机器证据整理成一个边界明确、数据不遗漏、服务可重建、可以交给 Planner 的业务合同。**

当前 EnvForge 的 Graph 和 Service Stack 尚未进入 Planner，部分关系也不能由真实 Collector 稳定产生，因此 Review 必须保留证据来源、人工修正和阻塞状态，不能通过一个“接受候选”按钮直接生成可执行计划。`8bead08a-b983-4703-97e2-6580c02aff9c.md`

**document: **

# EnvForge Candidate Review 与人工补全流程基线

## 一、Candidate Review 的产品目标

Candidate Builder 生成的是机器推断：

```text
系统推测：
Nginx + blog.service + PostgreSQL + uploads
可能构成“个人博客”
```

Candidate Review 的目标是将其转换成经过用户确认的：

```text
Workload
+
Workload Blueprint Revision
```

完整过程：

```text
Candidate Generation
→ Review Queue
→ 确认业务边界
→ 调整组件和 Evidence 归属
→ 处理共享资源
→ 补全部署、运行、数据、Secret 和验证合同
→ 消除阻塞项
→ Blueprint Preview
→ Confirm Blueprint Revision
→ Planner-ready Check
```

Candidate Review 不执行迁移，也不生成最终目标机 Action。

---

# 二、Candidate Review 的三个阶段

Review 不应该是一个巨大表单。

建议拆成三个阶段：

## 阶段 A：确认“这是什么业务”

解决：

- Candidate 是否是真实业务；
- Workload 名称；
- 是否需要合并；
- 是否需要拆分；
- 哪些组件属于它；
- 哪些资源是共享的；
- 哪些 Evidence 是噪声。

输出：

```text
Confirmed Workload Boundary
```

## 阶段 B：确认“它如何运行和保存”

解决：

- 部署来源；
- Runtime；
- 配置；
- 数据；
- Secret；
- Endpoint；
- 定时任务；
- 外部依赖；
- 瞬时状态。

输出：

```text
Draft Workload Blueprint
```

## 阶段 C：确认“是否足以进入 Planner”

解决：

- 缺失字段；
- Critical Unassigned Evidence；
- 共享资源冲突；
- 不可恢复数据；
- 无法提供的 Secret；
- 缺失验证；
- Collector 不完整。

输出：

```text
Confirmed Blueprint Revision
status = planner-ready | review-required | blocked
```

---

# 三、Review Queue

系统应首先生成一个项目级 Review Queue，而不是让用户逐个浏览所有 Evidence。

## Queue 分类

```ts
type ReviewQueueSection =
  | "candidate-boundaries"
  | "shared-resources"
  | "critical-unassigned"
  | "data-ownership"
  | "runtime-gaps"
  | "deployment-gaps"
  | "secret-gaps"
  | "verification-gaps"
  | "collector-gaps"
  | "warnings";
```

UI 默认按照风险排序：

1. 可能造成数据丢失；
2. 可能影响多个业务；
3. 可能导致服务无法启动；
4. 可能导致迁移后无法验证；
5. 建议优化；
6. 信息提示。

## Review Item

```ts
interface ReviewItem {
  id: string;
  projectId: string;

  candidateIds: string[];
  evidenceIds: string[];

  category: ReviewQueueSection;

  severity:
    | "critical"
    | "high"
    | "medium"
    | "low"
    | "info";

  title: string;
  explanation: string;

  reasonEvidence: EvidenceExplanation[];

  recommendations: ReviewRecommendation[];

  blockingModes: Array<
    "migration" | "capture" | "restore" | "build"
  >;

  status:
    | "open"
    | "answered"
    | "deferred"
    | "superseded";

  decisionId?: string;
}
```

---

# 四、Candidate 的主要操作

用户可以对 Candidate 执行六种核心操作：

```text
确认
合并
拆分
调整归属
标记共享
忽略
```

所有操作必须产生不可覆盖的 Review Decision。

---

# 五、确认 Candidate

## 1. Confirm 的含义

确认不是：

> 系统的所有推断都完全正确。

而是：

> 用户确认该 Candidate 对应一个真实的 Workload，并接受当前边界或完成必要修正。

确认后创建：

```text
Workload
+
Draft Blueprint Revision 1
```

## 2. Confirm 前的最低要求

至少必须知道：

- 业务名称；
- Workload kind；
- 至少一个主要运行或服务入口；
- 至少一个可解释的组件；
- 所有 Critical Evidence 已处理；
- 是否包含共享服务已确认。

不需要在这一刻完成：

- 目标机选择；
- Secret Provider；
- 具体数据传输策略；
- Cutover 时间；
- 目标冲突处理。

这些属于后续 DecisionSet 或 Plan。

## 3. Confirm 结果

```ts
interface ConfirmCandidateDecision {
  type: "confirm-candidate";

  candidateId: string;

  workloadIdentity: {
    name: string;
    kind: WorkloadKind;
    archetype?: string;
    environment?: string;
    businessCriticality?: string;
  };

  acceptedComponentIds: string[];
  excludedEvidenceIds: string[];

  createdWorkloadId: string;
  createdBlueprintRevisionId: string;
}
```

---

# 六、合并 Candidate

## 1. 合并适用场景

例如系统分别识别：

```text
Candidate A：Nginx 网站
Candidate B：Node.js 服务
Candidate C：上传目录
```

用户确认三者属于同一个个人博客。

## 2. 合并不能直接拼数组

系统必须先进行 Merge Validation。

检查：

- 是否存在互斥 Workload 类型；
- 是否涉及共享数据库；
- 是否存在不同生命周期；
- 是否有多个负责人；
- 是否有多个独立 Cutover 边界；
- 是否有重复 Dataset；
- 是否有冲突 Endpoint；
- 是否有不同源机器；
- 是否有跨 Project Candidate。

## 3. 合并结果

```ts
interface MergeCandidatesDecision {
  type: "merge-candidates";

  sourceCandidateIds: string[];

  resultingIdentity: WorkloadIdentityInput;

  componentMappings: {
    candidateComponentId: string;
    resultingComponentId: string;
  }[];

  evidenceMappings: EvidenceOwnershipDecision[];

  sharedResourceDecisions: SharedResourceDecision[];

  resultingWorkloadId: string;
  resultingBlueprintRevisionId: string;
}
```

原 Candidate 状态：

```text
merged
```

并保存：

```text
mergedIntoWorkloadId
```

## 4. 禁止自动合并的情况

以下情况只能由用户明确决定：

- 一个 PostgreSQL 实例服务多个应用；
- 一个 Nginx 服务多个独立域名；
- 一个 Redis 被多个业务连接；
- 一个数据目录被多个进程写入；
- 一个 Compose Project 中存在多个独立生命周期；
- 两个 Candidate 由不同用户或团队维护；
- 两个 Candidate 有独立 Cutover 时间；
- 一个 Candidate 是外部服务。

---

# 七、拆分 Candidate

## 1. 拆分适用场景

例如系统识别：

```text
Candidate：Nginx + Blog + Gitea + PostgreSQL
```

实际应拆为：

```text
Shared Reverse Proxy
Blog
Gitea
Shared PostgreSQL
```

## 2. 拆分流程

用户需要为每个新 Workload 定义：

- 名称；
- 类型；
- Component 归属；
- Dataset 归属；
- Endpoint 归属；
- Secret 归属；
- Scheduled Task 归属；
- 共享关系。

## 3. 拆分操作模型

```ts
interface SplitCandidateDecision {
  type: "split-candidate";

  sourceCandidateId: string;

  outputs: {
    temporaryOutputId: string;
    identity: WorkloadIdentityInput;

    componentIds: string[];
    evidenceAssignments: EvidenceOwnershipDecision[];

    dependencyRefs: ProposedDependencyRef[];
  }[];

  sharedEvidenceDecisions: SharedResourceDecision[];

  resultingWorkloadIds: string[];
  resultingBlueprintRevisionIds: string[];
}
```

## 4. 拆分必须验证

- 每个关键 Dataset 恰好有一个 owner；
- 每个 Component 恰好有一个 exclusive owner，或显式 shared；
- 每个公网 Endpoint 有明确归属；
- 每个 SecretRequirement 有 consumer；
- 每个 Critical Evidence 有去向；
- 不允许拆分后出现孤立数据。

---

# 八、调整 Evidence 归属

## 1. Evidence 归属类型

```ts
type EvidenceOwnership =
  | "exclusive"
  | "shared"
  | "reference"
  | "external"
  | "excluded"
  | "unresolved";
```

含义：

| 类型 | 含义 |
|---|---|
| exclusive | 只属于该 Workload |
| shared | 被多个 Workload 共同管理 |
| reference | 该 Workload 使用，但不拥有 |
| external | 由 EnvForge 管理范围外的系统提供 |
| excluded | 明确不属于任何需处理 Workload |
| unresolved | 尚未确定 |

## 2. 调整操作

用户可以将 Evidence：

- 移入另一个 Workload；
- 从 Candidate 中排除；
- 标记为 shared；
- 标记为 external；
- 创建新的 Workload；
- 标记为 host infrastructure。

## 3. Evidence 归属决策

```ts
interface EvidenceOwnershipDecision {
  evidenceId: string;

  ownership:
    | "exclusive"
    | "shared"
    | "reference"
    | "external"
    | "excluded";

  workloadIds: string[];

  componentId?: string;

  role?: string;

  reason: string;

  riskAccepted?: boolean;
}
```

## 4. 归属约束

### 独占资源

以下资源通常必须只有一个 exclusive owner：

- 应用代码目录；
- 专用上传目录；
- 单个数据库；
- Docker named volume；
- systemd unit；
- Compose Project；
- 专用配置；
- 专用 Secret。

### 共享资源

以下资源可以 shared：

- Nginx；
- PostgreSQL 实例；
- Redis；
- 公共证书；
- 公共用户组；
- 共享备份任务；
- 外部存储 mount；
- Docker external network。

### Reference

例如：

```text
Blog Workload
→ reference
→ Shared PostgreSQL Workload
```

Blog 不拥有 PostgreSQL 实例，但拥有 `blog_production` Dataset。

---

# 九、共享服务处理流程

共享资源不能只做一个布尔标记。

系统必须要求用户确定共享资源的管理方式。

## 1. 处理选项

```ts
type SharedResourceHandling =
  | "separate-workload"
  | "managed-by-one-workload"
  | "external-dependency"
  | "duplicate-on-target"
  | "reuse-target-existing"
  | "manual";
```

## 2. 默认推荐

### 共享 Nginx

推荐：

```text
separate-workload
```

每个应用 Workload 保存自己的 Endpoint Contract，并依赖 Shared Reverse Proxy。

### 共享 PostgreSQL

推荐：

```text
separate-workload
```

数据库实例成为 Data Service Workload。

每个应用拥有自己的逻辑 Dataset。

### 共享 Redis

需要先确定：

- cache；
- session；
- queue；
- durable store。

推荐根据用途决定是否独立迁移。

### 共享文件目录

通常属于高风险情况。

必须明确：

- 是否应该拆分目录；
- 是否允许重复复制；
- 目标端由谁写入；
- Cutover 时谁负责停止写入。

## 3. SharedResourceDecision

```ts
interface SharedResourceDecision {
  resourceEvidenceIds: string[];

  handling: SharedResourceHandling;

  ownerWorkloadId?: string;
  consumerWorkloadIds: string[];

  datasetMappings?: {
    datasetSelector: string;
    ownerWorkloadId: string;
  }[];

  migrationOrder?: string[];

  cutoverCoupling:
    | "together"
    | "dependency-first"
    | "independent"
    | "manual";

  reason: string;
}
```

## 4. 共享服务对 Planner 的影响

如果 Shared Resource 尚未确定处理方式：

```text
Blueprint 可以保存为 draft
但不能 planner-ready
```

---

# 十、人工补全流程

边界确认后，用户需要补全 Blueprint 所需合同。

建议 UI 按业务问题组织，而不是按 Schema 字段组织。

---

# 十一、步骤 1：业务身份

用户确认：

- 名称；
- 类型；
- 环境；
- 重要性；
- 负责人；
- 简要用途。

必须回答：

```text
这是什么业务？
谁维护它？
它是否需要持续运行？
```

字段：

```ts
interface IdentityReviewSection {
  name: string;
  kind: WorkloadKind;
  archetype?: string;
  environment: string;
  businessCriticality: string;
  owners: WorkloadOwner[];
  description?: string;
}
```

这一步通常不阻塞技术识别，但影响：

- Review 排序；
- 验证要求；
- Restore Drill 要求；
- 回滚策略。

---

# 十二、步骤 2：组件和边界

用户看到业务级组件：

```text
Web 入口
应用服务
数据库
文件数据
定时任务
```

而不是：

```text
PID 1823
port-3000
graph-edge-92
```

每个 Component 必须确认：

- 是否属于 Workload；
- 是否必需；
- 是否共享；
- 是否外部；
- 迁移方式。

字段：

```ts
interface ComponentReviewDecision {
  componentCandidateId: string;

  accepted: boolean;

  name?: string;
  type?: ComponentType;
  role?: string;

  ownership:
    | "exclusive"
    | "shared"
    | "external";

  required: boolean;

  migrationDisposition:
    | "rebuild"
    | "transfer"
    | "restore"
    | "reuse-target"
    | "external"
    | "skip"
    | "manual";

  reason?: string;
}
```

`skip` 对关键组件必须要求风险确认。

---

# 十三、步骤 3：运行方式补全

系统应首先自动展示已识别内容：

```text
启动方式：systemd
服务名：blog.service
工作目录：/opt/blog
运行用户：blog
启动命令：node server.js
自动启动：是
```

用户只补充未知或冲突字段。

## 必须确认

- execution model；
- startup entrypoint；
- working directory；
- runAs user/group；
- startup enabled；
- restart policy；
- dependency order；
- shutdown behavior。

## 未管理进程

例如通过 `nohup` 启动：

系统应问：

> 在目标机器上准备怎样管理该应用？

选项：

- 创建 systemd service；
- 使用 Docker；
- 继续手工启动；
- 使用用户提供的启动方式；
- 暂不迁移。

选择 systemd 时生成 Blueprint RuntimeContract，但具体 unit Artifact 仍需后续确认。

## Runtime 阻塞条件

以下情况阻止 Planner-ready：

- 无法确定启动方式；
- 无法确定主要 entrypoint；
- required service 没有自动启动方式；
- 运行用户无法重建；
- 服务依赖顺序存在冲突；
- shutdown/quiesce 方式完全未知且存在写入。

---

# 十四、步骤 4：部署来源补全

系统应问：

> 目标机器上如何重新获得这个应用？

支持：

- 系统包；
- Git；
- Container Image；
- Compose；
- 二进制 Artifact；
- 复制部署目录；
- 手工部署。

## Git

需要：

- repository；
- commit；
- subdirectory；
- lock file；
- build command；
- output Artifact。

## Container

需要：

- image；
- digest；
- compose file；
- build context；
- required volumes；
- environment keys。

## Package

需要：

- package name；
- repository；
- version constraint。

## Artifact

需要：

- Artifact 是否已被保存；
- checksum；
- architecture；
- target path。

## 阻塞条件

- 部署来源未知；
- Git repository 不存在且没有 Artifact；
- image 只有 `latest` 且没有 digest；
- Compose 文件缺失；
- 自定义二进制未保存；
- 构建依赖无法确定；
- 用户选择手工部署但未提供检查点。

---

# 十五、步骤 5：配置补全

对每个 Config Candidate，用户确认：

- 是否需要；
- 复制、模板化、重新生成还是复用目标；
- 目标路径是否固定；
- 是否包含 Secret；
- owner/mode；
- 验证方式。

系统不能直接把源配置原样复制。

必须检测：

- 旧 IP；
- 旧 hostname；
- 旧路径；
- 旧用户名；
- 旧证书路径；
- 旧数据库地址；
- 目标机专属值。

## Config Review Decision

```ts
interface ConfigReviewDecision {
  evidenceId: string;

  logicalName: string;

  strategy:
    | "copy"
    | "template"
    | "regenerate"
    | "merge"
    | "target-existing"
    | "manual"
    | "exclude";

  targetPathPolicy?: string;

  containsSecrets: boolean;

  portabilityIssues: ConfigPortabilityIssue[];

  required: boolean;
}
```

## 阻塞条件

- required config 没有内容或生成方法；
- config 包含 Secret 但未拆分；
- migration config 只有路径，没有 Artifact；
- 无法确定目标路径；
- 配置依赖旧机器不可用资源。

---

# 十六、步骤 6：数据补全

这是 Migration 和 Capture 最严格的一步。

用户看到：

```text
PostgreSQL：blog_production，约 4.8 GB
上传文件：/var/lib/blog/uploads，约 18 GB
缓存：/var/cache/blog，约 3 GB
日志：/var/log/blog，约 1.2 GB
```

而不是一组 DataPath 节点。

## 用户需要确认

对每项：

- 是代码、配置、数据、缓存、日志还是临时目录；
- 是否必须保存；
- 所属 Workload；
- writer；
- 一致性要求；
- 丢失影响；
- 是否允许停止写入；
- 是否共享。

## Dataset Review Decision

```ts
interface DatasetReviewDecision {
  evidenceIds: string[];

  name: string;
  kind: DatasetKind;

  ownership:
    | "exclusive"
    | "shared"
    | "external";

  ownerWorkloadId: string;

  required: boolean;

  classification:
    | "business-data"
    | "recreatable"
    | "cache"
    | "logs"
    | "temporary"
    | "backup"
    | "unknown";

  writerComponentIds: string[];

  consistencyRequirement:
    | "crash-consistent"
    | "filesystem-consistent"
    | "application-consistent"
    | "transaction-consistent"
    | "eventually-consistent"
    | "manual";

  lossImpact:
    | "none"
    | "minor"
    | "user-visible"
    | "data-loss"
    | "catastrophic";

  allowQuiesce?: boolean;

  excludedWithRiskAcceptance?: boolean;
}
```

## 必须阻塞的情况

- 大型目录用途未知；
- 数据库归属未知；
- 数据目录被多个服务写入；
- required Dataset 被用户标记跳过但未接受风险；
- 不知道如何达到一致性点；
- Capture 中关键数据不能保存；
- Dataset 没有验证方法；
- 外部挂载是否包含在迁移范围内不明确。

---

# 十七、步骤 7：Secret 补全

Candidate Review 不要求立即输入 Secret 明文。

它只要求确定 Secret Requirement。

用户确认：

- Secret 名称；
- 谁使用；
- 是否必需；
- 在哪个阶段需要；
- 未来是否能重新获得；
- 是否允许重新生成；
- 是否需要轮换。

## Secret Review Decision

```ts
interface SecretReviewDecision {
  sourceSecretRefIds: string[];

  logicalName: string;

  consumerComponentIds: string[];

  required: boolean;

  requiredAt:
    | "prepare"
    | "restore"
    | "startup"
    | "verification";

  recoveryPolicy:
    | "user-will-provide"
    | "external-provider"
    | "target-existing"
    | "regenerate"
    | "rotate"
    | "unavailable";

  allowedProviders: SecretProviderType[];

  targetReference?: string;
}
```

## 阻塞条件

- required Secret 标记 unavailable；
- 用户不知道如何恢复且不能 regenerate；
- Secret consumer 未知；
- 配置中包含 Secret 明文但未成功拆分；
- Capture 后源机将释放，而 Secret 无未来恢复方式。

---

# 十八、步骤 8：入口和外部依赖

用户确认：

- 域名；
- 公网端口；
- 内部端口；
- reverse proxy；
- TLS；
- 外部数据库；
- SMTP；
- OAuth；
- 对象存储；
- 外部 API；
- DNS Provider。

## Endpoint 需明确

- 是公开还是内部；
- 是否参与 Cutover；
- TLS 是否保留或重新签发；
- 是否共享反向代理；
- 目标验证方式。

## 外部依赖阻塞条件

- required dependency 无法访问；
- credential 恢复方式未知；
- license 与机器绑定但未处理；
- 域名控制权未知；
- source repository 已失效且无 Artifact。

---

# 十九、步骤 9：定时任务和活动任务

用户确认：

- 任务属于哪个 Workload；
- 是否在目标恢复；
- 源端何时禁用；
- 目标端何时启用；
- 是否允许重复运行；
- 当前活动任务怎么处理。

## 关键问题

```text
该备份任务是否应在 Cutover 前停止？
如果源端和目标端同时启用，会不会重复执行？
当前正在运行的任务可以等待结束吗？
```

## 阻塞条件

- required 定时任务归属未知；
- 可能在源目标同时运行且会产生重复数据；
- active job 无法安全停止或恢复；
- task 依赖未迁移的数据或 Secret。

---

# 二十、步骤 10：瞬时状态处理

系统根据 Component 类型提出默认策略：

| 状态 | 默认建议 |
|---|---|
| HTTP 请求 | drain |
| TCP 连接 | reconnect |
| DB 事务 | wait/quiesce |
| 内存缓存 | rebuild |
| 内存 session | externalize 或接受失效 |
| worker job | drain/checkpoint/requeue |
| leader election | target restart |
| file lock | stop source |
| active cron | wait/cancel/manual |

用户只需要确认高风险策略。

## Ephemeral Review Decision

```ts
interface EphemeralStateDecision {
  componentId: string;
  stateType: EphemeralStateType;

  handling:
    | "drain"
    | "quiesce"
    | "checkpoint"
    | "restart"
    | "rebuild"
    | "discard"
    | "manual";

  lossImpact: string;

  maximumDrainSeconds?: number;

  userAcceptedLoss?: boolean;
}
```

## 阻塞条件

- 状态丢失可能造成数据损坏；
- active job 无安全处理方式；
- 数据库事务不能 quiesce；
- session 丢失不可接受且没有持久化方案；
- 用户未接受明确的瞬时状态损失。

---

# 二十一、步骤 11：验证合同

Review 必须在生成 Blueprint 时定义：

> 如何证明这个 Workload 被成功重建？

至少需要：

- 一个 Runtime Check；
- 一个 Endpoint 或 Dependency Check；
- 对有数据 Workload 至少一个 Data Check；
- 对重要应用至少一个 Business Check。

## 示例

```text
Runtime：
blog.service active

Network：
127.0.0.1:3000 可连接

Data：
blog_production 中 posts 表存在
uploads 目录文件数量不低于源端

Business：
GET / 返回 200
页面包含 “My Blog”
```

## Verification Review Decision

```ts
interface VerificationReviewDecision {
  checks: VerificationCheckDraft[];

  successPolicy:
    | "all-required"
    | "manual-approval";

  businessSuccessDescription: string;
}
```

## 阻塞条件

- 没有任何验证；
- 有数据但没有数据验证；
- 业务重要性 high/critical 但没有业务验证；
- 验证依赖不存在的账号或 Secret；
- 检查可能修改生产数据但没有清理策略。

---

# 二十二、回答问题的统一结构

每个问题都必须包含：

```ts
interface CandidateReviewQuestion {
  id: string;

  category: string;

  question: string;

  context: string;

  evidenceIds: string[];

  recommendation?: {
    answer: unknown;
    explanation: string;
  };

  options: ReviewAnswerOption[];

  impact: {
    ifUnanswered: string;
    wrongAnswerRisk: string;
  };

  blockingModes: ProjectType[];

  allowUnknown: boolean;

  status:
    | "open"
    | "answered"
    | "deferred"
    | "superseded";
}
```

## 回答类型

```ts
type ReviewAnswer =
  | SingleChoiceAnswer
  | MultiChoiceAnswer
  | TextAnswer
  | ResourceAssignmentAnswer
  | MergeAnswer
  | SplitAnswer
  | RiskAcceptanceAnswer;
```

## 回答必须版本化

用户修改答案时：

- 不覆盖旧答案；
- 生成 DecisionSet 新 Revision；
- 记录旧值、新值、原因；
- 已生成 Blueprint 时产生新的 Blueprint Revision Proposal。

---

# 二十三、允许“暂不确定”，但不能隐藏风险

用户可以选择：

```text
暂不确定
```

系统应：

- 保留 open requirement；
- 降低 readiness；
- 明确阻塞哪些模式；
- 提供后续补充入口。

例如：

```text
是否迁移日志目录？
暂不确定

影响：
不阻塞 Live Migration
阻塞 Capture 的“完整归档”等级
```

不同问题对不同模式的影响不同。

---

# 二十四、模式相关的晋升门禁

Blueprint 是否 Planner-ready 必须根据 Project Type 判断。

---

# 二十五、所有模式共同门禁

必须满足：

## 身份

- Workload identity 已确认；
- Workload boundary 已确认；
- 至少一个 required Component；
- 没有未解决的 exclusive ownership 冲突。

## 运行

- required Component 有 Runtime 或明确 external；
- 主要启动入口已知；
- required Component desired state 已知。

## 部署

- required Component 有 Deployment Contract；
- 或明确为 target-existing/external/manual；
- 手工步骤有可验证的完成条件。

## 配置

- required config 有策略；
- required config 内容或模板可获得；
- Secret 已从配置中分离。

## 依赖

- hard dependency 已识别；
- shared dependency 处理方式已确定；
- external dependency 有可验证入口。

## 验证

- 至少一个 required verification check；
- 所有 required Component 有运行或依赖验证。

## Evidence

- 没有未处理的 Critical Unassigned Evidence；
- Collector 缺失项已重新采集或人工确认风险。

---

# 二十六、Build Planner-ready 门禁

Build 不需要源数据和瞬时状态。

必须满足：

- Target-independent Deployment Contract 完整；
- 必要 Runtime Contract；
- Config Contract；
- Secret Requirement；
- Endpoint Contract；
- Compatibility Envelope；
- 基础 Verification。

允许：

- Dataset 为空；
- 使用 seed/upload data；
- 没有 Cutover；
- 没有 Source Snapshot。

---

# 二十七、Migration Planner-ready 门禁

除共同门禁外，必须满足：

## Source

- Source Snapshot 固定；
- Source Snapshot completeness 达到最低值；
- required Workload Component 可定位到源端；
- Workload Blueprint 与 Snapshot 无未处理 Critical Drift。

## Data

- 所有 required Dataset 已确认；
- Dataset owner 已确认；
- writer 已识别或人工确认；
- consistency requirement 已定义；
- loss impact 已定义；
- 数据验证已定义。

## Service State

- startup/shutdown 合同存在；
- Ephemeral State Policy 已确认；
- active job 处理已确认；
- timer/cron 重复执行风险已处理。

## Secret

- required Secret 可在迁移时获得；
- 不要求立即绑定 Provider，但 allowed Provider 和恢复策略必须存在。

## Cutover Requirements

- 是否需要 drain 已确定；
- 是否需要 quiesce 已确定；
- 是否需要 traffic switch 已确定；
- 最大停机可以暂时在 DecisionSet 中补充，但不能完全未知到执行阶段。

## Verification

- 有数据验证；
- high/critical Workload 有业务验证；
- 验证失败行为可以由 Plan 决定。

---

# 二十八、Capture Planner-ready 门禁

Capture 的门禁应比 Migration 更严格，因为源机未来可能消失。

必须满足：

## 完整业务

- 所有 Critical Workload 已处理；
- 所有大型数据目录已分类；
- 所有数据库已确认；
- 所有 Docker Volume 已确认；
- 所有 required Config 可保存；
- 所有部署 Artifact 可恢复。

## Secret

- 每个 required Secret 有未来恢复策略；
- 不允许只写“以后再想办法”；
- 若用户不保存 Secret，必须确认 Provider 未来可用。

## 数据一致性

- 每个 required Dataset 有 consistency requirement；
- 有 Capture 时的一致性方法；
- 无法一致性采集时标记 blocker。

## Compatibility

- Compatibility Envelope 已生成；
- architecture-specific Artifact 已标记；
- 外部依赖已记录；
- 软件来源不可用风险已记录。

## Restore Verification

- 有未来 Restore 的验证合同；
- critical Workload 的 Restore Drill 要求已确定。

## 未知项

- 不允许存在 Critical Unassigned Evidence；
- 用户强制排除时必须记录明确数据丢失风险；
- 风险过高的对象不可绕过。

---

# 二十九、Planner-ready 不是“全部 100%”

建议 readiness 不使用一个总百分比作为最终判断。

采用：

```ts
interface PlannerReadinessResult {
  status:
    | "planner-ready"
    | "review-required"
    | "blocked";

  mode: ProjectType;

  gates: PlannerReadinessGateResult[];

  blockers: BlueprintBlocker[];

  warnings: BlueprintWarning[];

  deferredItems: DeferredRequirement[];
}
```

## Gate 结果

```ts
interface PlannerReadinessGateResult {
  gate:
    | "identity"
    | "boundary"
    | "runtime"
    | "deployment"
    | "config"
    | "data"
    | "secret"
    | "dependency"
    | "ephemeral-state"
    | "verification"
    | "collector-completeness"
    | "unassigned-evidence";

  status:
    | "passed"
    | "warning"
    | "blocked"
    | "not-applicable";

  explanation: string;
  affectedIds: string[];
}
```

---

# 三十、阻塞项等级

```ts
type BlueprintBlockerType =
  | "hard"
  | "mode-specific"
  | "risk-acknowledgeable";
```

## Hard Blocker

永远不能绕过：

- Plan 可能包含 Secret 明文；
- required Dataset 无任何归属；
- 同一 exclusive resource 有多个 owner；
- required Deployment Artifact 不存在；
- Source Snapshot Hash 不可验证；
- Blueprint 内容 Hash 无效；
- 服务动作可能影响未包含 Workload 的共享资源。

## Mode-specific Blocker

例如：

- 未定义数据迁移不阻塞 Build；
- 无 Capture Storage 不阻塞 Migration；
- 无 Cutover 不阻塞 Restore。

## Risk-acknowledgeable

用户可以接受风险：

- 不迁移历史日志；
- 不保留缓存；
- 证书将在目标重新签发；
- 短暂 session 丢失；
- 次要定时任务稍后手工恢复。

风险接受必须：

- 写明影响；
- 绑定用户；
- 绑定 Blueprint Revision；
- 在 Plan Review 再次展示。

---

# 三十一、Blueprint Preview

Candidate Review 完成后，不应立即静默创建 Blueprint。

先显示业务摘要：

```text
个人博客

部署
- Git commit abc123
- Node.js 22
- systemd blog.service

配置
- /etc/blog/blog.env：模板化
- /etc/systemd/system/blog.service：重新生成
- Nginx server block：合并到共享反向代理

数据
- PostgreSQL blog_production：必须迁移
- uploads：必须迁移
- cache：不迁移
- logs：仅归档最近 30 天

Secret
- DATABASE_PASSWORD：迁移时提供
- SESSION_SECRET：迁移后轮换

运行状态
- HTTP 请求：drain
- 数据库事务：quiesce
- cache：重新构建
- cron：Cutover 后启用

验证
- 服务 active
- 首页 200
- 数据库读写
```

用户点击：

```text
确认并创建 Blueprint Revision
```

不是：

```text
立即迁移
```

---

# 三十二、Blueprint Promotion

## 生成过程

```text
Candidate Review Decisions
+ Candidate Evidence
+ User Overrides
→ Blueprint Compiler
→ Draft Blueprint Revision
→ Validation
→ Confirm
→ Immutable Blueprint Revision
```

## Blueprint Compiler 不能做什么

不能：

- 自行补默认数据策略并隐藏；
- 自动选择 Secret Provider；
- 自动忽略 unknown Dataset；
- 自动把 shared resource 变 exclusive；
- 自动生成未经审查的 shell；
- 自动将风险接受视为正常通过。

## Promotion Record

```ts
interface BlueprintPromotionRecord {
  id: string;

  projectId: string;

  sourceCandidateIds: string[];
  sourceCandidateHashes: string[];

  decisionSetRevisionId: string;

  resultingWorkloadId: string;
  resultingBlueprintRevisionId: string;

  readinessResult: PlannerReadinessResult;

  promotedBy: string;
  promotedAt: string;
}
```

---

# 三十三、Blueprint 修改流程

已确认 Blueprint 不允许编辑。

任何修改：

```text
Blueprint Revision 3
→ Create Draft Revision 4
→ Apply Changes
→ Revalidate
→ Confirm Revision 4
→ Revision 3 superseded
```

新 Snapshot 出现时：

```text
Snapshot
→ Candidate Generation
→ Drift Comparison
→ Blueprint Update Proposal
```

用户可以：

- 接受 Drift；
- 忽略 Drift；
- 将新 Evidence 加入 Workload；
- 创建新 Workload；
- 标记为 host infrastructure。

---

# 三十四、Review 状态机

```text
GENERATED
→ BOUNDARY_REVIEW
→ CONTRACT_REVIEW
→ BLOCKED / READY_FOR_CONFIRMATION
→ CONFIRMED
→ PLANNER_READY
```

详细状态：

```ts
type CandidateReviewStatus =
  | "generated"
  | "boundary-review"
  | "contract-review"
  | "blocked"
  | "ready-for-confirmation"
  | "confirmed"
  | "superseded"
  | "dismissed";
```

Blueprint：

```ts
type BlueprintStatus =
  | "draft"
  | "review-required"
  | "confirmed"
  | "planner-ready"
  | "superseded"
  | "retired";
```

建议避免同时使用 `confirmed` 和 `planner-ready` 造成误解。

更准确地说：

```text
confirmed = 内容已被用户确认
planner-ready = 对当前 Project Type 满足编译门禁
```

同一 Blueprint 可以：

- 对 Build planner-ready；
- 对 Migration blocked；
- 对 Capture blocked。

因此 Planner readiness 最好作为模式相关评估，而不是 Blueprint 的唯一状态字段。

---

# 三十五、UI 页面结构建议

项目中的 Workloads 页面分四个层次。

## 1. Review Inbox

显示：

- 待确认业务；
- 共享资源；
- 数据风险；
- 未归属对象；
- 阻塞问题。

## 2. Candidate Workspace

三栏布局：

```text
左：候选业务和未归属项
中：业务组件和关系
右：当前问题、证据和推荐
```

## 3. Blueprint Editor

按业务语言分区：

- 业务；
- 运行；
- 部署；
- 配置；
- 数据；
- Secret；
- 入口；
- 定时任务；
- 状态处理；
- 验证。

不直接编辑 JSON Schema。

## 4. Readiness Review

显示：

```text
可以进入迁移规划：否

阻塞：
- PostgreSQL 是否共享尚未确认
- uploads 数据验证未定义
- SESSION_SECRET 无恢复方式

警告：
- 日志将不迁移
- HTTP session 会失效
```

---

# 三十六、批量操作边界

允许批量操作：

- 将系统 package 标记为 host infrastructure；
- 将 cache 目录标记为不迁移；
- 将多个低风险日志目录标记为可选归档；
- 接受同类 Capability 推荐。

不允许批量操作：

- 数据库归属；
- Secret 恢复；
- 共享 Volume；
- 关键数据排除；
- Workload 合并；
- 服务停止策略；
- Cutover 风险；
- Critical Evidence 排除。

---

# 三十七、审计要求

所有 Review 操作都要记录：

- 谁做的；
- 何时做的；
- 基于哪个 Snapshot；
- 原推荐是什么；
- 用户选择是什么；
- 是否覆盖系统推断；
- 理由；
- 影响哪些 Blueprint；
- 是否接受风险。

```ts
interface ReviewAuditEvent {
  id: string;
  projectId: string;

  eventType:
    | "candidate-confirmed"
    | "candidates-merged"
    | "candidate-split"
    | "evidence-reassigned"
    | "resource-marked-shared"
    | "question-answered"
    | "risk-accepted"
    | "blueprint-confirmed";

  subjectIds: string[];

  before?: unknown;
  after?: unknown;

  reason?: string;

  actorId: string;
  occurredAt: string;
}
```

---

# 三十八、首期 MVP Review 流程

首期不要一次实现全部高级能力。

## MVP 必须支持

- Candidate 列表；
- 确认；
- 合并；
- 拆分；
- Evidence 移动；
- shared/external/excluded；
- Workload 命名；
- Runtime 补全；
- Deployment 补全；
- Config 分类；
- Dataset 分类；
- Secret Requirement；
- Endpoint；
- Scheduled Task；
- Ephemeral State Policy；
- Verification；
- Readiness Gate；
- Blueprint Revision。

## MVP 可以暂缓

- 多用户实时协同；
- 图形拖拽编辑；
- 自动学习用户行为；
- 复杂批量规则；
- 高级 RBAC；
- 多环境 Blueprint overlay；
- 多区域拓扑；
- 自动生成完整业务测试；
- 自动数据迁移策略优化。

---

# 三十九、首期黄金场景 Review 流程

针对：

```text
Nginx
+ Node.js systemd app
+ PostgreSQL
+ uploads
+ .env
+ domain/TLS
+ cron
```

Review 应引导用户完成：

1. 确认这是一个个人博客；
2. 将 Nginx 标记为共享或专用；
3. 确认 blog.service 是应用入口；
4. 确认 Git/Artifact 部署来源；
5. 确认 `/var/lib/blog/uploads` 是关键数据；
6. 确认 `blog_production` 数据库归属；
7. 确认 PostgreSQL 是否共享；
8. 创建 DATABASE_PASSWORD 和 SESSION_SECRET Requirement；
9. 确认 cron 属于博客；
10. 定义 HTTP drain 和 DB quiesce；
11. 定义首页、数据库和上传数据验证；
12. 创建 Blueprint Revision；
13. 通过 Migration Planner-readiness 检查。

---

# 四十、最终确定的规则

1. Candidate Review 分为边界确认、合同补全和晋升检查三个阶段。
2. Candidate 可以确认、合并、拆分、调整归属、标记共享或忽略。
3. 所有操作必须保存不可覆盖的 Decision 和 Audit Event。
4. Workload 边界先于部署和数据策略。
5. 同一个 exclusive Evidence 只能属于一个 Workload。
6. 共享资源必须确定管理方式，不能只标记 shared。
7. 合并 Candidate 前必须检查数据、生命周期、Cutover 和负责人冲突。
8. 拆分 Candidate 后所有 Critical Evidence 必须有明确去向。
9. Runtime、Deployment、Config、Dataset、Secret、Endpoint、Schedule、Ephemeral State 和 Verification 都必须逐项补全。
10. 用户可以选择“暂不确定”，但系统必须明确阻塞的 Project Type。
11. Blueprint Confirmed 不等于对所有模式 Planner-ready。
12. Planner readiness 必须针对 Build、Migration、Capture 和 Restore 分别计算。
13. Migration 必须完成数据归属、一致性、服务状态和业务验证门禁。
14. Capture 的门禁最严格，不允许存在 Critical Unassigned Evidence。
15. Hard Blocker 永远不能通过风险确认绕过。
16. 风险接受必须绑定用户、Blueprint Revision 和具体影响。
17. Blueprint Promotion 前必须展示业务级 Preview。
18. Confirmed Blueprint Revision 不可修改，只能产生新 Revision。
19. 新 Snapshot 不能自动修改 Blueprint，只能产生 Drift Proposal。
20. Planner 只能消费确认且通过对应模式 Readiness Gate 的 Blueprint Revision。

下一步应确定 **Workload Blueprint 到 Plan Revision 的编译规则**：哪些 Blueprint 字段转换成 Action、Dataset Execution Contract、Secret Binding、Cutover、Verification 和 Rollback，以及 Build、Migration、Capture、Restore 四种编译器分别做什么。

## Prompt:
2026/7/18 21:40:06

确定 Workload Blueprint 到 Plan Revision 的编译规则：哪些 Blueprint 字段转换成 Action、Dataset Execution Contract、Secret Binding、Cutover、Verification 和 Rollback，以及 Build、Migration、Capture、Restore 四种编译器分别做什么

## Response:
2026/7/18 21:40:09

这一轮我会把 Blueprint Compiler 定义成一个严格的“目标无关合同 → 目标特定不可变执行计划”编译器，并分别规定 Build、Migration、Capture、Restore 的输入、输出、编译阶段、阻塞条件和禁止隐式推断的边界。

当前 Planner 主要消费软件列表和配置检查项，没有真正消费 Graph、Service Stack、数据合同、Secret、Cutover 与业务验证；因此新的 Blueprint Compiler 应成为替换旧 Migration Planner 的正式边界，而不是在旧 Planner 上继续增加条件分支。`8bead08a-b983-4703-97e2-6580c02aff9c.md`

**document: **

# EnvForge Workload Blueprint → Plan Revision 编译规则基线

## 一、编译器的核心定义

Workload Blueprint 描述：

> 这个业务需要什么、如何运行、如何保存、如何验证。

Plan Revision 描述：

> 针对当前项目、当前源环境、当前目标环境和当前用户决策，EnvForge 准备具体执行哪些动作。

二者关系：

```text id="tqesvd"
Workload Blueprint Revision
+ DecisionSet Revision
+ Source Snapshot
+ Target Snapshot
+ Compatibility Result
+ Capability Implementations
+ Project Policy
        ↓
Plan Compiler
        ↓
Immutable Plan Revision
```

必须严格遵守：

- Blueprint 是目标无关合同；
- Plan 是目标特定执行合同；
- Blueprint 不包含当前目标 IP、包管理器命令和传输进度；
- Plan 不重新猜测业务边界；
- Planner 不直接消费原始 package、process 或 DataPath；
- Planner 只能消费已确认、对当前模式 Planner-ready 的 Blueprint Revision。

---

# 二、四种编译器

领域层应定义四个正式编译器：

```ts id="q7d77o"
interface PlanCompiler {
  compile(input: PlanCompilerInput): PlanCompilationResult;
}

class BuildPlanCompiler implements PlanCompiler {}
class MigrationPlanCompiler implements PlanCompiler {}
class CapturePlanCompiler implements PlanCompiler {}
class RestorePlanCompiler implements PlanCompiler {}
```

未来可以增加：

```text id="mq59c2"
RepairPlanCompiler
ClonePlanCompiler
```

但首期不作为核心范围。

## 四种编译器的差异

| 编译器 | 主要输入 | 主要输出 | 是否有数据迁移 | 是否有 Cutover |
|---|---|---|---:|---:|
| Build | Blueprint + Target | 新环境安装计划 | 初始化数据 | 否 |
| Migration | Blueprint + Source + Target | 在线迁移计划 | 是 | 是 |
| Capture | Blueprint + Source + Archive Storage | 封存计划 | 数据采集 | 否 |
| Restore | Archive + Blueprint + Target | 恢复计划 | 数据恢复 | 通常否 |

---

# 三、正式编译输入

```ts id="cuz74k"
interface PlanCompilerInput {
  project: {
    id: string;
    type: "build" | "migration" | "capture" | "restore";
    policyProfileId: string;
  };

  blueprintRefs: BlueprintRevisionRef[];

  decisionSetRef: {
    id: string;
    revision: number;
    contentHash: string;
  };

  source?: {
    endpointId: string;
    snapshotId: string;
    snapshotHash: string;
  };

  target?: {
    endpointId: string;
    snapshotId: string;
    snapshotHash: string;
  };

  archive?: {
    archiveId: string;
    manifestHash: string;
  };

  compatibilityResults?: CompatibilityResult[];

  capabilityImplementations: CapabilityImplementationRef[];

  policyContext: {
    riskTolerance: "strict" | "standard" | "permissive";
    manualStepsAllowed: boolean;
    maximumParallelism?: number;
    requireBusinessVerification: boolean;
    requireRollback: boolean;
  };

  compilerContext: {
    compilerVersion: string;
    rulesetVersion: string;
    catalogVersion: string;
    generatedAt: string;
  };
}
```

## 必须绑定 Hash

Plan Revision 必须绑定：

- Blueprint Revision Hash；
- DecisionSet Hash；
- Source Snapshot Hash；
- Target Snapshot Hash；
- Archive Manifest Hash；
- Capability Implementation Version；
- Compiler Version；
- Policy Version。

任何一个输入变化，都不能原地修改 Plan。

必须重新编译新的 Plan Revision。

---

# 四、正式编译输出

```ts id="80fxob"
interface PlanRevision {
  id: string;
  projectId: string;

  revision: number;

  planType:
    | "build"
    | "migration"
    | "capture"
    | "restore";

  status:
    | "draft"
    | "review-required"
    | "approved"
    | "superseded"
    | "revoked";

  inputBindings: PlanInputBindings;

  workloadPlans: WorkloadPlan[];

  actionGraph: ActionGraph;

  datasetExecutionContracts: DatasetExecutionContract[];

  secretExecutionContracts: SecretExecutionContract[];

  cutoverContract?: CutoverExecutionContract;

  verificationExecutionContract: VerificationExecutionContract;

  rollbackExecutionContract: RollbackExecutionContract;

  manualSteps: ManualPlanStep[];

  gates: PlanGate[];

  estimates: PlanEstimate;

  risks: PlanRisk[];

  knownLimitations: string[];

  artifacts: PlanArtifactRef[];

  compilerEvidence: CompilerEvidence;

  planHash: string;

  createdAt: string;
}
```

Plan Revision 一旦生成，不允许修改。

审批只是增加独立 Approval，不改变 Plan 内容。

---

# 五、编译过程的统一阶段

四个编译器共享十一个阶段：

```text id="aa9aqr"
1. Validate Inputs
2. Resolve Workload Dependency Graph
3. Resolve Target Compatibility
4. Resolve Decisions
5. Select Capability Implementations
6. Compile Resource Intents
7. Compile Dataset Contracts
8. Compile Secret Contracts
9. Compile Runtime and Cutover
10. Compile Verification and Rollback
11. Build Action DAG and Gates
```

任何阶段出现 Hard Blocker，编译失败。

出现人工处理项时，可以生成 `review-required` Plan，但不能自动批准。

---

# 六、阶段 1：Validate Inputs

编译前检查：

## Blueprint

- Revision 存在；
- contentHash 正确；
- 对当前模式 Planner-ready；
- 未被 superseded；
- required Component 完整；
- 无 Hard Blocker；
- 无 Critical Drift。

## DecisionSet

- Revision 和 Hash 正确；
- 必要问题已回答；
- 所有风险接受仍有效；
- Decision 未引用旧 Blueprint Revision。

## Snapshot

Migration 必须：

- Source Snapshot 存在；
- Target Snapshot 存在；
- Hash 可验证；
- Snapshot 没有超出允许的新鲜度；
- Collector completeness 达到要求。

Build 和 Restore 必须有 Target Snapshot。

Capture 必须有 Source Snapshot。

## Archive

Restore 必须：

- Archive 状态为 ready 或 restore-tested；
- Manifest Hash 有效；
- Dataset Artifact 可访问；
- Encryption Key Provider 可用；
- Archive 未过期或 degraded 未被明确接受。

---

# 七、阶段 2：解析 Workload 依赖图

多个 Blueprint 之间可能有：

```text id="i90ohq"
Blog
→ Shared PostgreSQL
→ Backup Workload
→ Shared Nginx
```

编译器必须建立：

```ts id="bu03pc"
interface WorkloadDependencyGraph {
  nodes: WorkloadPlanNode[];
  edges: WorkloadDependencyEdge[];
}
```

## 编译规则

### Hard dependency

必须先准备依赖，再启动消费者。

```text id="fyu5ej"
PostgreSQL prepare
→ PostgreSQL restore
→ PostgreSQL verify
→ Blog start
```

### Runtime dependency

影响启动和验证顺序。

### Migration dependency

影响：

- initial sync 顺序；
- quiesce 顺序；
- Cutover 顺序；
- rollback 顺序。

### Shared reverse proxy

通常：

```text id="58imsc"
Application Prepare
→ Application Local Verify
→ Reverse Proxy Route Update
→ Public Verify
```

### 循环依赖

出现循环时不能简单拓扑排序。

需要：

- Capability 提供明确启动策略；
- 拆分为 prepare/start/verify 阶段；
- 或要求人工处理。

无法解决的循环依赖阻止编译。

---

# 八、阶段 3：目标兼容性解析

编译器将：

```text id="8mxtqc"
Compatibility Envelope
+
Target Snapshot
```

转换为：

```ts id="5kypbb"
interface CompatibilityResolution {
  workloadId: string;

  status:
    | "compatible"
    | "compatible-with-conversion"
    | "manual"
    | "blocked";

  conversions: CompatibilityConversion[];

  conflicts: TargetConflict[];

  selectedImplementations: string[];
}
```

## 转换类型

- apt → dnf 不允许通过字符串替换处理，必须选择不同 Capability Adapter；
- x86 binary → ARM 目标，需要重新构建或替代 Artifact；
- PostgreSQL 14 → PostgreSQL 16，需要选择逻辑恢复；
- 目标路径冲突，需要 Decision；
- 目标端已有包，需要 reuse/upgrade/replace；
- 目标用户 UID 冲突，需要 Identity Mapping；
- 端口占用，需要改端口或解决冲突；
- 目标磁盘不足，直接 blocker。

## Target Drift

Plan 绑定 Target Snapshot Hash。

Apply 前必须重新进行轻量 Target Precondition Scan。

如果发现：

- 包版本变化；
- 路径变化；
- 端口冲突；
- 用户冲突；
- 磁盘不足；
- 服务已存在；
- Snapshot Hash 不一致；

不能静默继续。

处理方式：

```text id="tw3ccp"
non-material drift
→ 允许继续并记录

material drift
→ 旧 Plan revoked/superseded
→ 重新编译
```

---

# 九、阶段 4：解析 DecisionSet

Blueprint 描述允许选项，DecisionSet 选择具体方案。

例如 Blueprint：

```text id="taq3or"
Dataset 支持：
- logical dump/restore
- physical backup
- manual
```

DecisionSet：

```text id="kr2w0k"
选择 logical dump/restore
最大停机 10 分钟
```

Plan：

```text id="tlb3qa"
具体生成：
- pg_dump
- artifact transfer
- pg_restore
- source quiesce
- final verification
```

## DecisionSet 应提供

- Component disposition；
- Dataset strategy；
- Secret Provider；
- shared resource handling；
- conflict resolution；
- maintenance window；
- downtime；
- traffic switch；
- verification choices；
- rollback policy；
- risk acceptance。

## 编译器禁止代替用户决定

以下内容不得静默默认：

- 跳过关键 Dataset；
- 将共享数据库当专用；
- 自动停止生产服务；
- 自动覆盖目标文件；
- 自动删除目标已有数据；
- 自动复制 Secret；
- 自动切换 DNS；
- 自动接受业务验证缺失；
- 自动选择不可回滚策略。

---

# 十、阶段 5：选择 Capability Implementation

Blueprint 只引用 Capability 知识：

```text id="wbdo6r"
postgresql
nginx
custom-node-app
```

Plan 编译器必须选择具体实现版本：

```ts id="gvmj4t"
interface CapabilityImplementationRef {
  capabilityId: string;
  version: string;

  supportedOperations: Array<
    "build"
    | "detect"
    | "migrate"
    | "capture"
    | "restore"
    | "verify"
    | "rollback"
  >;

  targetConstraints: CompatibilityEnvelope;

  adapterId: string;

  certificationLevel: string;
}
```

## 选择规则

优先级：

1. Production Migration Certified；
2. 当前目标兼容；
3. 精确版本支持；
4. 支持所选 Dataset Strategy；
5. 支持所需 Verify/Rollback；
6. 用户允许的手工处理比例。

如果 Capability 只能 Build，不能用于 Migration 数据恢复。

不能因为 Catalog 标记 official，就认为它支持所有操作。

---

# 十一、Blueprint 字段到 Plan 的映射

## 1. Components → WorkloadPlan 与 Action 分组

Blueprint：

```text id="gmz5cm"
components[]
```

转换为：

```ts id="xplzwh"
interface WorkloadPlan {
  workloadId: string;
  blueprintRevisionId: string;

  componentPlans: ComponentPlan[];

  dependencyRefs: string[];

  actionIds: string[];

  datasetContractIds: string[];

  verificationCheckIds: string[];

  rollbackUnitId: string;
}
```

每个 Component 根据 `migrationDisposition` 编译：

| Blueprint disposition | Plan 行为 |
|---|---|
| rebuild | 安装、渲染配置、启动 |
| transfer | 传输 Artifact 或目录 |
| restore | 从 Archive/Data Artifact 恢复 |
| reuse-target | 检查目标已有资源并绑定 |
| external | 只做连接和验证 |
| skip | 无执行动作，但记录风险 |
| manual | 生成结构化人工步骤 |

---

## 2. RuntimeContract → Runtime Actions

Blueprint RuntimeContract：

- executionModel；
- entrypoint；
- user/group；
- workingDirectory；
- restartPolicy；
- dependency order；
- security context。

转换为 Plan Actions：

```text id="xmum1v"
EnsureIdentity
EnsureDirectory
InstallRuntime
InstallServiceDefinition
ReloadServiceManager
EnableService
StartService
StopService
RestartService
WaitForRuntimeReady
```

例如 systemd：

```text id="cr1785"
Create user blog
→ Create /opt/blog
→ Write reviewed blog.service Artifact
→ systemctl daemon-reload
→ systemctl enable blog.service
→ systemctl start blog.service
→ verify active
```

## 禁止事项

不能从 Blueprint 直接拼接任意 shell。

必须生成结构化 Action：

```ts id="ifnm83"
interface PlanAction {
  id: string;

  type: ActionType;

  targetEndpointId?: string;
  sourceEndpointId?: string;

  workloadId: string;
  componentId?: string;

  adapterId: string;

  inputs: Record<string, unknown>;

  preconditions: ActionCondition[];

  dependencies: string[];

  verificationCheckIds: string[];

  rollbackDefinition?: ActionRollbackDefinition;

  resumability:
    | "idempotent"
    | "step-resumable"
    | "restart-required"
    | "manual";

  riskLevel:
    | "low"
    | "medium"
    | "high"
    | "critical";
}
```

Raw shell 只能存在于明确的：

```text id="cwp7vx"
ReviewedCommandAction
```

并必须：

- 用户审查；
- 固定 Artifact；
- 无 Secret 明文；
- 明确 rollback；
- 受 Policy Gate 限制。

---

## 3. DeploymentContract → Artifact 与部署 Actions

### Package

转换为：

- AddRepository；
- RefreshPackageIndex；
- InstallPackage；
- PinVersion；
- VerifyPackageVersion。

### Git

转换为：

- FetchSource；
- VerifyCommit；
- Restore/Substitute Source Artifact；
- InstallBuildRuntime；
- BuildArtifact；
- VerifyBuildArtifact；
- DeployArtifact。

Migration/Capture 场景中，如果未来 Git 源可能失效，应根据 Blueprint 要求保存 fallback Artifact。

### Container Image

转换为：

- AuthenticateRegistry；
- PullImageByDigest；
- VerifyDigest；
- CreateNetwork；
- CreateVolume；
- CreateContainer；
- StartContainer；
- HealthCheck。

不允许仅使用 mutable tag：

```text id="um9hmb"
latest
```

除非用户明确接受风险，并在 Plan 中记录实际解析到的 digest。

### Compose

转换为：

- Store Reviewed Compose Artifact；
- Render Environment References；
- Validate Compose；
- Pull/Build Images；
- Prepare Volumes；
- Compose Up；
- Verify Services。

### Binary/Directory Artifact

转换为：

- Resolve Artifact；
- Verify checksum；
- Transfer Artifact；
- Extract；
- Set owner/mode；
- Install service definition；
- Verify runtime.

---

## 4. ConfigContract → Config Actions

Config 策略映射：

| Blueprint 策略 | Plan Action |
|---|---|
| copy | Transfer reviewed Artifact |
| template | Render with approved variables |
| regenerate | Capability Adapter 生成 |
| merge | 三方合并并产生差异 Artifact |
| target-existing | 验证目标配置 |
| manual | 人工步骤 |
| exclude | 无动作，记录风险 |

每个 Config Action 必须包含：

- source Artifact Hash；
- target path；
- precondition；
- backup before change；
- owner/group/mode；
- Secret placeholder；
- syntax verification；
- rollback Artifact。

例如：

```text id="b2dkp9"
Backup /etc/nginx/sites-enabled/blog.conf
→ Render reviewed template
→ Write temp file
→ nginx -t against temp/full config
→ Atomic replace
→ Reload Nginx
```

不能直接覆盖后再验证。

---

# 十二、DatasetContract → Dataset Execution Contract

Blueprint DatasetContract 描述：

- 数据是什么；
- 谁拥有；
- 一致性要求；
- 可用策略；
- 验证要求。

Plan 生成：

```ts id="ru6atw"
interface DatasetExecutionContract {
  id: string;

  workloadId: string;
  datasetId: string;

  source?: ResolvedDatasetLocation;
  target?: ResolvedDatasetLocation;
  archive?: ArchiveDatasetRef;

  strategy:
    | "logical-dump-restore"
    | "physical-backup-restore"
    | "initial-final-rsync"
    | "snapshot-transfer"
    | "volume-export-import"
    | "recreate"
    | "reuse-target"
    | "manual";

  consistency: {
    requiredLevel: string;
    method: string;
    quiesceActionIds: string[];
    consistencyCheckpointId?: string;
  };

  stages: DatasetExecutionStage[];

  transferSpec?: TransferSpecification;

  verificationCheckIds: string[];

  rollback: DatasetRollbackExecution;

  estimates: {
    sourceBytes?: number;
    transferBytes?: number;
    estimatedDurationSeconds?: number;
    estimatedDowntimeSeconds?: number;
  };

  blockers: string[];
}
```

## Dataset 编译阶段

```text id="7j0lm5"
Preflight
→ Target Prepare
→ Initial Copy
→ Source Quiesce
→ Final Copy
→ Restore/Activate
→ Verify
→ Commit
```

并非每种策略都有所有阶段。

---

## 1. Filesystem Dataset

Blueprint：

```text id="ms4nvi"
kind = filesystem
consistency = application-consistent
writers = blog.service
```

Migration Plan：

```text id="olqhsu"
创建目标目录
→ initial rsync
→ drain blog
→ stop/quiesce blog.service
→ final rsync
→ checksum/manifest verify
→ target service start
```

Capture Plan：

```text id="sxdqdr"
initial archive copy
→ quiesce
→ final archive copy
→ generate manifest
→ encrypt
→ verify stored chunks
```

Restore Plan：

```text id="lvsncx"
download archive chunks
→ verify hash
→ restore files
→ restore ACL/xattr/ownership
→ verify manifest
```

---

## 2. PostgreSQL Dataset

Blueprint 只描述：

- PostgreSQL Dataset；
- consistency requirement；
- supported strategy；
- verification requirement。

Migration Compiler 根据版本和停机限制选择已批准策略。

例如逻辑迁移：

```text id="uawzgc"
Inspect source cluster
→ Prepare target PostgreSQL
→ Create roles
→ Dump globals
→ Dump database
→ Transfer dump Artifact
→ Quiesce application
→ Final dump or delta strategy
→ Restore globals
→ Restore database
→ Verify extensions/schema/rows
→ Start application
```

Capture：

```text id="quvu3w"
Create transaction-consistent dump
→ Store dump Artifact
→ Store role/extension metadata
→ Encrypt
→ Verify restore Artifact
```

Restore：

```text id="hfyrrl"
Install compatible PostgreSQL
→ Restore roles
→ Restore database
→ Reassign ownership
→ Verify data
```

如果目标版本、extension 或 locale 不兼容，编译失败或生成明确人工转换步骤。

---

# 十三、SecretRequirement → Secret Execution Contract

Blueprint 不能保存 Secret 值。

DecisionSet 选择 Provider。

Plan 生成：

```ts id="m9osd3"
interface SecretExecutionContract {
  id: string;

  secretRequirementId: string;

  workloadId: string;
  consumerComponentIds: string[];

  providerBinding:
    | UserInputBinding
    | VaultBinding
    | SopsBinding
    | TargetExistingBinding
    | RegenerateBinding
    | OutOfBandBinding;

  requiredAtStage:
    | "prepare"
    | "restore"
    | "startup"
    | "verification";

  injectionActions: SecretInjectionAction[];

  validationCheckIds: string[];

  cleanupActions: string[];

  rotationActions: string[];

  persistencePolicy:
    | "runtime-only"
    | "target-persistent"
    | "external-only";

  redactionPolicyId: string;
}
```

## Secret 编译规则

### User Input

Plan 保存：

- Requirement；
- 输入时机；
- 格式约束；
- fingerprint 对比规则。

不保存值。

Run 执行时进入：

```text id="roqu33"
blocked: awaiting-secret
```

### Vault/SOPS

Plan 保存逻辑引用，不保存解析后的明文。

### Target Existing

生成：

- Check Secret Exists；
- Validate permissions；
- Validate consumer access。

### Regenerate

生成：

- Generate Secure Value；
- Inject；
- Verify；
- 可选 Store to Provider。

## Secret Gate

缺少 required Provider Binding 时：

- 可以生成 Draft Plan；
- 不能批准；
- 不能 Apply。

---

# 十四、EndpointContract → 网络和入口 Actions

Blueprint EndpointContract 描述逻辑入口。

Plan 解析成目标具体内容：

- bind address；
- target port；
- firewall rule；
- proxy route；
- TLS strategy；
- DNS action；
- health endpoint。

可能生成：

```text id="wyd5oj"
ReservePort
OpenFirewallPort
RenderReverseProxyRoute
IssueCertificate
InstallCertificate
ValidateTLS
UpdateDNS
ValidatePublicEndpoint
```

## 共享反向代理

应用 Blueprint 不应直接重新安装共享 Nginx。

Plan 应：

- 引用 Shared Reverse Proxy Workload Plan；
- 生成应用 route fragment；
- 由 Proxy Workload Action 合并和验证；
- 防止多个应用 Plan 并发覆盖同一配置。

---

# 十五、SystemIdentityContract → 身份 Actions

转换为：

- InspectTargetUser；
- CreateUser；
- CreateGroup；
- MapUID/GID；
- AddMembership；
- SetOwnership；
- VerifyIdentity。

冲突处理必须来自 DecisionSet：

- reuse；
- map；
- rename；
- block。

不能自动删除或替换目标已有用户。

---

# 十六、ScheduledTaskContract → 任务 Actions

转换为：

- Install Cron；
- Install Timer Unit；
- Disable Source Schedule；
- Wait Active Job；
- Enable Target Schedule；
- Verify Schedule；
- Rollback Schedule。

Migration 中默认顺序：

```text id="mrpt63"
安装目标任务但保持 disabled
→ Cutover 前停止源端调度
→ 处理 active job
→ Cutover Commit 后启用目标任务
```

避免源目标重复执行。

Build 和 Restore 不需要停用源任务。

---

# 十七、DependencyContract → DAG 边与 Gates

DependencyContract 不一定产生独立 Action，但会影响：

- Action DAG；
- startup order；
- verification order；
- Cutover order；
- rollback order；
- blocker。

例如：

```text id="91za6c"
Blog requires PostgreSQL
```

编译为：

```text id="6lran0"
PostgreSQL Restore
→ PostgreSQL Data Verify
→ Blog Start
→ Blog DB Connectivity Verify
```

外部依赖则生成：

```text id="x5f5bz"
Check External Dependency
```

失败时根据 Blueprint：

- block startup；
- degraded；
- retry；
- manual。

---

# 十八、EphemeralStatePolicy → Drain 与 Quiesce Actions

Blueprint 规定如何处理瞬时状态。

Migration Compiler 将其编译为：

| Policy | Plan 行为 |
|---|---|
| drain | 停止接收新请求，等待现有请求 |
| quiesce | 进入只读/维护/停止写入 |
| checkpoint | 保存任务进度 |
| restart | 允许目标重启恢复 |
| rebuild | 重新预热缓存 |
| discard | 明确记录可丢失 |
| manual | 人工确认步骤 |

例如：

```text id="0v589g"
HTTP requests = drain
DB transactions = quiesce
memory cache = rebuild
sessions = discard
```

Plan：

```text id="tzxsq2"
Enable maintenance mode
→ Remove source from traffic
→ Wait active requests = 0
→ Wait DB transactions below threshold
→ Stop source writer
→ Final data sync
```

Build、Capture 和 Restore 的处理不同：

- Build：通常不消费源瞬时状态；
- Migration：完整消费；
- Capture：需要达到一致性点，但不做 traffic switch；
- Restore：根据 Archive 状态恢复后重建临时状态。

---

# 十九、CompatibilityEnvelope → Preflight 与转换 Actions

Compatibility Envelope 可能产生：

- Check Architecture；
- Check Disk；
- Check OS；
- Install Runtime；
- Convert Config；
- Rebuild Artifact；
- Choose DB Migration Mode；
- Block Unsupported Target。

兼容性检查应出现在两处：

## Compile time

使用 Target Snapshot 生成 Plan。

## Apply time

执行轻量 Precondition Action，防止 Target Drift。

---

# 二十、VerificationContract → Verification Execution Contract

Blueprint 中的 Check 是目标无关定义。

Plan 将其解析为具体执行步骤。

```ts id="ofomf6"
interface VerificationExecutionContract {
  checks: ResolvedVerificationCheck[];

  phases: {
    preApply: string[];
    postAction: string[];
    preCutover: string[];
    postCutover: string[];
    observation: string[];
    final: string[];
  };

  successPolicy:
    | "all-required"
    | "threshold"
    | "manual-approval";

  failurePolicy: {
    blockNextStage: boolean;
    triggerRollbackRecommendation: boolean;
    autoRollbackEligible: boolean;
  };
}
```

## 验证编译原则

### Artifact

- checksum；
- owner/mode；
- image digest。

### Syntax

- nginx -t；
- compose config；
- systemd verify。

### Runtime

- systemctl active；
- container health；
- restart count。

### Network

- socket；
- local HTTP；
- TLS。

### Dependency

- application → database；
- SMTP；
- object storage。

### Data

- row/schema；
- file manifest；
- object count；
- database extensions。

### Business

- 首页；
- 登录；
- read/write/delete；
- 用户自定义请求。

## 关键规则

所有 required Verification 必须进入 DAG。

不能在 Apply 成功后才由用户可选执行。

Plan 的最终成功必须由 Verification Contract 决定。

---

# 二十一、RollbackContract → Rollback Execution Contract

Blueprint 描述回滚要求，Plan 根据实际目标动作生成具体回滚。

```ts id="2myqfg"
interface RollbackExecutionContract {
  rollbackUnits: RollbackUnit[];

  classification:
    | "full"
    | "partial"
    | "manual"
    | "none"
    | "dangerous";

  rollbackWindow?: {
    durationSeconds: number;
    expiresAt?: string;
  };

  preconditions: RollbackCondition[];

  dataReconciliation?: DataReconciliationRequirement[];

  trafficRollbackActions: string[];

  sourceResumeActions: string[];

  targetCleanupActions: string[];

  knownIrreversibleActions: string[];
}
```

## Action Rollback 编译

每个可变 Action 编译时必须产生：

- before-state capture；
- rollback action；
- rollback verification。

例如包安装：

```text id="3tvtwr"
检查 existedBefore
→ 安装

Rollback：
只有 existedBefore = false 才允许卸载
```

配置：

```text id="hifxfw"
备份原文件 Artifact
→ 原子替换

Rollback：
恢复原 Artifact
→ syntax verify
→ reload
```

服务：

```text id="huxuay"
记录原 enabled/active 状态

Rollback：
恢复原状态
```

数据：

- 新建目标数据库可以删除；
- 覆盖已有目标数据库通常需要预备份；
- Cutover 后新写入可能无法自动回滚；
- 必须明确 classification。

## 不允许假回滚

以下不能标为 full：

- 已产生目标新写入但无反向同步；
- DNS 缓存无法快速恢复；
- 第三方 API 状态已修改；
- 数据库 schema 不可逆；
- 外部用户已访问新环境。

---

# 二十二、Action Graph

Plan 中所有动作组成有向无环图。

```ts id="0sji56"
interface ActionGraph {
  nodes: PlanAction[];
  edges: ActionDependency[];
  stages: PlanStage[];
}
```

## 标准 Stage

```text id="nnehyp"
PREFLIGHT
PREPARE
TRANSFER
CONFIGURE
QUIESCE
FINAL_SYNC
ACTIVATE
CUTOVER
VERIFY
OBSERVE
COMMIT
CLEANUP
```

不同编译器使用不同子集。

## Action 依赖类型

```ts id="3ys2f7"
type ActionDependencyType =
  | "must-complete-before"
  | "must-succeed-before"
  | "rollback-after"
  | "same-checkpoint"
  | "exclusive-resource-lock";
```

## 资源锁

共享资源需要锁：

- package manager；
- systemd daemon reload；
- Nginx config；
- PostgreSQL instance；
- Docker daemon；
- shared directory；
- Archive Manifest。

防止并发 Plan 相互覆盖。

---

# 二十三、Plan Gate

```ts id="8x3jxe"
interface PlanGate {
  id: string;

  type:
    | "approval"
    | "target-precondition"
    | "secret-available"
    | "artifact-integrity"
    | "capacity"
    | "maintenance-window"
    | "manual-step"
    | "verification"
    | "rollback-ready"
    | "archive-storage";

  stage: string;

  required: boolean;

  statusAtCompilation:
    | "satisfied"
    | "pending"
    | "blocked";

  explanation: string;
}
```

Plan 可以带 pending Gate，但不能执行越过 Gate。

---

# 二十四、BuildPlanCompiler

## 目标

在目标机器创建新的工作负载。

## 输入

- Blueprint；
- Target Snapshot；
- DecisionSet；
- Secret Provider Binding；
- 可选 seed/upload Dataset。

## 编译阶段

```text id="e8152v"
Target Preflight
→ Prepare Identities
→ Install Runtime/Packages
→ Deploy Application
→ Render Config
→ Initialize Dataset
→ Bind Secret
→ Start Services
→ Verify
→ Generate Report
```

## Build 不生成

- Source Action；
- initial/final sync；
- source drain；
- traffic switch；
- source resume。

## Dataset 编译

只允许：

- empty；
- seed；
- uploaded；
- target-existing。

如果 Blueprint Dataset 来源是 source-host 或 archive，应该使用 Migration 或 Restore，而不是普通 Build。

## Rollback

通常清理本次创建内容，但不能删除目标原有资源。

必须依赖 before-state。

## Build Plan 成功条件

- 所有 required Component 安装；
- required Secret 注入；
- Runtime 验证；
- Endpoint 验证；
- 必要业务验证。

---

# 二十五、MigrationPlanCompiler

## 目标

将正在运行的源业务迁移到同时存在的目标机器。

## 输入

- Blueprint；
- Source Snapshot；
- Target Snapshot；
- Data Strategy；
- Secret Binding；
- downtime；
- Cutover Decisions；
- Rollback Policy。

## 标准编译阶段

```text id="xluq6j"
SOURCE_PREFLIGHT
TARGET_PREFLIGHT
TARGET_PREPARE
INITIAL_DATA_SYNC
TARGET_PREVERIFY
WAIT_MAINTENANCE_WINDOW
SOURCE_DRAIN
SOURCE_QUIESCE
FINAL_DATA_SYNC
TARGET_ACTIVATE
TRAFFIC_SWITCH
BUSINESS_VERIFY
OBSERVE
COMMIT
SOURCE_RETENTION
```

失败路径：

```text id="33xc2c"
ROLLBACK_TRAFFIC
TARGET_STOP
SOURCE_RESUME
DATA_RECONCILIATION
ROLLBACK_VERIFY
```

## Migration 特殊规则

### 源端动作最小化

源端只允许：

- 读取；
- initial sync；
- drain；
- quiesce；
- stop；
- final sync；
- resume。

不能在迁移过程中无必要升级或重构源业务。

### Prepare 和 Cutover 分离

Target Prepare 应尽可能在维护窗口前完成。

### Final Sync 必须位于一致性点后

不能先 final sync，再停止 writer。

### Verify 决定 Commit

业务验证失败：

- 不允许进入 Commit；
- 根据 Policy hold 或 rollback。

### 源服务器不能立即删除

进入：

```text id="1gzety"
retention / rollback window
```

完成观察后才能标记可释放。

---

# 二十六、CapturePlanCompiler

## 目标

将源业务封存为长期可恢复 Environment Archive。

## 输入

- Blueprint；
- Source Snapshot；
- Archive Storage；
- Capture Policy；
- Secret Preservation Policy；
- Integrity Level；
- Restore Drill Requirement。

## 标准阶段

```text id="j5b3wv"
SOURCE_PREFLIGHT
ARCHIVE_STORAGE_PREFLIGHT
CAPTURE_DEPLOYMENT_ARTIFACTS
INITIAL_DATA_CAPTURE
SOURCE_QUIESCE
FINAL_DATA_CAPTURE
CAPTURE_CONFIG
CAPTURE_METADATA
BUILD_MANIFEST
ENCRYPT
UPLOAD
VERIFY_HASH
VERIFY_REMOTE_STORAGE
GENERATE_RESTORE_REQUIREMENTS
OPTIONAL_RESTORE_DRILL
SAFE_TO_RELEASE_GATE
```

## Capture 特殊规则

### 不产生 Target Actions

Capture 没有目标主机。

### 必须捕获部署材料

根据 DeploymentContract：

- Git commit；
- lock file；
- container digest；
- Compose Artifact；
- binary；
- package metadata；
- fallback Artifact。

### 数据必须达到一致性要求

Capture 不能只保存目录 metadata。

### Secret

默认只保存 Requirement 和 Provider 信息。

只有用户明确允许且系统具备安全托管能力时，才生成加密 Secret Archive Contract。

### Archive Manifest

必须包含：

- Blueprint Hash；
- Dataset manifests；
- Config Artifacts；
- Deployment Artifacts；
- Verification Contract；
- Compatibility Envelope；
- Encryption metadata；
- content hashes。

### Safe to Release Gate

只有满足指定 Integrity Level，才能输出：

```text id="9qhyn6"
SAFE_TO_RELEASE_SOURCE
```

---

# 二十七、RestorePlanCompiler

## 目标

把 Environment Archive 恢复到一台具体的新目标服务器。

## 输入

- Archive；
- Archived Blueprint；
- Target Snapshot；
- Secret Provider Binding；
- Compatibility Decisions；
- Restore Policy。

## 标准阶段

```text id="ijyebw"
VERIFY_ARCHIVE
TARGET_PREFLIGHT
RESOLVE_COMPATIBILITY
PREPARE_TARGET
RESTORE_DEPLOYMENT_ARTIFACTS
INSTALL_RUNTIME
RESTORE_CONFIG
RESTORE_DATASETS
BIND_SECRETS
START_DEPENDENCIES
START_APPLICATION
VERIFY_DATA
VERIFY_BUSINESS
OBSERVE
COMMIT
```

## Restore 特殊规则

### 不能复用 Capture Plan Actions

Capture 发生时没有当前目标机。

Restore 必须重新编译。

### Archive 优先于外部来源

如果 Archive 保存了固定 Artifact，应优先使用 Archive 中的材料。

但可以在用户批准下：

- 使用更新的 Package；
- 重新构建；
- 转换配置；
- 升级数据库。

这些变化必须成为 Plan 风险和转换动作。

### 无 Cutover 的常见情况

如果原服务器已经不存在，Restore 通常没有 source drain 和 source rollback。

但可能仍有：

- DNS 上线；
- 流量启用；
- 业务验证；
- 目标回滚到空环境。

### Restore Rollback

主要是：

- 停止目标；
- 恢复目标原状态；
- 删除本次创建资源；
- 保留 Archive 不变。

不能回滚回已经释放的源服务器。

---

# 二十八、Manual Plan Step

无法自动化的动作不能留在自由文本里。

```ts id="yq1yjj"
interface ManualPlanStep {
  id: string;

  stage: string;

  title: string;
  instructions: string[];

  expectedEvidence: ManualEvidenceRequirement[];

  blocking: boolean;

  timeout?: number;

  verificationCheckIds: string[];

  rollbackInstructions?: string[];
}
```

例如 DNS：

```text id="c5pfng"
将 blog.example.com 的 A 记录修改为 203.0.113.20。

完成证据：
- DNS API 返回新值，或用户确认
- EnvForge 检测解析结果
- HTTPS 验证通过
```

用户点击“完成”不能直接通过，必须验证 expected evidence。

---

# 二十九、编译失败与 Review Required

编译结果：

```ts id="w9luft"
interface PlanCompilationResult {
  status:
    | "compiled"
    | "review-required"
    | "blocked";

  planRevision?: PlanRevision;

  blockers: CompilationBlocker[];

  requiredDecisions: CompilationQuestion[];

  warnings: CompilationWarning[];

  compilerTrace: CompilerTraceEntry[];
}
```

## Blocked

例如：

- Target 不兼容；
- required Artifact 缺失；
- required Dataset 无策略；
- Secret 无可用 Provider；
- Cutover 无法回滚且 Policy 禁止；
- 共享资源所有权冲突；
- Archive 损坏。

## Review Required

例如：

- 需要选择目标路径；
- 需要批准版本转换；
- 需要接受 session 丢失；
- 需要确认人工 DNS；
- 需要选择 logical/physical DB 策略。

编译器生成问题后，用户回答进入新的 DecisionSet Revision，再重新编译。

不能直接修改已经生成的 Plan。

---

# 三十、编译可解释性

每个生成 Action 必须能够追溯到：

```text id="pt0nuz"
Action
→ Blueprint Field
→ User Decision
→ Capability Rule
→ Snapshot Evidence
```

```ts id="hfo0kx"
interface CompilerEvidence {
  actionOrigins: {
    actionId: string;

    blueprintPaths: string[];
    decisionIds: string[];
    capabilityRuleIds: string[];
    evidenceIds: string[];

    explanation: string;
  }[];
}
```

UI 应显示：

> 为什么需要停止 blog.service？

答案：

> `/var/lib/blog/uploads` 要求 application-consistent，且 `blog.service` 是已确认 writer。用户允许在维护窗口停止写入，因此 Plan 在 final sync 前生成 Stop/Quiesce Action。

---

# 三十一、编译器不得做的事情

1. 不得从 Candidate 直接编译。
2. 不得从原始软件列表直接编译完整迁移。
3. 不得自动忽略 Critical Evidence。
4. 不得将 Blueprint 中的 unknown 视为 false。
5. 不得静默选择数据策略。
6. 不得保存 Secret 明文。
7. 不得生成未经审查的任意 shell。
8. 不得覆盖目标资源而不采集 before-state。
9. 不得把人工步骤标记为自动完成。
10. 不得把 Plan 内容当作已执行事实。
11. 不得在 Run 中临时添加未经审批动作。
12. 不得因为 Verify 命令存在就假设验证成功。
13. 不得生成虚假的 full rollback。
14. 不得跨 Snapshot Hash 复用审批。
15. 不得复用 Capture Plan 作为 Restore Plan。

---

# 三十二、Plan Review 应展示的业务摘要

Plan Review 默认不显示 Action 列表，而先显示：

```text id="6fzcym"
个人博客迁移计划

目标变化
- 安装 Node.js 22
- 创建 blog 用户
- 部署 Git commit abc123
- 创建 systemd 服务
- 增加 Nginx 路由

数据
- PostgreSQL 4.8 GB：逻辑迁移
- uploads 18 GB：initial + final rsync
- cache：重新生成
- logs：不迁移

Secret
- DATABASE_PASSWORD：执行时从 Vault 获取
- SESSION_SECRET：迁移后轮换

停机
- 预计 4-8 分钟
- 停止新请求
- 等待数据库事务
- 最终同步后切换

验证
- 数据库对象和关键行数
- 首页和登录
- 上传文件访问

回滚
- 流量可切回
- 源服务保留 24 小时
- 目标新写入无法自动回灌
```

技术 Action DAG 放在高级详情中。

---

# 三十三、当前代码演进建议

当前：

```text id="3squax"
snapshot.software
+ configChecklist
→ migration Plan
```

演进为：

```text id="tyqj4l"
Confirmed Blueprint Revision
+ DecisionSet
+ Source Snapshot
+ Target Snapshot
→ MigrationPlanCompiler
→ PlanRevision
```

## 可保留

- 现有 Environment Plan Hash；
- Artifact Hash；
- Approval Binding；
- legacy mutation 410 边界；
- ApplyRun/ActionRun 的部分结构；
- managed adapter 概念；
- Plan Report 的展示框架。

## 需要替换或扩展

- Migration Planner 输入；
- 单层 Action List；
- Verify 作为后续手工请求；
- Plan 上保存最近 Verify/Rollback；
- 同步 HTTP Apply；
- Catalog official 即可执行的能力判断。

---

# 三十四、首期 MVP 编译范围

建议首期只覆盖黄金场景：

```text id="f82c86"
Nginx
+ 自定义 Node.js/Python systemd App
+ PostgreSQL
+ 文件 Dataset
+ .env Secret
+ 域名/TLS
+ cron/timer
```

## Build Compiler MVP

- package/runtime；
- systemd；
- Nginx；
- PostgreSQL 初始化；
- Config Artifact；
- Secret runtime injection；
- HTTP/runtime verification。

## Migration Compiler MVP

- target prepare；
- PostgreSQL dump/restore；
- filesystem initial/final rsync；
- service quiesce；
- manual DNS/proxy Cutover；
- data + HTTP verification；
- source retention rollback。

## Capture Compiler MVP

- Deployment Artifact；
- PostgreSQL dump；
- filesystem archive；
- Config Artifact；
- Secret Requirement；
- manifest/hash/encryption；
- storage verification。

## Restore Compiler MVP

- archive verification；
- target compatibility；
- runtime install；
- config restore；
- database restore；
- file restore；
- Secret binding；
- business verification。

---

# 三十五、最终确定的编译规则

1. Blueprint 是目标无关合同，Plan 是目标特定执行合同。
2. Build、Migration、Capture、Restore 使用独立编译器，共享公共编译阶段。
3. 编译输入必须绑定 Blueprint、DecisionSet、Snapshot、Archive、Capability 和 Policy Hash。
4. Planner 只能消费 confirmed 且对当前模式 Planner-ready 的 Blueprint Revision。
5. Components 编译为 WorkloadPlan 和结构化 Action。
6. RuntimeContract 编译为身份、目录、服务定义、启动和运行验证动作。
7. DeploymentContract 编译为包、Git、Container、Compose 或 Artifact 部署动作。
8. ConfigContract 必须编译为受审 Artifact、模板、原子写入、验证和回滚。
9. DatasetContract 编译为独立 Dataset Execution Contract，而不是普通 Action 文案。
10. SecretRequirement 编译为运行时 Provider Binding、注入、验证、清理和轮换合同。
11. EndpointContract 编译为端口、代理、TLS、DNS 和公开验证动作。
12. ScheduledTask 必须处理源目标重复运行。
13. EphemeralStatePolicy 在 Migration 中编译为 drain、quiesce、checkpoint 或重建步骤。
14. Verification 必须进入主 DAG，并决定 Plan Run 是否成功。
15. Rollback 必须基于真实 before-state，不能只生成反向命令。
16. Build 不编译源端数据迁移和 Cutover。
17. Migration 必须编译 initial sync、quiesce、final sync、traffic switch、observation 和 source resume。
18. Capture 必须编译数据一致性采集、Archive Manifest、加密、存储验证和释放源机门禁。
19. Restore 必须针对当前目标重新编译，不能复用 Capture 动作。
20. 所有人工步骤必须结构化并有验证证据。
21. 所有 Action 必须能追溯到 Blueprint、Decision、Capability 和 Evidence。
22. Material Target Drift 必须使旧 Plan 失效。
23. 编译器不能静默完成用户尚未作出的高风险决策。
24. Plan Revision 生成后不可修改，任何输入变化都重新编译。
25. Run 只能执行一个具体 Approved Plan Revision。

下一步应确定 **Plan Revision、Action DAG 与 Durable Execution Run 的完整状态机**，包括审批、排队、Claim、心跳、暂停、重试、Checkpoint、验证失败、Cutover Commit 和崩溃恢复。

## Prompt:
2026/7/18 21:45:25

确定 Plan Revision、Action DAG 与 Durable Execution Run 的完整状态机，包括审批、排队、Claim、心跳、暂停、重试、Checkpoint、验证失败、Cutover Commit 和崩溃恢复

## Response:
2026/7/18 21:45:29

这一轮我会把 Plan、Run、Stage、Action、Attempt 和 Checkpoint 分层定义，避免把“计划状态、执行状态、动作重试和迁移提交”混在同一个字段里；同时给出不可绕过的状态转换与崩溃恢复规则。

当前 EnvForge 的 Apply 仍是同步 HTTP 执行，活动任务没有 durable worker、Checkpoint 或崩溃恢复；Verify/Rollback 也没有独立、完整的 Run 模型。因此这一层需要作为新的执行内核建设，而不是扩展现有同步 Apply。`8bead08a-b983-4703-97e2-6580c02aff9c.md`

**document: **

# EnvForge Plan Revision、Action DAG 与 Durable Execution Run 状态机基线

## 一、核心分层

必须严格区分六层对象：

```text
Plan Revision
    ↓ 被批准
Plan Approval
    ↓ 创建执行
Execution Run
    ↓ 按阶段编排
Stage Run
    ↓ 调度 DAG 节点
Action Run
    ↓ 每次真实尝试
Action Attempt
    ↓ 产生恢复位置
Checkpoint
```

各层职责：

| 对象 | 负责什么 | 不负责什么 |
|---|---|---|
| Plan Revision | 不可变执行合同 | 当前进度和结果 |
| Approval | 谁批准了哪一个 Plan Hash | 执行 |
| Execution Run | 一次完整执行实例 | 修改 Plan |
| Stage Run | Prepare、Transfer、Cutover 等阶段 | 业务定义 |
| Action Run | 一个结构化动作的总体状态 | 多次尝试的详细历史 |
| Action Attempt | 某次实际执行 | 跨尝试累计状态 |
| Checkpoint | 安全恢复点 | 证明整个迁移成功 |

基本原则：

> Plan 说明应该做什么，Run 记录实际发生了什么。

---

# 二、Plan Revision 状态机

Plan 内容一经编译即不可修改，但生命周期状态可以变化。

```ts
type PlanRevisionStatus =
  | "compiled"
  | "review-required"
  | "approval-pending"
  | "approved"
  | "rejected"
  | "superseded"
  | "revoked"
  | "expired"
  | "archived";
```

状态转换：

```text
COMPILED
├── 有未完成 Review Gate
│      → REVIEW_REQUIRED
└── 所有编译门禁满足
       → APPROVAL_PENDING

REVIEW_REQUIRED
→ 新 DecisionSet
→ 重新编译新的 Plan Revision
```

不能直接修改原 Plan 使其重新可审批。

```text
APPROVAL_PENDING
├── 审批通过 → APPROVED
└── 审批拒绝 → REJECTED

APPROVED
├── 新 Revision 获批 → SUPERSEDED
├── 安全问题或用户撤销 → REVOKED
├── 输入超过有效期 → EXPIRED
└── 项目归档 → ARCHIVED
```

## 重要约束

- `rejected` 的 Plan 不允许修改后重新提交；
- 必须生成下一版 Revision；
- `approved` 不代表自动执行；
- `superseded`、`revoked`、`expired` 不允许创建新 Live Run；
- 已经开始执行的 Run 不因 Plan 后续 superseded 自动停止；
- 但系统必须显示该 Run 正在执行旧 Revision。

---

# 三、Approval 独立建模

```ts
interface PlanApproval {
  id: string;
  planRevisionId: string;
  approvedPlanHash: string;

  status:
    | "pending"
    | "approved"
    | "rejected"
    | "revoked"
    | "expired";

  approvalPolicyId: string;

  decisions: ApprovalDecision[];

  approvedBy?: string;
  approvedAt?: string;

  expiresAt?: string;

  satisfiedGateIds: string[];
  acceptedRiskIds: string[];
}
```

## Approval 必须绑定

- Plan Revision ID；
- Plan Hash；
- Blueprint Revision Hash；
- DecisionSet Hash；
- Source Snapshot Hash；
- Target Snapshot Hash；
- Artifact Hash；
- Capability Implementation Version；
- Compiler Version。

任何绑定内容变化，Approval 自动失效。

## Approval 与执行分离

正确流程：

```text
批准 Plan
→ 创建 Execution Run
→ 加入队列
```

不能：

```text
点击批准
→ 立即在 HTTP 请求中开始执行
```

---

# 四、创建 Execution Run 的门禁

只有满足以下条件才能创建 Live Run：

- Plan 状态是 `approved`；
- Approval 仍有效；
- Plan Hash 校验成功；
- Artifact 可用且 Hash 正确；
- 没有另一个相同 Plan 的活动 Live Run；
- 没有不可兼容的目标资源锁；
- required Secret 至少有 Provider Binding；
- required 手工步骤有执行方式；
- 当前用户有执行权限。

创建 Run 时保存不可变绑定：

```ts
interface ExecutionBinding {
  planRevisionId: string;
  planHash: string;

  approvalId: string;
  approvalHash: string;

  sourceSnapshotHash?: string;
  targetSnapshotHash?: string;
  archiveManifestHash?: string;

  artifactHashes: string[];

  executionPolicyVersion: string;
}
```

Run 后续不能切换到新的 Plan Revision。

---

# 五、Execution Run 类型

```ts
type ExecutionRunType =
  | "build"
  | "migration"
  | "capture"
  | "restore"
  | "verification"
  | "rollback";
```

其中：

- Build、Migration、Capture、Restore 是主 Run；
- 迁移主 Run 内部已经包含必要 Verification Stage；
- 运行完成后的再次验证，可创建独立 Verification Run；
- Rollback 必须创建独立 Rollback Run，并引用原始 Run。

```ts
interface ExecutionRun {
  id: string;
  projectId: string;

  type: ExecutionRunType;

  planRevisionId: string;
  parentRunId?: string;
  rollbackOfRunId?: string;
  verifiesRunId?: string;

  state: ExecutionRunState;
  phase: RunPhase;

  executionBinding: ExecutionBinding;

  currentStageRunId?: string;

  priority: number;

  queuedAt?: string;
  claimedAt?: string;
  startedAt?: string;
  completedAt?: string;

  workerLease?: WorkerLease;

  pauseRequest?: PauseRequest;
  cancelRequest?: CancelRequest;

  outcome?: RunOutcome;

  createdBy: string;
  createdAt: string;
}
```

---

# 六、Execution Run 状态机

```ts
type ExecutionRunState =
  | "created"
  | "queued"
  | "claimed"
  | "running"
  | "waiting"
  | "pause-requested"
  | "pausing"
  | "paused"
  | "blocked"
  | "recovering"
  | "cancel-requested"
  | "cancelling"
  | "rollback-required"
  | "rolling-back"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "rolled-back"
  | "partially-rolled-back";
```

## 正常路径

```text
CREATED
→ QUEUED
→ CLAIMED
→ RUNNING
→ SUCCEEDED
```

## 等待路径

```text
RUNNING
→ WAITING
→ RUNNING
```

`waiting` 必须带明确原因：

```ts
type WaitingReason =
  | "maintenance-window"
  | "manual-step"
  | "secret-input"
  | "resource-lock"
  | "external-condition"
  | "retry-backoff"
  | "approval-confirmation"
  | "cutover-commit";
```

等待不等于失败，也不占用 worker 执行线程，但 Run 仍保持持久状态。

## 暂停路径

```text
RUNNING
→ PAUSE_REQUESTED
→ PAUSING
→ PAUSED
→ QUEUED
→ CLAIMED
→ RUNNING
```

## 失败路径

```text
RUNNING
├── 可自动重试
│      → WAITING(retry-backoff)
│      → RUNNING
│
├── 可人工恢复
│      → BLOCKED
│      → QUEUED
│
├── 需要回滚
│      → ROLLBACK_REQUIRED
│      → ROLLING_BACK
│      → ROLLED_BACK / PARTIALLY_ROLLED_BACK
│
└── 不需要或不能回滚
       → FAILED
```

## 取消路径

```text
RUNNING
→ CANCEL_REQUESTED
→ CANCELLING
→ CANCELLED
```

但进入迁移关键区后，取消不能直接变成 `cancelled`，必须转换成：

```text
ROLLBACK_REQUIRED
```

---

# 七、Run Phase

Run State 表示“执行器处于什么状态”，Run Phase 表示“业务流程执行到了哪里”。

```ts
type RunPhase =
  | "preflight"
  | "prepare"
  | "transfer"
  | "configure"
  | "quiesce"
  | "final-sync"
  | "activate"
  | "cutover"
  | "verify"
  | "observe"
  | "commit"
  | "cleanup"
  | "rollback";
```

例如：

```text
state = waiting
phase = cutover
waitingReason = maintenance-window
```

比单纯显示：

```text
等待中
```

更有意义。

---

# 八、不同模式的 Stage 模板

## Build

```text
PREFLIGHT
→ PREPARE
→ CONFIGURE
→ ACTIVATE
→ VERIFY
→ COMMIT
→ CLEANUP
```

## Migration

```text
SOURCE_PREFLIGHT
→ TARGET_PREFLIGHT
→ TARGET_PREPARE
→ INITIAL_TRANSFER
→ TARGET_PREVERIFY
→ WAIT_WINDOW
→ SOURCE_DRAIN
→ SOURCE_QUIESCE
→ FINAL_SYNC
→ TARGET_ACTIVATE
→ TRAFFIC_SWITCH
→ BUSINESS_VERIFY
→ OBSERVE
→ COMMIT
→ SOURCE_RETENTION
→ CLEANUP
```

## Capture

```text
SOURCE_PREFLIGHT
→ ARCHIVE_PREFLIGHT
→ INITIAL_CAPTURE
→ SOURCE_QUIESCE
→ FINAL_CAPTURE
→ BUILD_MANIFEST
→ ENCRYPT
→ UPLOAD
→ INTEGRITY_VERIFY
→ RESTORE_REQUIREMENTS
→ OPTIONAL_RESTORE_DRILL
→ SAFE_TO_RELEASE_COMMIT
```

## Restore

```text
VERIFY_ARCHIVE
→ TARGET_PREFLIGHT
→ PREPARE
→ RESTORE_ARTIFACTS
→ RESTORE_CONFIG
→ RESTORE_DATA
→ BIND_SECRETS
→ ACTIVATE
→ VERIFY
→ OBSERVE
→ COMMIT
→ CLEANUP
```

---

# 九、Stage Run

每个阶段有独立的持久状态。

```ts
interface StageRun {
  id: string;
  executionRunId: string;

  stageKey: string;
  phase: RunPhase;

  state:
    | "pending"
    | "ready"
    | "running"
    | "waiting"
    | "paused"
    | "succeeded"
    | "failed"
    | "skipped"
    | "cancelled";

  requiredActionIds: string[];

  startedAt?: string;
  completedAt?: string;

  checkpointId?: string;

  gateIds: string[];
}
```

Stage 成功要求：

- 所有 required Action 成功；
- 所有 Stage Gate 满足；
- required Verification 通过；
- Stage Checkpoint 持久化。

---

# 十、Action DAG 模型

```ts
interface ActionGraph {
  nodes: PlanAction[];
  edges: ActionDependency[];
  stages: PlanStageDefinition[];

  graphHash: string;
}
```

每个 Action 必须拥有确定性 ID：

```text
actionId =
hash(
  planRevisionId
  + workloadId
  + componentId
  + actionType
  + normalizedInputs
)
```

这样重试、恢复和重复请求都能识别同一动作。

## Action 依赖

```ts
type ActionDependencyType =
  | "must-complete-before"
  | "must-succeed-before"
  | "same-checkpoint"
  | "rollback-after"
  | "exclusive-resource-lock";
```

`must-complete-before`：

- 前置动作无论成功还是跳过，只要结束即可继续。

`must-succeed-before`：

- 前置动作必须成功。

`same-checkpoint`：

- 两个动作共同形成一致性点。

`rollback-after`：

- 定义逆序回滚关系。

`exclusive-resource-lock`：

- 两个动作不能同时执行。

---

# 十一、Action Run 状态机

```ts
type ActionRunState =
  | "pending"
  | "ready"
  | "blocked"
  | "claimed"
  | "running"
  | "waiting"
  | "pause-pending"
  | "paused"
  | "succeeded"
  | "failed"
  | "skipped"
  | "cancelled"
  | "rollback-pending"
  | "rolling-back"
  | "rolled-back"
  | "rollback-failed";
```

正常路径：

```text
PENDING
→ READY
→ CLAIMED
→ RUNNING
→ SUCCEEDED
```

失败路径：

```text
RUNNING
→ FAILED
```

是否重新进入 `READY`，由 Retry Policy 决定。

## Action 成功不能只由进程退出码决定

成功需要：

```text
执行结果成功
+
Postcondition 成功
+
必要 Verification 成功
```

例如安装软件包：

```text
apt install 返回 0
```

不等于成功。

还需要：

```text
目标版本存在
服务状态符合要求
```

---

# 十二、Action Attempt

每次实际执行必须创建独立 Attempt。

```ts
interface ActionAttempt {
  id: string;
  actionRunId: string;

  attemptNumber: number;

  state:
    | "started"
    | "succeeded"
    | "failed"
    | "interrupted"
    | "timed-out"
    | "unknown-outcome";

  workerId: string;
  claimToken: string;
  fencingToken: number;

  startedAt: string;
  heartbeatAt?: string;
  finishedAt?: string;

  exitClassification?: FailureClassification;

  outputSummary?: string;
  redactedLogArtifactId?: string;

  beforeStateArtifactId?: string;
  resultArtifactId?: string;

  checkpointId?: string;
}
```

保留每次 Attempt，不能用最新结果覆盖历史。

---

# 十三、失败分类

```ts
type FailureClassification =
  | "transient-network"
  | "transient-remote"
  | "rate-limited"
  | "resource-busy"
  | "authentication"
  | "authorization"
  | "precondition-failed"
  | "target-drift"
  | "validation-failed"
  | "data-integrity-failed"
  | "insufficient-capacity"
  | "deterministic-command-failure"
  | "side-effect-unknown"
  | "worker-crash"
  | "user-cancelled"
  | "manual-intervention-required";
```

不同失败不能使用同一重试逻辑。

---

# 十四、Retry Policy

```ts
interface RetryPolicy {
  maximumAttempts: number;

  retryableFailures: FailureClassification[];

  backoff:
    | "fixed"
    | "linear"
    | "exponential";

  initialDelaySeconds: number;
  maximumDelaySeconds: number;
  jitter: boolean;

  requireReconciliationBeforeRetry: boolean;
}
```

## 可以自动重试

通常包括：

- 临时网络错误；
- SSH 短暂断开；
- 远程服务暂不可用；
- 资源锁占用；
- API rate limit；
- 幂等读取操作。

## 不能盲目自动重试

- 删除；
- 覆盖配置；
- 数据库 restore；
- DNS 修改；
- 服务停止；
- final sync；
- traffic switch；
- 不确定是否已产生副作用的命令。

这些动作在重试前必须执行：

```text
Reconciliation Probe
```

判断：

- 动作没有执行；
- 动作已经成功；
- 动作部分完成；
- 状态无法确定。

无法确定时进入：

```text
BLOCKED
reason = side-effect-unknown
```

---

# 十五、幂等与 Reconciliation

每个 Action 必须声明：

```ts
type ResumabilityClass =
  | "idempotent"
  | "byte-resumable"
  | "step-resumable"
  | "restart-required"
  | "manual";
```

以及：

```ts
interface ActionRecoveryContract {
  resumability: ResumabilityClass;

  reconcileProbe?: ActionProbeDefinition;

  checkpointStrategy?: string;

  safeToRetryAfterUnknownOutcome: boolean;

  recoveryInstructions?: string[];
}
```

## 示例

### 安装软件包

```text
幂等类型：idempotent
恢复：
检查目标包版本
已满足 → 标记成功
未满足 → 重新执行
```

### 文件传输

```text
幂等类型：byte-resumable
恢复：
从 manifest 和最后确认 chunk 继续
```

### PostgreSQL restore

```text
幂等类型：restart-required 或 step-resumable
恢复：
检查目标数据库是否为空、部分恢复或完整
不能直接重新执行到同一数据库
```

### DNS 修改

```text
幂等类型：step-resumable
恢复：
读取当前 DNS 记录
匹配目标值 → 标记成功
不匹配 → 决定重试或人工处理
```

---

# 十六、Checkpoint 模型

```ts
interface ExecutionCheckpoint {
  id: string;

  executionRunId: string;
  stageRunId?: string;
  actionRunId?: string;

  type:
    | "action"
    | "transfer"
    | "dataset-consistency"
    | "stage"
    | "cutover"
    | "commit";

  planHash: string;
  actionInputHash?: string;

  sequence: number;

  resumeData: Record<string, unknown>;

  observedState: {
    sourceStateHash?: string;
    targetStateHash?: string;
    archiveStateHash?: string;
  };

  artifactRefs: string[];

  validUntil?: string;

  createdAt: string;
}
```

## Checkpoint 必须持久保存

不能只保存在 worker 内存。

写入 Checkpoint 时必须事务性完成：

```text
持久化动作进度
+
持久化 Checkpoint
+
写入 Run Event
```

然后才能向外报告：

```text
checkpoint created
```

## Checkpoint 类型

### Transfer Checkpoint

保存：

- manifest；
- 已确认 chunk；
- 已传字节；
- checksum；
- 源文件状态；
- 临时目标路径。

### Dataset Consistency Checkpoint

保存：

- quiesce 已完成；
- writer 已停止；
- 数据库 transaction boundary；
- snapshot ID；
- final sync 起点。

### Stage Checkpoint

表示某一阶段已完整完成，可以从下一阶段继续。

### Cutover Checkpoint

保存：

- 源端状态；
- 目标端状态；
- 当前 traffic target；
- DNS/LB 原值；
- rollback deadline。

### Commit Checkpoint

表示用户或策略正式接受目标环境。

Commit 必须具有不可重复的唯一记录。

---

# 十七、Checkpoint 失效条件

以下情况不能直接从旧 Checkpoint 恢复：

- Plan Hash 变化；
- Action Input Hash 变化；
- Source Snapshot 出现关键 Drift；
- Target 资源被外部修改；
- 临时 Artifact 已过期；
- Archive chunk 不完整；
- Secret Provider Binding 变化；
- 数据库目标状态与 Checkpoint 不一致；
- 超过 rollback window；
- Capability Adapter Version 不兼容。

此时进入：

```text
BLOCKED
reason = checkpoint-invalid
```

并要求：

- 重新执行当前阶段；
- 重新编译 Plan；
- 或人工恢复。

---

# 十八、队列与 Claim

执行器必须采用持久队列，不使用进程内 Map。

队列记录至少包含：

```ts
interface RunQueueEntry {
  runId: string;

  priority: number;
  availableAt: string;

  requiredWorkerCapabilities: string[];

  targetAffinity?: string;

  queuedAt: string;
}
```

## Claim 必须是数据库原子操作

逻辑：

```text
查找 availableAt <= now 的 queued Run
→ 检查没有有效 Lease
→ 原子更新为 claimed
→ 写入 workerId、claimToken、fencingToken、leaseExpiresAt
```

两个 Worker 不能同时成功 Claim 同一个 Run。

---

# 十九、Lease、Heartbeat 与 Fencing Token

```ts
interface WorkerLease {
  workerId: string;

  claimToken: string;

  fencingToken: number;

  claimedAt: string;
  heartbeatAt: string;
  leaseExpiresAt: string;
}
```

## Heartbeat

Worker 定期更新：

- Run heartbeat；
- 当前 Stage；
- 当前 Action；
- Attempt heartbeat；
- 已处理进度。

例如：

```text
Heartbeat interval：10 秒
Lease duration：45 秒
```

具体值可配置。

## Fencing Token

每次重新 Claim，`fencingToken` 单调递增。

任何状态写入必须携带当前 Token。

旧 Worker 即使网络恢复，也不能继续写入。

```text
Worker A token = 10
Lease 过期

Worker B token = 11

Worker A 后续写入
→ 拒绝
```

这是防止双执行的核心机制。

---

# 二十、暂停语义

暂停不能简单终止进程。

## Pause Request

```ts
interface PauseRequest {
  requestedBy: string;
  requestedAt: string;
  reason?: string;

  mode:
    | "safe-checkpoint"
    | "immediate-if-safe";
}
```

## 调度器行为

收到暂停请求后：

1. 不再启动新的 Action；
2. 检查当前 Action 的 resumability；
3. 尝试达到最近安全 Checkpoint；
4. 保存状态；
5. 释放非必要资源锁；
6. Run 进入 `paused`。

## 对运行中 Action 的处理

| Action 类型 | 暂停处理 |
|---|---|
| byte-resumable | 保存 chunk checkpoint 后暂停 |
| step-resumable | 完成当前子步骤后暂停 |
| idempotent 短动作 | 完成后暂停 |
| restart-required | 安全终止并标记重新开始 |
| manual | 请求用户处理 |

## Cutover 关键区禁止普通暂停

当源端已经：

- drain；
- quiesce；
- stop writer；
- 完成 final sync；

不能无限期暂停。

系统只能：

- 继续到目标启动和安全验证点；
- 或立即进入 Rollback。

此时暂停请求应转换为：

```text
Pause unavailable in critical section.
Choose continue or rollback.
```

---

# 二十一、恢复暂停 Run

恢复前必须重新验证：

- Plan 仍有效；
- Lease 已释放；
- Checkpoint 有效；
- Source/Target 状态符合；
- Secret 仍可获得；
- 维护窗口仍有效；
- 资源锁可重新取得。

恢复不是简单设置：

```text
state = running
```

正确流程：

```text
PAUSED
→ Resume Validation
→ QUEUED
→ CLAIMED
→ RECOVERING
→ RUNNING
```

---

# 二十二、取消语义

取消与暂停不同。

## 未产生副作用前

可以安全取消：

```text
CREATED / QUEUED
→ CANCELLED
```

## 已完成部分目标准备

可以：

- 停止后续动作；
- 执行目标清理；
- 恢复 before-state；
- 最终 `cancelled` 或 `rolled-back`。

## 进入 Cutover 关键区后

取消必须变成：

```text
rollback request
```

不能直接停止 worker，否则可能留下：

- 源端已停止；
- 目标未启动；
- 流量状态未知。

---

# 二十三、Verification 失败规则

Verification 分为：

- Action Postcondition；
- Stage Verification；
- Pre-Cutover Verification；
- Post-Cutover Business Verification；
- Observation Verification；
- Final Verification。

## Required Check 失败

### Cutover 前

```text
失败
→ 阻止进入下一阶段
→ 可重试或回滚目标准备
```

源业务通常不受影响。

### Source Quiesce 后、Traffic Switch 前

```text
失败
→ 必须继续修复或恢复源端
```

不能停在普通 failed。

### Traffic Switch 后

```text
失败
→ ROLLBACK_REQUIRED 或 BLOCKED
```

取决于：

- 自动回滚策略；
- 数据是否产生新写入；
- rollback window；
- 故障严重程度。

### Observation 阶段

required 检查连续失败：

```text
→ 不允许 Commit
→ Hold 或 Rollback
```

## Optional Check 失败

- 记录 warning；
- 不自动阻塞；
- 但 critical Workload 的关键业务 Check 不允许标为 optional。

---

# 二十四、Verification 结果

```ts
interface VerificationResult {
  checkId: string;

  status:
    | "passed"
    | "failed"
    | "warning"
    | "skipped"
    | "error";

  required: boolean;

  observedAt: string;

  evidenceArtifactIds: string[];

  explanation?: string;
}
```

Run 只有在所有 required Check 满足 success policy 后，才能进入 Commit。

不能：

```text
Apply action 完成
→ Run succeeded
→ 用户以后再点 Verify
```

---

# 二十五、Cutover 状态机

Cutover 是 Migration Run 中的独立子状态机。

```ts
type CutoverState =
  | "not-entered"
  | "ready"
  | "waiting-window"
  | "draining-source"
  | "source-quiesced"
  | "final-syncing"
  | "target-activating"
  | "traffic-switching"
  | "traffic-switched"
  | "business-verifying"
  | "observing"
  | "commit-pending"
  | "committed"
  | "rollback-pending"
  | "rolling-back"
  | "rolled-back"
  | "failed";
```

正常路径：

```text
READY
→ WAITING_WINDOW
→ DRAINING_SOURCE
→ SOURCE_QUIESCED
→ FINAL_SYNCING
→ TARGET_ACTIVATING
→ TRAFFIC_SWITCHING
→ TRAFFIC_SWITCHED
→ BUSINESS_VERIFYING
→ OBSERVING
→ COMMIT_PENDING
→ COMMITTED
```

---

# 二十六、Cutover Commit 的准确含义

Traffic Switch 不等于 Commit。

```text
Traffic Switched
= 用户流量开始进入目标

Committed
= 系统正式接受目标为权威运行环境
```

在 Commit 前：

- 源服务器保持可恢复；
- 源数据不能随意清理；
- rollback window 有效；
- required Verification 持续运行；
- 目标新写入风险需要监控。

## Commit Record

```ts
interface CutoverCommitRecord {
  id: string;

  executionRunId: string;
  planRevisionId: string;
  planHash: string;

  committedBy:
    | {
        type: "user";
        userId: string;
      }
    | {
        type: "policy";
        policyId: string;
      };

  verificationSnapshotHash: string;

  trafficStateHash: string;
  sourceStateHash: string;
  targetStateHash: string;

  irreversibleActionIds: string[];

  rollbackClassificationAfterCommit:
    | "full"
    | "partial"
    | "manual"
    | "none";

  committedAt: string;
}
```

Commit 必须是：

- 原子操作；
- 幂等；
- 只能成功一次；
- 写入不可变 Event；
- 绑定当前 Verification 结果。

---

# 二十七、自动 Commit 与人工 Commit

## 自动 Commit

只有以下条件全部满足才允许：

- Plan 明确批准自动 Commit；
- 所有 required Verification 通过；
- Observation Window 完成；
- 没有高风险 warning；
- 没有目标 Drift；
- 没有 pending Manual Gate；
- 数据一致性检查通过。

## 人工 Commit

系统进入：

```text
WAITING
reason = cutover-commit
```

用户看到：

- 当前目标状态；
- 验证结果；
- 已观察时间；
- 回滚剩余时间；
- 目标新写入情况；
- Commit 后的回滚限制。

用户确认后产生 Commit Record。

---

# 二十八、Rollback Run

Rollback 不应作为原 Run 中直接覆盖状态的一组反向命令。

应创建：

```ts
interface RollbackRun extends ExecutionRun {
  type: "rollback";

  rollbackOfRunId: string;

  rollbackPlanSnapshot: {
    originalPlanHash: string;
    beforeStateArtifactIds: string[];
    completedActionIds: string[];
    irreversibleActionIds: string[];
  };
}
```

## Rollback Action DAG

只包含：

- 原 Run 已成功产生副作用的 Action；
- 有 before-state 的资源；
- 按依赖逆序执行；
- 需要恢复的流量和源服务；
- 数据 reconciliation。

## 回滚状态结果

```ts
type RollbackOutcome =
  | "full"
  | "partial"
  | "manual-required"
  | "failed";
```

不能因为某些反向命令成功，就把整个 Run 标记为 `rolled-back`。

只有所有 required Rollback Unit 成功并通过验证，才是 full rollback。

---

# 二十九、Cutover 后数据回滚

如果 Traffic Switch 后目标产生新写入，系统必须计算：

```ts
interface DataReconciliationState {
  targetWritesDetected: boolean;

  affectedDatasetIds: string[];

  automaticReverseSyncAvailable: boolean;

  rollbackRisk:
    | "none"
    | "low"
    | "high"
    | "data-loss";

  requiredManualSteps: string[];
}
```

处理方式：

- 没有新写入：可以回切源端；
- 新写入可反向同步：先 reconciliation；
- 新写入不可自动合并：要求人工选择；
- 存在数据丢失风险：不能自动回滚。

---

# 三十、崩溃恢复

API 或 Worker 启动时必须运行 Recovery Coordinator。

## 扫描范围

查找：

- `claimed` 且 Lease 已过期的 Run；
- `running` 但 Heartbeat 超时的 Run；
- `ActionAttempt.started` 但无终态；
- `source-quiesced` 或 `traffic-switched` 的关键 Run；
- `rolling-back` 中断的 Run；
- 未完成的 Checkpoint 事务；
- 过期资源锁。

## 恢复流程

```text
发现 Lease 过期
→ 标记 Run recovering
→ 获取新的 fencing token
→ 检查当前 Stage
→ 检查当前 Action Attempt
→ 执行 Reconciliation Probe
→ 验证 Checkpoint
→ 决定 resume / retry / rollback / block
```

---

# 三十一、崩溃后的 Action 分类

## 1. 尚未开始产生副作用

```text
重新进入 READY
```

## 2. 幂等动作

执行 Reconciliation：

- 目标状态已满足 → 标记 succeeded；
- 未满足 → 重新执行。

## 3. Byte-resumable

从最后确认 Chunk 继续。

## 4. Step-resumable

从最后完成的子步骤继续。

## 5. Restart-required

清理临时状态后重新开始该 Action。

## 6. Side-effect Unknown

进入：

```text
BLOCKED
```

不能自动重试。

## 7. Cutover Critical Section

优先级最高。

系统必须立即判断：

- 源是否仍被 quiesce；
- 目标是否启动；
- traffic 当前指向哪里；
- final sync 是否完成；
- rollback 是否仍有效。

然后选择：

```text
继续到安全点
或
紧急回滚
```

不能等待普通人工队列数小时。

---

# 三十二、Cutover Recovery Policy

Plan 中必须预先定义：

```ts
interface CutoverRecoveryPolicy {
  onWorkerCrashBeforeSourceQuiesce:
    | "resume"
    | "rollback-target-prepare";

  onWorkerCrashAfterSourceQuiesce:
    | "resume-forward"
    | "resume-source";

  onWorkerCrashAfterTrafficSwitch:
    | "verify-and-continue"
    | "rollback-if-unhealthy"
    | "manual";

  maximumCriticalRecoverySeconds: number;
}
```

如果用户没有批准该策略，Plan 不能进入 Cutover。

---

# 三十三、资源锁

除了 Run Lease，还需要业务资源锁。

```ts
interface ResourceLease {
  resourceKey: string;

  runId: string;
  actionRunId?: string;

  fencingToken: number;

  acquiredAt: string;
  heartbeatAt: string;
  expiresAt: string;
}
```

资源键示例：

```text
endpoint:<id>
package-manager:<endpoint>
systemd-daemon:<endpoint>
config-path:<endpoint>:/etc/nginx/nginx.conf
service:<endpoint>:nginx.service
dataset:<dataset-id>
postgres-instance:<endpoint>:main
dns-record:<zone>:blog.example.com
archive:<archive-id>
```

## 锁顺序

为避免死锁，统一按照：

```text
endpoint
→ shared-service
→ dataset
→ component
→ file/path
```

顺序获取。

无法取得锁时：

```text
WAITING
reason = resource-lock
```

---

# 三十四、并发规则

## 同一 Plan Revision

- 只允许一个活动 Live Run；
- 可以存在多个 Dry-run 或 Verification Run；
- 失败重试优先恢复原 Run；
- 创建新 Retry Run 时必须关联原 Run。

## 同一 Endpoint

多个 Run 可以并行，但不能操作冲突资源。

## 同一 Dataset

同一时间只允许一个写入、迁移或 Restore Action。

## 同一 Shared Service

例如共享 Nginx：

- 多个应用计划可以并行准备；
- 修改共享配置必须串行并合并验证。

---

# 三十五、事件日志

状态表用于快速查询，但真实审计来源必须是 append-only Event Log。

```ts
interface RunEvent {
  id: string;

  runId: string;
  sequence: number;

  type: RunEventType;

  stageRunId?: string;
  actionRunId?: string;
  attemptId?: string;
  checkpointId?: string;

  actor:
    | {
        type: "worker";
        id: string;
      }
    | {
        type: "user";
        id: string;
      }
    | {
        type: "system";
        id: string;
      };

  payload: Record<string, unknown>;

  occurredAt: string;
}
```

事件示例：

```text
run.queued
run.claimed
run.heartbeat
stage.started
action.ready
action.attempt.started
action.checkpoint.created
action.succeeded
run.pause.requested
run.paused
cutover.source.quiesced
cutover.traffic.switched
verification.failed
rollback.requested
cutover.committed
run.succeeded
```

Report 只能根据 Event 和 Artifact 生成，不能只根据 Plan 推断。

---

# 三十六、持久化建议

至少需要以下持久表：

```text
plan_revisions
plan_approvals

execution_runs
stage_runs
action_runs
action_attempts

execution_checkpoints
run_events

run_queue
worker_leases
resource_leases

manual_gates
verification_results
cutover_commits

report_artifacts
```

所有状态转换必须使用：

- 数据库事务；
- Compare-And-Swap；
- 当前状态校验；
- fencing token；
- 幂等 request key。

不能通过：

```text
读取 JSON
→ 修改
→ 整体覆盖
```

实现高风险执行状态机。

---

# 三十七、状态转换接口

建议使用明确命令，而不是通用 PATCH。

```text
POST /plans/:planId/approve
POST /plans/:planId/reject
POST /plans/:planId/runs

POST /runs/:runId/pause
POST /runs/:runId/resume
POST /runs/:runId/cancel
POST /runs/:runId/retry
POST /runs/:runId/rollback
POST /runs/:runId/commit

POST /runs/:runId/secrets/:requirementId/supply
POST /runs/:runId/manual-gates/:gateId/complete
```

每个命令必须接受：

```text
Idempotency-Key
Expected-Run-Version
```

防止重复点击和并发覆盖。

---

# 三十八、进度事件

Run 的进度不能只用一个百分比。

```ts
interface RunProgress {
  runId: string;

  state: ExecutionRunState;
  phase: RunPhase;

  currentStage?: string;
  currentAction?: string;

  completedRequiredActions: number;
  totalRequiredActions: number;

  transferredBytes?: number;
  totalTransferBytes?: number;
  transferRateBytesPerSecond?: number;

  currentCheckpointId?: string;

  waitingReason?: WaitingReason;

  retryAttempt?: number;

  rollbackAvailable: boolean;
}
```

UI 可以显示总体百分比，但必须同时说明：

- 当前阶段；
- 当前动作；
- 是否安全暂停；
- 是否进入停机窗口；
- 是否可以回滚；
- 是否正在等待用户。

---

# 三十九、Secret 与日志安全

以下对象都不能保存 Secret 明文：

- Run Event；
- Action Attempt；
- Checkpoint；
- Worker Lease；
- Progress；
- Report；
- stdout/stderr Artifact。

所有输出先经过统一 Redaction Pipeline。

Checkpoint 中只保存：

- Provider 引用；
- Secret fingerprint；
- 是否已注入；
- 生命周期状态。

不能保存 Secret 值。

---

# 四十、核心不变量

执行引擎必须保证以下不变量：

1. Run 只能执行一个具体 Approved Plan Revision。
2. Plan 内容在 Run 生命周期内永不改变。
3. 一个 Plan Revision 同时只能有一个活动 Live Run。
4. 没有有效 Lease 和 fencing token 的 Worker 不能写状态。
5. Action 只有满足依赖和 Gate 后才能进入 ready。
6. required Verification 失败后不能进入 Commit。
7. Traffic Switch 不等于迁移成功。
8. Commit 只能发生一次。
9. Source Quiesce 后不能普通取消或无限暂停。
10. 自动重试必须满足 Retry Policy 和幂等条件。
11. 副作用未知的 Action 不能盲目重试。
12. Checkpoint 必须持久化后才能对外报告。
13. Rollback 必须引用原 Run 的真实 before-state。
14. 部分回滚不能显示为完整 rolled-back。
15. Report 只能陈述真实 Event 和 Artifact。
16. Capture 只有通过 Safe-to-Release Commit 才能建议释放源服务器。
17. Material Target Drift 必须阻止继续执行旧 Plan。
18. Secret 不进入 Plan、Run、Checkpoint、日志或 Report 明文。
19. Worker 崩溃不能导致两个 Worker 同时执行同一 Action。
20. Cutover 关键区崩溃必须优先恢复或紧急回滚。

---

# 四十一、首期 MVP 技术范围

第一阶段不要一次实现任意分布式工作流平台。

建议先实现：

## 必须实现

- SQLite/PostgreSQL 持久 Run Queue；
- 独立 Worker；
- Run/Stage/Action/Attempt；
- Lease、Heartbeat、Fencing Token；
- Action 幂等键；
- Resource Lock；
- Retry Policy；
- Stage Checkpoint；
- 文件 Transfer Checkpoint；
- Pause at Safe Checkpoint；
- Crash Recovery Coordinator；
- Verification Gate；
- Migration Cutover Commit；
- 独立 Rollback Run；
- SSE 或 polling 进度。

## 首期可以暂缓

- 多节点跨区域 Worker；
- Workflow 动态修改；
- 复杂优先级抢占；
- 任意 DAG 子流程；
- 自动扩缩容；
- 高级分布式事务；
- 多云流量编排；
- 精确实时 ETA；
- 无损迁移任意内存任务。

---

# 四十二、当前代码迁移路径

当前：

```text
POST /apply
→ 同步 executeEnvironmentPlan()
→ 当前 HTTP 请求内执行
→ 写 ApplyRun 终态
```

目标：

```text
POST /plans/:id/runs
→ 创建 ExecutionRun
→ 写入 Durable Queue
→ Worker Claim
→ 执行 Stage/Action
→ Heartbeat/Checkpoint/Event
→ Verification
→ Commit 或 Rollback
→ 生成不可变 Report
```

现有能力可以保留：

- Plan Hash；
- Artifact Hash；
- Approval Binding；
- ActionRun 的部分字段；
- managed adapter；
- Idempotency 逻辑。

需要替换：

- 同步 HTTP Apply；
- 活动状态不可恢复模型；
- Verify 作为事后可选请求；
- Rollback 直接覆盖 Plan 状态；
- 进程内 Queue；
- 无 Lease 的执行方式；
- 只保存终态的 Run；
- 根据 Plan 动态生成成功报告。

---

# 四十三、最终确定的设计结论

1. Plan Revision 是不可变合同，执行状态绝不写入 Plan。
2. Approval 是独立对象，绑定 Plan Hash 和所有输入 Hash。
3. Approval 不自动执行，必须显式创建 Execution Run。
4. Execution Run、Stage Run、Action Run、Attempt 和 Checkpoint 分层保存。
5. Run State 和业务 Phase 必须分开。
6. Action DAG 使用确定性 Action ID、依赖边和资源锁。
7. 每次实际执行创建独立 Attempt，不覆盖历史。
8. Worker 使用持久 Queue、Lease、Heartbeat 和 Fencing Token。
9. 过期 Lease 由 Recovery Coordinator 接管。
10. Action 必须声明幂等、重试和恢复类别。
11. 副作用未知时必须 Reconcile，不能盲目重试。
12. Checkpoint 分为 Action、Transfer、Consistency、Stage、Cutover 和 Commit。
13. 暂停必须停在安全 Checkpoint。
14. Source Quiesce 后暂停或取消必须转换为继续或回滚。
15. Verification 是主 DAG 的必要阶段，失败时阻止 Commit。
16. Traffic Switch 不等于成功，Observation 后才允许 Commit。
17. Commit 必须产生不可变 Commit Record。
18. Rollback 是独立 Run，按已完成 Action 和 before-state 生成逆向 DAG。
19. 部分回滚必须明确显示 partially-rolled-back。
20. 崩溃恢复必须根据 Checkpoint、Reconciliation 和 Cutover 阶段决定继续、重试、阻塞或回滚。
21. 共享服务、Dataset、DNS 和配置路径必须通过 Resource Lease 串行保护。
22. Run Event Log 是 Report 和审计的事实来源。
23. Capture 的 Safe-to-Release 是一种特殊 Commit，未通过时不得建议释放源服务器。
24. Run 只能执行其创建时绑定的 Plan Revision，不能切换到“最新 Plan”。
25. 所有状态转换必须通过事务、CAS、版本号和幂等命令完成。

下一步应确定 **Dataset Migration Engine 与 Transfer Session 的完整模型**，包括文件、PostgreSQL、Docker Volume 的 initial sync、quiesce、final sync、校验、带宽控制和断点续传。

## Prompt:
2026/7/18 21:51:00

确定 Dataset Migration Engine 与 Transfer Session 的完整模型

## Response:
2026/7/18 21:51:04

这一轮我会把数据层拆成“Dataset 定义、迁移合同、迁移运行、传输会话、一致性点、校验与回滚”六层，并分别规定文件、PostgreSQL、Docker Volume 的真实执行路径和断点恢复边界。

当前 EnvForge 只有数据发现、策略选择和 PostgreSQL blocked dry-run，没有真实传输、initial/final sync、数据一致性、断点续传或源目标校验，因此数据迁移必须建设成独立执行子系统，而不能继续作为普通 Plan Action 的附属字段。`8bead08a-b983-4703-97e2-6580c02aff9c.md`

**document: **

# EnvForge Dataset Migration Engine 与 Transfer Session 完整模型

## 一、数据引擎的核心定位

Dataset Migration Engine 负责：

> 将 Blueprint 中“哪些状态必须保持”的要求，转换成有一致性保障、可传输、可恢复、可校验、可回滚的数据执行过程。

它不能只回答：

```text id="kh3fs8"
选择 rsync
选择 pg_dump
```

而必须完整负责：

```text id="rpp56e"
发现数据
→ 确认数据所有者和 writer
→ 选择可执行策略
→ 准备目标
→ 初始同步
→ 达成一致性点
→ 最终同步
→ 恢复或激活
→ 校验
→ Commit 或 Rollback
```

---

# 二、数据层六个核心对象

必须严格区分：

| 对象 | 作用 |
|---|---|
| DatasetContract | Blueprint 中目标无关的数据定义 |
| DatasetExecutionContract | Plan 中针对源、目标和策略的执行合同 |
| DatasetMigrationRun | 某次真实数据迁移实例 |
| TransferSession | 字节或 Artifact 传输会话 |
| ConsistencyCheckpoint | 数据达到一致性要求的证据 |
| DatasetVerificationResult | 证明源、目标或 Archive 数据符合要求 |

关系：

```text id="p0mgyy"
DatasetContract
      ↓ 编译
DatasetExecutionContract
      ↓ 执行
DatasetMigrationRun
      ├── TransferSession
      ├── ConsistencyCheckpoint
      ├── Restore/Activate Actions
      └── Verification Results
```

---

# 三、DatasetContract 与执行合同边界

Blueprint 的 `DatasetContract` 只描述：

- 数据是什么；
- 属于谁；
- writer 是谁；
- 需要什么一致性；
- 支持哪些策略；
- 怎样验证；
- 是否可回滚。

它不保存：

- 当前传输字节；
- 当前 dump 文件路径；
- 临时目标目录；
- rsync 命令；
- 本次 Transfer ID；
- 具体目标 PostgreSQL 版本；
- 当前 Checkpoint。

Plan Compiler 将其解析为：

```ts id="tp4vmm"
interface DatasetExecutionContract {
  id: string;

  planRevisionId: string;

  workloadId: string;
  datasetContractId: string;

  datasetType:
    | "filesystem"
    | "postgresql"
    | "docker-volume"
    | "sqlite"
    | "mysql"
    | "object-storage"
    | "git-repository"
    | "custom";

  source: ResolvedDatasetEndpoint;
  destination: ResolvedDatasetDestination;

  strategy: DatasetStrategy;

  consistencyPlan: ConsistencyExecutionPlan;

  stages: DatasetStageDefinition[];

  transferPlan?: TransferPlan;

  restorePlan?: DatasetRestorePlan;

  verificationPlan: DatasetVerificationPlan;

  rollbackPlan: DatasetRollbackPlan;

  capacityEstimate: DatasetCapacityEstimate;

  timeEstimate: DatasetTimeEstimate;

  riskClassification:
    | "low"
    | "medium"
    | "high"
    | "critical";

  blockers: DatasetBlocker[];

  contractHash: string;
}
```

---

# 四、DatasetStrategy

```ts id="53227i"
type DatasetStrategy =
  | "recreate"
  | "logical-dump-restore"
  | "physical-backup-restore"
  | "initial-final-file-sync"
  | "snapshot-transfer"
  | "replication"
  | "volume-export-import"
  | "archive-capture"
  | "archive-restore"
  | "reuse-target"
  | "manual";
```

## 选择规则

策略不能只由用户随意选择。

必须同时满足：

- Dataset 类型支持；
- 源版本支持；
- 目标版本支持；
- 一致性要求；
- 最大停机；
- 数据规模；
- writer 行为；
- 网络条件；
- Capability Certification；
- 回滚要求。

例如：

```text id="e3lfj9"
PostgreSQL 14 → PostgreSQL 16
```

通常允许：

```text id="tc6goq"
logical-dump-restore
```

通常不允许直接物理复制 data directory。

---

# 五、DatasetMigrationRun

```ts id="6q6i2r"
interface DatasetMigrationRun {
  id: string;

  executionRunId: string;
  datasetExecutionContractId: string;

  state: DatasetMigrationRunState;

  phase: DatasetMigrationPhase;

  sourceStateRef?: string;
  destinationStateRef?: string;

  transferSessionIds: string[];

  consistencyCheckpointIds: string[];

  verificationResultIds: string[];

  bytesPlanned?: number;
  bytesProcessed?: number;

  currentWriterState:
    | "unknown"
    | "active"
    | "draining"
    | "quiesced"
    | "stopped"
    | "resumed";

  startedAt?: string;
  completedAt?: string;

  outcome?: DatasetMigrationOutcome;
}
```

## 状态

```ts id="fgqvmj"
type DatasetMigrationRunState =
  | "pending"
  | "preflighting"
  | "preparing"
  | "initial-syncing"
  | "waiting-quiesce"
  | "quiescing"
  | "final-syncing"
  | "restoring"
  | "activating"
  | "verifying"
  | "waiting"
  | "paused"
  | "blocked"
  | "succeeded"
  | "failed"
  | "rollback-required"
  | "rolling-back"
  | "rolled-back"
  | "partially-rolled-back";
```

## Phase

```ts id="p5pb91"
type DatasetMigrationPhase =
  | "discover"
  | "preflight"
  | "prepare-destination"
  | "initial-sync"
  | "quiesce"
  | "consistency-checkpoint"
  | "final-sync"
  | "restore"
  | "activate"
  | "verify"
  | "commit"
  | "rollback";
```

---

# 六、统一数据迁移生命周期

## 1. Discover

确认：

- 数据位置；
- 数据大小；
- 文件数量；
- writer；
- reader；
- 数据版本；
- 所有者；
- mount；
- 文件系统；
- 是否共享；
- 是否加密；
- 是否存在外部依赖。

## 2. Preflight

检查：

- 源数据可读取；
- 目标容量；
- 目标版本；
- 所需工具；
- 临时空间；
- 网络；
- 权限；
- 加密密钥；
- 数据库扩展；
- writer 可否停止；
- 一致性策略可否执行。

## 3. Prepare Destination

包括：

- 创建临时目录；
- 创建目标数据库；
- 安装目标服务；
- 创建用户和权限；
- 准备 staging storage；
- 预留端口；
- 检查冲突。

## 4. Initial Sync

源业务继续运行时复制大部分数据。

适用于：

- 文件；
- Volume；
- 部分数据库复制策略；
- Archive Capture。

## 5. Quiesce

停止或限制写入。

例如：

- maintenance mode；
- drain HTTP；
- stop worker；
- stop application；
- database read-only；
- pause queue consumer；
- stop cron。

## 6. Consistency Checkpoint

证明：

- writer 已停止；
- transaction boundary 已完成；
- snapshot 已创建；
- 数据库 dump 一致；
- final sync 起点确定。

## 7. Final Sync

复制初始同步之后发生的变化。

## 8. Restore / Activate

包括：

- 解压；
- 恢复数据库；
- 设置权限；
- mount Volume；
- 启动目标数据服务。

## 9. Verify

验证：

- 数据完整；
- 结构正确；
- 可读取；
- 可写入；
- 业务能够使用。

## 10. Commit / Rollback

数据成功后才允许 Workload Cutover Commit。

---

# 七、ConsistencyExecutionPlan

```ts id="0y8c9b"
interface ConsistencyExecutionPlan {
  requiredLevel:
    | "crash-consistent"
    | "filesystem-consistent"
    | "application-consistent"
    | "transaction-consistent"
    | "eventually-consistent"
    | "manual";

  method:
    | "stop-writers"
    | "maintenance-mode"
    | "filesystem-freeze"
    | "database-snapshot"
    | "transactional-dump"
    | "replication-barrier"
    | "application-hook"
    | "manual";

  writerComponentIds: string[];

  preconditions: string[];

  quiesceActionIds: string[];
  validationActionIds: string[];
  resumeActionIds: string[];

  maximumQuiesceSeconds?: number;

  failurePolicy:
    | "resume-source"
    | "retry"
    | "abort"
    | "manual";

  userApprovedDataLoss?: {
    maximumSeconds: number;
    reason: string;
  };
}
```

---

# 八、ConsistencyCheckpoint

```ts id="560jzw"
interface ConsistencyCheckpoint {
  id: string;

  datasetMigrationRunId: string;

  type:
    | "filesystem-snapshot"
    | "writer-stopped"
    | "database-transaction"
    | "database-lsn"
    | "replication-position"
    | "application-barrier"
    | "manual";

  state:
    | "creating"
    | "valid"
    | "invalid"
    | "expired";

  sourceState: {
    writerStates: Record<string, string>;

    databaseTransactionId?: string;
    databaseLsn?: string;

    filesystemSnapshotId?: string;

    sourceManifestHash?: string;

    observedAt: string;
  };

  requiredForFinalSync: boolean;

  validUntil?: string;

  evidenceArtifactIds: string[];

  createdAt: string;
}
```

## 一致性点的重要规则

不能只记录：

```text id="s6b73j"
用户点击了“已停止服务”
```

必须产生可验证证据：

- systemd inactive；
- active connection 数；
- database read-only；
- process 不再写目录；
- snapshot ID；
- transaction snapshot；
- replication position。

---

# 九、TransferPlan

```ts id="r3zzp8"
interface TransferPlan {
  protocol:
    | "ssh-stream"
    | "rsync"
    | "sftp"
    | "object-storage"
    | "local-copy"
    | "database-stream"
    | "custom";

  direction:
    | "source-to-target"
    | "source-to-archive"
    | "archive-to-target";

  encryption:
    | "transport-only"
    | "client-side"
    | "server-side"
    | "double";

  compression:
    | "none"
    | "gzip"
    | "zstd";

  chunking: ChunkingPolicy;

  bandwidthPolicy: BandwidthPolicy;

  concurrencyPolicy: TransferConcurrencyPolicy;

  retryPolicy: TransferRetryPolicy;

  integrityPolicy: TransferIntegrityPolicy;

  stagingPolicy: TransferStagingPolicy;
}
```

---

# 十、TransferSession

TransferSession 是一条真实字节流或 Artifact 传输的持久会话。

```ts id="jlidme"
interface TransferSession {
  id: string;

  executionRunId: string;
  datasetMigrationRunId: string;

  plan: TransferPlan;

  source: TransferEndpoint;
  destination: TransferEndpoint;

  state: TransferSessionState;

  phase:
    | "enumerating"
    | "manifesting"
    | "transferring"
    | "verifying"
    | "finalizing";

  manifestId?: string;

  totalBytes?: number;
  completedBytes: number;
  verifiedBytes: number;

  totalItems?: number;
  completedItems: number;

  currentObjectId?: string;

  activePartIds: string[];

  checkpointId?: string;

  lease?: WorkerLease;

  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}
```

## TransferSession 状态

```ts id="tzcbu2"
type TransferSessionState =
  | "created"
  | "enumerating"
  | "ready"
  | "queued"
  | "running"
  | "pause-requested"
  | "paused"
  | "waiting"
  | "verifying"
  | "finalizing"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "recovering"
  | "blocked";
```

正常路径：

```text id="u5t7wj"
CREATED
→ ENUMERATING
→ READY
→ QUEUED
→ RUNNING
→ VERIFYING
→ FINALIZING
→ SUCCEEDED
```

---

# 十一、TransferManifest

```ts id="hvdof0"
interface TransferManifest {
  id: string;

  datasetMigrationRunId: string;

  sourceRoot: string;

  generatedAt: string;

  entries: TransferManifestEntry[];

  totalBytes: number;
  totalItems: number;

  manifestHash: string;

  generationMethod:
    | "filesystem-walk"
    | "database-artifact"
    | "volume-export"
    | "archive-index";

  sourceStateHash: string;
}
```

## 文件条目

```ts id="8zojp1"
interface TransferManifestEntry {
  id: string;

  relativePath: string;

  type:
    | "file"
    | "directory"
    | "symlink"
    | "hardlink"
    | "device"
    | "fifo";

  size?: number;

  mode?: number;
  uid?: number;
  gid?: number;

  mtime?: string;

  symlinkTarget?: string;

  xattrHash?: string;
  aclHash?: string;

  contentHash?: string;

  sparseMap?: SparseExtent[];

  chunkIds?: string[];

  required: boolean;
}
```

## 安全边界

默认不迁移：

- device；
- socket；
- fifo。

除非 Capability 明确支持。

---

# 十二、Chunk 与 Transfer Part

## Chunk

Chunk 是内容寻址的数据块。

```ts id="yae9wr"
interface TransferChunk {
  id: string;

  algorithm: "sha256" | "blake3";

  contentHash: string;

  uncompressedBytes: number;
  compressedBytes?: number;

  encryptionMetadata?: ChunkEncryptionMetadata;

  state:
    | "missing"
    | "uploading"
    | "stored"
    | "verified"
    | "corrupt";
}
```

## Transfer Part

```ts id="jjvt0z"
interface TransferPart {
  id: string;

  transferSessionId: string;

  manifestEntryId?: string;
  chunkId?: string;

  offset: number;
  length: number;

  state:
    | "pending"
    | "claimed"
    | "transferring"
    | "transferred"
    | "verified"
    | "failed";

  attemptCount: number;

  sourceChecksum?: string;
  destinationChecksum?: string;

  workerId?: string;

  startedAt?: string;
  completedAt?: string;
}
```

## 断点续传依据

只允许从以下已确认状态继续：

```text id="asqizj"
destination checksum verified
```

不能仅根据：

```text id="c3otqx"
已发送字节数
```

判断完成。

---

# 十三、ChunkingPolicy

```ts id="92xe3p"
interface ChunkingPolicy {
  method:
    | "fixed"
    | "content-defined"
    | "native-object"
    | "none";

  targetChunkBytes?: number;
  minimumChunkBytes?: number;
  maximumChunkBytes?: number;

  hashAlgorithm: "sha256" | "blake3";

  deduplication:
    | "none"
    | "within-session"
    | "within-archive"
    | "tenant-wide";
}
```

## 建议

### Live Migration 文件同步

优先使用：

```text id="8pzwqn"
rsync-style delta
```

或者外部 rsync Adapter。

### Capture Archive

优先使用：

```text id="o8md1a"
content-defined chunking
+ content-addressed object storage
```

便于：

- 去重；
- 增量封存；
- 完整性 scrub；
- 恢复。

### PostgreSQL Dump

通常将 dump Artifact 作为大对象分块，不对内部 SQL 逻辑分块。

---

# 十四、BandwidthPolicy

```ts id="zkwy7u"
interface BandwidthPolicy {
  maximumBytesPerSecond?: number;

  minimumReservedBytesPerSecond?: number;

  adaptive: boolean;

  schedule?: {
    startTime: string;
    endTime: string;
    maximumBytesPerSecond: number;
  }[];

  sourceLoadLimit?: {
    maximumCpuPercent?: number;
    maximumIoWaitPercent?: number;
    maximumDiskUtilizationPercent?: number;
  };

  targetLoadLimit?: {
    maximumCpuPercent?: number;
    maximumDiskUtilizationPercent?: number;
  };
}
```

## 动态限速

引擎可根据：

- source load；
- target load；
- network latency；
- retransmission；
- user traffic；
- maintenance window；

动态调整速率。

但所有调整必须记录 Event。

---

# 十五、TransferConcurrencyPolicy

```ts id="a7xou6"
interface TransferConcurrencyPolicy {
  maximumConcurrentParts: number;

  maximumConcurrentFiles: number;

  maximumConcurrentDatasets: number;

  preserveFileOrder: boolean;

  largeFileThresholdBytes?: number;

  smallFileBatching: boolean;
}
```

## 并发原则

- 大文件可以分块并行；
- 大量小文件可以批处理；
- PostgreSQL restore 通常限制并发；
- 同一 spinning disk 不应过高并发；
- final sync 应优先降低延迟，而非最大吞吐；
- Cutover 期间不应启动新的非关键传输。

---

# 十六、TransferRetryPolicy

```ts id="v1dkmc"
interface TransferRetryPolicy {
  maximumPartAttempts: number;

  retryableFailures: Array<
    | "network"
    | "timeout"
    | "remote-busy"
    | "temporary-storage"
    | "checksum-mismatch"
  >;

  backoff:
    | "fixed"
    | "linear"
    | "exponential";

  initialDelaySeconds: number;
  maximumDelaySeconds: number;

  onRepeatedChecksumMismatch:
    | "reread-source"
    | "mark-source-unstable"
    | "block";
}
```

---

# 十七、TransferIntegrityPolicy

```ts id="flwqej"
interface TransferIntegrityPolicy {
  sourceHashRequired: boolean;

  destinationHashRequired: boolean;

  verifyEveryChunk: boolean;

  verifyWholeObject: boolean;

  verifyManifest: boolean;

  allowMetadataOnlyVerification: boolean;

  corruptionResponse:
    | "retry"
    | "recreate-manifest"
    | "block";
}
```

## 最低要求

Migration 和 Capture 中 required Dataset：

- 每个对象或 chunk 必须校验；
- Manifest 必须签名或 Hash；
- final sync 后重新校验变化项；
- Capture 上传后必须从远端对象存储重新读取部分或全部数据校验。

---

# 十八、TransferStagingPolicy

```ts id="jpme73"
interface TransferStagingPolicy {
  destinationMode:
    | "temporary-directory"
    | "temporary-database"
    | "temporary-volume"
    | "direct";

  stagingPath?: string;

  atomicPromotionRequired: boolean;

  cleanupOnFailure: boolean;

  retainFailedArtifactsForDebugging: boolean;

  retentionSeconds?: number;
}
```

## 原则

优先：

```text id="62nl8c"
传到临时位置
→ 校验
→ 原子切换
```

而不是直接覆盖生产目标。

---

# 十九、文件 Dataset Engine

## 1. Preflight

检查：

- source path；
- realpath；
- mount；
- filesystem；
- size；
- file count；
- inode；
- ACL；
- xattr；
- symlink；
- hardlink；
- sparse file；
- writer；
- target capacity；
- path conflict。

## 2. Initial Sync

默认：

```text id="emv3me"
source
→ target staging path
```

保留：

- relative path；
- mode；
- ownership；
- mtime；
- symlink；
- hardlink；
- ACL/xattr；
- sparse extents。

## 3. Quiesce

根据 writer：

- maintenance mode；
- stop service；
- freeze application；
- stop cron；
- stop container。

## 4. Final Sync

只复制：

- 新文件；
- 修改文件；
- 删除记录；
- metadata 变化。

删除必须有明确策略：

```ts id="k43u6h"
type DeletionPolicy =
  | "mirror"
  | "preserve-target"
  | "review"
  | "ignore";
```

不能默认执行目标删除。

## 5. Promotion

校验后：

- rename staging；
- swap symlink；
- bind mount；
- atomic directory replacement；
- 或在服务停止状态下同步到最终路径。

## 6. 文件验证

至少包括：

- 文件数量；
- 总字节；
- Manifest Hash；
- 内容 Hash；
- owner/mode；
- ACL/xattr；
- required path；
- 应用读取测试。

---

# 二十、文件变化检测

## Initial 与 Final Sync 之间

需要记录 Source Baseline：

```ts id="7m0tdv"
interface FilesystemBaseline {
  manifestHash: string;
  capturedAt: string;

  fileSystemId?: string;

  journalPosition?: string;

  rootMtime?: string;
}
```

检测方式：

- 重新扫描 Manifest；
- rsync delta；
- filesystem journal，首期可不实现；
- application change log。

如果源文件在读取过程中持续变化：

```text id="u1lbm6"
source unstable
```

进入 warning 或 blocker。

---

# 二十一、PostgreSQL Dataset Engine

## 1. PostgreSQL Source Profile

```ts id="z2eon9"
interface PostgreSqlSourceProfile {
  serverVersion: string;

  clusterId: string;

  databases: PostgreSqlDatabaseProfile[];

  roles: PostgreSqlRoleProfile[];

  extensions: PostgreSqlExtensionProfile[];

  encoding: string;
  locale: string;

  tablespaces: string[];

  activeConnections: number;

  replicationSlots: string[];

  logicalReplicationEnabled: boolean;

  estimatedBytes: number;
}
```

## 2. 策略

首期支持：

```text id="vqu0qm"
logical-dump-restore
```

未来支持：

```text id="0mutcr"
physical-backup-restore
replication
```

## 3. Logical Dump/Restore 执行阶段

```text id="hyvvzw"
Inspect Source
→ Inspect Target
→ Verify Version Compatibility
→ Prepare Target Cluster
→ Capture Globals
→ Initial Database Dump
→ Transfer Dump Artifact
→ Quiesce Application
→ Final Consistent Dump or Final Delta
→ Restore Globals
→ Restore Database
→ Reassign Ownership
→ Restore Grants
→ Verify Extensions
→ Verify Schema
→ Verify Data
```

## 4. 角色和全局对象

必须考虑：

- roles；
- memberships；
- grants；
- ownership；
- tablespaces；
- extensions；
- large objects；
- sequences；
- default privileges。

不能只迁移表数据。

## 5. 数据库一致性

逻辑 dump 自身可提供 transaction-consistent snapshot。

但如果多个数据库需要跨库一致性，普通独立 `pg_dump` 不足。

必须：

- 使用协调策略；
- 停止应用写入；
- 或声明无法保证跨库事务一致性。

## 6. Initial + Final 逻辑

普通 `pg_dump` 不天然支持增量 final sync。

首期可选择：

### 小中型数据库

```text id="t2ur97"
初始阶段只做容量和速度测量
Cutover 时执行最终完整 dump/restore
```

### 中大型数据库

未来支持：

- logical replication；
- WAL/replication slot；
- snapshot + final catch-up。

不要把“两次 pg_dump”误称为增量同步。

## 7. PostgreSQL 校验

分层：

### Server

- version；
- locale；
- extensions。

### Schema

- schema list；
- table list；
- index；
- constraints；
- function；
- sequence。

### Data

- table row count；
- large object count；
- sequence current value；
- selected checksum；
- critical table query。

### Business

- application connection；
- read；
- write；
- rollback/delete test。

---

# 二十二、PostgreSQL Restore 安全规则

目标数据库存在时，必须选择：

```ts id="rhnsfh"
type ExistingDatabasePolicy =
  | "block"
  | "backup-and-replace"
  | "restore-to-new-name"
  | "merge-manual"
  | "reuse";
```

默认：

```text id="z3t71h"
block
```

不能自动 drop 目标已有数据库。

## before-state

需要保存：

- 目标数据库是否存在；
- owner；
- size；
- schema Hash；
- backup Artifact。

---

# 二十三、Docker Volume Dataset Engine

## 1. Volume Profile

```ts id="fhzzkm"
interface DockerVolumeProfile {
  volumeName: string;
  driver: string;
  mountpoint?: string;

  containerConsumers: {
    containerId: string;
    mountPath: string;
    readOnly: boolean;
  }[];

  estimatedBytes?: number;

  external: boolean;

  labels: Record<string, string>;
}
```

## 2. 策略

首期：

```text id="om67gj"
volume-export-import
```

执行：

```text id="09hhgx"
Inspect Volume
→ Identify Writers
→ Prepare Target Volume
→ Initial File Copy or Export
→ Stop Writer Containers
→ Final Copy
→ Restore Ownership
→ Attach Volume
→ Start Containers
→ Verify
```

## 3. Volume 驱动

### local

可以文件级迁移。

### NFS/CIFS

通常标记：

```text id="yeq39d"
external
```

只验证目标可访问，除非用户明确要求复制数据。

### Plugin/Cloud Volume

必须由对应 Capability Adapter 处理。

不能直接读取 mountpoint 假装可移植。

## 4. Compose

Volume 的目标名称应由 Compose Project 和冲突策略决定。

不能只复制源 Volume name。

---

# 二十四、Volume 一致性

容器 Volume 迁移前必须识别 writer。

默认：

```text id="z2s02q"
stop writer containers
```

只读 consumer 可以继续运行，前提是：

- 不影响 snapshot；
- mount 一致性满足要求。

数据库 Volume 不应通过普通 tar/rsync 迁移，除非数据库已完全停止且版本/文件系统兼容，并由数据库 Capability 明确允许。

---

# 二十五、Capture 模式的数据引擎

Capture 的目标不是目标机，而是 Archive。

## 执行

```text id="7fr30c"
Initial Capture
→ Quiesce
→ Final Capture
→ Build Dataset Manifest
→ Chunk
→ Compress
→ Encrypt
→ Upload
→ Verify Remote Object
→ Sign Manifest
```

## ArchiveDatasetRecord

```ts id="n8zo53"
interface ArchiveDatasetRecord {
  datasetContractId: string;

  strategy: string;

  artifactRefs: string[];
  manifestRef: string;

  consistencyLevel: string;
  consistencyCheckpointRef: string;

  sourceBytes: number;
  storedBytes: number;

  encryptionMetadata: ArchiveEncryptionMetadata;

  integrityStatus:
    | "unverified"
    | "verified"
    | "corrupt";

  capturedAt: string;
}
```

## Capture 完成条件

不是上传完毕，而是：

- Manifest 完成；
- 所有 required chunk 存在；
- Hash 匹配；
- 加密 metadata 完整；
- 可读取抽样或全量验证；
- Restore 引擎能够解析。

---

# 二十六、Restore 模式的数据引擎

```text id="04jyrf"
Verify Archive Manifest
→ Verify Key Availability
→ Check Target Capacity
→ Download Chunks
→ Verify Chunk Hash
→ Reconstruct Artifact
→ Restore Metadata
→ Restore Database/Volume/File
→ Verify Dataset
```

## Restore 必须支持

- Archive 缺块检测；
- 目标容量不足；
- 目标版本转换；
- 重命名；
- 路径重定位；
- UID/GID 映射；
- 数据库角色映射；
- 部分 Dataset 选择恢复。

但如果 Workload required Dataset 未恢复：

```text id="fl9hgh"
Workload 不能标记成功
```

---

# 二十七、Transfer 暂停与恢复

## 暂停

收到 Pause Request：

1. 不再分配新 Part；
2. 当前 Part 尽量完成；
3. 持久化已验证 Part；
4. 写 Transfer Checkpoint；
5. 释放 Lease；
6. Session 进入 paused。

## 恢复

```text id="9ec38l"
PAUSED
→ Validate Manifest
→ Validate Destination Temp Data
→ Reconcile Parts
→ QUEUED
→ RUNNING
```

## 恢复时检查

- Manifest 未变化；
- 源对象未变化；
- 目标临时数据仍存在；
- 已完成 chunk Hash 正确；
- 加密上下文可恢复；
- Checkpoint 仍有效。

---

# 二十八、Transfer 崩溃恢复

Worker Lease 过期后：

```text id="bi0azy"
Session → recovering
```

Recovery Coordinator：

- 检查 active Part；
- 读取目标临时对象；
- 校验长度和 Hash；
- 已完整则标记 verified；
- 部分写入则丢弃或从安全 offset 继续；
- 重新进入 queued。

## 不允许

根据 worker 报告的：

```text id="ft34qx"
已发送 90%
```

直接恢复。

必须依据目标端可验证状态。

---

# 二十九、数据验证模型

```ts id="3mtvym"
interface DatasetVerificationPlan {
  checks: DatasetVerificationCheck[];

  successPolicy:
    | "all-required"
    | "threshold"
    | "manual";

  compareAgainst:
    | "source-live"
    | "source-checkpoint"
    | "archive-manifest"
    | "expected-definition";
}
```

## Check 类型

```ts id="jdnz35"
type DatasetVerificationCheck =
  | ManifestVerificationCheck
  | FileCountVerificationCheck
  | ByteCountVerificationCheck
  | ChecksumVerificationCheck
  | DatabaseSchemaVerificationCheck
  | DatabaseRowVerificationCheck
  | DatabaseQueryVerificationCheck
  | ApplicationReadWriteVerificationCheck
  | ManualDatasetVerificationCheck;
```

## required verification

Migration/Capture/Restore 中 required Dataset 至少要有：

- 完整性 Check；
- 可读性 Check；
- 业务重要 Dataset 的业务 Check。

---

# 三十、抽样与全量校验

## 全量校验

适合：

- 小中型数据；
- Capture；
- Critical Dataset；
- content-addressed Archive。

## 抽样校验

适合：

- 极大文件；
- 已有 chunk Hash；
- 大型数据库表。

但必须明确：

```text id="3x8xxy"
sampled
```

不能显示成：

```text id="gl5i0d"
fully verified
```

## Verification Level

```ts id="7dt2m7"
type DatasetVerificationLevel =
  | "metadata-only"
  | "sampled"
  | "full-content"
  | "application-verified";
```

---

# 三十一、Dataset Rollback

```ts id="prb8k2"
interface DatasetRollbackPlan {
  classification:
    | "full"
    | "partial"
    | "manual"
    | "none";

  beforeStateRequired: boolean;

  targetBackupRequired: boolean;

  rollbackActions: string[];

  sourceResumeActions: string[];

  reconciliationRequiredAfterTargetWrites: boolean;

  irreversibleRisks: string[];
}
```

## 文件 Dataset

可以通过：

- staging directory；
- target backup；
- atomic rename；

实现较完整回滚。

## PostgreSQL

如果目标数据库为新建：

- 可停止应用；
- 删除新数据库；
- 恢复目标之前状态。

如果覆盖目标已有数据库：

- 必须先备份；
- 否则不能标记 full rollback。

## Cutover 后新写入

必须检测：

- 文件变化；
- 数据库写入；
- Volume 写入。

发生后：

```text id="03shwf"
自动 rollback 可能导致新数据丢失
```

必须进入 reconciliation。

---

# 三十二、数据迁移 Commit

Dataset 成功并不自动意味着整个迁移成功。

Dataset Commit 表示：

> 当前目标或 Archive 中的数据已通过合同要求，可以供后续 Workload 阶段使用。

```ts id="pzfkwh"
interface DatasetCommitRecord {
  id: string;

  datasetMigrationRunId: string;

  contractHash: string;

  consistencyCheckpointId: string;

  verificationResultIds: string[];

  sourceStateHash: string;
  destinationStateHash: string;

  committedAt: string;
}
```

Migration 的最终 Cutover Commit 需要引用所有 required Dataset Commit。

---

# 三十三、带宽和停机估算

## 初始估算

```ts id="jxw1re"
interface DatasetTimeEstimate {
  discoverySeconds?: number;
  initialTransferSeconds?: number;
  quiesceSeconds?: number;
  finalSyncSeconds?: number;
  restoreSeconds?: number;
  verificationSeconds?: number;

  confidence:
    | "low"
    | "medium"
    | "high";
}
```

## 动态估算

运行时根据：

- 实测带宽；
- 压缩率；
- 变化率；
- 小文件比例；
- 数据库 dump 速度；
- restore 速度；

更新 ETA。

## 停机估算

```text id="njt4rk"
预计停机 =
quiesce
+ final sync
+ restore/activation
+ required verification
+ traffic switch
```

Initial sync 时间不应计入停机。

---

# 三十四、数据变化率

为判断 final sync 是否可控，需要估计：

```ts id="j15qbq"
interface DatasetChangeRate {
  bytesPerSecond?: number;
  filesPerMinute?: number;
  transactionsPerSecond?: number;

  observedWindowSeconds: number;

  confidence: string;
}
```

如果：

```text id="tzgof2"
变化速度 ≥ 可用同步速度
```

则 initial/final sync 策略不可行。

系统应：

- 降低写入；
- 选择 replication；
- 增加带宽；
- 或扩大停机窗口。

---

# 三十五、数据安全

## 传输

- SSH/TLS；
- 可选客户端加密；
- Hash；
- 防重放；
- 临时凭据。

## 存储

Capture Archive 必须：

- tenant isolation；
- encryption at rest；
- per-archive data key；
- key wrapping；
- immutable manifest；
- object versioning；
- delete audit。

## 日志

不能记录：

- 文件内容；
- 数据库行；
- Secret；
- dump 内敏感数据；
- 完整路径中的敏感参数。

---

# 三十六、清理策略

迁移会产生：

- 临时 dump；
- staging directory；
- partial chunk；
- target backup；
- failed restore database；
- archive multipart upload。

必须有：

```ts id="o1bbq5"
interface DatasetCleanupPolicy {
  onSuccess:
    | "delete-immediately"
    | "retain-for-rollback"
    | "retain-until-project-close";

  onFailure:
    | "retain-for-debug"
    | "delete-sensitive"
    | "manual";

  retentionSeconds?: number;
}
```

包含敏感数据的 dump 默认：

- 加密；
- 最小保留；
- 自动删除；
- 删除有审计记录。

---

# 三十七、数据引擎资源锁

资源键示例：

```text id="d24xf6"
dataset:<dataset-id>
source-path:<endpoint>:<realpath>
target-path:<endpoint>:<realpath>
postgres-cluster:<endpoint>:<cluster>
postgres-database:<endpoint>:<database>
docker-volume:<endpoint>:<volume>
archive-dataset:<archive-id>:<dataset-id>
```

## 规则

- 同一 Dataset 同时只能有一个写迁移；
- 初始只读扫描可以并行；
- final sync 必须独占；
- restore 必须独占目标 Dataset；
- verification 可共享读锁；
- rollback 获取最高优先级锁。

---

# 三十八、数据事件

```text id="ovptnm"
dataset.preflight.started
dataset.preflight.completed
transfer.manifest.created
transfer.part.completed
transfer.checkpoint.created
dataset.quiesce.started
dataset.consistency.reached
dataset.final-sync.started
dataset.restore.started
dataset.verification.passed
dataset.committed
dataset.rollback.started
```

Report 必须从这些 Event 和 Artifact 生成。

---

# 三十九、数据库持久化建议

```text id="an87dk"
dataset_execution_contracts

dataset_migration_runs
dataset_stage_runs

transfer_sessions
transfer_manifests
transfer_manifest_entries
transfer_chunks
transfer_parts

consistency_checkpoints

dataset_verification_results
dataset_commit_records

dataset_resource_leases
dataset_events
```

对于大量 Manifest Entry 和 Chunk，不建议全部塞入 SQLite 单个 JSON 文档。

应使用：

- 关系表；
- 分页；
- 批量写入；
- 或对象存储中的 Manifest Artifact。

---

# 四十、API 建议

```text id="54zgbx"
GET  /runs/:runId/datasets
GET  /dataset-runs/:datasetRunId
POST /dataset-runs/:datasetRunId/pause
POST /dataset-runs/:datasetRunId/resume
POST /dataset-runs/:datasetRunId/retry
POST /dataset-runs/:datasetRunId/rollback

GET  /transfer-sessions/:sessionId
GET  /transfer-sessions/:sessionId/progress

POST /dataset-runs/:datasetRunId/quiesce-confirm
POST /dataset-runs/:datasetRunId/verify
```

通常 Dataset Run 由父 Execution Run 调度。

不建议普通用户单独启动未绑定 Plan 的数据迁移。

---

# 四十一、UI 进度

用户看到：

```text id="1dvpbg"
上传文件
阶段：初始同步
进度：13.2 GB / 18.0 GB
速度：42 MB/s
预计剩余：2 分钟
文件：18,104 / 18,942
断点：刚刚保存
源服务：仍在运行
预计最终停机：45-90 秒
```

而不是只有：

```text id="y6sn2l"
73%
```

PostgreSQL：

```text id="ldmec2"
数据库 blog_production
阶段：恢复
Dump：4.8 GB，Hash 已验证
已恢复对象：1,242 / 1,410
当前：创建索引
下一步：数据验证
```

---

# 四十二、模式差异

| 能力 | Build | Migration | Capture | Restore |
|---|---:|---:|---:|---:|
| Initial sync | 否 | 是 | 是 | 否 |
| Quiesce source | 否 | 是 | 是 | 否 |
| Final sync | 否 | 是 | 是 | 否 |
| Archive chunking | 可选 | 可选 | 必需 | 消费 |
| Restore Dataset | 初始化 | 是 | 否 | 是 |
| Source resume | 否 | 是 | 是 | 否 |
| Dataset rollback | 目标初始化 | 源/目标 | Capture 清理 | 目标恢复 |
| Long-term integrity | 否 | 可选 | 必需 | 校验 Archive |

---

# 四十三、首期 MVP 范围

## 文件 Dataset

必须支持：

- 本地 Linux 文件目录；
- SSH；
- initial + final rsync；
- owner/mode；
- symlink；
- checksum；
- staging；
- pause/resume；
- bandwidth limit；
- Manifest；
- verification。

首期可以暂缓：

- ACL/xattr 全平台兼容；
- filesystem journal；
- content-defined delta；
- NFS 写回；
- 超大 sparse file 优化。

## PostgreSQL

必须支持：

- PostgreSQL 14-16 的逻辑 dump/restore；
- databases；
- roles；
- grants；
- extensions；
- ownership；
- sequences；
- row/schema verification；
- encrypted dump Artifact；
- safe target conflict policy。

首期暂缓：

- physical replication；
- near-zero downtime logical replication；
- tablespace 自动转换；
- 跨库原子一致性；
- 大规模并行 restore 优化。

## Docker Volume

必须支持：

- local driver；
- container writer discovery；
- initial/final file sync；
- stop/start containers；
- ownership；
- verification。

首期暂缓：

- cloud volume plugin；
- Ceph；
- NFS；
- database Volume 在线迁移；
- Kubernetes PVC。

---

# 四十四、黄金场景执行路径

针对个人博客：

```text id="d9e73d"
PostgreSQL blog_production
+
/var/lib/blog/uploads
```

## 初始同步阶段

```text id="cmi1vh"
测量 PostgreSQL dump 速度
初始同步 uploads 到目标 staging
准备目标 PostgreSQL
```

## Cutover

```text id="bs8gkb"
启用 maintenance mode
→ drain HTTP
→ 停止 blog.service
→ 等待 DB 事务完成
→ 最终 pg_dump
→ final rsync uploads
→ restore PostgreSQL
→ verify schema/rows/sequences
→ promote uploads
→ start target app
```

## 验证

```text id="mqx6ug"
PostgreSQL 可连接
关键表数量一致
关键 row count 符合
uploads Manifest 一致
应用可以读写
```

---

# 四十五、核心不变量

1. DatasetContract 是目标无关定义，DatasetExecutionContract 是目标特定合同。
2. 数据传输必须由独立 DatasetMigrationRun 管理。
3. TransferSession 不能等同于整个 Dataset 迁移。
4. Initial sync 期间源服务可以运行，Final sync 必须基于一致性点。
5. Final sync 必须发生在 writer quiesce 之后。
6. 数据一致性必须有可验证 Checkpoint。
7. 传输完成必须以目标 Hash 为依据，而非已发送字节。
8. required Dataset 未通过 Verification，Workload Run 不能成功。
9. PostgreSQL 不能通过普通文件复制冒充逻辑迁移。
10. PostgreSQL `pg_dump` 不等于增量同步。
11. Docker Volume 必须识别 writer 和 driver。
12. 数据库 Volume 默认不能在线 rsync。
13. TransferSession 必须持久保存 Manifest、Part、Checkpoint 和 Attempt。
14. 暂停只能停在安全 Part 或 Stage Checkpoint。
15. Worker 崩溃后必须从目标可验证状态恢复。
16. 同一 Dataset 同时只能有一个写迁移。
17. 目标已有数据默认阻塞，不能自动覆盖。
18. 文件删除同步必须有显式 Deletion Policy。
19. Archive 必须完成远端存储校验，不能只验证本地上传结果。
20. Sampled Verification 不能显示为 Full Verification。
21. Cutover 后目标新写入会改变 Dataset Rollback 能力。
22. 数据 Commit 必须绑定 Consistency Checkpoint 和 Verification。
23. 临时 dump 和 staging 数据必须受加密与清理策略保护。
24. 带宽、并发和源负载必须可控制。
25. Report 只能陈述真实 Dataset Event、Manifest 和 Verification 证据。

下一步应确定 **Secret Delivery Engine 与 Secret Provider 模型**，包括用户输入、Vault、SOPS、目标已有 Secret、重新生成、运行时注入、轮换、脱敏和 Preserve 场景中的长期恢复策略。

## Prompt:
2026/7/18 22:09:57

确定 Secret Delivery Engine 与 Secret Provider 模型

## Response:
2026/7/18 22:10:17

这一轮我会把 Secret 分成“发现引用、声明需求、绑定 Provider、运行时解析、目标物化、消费验证、轮换与清理”七层，并明确默认不持久化明文、Preserve 场景的长期恢复边界以及各 Provider 的安全责任。

> **规划模型概念**
>
> 我正在整理“秘密交付引擎”和“秘密服务提供者”的模型定义。会包括很多细节，如状态机，轮换方法，和加密管理等。目标是确保系统安全但不暴露实际机密。
>
> **规划模型概念**
>
> 
>
> 思考了 19s

当前 EnvForge 只有 `SecretRef` 和脱敏基础，没有 Secret Requirement、Provider Binding、运行时获取、目标注入、验证和清理闭环；因此 Secret 不能继续作为配置页面中的“out-of-band 说明”，必须成为独立执行子系统。`8bead08a-b983-4703-97e2-6580c02aff9c.md`

**document: **

# EnvForge Secret Delivery Engine 与 Secret Provider 模型

## 一、Secret Engine 的核心定位

Secret Delivery Engine 负责：

> 在不把 Secret 明文写入 Snapshot、Blueprint、Plan、日志、Checkpoint 或 Report 的前提下，确保 Workload 在 Build、Migration、Capture 和 Restore 过程中能够安全获得所需凭据，并验证其确实可用。

完整生命周期：

```text id="rc1ro6"
发现 Secret 引用
→ 创建 Secret Requirement
→ 用户选择 Provider
→ 编译 Secret Execution Contract
→ Run 时解析 Secret
→ 安全物化
→ 注入消费者
→ 验证
→ 轮换
→ 清理临时材料
```

Secret Engine 不负责：

- 扫描并永久保存所有 Secret 明文；
- 自动破解未知密码；
- 把旧服务器上的所有环境变量原样复制；
- 将 Secret 写入 Plan Artifact；
- 在 Report 中输出 Secret；
- 默认替用户托管长期 Secret。

---

# 二、默认产品安全原则

建议将以下规则确定为正式基线。

## 1. 默认不托管 Secret 明文

EnvForge 默认只保存：

- Secret 的逻辑名称；
- 来源位置；
- fingerprint；
- consumer；
- 所需阶段；
- Provider 引用；
- 注入方式；
- 验证状态；
- 轮换策略。

默认不保存：

```ts id="wlh10u"
secretValue: string;
```

## 2. Secret 只在需要时解析

采用：

```text id="j6ggbt"
Just-in-time resolution
```

例如：

- Plan 编译时不读取明文；
- Run 执行到启动阶段时才向 Vault 获取；
- 使用后立即清理内存和临时文件。

## 3. 明文生命周期尽可能短

```text id="p2nw2w"
Provider
→ Worker memory
→ Target injection
→ Cleanup
```

不能：

```text id="l50836"
Provider
→ Database
→ Queue
→ Event Log
→ Report
```

## 4. Secret 与 Plan 分离

Plan 保存：

- Requirement；
- Provider Binding；
- Secret Reference；
- Injection Contract。

Plan 不保存 Secret 值。

## 5. Secret 缺失必须成为明确 Gate

required Secret 不可用时：

```text id="db8l55"
Run = blocked
waitingReason = secret-input
```

不能：

- 静默跳过；
- 写空值；
- 启动服务后再看是否失败；
- 把服务启动失败当普通重试。

---

# 三、Secret 领域对象分层

必须严格区分以下对象。

| 对象 | 作用 |
|---|---|
| SecretRef | Snapshot 中发现的 Secret 引用证据 |
| SecretRequirement | Blueprint 中 Workload 需要什么 Secret |
| SecretProviderBinding | DecisionSet 中决定从哪里获得 |
| SecretExecutionContract | Plan 中本次执行如何获取和交付 |
| SecretResolution | Run 中某次实际解析结果的元数据 |
| SecretMaterialization | Secret 在目标端如何临时或持久存在 |
| SecretDeliveryRun | 某次 Secret 获取、注入和验证实例 |
| SecretRotationRecord | 轮换结果 |
| SecretAuditEvent | 不含值的审计记录 |

关系：

```text id="pjp59r"
SecretRef
→ SecretRequirement
→ SecretProviderBinding
→ SecretExecutionContract
→ SecretDeliveryRun
→ Materialization
→ Validation
→ Rotation/Cleanup
```

---

# 四、SecretRef

SecretRef 是源端证据，不是可恢复 Secret。

```ts id="fjdd08"
interface SecretRef {
  id: string;

  sourceEndpointId: string;
  sourceSnapshotId: string;

  sourceLocation:
    | {
        type: "environment-file";
        path: string;
        key: string;
      }
    | {
        type: "config-file";
        path: string;
        fieldPath?: string;
      }
    | {
        type: "systemd-environment";
        unitName: string;
        key: string;
      }
    | {
        type: "docker-environment";
        containerId: string;
        key: string;
      }
    | {
        type: "compose-secret";
        projectName: string;
        secretName: string;
      }
    | {
        type: "external-reference";
        providerHint?: string;
        reference: string;
      };

  classification:
    | "credential"
    | "password"
    | "token"
    | "api-key"
    | "private-key"
    | "certificate-key"
    | "encryption-key"
    | "session-secret"
    | "database-url"
    | "unknown";

  fingerprint?: string;

  valueObserved:
    | "never-read"
    | "read-and-discarded"
    | "not-accessible";

  confidence: number;

  consumerEvidenceIds: string[];

  createdAt: string;
}
```

## SecretRef 规则

- Collector 优先只读取 key 名，不读取 value；
- 如果为识别关系确实需要读取值，只在内存解析后立即丢弃；
- Snapshot 只保存 fingerprint 或结构化引用；
- fingerprint 不应使用普通裸 Hash，避免低熵密码字典攻击。

建议：

```text id="hkvb4d"
fingerprint = HMAC-SHA256(workspaceFingerprintKey, normalizedSecret)
```

---

# 五、SecretRequirement

Blueprint 中只描述业务需求。

```ts id="q9n5o9"
interface SecretRequirement {
  id: string;

  workloadId: string;

  logicalName: string;
  description: string;

  classification:
    | "credential"
    | "password"
    | "token"
    | "api-key"
    | "private-key"
    | "certificate-key"
    | "encryption-key"
    | "session-secret"
    | "database-url"
    | "custom";

  consumerComponentIds: string[];

  sourceSecretRefIds: string[];

  required: boolean;

  requiredAt:
    | "compile"
    | "prepare"
    | "restore"
    | "startup"
    | "cutover"
    | "verification";

  allowedProviderTypes: SecretProviderType[];

  preferredProviderType?: SecretProviderType;

  deliveryRequirements: SecretDeliveryRequirements;

  persistenceRequirement:
    | "runtime-only"
    | "target-persistent"
    | "external-reference-only";

  continuityRequirement:
    | "preserve-value"
    | "preserve-or-rotate"
    | "must-rotate"
    | "regenerate"
    | "new-value-acceptable";

  validationRequirements: SecretValidationRequirement[];

  recoveryRequirements: SecretRecoveryRequirements;

  sensitivity:
    | "standard"
    | "high"
    | "critical";

  sourceEvidenceIds: string[];
}
```

---

# 六、SecretDeliveryRequirements

```ts id="ljymkf"
interface SecretDeliveryRequirements {
  supportedInjectionMethods: Array<
    | "environment"
    | "environment-file"
    | "systemd-credential"
    | "docker-secret"
    | "compose-secret"
    | "file"
    | "stdin"
    | "file-descriptor"
    | "command-argument"
    | "external-reference"
  >;

  preferredInjectionMethod?: string;

  targetPath?: string;

  requiredOwnerRef?: string;
  requiredGroupRef?: string;
  requiredMode?: string;

  encoding:
    | "utf8"
    | "base64"
    | "binary"
    | "pem"
    | "json";

  formatConstraints?: {
    minimumLength?: number;
    maximumLength?: number;
    requiredPattern?: string;
    forbiddenCharacters?: string[];
  };

  restartRequiredAfterChange: boolean;
}
```

## 安全建议

默认优先级：

```text id="4j94x3"
external reference
> systemd credential / Docker secret
> protected file
> environment variable
> command argument
```

命令行参数风险较高，因为可能出现在：

- process list；
- shell history；
- audit logs。

默认禁止，除非 Capability 明确证明安全。

---

# 七、SecretRecoveryRequirements

```ts id="7exwmq"
interface SecretRecoveryRequirements {
  requiredForRestore: boolean;

  futureAvailability:
    | "guaranteed-provider"
    | "user-must-provide"
    | "regeneratable"
    | "target-existing"
    | "unknown";

  preserveInArchive:
    | "never"
    | "encrypted-escrow-allowed"
    | "required";

  rotationAfterRestore:
    | "required"
    | "recommended"
    | "not-required";

  lossImpact:
    | "service-unavailable"
    | "data-inaccessible"
    | "cannot-decrypt-data"
    | "external-integration-broken"
    | "session-invalidated"
    | "minor"
    | "unknown";
}
```

特别是以下 Secret：

- 数据加密主密钥；
- 备份加密密钥；
- JWT 签名密钥；
- 用户数据解密密钥；
- 私钥；

如果丢失可能导致数据永久不可恢复，Capture 必须阻塞，不能只提示 warning。

---

# 八、Secret Provider 类型

```ts id="wm1fhs"
type SecretProviderType =
  | "user-input"
  | "vault"
  | "sops"
  | "target-existing"
  | "regenerate"
  | "out-of-band"
  | "envforge-managed-escrow"
  | "cloud-secret-manager"
  | "custom";
```

首期建议正式支持：

- user-input；
- target-existing；
- regenerate；
- Vault；
- SOPS；
- out-of-band。

`envforge-managed-escrow` 可以设计接口，但在安全体系未成熟前不默认开放。

---

# 九、统一 Secret Provider 接口

```ts id="19xxsr"
interface SecretProvider {
  type: SecretProviderType;

  capabilities(): SecretProviderCapabilities;

  validateBinding(
    binding: SecretProviderBinding,
    requirement: SecretRequirement
  ): Promise<SecretProviderValidationResult>;

  resolve(
    request: SecretResolveRequest
  ): Promise<SecretHandle>;

  rotate?(
    request: SecretRotationRequest
  ): Promise<SecretRotationResult>;

  revoke?(
    request: SecretRevocationRequest
  ): Promise<void>;
}
```

## Provider 不直接返回普通字符串

避免：

```ts id="11dp44"
Promise<string>
```

建议返回受控 Handle：

```ts id="6cv55r"
interface SecretHandle {
  id: string;

  providerType: SecretProviderType;

  expiresAt?: string;

  use<T>(
    consumer: (secret: SecretMaterial) => Promise<T>
  ): Promise<T>;

  destroy(): Promise<void>;
}
```

`SecretMaterial` 只能在受控 callback 范围内访问。

---

# 十、SecretProviderCapabilities

```ts id="4g3x4u"
interface SecretProviderCapabilities {
  supportsRuntimeResolution: boolean;
  supportsLongTermReference: boolean;
  supportsVersioning: boolean;
  supportsRotation: boolean;
  supportsRevocation: boolean;
  supportsBinary: boolean;
  supportsLease: boolean;
  supportsAudit: boolean;
  supportsOfflineRestore: boolean;

  maximumSecretBytes?: number;

  supportedClassifications: string[];
}
```

---

# 十一、SecretProviderBinding

Provider Binding 属于 DecisionSet，不属于 Blueprint。

```ts id="f5rtsa"
interface SecretProviderBinding {
  id: string;

  projectId: string;
  secretRequirementId: string;

  providerType: SecretProviderType;

  providerConfigRef: string;

  providerSecretRef?: string;
  providerVersionRef?: string;

  resolutionMode:
    | "runtime"
    | "preflight"
    | "manual-gate";

  availabilityPolicy:
    | "required-before-run"
    | "required-before-stage"
    | "prompt-when-needed";

  rotationPolicy:
    | "preserve"
    | "rotate-before-use"
    | "rotate-after-cutover"
    | "rotate-after-restore"
    | "regenerate";

  fallbackBindingIds: string[];

  status:
    | "unvalidated"
    | "valid"
    | "invalid"
    | "unavailable";

  createdBy: string;
  createdAt: string;
}
```

## ProviderConfigRef

引用的是已保存的 Provider 配置，例如：

- Vault 地址和认证方式；
- SOPS KMS 配置；
- Cloud Secret Manager account；
- EnvForge Escrow key reference。

不能包含：

- Vault Token 明文；
- KMS 私钥；
- 用户密码。

---

# 十二、SecretExecutionContract

Plan Compiler 将 Requirement 与 Binding 编译成：

```ts id="cnaexe"
interface SecretExecutionContract {
  id: string;

  planRevisionId: string;

  workloadId: string;
  secretRequirementId: string;

  providerBindingRef: {
    bindingId: string;
    bindingHash: string;
  };

  consumerComponentIds: string[];

  resolutionStage:
    | "preflight"
    | "prepare"
    | "restore"
    | "startup"
    | "cutover"
    | "verification";

  deliveryPlan: SecretDeliveryPlan;

  validationPlan: SecretValidationPlan;

  cleanupPlan: SecretCleanupPlan;

  rotationPlan?: SecretRotationPlan;

  redactionPolicyId: string;

  approvalGateIds: string[];

  contractHash: string;
}
```

Plan 只保存逻辑引用和执行规则。

---

# 十三、SecretDeliveryPlan

```ts id="gwci5p"
interface SecretDeliveryPlan {
  injectionMethod:
    | "environment"
    | "environment-file"
    | "systemd-credential"
    | "docker-secret"
    | "compose-secret"
    | "file"
    | "stdin"
    | "file-descriptor"
    | "external-reference";

  targetEndpointId: string;

  targetReference: string;

  materialization:
    | "memory-only"
    | "temporary-file"
    | "persistent-file"
    | "provider-reference";

  ownerRef?: string;
  groupRef?: string;
  mode?: string;

  atomicWriteRequired: boolean;

  serviceRestartActionIds: string[];

  rollbackStrategy:
    | "restore-previous"
    | "remove-created"
    | "rotate-again"
    | "manual"
    | "none";
}
```

---

# 十四、SecretDeliveryRun

```ts id="fdxrlp"
interface SecretDeliveryRun {
  id: string;

  executionRunId: string;
  secretExecutionContractId: string;

  state: SecretDeliveryRunState;

  phase:
    | "provider-preflight"
    | "waiting-provider"
    | "resolving"
    | "materializing"
    | "injecting"
    | "validating"
    | "rotating"
    | "cleaning";

  providerResolutionId?: string;

  materializationIds: string[];

  validationResultIds: string[];

  rotationRecordId?: string;

  startedAt?: string;
  completedAt?: string;

  outcome?: {
    delivered: boolean;
    validated: boolean;
    rotated: boolean;
    cleaned: boolean;
  };
}
```

## 状态

```ts id="3sph35"
type SecretDeliveryRunState =
  | "pending"
  | "waiting"
  | "resolving"
  | "available"
  | "materializing"
  | "injecting"
  | "validating"
  | "rotating"
  | "cleaning"
  | "succeeded"
  | "failed"
  | "blocked"
  | "expired"
  | "revoked";
```

正常路径：

```text id="swt78e"
PENDING
→ RESOLVING
→ AVAILABLE
→ MATERIALIZING
→ INJECTING
→ VALIDATING
→ CLEANING
→ SUCCEEDED
```

---

# 十五、SecretResolution

```ts id="8vtpvm"
interface SecretResolution {
  id: string;

  secretDeliveryRunId: string;

  providerType: SecretProviderType;

  providerReferenceHash: string;

  versionRef?: string;

  leaseId?: string;
  leaseExpiresAt?: string;

  fingerprint?: string;

  state:
    | "resolved"
    | "expired"
    | "revoked"
    | "destroyed";

  resolvedAt: string;
}
```

不能保存 value。

---

# 十六、SecretMaterialization

SecretMaterialization 记录 Secret 在目标端出现的方式，不记录内容。

```ts id="mrbpb5"
interface SecretMaterialization {
  id: string;

  secretDeliveryRunId: string;

  targetEndpointId: string;

  method:
    | "process-environment"
    | "environment-file"
    | "systemd-credential"
    | "docker-secret"
    | "compose-secret"
    | "file"
    | "external-reference";

  targetReferenceHash: string;

  persistent: boolean;

  owner?: string;
  group?: string;
  mode?: string;

  previousStateArtifactId?: string;

  createdAt: string;
  expiresAt?: string;

  cleanupStatus:
    | "pending"
    | "not-required"
    | "completed"
    | "failed";
}
```

`targetReferenceHash` 可以证明位置，但 Report 不一定显示完整敏感路径。

---

# 十七、Provider：User Input

适合：

- 临时迁移；
- 少量 Secret；
- 用户不使用 Secret Manager；
- Restore 时人工输入。

流程：

```text id="6qj91m"
Run 到达 Secret Gate
→ 状态 waiting
→ 用户通过安全输入界面提交
→ 后端一次性使用
→ 不写数据库
→ 注入
→ 验证
→ 内存清理
```

## User Input Session

```ts id="1q33lc"
interface UserSecretInputSession {
  id: string;

  runId: string;
  requirementId: string;

  oneTimeTokenHash: string;

  expiresAt: string;

  state:
    | "waiting"
    | "submitted"
    | "consumed"
    | "expired";

  maximumAttempts: number;
}
```

## 安全要求

- HTTPS；
- CSRF 防护；
- 一次性 Token；
- 不进入浏览器持久存储；
- 不回显；
- 不进入 request log；
- 不进入 error tracker；
- 提交后立即消费；
- 后端不保存请求 body。

---

# 十八、Provider：Vault

适合：

- 生产环境；
- 长期可恢复；
- 支持版本和轮换；
- 动态数据库凭据。

Binding 保存：

- Vault mount；
- logical path；
- key name；
- auth method ref；
- namespace；
- version policy。

不保存：

- Vault Token；
- Secret value。

## Vault 动态 Secret

需要额外处理：

- lease；
- expiration；
- renew；
- revoke。

Run 如果超过 lease：

```text id="tj9utc"
renew
或
重新 resolve
```

不能把已过期 Secret 继续注入。

---

# 十九、Provider：SOPS

适合：

- GitOps；
- 用户控制加密文件；
- Capture/Restore；
- 离线保存。

Binding 保存：

- encrypted file Artifact；
- document path；
- key path；
- KMS/PGP/age provider reference。

执行时：

```text id="mue6ym"
读取加密 Artifact
→ 在受控内存中解密
→ 提取指定字段
→ 注入
→ 清理
```

禁止把整个解密文件写入普通临时目录。

如必须落盘：

- tmpfs；
- `0600`；
- 短时生命周期；
- 可靠清理；
- 禁止被 backup/scanner 收集。

---

# 二十、Provider：Target Existing

适合：

- 目标机已有 `/etc/.../secret`；
- 目标 Vault Agent 已注入；
- 云主机 IAM 提供；
- Secret 不需要跨机器复制。

Plan 生成：

```text id="1ipk4p"
Check Target Reference Exists
→ Check owner/mode
→ Check consumer access
→ Validate Secret
```

不能读取并返回明文。

验证失败时：

```text id="ic5b5k"
blocked
```

---

# 二十一、Provider：Regenerate

适合：

- session secret；
- 内部 API token；
- 随机管理员密码；
- 可重新签发证书；
- 可以轮换的应用密钥。

```ts id="51cemg"
interface RegenerateBinding {
  algorithm:
    | "random-bytes"
    | "random-password"
    | "keypair"
    | "certificate"
    | "capability-generated";

  parameters: Record<string, unknown>;

  storeResultToProviderBindingId?: string;

  revealToUser:
    | "never"
    | "one-time"
    | "download-once";
}
```

## 重要边界

不能 regenerate：

- 用于解密旧数据的密钥；
- 需要与外部系统一致的 API key；
- 原有 JWT 签名连续性要求；
- 无法更新 consumer 的共享凭据。

---

# 二十二、Provider：Out-of-band

适合暂时无法自动化的外部流程。

例如：

- 用户登录 SaaS 控制台更新 Token；
- 第三方供应商重新签发证书；
- 人工将私钥放到目标 HSM。

Out-of-band 必须生成结构化 Manual Gate：

```text id="ohxg83"
步骤
预期目标位置
验证方式
截止时间
回滚说明
```

用户点击“完成”后仍必须执行验证。

不能仅凭确认直接通过。

---

# 二十三、Provider：EnvForge Managed Escrow

建议作为可选高级能力，而不是默认能力。

适用于用户明确要求：

> EnvForge 替我加密保管，未来无需其他系统即可恢复。

## 需要的安全基础

- 独立 KMS；
- envelope encryption；
- 每个 Secret 独立 Data Encryption Key；
- tenant isolation；
- key rotation；
- break-glass audit；
- immutable access log；
- 多人授权；
- 可撤销；
- 数据删除证明；
- 备份和灾难恢复；
- 密钥丢失方案；
- 安全审计。

## Escrow Record

```ts id="onbqfa"
interface ManagedSecretEscrowRecord {
  id: string;

  requirementId: string;

  encryptedBlobRef: string;

  encryptedDataKey: string;
  kmsKeyRef: string;

  cipher: string;

  version: number;

  fingerprint: string;

  accessPolicyId: string;

  createdAt: string;
  rotatedAt?: string;
}
```

EnvForge 数据库不能直接保存可解密 Secret 的主密钥。

---

# 二十四、长期 Preserve & Restore 策略

Preserve 场景必须逐个 Secret 选择恢复策略。

```ts id="p5sg28"
type ArchiveSecretPolicy =
  | "requirement-only"
  | "external-provider-reference"
  | "encrypted-escrow"
  | "regenerate-on-restore"
  | "user-must-provide"
  | "target-existing";
```

## 默认推荐

| Secret 类型 | 默认策略 |
|---|---|
| 数据库密码 | 外部 Provider 或加密 Escrow |
| Session Secret | Preserve 或 Restore 后轮换，视连续性 |
| 外部 API Key | 外部 Provider / 用户提供 |
| TLS 私钥 | 重新签发优先；必要时 Escrow |
| 数据加密密钥 | 必须确保可恢复，通常 Escrow/HSM |
| Git deploy key | 重新生成 |
| OAuth client secret | 外部 Provider |
| Backup encryption key | 必须长期恢复 |

## Capture Gate

以下情况阻止 `SAFE_TO_RELEASE_SOURCE`：

- 数据加密密钥无恢复方式；
- required Secret 标记 unknown；
- 外部 Provider 未来可用性未确认；
- Escrow 上传未验证；
- regenerate 会导致旧数据不可访问；
- Secret 与 Artifact 的依赖关系不完整。

---

# 二十五、Secret 轮换模型

```ts id="w4o4fa"
interface SecretRotationPlan {
  timing:
    | "before-prepare"
    | "before-startup"
    | "after-cutover"
    | "after-restore"
    | "manual";

  strategy:
    | "provider-native"
    | "generate-and-update-consumers"
    | "dual-secret-overlap"
    | "revoke-and-replace"
    | "manual";

  consumerUpdateActions: string[];

  externalUpdateActions: string[];

  validationCheckIds: string[];

  rollbackCapability:
    | "full"
    | "partial"
    | "manual"
    | "none";
}
```

## 双 Secret 轮换

适用于支持旧、新凭据重叠的系统：

```text id="vif2gd"
生成新 Secret
→ Provider 保存新版本
→ 目标 consumer 使用新版本
→ 验证
→ 切换外部系统
→ 撤销旧 Secret
```

## 非重叠轮换

可能需要停机，必须纳入 Cutover。

---

# 二十六、SecretRotationRecord

```ts id="d3kel5"
interface SecretRotationRecord {
  id: string;

  secretRequirementId: string;

  oldVersionFingerprint?: string;
  newVersionFingerprint?: string;

  providerType: SecretProviderType;

  state:
    | "started"
    | "consumer-updated"
    | "validated"
    | "old-revoked"
    | "completed"
    | "failed";

  rollbackAvailable: boolean;

  createdAt: string;
  completedAt?: string;
}
```

不保存旧值或新值。

---

# 二十七、Secret 验证模型

验证不能通过输出 Secret 判断。

```ts id="pf8nj4"
interface SecretValidationPlan {
  checks: SecretValidationCheck[];

  successPolicy: "all-required";
}
```

## 验证类型

```ts id="y3dp9i"
type SecretValidationCheck =
  | {
      type: "target-reference-exists";
      targetReference: string;
    }
  | {
      type: "permissions";
      expectedOwner?: string;
      expectedMode?: string;
    }
  | {
      type: "consumer-startup";
      componentId: string;
    }
  | {
      type: "authenticated-connection";
      dependencyId: string;
    }
  | {
      type: "provider-fingerprint";
      expectedFingerprint?: string;
    }
  | {
      type: "certificate-key-match";
      certificateRef: string;
    }
  | {
      type: "custom-capability-check";
      capabilityCheckId: string;
    };
```

## 示例

数据库密码验证：

```text id="ksv96x"
应用使用 Secret 连接 PostgreSQL
→ 成功执行只读查询
```

不是：

```text id="hm2rgz"
在日志中打印 DATABASE_PASSWORD
```

---

# 二十八、Secret Cleanup

```ts id="40v7s3"
interface SecretCleanupPlan {
  memoryCleanupRequired: boolean;

  temporaryFileCleanup: {
    required: boolean;
    paths: string[];
    secureDeleteRequired: boolean;
  };

  revokeLeaseAfterUse: boolean;

  removeInputSession: boolean;

  cleanupVerificationRequired: boolean;
}
```

## Cleanup 原则

- 内存 Buffer 使用后覆盖，尽管不能保证所有运行时复制；
- 临时文件使用 tmpfs 优先；
- 删除后确认文件不存在；
- Vault 动态 Lease 用后 revoke；
- 一次性输入 Session 标记 consumed；
- Worker 崩溃时 Recovery Coordinator 处理遗留临时材料。

---

# 二十九、Secret 崩溃恢复

Worker 崩溃后必须判断：

- Secret 是否已解析；
- Lease 是否仍有效；
- 是否已注入；
- 临时文件是否存在；
- consumer 是否已启动；
- Secret 是否已轮换；
- 旧 Secret 是否已撤销。

## 恢复规则

### 仅解析未注入

销毁 Handle，重新解析。

### 已注入但未验证

检查目标引用和 consumer 状态，再决定：

- 标记已注入；
- 重新注入；
- block。

### 已轮换但 consumer 未更新

进入高优先级恢复，不能重新生成另一个 Secret。

### 旧 Secret 已撤销

不能普通 rollback，必须完成新 Secret 更新或人工修复。

---

# 三十、Secret Rollback

Secret 回滚通常比文件回滚复杂。

```ts id="2pylms"
interface SecretRollbackPlan {
  classification:
    | "full"
    | "partial"
    | "manual"
    | "none";

  restorePreviousMaterialization: boolean;

  previousProviderVersionRef?: string;

  revokeNewSecret: boolean;

  restartConsumerActions: string[];

  validationCheckIds: string[];

  irreversibleRisks: string[];
}
```

## 可以完整回滚

- 目标新建 env 文件；
- Provider 保留旧版本；
- 旧 Secret 仍有效；
- consumer 可以重新加载。

## 不能完整回滚

- 旧 Secret 已撤销；
- 外部服务不支持旧凭据恢复；
- Secret 已经被多方使用；
- rotate 后产生了无法撤销的状态；
- 新加密密钥已经加密数据。

---

# 三十一、共享 Secret

一个 Secret 可能被多个 Workload 消费。

例如：

- 共享数据库密码；
- SMTP API key；
- 对象存储 key；
- wildcard TLS 私钥。

必须显式建模：

```ts id="5lovq8"
interface SharedSecretRequirement {
  secretRequirementId: string;

  owner:
    | {
        type: "workload";
        workloadId: string;
      }
    | {
        type: "workspace";
      }
    | {
        type: "external";
      };

  consumerWorkloadIds: string[];

  rotationCoupling:
    | "all-consumers-together"
    | "versioned-overlap"
    | "independent"
    | "manual";
}
```

不能让多个 Plan 各自轮换同一个共享 Secret。

需要资源锁：

```text id="xs0190"
secret:<provider>:<secret-ref>
```

---

# 三十二、Secret 版本与 Drift

Provider Secret 变化后，Blueprint 通常不变，但 Binding 状态发生 Drift。

```ts id="ow9c6c"
type SecretDrift =
  | "provider-version-changed"
  | "provider-reference-missing"
  | "lease-expired"
  | "target-reference-changed"
  | "fingerprint-mismatch"
  | "consumer-access-failed";
```

## 处理

### 非绑定版本

如：

```text id="nmxjx8"
use latest
```

Apply 前必须解析实际版本，并记录到 Run。

### 固定版本

版本不存在时：

```text id="nvz6me"
blocked
```

### Material Drift

若 Plan Approval 明确绑定 Secret Version，版本变化使 Approval 失效。

若 Approval 只绑定逻辑引用和轮换策略，版本变化可允许，但必须记录。

此策略必须在 Approval Policy 中明确。

---

# 三十三、脱敏 Redaction Engine

Secret Engine 必须提供统一 Redaction Pipeline。

不能由各 Adapter 自行决定。

## 输入来源

需要脱敏：

- stdout；
- stderr；
- command preview；
- exception；
- API request；
- worker event；
- report；
- verification evidence；
- support bundle。

## Redaction 策略

```ts id="aq1zcw"
interface RedactionPolicy {
  exactSecretFingerprintRefs: string[];

  knownKeyPatterns: string[];

  structuredFieldNames: string[];

  entropyDetection: boolean;

  privateKeyDetection: boolean;

  connectionStringDetection: boolean;

  replacement: string;

  maximumUnredactedBufferBytes: number;
}
```

## 多层处理

```text id="ld29ld"
结构化字段删除
→ 已知 Secret 精确替换
→ connection string 解析
→ PEM/private key 检测
→ 高熵 Token 检测
→ 长度截断
```

## 注意

Redaction 不是保存明文后再处理的借口。

首要原则仍是：

```text id="82fqhp"
尽量不产生 Secret 输出
```

---

# 三十四、命令执行安全

禁止生成：

```bash id="fbslbq"
export PASSWORD=secret
echo secret > file
command --password secret
```

因为可能进入日志和 process list。

优先：

- stdin；
- file descriptor；
- protected file；
- systemd credential；
- provider integration；
- environment with logging disabled。

如果 Capability 只能使用命令行参数：

- 标记 high risk；
- 用户批准；
- worker 禁止记录完整命令；
- 进程检查；
- 执行后验证泄漏面。

---

# 三十五、Secret Gate

```ts id="qzi0ju"
interface SecretGate {
  id: string;

  secretRequirementId: string;

  stage: string;

  state:
    | "pending"
    | "available"
    | "blocked"
    | "expired";

  blocking: boolean;

  explanation: string;
}
```

Run 进入某 Stage 前：

```text id="zp8ktz"
检查 required Secret Gates
```

若 unavailable：

```text id="4e3swf"
WAITING(secret-input)
或
BLOCKED(provider-unavailable)
```

---

# 三十六、模式差异

## Build

需要：

- 新 Secret；
- target-existing；
- regenerate；
- user-input；
- Vault/SOPS。

不需要：

- 源 Secret 连续性，除非用户导入历史配置。

## Migration

需要判断：

- 是否必须保留原值；
- 是否可以轮换；
- 源目标是否允许重叠；
- Cutover 时哪个 Secret 生效；
- 外部系统是否需要同时更新。

## Capture

必须保存：

- Requirement；
- Provider Strategy；
- Restore Availability；
- 高风险 Secret 连续性；
- 可选加密 Escrow。

不能只保存 fingerprint 后就认为未来可恢复。

## Restore

需要：

- 重新验证 Provider；
- 获取 Secret；
- 必要时 regenerate；
- 必要时执行轮换；
- 验证 consumer；
- 如果 Archive 使用加密数据，必须先获取解密密钥。

---

# 三十七、Secret Readiness Gate

## 所有模式共同要求

- required Secret 有 Requirement；
- consumer 已识别；
- 注入方法已定义；
- 验证方法已定义；
- Secret 明文不在 Blueprint/Plan；
- Provider 类型被允许。

## Build Planner-ready

- Binding 可以在执行前补充；
- 但批准前 required Binding 必须有效。

## Migration Planner-ready

- continuity policy 已确定；
- preserve/rotate 决策已确定；
- shared Secret 轮换耦合已解决；
- Cutover Secret 时序明确。

## Capture Planner-ready

- 每个 required Restore Secret 有未来可用策略；
- 数据解密类 Secret 不得 unknown；
- Escrow 或外部 Provider 可验证；
- 用户输入策略必须明确未来责任。

## Restore Planner-ready

- Archive 解密 Secret 可获得；
- required Provider 可用；
- 目标注入方式兼容；
- 必要轮换已规划。

---

# 三十八、Secret Provider 配置安全

Provider 配置本身也可能包含凭据。

建议将 Provider Credential 分为：

```text id="o0hksk"
Control-plane Credential
Workload Secret
```

例如 Vault Token 是 Control-plane Credential。

必须：

- 独立保存；
- 最小权限；
- 有效期；
- 自动轮换；
- 不进入 Workload Archive；
- 不能被普通项目用户查看；
- 每次访问有审计。

---

# 三十九、权限模型

建议权限：

```ts id="k0bh7w"
type SecretPermission =
  | "secret-requirement-view"
  | "secret-binding-create"
  | "secret-binding-change"
  | "secret-supply"
  | "secret-provider-admin"
  | "secret-rotate"
  | "secret-revoke"
  | "secret-escrow-create"
  | "secret-escrow-recover";
```

能查看 Workload 不代表能提供或恢复 Secret。

Escrow Recover 建议要求：

- 多人审批；
- break-glass reason；
- 强审计。

---

# 四十、Secret Audit Event

```ts id="epf38s"
interface SecretAuditEvent {
  id: string;

  projectId: string;
  executionRunId?: string;

  secretRequirementId: string;

  type:
    | "requirement-created"
    | "binding-created"
    | "binding-validated"
    | "resolution-started"
    | "resolution-succeeded"
    | "resolution-failed"
    | "materialized"
    | "injected"
    | "validated"
    | "rotated"
    | "revoked"
    | "cleaned"
    | "escrow-created"
    | "escrow-accessed";

  providerType?: SecretProviderType;

  actorId: string;

  metadata: Record<string, unknown>;

  occurredAt: string;
}
```

metadata 禁止包含：

- Secret 值；
- 完整 decrypted document；
- 可用 Token；
- 私钥。

---

# 四十一、数据库持久化建议

```text id="jc3899"
secret_requirements
secret_provider_bindings
secret_provider_configs

secret_execution_contracts
secret_delivery_runs
secret_resolutions
secret_materializations

secret_validation_results
secret_rotation_records

secret_input_sessions
secret_gates
secret_audit_events

managed_secret_escrow_records
```

Secret 值不进入普通数据库表。

---

# 四十二、API 建议

```text id="wvbxax"
GET  /projects/:projectId/secret-requirements
POST /projects/:projectId/secret-bindings
POST /secret-bindings/:bindingId/validate

GET  /runs/:runId/secret-gates
POST /runs/:runId/secrets/:requirementId/input-session
POST /secret-input-sessions/:sessionId/submit

POST /runs/:runId/secrets/:requirementId/retry
POST /runs/:runId/secrets/:requirementId/rotate
POST /runs/:runId/secrets/:requirementId/revoke
```

Secret 提交接口需要：

- no-store；
- 禁止访问日志；
- 特殊 body handling；
- 一次性 Token；
- 限速。

---

# 四十三、UI 建议

用户看到：

```text id="4ykw65"
DATABASE_PASSWORD
用途：博客连接 PostgreSQL
状态：需要绑定
迁移要求：必须保留或同时更新数据库密码
推荐：从 Vault 获取
注入：systemd credential
验证：应用可连接数据库
```

不能显示：

```text id="8u44ha"
当前值：********
```

即使打星也不应提供“查看”按钮。

## Run 阶段

```text id="s4th22"
正在等待 1 个 Secret

SESSION_SECRET
方式：执行时输入
用途：保持现有登录 Session
不提供的影响：所有现有 Session 失效
```

---

# 四十四、黄金场景

个人博客：

```text id="dbz6od"
DATABASE_PASSWORD
SESSION_SECRET
TLS_PRIVATE_KEY
SMTP_API_KEY
```

## DATABASE_PASSWORD

- preserve 或 rotate；
- Provider：Vault/User Input；
- 注入：systemd credential/env file；
- 验证：应用连接 PostgreSQL。

## SESSION_SECRET

- 用户选择 preserve 或 regenerate；
- regenerate 会使现有 Session 失效；
- 风险必须显示。

## TLS_PRIVATE_KEY

- 推荐目标重新签发；
- 如果必须保留，使用 SOPS/Escrow；
- 验证 certificate-key match。

## SMTP_API_KEY

- 外部 Provider；
- 验证发送到测试地址或 API auth；
- 避免真实发送副作用。

---

# 四十五、MVP 范围

## 首期必须支持

- SecretRef；
- SecretRequirement；
- Provider Binding；
- User Input；
- Target Existing；
- Regenerate；
- Vault；
- SOPS；
- Out-of-band Gate；
- environment-file；
- systemd credential；
- protected file；
- Docker/Compose secret；
- validation；
- cleanup；
- unified redaction；
- Run secret gate；
- Capture recovery policy。

## 首期可暂缓

- EnvForge Managed Escrow；
- 多 KMS；
- HSM；
- 云厂商全部 Secret Manager；
- 自动跨系统轮换；
- 动态数据库账号；
- 多方计算；
- 零知识托管；
- 自动 Secret 泄漏扫描全仓库。

---

# 四十六、核心不变量

1. SecretRef 是证据，不是可恢复 Secret。
2. Blueprint 只保存 SecretRequirement，不保存值。
3. Provider Binding 属于 DecisionSet。
4. Plan 只保存 SecretExecutionContract 和逻辑引用。
5. Run 时按需解析 Secret。
6. Secret 值不得进入 Snapshot、Plan、Checkpoint、Event、Report 或普通日志。
7. required Secret 不可用时必须阻塞。
8. Secret 输入不能通过普通表单日志链处理。
9. Provider 必须返回受控 SecretHandle，而不是普通字符串。
10. Secret Materialization 必须可审计但不能暴露内容。
11. 注入后必须验证 consumer 可用。
12. 临时材料必须清理。
13. Vault 动态 Secret 必须处理 Lease、Renew 和 Revoke。
14. Regenerate 只能用于允许重新生成的 Secret。
15. 加密数据密钥丢失必须成为 Capture Hard Blocker。
16. Shared Secret 轮换必须协调所有消费者。
17. Rotation 必须记录版本 fingerprint，但不记录值。
18. 旧 Secret 已撤销后不能宣称完整回滚。
19. Out-of-band 步骤必须有机器可验证证据。
20. Preserve 默认保存 Requirement 和 Provider Ref，不默认保存明文。
21. Managed Escrow 必须显式启用并使用独立 KMS。
22. Provider Credential 与 Workload Secret 必须分离。
23. Redaction 必须统一，不由 Adapter 各自实现。
24. 命令参数默认禁止携带 Secret。
25. Secret Report 只能显示策略、Provider 类型、交付状态和验证结果。

下一步应确定 **Cutover Engine、流量切换与业务验证模型**，包括 maintenance window、drain、quiesce、DNS/Nginx/LB 切换、Observation、Commit、目标新写入检测和安全回滚。

## Prompt:
2026/7/18 22:19:41

确定 Cutover Engine、流量切换与业务验证模型

## Response:
2026/7/18 22:19:44

这一轮我会把 Cutover 拆成“准备、排空、冻结、最终同步、激活、切流、业务验证、观察、提交、回滚”十个阶段，并明确 DNS、反向代理、LB、源目标双写风险以及验证失败后的处理边界。

> **更新设计方案并引用文件段落**
>
>
> **更新设计方案、计算文件引用并生成审计报告**
>
> 
>
> 思考了 1m 11s

当前审计确认 EnvForge 尚无正式 Cutover 对象、drain、quiesce、final sync、流量切换、Observation、Commit 与数据/流量回滚状态机，现有命令级验证也不足以证明业务可用。因此 Cutover 必须建设为迁移执行中的独立安全子系统，而不是在 Action 列表末尾追加几个命令。`8bead08a-b983-4703-97e2-6580c02aff9c.md`

**document: **

# EnvForge Cutover Engine、流量切换与业务验证模型

## 一、Cutover Engine 的核心定义

Cutover Engine 负责：

> 在源业务仍然运行的前提下，安全撤销源端写入权，完成最终数据同步，在目标端恢复业务运行，切换用户流量，验证业务真实性，并在观察期后决定 Commit 或 Rollback。

完整过程：

```text
目标准备完成
→ 预切换验证
→ 等待维护窗口
→ 排空请求和任务
→ 撤销源端写入权
→ 最终同步
→ 目标被动激活
→ 授予目标写入权
→ 切换流量
→ 业务验证
→ 观察窗口
→ Commit 或 Rollback
```

Cutover 不等于：

- 启动目标服务；
- 修改 DNS；
- Nginx reload；
- 目标返回 HTTP 200；
- 数据传输完成。

Cutover 的完成条件是：

```text
目标成为唯一权威运行环境
+
所有 required Dataset 已提交
+
所有 required Business Verification 已通过
+
Observation Window 已满足
+
Commit Record 已写入
```

---

# 二、Cutover 只属于哪些模式

## Live Migration

必须使用完整 Cutover Engine：

- source drain；
- source quiesce；
- final sync；
- target authority；
- traffic switch；
- observation；
- rollback。

## Restore

通常没有源服务器，因此不需要完整 source cutover。

但可能使用：

```text
Activation + Traffic Enable + Business Verification
```

例如恢复完成后修改 DNS。

## Build

只使用：

```text
Activation + Initial Traffic Enable
```

不叫 Migration Cutover。

## Capture

不切换流量，只使用：

```text
Quiesce + Final Capture + Source Resume
```

因此需要复用 Quiesce Engine，但不使用 Traffic Switch。

---

# 三、Cutover 的核心安全不变量

必须正式确定以下不变量：

1. 同一业务在任意时刻只能有一个权威写入端。
2. Final Sync 必须发生在源端写入被停止或受控之后。
3. 目标端在 Final Sync 完成前不得接受业务写入。
4. Traffic Switch 不等于 Cutover Commit。
5. 所有 required Dataset Commit 必须先于业务 Commit。
6. required Verification 失败时不得 Commit。
7. 源端进入 quiesced 后，不允许普通暂停或直接取消。
8. 目标端产生新写入后，Rollback 必须先进行数据协调。
9. 当前流量指向必须始终可以通过机器证据确定。
10. 每次 Cutover 必须保存源、目标和流量的 before-state。
11. 无法证明单写状态时必须阻塞，不得继续。
12. DNS 切换不能被描述为绝对原子。
13. 人工切换必须有机器验证，不能只依赖用户点击“完成”。
14. Commit 只能成功一次。
15. Commit 后原源端不再自动视为可直接恢复。

---

# 四、核心领域对象

Cutover 子系统需要以下核心对象：

| 对象 | 作用 |
|---|---|
| CutoverContract | Plan 中不可变的切换执行合同 |
| CutoverRun | 某次真实切换实例 |
| MaintenanceWindow | 允许执行高风险步骤的时间窗口 |
| DrainPlan | 如何停止接收新工作并等待进行中工作 |
| QuiescePlan | 如何撤销源端写入能力 |
| WriteAuthorityRecord | 当前谁拥有业务写入权 |
| TrafficSwitchContract | 流量如何从源切到目标 |
| TrafficProviderBinding | 使用哪个 DNS、代理或 LB Provider |
| BusinessVerificationContract | 什么结果证明业务成功 |
| ObservationPolicy | 切换后观察什么、多久 |
| CutoverCheckpoint | 关键恢复点 |
| CutoverCommitRecord | 不可变提交证据 |
| CutoverRollbackPlan | 如何安全回切 |

---

# 五、CutoverContract

```ts
interface CutoverContract {
  id: string;

  planRevisionId: string;
  projectId: string;

  workloadIds: string[];

  sourceEndpointId: string;
  targetEndpointId: string;

  maintenanceWindow: MaintenanceWindow;

  downtimeBudget: DowntimeBudget;

  preconditions: CutoverPrecondition[];

  drainPlan: DrainPlan;

  quiescePlan: QuiescePlan;

  requiredDatasetContractIds: string[];

  targetActivationPlan: TargetActivationPlan;

  writeAuthorityPlan: WriteAuthorityPlan;

  trafficSwitchContracts: TrafficSwitchContract[];

  businessVerificationContract: BusinessVerificationContract;

  observationPolicy: ObservationPolicy;

  commitPolicy: CutoverCommitPolicy;

  rollbackPlan: CutoverRollbackPlan;

  recoveryPolicy: CutoverRecoveryPolicy;

  gates: CutoverGate[];

  riskSummary: CutoverRisk[];

  contractHash: string;
}
```

CutoverContract 属于 Plan Revision。

生成后不可修改。

维护时间、流量 Provider、回滚期限等变化，都必须生成新的 Plan Revision。

---

# 六、CutoverRun

```ts
interface CutoverRun {
  id: string;

  executionRunId: string;
  cutoverContractId: string;

  state: CutoverRunState;

  currentPhase: CutoverPhase;

  sourceAuthorityState: WriteAuthorityState;
  targetAuthorityState: WriteAuthorityState;

  trafficState: TrafficState;

  checkpointIds: string[];

  datasetCommitIds: string[];

  verificationRunIds: string[];

  targetWriteMonitorId?: string;

  commitRecordId?: string;
  rollbackRunId?: string;

  enteredCriticalSectionAt?: string;

  rollbackDeadline?: string;

  startedAt?: string;
  completedAt?: string;

  outcome?: CutoverOutcome;
}
```

---

# 七、Cutover 状态机

```ts
type CutoverRunState =
  | "pending"
  | "preparing"
  | "ready"
  | "waiting-window"
  | "draining"
  | "quiescing"
  | "source-quiesced"
  | "final-syncing"
  | "target-activating"
  | "granting-target-authority"
  | "traffic-switching"
  | "traffic-switched"
  | "business-verifying"
  | "observing"
  | "commit-pending"
  | "committing"
  | "committed"
  | "rollback-required"
  | "rolling-back"
  | "rolled-back"
  | "partially-rolled-back"
  | "blocked"
  | "failed";
```

正常路径：

```text
PENDING
→ PREPARING
→ READY
→ WAITING_WINDOW
→ DRAINING
→ QUIESCING
→ SOURCE_QUIESCED
→ FINAL_SYNCING
→ TARGET_ACTIVATING
→ GRANTING_TARGET_AUTHORITY
→ TRAFFIC_SWITCHING
→ TRAFFIC_SWITCHED
→ BUSINESS_VERIFYING
→ OBSERVING
→ COMMIT_PENDING
→ COMMITTING
→ COMMITTED
```

失败分支：

```text
任何关键阶段
→ ROLLBACK_REQUIRED
→ ROLLING_BACK
→ ROLLED_BACK / PARTIALLY_ROLLED_BACK
```

---

# 八、Cutover Phase 与 Critical Section

```ts
type CutoverPhase =
  | "pre-cutover"
  | "drain"
  | "quiesce"
  | "final-sync"
  | "target-activation"
  | "authority-transfer"
  | "traffic-switch"
  | "business-verification"
  | "observation"
  | "commit"
  | "rollback";
```

## Critical Section 起点

建议从以下状态开始：

```text
SOURCE_QUIESCED
```

一旦进入 Critical Section：

- 业务可能已停止写入；
- 普通暂停被禁止；
- 普通取消转化为 Rollback；
- Worker 崩溃需要最高优先级恢复；
- 系统必须持续显示停机时间；
- 不能等待普通低优先级任务。

Critical Section 结束于：

```text
COMMITTED
或
SOURCE 恢复并验证通过
```

---

# 九、MaintenanceWindow

```ts
interface MaintenanceWindow {
  timezone: string;

  earliestStart: string;
  latestStart: string;

  maximumDurationSeconds: number;

  expectedDurationSeconds?: number;

  hardStopAt?: string;

  operatorPresence:
    | "not-required"
    | "required-at-start"
    | "required-through-commit";

  automaticStartAllowed: boolean;

  automaticRollbackAllowed: boolean;

  blackoutPeriods: TimeRange[];

  changeFreezePolicy?: string;
}
```

## 窗口 Gate

进入 Drain 前必须重新确认：

- 当前时间在窗口内；
- 预计剩余时间不超过 hard stop；
- 必要用户在线；
- 目标预验证仍有效；
- Secret 仍可用；
- Rollback 能力仍有效；
- 网络和目标容量没有变化。

如果预计停机已经超过预算：

```text
BLOCKED
reason = downtime-budget-at-risk
```

由用户决定：

- 延长窗口；
- 更换策略；
- 取消本次 Cutover；
- 接受风险并重新审批。

---

# 十、DowntimeBudget

```ts
interface DowntimeBudget {
  maximumSeconds: number;

  warningThresholdSeconds: number;

  abortThresholdSeconds?: number;

  estimatedComponents: {
    drainSeconds?: number;
    quiesceSeconds?: number;
    finalSyncSeconds?: number;
    activationSeconds?: number;
    switchSeconds?: number;
    verificationSeconds?: number;
  };

  exceedPolicy:
    | "continue"
    | "require-confirmation"
    | "rollback";
}
```

停机计时从源端不再正常接受写入开始。

不能把 Initial Sync 计入停机。

UI 应实时显示：

```text
当前停机：2 分 18 秒
预算：8 分钟
预计剩余：3-5 分钟
```

---

# 十一、Pre-Cutover Preconditions

```ts
interface CutoverPrecondition {
  id: string;

  type:
    | "source-healthy"
    | "target-healthy"
    | "dataset-initial-sync-complete"
    | "dataset-final-sync-ready"
    | "secret-available"
    | "rollback-ready"
    | "traffic-provider-available"
    | "dns-ttl-prepared"
    | "capacity"
    | "clock-synchronized"
    | "operator-present"
    | "external-dependency-available"
    | "no-conflicting-run";

  required: boolean;

  checkId: string;

  maximumAgeSeconds: number;
}
```

切换前检查结果不能无限复用。

例如目标预验证在两小时前完成，进入维护窗口时需要重新执行关键检查。

---

# 十二、Drain 与 Quiesce 的边界

## Drain

Drain 的含义是：

> 不再接受新的工作，但允许已经开始的工作完成。

适用于：

- HTTP 请求；
- 长连接；
- WebSocket；
- worker queue；
- 定时任务；
- 后台 job；
- 负载均衡连接。

## Quiesce

Quiesce 的含义是：

> 停止产生会影响最终一致性的新的持久写入。

适用于：

- 应用数据库写入；
- 文件上传；
- queue publish；
- cron 数据更新；
- 后台 worker；
- 数据库事务。

Drain 可以先于 Quiesce。

Quiesce 后通常仍可提供：

- 维护页面；
- 只读访问；
- 健康检查。

---

# 十三、DrainPlan

```ts
interface DrainPlan {
  mechanisms: DrainMechanism[];

  maximumDrainSeconds: number;

  activeWorkChecks: ActiveWorkCheck[];

  completionPolicy:
    | "all-zero"
    | "below-threshold"
    | "timeout-and-force"
    | "manual";

  timeoutPolicy:
    | "abort-cutover"
    | "force-terminate"
    | "require-confirmation";

  forceTerminationActions: string[];

  verificationCheckIds: string[];
}
```

## DrainMechanism

```ts
type DrainMechanism =
  | {
      type: "reverse-proxy-remove-source";
      providerBindingId: string;
    }
  | {
      type: "maintenance-mode";
      actionId: string;
    }
  | {
      type: "application-hook";
      actionId: string;
    }
  | {
      type: "queue-consumer-pause";
      actionId: string;
    }
  | {
      type: "scheduler-disable";
      actionId: string;
    }
  | {
      type: "service-signal";
      signal: string;
    }
  | {
      type: "manual";
      manualStepId: string;
    };
```

## ActiveWorkCheck

```ts
interface ActiveWorkCheck {
  id: string;

  type:
    | "http-active-requests"
    | "tcp-connections"
    | "websocket-connections"
    | "queue-active-jobs"
    | "database-active-transactions"
    | "application-active-jobs"
    | "custom";

  targetComponentId: string;

  successThreshold: number;

  stableForSeconds: number;

  required: boolean;
}
```

不能只等待固定 30 秒后假设排空成功。

---

# 十四、QuiescePlan

```ts
interface QuiescePlan {
  writerComponentIds: string[];

  mechanisms: QuiesceMechanism[];

  verificationChecks: QuiesceVerificationCheck[];

  maximumSeconds: number;

  failurePolicy:
    | "resume-source"
    | "retry"
    | "manual"
    | "abort";

  sourceResumeActions: string[];
}
```

## QuiesceMechanism

```ts
type QuiesceMechanism =
  | "application-read-only"
  | "maintenance-mode"
  | "stop-service"
  | "pause-worker"
  | "disable-scheduler"
  | "database-read-only"
  | "filesystem-freeze"
  | "application-checkpoint"
  | "manual";
```

## Quiesce 验证

至少确认：

- writer service 已停止或只读；
- 活动事务低于阈值；
- queue consumer 已暂停；
- cron/timer 已禁用；
- 文件写入已停止；
- source authority 已撤销。

---

# 十五、写入权模型

迁移中的核心不是“哪个服务正在运行”，而是：

> 当前哪个环境被允许产生权威业务写入？

引入：

```ts
type WriteAuthorityHolder =
  | "source"
  | "target"
  | "none"
  | "unknown";
```

```ts
interface WriteAuthorityRecord {
  id: string;

  cutoverRunId: string;

  workloadId: string;

  holder: WriteAuthorityHolder;

  epoch: number;

  fencingMethod:
    | "service-stopped"
    | "read-only-mode"
    | "database-role"
    | "network-isolation"
    | "queue-paused"
    | "application-token"
    | "manual";

  evidenceArtifactIds: string[];

  grantedAt: string;

  revokedAt?: string;
}
```

## Authority 转移过程

```text
SOURCE authority
→ revoke source
→ NONE
→ final sync
→ activate target in controlled mode
→ grant target authority
→ TARGET authority
```

不能出现：

```text
SOURCE authority + TARGET authority
```

除非 Capability 明确支持：

- 双写；
- 多主；
- replication；
- conflict resolution。

普通 VPS 应用默认禁止双写。

---

# 十六、WriteAuthorityPlan

```ts
interface WriteAuthorityPlan {
  initialHolder: "source";

  sourceRevokeActions: string[];
  sourceRevokeVerificationIds: string[];

  targetGrantActions: string[];
  targetGrantVerificationIds: string[];

  rollbackSourceGrantActions: string[];

  splitBrainDetectionChecks: string[];

  authorityTimeoutSeconds: number;
}
```

如果不能可靠证明源端写入被撤销：

```text
Cutover blocked
```

---

# 十七、Final Sync Gate

进入 Final Sync 前必须满足：

- source authority = none；
- writer 已 quiesced；
- required consistency checkpoint 有效；
- target 未获得写入权；
- initial sync baseline 有效；
- Dataset resource lock 已取得。

Final Sync 完成后，每个 required Dataset 必须生成：

```text
DatasetCommitRecord
```

Cutover 不允许跳过未提交的 required Dataset。

---

# 十八、TargetActivationPlan

目标激活需要区分三种模式：

```ts
type TargetActivationMode =
  | "passive"
  | "read-only"
  | "active";
```

## Passive

- 服务依赖安装完成；
- 业务进程可启动或保持停止；
- 不接受流量；
- 不运行 scheduler；
- 不产生业务写入。

## Read-only

- 可以做读取验证；
- 不允许业务写入；
- 可通过内部 Endpoint 预验证。

## Active

- 目标获得写入权；
- 后台任务允许运行；
- 可以接受生产流量。

```ts
interface TargetActivationPlan {
  passiveStartActionIds: string[];

  preAuthorityVerificationIds: string[];

  grantAuthorityActionIds: string[];

  activeStartActionIds: string[];

  schedulerEnableActionIds: string[];

  failureCleanupActionIds: string[];
}
```

目标服务如果在启动时自动写入数据库，必须：

- 延迟启动；
- 使用 read-only/maintenance 模式；
- 或在 Final Sync 后才启动。

---

# 十九、TrafficSwitchContract

```ts
interface TrafficSwitchContract {
  id: string;

  workloadId: string;
  endpointContractId: string;

  routeIdentity: TrafficRouteIdentity;

  providerBindingId: string;

  strategy:
    | "all-at-once"
    | "weighted"
    | "canary"
    | "manual";

  sourceDestination: TrafficDestination;
  targetDestination: TrafficDestination;

  preSwitchStateCapture: boolean;

  prepareActions: string[];
  switchActions: string[];
  verifyActions: string[];
  rollbackActions: string[];

  stabilizationPolicy: TrafficStabilizationPolicy;

  expectedPropagationSeconds?: number;

  rollbackDeadlineSeconds?: number;

  resourceLockKey: string;
}
```

---

# 二十、TrafficRouteIdentity

```ts
type TrafficRouteIdentity =
  | {
      type: "dns-record";
      zone: string;
      name: string;
      recordType: "A" | "AAAA" | "CNAME";
    }
  | {
      type: "reverse-proxy-route";
      proxyEndpointId: string;
      routeName: string;
    }
  | {
      type: "load-balancer-backend";
      loadBalancerId: string;
      poolId: string;
    }
  | {
      type: "floating-ip";
      address: string;
    }
  | {
      type: "cdn-origin";
      provider: string;
      zoneId: string;
    }
  | {
      type: "manual";
      description: string;
    };
```

每条 route 都必须有独立资源锁，防止多个 Run 并发修改。

---

# 二十一、Traffic Provider 接口

```ts
interface TrafficProvider {
  type: TrafficProviderType;

  inspectRoute(
    binding: TrafficProviderBinding,
    route: TrafficRouteIdentity
  ): Promise<TrafficRouteSnapshot>;

  prepare(
    contract: TrafficSwitchContract
  ): Promise<TrafficPrepareResult>;

  applySwitch(
    contract: TrafficSwitchContract,
    expectedBeforeStateHash: string
  ): Promise<TrafficApplyResult>;

  verifySwitch(
    contract: TrafficSwitchContract
  ): Promise<TrafficVerificationResult>;

  rollback(
    contract: TrafficSwitchContract,
    beforeState: TrafficRouteSnapshot
  ): Promise<TrafficRollbackResult>;
}
```

## 支持类型

```ts
type TrafficProviderType =
  | "nginx"
  | "haproxy"
  | "traefik"
  | "dns"
  | "cloud-load-balancer"
  | "cloudflare"
  | "floating-ip"
  | "manual"
  | "custom";
```

---

# 二十二、TrafficProviderBinding

```ts
interface TrafficProviderBinding {
  id: string;

  providerType: TrafficProviderType;

  providerConfigRef: string;

  authorityScope: string[];

  capabilities: {
    inspect: boolean;
    prepare: boolean;
    atomicSwitch: boolean;
    weightedRouting: boolean;
    rollback: boolean;
    propagationObservation: boolean;
  };

  status:
    | "unvalidated"
    | "valid"
    | "invalid"
    | "unavailable";
}
```

Provider Credential 属于控制面凭据，不能进入 Plan 明文。

---

# 二十三、流量切换类型

## 1. Nginx/HAProxy upstream 切换

优点：

- 速度快；
- 可验证当前配置；
- 回滚快；
- 适合共享反向代理。

执行：

```text
保存 before config
→ 生成 reviewed config Artifact
→ syntax test
→ atomic replace
→ reload
→ inspect active config
→ endpoint verify
```

适合作为 MVP 自动流量切换方式。

## 2. Load Balancer 后端切换

执行：

```text
注册目标但保持 disabled
→ target health check
→ drain source
→ enable target
→ disable source
→ verify active pool
```

可能支持 connection draining。

## 3. DNS 切换

DNS 不具备严格原子性。

需要提前：

```text
Lower TTL
```

并等待旧 TTL 充分传播。

切换后可能存在：

- 部分用户访问源；
- 部分用户访问目标；
- 本地缓存未更新；
- 递归 DNS 延迟。

因此 DNS Cutover 必须声明：

```text
propagation-based
```

不能显示“流量已全部切换”，只能显示：

```text
权威 DNS 已更新；
外部探针中 X/Y 已解析到目标；
旧缓存仍可能存在。
```

## 4. Floating IP

接近原子，但依赖：

- 云平台；
- 网络配置；
- ARP/NDP 更新；
- IP 可重新绑定。

## 5. 手工切换

首期允许，但需要：

- 结构化步骤；
- before-state；
- expected-state；
- 自动外部验证；
- 回滚说明。

---

# 二十四、DNS 特殊模型

```ts
interface DnsTrafficSwitchPolicy {
  originalTtlSeconds: number;

  preparedTtlSeconds: number;

  ttlLoweredAt?: string;

  minimumPreparationSeconds: number;

  authoritativeVerificationRequired: boolean;

  recursiveResolverProbes: string[];

  propagationSuccessThreshold: number;

  restoreOriginalTtlAfterCommit: boolean;
}
```

## DNS Pre-Cutover

至少在原 TTL 时长之前降低 TTL。

如果未提前降低：

- 不阻止所有迁移；
- 但必须提高风险等级；
- 预计回滚速度不能按新 TTL 计算。

---

# 二十五、流量 before-state

任何流量修改前必须保存：

```ts
interface TrafficRouteSnapshot {
  routeIdentity: TrafficRouteIdentity;

  destinationState: TrafficDestination[];

  providerVersion?: string;

  ttlSeconds?: number;

  healthCheckConfig?: unknown;

  capturedAt: string;

  stateHash: string;
}
```

Rollback 必须引用该 Snapshot。

不能依靠用户记忆恢复旧值。

---

# 二十六、TrafficState

```ts
interface TrafficState {
  authorityState:
    | "source"
    | "target"
    | "mixed"
    | "none"
    | "unknown";

  routeSnapshots: {
    routeContractId: string;

    observedDestination:
      | "source"
      | "target"
      | "mixed"
      | "unknown";

    observedAt: string;

    evidenceArtifactIds: string[];
  }[];

  confidence:
    | "high"
    | "medium"
    | "low";
}
```

`mixed` 对 DNS 传播期是可能的正常状态，但此时：

- 源端不能产生独立权威写入；
- 源端应保持代理到目标、只读或维护模式；
- 否则会产生 split brain。

---

# 二十七、DNS 传播期的源端策略

DNS 切换后旧缓存可能继续访问源。

因此源端不能简单立即关闭所有端口。

建议支持三种策略：

## Source Proxy Forwarding

旧流量到达源后转发到目标。

优点：

- 避免旧用户失败；
- 所有写入仍进入目标。

## Source Maintenance Response

源端返回维护页面或重定向。

适合不能安全代理的场景。

## Source Offline

只有在：

- TTL 已充分准备；
- 用户接受剩余缓存失败；
- 外部验证充分；

时使用。

默认推荐：

```text
DNS propagation window 内 Source Proxy Forwarding
```

---

# 二十八、Weighted 与 Canary 流量

首期建议只正式支持：

```text
all-at-once
```

Canary/Weighted 只有满足以下条件才能启用：

- 源目标共享同一个权威数据层；
- 或应用是只读；
- 或有明确双写/冲突解决机制；
- Session 可跨目标；
- Secret 和版本兼容；
- 数据库 schema 兼容；
- Capability 通过 Canary Certification。

否则加权流量会造成：

- Session 不一致；
- 不兼容写入；
- schema 冲突；
- 文件上传分散；
- queue 重复消费。

---

# 二十九、Business Verification Engine

业务验证回答：

> 用户真实依赖的业务能力是否在目标环境中可用？

它不能只验证：

- 进程存在；
- 端口开放；
- 首页返回任意 200。

需要分层：

```text
Artifact
→ Syntax
→ Runtime
→ Dependency
→ Data
→ Business Transaction
→ External Observation
```

---

# 三十、BusinessVerificationContract

```ts
interface BusinessVerificationContract {
  id: string;

  workloadId: string;

  checks: BusinessVerificationCheck[];

  phases: {
    sourceBaseline: string[];
    targetPreCutover: string[];
    postTrafficSwitch: string[];
    observation: string[];
    final: string[];
  };

  successPolicy: VerificationSuccessPolicy;

  failurePolicy: VerificationFailurePolicy;

  testDataPolicy: VerificationTestDataPolicy;

  vantagePoints: VerificationVantagePoint[];

  contractHash: string;
}
```

---

# 三十一、业务验证阶段

## 1. Source Baseline

切换前记录源端正常行为：

- HTTP 状态；
- 响应内容摘要；
- 数据库关键值；
- 延迟；
- TLS；
- 外部依赖。

用于和目标比较。

不能把源端本身异常误判为目标迁移失败。

## 2. Target Pre-Cutover

在不切换公网流量时验证目标：

- 直接目标 IP；
- Host Header；
- 临时 hosts 映射；
- 内部代理；
- 测试域名；
- LB disabled backend probe。

## 3. Post-Traffic Switch

从外部视角验证实际用户路径：

- 公网 DNS；
- CDN；
- TLS；
- 反向代理；
- 登录；
- 数据读取；
- 受控写入。

## 4. Observation

重复采样：

- 业务成功率；
- 延迟；
- 错误率；
- 服务重启；
- 数据库连接；
- queue backlog。

## 5. Final Verification

Commit 前生成最终验证快照。

---

# 三十二、BusinessVerificationCheck

```ts
interface BusinessVerificationCheck {
  id: string;

  name: string;

  layer:
    | "runtime"
    | "network"
    | "tls"
    | "dependency"
    | "data"
    | "business";

  type:
    | "http-request"
    | "http-transaction"
    | "tcp-connect"
    | "tls-handshake"
    | "database-query"
    | "file-read"
    | "file-write"
    | "queue-roundtrip"
    | "command"
    | "manual";

  required: boolean;

  targetComponentIds: string[];

  executionContext: VerificationExecutionContext;

  definition: VerificationCheckDefinition;

  successCriteria: VerificationSuccessCriteria;

  cleanupDefinition?: VerificationCleanupDefinition;

  sideEffectPolicy:
    | "read-only"
    | "isolated-write"
    | "write-and-cleanup"
    | "manual";

  timeoutSeconds: number;

  retryPolicy: VerificationRetryPolicy;

  secretRequirementIds: string[];

  evidencePolicy: VerificationEvidencePolicy;
}
```

---

# 三十三、验证执行视角

```ts
type VerificationExecutionContext =
  | {
      vantage: "source-local";
    }
  | {
      vantage: "target-local";
    }
  | {
      vantage: "control-plane";
    }
  | {
      vantage: "external-probe";
      probeLocationId: string;
    }
  | {
      vantage: "custom-agent";
      agentId: string;
    };
```

至少需要：

- target-local；
- control-plane 或 external。

只在目标机本地 curl 成功，不能证明公网路径可用。

---

# 三十四、HTTP 验证

```ts
interface HttpVerificationDefinition {
  method: "GET" | "HEAD" | "POST" | "PUT" | "DELETE";

  urlTemplate: string;

  headers: Record<string, string>;

  bodyArtifactRef?: string;

  followRedirects: boolean;

  expectedStatusCodes: number[];

  expectedBodyContains?: string[];

  forbiddenBodyContains?: string[];

  expectedHeaderPatterns?: Record<string, string>;

  maximumLatencyMs?: number;

  tlsValidationRequired: boolean;
}
```

敏感 Header 应引用 SecretRequirement，而不是写入定义。

---

# 三十五、业务合成交易

例如博客：

```text
创建临时草稿
→ 读取草稿
→ 更新草稿
→ 删除草稿
```

应具备：

- 唯一测试 ID；
- 幂等键；
- 隔离命名空间；
- 清理；
- 失败恢复；
- 不影响真实用户数据。

```ts
interface SyntheticTransactionDefinition {
  steps: SyntheticTransactionStep[];

  transactionIdTemplate: string;

  isolationPrefix: string;

  cleanupRequired: boolean;

  cleanupFailurePolicy:
    | "warning"
    | "block"
    | "manual";
}
```

首期可以不支持复杂浏览器 UI，但至少支持：

- HTTP API Transaction；
- 数据库 read/write/delete；
- 文件 write/read/delete。

---

# 三十六、数据库业务验证

验证不应止于：

```text
SELECT 1
```

应分为：

## 连接

- 应用凭据可连接；
- TLS 和认证正确。

## 结构

- required schema/table/extension 存在。

## 数据

- 关键 row count；
- sequence；
- selected checksums；
- source checkpoint 对比。

## 写入

- 测试事务；
- 写入隔离记录；
- 读取；
- rollback 或删除。

数据库写入测试必须发生在：

- 目标已获得写入权；
- 源端已停止写入；
- 测试数据可清理。

---

# 三十七、文件业务验证

例如 uploads：

- 关键文件存在；
- Manifest 一致；
- 应用可读取；
- 应用可创建临时上传；
- 临时上传可下载；
- 测试文件可删除；
- owner/mode 正确。

不能只验证目录存在。

---

# 三十八、Verification Success Policy

```ts
interface VerificationSuccessPolicy {
  requiredChecks: "all";

  optionalFailureBudget?: number;

  maximumConsecutiveFailures?: number;

  minimumExternalProbeSuccessRatio?: number;

  comparisonPolicy?: {
    compareToSourceBaseline: boolean;
    maximumLatencyRegressionPercent?: number;
  };
}
```

required Check 永远不能通过阈值被忽略。

阈值只用于：

- 多个外部探针；
- Observation 采样；
- 可选性能指标。

---

# 三十九、Verification Failure Policy

```ts
interface VerificationFailurePolicy {
  beforeTrafficSwitch:
    | "retry"
    | "block"
    | "abort-cutover";

  afterTrafficSwitch:
    | "retry-within-window"
    | "hold"
    | "auto-rollback"
    | "manual";

  duringObservation:
    | "extend-observation"
    | "rollback"
    | "manual";

  maximumRecoverySeconds: number;

  autoRollbackEligibleFailureTypes: string[];
}
```

自动回滚不能只由 HTTP 500 触发。

必须先判断：

- 是否是外部依赖临时故障；
- 是否所有探针失败；
- 是否目标产生新写入；
- 是否源端仍可恢复；
- 数据回滚是否安全。

---

# 四十、ObservationPolicy

```ts
interface ObservationPolicy {
  minimumDurationSeconds: number;
  maximumDurationSeconds: number;

  samplingIntervalSeconds: number;

  signals: ObservationSignal[];

  successPolicy: ObservationSuccessPolicy;

  failurePolicy: ObservationFailurePolicy;

  extendOnWarning: boolean;

  operatorCommitRequired: boolean;
}
```

## ObservationSignal

```ts
type ObservationSignal =
  | "http-success-rate"
  | "http-latency"
  | "application-error-rate"
  | "service-restarts"
  | "container-health"
  | "database-connections"
  | "database-errors"
  | "queue-backlog"
  | "active-jobs"
  | "disk-growth"
  | "target-write-activity"
  | "external-probe";
```

## 示例

```text
观察 15 分钟
每 30 秒检查一次

要求：
- required business checks 始终通过
- HTTP 成功率 ≥ 99%
- 目标服务无异常重启
- 数据库连接错误为 0
- queue backlog 不持续增长
```

---

# 四十一、Observation 不等于监控平台

EnvForge 首期不需要成为完整 APM。

只需要：

- 可重复执行的业务 Check；
- 基础运行指标；
- 外部探针；
- 明确时间窗口；
- Commit Gate。

复杂长期监控可与外部系统集成。

---

# 四十二、目标新写入检测

流量切换后必须判断目标是否产生新业务状态。

引入：

```ts
interface TargetWriteMonitor {
  id: string;

  cutoverRunId: string;

  datasetMonitors: TargetDatasetWriteMonitor[];

  startedAt: string;

  baselineStateHash: string;

  state:
    | "monitoring"
    | "writes-detected"
    | "no-writes"
    | "unknown"
    | "failed";

  lastObservedAt?: string;
}
```

## 检测方式

### PostgreSQL

- WAL LSN；
- transaction count；
- table modification stats；
- application audit marker；
- test transaction ID。

### 文件数据

- Manifest delta；
- mtime；
- inode change；
- filesystem journal；
- application write log。

### Docker Volume

- 文件 Manifest delta；
- container writer activity。

### Queue

- message offset；
- consumer commit；
- new messages。

---

# 四十三、TargetWriteState

```ts
interface TargetWriteState {
  writesDetected: boolean;

  detectionConfidence:
    | "high"
    | "medium"
    | "low"
    | "unknown";

  affectedDatasetIds: string[];

  firstWriteAt?: string;

  lastWriteAt?: string;

  evidenceArtifactIds: string[];

  reverseReconciliationSupported: boolean;
}
```

如果无法检测目标写入：

```text
Rollback classification 至少降级为 manual/partial
```

不能假设没有新写入。

---

# 四十四、Cutover Commit Policy

```ts
interface CutoverCommitPolicy {
  mode:
    | "automatic"
    | "manual";

  requiredDatasetCommitIds: string[];

  requiredVerificationCheckIds: string[];

  requiredObservationDurationSeconds: number;

  maximumOpenWarnings: number;

  requireNoCriticalAlerts: boolean;

  requireTrafficState:
    | "target"
    | "target-or-dns-propagating";

  requireTargetWriteMonitor: boolean;

  sourceRetentionSeconds: number;

  restoreDnsTtlAfterCommit: boolean;
}
```

---

# 四十五、Commit Gate

Commit 前必须满足：

- target write authority 有效；
- source write authority 已撤销；
- 所有 required Dataset Commit 有效；
- traffic state 符合策略；
- required Verification 全部通过；
- Observation 满足；
- rollback 状态已重新计算；
- 没有 Critical Warning；
- Commit Approval 仍有效。

---

# 四十六、CutoverCommitRecord

```ts
interface CutoverCommitRecord {
  id: string;

  cutoverRunId: string;
  planRevisionId: string;
  planHash: string;

  workloadIds: string[];

  datasetCommitIds: string[];

  verificationSnapshotHash: string;

  trafficStateHash: string;

  sourceAuthorityRecordId: string;
  targetAuthorityRecordId: string;

  targetWriteStateHash: string;

  committedBy:
    | {
        type: "user";
        userId: string;
      }
    | {
        type: "policy";
        policyId: string;
      };

  rollbackClassificationAfterCommit:
    | "full"
    | "partial"
    | "manual"
    | "none";

  sourceRetentionUntil?: string;

  irreversibleActionIds: string[];

  committedAt: string;
}
```

Commit Record：

- 不可变；
- 只能创建一次；
- 绑定最终验证和数据状态；
- 是迁移成功报告的核心证据。

---

# 四十七、RollbackPlan

```ts
interface CutoverRollbackPlan {
  eligibility:
    | "automatic"
    | "manual"
    | "not-available";

  rollbackWindowSeconds: number;

  targetFreezeActions: string[];

  targetWriteAssessmentChecks: string[];

  dataReconciliationContracts: DataReconciliationContract[];

  sourceRecoveryActions: string[];

  sourceVerificationChecks: string[];

  trafficRollbackActions: string[];

  targetCleanupActions: string[];

  rollbackVerificationChecks: string[];

  failurePolicy:
    | "manual-emergency"
    | "hold-target"
    | "best-effort";
}
```

---

# 四十八、安全回滚顺序

流量切换后出现严重问题时，推荐顺序：

```text
1. 阻止目标产生新写入
2. 撤销目标写入权
3. 判断目标是否产生新数据
4. 必要时执行目标 → 源数据协调
5. 恢复源端数据和服务
6. 授予源端写入权
7. 在本地验证源业务
8. 将流量切回源端
9. 从外部验证源业务
10. 清理或隔离目标
```

不能直接：

```text
修改 DNS 回源
→ 再想办法处理数据
```

否则源端可能基于旧数据重新接受写入。

---

# 四十九、DataReconciliationContract

```ts
interface DataReconciliationContract {
  datasetId: string;

  requiredWhenTargetWritesDetected: boolean;

  strategy:
    | "reverse-sync"
    | "transaction-replay"
    | "export-import"
    | "manual-merge"
    | "discard-target-writes"
    | "not-supported";

  maximumAutomaticWindowSeconds?: number;

  verificationCheckIds: string[];

  userApprovalRequired: boolean;

  dataLossRisk:
    | "none"
    | "low"
    | "high"
    | "certain";
}
```

如果策略是：

```text
discard-target-writes
```

必须由用户明确接受数据损失。

---

# 五十、不同失败阶段的处理

## 阶段 A：Source Quiesce 前

源业务未受影响。

处理：

- 停止 Cutover；
- 修复目标；
- 重新运行；
- 清理目标准备状态。

通常不需要业务回滚。

## 阶段 B：Source 已 Quiesce，Final Sync 未完成

处理：

- 尝试恢复传输；
- 如果无法快速恢复，恢复源端写入；
- Consistency Checkpoint 作废；
- 下次重新 Final Sync。

## 阶段 C：Final Sync 完成，Traffic 未切换

可以：

- 修复目标；
- 保持源端停止；
- 或恢复源端。

一旦恢复源端写入，Final Sync 结果立即失效。

## 阶段 D：Traffic 已切换，尚未检测到目标写入

可以快速：

- 冻结目标；
- 恢复源端；
- 切回流量。

## 阶段 E：Traffic 已切换，目标已产生写入

必须：

- 冻结目标；
- 数据协调；
- 再决定回滚。

## 阶段 F：已经 Commit

不再属于普通 Cutover Rollback。

应创建：

- Emergency Rollback Project；
- Reverse Migration；
- Repair Plan。

---

# 五十一、Cutover Checkpoint

```ts
interface CutoverCheckpoint {
  id: string;

  cutoverRunId: string;

  type:
    | "pre-cutover-ready"
    | "source-drained"
    | "source-quiesced"
    | "final-sync-complete"
    | "target-active"
    | "target-authority-granted"
    | "traffic-switched"
    | "business-verified"
    | "observation-complete"
    | "commit";

  sourceStateHash: string;
  targetStateHash: string;
  trafficStateHash: string;

  writeAuthorityRecordIds: string[];

  datasetCommitIds: string[];

  evidenceArtifactIds: string[];

  validUntil?: string;

  createdAt: string;
}
```

Critical Checkpoint 必须事务性持久化后，Run 才能进入下一阶段。

---

# 五十二、Cutover 崩溃恢复

Worker/API 重启后，Recovery Coordinator 优先扫描：

- source-quiesced；
- final-syncing；
- traffic-switching；
- traffic-switched；
- business-verifying；
- rolling-back。

恢复流程：

```text
读取最后 Cutover Checkpoint
→ Inspect source authority
→ Inspect target authority
→ Inspect traffic route
→ Inspect Dataset Commit
→ Inspect target writes
→ 选择继续、恢复源端或紧急回滚
```

不能单纯根据数据库中的 `state` 恢复。

必须读取真实外部状态。

---

# 五十三、流量切换 Reconciliation

Traffic Provider Action 发生超时后，结果可能未知。

必须执行：

```text
Inspect route
```

结果分类：

- 仍指向源；
- 已指向目标；
- 部分目标；
- 混合；
- 无法判断。

只有确认实际状态后才能：

- 标记 Action succeeded；
- 重试；
- rollback；
- block。

DNS API 请求超时不能直接重复发送并假设安全。

---

# 五十四、人工步骤模型

无法自动切换时，使用：

```ts
interface ManualCutoverStep {
  id: string;

  stage: "prepare" | "switch" | "rollback";

  instructions: string[];

  expectedBeforeState: string;

  expectedAfterState: string;

  evidenceChecks: string[];

  blocking: boolean;

  maximumCompletionSeconds?: number;
}
```

用户点击“已完成”后：

```text
自动执行 evidence checks
```

只有验证通过，状态才继续。

---

# 五十五、业务验证证据

每次 Check 保存：

- 请求摘要；
- 状态码；
- 响应 Hash；
- latency；
- TLS 证书摘要；
- 数据查询结果摘要；
- source/target 对比；
- 外部探针位置；
- 时间戳。

不能保存：

- Secret；
- 完整敏感响应；
- 用户个人数据；
- 完整数据库行。

---

# 五十六、业务验证与 Capability

Capability 可以提供默认验证模板。

例如 PostgreSQL：

- connection；
- extensions；
- schema；
- selected row counts。

Nginx：

- syntax；
- route；
- TLS；
- upstream。

自定义应用：

- 用户定义 HTTP；
- 用户定义数据库事务；
- 用户定义文件读写。

Capability 认证应区分：

- Runtime Verification Certified；
- Data Verification Certified；
- Business Verification Template；
- Cutover Certified；
- Rollback Certified。

---

# 五十七、共享服务 Cutover

共享 PostgreSQL、Nginx、Redis 不能由单个应用 Plan 任意停止。

## 共享 Nginx

- 应用先准备；
- 共享代理 Plan 合并 route；
- route 级资源锁；
- syntax test 全配置；
- reload 一次；
- 每个应用独立验证。

## 共享 PostgreSQL

如果只迁移其中一个数据库：

- 不能停止整个实例；
- 需要逻辑迁移；
- 应用级 quiesce；
- 共享实例继续服务其他 Workload。

## 共享 Redis

必须明确：

- namespace；
- database index；
- key prefix；
- persistence；
- consumer。

不明确时阻止自动 Cutover。

---

# 五十八、定时任务 Cutover

默认顺序：

```text
目标任务已安装但 disabled
→ 停止源端 scheduler
→ 等待或处理 active job
→ Final Sync
→ 目标业务验证
→ Commit 后启用目标 scheduler
```

如果任务必须在切换期间运行，需单独定义 authority 和避免重复执行策略。

---

# 五十九、Session 与用户连接

## 内存 Session

如果 Session 存储在内存：

- 切换后用户会退出登录；
- 必须显示风险；
- 可以选择接受；
- 或在迁移前外置 Session。

## 持久 Session

如果 Redis/DB 中：

- 必须迁移相应 Dataset；
- Secret 签名密钥必须保持或协调轮换。

## WebSocket/长连接

需要：

- drain；
- 最大等待时间；
- 超时断开；
- 客户端自动重连验证。

---

# 六十、UI 产品流程

Cutover 页面建议分为五区。

## 1. Ready Check

显示：

- 目标准备；
- 数据 initial sync；
- Secret；
- rollback；
- 维护窗口；
- 预计停机。

## 2. Live Timeline

```text
等待窗口
排空源请求
停止写入
最终同步
启动目标
切换流量
业务验证
观察
提交
```

## 3. Authority

始终显示：

```text
当前写入权：源服务器
当前用户流量：源服务器
```

切换后：

```text
当前写入权：目标服务器
当前用户流量：部分传播到目标
```

## 4. Verification

显示：

- required checks；
- external probes；
- 数据验证；
- 当前 warning。

## 5. Rollback

显示：

- 是否可回滚；
- 剩余时间；
- 是否检测到目标新写入；
- 回滚是否需要数据合并。

---

# 六十一、API 建议

```text
GET  /runs/:runId/cutover
POST /runs/:runId/cutover/start
POST /runs/:runId/cutover/abort

POST /runs/:runId/cutover/drain
POST /runs/:runId/cutover/quiesce
POST /runs/:runId/cutover/resume-source

POST /runs/:runId/cutover/switch-traffic
POST /runs/:runId/cutover/verify
POST /runs/:runId/cutover/commit
POST /runs/:runId/cutover/rollback

GET  /runs/:runId/cutover/traffic
GET  /runs/:runId/cutover/authority
GET  /runs/:runId/cutover/observation
```

普通用户通常只使用：

```text
start
commit
rollback
```

阶段 API 主要供 Worker 和受控管理员使用。

所有命令必须携带：

- Idempotency-Key；
- Expected-Run-Version；
- 当前 fencing token；
- CutoverContract Hash。

---

# 六十二、持久化建议

```text
cutover_contracts
cutover_runs
cutover_checkpoints

maintenance_windows

write_authority_records
target_write_monitors
target_write_observations

traffic_provider_bindings
traffic_route_snapshots
traffic_switch_runs

business_verification_contracts
business_verification_runs
business_verification_results

observation_runs
observation_samples

cutover_commit_records
cutover_rollback_runs
data_reconciliation_runs
```

---

# 六十三、MVP 范围

首期不应该支持所有云平台流量系统。

## 必须支持

- Maintenance Window；
- downtime budget；
- source drain；
- source quiesce；
- final sync Gate；
- source/target Write Authority；
- target passive/active activation；
- manual traffic switch；
- Nginx upstream/route switch；
- DNS A/AAAA/CNAME 结构化手工或一个 Provider；
- HTTP/TLS verification；
- PostgreSQL data verification；
- 文件 Manifest verification；
- external probes；
- Observation Window；
- Commit Record；
- traffic rollback；
- source resume；
- target write detection；
- crash recovery。

## 首期暂缓

- 任意 CDN；
- 所有云 LB；
- BGP/floating IP；
- 自动 weighted canary；
- active-active；
- 多区域；
- 跨数据库双写；
- 浏览器复杂 UI 自动化；
- 零停机 PostgreSQL replication；
- 自动数据冲突合并。

---

# 六十四、黄金场景 Cutover

场景：

```text
Nginx
+ Node.js systemd app
+ PostgreSQL
+ uploads
+ domain/TLS
+ cron
```

## Cutover 前

```text
目标 Node.js/Nginx/PostgreSQL 已准备
uploads initial sync 完成
PostgreSQL dump 速度已测量
Secret 已绑定
目标通过本地 Host Header 验证
DNS TTL 已提前降低
目标 cron 保持 disabled
```

## Drain

```text
源 Nginx 启用 maintenance/drain
停止接受新的写请求
等待 active requests
暂停 cron/worker
```

## Quiesce 与 Final Sync

```text
停止 blog.service
确认 PostgreSQL 活动事务完成
最终 pg_dump
final rsync uploads
验证 Dataset Commit
```

## 目标激活

```text
恢复 PostgreSQL
启动目标 blog.service
保持公网入口未切换
从 target-local 验证
授予目标写入权
```

## 切流

```text
更新 Nginx upstream 或 DNS
验证权威路由
从外部探针验证 HTTPS
源端在 DNS 传播期代理到目标
```

## 业务验证

```text
首页返回 200
页面内容正确
登录有效
数据库读取成功
创建临时草稿
读取并删除草稿
上传临时文件
读取并删除临时文件
```

## Observation

```text
观察 15 分钟
HTTP 成功率达标
无服务重启
无数据库错误
无 queue backlog
```

## Commit

```text
生成 CutoverCommitRecord
保留源服务器 24 小时
恢复 DNS TTL
Commit 后启用目标 cron
```

---

# 六十五、核心不变量总结

1. Cutover 是独立执行子系统，不是普通 Action 尾部步骤。
2. Drain 和 Quiesce 必须分开。
3. Final Sync 必须在源端写入权撤销后执行。
4. 目标在 Final Sync 前不能产生权威写入。
5. Write Authority 必须有明确 holder、epoch 和证据。
6. 普通应用默认只允许单写。
7. Target Activation 必须区分 passive、read-only 和 active。
8. Traffic Switch 必须保存 before-state。
9. Traffic Provider 超时后必须 Inspect，不得盲目重试。
10. DNS 切换必须承认传播期和混合流量。
11. DNS 传播期源端应代理到目标或返回维护状态。
12. Weighted/Canary 首期默认不支持状态型业务。
13. Business Verification 必须包含真实业务交易，而不只是进程和端口。
14. 目标预验证和公网后验证必须区分。
15. required Verification 失败时不得 Commit。
16. Observation Window 是 Commit Gate。
17. Traffic Switch 不等于 Commit。
18. Commit 必须绑定 Dataset、Verification、Traffic 与 Authority 状态。
19. Commit 只能成功一次。
20. 目标新写入必须持续检测。
21. 目标产生新写入后，Rollback 必须先进行数据协调。
22. 无法确定目标是否写入时，Rollback 至少降级为 manual。
23. Source Quiesce 后不能普通暂停或取消。
24. Critical Section 崩溃必须优先恢复或紧急回滚。
25. 回滚顺序必须先冻结目标、协调数据、恢复源，再切回流量。
26. 共享服务必须使用资源级锁和独立 Workload 管理。
27. 定时任务必须避免源目标重复运行。
28. 人工步骤必须有机器验证。
29. Report 只能陈述真实流量、验证、数据和 Commit 证据。
30. 没有 CutoverCommitRecord 的 Live Migration 不能显示为已完成。

下一步应确定 **Environment Archive、对象存储、加密、完整性 Scrub 与 Restore Drill 模型**，这样 Preserve & Restore 模式的核心对象就能完整闭环。

## Prompt:
2026/7/18 22:27:05

确定 Environment Archive、对象存储、加密、完整性 Scrub 与 Restore Drill 模型，这样 Preserve & Restore 模式的核心对象就能完整闭环

## Response:
2026/7/18 22:27:09

这一轮我会把 Preserve & Restore 的核心闭环定义为“Capture 生成不可变 Archive Version，Archive 由 Manifest、加密对象、存储副本、Scrub 证据和 Restore Drill 共同证明可恢复”，并明确什么时候才能安全释放源服务器。

Environment Archive 不能只是“上传到对象存储的一组压缩包”。它必须是一个自描述、不可变、可验证、可长期读取，并且可以针对新目标重新编译 Restore Plan 的恢复资产。

**document: **

# EnvForge Environment Archive、对象存储、加密、完整性 Scrub 与 Restore Drill 模型

## 一、核心产品定义

Environment Archive 表示：

> 某个 Environment 在一个明确一致性时间点的、经过加密和完整性验证的可恢复版本。

它至少包含：

- 已确认的 Workload Blueprint；
- 部署材料；
- 配置材料；
- 持久 Dataset；
- Secret 恢复策略；
- Compatibility Envelope；
- Verification Contract；
- Capture 一致性证据；
- 完整性 Manifest；
- 对象存储副本；
- Restore Drill 结果。

必须严格区分：

```text
Environment Snapshot
= 某个时间点观察到的机器事实

Environment Archive
= 为未来恢复而封装和验证的长期资产
```

Snapshot 本身不能证明：

- 文件内容已保存；
- 数据库可以恢复；
- Secret 未来可获得；
- Artifact 仍然存在；
- Archive 没有损坏；
- 新服务器可以重建业务。

---

# 二、总体对象关系

```text
Capture Project
├── Source Snapshot
├── Confirmed Blueprint Revisions
├── Capture Plan Revision
└── Capture Execution Run
        ↓
Environment Archive
└── Archive Version
    ├── Archive Header
    ├── Encrypted Manifest
    ├── Deployment Artifacts
    ├── Config Artifacts
    ├── Dataset Objects
    ├── Secret Recovery Metadata
    ├── Compatibility Envelope
    ├── Verification Contract
    ├── Storage Replicas
    ├── Scrub Results
    └── Restore Drill Results
            ↓
        Restore Project
            ↓
        New Restore Plan Revision
```

最重要的边界：

> Capture Plan 负责如何创建 Archive；Archive 负责保存可恢复资产；Restore Plan 负责如何针对一台具体的新目标恢复。

Capture Plan 不能被直接当成 Restore Plan。

---

# 三、EnvironmentArchive 与 ArchiveVersion

建议把逻辑 Archive 与每次不可变 Capture 版本分开。

## EnvironmentArchive

表示长期恢复资产的稳定身份。

```ts
interface EnvironmentArchive {
  id: string;
  workspaceId: string;

  name: string;
  description?: string;

  sourceProjectId: string;
  sourceEnvironmentId?: string;

  workloadIds: string[];

  currentVersionId?: string;

  lifecycleStatus:
    | "active"
    | "archived"
    | "retention-expired"
    | "deletion-pending"
    | "deleted";

  criticality:
    | "low"
    | "medium"
    | "high"
    | "critical";

  retentionPolicyId: string;
  replicaPolicyId: string;
  encryptionPolicyId: string;
  scrubPolicyId: string;
  restoreDrillPolicyId: string;

  createdAt: string;
  createdBy: string;
}
```

## ArchiveVersion

表示一次不可变 Capture。

```ts
interface ArchiveVersion {
  id: string;
  archiveId: string;

  version: number;
  parentVersionId?: string;

  captureProjectId: string;
  capturePlanRevisionId: string;
  captureRunId: string;

  sourceSnapshotRef: {
    endpointId: string;
    snapshotId: string;
    snapshotHash: string;
  };

  blueprintRefs: {
    workloadId: string;
    blueprintRevisionId: string;
    blueprintHash: string;
  }[];

  state: ArchiveVersionState;

  archiveFormatVersion: string;
  manifestSchemaVersion: string;

  headerObjectRef?: ArchiveObjectRef;
  encryptedManifestRef?: ArchiveObjectRef;
  manifestRootHash?: string;
  signatureRef?: ArchiveObjectRef;

  consistencyLevel:
    | "crash-consistent"
    | "filesystem-consistent"
    | "application-consistent"
    | "transaction-consistent"
    | "mixed";

  integrityLevel: ArchiveIntegrityLevel;
  recoverabilityLevel: ArchiveRecoverabilityLevel;

  logicalBytes: number;
  storedBytes: number;
  objectCount: number;

  createdAt: string;
  finalizedAt?: string;
}
```

一个 EnvironmentArchive 可以有多个版本：

```text
Archive：个人博客
├── Version 1：2026-07-01
├── Version 2：2026-07-15
└── Version 3：2026-08-01
```

每个版本不可修改。

---

# 四、ArchiveVersion 状态机

```ts
type ArchiveVersionState =
  | "created"
  | "capturing"
  | "finalizing"
  | "replicating"
  | "verifying"
  | "available"
  | "degraded"
  | "corrupt"
  | "unrecoverable"
  | "retention-expired"
  | "deletion-pending"
  | "deleted";
```

正常路径：

```text
CREATED
→ CAPTURING
→ FINALIZING
→ REPLICATING
→ VERIFYING
→ AVAILABLE
```

异常路径：

```text
AVAILABLE
├── 某个副本丢失，但仍满足最低副本数
│      → DEGRADED
│
├── 对象损坏，存在可用修复副本
│      → DEGRADED
│      → 修复
│      → AVAILABLE
│
├── required 对象无法恢复
│      → CORRUPT
│
└── 加密密钥永久不可用
       → UNRECOVERABLE
```

`corrupt` 与 `unrecoverable` 必须区分：

- `corrupt`：数据对象或 Manifest 损坏；
- `unrecoverable`：对象可能完整，但无法解密或缺少恢复所需关键材料。

---

# 五、Archive 内容分类

每个 Archive Version 应包含以下逻辑分区。

## 1. Blueprint Bundle

包括：

- Workload Blueprint Revision；
- Workload 依赖；
- DatasetContract；
- SecretRequirement；
- RuntimeContract；
- DeploymentContract；
- VerificationContract；
- Compatibility Envelope。

## 2. Deployment Bundle

包括：

- Git commit metadata；
- source Artifact；
- lock file；
- build manifest；
- container image digest；
- 可选 OCI image export；
- Compose 文件；
- 二进制 Artifact；
- package repository metadata；
- package list和版本；
- systemd unit模板。

## 3. Config Bundle

包括：

- 已审查配置 Artifact；
- 配置模板；
- 非 Secret 参数；
- owner/group/mode；
- source path；
- portability rules；
- Secret placeholder。

## 4. Dataset Bundle

包括：

- 文件 Manifest 和 Chunk；
- PostgreSQL dump；
- roles/grants/extensions metadata；
- Docker Volume export；
- Dataset consistency checkpoint；
- Dataset verification baseline。

## 5. Secret Recovery Bundle

默认只包括：

- SecretRequirement；
- Provider reference；
- future availability；
- regenerate policy；
- Escrow reference；
- fingerprint；
- rotation requirement。

默认不包括 Secret 明文。

## 6. Recovery Bundle

包括：

- Compatibility Envelope；
- Restore requirements；
- Verification Contract；
- Known limitations；
- Manual recovery steps；
- Artifact conversion requirements。

## 7. Provenance Bundle

包括：

- Source Snapshot Hash；
- Blueprint Hash；
- Capture Plan Hash；
- Capture Run Event摘要；
- Dataset Commit Record；
- Collector completeness；
- 用户风险接受；
- Capture 时间和一致性点。

---

# 六、Archive Header 与 Private Manifest

Archive 应采用两层 Manifest。

## Archive Header

Header 提供最小启动信息，避免恢复工具必须依赖 EnvForge 数据库。

```ts
interface ArchiveHeader {
  archiveId: string;
  archiveVersionId: string;

  archiveFormatVersion: string;

  encryptedManifestObjectKey: string;
  encryptedManifestHash: string;

  encryptionEnvelopeRef: string;

  signatureAlgorithm: string;
  signatureObjectKey: string;

  createdAt: string;

  requiredReaderVersion?: string;

  headerHash: string;
}
```

Header 不应暴露：

- 文件路径；
- 域名；
- 数据库名；
- Secret 名；
- 用户名；
- Workload 详细结构。

## Encrypted Private Manifest

保存完整恢复信息：

```ts
interface EnvironmentArchiveManifest {
  archiveId: string;
  archiveVersionId: string;

  archiveFormatVersion: string;
  manifestSchemaVersion: string;

  provenance: ArchiveProvenance;

  workloadRecords: ArchiveWorkloadRecord[];

  deploymentArtifacts: ArchiveArtifactRecord[];
  configArtifacts: ArchiveArtifactRecord[];
  datasetRecords: ArchiveDatasetRecord[];

  secretRecoveryRecords: ArchiveSecretRecoveryRecord[];

  compatibilityEnvelope: CompatibilityEnvelope;

  verificationContract: VerificationContract;

  objectIndex: ArchiveObjectIndex;

  replicaRequirements: ArchiveReplicaRequirements;

  encryptionMetadata: ArchiveEncryptionMetadata;

  integrityMetadata: ArchiveIntegrityMetadata;

  knownLimitations: KnownLimitation[];

  manifestRootHash: string;
}
```

Manifest 本身必须：

- 加密；
- Hash；
- 签名；
- 不可变；
- 可由独立恢复工具读取。

---

# 七、Manifest Root 与对象完整性树

Archive 不应只保存一个普通文件列表。

建议使用 Merkle 风格的完整性结构：

```text
Manifest Root Hash
├── Blueprint Bundle Hash
├── Deployment Bundle Hash
├── Config Bundle Hash
├── Dataset A Manifest Hash
├── Dataset B Manifest Hash
├── Secret Recovery Metadata Hash
├── Compatibility Envelope Hash
└── Verification Contract Hash
```

每个数据对象都有：

```ts
interface ArchiveObjectRecord {
  objectId: string;

  logicalRole:
    | "header"
    | "manifest"
    | "blueprint"
    | "deployment-artifact"
    | "config-artifact"
    | "dataset-chunk"
    | "database-dump"
    | "volume-export"
    | "verification-evidence"
    | "signature";

  plaintextHash: string;
  ciphertextHash: string;

  plaintextBytes: number;
  ciphertextBytes: number;

  encryptionEnvelopeId: string;

  storageObjectKey: string;

  required: boolean;

  contentType: string;

  createdAt: string;
}
```

必须同时保存：

- plaintext hash：解密后验证内容；
- ciphertext hash：未解密即可检查存储损坏。

---

# 八、Archive 自描述要求

即使 EnvForge 控制面数据库完全丢失，用户仍应能够通过以下材料启动恢复：

```text
Archive Header
+ Manifest
+ Encryption Key Provider
+ Archive Reader
```

因此 Archive 必须包含：

- 格式版本；
- Schema 版本；
- Chunk 算法；
- 加密算法；
- 压缩算法；
- 对象索引；
- Blueprint；
- Restore requirements；
- 验证定义。

不能要求恢复时必须依赖：

- 原项目数据库记录；
- 原 Capture Run 内存状态；
- 原 Worker；
- 原 Catalog 当前版本；
- 原对象路径约定的隐式知识。

---

# 九、ArchiveRepository 与对象存储抽象

对象存储不应直接写死成某一家 S3 服务。

```ts
interface ArchiveRepository {
  inspect(): Promise<ArchiveRepositoryStatus>;

  putObject(
    request: PutArchiveObjectRequest
  ): Promise<PutArchiveObjectResult>;

  getObject(
    request: GetArchiveObjectRequest
  ): Promise<ArchiveObjectStream>;

  headObject(
    objectKey: string
  ): Promise<ArchiveStoredObjectMetadata>;

  deleteObject(
    request: DeleteArchiveObjectRequest
  ): Promise<void>;

  listObjects?(
    prefix: string
  ): Promise<ArchiveStoredObjectMetadata[]>;

  copyObject?(
    sourceKey: string,
    destinationKey: string
  ): Promise<void>;

  beginMultipartUpload?(): Promise<string>;
  completeMultipartUpload?(): Promise<void>;
  abortMultipartUpload?(): Promise<void>;
}
```

---

# 十、首期 Storage Backend

建议首期支持：

```ts
type ArchiveRepositoryType =
  | "s3-compatible"
  | "local-filesystem"
  | "ssh-filesystem";
```

## S3-Compatible

适合：

- 云对象存储；
- MinIO；
- 自建兼容存储；
- 多副本；
- 生命周期规则；
- Object Lock。

## Local Filesystem

适合：

- 单机测试；
- 外置硬盘；
- 本地 NAS mount。

但需要明确：

- 本地盘不等于异地备份；
- 与源服务器同盘不满足可靠 Preserve；
- 服务器释放后不能依赖服务器本地磁盘。

## SSH Filesystem

适合：

- 第二台存储服务器；
- 简单自托管场景。

需要：

- 原子临时文件；
- fsync；
- rename；
- 容量检查；
- 文件权限；
- 远端 Hash 校验。

---

# 十一、ArchiveRepository 配置

```ts
interface ArchiveRepositoryBinding {
  id: string;

  type: ArchiveRepositoryType;

  providerConfigRef: string;

  logicalName: string;

  region?: string;
  failureDomain?: string;

  capabilities: {
    multipartUpload: boolean;
    conditionalWrite: boolean;
    versioning: boolean;
    objectLock: boolean;
    rangeRead: boolean;
    serverSideChecksum: boolean;
    serverSideEncryption: boolean;
    lifecycleRules: boolean;
  };

  status:
    | "unvalidated"
    | "available"
    | "degraded"
    | "unavailable";

  lastValidatedAt?: string;
}
```

Provider Credential 属于控制面 Credential，不进入 Archive。

---

# 十二、对象键布局

对象键不应依赖原始文件名，避免：

- 泄露路径；
- 特殊字符问题；
- 重命名影响；
- 重复对象；
- 目录遍历风险。

建议逻辑布局：

```text
archives/<archive-id>/versions/<version-id>/header
archives/<archive-id>/versions/<version-id>/manifest
archives/<archive-id>/versions/<version-id>/signature

objects/<hash-prefix>/<ciphertext-hash>

drills/<archive-version-id>/<drill-id>/report
scrubs/<archive-version-id>/<scrub-id>/report
```

真实路径只存在于加密 Manifest 中。

---

# 十三、对象写入协议

每个对象必须经过：

```text
生成内容
→ 计算 plaintext hash
→ 压缩
→ 加密
→ 计算 ciphertext hash
→ 上传临时对象
→ 远端 HEAD/读取验证
→ 原子发布或完成 multipart
→ 写 Object Record
```

不能：

```text
上传成功响应
→ 直接标记对象 verified
```

至少需要：

- 远端对象存在；
- size 匹配；
- ciphertext checksum 匹配；
- required metadata 存在。

---

# 十四、Replica Policy

Archive 不应假设一个存储位置永远可靠。

```ts
interface ArchiveReplicaPolicy {
  id: string;

  minimumCompleteReplicas: number;
  desiredReplicas: number;

  requiredFailureDomains: number;

  primaryRepositoryId: string;
  secondaryRepositoryIds: string[];

  allowSameRegionReplicas: boolean;

  minimumIntegrityLevelPerReplica:
    | "stored"
    | "hash-verified"
    | "scrubbed";

  repairAutomatically: boolean;
}
```

例如：

```text
minimumCompleteReplicas = 2
requiredFailureDomains = 2
```

表示两个副本必须处于不同故障域。

---

# 十五、ArchiveReplica

```ts
interface ArchiveReplica {
  id: string;

  archiveVersionId: string;
  repositoryBindingId: string;

  state:
    | "pending"
    | "replicating"
    | "complete"
    | "degraded"
    | "corrupt"
    | "missing"
    | "deleting"
    | "deleted";

  storedObjectCount: number;
  expectedObjectCount: number;

  storedBytes: number;

  manifestPresent: boolean;
  signaturePresent: boolean;

  lastVerifiedAt?: string;
  lastScrubRunId?: string;

  failureDomain?: string;

  completedAt?: string;
}
```

Archive Version 的可用状态应根据 Replica Policy 计算，而不是只看主副本。

---

# 十六、跨副本修复

发现对象损坏时：

```text
Replica A object corrupt
+
Replica B object valid
→ 从 B 读取
→ 验证 plaintext/ciphertext hash
→ 写回 A
→ 再次验证
```

形成：

```ts
interface ArchiveRepairRun {
  id: string;

  archiveVersionId: string;

  sourceReplicaId: string;
  targetReplicaId: string;

  affectedObjectIds: string[];

  state:
    | "pending"
    | "running"
    | "verifying"
    | "succeeded"
    | "failed";

  createdAt: string;
}
```

如果没有有效副本：

```text
required object permanently unavailable
→ Archive Version = corrupt
```

---

# 十七、加密总体模型

建议采用 Envelope Encryption：

```text
每个 Archive Version
→ 一个或多个 Data Encryption Key
→ DEK 加密 Archive Objects
→ Key Encryption Key 包装 DEK
→ Manifest 保存加密后的 DEK 引用
```

## 分层

```text
Root/KMS Key
    ↓ wrap
Archive Version Key
    ↓ derive/wrap
Object Data Keys
    ↓ encrypt
Archive Objects
```

---

# 十八、EncryptionPolicy

```ts
interface ArchiveEncryptionPolicy {
  id: string;

  algorithm:
    | "aes-256-gcm"
    | "xchacha20-poly1305";

  keyProviderType:
    | "kms"
    | "vault-transit"
    | "sops-age"
    | "user-recovery-key"
    | "envforge-managed-kms";

  keyProviderBindingId: string;

  keyGranularity:
    | "archive-version"
    | "dataset"
    | "object";

  encryptManifest: boolean;
  encryptMetadata: boolean;

  compressionBeforeEncryption: boolean;

  keyRotationPolicy:
    | "rewrap"
    | "reencrypt";

  requireRecoveryKeyTest: boolean;
}
```

建议默认：

- Manifest 加密；
- metadata 加密；
- 压缩后加密；
- 每个 Archive Version 独立 DEK；
- Critical Dataset 可使用独立 Dataset DEK；
- Key Rotation 优先 rewrap。

---

# 十九、EncryptionEnvelope

```ts
interface ArchiveEncryptionEnvelope {
  id: string;

  archiveVersionId: string;

  algorithm: string;

  keyProviderType: string;
  keyProviderBindingRef: string;

  wrappedKeyMaterial: string;

  keyVersionRef?: string;

  keyFingerprint: string;

  nonceStrategy: string;

  associatedData: {
    archiveId: string;
    archiveVersionId: string;
    manifestRootHash?: string;
  };

  createdAt: string;
  rotatedAt?: string;
}
```

`wrappedKeyMaterial` 可以保存，因为它不能在没有 KEK 的情况下解密。

不能保存 KEK 或明文 DEK。

---

# 二十、密钥可恢复性

对象完整但密钥不可用，Archive 仍然不可恢复。

因此需要：

```ts
interface ArchiveKeyAvailabilityCheck {
  id: string;

  archiveVersionId: string;

  keyProviderBindingId: string;

  state:
    | "available"
    | "temporarily-unavailable"
    | "permanently-unavailable"
    | "unknown";

  unwrapTestSucceeded: boolean;

  testedWithoutExposingPlaintext: boolean;

  checkedAt: string;
}
```

Capture 不能仅验证：

```text
KMS 配置存在
```

而应执行受控的：

```text
wrap test value
→ unwrap
→ compare
→ destroy test material
```

---

# 二十一、用户恢复密钥

自托管用户可能希望不依赖外部 KMS。

可以支持：

```text
User Recovery Key
```

但产品必须明确责任：

- 用户丢失密钥，Archive 无法恢复；
- EnvForge 默认不保存恢复密钥；
- 必须要求用户完成恢复密钥验证；
- 建议打印或离线保存；
- 不能只在浏览器显示一次后假设用户已保存。

应有：

```ts
interface RecoveryKeyAcknowledgement {
  archiveVersionId: string;

  recoveryKeyFingerprint: string;

  verificationChallengePassed: boolean;

  acknowledgedBy: string;
  acknowledgedAt: string;
}
```

---

# 二十二、密钥轮换

## Rewrap

推荐方式：

```text
旧 KEK 解包 DEK
→ 新 KEK 重新包装 DEK
→ 对象密文不变
→ 更新 Encryption Envelope Revision
```

优点：

- 不需要重新上传所有对象；
- 风险和成本较低；
- Plaintext 内容不变。

## Re-encrypt

只在以下情况使用：

- 加密算法淘汰；
- DEK 泄露；
- 租户隔离策略变化；
- 合规要求。

Re-encrypt 必须创建新 Archive Version 或明确的派生版本，不能静默修改已签名 Archive 内容。

---

# 二十三、去重与加密边界

跨 Archive 去重与强隐私之间存在冲突。

## 首期建议

只支持：

```text
单个 Archive Version 内去重
```

或：

```text
同一 Workspace 内受控去重
```

不支持跨租户全局明文去重。

## 原因

确定性加密或公开明文 Hash 可能泄露：

- 两个 Archive 是否包含相同内容；
- 常见文件是否存在；
- 低熵内容猜测。

## Workspace 内去重方案

可以使用：

```text
chunkId = HMAC(workspaceDedupKey, plaintextHash)
```

对象仍使用随机 nonce 加密。

这样对象存储看不到原始 plaintext hash。

该能力建议在 MVP 之后实现。

---

# 二十四、ArchiveIntegrityLevel

上传成功不是完整性等级。

```ts
type ArchiveIntegrityLevel =
  | "captured"
  | "object-count-verified"
  | "ciphertext-hash-verified"
  | "plaintext-hash-verified"
  | "manifest-verified"
  | "replica-verified"
  | "scrubbed"
  | "restore-reconstructed"
  | "restore-tested";
```

等级含义：

## captured

Capture Run 产生了对象。

不能用于安全释放源服务器。

## ciphertext-hash-verified

远端密文未损坏。

## plaintext-hash-verified

对象被下载、解密并验证内容 Hash。

## manifest-verified

Manifest Root、签名和所有 required 对象引用一致。

## replica-verified

满足 Replica Policy。

## scrubbed

完成定期 Scrub。

## restore-reconstructed

至少能重建 Artifact 和 Dataset。

## restore-tested

在隔离目标完成真实 Restore Drill。

---

# 二十五、ArchiveRecoverabilityLevel

完整性和可恢复性必须分开。

```ts
type ArchiveRecoverabilityLevel =
  | "unknown"
  | "manifest-readable"
  | "restore-plan-compilable"
  | "artifacts-reconstructable"
  | "workload-restorable"
  | "business-verified";
```

可能出现：

```text
完整性：manifest-verified
可恢复性：blocked
原因：PostgreSQL extension 不再可用
```

或者：

```text
对象完整
但恢复密钥丢失
→ recoverability = unknown/unrecoverable
```

---

# 二十六、Integrity Scrub 的定义

Scrub 是定期主动读取和验证 Archive，而不是查看对象存储是否返回 200。

```ts
interface ArchiveScrubRun {
  id: string;

  archiveVersionId: string;

  type:
    | "metadata"
    | "sampled"
    | "full"
    | "repair";

  state:
    | "queued"
    | "running"
    | "repairing"
    | "succeeded"
    | "warning"
    | "failed";

  replicaIds: string[];

  expectedObjectCount: number;
  inspectedObjectCount: number;

  inspectedBytes: number;

  missingObjectIds: string[];
  corruptObjectIds: string[];
  repairedObjectIds: string[];

  keyAvailabilityChecked: boolean;
  manifestVerified: boolean;
  signatureVerified: boolean;

  startedAt?: string;
  completedAt?: string;
}
```

---

# 二十七、Scrub 类型

## Metadata Scrub

检查：

- Header 存在；
- Manifest 存在；
- Signature 存在；
- expected object count；
- size；
- repository metadata；
- encryption envelope；
- key provider 可访问性。

速度快，但不能证明对象内容完整。

## Sampled Scrub

读取并验证部分对象。

采样应覆盖：

- 每个 Dataset；
- 每种 Artifact；
- 大对象；
- 最近未检查对象；
- 不同 Replica；
- 不同存储层级。

## Full Scrub

读取所有 required 对象：

```text
下载密文
→ 验证 ciphertext hash
→ 解密
→ 验证 plaintext hash
→ 验证 Manifest relation
```

## Repair Scrub

发现损坏后，从其他有效副本修复。

---

# 二十八、ScrubPolicy

```ts
interface ArchiveScrubPolicy {
  id: string;

  metadataFrequencyDays: number;
  sampledFrequencyDays: number;
  fullFrequencyDays?: number;

  samplePercent: number;
  minimumSampleObjects: number;

  verifyPlaintext: boolean;
  verifyKeyAvailability: boolean;
  verifyAllReplicas: boolean;

  autoRepair: boolean;

  maximumUnverifiedDays: number;

  failureNotificationPolicy: string;
}
```

建议按 Criticality 决定：

| Criticality | Metadata | Sampled | Full |
|---|---:|---:|---:|
| low | 每月 | 每季度 | 可选 |
| medium | 每周 | 每月 | 每年 |
| high | 每周 | 每月 | 每季度 |
| critical | 每日/每周 | 每周 | 每月/每季度 |

具体频率由用户配置，不应硬编码。

---

# 二十九、Scrub 结果对状态的影响

```text
一个非必要副本丢失
→ Archive degraded

required 对象在主副本损坏，但副本可修复
→ degraded → repair → available

required 对象所有副本都损坏
→ corrupt

Key Provider 临时不可用
→ degraded

Key 永久不可用
→ unrecoverable
```

Scrub 失败必须影响：

- Restore readiness；
- Safe-to-release 建议；
- Archive 健康状态；
- 用户告警。

---

# 三十、Scrub Checkpoint 与崩溃恢复

Full Scrub 可能持续很久，因此必须支持：

- 对象级 Checkpoint；
- Replica 级进度；
- 带宽限制；
- 暂停和恢复；
- Worker Lease；
- 已验证对象记录。

恢复时不能重新信任上次 worker 的内存进度。

必须根据持久化：

```text
object verified record
```

继续。

---

# 三十一、Restore Drill 的定义

Restore Drill 表示：

> 在不影响生产环境的前提下，使用 Archive 实际执行一部分或全部 Restore，并保存可审计证据。

它不是：

- 重新读取 Manifest；
- 编译 Restore Plan；
- 用户点击“我认为可以恢复”。

---

# 三十二、Restore Drill 等级

```ts
type RestoreDrillLevel =
  | "plan-only"
  | "artifact-reconstruction"
  | "dataset-reconstruction"
  | "isolated-workload-restore"
  | "business-verification";
```

## Plan-only

验证：

- Archive 可读取；
- Blueprint 可解析；
- Compatibility 可以针对测试目标计算；
- Restore Plan 可编译。

不能称为真实 Restore Drill 通过。

## Artifact Reconstruction

实际下载、解密和重建：

- Config；
- Deployment Artifact；
- Database dump；
- 文件 Dataset。

## Dataset Reconstruction

实际恢复 Dataset：

- PostgreSQL 恢复到临时实例；
- 文件恢复到临时目录；
- Volume 恢复到临时 Volume。

## Isolated Workload Restore

在隔离目标启动完整 Workload。

## Business Verification

执行 Blueprint 中的业务验证：

- HTTP；
- 数据库；
- 文件读写；
- 合成交易。

这是最高等级。

---

# 三十三、RestoreDrillPolicy

```ts
interface RestoreDrillPolicy {
  id: string;

  requiredLevel: RestoreDrillLevel;

  requiredBeforeSourceRelease: boolean;

  frequencyDays?: number;

  maximumResultAgeDays?: number;

  targetProfileId?: string;

  isolationRequirements: DrillIsolationRequirements;

  secretPolicy:
    | "test-secrets"
    | "restricted-production-secret"
    | "provider-sandbox"
    | "manual";

  cleanupRequired: boolean;

  requireBusinessVerification: boolean;
}
```

---

# 三十四、Drill 隔离要求

真实恢复测试可能意外：

- 发送邮件；
- 调用支付 API；
- 启动 cron；
- 消费生产 Queue；
- 修改 DNS；
- 连接生产数据库。

因此必须有：

```ts
interface DrillIsolationRequirements {
  networkMode:
    | "no-egress"
    | "allowlisted-egress"
    | "isolated-vpc"
    | "manual";

  blockedDestinations: string[];
  allowedDestinations: string[];

  disableSchedulers: boolean;
  disableOutboundMail: boolean;
  disableProductionTraffic: boolean;

  replaceExternalDependencies: boolean;

  testDomainRequired: boolean;
  temporaryCredentialsRequired: boolean;
}
```

默认：

- 不修改生产 DNS；
- 不启用生产 cron；
- 不使用真实用户流量；
- 外部写操作被阻止；
- SMTP 使用 sink；
- 支付、Webhook 等使用 mock/sandbox。

---

# 三十五、RestoreDrillRun

```ts
interface RestoreDrillRun {
  id: string;

  archiveVersionId: string;

  level: RestoreDrillLevel;

  state:
    | "created"
    | "compiling-plan"
    | "preparing-target"
    | "restoring"
    | "verifying"
    | "cleaning"
    | "succeeded"
    | "warning"
    | "failed"
    | "cleanup-failed";

  temporaryProjectId: string;
  restorePlanRevisionId?: string;
  executionRunId?: string;

  targetProfile: DrillTargetProfile;

  artifactResults: DrillArtifactResult[];
  datasetResults: DrillDatasetResult[];
  workloadResults: DrillWorkloadResult[];
  verificationResultIds: string[];

  cleanupResult?: DrillCleanupResult;

  startedAt?: string;
  completedAt?: string;

  validUntil?: string;
}
```

---

# 三十六、Drill Target

```ts
interface DrillTargetProfile {
  type:
    | "temporary-vm"
    | "temporary-container-host"
    | "existing-test-host"
    | "manual";

  architecture: string;
  operatingSystem: string;

  cpu: number;
  memoryBytes: number;
  diskBytes: number;

  isolationProfileId: string;

  destructionRequired: boolean;
}
```

Restore Drill 的目标不能完全脱离 Compatibility Envelope。

例如 Archive 只支持 x86_64，就不能只在 ARM 测试后宣称通用可恢复。

---

# 三十七、Drill Secret 策略

真实生产 Secret 进入测试环境会带来风险。

优先使用：

```text
测试 Secret
Provider Sandbox
重新生成 Secret
```

对于必须保持原值才能解密的数据：

- 使用受限的恢复环境；
- 最小化网络；
- 严格审计；
- 测试完成后撤销；
- 不允许写入普通 Drill 日志。

---

# 三十八、Drill 验证结果

Restore Drill 至少应验证：

## Archive

- Header；
- Manifest；
- Signature；
- Encryption；
- Object completeness。

## Artifact

- 可重建；
- Hash 正确；
- 格式可解析。

## Dataset

- 文件 Manifest；
- 数据库 schema；
- row count；
- extensions；
- ownership；
- 可读写。

## Runtime

- 服务启动；
- 依赖连接；
- Endpoint。

## Business

- 合成交易；
- 数据读取；
- 受控写入；
- 清理。

---

# 三十九、Drill 结果有效期

Restore Drill 不能永久有效。

以下情况使旧结果不再覆盖当前版本：

- 新 Archive Version；
- Blueprint Revision 变化；
- Archive Format 变化；
- 加密 Key Provider 变化；
- required Artifact 变化；
- Dataset Manifest 变化；
- Verification Contract 变化；
- 测试结果超过 Policy 有效期。

每个 Drill 结果必须绑定：

```text
Archive Version ID
Manifest Root Hash
Blueprint Hash
Restore Plan Hash
Target Profile
Verification Contract Hash
```

---

# 四十、Restore Drill 状态结论

```ts
type RestoreDrillOutcome =
  | "passed"
  | "passed-with-warnings"
  | "failed"
  | "incomplete";
```

`passed-with-warnings` 不能自动满足 Critical Archive 的 Source Release Gate，除非 Policy 明确允许。

---

# 四十一、Safe-to-Release Gate

Capture 完成后，不能仅显示：

```text
Archive 上传成功，可以删除旧服务器
```

应生成正式：

```ts
interface SourceReleaseReadinessResult {
  archiveVersionId: string;

  state:
    | "safe"
    | "safe-with-accepted-risks"
    | "not-safe";

  gates: SourceReleaseGateResult[];

  acceptedRiskIds: string[];

  generatedAt: string;
}
```

---

# 四十二、释放源服务器的必要 Gate

## 1. Workload Coverage

- 所有 required Workload 已进入 Archive；
- 所有 Critical Unassigned Evidence 已处理；
- 所有 shared dependency 已记录；
- 没有遗漏数据库和 Volume。

## 2. Artifact Coverage

- required Deployment Artifact 已保存；
- required Config 已保存；
- 不可重新获取的软件有 fallback Artifact；
- mutable tag 已解析为 digest。

## 3. Dataset Coverage

- required Dataset 已 Capture；
- consistency checkpoint 有效；
- Manifest 完整；
- Dataset Verification 通过。

## 4. Secret Recoverability

- required Secret 有未来恢复策略；
- 数据解密类 Secret 确认可用；
- Escrow 或外部 Provider 已验证；
- Recovery Key challenge 已通过。

## 5. Archive Integrity

- Header、Manifest、Signature 验证；
- required objects 完整；
- ciphertext/plaintext Hash 达到 Policy；
- Replica Policy 满足。

## 6. Restore Readiness

- Restore Plan 可以编译；
- Compatibility Envelope 完整；
- Known limitations 已确认；
- required Restore Drill 达到等级。

## 7. Retention

- Retention Policy 已启用；
- Archive 不会在源服务器释放后立即过期；
- required Object Lock 已设置；
- 副本生命周期规则不会误删对象。

只有全部 required Gate 通过，才允许：

```text
SAFE_TO_RELEASE_SOURCE
```

---

# 四十三、SourceReleaseCommitRecord

```ts
interface SourceReleaseCommitRecord {
  id: string;

  captureRunId: string;
  archiveVersionId: string;

  manifestRootHash: string;

  integrityLevel: ArchiveIntegrityLevel;
  recoverabilityLevel: ArchiveRecoverabilityLevel;

  replicaIds: string[];
  restoreDrillRunIds: string[];

  secretRecoveryCheckIds: string[];

  acceptedRiskIds: string[];

  committedBy: {
    userId: string;
  };

  committedAt: string;
}
```

该 Record 表示：

> EnvForge 在该时点认为 Archive 满足当前 Policy 的释放条件。

它不代表 EnvForge 可以保证任意未来硬件和软件环境都兼容。

---

# 四十四、Archive RetentionPolicy

```ts
interface ArchiveRetentionPolicy {
  id: string;

  minimumRetentionDays: number;
  maximumRetentionDays?: number;

  retainLastVersions?: number;

  expirationMode:
    | "manual"
    | "automatic"
    | "never";

  legalHoldSupported: boolean;

  objectLockRequired: boolean;

  immutableUntil?: string;

  deletionApproval:
    | "single-user"
    | "two-person"
    | "admin-only";

  scrubBeforeExpiration: boolean;

  restoreDrillBeforeExpiration?: boolean;
}
```

---

# 四十五、Archive Version 保留策略

支持：

```text
保留最近 N 个版本
+
保留每月版本
+
保留年度版本
```

但必须考虑增量对象引用。

不能删除一个旧 Version 后破坏新 Version 引用的共享 Chunk。

因此需要：

```ts
interface ArchiveObjectReference {
  objectId: string;
  archiveVersionId: string;
  referenceType: "direct" | "inherited";
}
```

对象只有在没有任何有效 Version 引用时，才能进入垃圾回收。

---

# 四十六、删除状态机

```text
AVAILABLE
→ RETENTION_EXPIRED
→ DELETION_PENDING
→ APPROVED_FOR_DELETION
→ DELETING
→ DELETED
```

删除前检查：

- 无 Legal Hold；
- 无活动 Restore；
- 无活动 Scrub；
- 无子 Version 引用；
- 无对象共享引用；
- 用户权限；
- 删除审批；
- Object Lock 是否允许。

---

# 四十七、删除不能只删数据库记录

删除必须覆盖：

- Archive Header；
- Manifest；
- Objects；
- Replicas；
- Escrow Secret；
- Encryption Envelope；
- 临时恢复材料；
- Drill Target；
- multipart 残留。

并生成：

```ts
interface ArchiveDeletionRecord {
  archiveVersionId: string;

  deletedReplicaIds: string[];
  deletedObjectCount: number;

  keyMaterialDestroyed: boolean;

  incompleteObjectIds: string[];

  approvedBy: string[];
  completedAt: string;
}
```

如果某个对象存储因 Object Lock 无法删除，应明确显示：

```text
deletion pending on repository X
```

不能显示“已完全删除”。

---

# 四十八、Crypto-shredding

如果 Archive 使用独立 DEK，可以通过销毁 Key Envelope 使对象无法解密。

但 Crypto-shredding 不能自动等同于物理删除，因为：

- 对象仍可能存在；
- Key 可能有备份；
- KMS 可能保留历史版本；
- Wrapped Key 可能存在副本。

因此 Report 应区分：

```text
cryptographically inaccessible
physical deletion confirmed
```

---

# 四十九、格式版本与长期兼容

Archive 应保存：

```text
archiveFormatVersion
manifestSchemaVersion
blueprintSchemaVersion
datasetFormatVersion
encryptionFormatVersion
```

Reader 必须：

- 至少向后兼容若干正式版本；
- 对未知版本明确阻塞；
- 不静默忽略未知字段；
- 支持格式迁移工具。

---

# 五十、Archive 格式升级

不能原地修改旧 Archive。

正确方式：

```text
Archive Version V1
→ Read and validate
→ Create derived Archive Version V2
→ Re-encrypt/repackage if required
→ Verify
→ 保留 V1 直到 V2 通过
```

形成：

```ts
interface ArchiveDerivationRecord {
  sourceArchiveVersionId: string;
  derivedArchiveVersionId: string;

  reason:
    | "format-upgrade"
    | "encryption-upgrade"
    | "storage-migration"
    | "repair"
    | "consolidation";

  transformationPlanHash: string;
  createdAt: string;
}
```

---

# 五十一、Archive Storage Migration

用户可能更换对象存储供应商。

流程：

```text
读取源 Replica
→ 验证对象
→ 复制到新 Repository
→ 验证新 Replica
→ 更新 Replica Policy
→ 可选删除旧 Replica
```

Archive Manifest 不应依赖绝对供应商 URL。

只保存逻辑 Object ID 和 Repository 映射。

---

# 五十二、控制面数据库丢失恢复

EnvForge 应提供：

```text
Import Existing Archive
```

流程：

1. 用户提供 Repository；
2. 扫描 Archive Header；
3. 验证 Signature；
4. 获取 Key Provider；
5. 解密 Manifest；
6. 重建 EnvironmentArchive 和 ArchiveVersion 索引；
7. 重新计算 Replica 状态；
8. 重新运行 Scrub；
9. 创建 Restore Project。

因此不能让 Archive 的关键索引只存在于控制面数据库。

---

# 五十三、Archive Signature

加密证明保密性，签名证明来源和 Manifest 未被替换。

```ts
interface ArchiveSignature {
  archiveVersionId: string;

  manifestRootHash: string;

  algorithm:
    | "ed25519"
    | "ecdsa-p256";

  signerKeyRef: string;
  signerKeyVersion: string;

  signature: string;

  signedAt: string;
}
```

签名私钥不能保存在 Archive 内。

验证公钥或证书链可以保存。

---

# 五十四、Archive Trust 状态

```ts
type ArchiveTrustState =
  | "trusted"
  | "signature-valid-key-retired"
  | "signature-invalid"
  | "unsigned"
  | "unknown-signer";
```

默认生产 Capture 要求：

```text
trusted
```

导入第三方或旧 Archive 时可以是 unsigned，但必须显示明显风险。

---

# 五十五、Archive Health 计算

Archive 健康不能由单个状态字段人工修改。

应根据以下维度计算：

```ts
interface ArchiveHealth {
  overall:
    | "healthy"
    | "warning"
    | "degraded"
    | "critical"
    | "unrecoverable";

  manifestHealth: string;
  replicaHealth: string;
  encryptionHealth: string;
  keyAvailabilityHealth: string;
  scrubHealth: string;
  restoreDrillHealth: string;
  retentionHealth: string;
  compatibilityHealth: string;

  blockers: string[];
  warnings: string[];

  evaluatedAt: string;
}
```

---

# 五十六、Restore Project 创建规则

从 Archive 创建 Restore Project 时：

```text
选择 Archive Version
→ 验证 Archive Health
→ 选择目标 Endpoint
→ 采集 Target Snapshot
→ 计算 Compatibility
→ 绑定 Secret Provider
→ 编译新的 Restore Plan
```

Archive 本身不能执行恢复。

Restore Plan 必须绑定：

- Archive Version；
- Manifest Root Hash；
- Blueprint Hash；
- Target Snapshot Hash；
- Key Provider Binding；
- Secret Provider Binding；
- Capability Version。

---

# 五十七、部分恢复

用户可以选择只恢复部分 Workload 或 Dataset，但必须满足依赖。

```ts
interface ArchiveRestoreSelection {
  archiveVersionId: string;

  selectedWorkloadIds: string[];
  selectedDatasetIds: string[];

  dependencyResolution:
    | "include-required"
    | "reuse-external"
    | "manual";

  excludedRequiredItems: {
    id: string;
    acceptedRiskId: string;
  }[];
}
```

如果排除 required Dataset：

```text
Restore Plan 可以作为数据提取计划
但不能标记 Workload Restore 成功
```

---

# 五十八、Archive 浏览与敏感信息

Archive UI 不应默认暴露：

- 完整路径；
- 数据库名称；
- 域名；
- Secret 名；
- 用户名；
- 文件列表。

权限应区分：

```ts
type ArchivePermission =
  | "archive-metadata-view"
  | "archive-manifest-view"
  | "archive-restore"
  | "archive-export"
  | "archive-scrub"
  | "archive-drill"
  | "archive-delete"
  | "archive-key-recover";
```

---

# 五十九、事件与审计

```text
archive.capture.started
archive.object.stored
archive.manifest.finalized
archive.replica.completed
archive.integrity.verified
archive.available

archive.scrub.started
archive.object.corrupt
archive.object.repaired
archive.scrub.completed

archive.restore-drill.started
archive.restore-drill.passed
archive.restore-drill.failed

archive.source-release.committed

archive.retention.expired
archive.deletion.approved
archive.deleted
```

Report 只能根据真实 Event、Manifest、Scrub 和 Drill 结果生成。

---

# 六十、持久化建议

```text
environment_archives
archive_versions
archive_headers
archive_manifests

archive_objects
archive_object_references
archive_artifacts
archive_dataset_records
archive_secret_recovery_records

archive_repository_bindings
archive_replicas
archive_replica_objects

archive_encryption_envelopes
archive_key_availability_checks
archive_signatures

archive_scrub_policies
archive_scrub_runs
archive_scrub_object_results
archive_repair_runs

restore_drill_policies
restore_drill_runs
restore_drill_results

archive_retention_policies
archive_legal_holds
archive_deletion_records

source_release_readiness_results
source_release_commit_records

archive_events
```

大型 Manifest 和对象索引可以存为加密 Artifact，数据库只保存索引和状态。

---

# 六十一、API 建议

```text
POST /archives
GET  /archives/:archiveId
GET  /archives/:archiveId/versions

POST /archive-versions/:versionId/scrubs
GET  /archive-versions/:versionId/health
POST /archive-versions/:versionId/repair

POST /archive-versions/:versionId/restore-drills
GET  /restore-drills/:drillId

POST /archive-versions/:versionId/restore-projects

GET  /archive-versions/:versionId/source-release-readiness
POST /archive-versions/:versionId/source-release-commit

POST /archive-versions/:versionId/replicas
DELETE /archive-versions/:versionId/replicas/:replicaId

POST /archive-versions/:versionId/delete
```

所有删除、Key Recovery 和 Source Release 操作必须使用明确命令，不使用通用 PATCH。

---

# 六十二、UI 产品结构

## Archive 总览

显示：

```text
个人博客 Archive
当前版本：3
状态：可恢复
完整性：已完成全量 Scrub
副本：2/2
密钥：可用
最近 Restore Drill：12 天前，通过
保留至：2027-07-18
```

## Archive Version 页面

分区：

- 内容范围；
- Workload；
- Dataset；
- Artifact；
- Secret Recovery；
- Compatibility；
- Storage Replicas；
- Encryption；
- Scrub；
- Restore Drill；
- Release Readiness；
- Retention。

## 健康警告

例如：

```text
Archive 已降级

原因：
- 第二副本缺少 3 个对象
- 当前仍有一个完整副本
- 自动修复已排队

当前仍可恢复，但不满足 2 副本策略。
```

---

# 六十三、MVP 范围

## MVP 必须支持

- EnvironmentArchive；
- 不可变 ArchiveVersion；
- Archive Header；
- 加密 Manifest；
- 文件、PostgreSQL、Docker Volume Artifact；
- S3-compatible Repository；
- Local Filesystem Repository；
- 每个 Archive Version 独立 DEK；
- KMS/Vault Transit 或用户恢复密钥；
- AES-GCM 或 XChaCha20-Poly1305；
- plaintext/ciphertext Hash；
- Manifest Root Hash；
- Signature；
- 两副本策略；
- Metadata Scrub；
- Sampled Scrub；
- Full Scrub；
- 自动跨副本修复；
- Plan-only Drill；
- Dataset Reconstruction Drill；
- Isolated Workload Restore Drill；
- Source Release Gate；
- Retention；
- 安全删除；
- 从 Repository 重新导入 Archive。

## MVP 可以暂缓

- 全局去重；
- 多租户跨 Archive 去重；
- Tape Storage；
- Glacier 类离线层自动恢复；
- 多 KMS quorum；
- HSM；
- 多地域自动调度；
- Continuous Restore Drill；
- 任意旧格式无限兼容；
- 完整合规 Legal Hold 套件；
- Active-active Archive Repository。

---

# 六十四、黄金场景 Archive

个人博客包含：

```text
Nginx
Node.js systemd app
PostgreSQL
uploads
.env Secret Requirements
domain/TLS
cron
```

## Archive 内容

### Blueprint

- Blog Blueprint Revision；
- Shared Nginx dependency；
- PostgreSQL Dataset；
- uploads Dataset；
- Verification Contract。

### Deployment

- Git commit；
- package lock；
- build Artifact；
- systemd template；
- Nginx route template。

### Config

- 非 Secret env template；
- Nginx config；
- timer/cron config。

### Dataset

- PostgreSQL consistent dump；
- roles/grants/extensions；
- uploads chunk Manifest；
- file owner/mode；
- selected verification baseline。

### Secret Recovery

- DATABASE_PASSWORD Provider Reference；
- SESSION_SECRET Preserve/Rotate Policy；
- TLS Private Key reissue/escrow policy；
- SMTP Token Provider Reference。

### Restore Drill

- 恢复 PostgreSQL 到临时实例；
- 恢复 uploads；
- 启动 Node.js；
- Host Header HTTP 验证；
- 创建和删除测试草稿；
- 上传和删除测试文件。

---

# 六十五、完整 Preserve & Restore 闭环

```text
Source Discovery
→ Workload Candidate Review
→ Confirmed Blueprint
→ Capture Plan
→ Capture Run
→ Dataset Consistency Checkpoint
→ Encrypted Archive Objects
→ Signed Manifest
→ Replica Verification
→ Integrity Scrub
→ Restore Drill
→ Source Release Commit
→ Source Server Released
→ Months Later
→ Import/Select Archive
→ Target Discovery
→ Compatibility Resolution
→ Secret Binding
→ New Restore Plan
→ Restore Run
→ Dataset Verification
→ Business Verification
→ Restore Commit
```

---

# 六十六、核心不变量

1. Snapshot 不等于 Archive。
2. EnvironmentArchive 是稳定身份，ArchiveVersion 是不可变 Capture。
3. ArchiveVersion 一旦 finalized，不允许修改内容。
4. 新 Capture 必须产生新 Version。
5. Capture Plan 不能复用为 Restore Plan。
6. Archive 必须自描述，不能完全依赖 EnvForge 控制面数据库。
7. Header 只包含最小启动信息。
8. 完整 Manifest 必须加密。
9. Manifest 必须有 Root Hash 和签名。
10. 所有 required 对象必须有 plaintext 和 ciphertext 完整性证据。
11. 上传成功不等于 Archive 可恢复。
12. Archive 可用状态必须满足 Replica Policy。
13. 存储副本必须按故障域建模。
14. 对象损坏应优先从有效副本修复。
15. 没有有效副本时 required 对象损坏使 Archive corrupt。
16. 密钥永久不可用使 Archive unrecoverable。
17. Archive 默认使用 Envelope Encryption。
18. Key Rotation 优先使用 rewrap。
19. Manifest、路径和恢复元数据默认加密。
20. 首期不进行跨租户明文去重。
21. Integrity 与 Recoverability 必须分开评估。
22. Scrub 必须实际读取并校验对象。
23. Sampled Scrub 不能显示成 Full Scrub。
24. Restore Drill 必须实际恢复资产，Plan 编译不等于真实 Drill。
25. Restore Drill 必须隔离生产流量和外部副作用。
26. Drill 结果必须绑定具体 Archive Version 和 Manifest Hash。
27. 新 Archive Version 不自动继承旧 Drill 结论。
28. Critical Archive 的 Drill 结果必须有有效期。
29. Safe-to-Release 必须同时检查 Workload、Artifact、Dataset、Secret、Replica、Integrity 和 Restore。
30. 没有 SourceReleaseCommitRecord 时，不能建议释放源服务器。
31. SourceReleaseCommit 不保证任意未来环境绝对兼容。
32. Restore 必须重新采集目标并重新编译 Restore Plan。
33. 删除 Archive 必须检查引用、Retention、Legal Hold 和活动 Restore。
34. 删除数据库记录不等于对象已经删除。
35. Crypto-shredding 与物理删除必须分别报告。
36. 增量 Archive 的共享对象必须使用引用计数或等价模型。
37. 格式升级必须创建派生 Version，不能原地修改旧 Archive。
38. Archive 必须支持从对象存储重新导入控制面。
39. Key Recovery、Archive Delete 和 Source Release 应使用高权限和强审计。
40. Report 只能陈述 Manifest、Replica、Scrub、Drill 和 Commit 所证明的事实。

至此，EnvForge 的核心端到端链路已经形成闭环：**Discover → Workload → Blueprint → Plan → Durable Run → Dataset/Secret/Cutover → Archive → Restore Drill → Restore**。下一层应开始统一这些模型的数据库聚合边界、API 资源结构和分阶段实施路线。

## Prompt:
2026/7/18 22:46:55

进入下一层应开始统一这些模型的数据库聚合边界、API 资源结构和分阶段实施路线

## Response:
2026/7/18 22:47:03

这一层我会先确定“模块化单体 + 单一 PostgreSQL + 独立 Durable Worker”的落地形态，再划定九个聚合与事务边界，统一命令式 API，最后给出从现有代码逐阶段迁移、每阶段验收门槛和禁止跨阶段透支的路线。

> **组织项目阶段**
>
> 我在构思项目的不同阶段，避免时间估算，专注于交付物、验收标准和非目标。每个阶段的重要内容包括数据模型、工作负载、蓝图、构建、迁移等。
>
> 思考了 55s

下面将前面确定的领域模型收束成一套可实施架构。推荐首期采用 **模块化单体控制面、单一 PostgreSQL、独立 Durable Worker、对象存储 Artifact 层**，不要过早拆微服务；先把事务边界、不可变 Revision、事件与执行恢复做正确。

**document: **

# EnvForge 数据库聚合边界、API 资源结构与分阶段实施路线

## 一、总体技术形态

首期推荐架构：

```text
Web UI
   ↓
EnvForge API / Control Plane
   ├── Project & Discovery
   ├── Workload & Blueprint
   ├── Planning
   ├── Execution Orchestrator
   ├── Dataset
   ├── Secret
   ├── Cutover
   ├── Archive
   └── Read Models
          ↓
      PostgreSQL
          ↓ Outbox / Durable Queue
      Worker Processes
          ├── SSH Adapter
          ├── Package Adapter
          ├── systemd Adapter
          ├── Dataset Adapter
          ├── Traffic Adapter
          ├── Secret Provider Adapter
          └── Archive Repository Adapter

Artifact / Object Storage
   ├── Config Artifacts
   ├── Transfer Manifests
   ├── Database Dumps
   ├── Logs and Evidence
   └── Environment Archives
```

首期不建议拆成多个独立网络服务。

建议采用：

```text
一个代码仓库
一个 API 进程
一个或多个独立 Worker 进程
一个 PostgreSQL 数据库
一个 Artifact/Object Storage 接口
按模块划分代码和数据库 Schema
```

原因：

- 当前最复杂的问题是领域边界和执行一致性，不是服务规模；
- 分布式事务会放大 Plan、Run、Checkpoint、Lock 的复杂度；
- 单一 PostgreSQL 足以承担队列、Lease、状态机和审计；
- 模块化边界稳定后，可以再按 Execution、Transfer、Archive 拆服务。

---

# 二、数据库物理分层

建议在同一个 PostgreSQL Database 中使用逻辑 Schema：

```text
core
discovery
workload
planning
execution
dataset
secret
cutover
archive
audit
projection
```

其含义：

| Schema | 主要职责 |
|---|---|
| core | Workspace、Project、Endpoint、Connection 引用 |
| discovery | Snapshot、Evidence、Graph、Candidate |
| workload | Workload、Blueprint Revision |
| planning | DecisionSet、Plan Revision、Approval |
| execution | Run、Stage、Action、Attempt、Queue、Lease |
| dataset | Dataset Run、Transfer、Checkpoint、Verification |
| secret | Requirement、Binding、Delivery、Rotation |
| cutover | Authority、Traffic、Observation、Commit |
| archive | Archive Version、Replica、Scrub、Drill |
| audit | Domain Event、Outbox、Command Audit |
| projection | UI 查询用读模型 |

这些 Schema 是模块边界，不代表必须使用不同数据库用户。

---

# 三、聚合设计原则

## 1. 聚合不是页面

页面可以同时显示多个聚合。

例如迁移控制台可以读取：

- Project；
- Blueprint；
- Plan；
- Run；
- Dataset Run；
- Cutover Run。

但一次写事务不能为了更新整个页面而同时修改所有对象。

## 2. 聚合控制事务一致性

一个命令只能明确修改一个主聚合，必要时：

```text
修改主聚合
+ 追加 Domain Event
+ 写入 Outbox
```

在同一数据库事务中完成。

其他聚合通过后续事件处理或显式命令更新。

## 3. 不把整个项目保存成一个 JSON

禁止：

```text
projects
└── state_json 包含 Snapshot、Blueprint、Plan、Run、Archive
```

这会导致：

- 并发覆盖；
- 无法局部锁定；
- 无法可靠审计；
- Run 与 Plan 混在一起；
- 大对象频繁重写；
- 崩溃恢复困难。

## 4. 不把所有对象都做成巨型 ORM 聚合

ExecutionRun 可能包含成千上万个：

- ActionRun；
- Attempt；
- Event；
- TransferPart。

不能每次状态转换都加载完整对象图。

因此领域聚合边界和数据库写入边界需要区分：

```text
ExecutionRun 是领域根
但 ActionAttempt 可以通过受控仓储独立追加
```

Run Root 维护：

- 总体状态；
- 当前阶段；
- fencing token；
- version；
- outcome。

子对象独立行保存，并通过领域服务保证不变量。

---

# 四、九个核心写模型聚合

## 聚合 1：EnvironmentProject

Root：

```text
EnvironmentProject
```

拥有或引用：

- Project 类型；
- Project 状态；
- Source/Target Endpoint 角色；
- Archive 引用；
- 当前 Workload/Decision/Plan 引用；
- Project Link。

建议表：

```text
core.projects
core.project_endpoints
core.project_links
```

事务边界：

- 创建项目；
- 绑定 Endpoint；
- 从 Assessment 派生 Migration；
- 从 Archive 创建 Restore；
- 更新当前 Revision 指针；
- 归档项目。

Project 不拥有 Snapshot、Plan 或 Run 的实际内容。

### Project 状态

建议只反映工作空间流程：

```ts
type ProjectStatus =
  | "draft"
  | "discovering"
  | "reviewing"
  | "planning"
  | "ready"
  | "executing"
  | "attention-required"
  | "completed"
  | "archived";
```

`completed` 不应由用户直接 PATCH。

应由：

```text
Run/Commit Event
→ Project Projection/Policy
```

更新。

---

## 聚合 2：EnvironmentSnapshot 与 Discovery Generation

Root：

```text
EnvironmentSnapshot
```

另一个批次根：

```text
CandidateGeneration
```

建议表：

```text
discovery.snapshots
discovery.snapshot_sections
discovery.evidence
discovery.evidence_relations
discovery.candidate_generations
discovery.workload_candidates
discovery.candidate_components
discovery.candidate_evidence_assignments
discovery.candidate_questions
discovery.candidate_conflicts
```

### Snapshot 边界

Snapshot 一旦 finalized：

- 内容不可修改；
- completeness 不可修改；
- Hash 不可修改。

Collector 后续补采必须创建：

```text
新 Snapshot
```

不能向旧 Snapshot 追加“刚采集到”的数据。

### Candidate Generation 边界

Candidate Generation 绑定：

- Snapshot Hash；
- Builder Version；
- Ruleset Version；
- Graph Hash。

Generation 一经发布，不再修改生成内容。

用户 Review 不回写机器生成的 Candidate 原文，而是创建独立 Review Decision。

建议：

```text
discovery.candidate_review_sessions
discovery.candidate_review_decisions
```

---

## 聚合 3：Workload

Root：

```text
Workload
```

拥有稳定身份和 Placement。

Blueprint Revision 是与 Workload 关联的不可变文档。

建议表：

```text
workload.workloads
workload.workload_placements
workload.workload_dependencies
workload.blueprint_revisions
workload.blueprint_promotion_records
workload.blueprint_update_proposals
```

### Workload 可修改字段

可修改：

- 名称；
- 描述；
- owner；
- tags；
- lifecycle status；
- 当前 Blueprint 指针。

不可通过 Workload 直接修改：

- 已确认 Blueprint 内容；
- 历史 Placement；
- 已执行 Plan。

### Blueprint 存储方式

建议使用：

```text
关系型索引列
+
canonical JSONB document
+
content_hash
```

例如：

```text
blueprint_revisions
- id
- workload_id
- revision
- status
- origin
- schema_version
- content_jsonb
- content_hash
- created_at
- confirmed_at
```

完整 Blueprint 适合 JSONB，因为：

- 是不可变版本文档；
- 子结构复杂；
- 主要整体读取；
- 需要 Hash 和 Schema Version。

但以下内容应额外建立查询索引表或 Projection：

- Dataset；
- Secret Requirement；
- Endpoint；
- Dependency；
- readiness blocker。

不要为了查询列表而反复解析大 JSON。

---

## 聚合 4：Planning

Planning 包含三个相互独立的根：

```text
DecisionSetRevision
PlanRevision
PlanApproval
```

建议表：

```text
planning.decision_set_revisions
planning.plan_revisions
planning.plan_input_bindings
planning.plan_artifact_refs
planning.plan_risks
planning.plan_gates
planning.plan_approvals
planning.approval_decisions
```

### DecisionSetRevision

不可变。

新回答、新冲突处理或风险接受：

```text
DecisionSet Revision N
→ DecisionSet Revision N+1
```

### PlanRevision

不可变。

建议主体也使用：

```text
canonical JSONB + relational indexes
```

其中 Action DAG 可以：

- 小型 Plan：存 JSONB；
- 大型 Plan：拆入 `plan_actions` 和 `plan_action_edges`；
- `plan_hash` 对完整 canonical form 计算。

首期建议直接拆表，因为后续 Worker 需要按 Action 查询和 Claim：

```text
planning.plan_actions
planning.plan_action_dependencies
planning.plan_stages
planning.plan_dataset_contracts
planning.plan_secret_contracts
```

### PlanApproval

独立于 Plan。

审批不修改 Plan 内容。

Plan 可有多个 Approval Attempt，但只有一个当前有效 Approval。

---

## 聚合 5：ExecutionRun

Root：

```text
ExecutionRun
```

子写模型：

- StageRun；
- ActionRun；
- ActionAttempt；
- Checkpoint；
- RunEvent。

建议表：

```text
execution.runs
execution.stage_runs
execution.action_runs
execution.action_attempts
execution.checkpoints
execution.run_events

execution.run_queue
execution.worker_leases
execution.resource_leases
execution.manual_gates
execution.verification_results
execution.commit_records
```

### Run Root 事务边界

一次状态转换事务最多修改：

```text
execution.runs
+ 当前 stage/action 必要状态
+ run_event
+ outbox
```

例如 Action 成功：

```text
更新 action_run
追加 action_attempt 终态
追加 action.succeeded Event
更新可就绪的后继 Action
必要时更新 Stage/Run
写 Outbox
```

这些可以在一个 PostgreSQL 事务中完成。

### Run Event Log

采用 append-only Event Log，但不要求系统完全 Event Sourced。

也就是说：

- 状态表是当前事实的快速索引；
- Event Log 是审计和报告依据；
- 不要求每次启动都从所有 Event 重放全部状态。

---

## 聚合 6：DatasetMigrationRun

Root：

```text
DatasetMigrationRun
```

TransferSession 是其独立受控子根。

建议表：

```text
dataset.execution_contracts
dataset.migration_runs
dataset.stage_runs
dataset.consistency_checkpoints
dataset.verification_results
dataset.commit_records

dataset.transfer_sessions
dataset.transfer_manifests
dataset.transfer_parts
dataset.transfer_checkpoints
dataset.transfer_events
```

### 大型 Manifest

不要把百万文件的 Manifest 全部直接塞进普通 JSONB 行。

采用两级结构：

```text
数据库：
- manifest id
- root hash
- totals
- object storage ref
- index partitions

对象存储：
- compressed/encrypted manifest segments
```

需要分页展示时，建立分段索引：

```text
dataset.transfer_manifest_segments
```

### TransferPart

大量 Part 可以独立更新。

但必须通过：

- session lease；
- fencing token；
- expected state；
- unique part key；

防止重复执行。

---

## 聚合 7：Secret

Secret 领域有两个主要根：

```text
SecretProviderBinding
SecretDeliveryRun
```

SecretRequirement 属于 Blueprint 内容，但可以建立关系型索引。

建议表：

```text
secret.requirement_index
secret.provider_configs
secret.provider_bindings
secret.execution_contracts

secret.delivery_runs
secret.resolutions
secret.materializations
secret.validation_results
secret.rotation_records
secret.input_sessions
secret.gates
secret.audit_events
```

### 关键边界

普通数据库中不保存：

- Secret 明文；
- Provider Token；
- 解密后的 SOPS 内容；
- 私钥。

`provider_configs` 只保存：

- 非敏感配置；
- 控制面凭据引用。

### 输入会话

一次性 User Input Session 应独立建模，过期后只保留：

- 谁提交；
- 是否消费；
- fingerprint；
- 时间。

不保存值。

---

## 聚合 8：CutoverRun

Root：

```text
CutoverRun
```

附属对象：

- WriteAuthorityRecord；
- TrafficSwitchRun；
- ObservationRun；
- TargetWriteMonitor；
- CommitRecord。

建议表：

```text
cutover.contracts
cutover.runs
cutover.checkpoints

cutover.write_authority_records
cutover.traffic_provider_bindings
cutover.traffic_route_snapshots
cutover.traffic_switch_runs

cutover.business_verification_runs
cutover.business_verification_results
cutover.observation_runs
cutover.observation_samples

cutover.target_write_monitors
cutover.target_write_observations

cutover.commit_records
cutover.rollback_runs
cutover.reconciliation_runs
```

### Authority 更新

写入权转移必须是独立、事务性记录：

```text
撤销 Source Authority
→ 写 Authority Event
→ 创建 NONE 状态记录
```

然后 Final Sync 完成后：

```text
Grant Target Authority
```

不能只通过修改：

```text
cutover_runs.authority = target
```

覆盖历史。

---

## 聚合 9：EnvironmentArchive

稳定根：

```text
EnvironmentArchive
```

不可变版本根：

```text
ArchiveVersion
```

执行子根：

- ArchiveReplica；
- ScrubRun；
- RestoreDrillRun；
- ArchiveRepairRun。

建议表：

```text
archive.archives
archive.versions
archive.object_index
archive.object_references

archive.repository_bindings
archive.replicas
archive.replica_objects

archive.encryption_envelopes
archive.key_availability_checks
archive.signatures

archive.scrub_policies
archive.scrub_runs
archive.scrub_results
archive.repair_runs

archive.restore_drill_policies
archive.restore_drill_runs
archive.restore_drill_results

archive.retention_policies
archive.legal_holds
archive.deletion_records

archive.source_release_results
archive.source_release_commits
```

大型 Archive Manifest 存对象存储，数据库保存：

- Root Hash；
- Header；
- Manifest Object Ref；
- 必要索引；
- 健康状态。

---

# 五、非聚合：Report 与 Projection

Report 不应成为可修改业务根。

它是不可变执行证据：

```text
ReportArtifact
```

建议表：

```text
projection.project_summaries
projection.workload_summaries
projection.plan_summaries
projection.run_summaries
projection.archive_health

audit.report_artifacts
```

Report 生成输入：

- Run Event；
- Action Attempt；
- Dataset Commit；
- Secret Delivery 状态；
- Verification；
- Cutover Commit；
- Archive Manifest/Scrub/Drill。

Report 不读取 Plan 后自行推测“应该成功”。

---

# 六、跨聚合引用规则

## 1. 同模块内部使用数据库外键

例如：

```text
workload.blueprint_revisions.workload_id
→ workload.workloads.id
```

应使用 FK。

## 2. 跨模块引用避免级联删除

例如：

```text
planning.plan_revisions
→ workload.blueprint_revisions
```

可以使用 FK，也可以只保存 ID + Hash。

更推荐保存：

```text
blueprint_revision_id
blueprint_hash
```

即使后续 Workload 被归档，Plan 仍可证明输入。

禁止跨模块 `ON DELETE CASCADE`。

## 3. 不可变执行绑定同时保存 ID 与 Hash

例如：

```text
Plan
→ Blueprint Revision ID + Hash

Run
→ Plan Revision ID + Hash

Restore Plan
→ Archive Version ID + Manifest Root Hash
```

ID 负责定位，Hash 负责证明内容没有变化。

---

# 七、统一主键、版本和时间规范

## ID

建议所有领域实体使用：

```text
UUIDv7
```

优点：

- 全局唯一；
- 大致按时间排序；
- PostgreSQL 索引局部性优于随机 UUIDv4；
- Worker 可在客户端生成。

## 乐观锁

所有可变聚合根包含：

```text
version BIGINT NOT NULL
```

命令必须携带：

```text
expectedVersion
```

更新：

```sql
UPDATE ...
SET version = version + 1
WHERE id = :id
  AND version = :expected_version;
```

更新 0 行表示并发冲突。

## Revision

不可变文档使用：

```text
revision INTEGER
UNIQUE(root_id, revision)
```

## 时间

统一使用：

```text
TIMESTAMPTZ
```

数据库保存 UTC，API 返回带偏移 ISO 8601。

## Hash

统一使用：

```text
SHA-256
```

Hash 输入必须是 canonical serialization。

不能直接对普通 JSON stringify 结果 Hash，因为字段顺序和数字格式可能变化。

---

# 八、JSONB、关系表与对象存储的边界

## 适合 JSONB

- Blueprint Revision；
- DecisionSet Revision；
- Plan Compiler Trace；
- Capability metadata；
- Compatibility Result；
- Read-only Verification definition；
- 小型 immutable contract。

特点：

- 不可变；
- 主要整体读写；
- 需要 Schema Version；
- 需要 content hash。

## 适合关系表

- Project；
- Workload；
- Plan status/index；
- Run/Stage/Action；
- Queue；
- Lease；
- Gate；
- Transfer progress；
- Resource lock；
- Archive replica；
- Audit event。

特点：

- 高频局部更新；
- 并发控制；
- 状态过滤；
- Worker 调度；
- 唯一性约束。

## 适合对象存储

- Snapshot 原始大 Artifact；
- 完整配置 Artifact；
- 日志；
- Dump；
- 文件 Chunk；
- 大型 Manifest；
- Report 文件；
- Archive 内容；
- Verification evidence。

数据库只保存：

```text
artifact_id
object_key
content_hash
size
content_type
encryption metadata
```

---

# 九、统一 Artifact 模型

```ts id="ot8u5w"
interface ArtifactRecord {
  id: string;
  workspaceId: string;

  kind:
    | "snapshot"
    | "config"
    | "plan"
    | "log"
    | "evidence"
    | "database-dump"
    | "transfer-manifest"
    | "report"
    | "archive-object";

  storageProviderId: string;
  objectKey: string;

  contentHash: string;
  storedHash?: string;

  bytes: number;
  contentType: string;

  encryptionEnvelopeId?: string;

  state:
    | "pending"
    | "available"
    | "corrupt"
    | "deleted";

  createdAt: string;
}
```

普通 Artifact 与 Environment Archive Object 可以共享底层存储接口，但 Archive 应保持独立生命周期和加密策略。

---

# 十、事务、Outbox 与 Inbox

## 命令事务

每个命令：

```text
验证权限
→ 读取聚合和 expected version
→ 校验状态转换
→ 修改状态
→ 追加 Domain Event
→ 写 Outbox
→ Commit
```

## Outbox

```text
audit.outbox_messages
```

字段：

```text
id
event_type
aggregate_type
aggregate_id
payload_json
created_at
published_at
attempt_count
```

用于：

- 更新 Projection；
- 调度 Worker；
- 发送通知；
- 触发后续聚合处理。

## Inbox

Worker 和异步 Handler 使用：

```text
audit.inbox_messages
```

记录已消费 Message ID，防止重复处理。

## 不是 Exactly Once

系统应采用：

```text
At-least-once delivery
+
Idempotent consumer
+
Unique command/action key
```

不要声称实现真正 Exactly Once。

---

# 十一、Durable Queue 的数据库实现

首期可以直接使用 PostgreSQL Queue：

```text
execution.run_queue
```

Worker 使用：

```sql
SELECT ...
FROM execution.run_queue
WHERE available_at <= now()
ORDER BY priority DESC, queued_at
FOR UPDATE SKIP LOCKED
LIMIT 1;
```

Claim 事务中同时：

- 更新 Queue Entry；
- 更新 Run 状态；
- 创建 Lease；
- 增加 fencing token；
- 追加 Event。

后续规模需要时，可以替换队列实现，但 Run 状态仍以 PostgreSQL 为权威事实源。

---

# 十二、多租户与 Workspace 边界

每张业务表都应包含：

```text
workspace_id
```

即使首期只有单用户，也应保留该字段。

原因：

- 用户未来可能管理多个组织；
- Archive 和 Secret 必须隔离；
- Artifact 去重和权限依赖 Workspace；
- 后补 tenant boundary 成本高。

建议所有唯一约束包含 Workspace，例如：

```text
UNIQUE(workspace_id, project_slug)
```

首期可以在应用层校验；后续可增加 PostgreSQL RLS。

---

# 十三、删除与归档规则

## 永久保留或长期保留

不得普通硬删除：

- Plan Revision；
- Approval；
- Execution Run；
- Action Attempt；
- Cutover Commit；
- Source Release Commit；
- Audit Event；
- Report。

只允许：

```text
archived
retention-expired
redacted
```

## 可显式删除

- Connection；
- 临时 Artifact；
- 过期 Secret Input Session；
- failed staging；
- Archive Version，但必须经过删除状态机。

## Project 删除

建议首期只支持：

```text
Archive Project
```

不支持级联物理删除整个项目。

---

# 十四、API 总体风格

API 使用：

```text
/api/v1
```

资源读取采用 REST 风格，状态变化采用明确命令。

避免：

```http
PATCH /runs/:id
{
  "state": "succeeded"
}
```

采用：

```http
POST /runs/:id/pause
POST /runs/:id/resume
POST /runs/:id/cancel
POST /runs/:id/commit
```

状态由服务端状态机决定。

---

# 十五、API 公共约定

## 请求头

状态改变命令建议支持：

```http
Idempotency-Key: <uuid>
If-Match: "<aggregate-version>"
```

Worker 内部请求还需要：

```http
X-Worker-Id
X-Claim-Token
X-Fencing-Token
```

## 响应

创建资源：

```http
201 Created
Location: /api/v1/...
```

创建异步 Run：

```http
202 Accepted
Location: /api/v1/runs/<id>
```

状态冲突：

```http
409 Conflict
```

版本不匹配：

```http
412 Precondition Failed
```

领域字段无效：

```http
422 Unprocessable Content
```

资源被锁：

```http
423 Locked
```

已撤销或不再允许的旧操作：

```http
410 Gone
```

## 错误格式

统一：

```json
{
  "type": "https://envforge.dev/problems/plan-not-approved",
  "title": "Plan is not approved",
  "status": 409,
  "code": "PLAN_NOT_APPROVED",
  "detail": "An active approval matching the plan hash is required.",
  "instance": "/api/v1/plans/...",
  "errors": [],
  "currentState": "approval-pending",
  "expectedVersion": 12
}
```

---

# 十六、Project 与 Discovery API

```http
POST /api/v1/projects
GET  /api/v1/projects
GET  /api/v1/projects/{projectId}
POST /api/v1/projects/{projectId}/archive

POST /api/v1/projects/{projectId}/endpoints
GET  /api/v1/projects/{projectId}/endpoints

POST /api/v1/endpoints/{endpointId}/snapshot-runs
GET  /api/v1/snapshot-runs/{runId}
GET  /api/v1/snapshots/{snapshotId}

POST /api/v1/snapshots/{snapshotId}/candidate-generations
GET  /api/v1/candidate-generations/{generationId}
GET  /api/v1/candidate-generations/{generationId}/candidates
```

Snapshot 采集是异步 Run，不能由同步 HTTP 请求完成。

---

# 十七、Candidate Review API

```http
POST /api/v1/candidate-generations/{generationId}/review-sessions
GET  /api/v1/candidate-review-sessions/{sessionId}

POST /api/v1/candidate-review-sessions/{sessionId}/confirm
POST /api/v1/candidate-review-sessions/{sessionId}/merge
POST /api/v1/candidate-review-sessions/{sessionId}/split
POST /api/v1/candidate-review-sessions/{sessionId}/reassign-evidence
POST /api/v1/candidate-review-sessions/{sessionId}/mark-shared
POST /api/v1/candidate-review-sessions/{sessionId}/exclude-evidence
POST /api/v1/candidate-review-sessions/{sessionId}/answer-question

POST /api/v1/candidate-review-sessions/{sessionId}/preview-blueprint
POST /api/v1/candidate-review-sessions/{sessionId}/promote
```

`promote` 创建：

- Workload；
- Draft/Confirmed Blueprint Revision；
- Promotion Record。

---

# 十八、Workload 与 Blueprint API

```http
GET  /api/v1/workloads
GET  /api/v1/workloads/{workloadId}
POST /api/v1/workloads/{workloadId}/archive

GET  /api/v1/workloads/{workloadId}/blueprints
GET  /api/v1/blueprint-revisions/{revisionId}

POST /api/v1/blueprint-revisions/{revisionId}/draft-successor
POST /api/v1/blueprint-revisions/{revisionId}/confirm
POST /api/v1/blueprint-revisions/{revisionId}/evaluate-readiness

GET  /api/v1/blueprint-revisions/{revisionId}/drift
POST /api/v1/blueprint-update-proposals/{proposalId}/accept
POST /api/v1/blueprint-update-proposals/{proposalId}/reject
```

不要允许：

```http
PATCH /blueprint-revisions/{id}
```

已确认 Revision 不可修改。

Draft 可以通过专门编辑接口，保存时也应产生 Draft Document Version 或至少使用 optimistic lock。

---

# 十九、DecisionSet、Plan 与 Approval API

```http
POST /api/v1/projects/{projectId}/decision-set-revisions
GET  /api/v1/decision-set-revisions/{revisionId}

POST /api/v1/projects/{projectId}/plan-compilations
GET  /api/v1/plan-compilations/{compilationId}

GET  /api/v1/plans/{planRevisionId}
GET  /api/v1/plans/{planRevisionId}/actions
GET  /api/v1/plans/{planRevisionId}/risks
GET  /api/v1/plans/{planRevisionId}/gates

POST /api/v1/plans/{planRevisionId}/submit-for-approval
POST /api/v1/plans/{planRevisionId}/approve
POST /api/v1/plans/{planRevisionId}/reject
POST /api/v1/plans/{planRevisionId}/revoke
```

Plan Compilation 本身可以是短同步任务，也可以异步。

考虑到兼容性扫描和大型 DAG，建议统一异步：

```text
POST plan-compilations
→ 202
→ compilation result 创建 Plan Revision
```

---

# 二十、Execution API

```http
POST /api/v1/plans/{planRevisionId}/runs

GET  /api/v1/runs/{runId}
GET  /api/v1/runs/{runId}/stages
GET  /api/v1/runs/{runId}/actions
GET  /api/v1/runs/{runId}/events
GET  /api/v1/runs/{runId}/progress

POST /api/v1/runs/{runId}/pause
POST /api/v1/runs/{runId}/resume
POST /api/v1/runs/{runId}/cancel
POST /api/v1/runs/{runId}/retry
POST /api/v1/runs/{runId}/rollback

POST /api/v1/runs/{runId}/manual-gates/{gateId}/complete
```

进度传输：

```http
GET /api/v1/runs/{runId}/events/stream
```

可以使用 SSE。

SSE 断线后使用：

```text
Last-Event-ID
```

从 Event sequence 恢复。

---

# 二十一、Dataset API

```http
GET  /api/v1/runs/{runId}/dataset-runs
GET  /api/v1/dataset-runs/{datasetRunId}

POST /api/v1/dataset-runs/{datasetRunId}/pause
POST /api/v1/dataset-runs/{datasetRunId}/resume
POST /api/v1/dataset-runs/{datasetRunId}/retry
POST /api/v1/dataset-runs/{datasetRunId}/rollback

GET  /api/v1/dataset-runs/{datasetRunId}/transfers
GET  /api/v1/transfer-sessions/{transferSessionId}
GET  /api/v1/transfer-sessions/{transferSessionId}/progress
GET  /api/v1/transfer-sessions/{transferSessionId}/manifest
```

普通用户不能创建脱离 Plan 的生产 Dataset Run。

允许单独创建的应是：

```text
diagnostic transfer test
bandwidth benchmark
restore drill
```

并使用不同资源类型。

---

# 二十二、Secret API

```http
GET  /api/v1/projects/{projectId}/secret-requirements

POST /api/v1/projects/{projectId}/secret-provider-bindings
GET  /api/v1/secret-provider-bindings/{bindingId}
POST /api/v1/secret-provider-bindings/{bindingId}/validate

GET  /api/v1/runs/{runId}/secret-gates

POST /api/v1/runs/{runId}/secret-gates/{gateId}/input-sessions
POST /api/v1/secret-input-sessions/{sessionId}/submit

POST /api/v1/secret-delivery-runs/{deliveryRunId}/retry
POST /api/v1/secret-delivery-runs/{deliveryRunId}/rotate
POST /api/v1/secret-delivery-runs/{deliveryRunId}/revoke
```

Secret 输入接口必须单独配置：

- 请求日志禁用；
- body capture 禁用；
- error tracker payload 禁用；
- `Cache-Control: no-store`；
- 一次性 Token。

---

# 二十三、Cutover API

```http
GET  /api/v1/runs/{runId}/cutover
GET  /api/v1/cutover-runs/{cutoverRunId}
GET  /api/v1/cutover-runs/{cutoverRunId}/authority
GET  /api/v1/cutover-runs/{cutoverRunId}/traffic
GET  /api/v1/cutover-runs/{cutoverRunId}/verification
GET  /api/v1/cutover-runs/{cutoverRunId}/observation

POST /api/v1/cutover-runs/{cutoverRunId}/start
POST /api/v1/cutover-runs/{cutoverRunId}/resume-source
POST /api/v1/cutover-runs/{cutoverRunId}/commit
POST /api/v1/cutover-runs/{cutoverRunId}/rollback
```

Drain、Quiesce 和 Traffic Switch 通常由 Worker 按 Plan 自动执行。

只有需要人工边界时才暴露受控命令，不能让 UI 随意跳阶段。

---

# 二十四、Archive API

```http
POST /api/v1/archives
GET  /api/v1/archives
GET  /api/v1/archives/{archiveId}

GET  /api/v1/archives/{archiveId}/versions
GET  /api/v1/archive-versions/{versionId}
GET  /api/v1/archive-versions/{versionId}/health

POST /api/v1/archive-versions/{versionId}/scrub-runs
POST /api/v1/archive-versions/{versionId}/repair-runs
POST /api/v1/archive-versions/{versionId}/restore-drill-runs
POST /api/v1/archive-versions/{versionId}/restore-projects

GET  /api/v1/archive-versions/{versionId}/source-release-readiness
POST /api/v1/archive-versions/{versionId}/source-release-commit

POST /api/v1/archive-versions/{versionId}/replicas
POST /api/v1/archive-versions/{versionId}/deletion-requests
```

删除需要：

```text
request
→ approval
→ deletion run
→ deletion record
```

不使用普通 DELETE 立即删除。

---

# 二十五、Read Model API

UI 列表和 Dashboard 不应在请求时跨十几个写表做复杂 JOIN。

建立 Projection：

```http
GET /api/v1/project-summaries
GET /api/v1/workload-summaries
GET /api/v1/run-summaries
GET /api/v1/archive-health-summaries
GET /api/v1/attention-items
```

Projection 可以最终一致。

但以下安全判断必须读取权威写模型：

- 能否审批；
- 能否执行；
- 能否 Commit；
- 能否释放源；
- 能否删除 Archive。

不能依赖可能延迟的 Projection 决策。

---

# 二十六、权限模型

建议角色：

```text
Viewer
Operator
Approver
Secret Operator
Archive Administrator
Workspace Administrator
```

关键权限：

```text
project.create
candidate.review
blueprint.confirm
plan.compile
plan.approve
run.execute
run.pause
run.rollback
cutover.commit
secret.bind
secret.supply
secret.rotate
archive.restore
archive.source-release
archive.delete
archive.key-recover
```

高风险操作必须独立授权：

- Plan Approve；
- Cutover Commit；
- Source Release Commit；
- Archive Delete；
- Escrow Recover。

执行者和审批者是否必须分离，由 Workspace Policy 决定。

---

# 二十七、审计模型

统一 Audit Envelope：

```ts id="ncmjvw"
interface AuditRecord {
  id: string;
  workspaceId: string;

  actor: {
    type: "user" | "worker" | "system";
    id: string;
  };

  action: string;

  resourceType: string;
  resourceId: string;

  projectId?: string;
  runId?: string;

  requestId?: string;
  idempotencyKey?: string;

  beforeStateHash?: string;
  afterStateHash?: string;

  metadata: Record<string, unknown>;

  occurredAt: string;
}
```

Audit Metadata 必须通过脱敏管道。

---

# 二十八、模块间依赖方向

代码依赖建议：

```text
core
↑
discovery
↑
workload
↑
planning
↑
execution
```

横向执行模块：

```text
execution
├── dataset
├── secret
├── cutover
└── archive
```

具体规则：

- Discovery 不依赖 Planning；
- Workload 不依赖 Run；
- Blueprint 不读取 ActionRun；
- Planning 可以读取 Blueprint 和 Snapshot；
- Execution 只能读取不可变 Plan；
- Dataset/Secret/Cutover 只能执行 Plan 中已编译合同；
- Archive 消费 Capture Run 产物；
- Restore Planning 消费 Archive，不消费旧 Capture Actions。

---

# 二十九、Capability Adapter 边界

建议定义三个层次：

## Detection Adapter

负责：

- 从 Snapshot/Evidence 识别 Capability；
- 产生 Candidate 信号。

## Planning Adapter

负责：

- Compatibility；
- Action 模板；
- Dataset Strategy；
- Verification；
- Rollback 编译。

## Execution Adapter

负责：

- 执行结构化 Action；
- Reconciliation；
- before-state；
- postcondition；
- rollback。

同一个 Capability 不应通过一个巨大接口同时处理全部责任。

认证级别也分开：

```text
Detection Certified
Build Certified
Migration Certified
Capture Certified
Restore Certified
Verification Certified
Rollback Certified
```

---

# 三十、实施原则：采用纵向切片

不建议先花大量阶段把所有表和接口一次建完。

应按可以运行的纵向链路推进：

```text
Project
→ Blueprint
→ Plan
→ Run
→ Verify
→ Report
```

再扩展数据、Cutover 和 Archive。

每一阶段都必须：

- 有生产 Schema；
- 有迁移；
- 有 API；
- 有状态机测试；
- 有 Worker 集成测试；
- 有真实 Linux disposable VM 测试；
- 不通过 UI 文案夸大能力。

---

# 三十一、Phase 0：执行基础与数据模型基座

## 目标

在不改变现有产品主要能力前，建立所有后续模块依赖的基础。

## 实现

- PostgreSQL 正式作为权威存储；
- UUIDv7；
- workspace_id；
- optimistic version；
- canonical JSON；
- content hash；
- Artifact Store；
- Domain Event；
- Outbox/Inbox；
- Idempotency Key；
- API structured error；
- 数据库 Migration；
- Feature Flag；
- Audit Pipeline；
- Redaction Pipeline。

## 同时修复

- 当前 fresh runtime scenario harness；
- Web 测试运行环境；
- Playwright 浏览器安装和 CI 固化；
- 不允许新的进程内 Map 作为生产状态。

## 验收门槛

- API、Worker 重启后状态不丢失；
- 重复请求不会重复创建资源；
- 并发更新产生明确 409/412；
- Artifact Hash 可验证；
- Outbox 消费可以重复但结果幂等；
- Secret 字符串不会进入日志和错误报告。

## 本阶段不做

- Live Migration；
- Cutover；
- Archive；
- 复杂 Workload Builder。

---

# 三十二、Phase 1：Project、Discovery 与 Workload Candidate

## 目标

建立：

```text
Project
→ Endpoint
→ Snapshot
→ Candidate Generation
→ Candidate Review
→ Workload
```

## 实现

- EnvironmentProject；
- EnvironmentEndpoint；
- immutable Snapshot；
- Evidence normalization；
- Inventory Graph；
- Candidate Builder 强关系；
- Candidate Generation；
- Review Session；
- Confirm/Merge/Split/Reassign/Shared/Exclude；
- Workload Root；
- Blueprint Draft/Promotion；
- Critical Unassigned Evidence Gate。

## 当前对象迁移

```text
StoredMigrationSession
→ EnvironmentProject(type=migration)

ServiceStack
→ WorkloadCandidate
```

保留旧 API 的只读兼容适配，禁止旧接口继续创建新的可执行 Migration Plan。

## 验收场景

真实 Linux 主机：

- Nginx；
- Node.js/Python systemd；
- PostgreSQL；
- uploads；
- cron；
- `.env` SecretRef。

系统能够形成候选并由用户确认 Workload。

## 退出条件

- Candidate 不能直接生成 Plan；
- 所有 Candidate 推断可追溯到 Evidence；
- Merge/Split 后没有 Critical Evidence 丢失；
- 新 Snapshot 不修改旧 Candidate Generation。

---

# 三十三、Phase 2：Blueprint、DecisionSet 与 Plan Compiler

## 目标

建立真正的目标无关 Blueprint 和不可变 Plan Revision。

## 实现

- 完整 Blueprint Schema；
- Blueprint Revision；
- Readiness Gate；
- DecisionSet Revision；
- Compatibility Engine；
- BuildPlanCompiler；
- MigrationPlanCompiler 骨架；
- CapturePlanCompiler 骨架；
- RestorePlanCompiler 骨架；
- structured Plan Action DAG；
- Plan Hash；
- Plan Approval。

## 当前对象迁移

```text
EnvironmentPlan
→ PlanRevision revision 1
```

现有软件包安装计划可以转换成：

```text
legacy capability actions
```

但必须标记能力范围，不能把旧计划声明为完整 Migration Plan。

## 验收门槛

- Blueprint/Decision/Snapshot 任一变化产生新 Plan；
- Approved Plan 无法修改；
- Action 可追溯到 Blueprint、Decision、Capability 和 Evidence；
- Planner 不再直接消费原始 `snapshot.software[]` 生成完整迁移；
- Plan Review 清楚显示数据、Secret、验证和回滚缺失。

---

# 三十四、Phase 3：Durable Execution Kernel

## 目标

替换同步 HTTP Apply。

## 实现

- ExecutionRun；
- StageRun；
- ActionRun；
- ActionAttempt；
- Durable Queue；
- 独立 Worker；
- Lease；
- Heartbeat；
- Fencing Token；
- Resource Lease；
- Retry Policy；
- Reconciliation Probe；
- Checkpoint；
- Pause/Resume；
- Cancel；
- Crash Recovery Coordinator；
- Verification Gate；
- immutable Report Artifact；
- SSE Progress。

## 当前对象迁移

现有：

```text
ApplyRun
ActionRun
```

映射到新表。

已有同步 Adapter 暂时由 Worker 调用，但 HTTP API 只负责创建 Run。

## 强制测试

- Worker 在 Action 前崩溃；
- Action 执行中 SSH 断开；
- Action 成功但结果响应丢失；
- Worker Lease 过期后旧 Worker 恢复；
- API 重启；
- PostgreSQL 短暂中断；
- 重复 Pause/Resume；
- 重复创建 Run。

## 退出条件

- 无活动 Run 依赖进程内状态；
- Worker 崩溃后不会双执行；
- 副作用未知动作不会盲目重试；
- Run Report 只根据 Event 和 Artifact 生成。

---

# 三十五、Phase 4：Build 黄金链路与 Secret Engine

## 目标

先完成目标机单向 Build，验证新架构，但不承担源端 Cutover 风险。

## 实现

- Build Compiler 完整 MVP；
- Package；
- systemd；
- Config Artifact；
- Nginx；
- PostgreSQL 初始化；
- Git/Artifact Deployment；
- SecretRequirement；
- User Input；
- Target Existing；
- Regenerate；
- Vault；
- SOPS；
- systemd credential；
- Secret Gate；
- Runtime/HTTP/Data Verification；
- Build Rollback。

## 黄金场景

```text
新目标机
→ 创建用户
→ 安装 Node.js/PostgreSQL/Nginx
→ 部署应用
→ 注入 Secret
→ 初始化数据库
→ 启动服务
→ 执行业务验证
```

## 退出条件

- Build 成功必须有 Verification；
- 目标已有资源不会被错误删除；
- Secret 不进入日志、Plan 或 Checkpoint；
- Worker 崩溃后 Build 可以恢复或安全阻塞；
- Rollback 基于 before-state。

---

# 三十六、Phase 5：Dataset Migration Engine

## 目标

完成数据迁移能力，但暂不自动切流。

## 实现

### Filesystem

- initial/final rsync；
- staging；
- Manifest；
- Hash；
- bandwidth；
- pause/resume；
- source writer detection。

### PostgreSQL

- logical dump/restore；
- roles；
- grants；
- extensions；
- ownership；
- schema/row verification；
- target conflict policy。

### Docker Volume

- local driver；
- writer container；
- stop/final sync/start；
- owner/mode；
- verification。

### 通用能力

- DatasetExecutionContract；
- DatasetMigrationRun；
- TransferSession；
- ConsistencyCheckpoint；
- DatasetCommit；
- Resource Locks；
- Crash Recovery。

## 运行模式

此阶段可以支持：

```text
Prepare Migration
```

即：

- 目标准备；
- initial sync；
- 测试 restore；
- 不自动停止源；
- 不自动切流。

## 退出条件

- Final Sync 只能在 writer quiesced 后执行；
- required Dataset 必须有 Commit；
- PostgreSQL 不使用文件复制冒充逻辑迁移；
- Transfer 恢复依据目标 Hash；
- 目标已有数据库默认阻塞。

---

# 三十七、Phase 6：Live Migration、Cutover 与安全回滚

## 目标

完成首个被严格证明的在线迁移闭环。

## 实现

- Maintenance Window；
- downtime budget；
- Drain；
- Quiesce；
- Write Authority；
- Final Sync Gate；
- Target passive/active；
- Nginx Traffic Provider；
- 结构化手工 DNS；
- Business Verification；
- External Probe；
- Observation；
- Target Write Monitor；
- Cutover Commit；
- independent Rollback Run；
- Source Retention。

## 首期限制

只对明确认证的黄金场景开放：

```text
单源
单目标
Nginx
systemd Web App
PostgreSQL logical migration
filesystem uploads
有限 cron/timer
```

不支持：

- active-active；
- 跨区多节点；
- 自动 weighted canary；
- 共享复杂 Redis；
- 近零停机 PostgreSQL replication；
- 不可识别 writer 的 Dataset。

## 强制故障测试

在以下时点主动杀 Worker：

- Source Quiesce 后；
- Final Sync 中；
- Target Start 后；
- Traffic Switch API 超时后；
- Business Verification 失败后；
- Rollback 中。

## 退出条件

- Traffic Switch 不会直接标记成功；
- 没有 CutoverCommitRecord 就没有 Migration Success；
- 目标新写入后不会自动无脑回切；
- Source Quiesce 后不能普通 Cancel；
- 真实 SSH 双 VM 迁移通过；
- 报告明确区分全回滚、部分回滚和不可回滚。

---

# 三十八、Phase 7：Capture、Environment Archive 与 Restore

## 目标

完成 Preserve & Restore 闭环。

## 实现

- Capture Compiler；
- ArchiveRepository；
- immutable ArchiveVersion；
- encrypted Manifest；
- Dataset Archive；
- Deployment Artifact；
- Config Artifact；
- Secret Recovery Policy；
- Envelope Encryption；
- Signature；
- Replica Policy；
- Scrub；
- Repair；
- Restore Drill；
- Source Release Gate；
- Restore Project；
- Restore Compiler；
- Restore Run；
- Archive Import；
- Retention/Delete。

## 首期 Repository

- S3-compatible；
- Local Filesystem；
- 可选 SSH storage。

## 退出条件

- Capture 上传完成不等于 Archive available；
- Archive 可以在控制面数据库丢失后重新导入；
- key availability 被实际验证；
- required Dataset 可重建；
- Restore Drill 能启动黄金 Workload；
- 没有 SourceReleaseCommitRecord 不建议删除源服务器；
- Restore 总是针对新 Target 重新编译 Plan。

---

# 三十九、Phase 8：生产强化与能力认证

## 目标

从“黄金路径可用”提升到生产可托付。

## 实现

- PostgreSQL HA/backup；
- Worker 水平扩展；
- Queue starvation 处理；
- Resource Lock 监控；
- Projection rebuild；
- Artifact lifecycle；
- Archive 多故障域；
- 性能基准；
- 安全审计；
- RBAC；
- 双人审批；
- Capability certification harness；
- 支持包；
- Schema/Archive format migration；
- 可观测性；
- 容量和速率限制；
- chaos tests。

## Capability 认证矩阵

每个 Capability 必须明确：

| 能力 | 状态 |
|---|---|
| Detect | experimental/certified |
| Build | experimental/certified |
| Migrate | experimental/certified |
| Capture | experimental/certified |
| Restore | experimental/certified |
| Verify | experimental/certified |
| Rollback | none/partial/full-certified |

UI 只根据认证范围展示可执行能力。

---

# 四十、禁止跨阶段透支能力

以下行为必须禁止：

## Phase 1 前

不能称系统已经识别完整 Workload。

## Phase 2 前

不能把软件列表称为完整迁移 Plan。

## Phase 3 前

不能把同步 HTTP Apply 称为可恢复 Durable Execution。

## Phase 5 前

不能声称支持数据迁移。

## Phase 6 前

不能声称支持完整 Live Migration。

## Phase 7 前

不能把普通备份文件称为可验证 Environment Archive。

## Restore Drill 前

不能把“可以编译 Restore Plan”称为“已验证可恢复”。

---

# 四十一、测试分层

## 1. Domain Invariant Tests

测试：

- 状态机；
- Revision 不可变；
- Approval Hash；
- Authority；
- Commit；
- Resource Ownership；
- Archive Health。

## 2. Compiler Golden Fixtures

输入固定：

- Blueprint；
- DecisionSet；
- Snapshot；
- Capability。

验证：

- Plan Hash；
- Action DAG；
- Risk；
- Gate；
- Rollback。

## 3. Adapter Contract Tests

每个 Adapter 必须测试：

- detect；
- precondition；
- execute；
- reconcile；
- verify；
- rollback；
- redaction。

## 4. Disposable VM Integration

使用真实 Linux VM/Container Host：

- systemd；
- Nginx；
- PostgreSQL；
- Docker；
- SSH；
- 文件权限。

## 5. Crash Matrix

每个关键 Action 在以下时点崩溃：

```text
before execute
during execute
after side effect
before checkpoint
after checkpoint
before response
```

## 6. End-to-End Scenario

至少建立：

```text
Build Golden Scenario
Migration Golden Scenario
Capture/Restore Golden Scenario
Archive Corruption Scenario
Secret Provider Failure Scenario
Cutover Rollback Scenario
```

---

# 四十二、数据库迁移策略

从现有模型迁移时，不建议长期双写旧表和新表。

推荐：

## Step 1：添加新 Schema

不修改旧读取行为。

## Step 2：Backfill

例如：

```text
StoredMigrationSession
→ core.projects

EnvironmentPlan
→ planning.plan_revisions

ApplyRun
→ execution.runs
```

Backfill 记录：

```text
legacy_source_type
legacy_source_id
migration_batch_id
```

## Step 3：Compatibility Adapter

旧 API 请求转译为新 Command。

新模型成为唯一写入事实源。

## Step 4：切换读取

UI 改读 Projection。

## Step 5：冻结旧写接口

返回：

```text
410 Gone
```

或明确迁移提示。

## Step 6：保留旧表只读一段时期

完成核对后再归档。

### 不建议

```text
旧表写一次
新表再写一次
```

如果没有严格事务保证，会产生不可恢复分叉。

---

# 四十三、现有模型映射

| 当前对象 | 新模型 |
|---|---|
| StoredMigrationSession | core.projects |
| Source/Target Connection | core.project_endpoints + connection ref |
| Snapshot | discovery.snapshots |
| Inventory Entity | discovery.evidence |
| InventoryGraph | discovery.evidence_relations / graph artifact |
| ServiceStack | discovery.workload_candidates |
| ConfigChecklist | candidate questions / blueprint requirements |
| Migration Decision | planning.decision_set_revisions |
| EnvironmentPlan | planning.plan_revisions |
| Approval fields | planning.plan_approvals |
| ApplyRun | execution.runs |
| ActionRun | execution.action_runs |
| Verify result | execution verification run/result |
| Rollback result | independent rollback run |
| Dynamic Plan Report | immutable report artifact projection |

---

# 四十四、首个生产级纵向目标

不要把“所有模型建表完成”定义为第一个成功目标。

第一个真正有价值的目标应是：

```text
用户连接一台空目标 Linux 主机
→ 选择已确认的 Web App Blueprint
→ 编译 Build Plan
→ 审批
→ Durable Worker 执行
→ Secret 安全注入
→ systemd/Nginx/PostgreSQL 启动
→ Business Verification
→ 不可变 Report
```

它能验证：

- Project；
- Blueprint；
- Plan；
- Approval；
- Run；
- Worker；
- Secret；
- Verification；
- Rollback；
- Report。

之后再把 Source、Dataset 和 Cutover 加入同一链路。

---

# 四十五、第二个生产级纵向目标

```text
Source 与 Target 同时存在
→ 识别并确认黄金 Workload
→ initial sync uploads
→ PostgreSQL logical restore test
→ 维护窗口
→ drain/quiesce
→ final sync
→ target activation
→ Nginx/manual DNS switch
→ business verification
→ observation
→ commit
→ source retention
```

只有这个场景在真实双 VM、真实 SSH 和故障注入下通过，才应正式标记：

```text
Live Migration：Supported
```

---

# 四十六、第三个生产级纵向目标

```text
确认 Workload
→ Capture Plan
→ Archive Version
→ 两个存储副本
→ 加密 Manifest
→ Full Scrub
→ Isolated Restore Drill
→ Source Release Commit
→ 删除源 VM
→ 从 Archive 恢复到新 VM
→ Business Verification
```

只有该场景真实通过，Preserve & Restore 才形成完整产品闭环。

---

# 四十七、实施优先级总结

正式优先级建议为：

```text
P0  数据模型基座、Hash、Artifact、Outbox、Redaction
P1  Project、Snapshot、Candidate、Workload、Blueprint
P2  DecisionSet、Plan Compiler、Approval
P3  Durable Execution、Checkpoint、Crash Recovery
P4  Build 黄金路径、Secret、Verification、Rollback
P5  Dataset、Transfer、PostgreSQL、Filesystem、Volume
P6  Cutover、Traffic、Observation、Commit、Rollback
P7  Capture、Archive、Scrub、Drill、Restore
P8  多用户、安全、HA、规模和更多 Capability
```

不能把 P6/P7 的 UI 先做出来，再由旧同步执行内核支撑。

---

# 四十八、最终架构决策

1. 首期使用模块化单体，不提前拆微服务。
2. API 与 Worker 分进程，不能继续同步 HTTP Apply。
3. 使用单一 PostgreSQL 作为状态与调度权威源。
4. 使用对象存储保存 Artifact、Manifest、Dump 和 Archive。
5. 数据库按领域 Schema 分区。
6. EnvironmentProject 是用户工作空间根。
7. Snapshot、Blueprint、DecisionSet 和 Plan 使用不可变 Revision。
8. Plan、Run、Dataset、Secret、Cutover 和 Archive 是独立聚合边界。
9. Run 子对象可以独立持久化，但必须受 Run Root 和 fencing token 控制。
10. Event Log 是审计事实，状态表是当前索引，不强制全面 Event Sourcing。
11. 跨聚合异步协调使用 Transactional Outbox。
12. 消费采用至少一次投递与幂等 Handler。
13. 所有写命令使用 Idempotency Key 和 optimistic version。
14. 状态变更使用明确命令，不开放任意状态 PATCH。
15. UI 列表读取 Projection，安全门禁读取权威写模型。
16. Blueprint、Plan 等复杂不可变合同使用 canonical JSONB 和 content hash。
17. 高频状态、队列、Lease、Action、Transfer 使用关系表。
18. 大型 Artifact 和 Manifest 使用对象存储。
19. 每张业务表预留 workspace_id。
20. 跨模块禁止级联删除。
21. Run、Approval、Commit 和审计记录不能普通硬删除。
22. Secret 明文不进入普通数据库。
23. Archive 删除必须经过独立删除状态机。
24. Capability Detection、Planning 和 Execution Adapter 必须分层。
25. 实施采用纵向切片，而不是先构建所有抽象。
26. Build 是第一条端到端生产链路。
27. Dataset 是 Live Migration 前置条件。
28. Cutover 必须在 Durable Execution 和 Dataset Engine 后实现。
29. Archive 必须在 Dataset、Secret 和 Verification 成熟后实现。
30. 产品能力声明必须绑定真实场景测试和 Capability 认证。

下一项最有价值的设计产物是把这一基线下沉成 **PostgreSQL DDL 草案、关键唯一约束、索引、状态转换 SQL 以及 Outbox/Lease 的事务伪代码**。

## Prompt:
2026/7/18 23:09:05

请问还有需要确定的内容吗？以及要完成我的想法的细节，是不是应该将整个想法整合成具体的方案设计了？
请你仔细分析整个设计应该怎么整合，最后怎么运用到实际中

## Response:
2026/7/18 23:09:15

我会把前面所有领域设计收束成一份“总体方案设计蓝图”：先判断哪些内容已经闭环、哪些仍是关键空白，再给出统一架构、文档体系、实施顺序、验收标准和实际落地方法。

是的。**领域模型已经基本完成闭环，现在继续逐个扩展对象的边际收益开始下降，应该正式进入“总体方案设计与工程落地”阶段。**

前面的讨论已经回答了“系统应该有哪些核心能力、对象和状态机”；下一步要回答的是：

> 这些设计怎样形成一个能够开发、测试、部署、运营，并且不会夸大能力的真实产品。

**document: **

# EnvForge 总体方案设计与实际落地蓝图

## 一、总体判断

EnvForge 的核心设计已经从最初的“服务器迁移工具”发展为：

> 一个以 Workload 为中心，能够发现、解释、重建、迁移、封存和恢复 Linux 业务环境的自托管环境生命周期平台。

目前已经完成的核心闭环包括：

```text
服务器发现
→ Workload 推断
→ 用户确认业务边界
→ Workload Blueprint
→ DecisionSet
→ Plan Revision
→ Durable Execution Run
→ Dataset / Secret / Cutover
→ Verification / Rollback
→ Environment Archive
→ Restore Drill
→ Restore
```

这意味着最重要的领域问题已经基本确定：

- 什么是 Workload；
- 什么是机器推断，什么必须由用户确认；
- Blueprint 和 Plan 如何分离；
- Plan 如何成为不可变执行合同；
- Run 如何支持重试、暂停、Checkpoint 和崩溃恢复；
- 数据如何初始同步、最终同步和验证；
- Secret 如何在不保存明文的情况下交付；
- Cutover 如何处理写入权、流量、验证和回滚；
- Archive 如何加密、复制、Scrub 和 Restore Drill。

现在不应该继续无限细化孤立对象，而应该把它们整合成：

1. 产品方案；
2. 系统架构；
3. 数据和 API 设计；
4. 安全模型；
5. 实施路线；
6. 测试与认证体系；
7. 实际部署和运营方案。

---

# 二、仍然需要确定的内容

虽然核心业务闭环已经完整，但还有若干横向问题必须在正式开发前确定。

这些内容不是新的大型领域模型，而是将现有模型真正产品化所需的约束。

---

## 1. 产品定位与首期边界

必须正式决定 EnvForge 首期到底服务谁。

建议首期目标用户：

- 个人开发者；
- 小型团队；
- 自托管服务用户；
- 使用一到数台 Linux VPS；
- 使用 systemd、Docker Compose、Nginx、PostgreSQL；
- 希望换服务器、重建环境或保存服务器后释放资源。

首期不应定位为：

- 企业级云迁移平台；
- Kubernetes 多集群迁移平台；
- 任意数据库零停机迁移平台；
- 云厂商无关 Disaster Recovery 平台；
- 自动理解所有自定义业务的 AI 运维系统。

建议首期产品承诺：

```text
可以可靠分析和重建常见 Linux Web Workload；
可以在明确支持的技术栈中完成有验证和回滚边界的迁移；
可以创建经过完整性验证的可恢复 Archive。
```

不能承诺：

```text
一键迁移任何服务器且绝不停机、绝不丢数据。
```

---

## 2. 支持矩阵

必须建立正式的支持矩阵。

例如：

| 能力 | 首期支持 |
|---|---|
| OS | Ubuntu 22.04/24.04、Debian 12 |
| 架构 | x86_64 |
| 服务管理 | systemd |
| 反向代理 | Nginx |
| 应用 | Node.js、Python、自定义二进制 |
| 数据库 | PostgreSQL 14–16 |
| 容器 | Docker、Docker Compose |
| 文件传输 | rsync/SSH |
| Archive | S3-compatible、Local |
| Secret | User Input、Target Existing、Vault、SOPS |
| 流量切换 | Nginx、结构化手工 DNS |

每个支持项都要区分：

```text
Detect
Build
Migrate
Capture
Restore
Verify
Rollback
```

例如：

```text
PostgreSQL
Detect: Certified
Build: Certified
Migration: Logical only
Capture: Certified
Restore: Certified
Rollback: Partial
```

没有支持矩阵，UI 很容易把“可以检测”误展示成“可以迁移”。

---

## 3. 信任与安全模型

需要单独形成 Threat Model。

至少确定：

- EnvForge API 被攻破后能做什么；
- Worker 被攻破后的影响；
- SSH 凭据如何保存；
- Secret Provider Credential 如何保存；
- Archive Key 如何管理；
- Artifact 是否加密；
- 日志和 Support Bundle 如何脱敏；
- 哪些操作要求再次认证；
- 是否支持多人审批；
- Worker 是否允许执行任意 Shell；
- Adapter 如何签名、审核和升级；
- 插件能访问哪些资源。

建议明确三类权限域：

```text
Control Plane
Execution Plane
Secret / Key Plane
```

即使首期运行在同一台服务器，逻辑权限也要分开。

---

## 4. Connection 与远程 Agent 模型

前面主要讨论了 SSH，但还需要正式决定执行连接方式。

建议首期：

```text
Agentless SSH
```

优点：

- 用户部署门槛低；
- 适合 VPS；
- 不需要长期驻留 Agent。

但需要解决：

- SSH 会话重连；
- sudo；
- 远程临时目录；
- 文件上传；
- 命令超时；
- 目标机器重启；
- host key；
- privilege boundary；
- shell 差异。

未来可以增加可选 Agent：

```text
EnvForge Agent
```

用于：

- 高可靠 Heartbeat；
- 大文件传输；
- 本地 Checkpoint；
- 文件系统变化跟踪；
- 长期监测；
- 网络受限环境。

但首期不要同时建设 Agentless 和完整 Agent 两套执行系统。

---

## 5. Capability SDK 与认证体系

前面的所有执行能力都依赖 Capability Adapter，因此必须正式定义：

```text
Capability Package
├── Detection Rules
├── Blueprint Schema Extension
├── Compatibility Rules
├── Plan Compiler
├── Execution Adapter
├── Verification Checks
├── Rollback Rules
└── Certification Fixtures
```

需要确定：

- Capability 如何注册；
- 如何版本化；
- 如何声明支持范围；
- 如何禁止未认证 Adapter 进入生产 Cutover；
- 如何执行安全审查；
- 是否允许第三方插件；
- Adapter 升级是否使旧 Plan 失效；
- Archive 恢复时如何获得旧 Adapter。

建议首期 Capability 内置在主仓库中，不开放任意第三方插件执行生产命令。

---

## 6. 用户体验与风险沟通

领域模型已经非常完整，但用户不应该直接面对所有技术对象。

需要形成三层 UI：

### 普通视图

回答：

- EnvForge 发现了什么；
- 还需要用户确认什么；
- 是否可以迁移；
- 会停机多久；
- 哪些内容不会迁移；
- 是否可以回滚。

### 高级视图

显示：

- Blueprint；
- Dataset；
- Secret；
- Cutover；
- Verification；
- Archive。

### 专家视图

显示：

- Action DAG；
- Adapter；
- Hash；
- Checkpoint；
- Event；
- 资源锁；
- Compiler Trace。

不能把复杂度全部压给普通用户，也不能为了简单而隐藏真实风险。

---

## 7. 非功能需求

必须给系统定义明确的非功能目标。

例如：

### 数据可靠性

- Plan、Run、Approval 和 Commit 不允许因进程重启丢失；
- Archive Manifest 必须可独立导入；
- Worker 崩溃不能造成重复 Cutover；
- Secret 明文不能进入日志。

### 可恢复性

- API 重启后 Run 可以继续；
- Worker 失联后 Lease 能接管；
- 数据库恢复后 Projection 可重建；
- 控制面数据库丢失后 Archive 可以重新导入。

### 性能

首期可以设定：

- 一个 Workspace 同时运行 5 个 Execution Run；
- 单 TransferSession 支持数百 GB；
- 文件 Manifest 支持百万级条目；
- Run Event 支持持续流式展示。

### 可观测性

必须监控：

- Queue 深度；
- Worker Lease；
- 长时间无 Heartbeat；
- Resource Lock；
- Transfer Rate；
- Archive Scrub 失败；
- Secret Provider 可用性；
- Critical Section Run。

---

## 8. 升级和兼容策略

需要确定：

- 数据库 Schema 如何升级；
- Blueprint Schema 如何升级；
- Plan 是否长期可读；
- Archive 格式支持多久；
- Capability 旧版本如何保留；
- 执行中的 Run 能否跨版本升级；
- API 升级时 Worker 是否兼容。

建议：

- 执行中的 Run 固定 Worker/Adapter Compatibility Version；
- 新版本发布时不自动迁移活动 Run；
- Archive 格式采用明确 Reader Version；
- 旧 Blueprint 通过派生 Revision 升级，不原地修改。

---

## 9. 合规、隐私与数据生命周期

即使产品主要面向自托管，也必须决定：

- Snapshot 中哪些信息属于敏感信息；
- 文件路径和域名是否加密；
- 日志保留多久；
- Artifact 什么时候删除；
- 数据库 Dump 如何清理；
- 用户删除项目意味着什么；
- Archive 删除和 Crypto-shredding 如何区分；
- Telemetry 是否默认关闭；
- 是否向外发送任何服务器信息。

建议首期默认：

```text
Local-first
Telemetry opt-in
Secret never persisted
Sensitive Artifact encrypted
```

---

# 三、应形成的一套正式方案文档

现在应该把前面所有讨论整合成一套分层文档，而不是一份数百页、难以维护的单文件。

建议形成一个总方案和九组子设计。

---

## 1. 总体方案设计

文档：

```text
EnvForge Solution Architecture
```

内容：

- 产品愿景；
- 用户场景；
- 产品边界；
- 总体架构；
- 核心领域；
- 四种模式；
- 安全模型；
- 实施路线；
- 风险和限制。

它是所有其他设计的入口。

---

## 2. 产品需求文档

分别定义四条用户链路：

```text
Assessment
Build
Live Migration
Preserve & Restore
```

每条链路应包括：

- 用户目标；
- 前置条件；
- 操作步骤；
- 结果；
- 失败情况；
- 风险说明；
- 能力限制；
- 成功指标。

---

## 3. Domain Model Specification

整合已经确定的：

- Project；
- Endpoint；
- Snapshot；
- Candidate；
- Workload；
- Blueprint；
- DecisionSet；
- Plan；
- Run；
- Dataset；
- Secret；
- Cutover；
- Archive。

需要最终产出：

- 对象定义；
- 聚合边界；
- 状态机；
- 不变量；
- 领域事件；
- ID 和 Hash 规则。

---

## 4. Execution Architecture

包含：

- Action DAG；
- Worker；
- Queue；
- Claim；
- Lease；
- Heartbeat；
- Fencing Token；
- Resource Lock；
- Retry；
- Reconciliation；
- Checkpoint；
- Pause；
- Crash Recovery；
- Rollback。

这一文档必须直接指导 Execution Kernel 开发。

---

## 5. Persistence Design

包含：

- PostgreSQL Schema；
- 表；
- FK；
- Unique Constraint；
- Index；
- JSONB；
- Artifact 引用；
- Outbox；
- Inbox；
- Projection；
- 数据迁移。

下一步可以具体编写 DDL 草案。

---

## 6. API Specification

以 OpenAPI 为最终交付物。

包含：

- Project；
- Discovery；
- Candidate Review；
- Blueprint；
- Plan；
- Approval；
- Run；
- Dataset；
- Secret；
- Cutover；
- Archive；
- Report。

所有状态改变必须使用命令 API。

---

## 7. Security Architecture

包含：

- Threat Model；
- Trust Boundary；
- SSH Credential；
- Secret Provider；
- Archive Encryption；
- Key Management；
- Redaction；
- RBAC；
- Audit；
- Plugin Security；
- Incident Response。

---

## 8. Capability Specification

每个首期 Capability 独立文档：

```text
systemd
Nginx
PostgreSQL
Docker Compose
Filesystem Dataset
Node.js
Python
```

每个文档说明：

- Detect；
- Blueprint；
- Build；
- Migrate；
- Capture；
- Restore；
- Verify；
- Rollback；
- 不支持的范围。

---

## 9. Test and Certification Plan

包含：

- Domain tests；
- Compiler fixtures；
- Adapter contract tests；
- Disposable VM；
- Failure injection；
- Security tests；
- Archive corruption；
- Restore Drill；
- Capability certification。

---

## 10. Operations Guide

包含：

- 部署 EnvForge；
- 数据库备份；
- Worker 扩容；
- 对象存储；
- Key Provider；
- 升级；
- 故障处理；
- 活动 Run 恢复；
- Archive 修复；
- 安全事件。

---

# 四、统一后的系统架构

建议把系统理解为五个平面。

---

## 1. Experience Plane

面向用户：

```text
Web UI
CLI
Future API Clients
```

职责：

- 引导式流程；
- Review；
- Approval；
- Run Progress；
- Risk；
- Report。

它不做：

- Plan 编译；
- 状态机决定；
- Secret 长期保存；
- 执行动作。

---

## 2. Control Plane

核心控制系统：

```text
Project Service
Discovery Service
Workload Service
Planning Service
Policy Service
Archive Catalog
```

职责：

- 管理业务对象；
- 编译 Plan；
- 审批；
- 计算 readiness；
- 提供 API；
- 管理权限。

---

## 3. Execution Plane

```text
Execution Orchestrator
Worker
Action Adapter
Dataset Engine
Secret Delivery Engine
Cutover Engine
```

职责：

- 执行 Approved Plan；
- Heartbeat；
- Checkpoint；
- Retry；
- Reconciliation；
- Rollback；
- Verification。

---

## 4. Evidence and Artifact Plane

```text
PostgreSQL
Artifact Store
Event Log
Report Store
```

职责：

- 当前状态；
- 不可变证据；
- Dump；
- Manifest；
- 日志；
- Report。

---

## 5. Archive and Recovery Plane

```text
Archive Repository
Encryption Provider
Replica Manager
Scrub Engine
Restore Drill Engine
```

职责：

- 长期保存；
- 完整性验证；
- 异地副本；
- 修复；
- 恢复测试。

---

# 五、四种模式如何统一运作

## 1. Assessment

```text
创建 Project
→ 连接 Endpoint
→ Collect Snapshot
→ 构建 Inventory Graph
→ 生成 Workload Candidate
→ 用户 Review
→ 形成 Workload Blueprint
→ 输出风险和建议
```

终点不是 Plan Run，而是：

- 已确认 Workload；
- Blueprint；
- Readiness；
- Assessment Report。

---

## 2. Build

```text
选择 Blueprint
→ 连接 Target
→ Target Snapshot
→ Compatibility
→ DecisionSet
→ Build Plan
→ Approval
→ Durable Run
→ Secret Delivery
→ Runtime Activation
→ Business Verification
→ Commit
```

Build 是第一条应完成的生产级纵向链路。

---

## 3. Live Migration

```text
Assessment Source
→ Confirm Blueprint
→ Connect Target
→ Compatibility
→ Migration Plan
→ Approval
→ Target Prepare
→ Initial Dataset Sync
→ Maintenance Window
→ Drain
→ Quiesce
→ Final Sync
→ Target Activation
→ Traffic Switch
→ Business Verification
→ Observation
→ Cutover Commit
→ Source Retention
```

Migration 是 Build、Dataset、Secret、Execution 和 Cutover 的组合，不应单独绕开这些模块实现。

---

## 4. Preserve & Restore

Capture：

```text
Confirm Blueprint
→ Capture Plan
→ Dataset Consistency
→ Artifact Capture
→ Encryption
→ Archive Replica
→ Scrub
→ Restore Drill
→ Source Release Commit
```

Restore：

```text
Select Archive Version
→ Connect New Target
→ Target Snapshot
→ Compatibility
→ Secret Binding
→ Restore Plan
→ Approval
→ Restore Run
→ Data Verification
→ Business Verification
→ Restore Commit
```

---

# 六、从现有代码到目标系统的迁移方法

不能推倒重写，也不能继续在旧对象中无限添加字段。

建议采用“替换核心、兼容外壳”的方式。

---

## 第一步：冻结旧模型的能力扩张

现有对象可以继续修复 Bug，但不要再添加：

- 新迁移策略；
- 新 Cutover 状态；
- 新 Archive 字段；
- 新执行状态。

否则会形成两个并行领域模型。

---

## 第二步：建立新的基础模块

先落地：

```text
PostgreSQL
Artifact Store
Outbox
Workspace
Project
Endpoint
Snapshot
UUIDv7
Hash
Audit
Redaction
```

这一步不改变用户主要流程。

---

## 第三步：迁移 Discovery 与 Workload

将：

```text
ServiceStack
```

转化为：

```text
WorkloadCandidate
```

现有分析结果可以作为 Candidate Builder 的输入，但用户确认结果应进入新 Workload 和 Blueprint。

---

## 第四步：替换旧 Planner

旧 Planner 可以作为：

```text
LegacyPackagePlanCompiler
```

暂时保留。

新 Planner 只接受 Blueprint Revision。

UI 应明确：

```text
Legacy Plan：仅支持软件包和配置建议
Full Build/Migration Plan：支持执行合同
```

---

## 第五步：替换同步 Apply

新的执行入口：

```text
Plan Approval
→ Create Execution Run
→ Queue
→ Worker
```

旧同步 Apply API 转为：

- 调用新 Run API；
- 返回 202；
- 或直接返回 410，要求使用新接口。

---

## 第六步：先完成 Build

不要立即把新执行内核用于生产迁移。

先完成：

- 空目标主机；
- 安装；
- 配置；
- Secret；
- 启动；
- 验证；
- 回滚。

这是验证基础架构风险最低的方式。

---

## 第七步：增加 Dataset

加入：

- 文件；
- PostgreSQL；
- Docker Volume；
- TransferSession；
- Checkpoint；
- Consistency；
- Verification。

此时可以提供：

```text
Migration Preparation
```

但仍不自动切流。

---

## 第八步：增加 Cutover

只有 Durable Run 和 Dataset 稳定后，才加入：

- Drain；
- Quiesce；
- Authority；
- Traffic；
- Observation；
- Commit；
- Rollback。

---

## 第九步：增加 Archive 与 Restore

复用已经成熟的：

- Dataset；
- Secret；
- Verification；
- Execution。

增加：

- Archive Manifest；
- Encryption；
- Replica；
- Scrub；
- Drill；
- Restore Compiler。

---

# 七、实际开发实施路线

## Phase 0：工程基座

交付：

- PostgreSQL；
- Migration Framework；
- Artifact Store；
- Hash；
- Outbox；
- Redaction；
- Idempotency；
- Audit；
- CI Disposable VM。

成功标准：

- API 和 Worker 重启不丢状态；
- 并发命令不会覆盖；
- Secret 测试值不会进入日志；
- Artifact 可以完整性验证。

---

## Phase 1：发现与 Workload

交付：

- Project；
- Endpoint；
- Snapshot；
- Evidence；
- Candidate；
- Review；
- Workload；
- Blueprint。

成功标准：

黄金服务器能够被识别成：

```text
Nginx
Web App
PostgreSQL
uploads
Secret References
cron
```

用户可以修正边界并形成 Blueprint。

---

## Phase 2：Planning

交付：

- DecisionSet；
- Compatibility；
- Build Compiler；
- Plan DAG；
- Plan Review；
- Approval。

成功标准：

相同输入产生相同 Plan Hash；

任何输入变化产生新 Plan Revision。

---

## Phase 3：Durable Execution

交付：

- Queue；
- Worker；
- Run；
- Action；
- Attempt；
- Lease；
- Checkpoint；
- Retry；
- Recovery；
- Report。

成功标准：

任意关键阶段杀死 Worker 后：

- 不会双执行；
- 能恢复；
- 或安全阻塞；
- 不会假装成功。

---

## Phase 4：Build

交付：

- systemd；
- Nginx；
- PostgreSQL 初始化；
- Config；
- Secret；
- Verification；
- Rollback。

成功标准：

从 Blueprint 在空 VPS 上完成真实部署。

---

## Phase 5：Dataset

交付：

- rsync initial/final；
- PostgreSQL dump/restore；
- Docker Volume；
- Verification；
- Transfer Resume。

成功标准：

文件和数据库能够断点恢复并证明一致性。

---

## Phase 6：Migration

交付：

- Maintenance Window；
- Drain；
- Quiesce；
- Write Authority；
- Traffic；
- Business Verification；
- Observation；
- Commit；
- Rollback。

成功标准：

真实双 VPS 迁移，在故障注入下仍能安全完成或恢复源端。

---

## Phase 7：Archive/Restore

交付：

- Capture；
- Encryption；
- Replica；
- Scrub；
- Drill；
- Source Release；
- Restore。

成功标准：

删除源 VPS 后，能够从 Archive 恢复到新 VPS，并通过业务验证。

---

# 八、每个阶段应该怎样拆成实际开发任务

不要按数据库表拆任务：

```text
创建 plans 表
创建 runs 表
创建 events 表
```

应该按可验收的用户纵向切片拆。

例如 Build Slice：

```text
用户选择一个 Node.js Blueprint
→ 连接 Ubuntu Target
→ 编译 Plan
→ 审批
→ Worker 创建用户和目录
→ 部署 Artifact
→ 安装 systemd unit
→ 注入 Secret
→ 启动
→ HTTP 验证
→ 生成 Report
```

这个 Slice 内包含：

- API；
- 数据库；
- Compiler；
- Worker；
- Adapter；
- UI；
- 测试；
- Report。

这样可以尽早发现领域设计与真实执行之间的差距。

---

# 九、建议的代码模块结构

```text
src/
├── modules/
│   ├── core/
│   ├── discovery/
│   ├── workload/
│   ├── planning/
│   ├── execution/
│   ├── dataset/
│   ├── secret/
│   ├── cutover/
│   ├── archive/
│   └── reporting/
│
├── capabilities/
│   ├── systemd/
│   ├── nginx/
│   ├── postgresql/
│   ├── filesystem/
│   ├── docker-compose/
│   ├── nodejs/
│   └── python/
│
├── infrastructure/
│   ├── database/
│   ├── artifact-store/
│   ├── ssh/
│   ├── queue/
│   ├── crypto/
│   ├── logging/
│   └── telemetry/
│
├── api/
├── worker/
└── web/
```

每个模块内部：

```text
domain/
application/
infrastructure/
api/
tests/
```

不要让 Capability 直接访问任意数据库表。

Capability 只能通过明确接口：

- Snapshot Reader；
- Plan Compiler Context；
- Action Runtime；
- Artifact Store；
- Secret Handle；
- Evidence Writer。

---

# 十、首期数据库和 API 应先实现什么

不要立即实现所有已经设计的表。

第一批只实现：

```text
workspaces
projects
endpoints
snapshots
evidence
candidate_generations
workload_candidates
candidate_review_decisions
workloads
blueprint_revisions
decision_set_revisions
plan_revisions
plan_actions
plan_action_dependencies
plan_approvals
execution_runs
stage_runs
action_runs
action_attempts
run_events
run_queue
worker_leases
resource_leases
artifacts
outbox_messages
```

Secret、Dataset、Cutover、Archive 的表按对应阶段加入。

这样既保留设计方向，也避免在真实需求验证前创建大量空模型。

---

# 十一、测试必须成为设计的一部分

EnvForge 的可信度不是由代码量决定，而是由故障场景测试决定。

每个执行 Action 必须测试六个崩溃点：

```text
执行前
产生副作用前
产生副作用后
写 Checkpoint 前
写 Checkpoint 后
响应成功前
```

关键场景：

## Build

- 软件包已经存在；
- 配置写入中断；
- systemd 启动失败；
- Secret 不可用；
- Worker 重启。

## Dataset

- SSH 中断；
- 文件在同步中变化；
- dump Artifact 损坏；
- 目标磁盘满；
- restore 部分完成。

## Cutover

- Quiesce 后 Worker 崩溃；
- Final Sync 超时；
- Traffic API 超时；
- 目标验证失败；
- 目标产生新写入；
- Rollback 中断。

## Archive

- 主副本损坏；
- 第二副本缺对象；
- Key Provider 不可用；
- Manifest 被修改；
- Restore Drill 清理失败。

---

# 十二、产品能力的发布方式

每项能力不应只有：

```text
支持 / 不支持
```

建议发布状态：

```text
Experimental
Preview
Supported
Certified
Deprecated
```

例如：

```text
PostgreSQL Logical Migration
状态：Preview

限制：
- PostgreSQL 14–16
- 单数据库
- 不支持跨库一致性
- 需要停写
- 回滚在目标产生写入后为人工处理
```

只有经过：

- Compiler Fixture；
- Adapter Contract；
- Disposable VM；
- Crash Matrix；
- End-to-End；

才能升级为 Certified。

---

# 十三、产品实际运用方式

## 场景一：用户准备换 VPS

用户流程：

1. 在 EnvForge 创建 Migration Project；
2. 连接旧 VPS；
3. EnvForge 采集 Snapshot；
4. 生成 Workload Candidates；
5. 用户确认网站、数据库和数据目录；
6. EnvForge 形成 Blueprint；
7. 用户连接新 VPS；
8. 系统计算兼容性；
9. 选择数据、Secret 和 Cutover 策略；
10. 编译 Plan；
11. 用户审批；
12. 先进行目标准备和 initial sync；
13. 到维护窗口执行 Cutover；
14. 观察并 Commit；
15. 保留旧 VPS 一段时间；
16. 生成迁移报告。

---

## 场景二：用户要复制一套环境

1. 选择已有 Workload Blueprint；
2. 创建 Build Project；
3. 连接空目标；
4. 提供新的 Secret 和域名；
5. 编译 Build Plan；
6. 执行；
7. 验证；
8. 生成新 Placement。

这里不需要源服务器运行。

---

## 场景三：用户想停止付费但保留环境

1. 创建 Capture Project；
2. 确认 Workload 和 Dataset；
3. 绑定对象存储和 Key Provider；
4. 执行 Capture；
5. 完成 Replica 和 Scrub；
6. 执行 Restore Drill；
7. EnvForge 计算 Source Release Readiness；
8. 用户提交 Source Release Commit；
9. 用户关闭旧 VPS。

数月后：

1. 导入或选择 Archive；
2. 连接新 VPS；
3. 编译 Restore Plan；
4. 提供 Secret；
5. Restore；
6. 业务验证；
7. Commit。

---

# 十四、总体方案中的关键风险

## 风险 1：范围过大

EnvForge 涉及：

- CMDB；
- 部署；
- 迁移；
- 备份；
- Secret；
- 工作流；
- 灾难恢复。

控制方法：

- 只支持黄金技术栈；
- 采用 Capability 认证；
- 先 Build，再 Migration，再 Archive；
- UI 不展示未认证能力。

## 风险 2：自动化错误造成数据损失

控制方法：

- Candidate 不直接生成 Plan；
- required 用户确认；
- before-state；
- staging；
- Verification；
- Commit；
- source retention；
- 不自动覆盖目标已有数据。

## 风险 3：系统复杂度过高

控制方法：

- 模块化单体；
- 单一 PostgreSQL；
- 明确聚合边界；
- 不引入过早微服务；
- 不做全面 Event Sourcing；
- 纵向切片交付。

## 风险 4：用户误解能力

控制方法：

- Readiness Gate；
- 支持矩阵；
- 风险摘要；
- 能力认证；
- Report 只陈述证据；
- 不用“一键无损迁移”之类文案。

## 风险 5：Restore 永远没有真正测试

控制方法：

- Archive Integrity 与 Recoverability 分离；
- Restore Drill；
- Drill 有有效期；
- Source Release Gate；
- Archive Import 测试。

---

# 十五、最终整合后的设计主线

整个设计应围绕四个核心合同展开：

## 1. Blueprint Contract

回答：

> 业务是什么，依赖什么，怎样运行，什么状态必须保留，怎样验证。

## 2. Plan Contract

回答：

> 针对当前源、目标和用户选择，准备执行哪些具体动作。

## 3. Run Evidence

回答：

> 实际执行了什么，在哪个时间点发生了什么，哪些步骤通过了验证。

## 4. Archive Contract

回答：

> 哪些恢复材料被长期保存，它们是否完整、可解密、可重建并经过恢复测试。

所有其他对象都围绕这四层服务。

---

# 十六、当前最应该开始的具体工作

按照优先级，下一步应该产出以下工程设计：

## 第一批

1. 总体 Solution Architecture 文档；
2. PostgreSQL 核心 DDL；
3. Project、Snapshot、Workload、Blueprint Schema；
4. Plan/Run 状态转换 SQL；
5. Outbox、Queue、Lease、Fencing 事务伪代码；
6. API OpenAPI 骨架；
7. Capability SDK 接口；
8. Threat Model；
9. Golden Build Scenario；
10. 现有代码迁移映射。

## 第二批

1. systemd Capability；
2. Nginx Capability；
3. Node.js/Python Capability；
4. PostgreSQL Build Capability；
5. Secret User Input/Target Existing；
6. Build Compiler；
7. Durable Worker；
8. Business Verification；
9. Build Rollback；
10. End-to-End VM 测试。

---

# 十七、完成 EnvForge 的实际判断标准

EnvForge 不是在所有模型代码写完时完成。

第一个可用里程碑：

```text
Blueprint → Build Plan → Durable Run → Verified Workload
```

第二个可用里程碑：

```text
Source Workload → Dataset Migration → Cutover → Verified Migration
```

第三个完整产品里程碑：

```text
Source Workload → Archive → Scrub → Restore Drill
→ 删除源服务器 → 新服务器 Restore → Business Verification
```

当第三条链路在真实环境、真实故障注入和真实数据校验中通过时，最初的产品想法才真正完成闭环。

---

# 十八、最终结论

目前不缺少新的核心业务对象。

现在最需要的是：

```text
停止继续横向扩展概念
→ 冻结领域基线
→ 整合总体方案
→ 下沉 DDL 和 API
→ 建立执行基座
→ 从 Build 纵向链路开始实现
→ 用真实 VM 和故障注入验证
→ 再逐步加入 Migration 和 Archive
```

因此，接下来应把此前全部设计整理为正式的：

```text
EnvForge Overall Solution Design v1
```

并将它作为：

- 产品需求来源；
- 数据库设计来源；
- API 设计来源；
- 开发任务拆分来源；
- 测试标准来源；
- Capability 认证来源；
- 发布能力边界来源。

这一步完成后，EnvForge 才会从“完整的想法和领域设计”转变为“可以按阶段交付的工程方案”。

## Prompt:
2026/7/18 23:38:05

对，接下来将全部设计整理为正式的EnvForge Overall Solution Design v1
请你使用 **System Design** 模板，将本会话中关于 EnvForge 的全部讨论、已确定方案、模型定义和设计决策，整理为一份可用于实际研发实施的正式 Design Document。 

文档不得只是对话摘要，也不得按聊天顺序简单拼接。请对所有内容进行重新归类、统一术语、消除重复、检查冲突，并形成完整、连贯、可执行的系统设计。

文档至少包含以下内容：

1. 文档信息

   * 文档名称
   * 当前版本
   * 状态
   * 目标读者
   * 设计范围
   * 非目标
   * 术语与缩写

2. Executive Summary

   * EnvForge 要解决的问题
   * 产品定位
   * 目标用户
   * 核心价值
   * 整体解决方案摘要

3. 背景与问题定义

   * 虚拟机、工作负载和运行环境迁移的主要痛点
   * 传统镜像复制、备份恢复、脚本迁移和人工迁移方案的不足
   * EnvForge 的设计原则与约束

4. 产品能力与使用模式

   * Build
   * Migration
   * Capture
   * Restore
   * Preserve & Restore
   * 各模式的适用场景、输入、输出和生命周期

5. 核心领域模型

   * Candidate Review
   * 人工补全流程
   * Workload Blueprint
   * Plan Revision
   * Action
   * Action DAG
   * Durable Execution Run
   * Dataset Execution Contract
   * Secret Binding
   * Transfer Session
   * Secret Provider
   * Cutover
   * Verification
   * Rollback
   * Environment Archive
   * Restore Drill
   * 其他会话中已经定义的核心对象

对每个领域对象说明：

* 职责
* 核心字段
* 不变量
* 生命周期
* 状态转换
* 与其他对象的关系
* 聚合根归属
* 持久化边界

6. Blueprint 编译体系

   * Workload Blueprint 到 Plan Revision 的完整编译流程
   * Blueprint 字段如何转换为 Action、Dataset Contract、Secret Binding、Cutover、Verification 和 Rollback
   * Build Compiler
   * Migration Compiler
   * Capture Compiler
   * Restore Compiler
   * 编译阶段验证
   * 编译错误模型
   * Plan Revision 的不可变性与版本管理

7. 执行引擎设计

   * Action DAG
   * Durable Execution Run
   * 审批
   * 排队
   * Claim
   * Lease 与心跳
   * 暂停与恢复
   * 重试
   * Checkpoint
   * 幂等
   * 超时
   * 取消
   * 验证失败
   * Cutover Commit
   * 崩溃恢复
   * Worker 故障恢复
   * 控制面与执行面的职责边界

8. Dataset Migration Engine

   * Dataset 类型
   * Dataset Execution Contract
   * Transfer Session
   * 全量传输
   * 增量同步
   * 一致性点
   * 校验与完整性验证
   * 断点续传
   * 带宽控制
   * 失败恢复
   * 源端和目标端适配器
   * 数据库、文件系统、对象存储等不同数据源的差异

9. Secret Delivery Engine

   * Secret Binding
   * Secret Provider
   * Secret 引用与实际密文分离
   * 临时凭据
   * Secret 注入
   * 轮换
   * 撤销
   * 审计
   * 最小权限
   * 日志脱敏
   * 跨环境 Secret 映射

10. Cutover Engine

    * Cutover Plan
    * 流量切换
    * DNS、负载均衡、网关或代理切换
    * 预切换检查
    * 冻结窗口
    * 最终增量同步
    * Cutover Commit
    * 业务验证
    * 自动回滚
    * 人工回滚
    * Point of No Return
    * 部分成功和不确定状态处理

11. Environment Archive 与恢复体系

    * Archive Manifest
    * 对象存储布局
    * 分块
    * 压缩
    * 去重
    * 加密
    * 密钥管理
    * 完整性校验
    * Scrub
    * 保留策略
    * 生命周期管理
    * Restore Drill
    * 灾难恢复
    * Preserve & Restore 模式的完整闭环

12. 状态机

    * 为所有主要实体提供正式状态定义
    * 合法状态转换
    * 转换前置条件
    * 转换产生的事件
    * 失败状态
    * 终止状态
    * 可恢复状态
    * 不允许的状态跳转

状态机应使用表格或 Mermaid stateDiagram 表达。

13. 系统架构

    * 控制面
    * 执行面
    * API 服务
    * 编译服务
    * 调度器
    * Worker
    * Dataset Migration Engine
    * Secret Delivery Engine
    * Cutover Engine
    * Archive Service
    * Verification Service
    * Audit/Event Service
    * 数据库
    * 对象存储
    * 消息队列
    * 外部 Provider

提供系统上下文图、容器图和主要组件图。

14. 数据库与聚合边界

    * 聚合根划分
    * 数据表或集合设计
    * 主键与业务标识
    * Revision 与不可变记录
    * 事件表
    * Outbox
    * Worker Claim
    * Lease
    * Checkpoint
    * 审计记录
    * 大对象与对象存储的边界
    * 事务边界
    * 并发控制
    * 乐观锁
    * 数据保留与归档

15. API 资源设计

    * REST 或其他 API 风格
    * 核心资源及其 URL
    * 创建、读取、修改和操作型接口
    * Revision 与审批接口
    * Plan 编译接口
    * Run 控制接口
    * Action 状态接口
    * Transfer Session 接口
    * Cutover 接口
    * Archive 与 Restore Drill 接口
    * 幂等键
    * 分页
    * 错误模型
    * 长任务返回模型
    * Webhook 或事件订阅模型
    * 权限模型

为关键 API 提供请求和响应示例。

16. 核心流程

    * 新环境 Build
    * 现有环境 Migration
    * 环境 Capture
    * Archive Restore
    * Preserve & Restore
    * Candidate Review 和人工补全
    * Plan 审批与执行
    * 数据迁移
    * Secret 交付
    * Cutover
    * 验证失败与回滚
    * Worker 崩溃恢复

使用 Mermaid sequenceDiagram 表达关键流程。

17. 一致性、可靠性和容错

    * At-least-once 执行
    * 幂等处理
    * 重复事件
    * 最终一致性
    * 分布式锁与 Lease
    * 网络分区
    * Worker 消失
    * 控制面重启
    * Provider 超时
    * 部分执行成功
    * 未知执行结果
    * 补偿事务
    * 人工介入边界

18. 安全设计

    * 身份认证
    * RBAC 或 ABAC
    * 租户隔离
    * Secret 安全
    * 数据加密
    * 供应链安全
    * Worker 信任边界
    * 审计
    * 合规
    * 威胁模型
    * 高风险操作审批

19. 可观测性与运维

    * 日志
    * Metrics
    * Tracing
    * Audit Events
    * Run Timeline
    * 告警
    * SLO
    * 容量规划
    * 故障排查
    * 数据修复
    * 管理员操作工具

20. 技术权衡

    * 已选择方案
    * 被否决方案
    * 选择原因
    * 成本
    * 风险
    * 可逆性
    * 后续可能演进方向

21. 分阶段实施路线

    * MVP
    * Phase 1
    * Phase 2
    * Phase 3
    * 后续增强阶段
    * 每个阶段的范围
    * 依赖
    * 数据库变更
    * API 交付
    * 验收标准
    * 风险
    * 暂不实施内容

22. 测试与验收

    * 单元测试
    * 状态机测试
    * 编译器测试
    * 集成测试
    * 故障注入
    * 崩溃恢复测试
    * 数据完整性测试
    * Cutover 演练
    * Restore Drill
    * 安全测试
    * 端到端验收条件

23. 尚未解决的问题

    * 从会话中提取仍未明确的设计问题
    * 不得自行假定这些问题已经解决
    * 标明优先级
    * 影响范围
    * 推荐决策
    * 最迟需要决定的阶段

24. 附录

    * 领域对象总表
    * 状态枚举总表
    * API 总表
    * 事件类型总表
    * 错误码总表
    * 关键术语表
    * 设计决策记录 ADR 索引

写作要求：

* 使用正式技术设计文档风格。
* 统一所有对象、字段和状态的命名。
* 明确区分已经确定的设计、合理推导的设计建议和尚未确定的问题。
* 对合理推导的部分显式标记为“建议方案”。
* 不得把建议方案描述成已经在会话中确认的事实。
* 发现会话内容存在冲突时，列出冲突并给出推荐统一方案。
* 对核心对象提供表格。
* 对关键关系提供 Mermaid 图。
* 对重要算法和状态转换提供伪代码。
* 文档应足够具体，使产品、架构、后端、基础设施、安全、测试和运维团队能够据此开始实施。
* 保留完整设计细节，不要为了缩短文档而省略关键内容。
* 最终输出为格式完整的正式 Design Document，而不是提纲或摘要。

## Response:
2026/7/18 23:38:09

我会直接生成一份可交付的正式 `.docx`，使用 System Design 模板结构重新组织全部内容，并把“已确认决策 / 建议方案 / 尚未解决问题”分别标记。文档会包含核心表格、状态机、Mermaid 图、API 示例、伪代码、实施路线和附录索引。

文档主体会采用“确认基线 + 建议方案 + 待决策项”的统一标记，并加入当前代码现状到目标架构的迁移映射。接下来我正在生成架构图、领域关系图和长期文档版式，然后会进行逐页渲染检查。

主体设计已经完成到架构、领域模型、编译、执行、数据、Secret、Cutover、Archive、状态机、数据库、API、安全和运维部分。剩余工作是实施路线、测试验收、待决策清单和附录总表，然后进行 DOCX 排版与逐页 QA。

> **定位技能目录与读取文档**
>
>
> **定位、查找、检查并处理文档和模板文件**
>
> 
>
> **生成系统架构图与文档格式化建议**
>
>
> **生成系统架构图和文档格式化建议**
>
> 
>
> **设计Word文档**
>
> 我正在计划创建一个包含详细内容的Word文档，考虑到自动化部分结构和章节，以及设置样式和分页。我会设计标题、页脚和表格等格式。
>
> **设计Word文档**
>
> 
>
> **设计自动化docx文档生成器**
>
>
> **设计自动化docx文档生成器并查找TOC插入位置**
>
> 
>
> **生成文档内容**
>
> 我计划使用Python生成内容，包括手动编号的标题和表格。通过Pandoc从Markdown转换，以便生成100页左右的文档，包含接口细节和代码片段。
>
> **生成文档内容**
>
> 
>
> **生成系统设计文档内容**
>
>
> **生成并扩展系统设计文档内容**
>
> 
>
> **编写分阶段实施方案**
>
>
> **编写实施方案并生成和验证文档**
>
> 
>
> 思考了 35m 45s

# EnvForge Overall Solution Design v1

已将本会话中的全部设计重新归类、统一术语并整合为正式的 **System Design Document**。

文档共 **87 页**，包括：

- 完整领域模型、聚合边界与不变量
- Blueprint 四类编译器
- Durable Execution、Dataset、Secret、Cutover 与 Archive 引擎
- 正式状态机、Mermaid 架构图与关键流程图
- PostgreSQL、Outbox、Queue、Lease、Checkpoint 设计
- REST API、请求响应示例与错误模型
- 一致性、安全、可观测性及运维设计
- 技术权衡、分阶段实施路线和测试验收体系
- 已确认设计、建议方案、待决策事项的明确区分
- 领域对象、状态、API、事件、错误码及 ADR 索引附录

[下载 EnvForge Overall Solution Design v1](sandbox:/mnt/data/EnvForge_Overall_Solution_Design_v1.docx)



---
Powered by [ChatGPT Exporter](https://www.chatgptexporter.com)