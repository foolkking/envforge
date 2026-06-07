# EnvForge

> **导航与能力认证说明（更新）。**
> - **普通用户左侧导航** 仅保留 Dashboard、Migrate、Build、Plans、Reports；
>   不再展示 Catalog、Maintain、Account 一级入口。
> - **管理员左侧导航** 在以上五项之外多一项 **Capability Admin**（原
>   Catalog），用于规则治理、认证升级、用户建议、Package Integrations、
>   Users & Queues 五个页签。
> - **Build** 仅展示已通过 **Full Migration Certified** 的能力，不再显示
>   `supportLevel`（完整迁移 / 托管配置 / 基础重建 / 仅识别）筛选与标签。
>   未认证能力不会进入普通用户的 Build。
> - 旧 **Maintain** 中的 Schedule / Drift / Webhook 已迁入 **Plans**；
>   旧 **Maintain** 中的软件包/规则治理已迁入 **Capability Admin / Package
>   Integrations**；旧 **Maintain** 中的用户与队列已迁入 **Capability
>   Admin / Users & Queues**。
> - 旧 **Account**（个人资料、邮箱、密码、2FA、绑定身份、通知偏好）已
>   合并进 **Dashboard**；Account 不再是一级页面。
> - 普通用户访问 `/catalog` 会自动跳转 `/build`，并展示 Go to Build 提示。
> - 当前认证状态：**6 / 119 项已认证**。详见
>   [Full Migration Requirements](./docs/FULL_MIGRATION_REQUIREMENTS.md)
>   与 [认证升级 backlog](./docs/CAPABILITY_CERTIFICATION_BACKLOG.md)。

> **Catalog 政策更新。** 普通用户只在 Build / Migrate 中看到
> **Full Migration Certified**（已认证）能力。未达到
> [Full Migration Requirements](./docs/FULL_MIGRATION_REQUIREMENTS.md)
> 标准的能力仅出现在管理员工作台中。Catalog 页面已重构为
> **Capability Admin** 管理员工作台（Overview / Rule Registry /
> Suggestion Inbox / Package Integrations / Users & Queues 五个页签），
> 普通用户左侧导航不再显示 Catalog 入口，访问 `/catalog` 会自动跳转到
> Build。[认证升级 backlog](./docs/CAPABILITY_CERTIFICATION_BACKLOG.md)
> 跟踪剩余项的升级路径。当前状态：**6 / 119 项已认证**。

EnvForge 是一个 Linux 可重建环境管理平台。

它通过 SSH 分析旧 Linux VM，提取真正重要的软件能力、配置文件、服务状态、语言运行时、容器工作负载、数据依赖和手工安装痕迹，然后生成可审查、可回放、可验证、可回滚的 Environment Plan，用于在新的 VM 上重建环境。

```text
旧 VM -> HostSnapshot -> 环境分析 -> Environment Plan -> 新 VM -> 验证 / 回滚
```

EnvForge 不是宝塔、1Panel、Cockpit 这类通用服务器管理面板。它的核心不是“随便安装软件、卸载软件、编辑任意文件”，而是“把一台混乱的旧 Linux 机器整理成一份用户看得懂、可以审查、可以执行、可以验证、可以回滚的环境说明书”。

EnvForge 也支持从能力规则库构建一台干净的目标 VM，但它使用同一套安全模型：选择能力，生成 Environment Plan，审查动作，执行计划，验证结果，并在失败时尽可能回滚。

## 三种模式

- **Migrate Mode**：源 VM -> HostSnapshot -> Analysis -> Review Queue -> Migration Plan -> 目标 VM -> Apply & Verify -> Report。
- **Build Mode**：目标 VM -> Capability Catalog -> Rebuild Plan -> Review -> Apply & Verify -> Report。
- **Maintain Mode**：已管理环境 -> State Diff -> Config Change Proposal / Remove Capability Plan / Repair Plan -> Review -> Apply & Verify。

三种模式不是三个产品，而是 Environment Plan 的三种来源。所有会改变目标机器状态的操作都必须进入 Environment Plan：先生成计划，再审查风险，再执行、验证和回滚。

## 产品原则

- 自动发现，谨慎迁移，人机协同确认。
- 已安装包不等于用户想迁移的包，必须通过 Package Intent Score 综合判断。
- Capability Catalog 是能力规则库，不是普通应用市场。
- “一键安装”应表现为生成 Rebuild Plan；卸载应表现为 Remove Capability Plan。
- 配置编辑不是远程文本编辑器，而是 Config Change Proposal。
- Snapshot / Capture 只能作为 evidence，不能直接部署。
- Secret 默认不迁移，必须脱敏、提示、确认。
- 数据目录不盲目 rsync，数据库优先 dump / restore。
- 未知软件不直接忽略，也不默认迁移，而是进入 Review Queue。
- SSH、防火墙、sudoers 等高风险配置必须有验证和回滚保护。

## 核心能力

- **SSH 只读发现**：采集 OS、包、服务、端口、配置、容器、语言生态和手工安装痕迹。
- **HostSnapshot**：统一描述源机器或目标机器的环境状态。
- **Package Intent Score**：区分高置信度迁移项、人工确认项、低价值依赖和系统基础包。
- **配置治理**：配置归属、默认/修改判断、secret 检测、安全读取、diff、备份和验证钩子。
- **Capability Catalog**：用规则描述能力如何被识别、构建、迁移、验证、回滚和跨发行版映射。
- **Environment Plan**：统一 Migration Plan、Rebuild Plan、Change Plan、Remove Plan、Repair Plan 和 Imported Recipe Plan。
- **Apply / Verify / Rollback**：通过 SSH executor、安全 sudo 写入、文件备份、服务状态恢复和验证命令形成闭环。
- **社区共建生态**：评论、建议、审核、站内信和邮件通知，帮助 catalog 长期演化。

## 文档地图

| 文档 | 用途 |
| :-- | :-- |
| [docs/PRODUCT.md](./docs/PRODUCT.md) | 产品定位、边界、模式、用户角色和路线图 |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | 六阶段架构、Environment Plan 和模块边界 |
| [docs/MIGRATION_SYSTEM.md](./docs/MIGRATION_SYSTEM.md) | HostSnapshot、包意图评分、Review Queue、计划引擎、数据策略、验证和回滚 |
| [docs/CATALOG_SYSTEM.md](./docs/CATALOG_SYSTEM.md) | Capability Catalog、支持级别、Schema v2、编写规范、LLM prompt、跨发行版映射 |
| [docs/CONFIG_AND_SECURITY.md](./docs/CONFIG_AND_SECURITY.md) | 配置归属、默认判断、secret、安全编辑、审计和 SSH 保护 |
| [docs/ROADMAP.md](./docs/ROADMAP.md) | 分阶段实现路线与长期扩展计划 |
| [docs/DEPLOY.md](./docs/DEPLOY.md) | 部署指南 |
| [docs/DEPLOY_SELF.md](./docs/DEPLOY_SELF.md) | 自托管与 bootstrap 部署说明 |

## 技术栈

- 前端：React 18、TypeScript、Vite、lucide-react
- 后端：Fastify、TypeScript、ssh2
- 存储：SQLite hybrid document/relational persistence
- 执行：TypeScript 原生 playbook 与 SSH 执行模块
- 安全：scrypt 密码哈希、AES-256-GCM 凭据加密

## 构建

```bash
npm run build:server
npm run build --workspace @fool/web
```

## License

MIT
