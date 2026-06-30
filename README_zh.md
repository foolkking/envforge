# EnvForge

EnvForge 把不可控的旧 Linux 服务器，转化为可审查、可重建、可验证、可审计的环境计划。

产品化设计路线见：[docs/product/README.md](./docs/product/README.md)。

EnvForge 是一个 Linux 环境迁移与重建平台。

它通过 SSH 分析旧 Linux VM，提取真正重要的软件能力、配置文件、服务状态、语言运行时、容器工作负载、数据依赖和手工安装痕迹，然后生成可审查、可回放、可验证、可回滚的环境计划，用于在新的 VM 上重建环境。

```text
旧 VM -> 环境快照 -> 环境分析 -> 迁移计划 -> 新 VM
```

EnvForge 不是宝塔、1Panel、Cockpit 这类通用服务器管理面板。它的核心不是“随便安装软件、卸载软件、编辑任意文件”，而是“把一台混乱的旧 Linux 机器整理成一份用户看得懂、可以审查、可以执行、可以验证、可以回滚的环境说明书”。

## 三种模式

- **Migrate Mode**：源 VM -> HostSnapshot -> Analysis -> Review Queue -> Migration Plan -> 目标 VM -> Apply & Verify -> Report。
- **Build Mode**：目标 VM -> Capability Catalog -> Rebuild Plan -> Review -> Apply & Verify -> Report。
- **Maintain Mode**：已管理环境 -> 状态差异 -> Config Change Proposal / Remove Capability Plan / Repair Plan -> Review -> Apply & Verify。

无论是迁移、从零构建，还是维护已管理环境，所有会改变目标机器的操作都必须进入 **Environment Plan**：先生成计划，再审查风险，再执行、验证和回滚。

## 产品原则

- 自动发现，谨慎迁移，人机协同确认。
- 已安装包不等于用户想迁移的包，必须通过 Package Intent Score 综合判断。
- Capability Catalog 是能力规则库，不是普通应用市场。
- 一键安装要改为生成 Rebuild Plan；卸载要改为 Remove Capability Plan。
- secret 默认不迁移，必须脱敏、提示、确认。
- 数据目录不盲目 rsync，数据库优先 dump/restore。
- 未知软件不直接忽略，也不默认迁移，进入 Review Queue。
- SSH、防火墙、sudoers 等高风险配置必须有验证和回滚保护。

## 核心能力

- **SSH 只读发现**：采集 OS、包、服务、端口、配置、容器、语言生态和手工安装痕迹。
- **HostSnapshot**：统一描述源机器或目标机器的环境状态。
- **Package Intent Score**：区分高置信度迁移项、人工确认项、低价值依赖和系统基础包。
- **配置治理**：配置归属、默认/修改判断、secret 检测、安全读取、diff、备份和验证钩子。
- **Capability Catalog**：用规则描述能力如何被识别、构建、迁移、验证、回滚和跨发行版映射。
- **Environment Plan**：统一 Migration Plan、Rebuild Plan、Change Plan、Remove Plan、Repair Plan。
- **Apply / Verify / Rollback**：通过 SSH executor、安全 sudo 写入、文件备份、服务状态恢复和验证命令形成闭环。
- **社区共建生态**：评论、建议、审核、站内信和邮件通知，帮助 catalog 长期演化。

## 文档地图

| 文档 | 用途 |
| :-- | :-- |
| [docs/product.md](./docs/product.md) | 产品定位、边界、模式、用户角色和路线图 |
| [docs/system-design.md](./docs/system-design.md) | 六阶段架构、Environment Plan、安全内核和模块边界 |
| [docs/catalog.md](./docs/catalog.md) | Capability Catalog、支持级别、认证和编写规范 |
| [docs/web-ui.md](./docs/web-ui.md) | Web 信息架构、交互模式和设计系统规则 |
| [docs/operations.md](./docs/operations.md) | 部署、运行、备份和恢复指南 |
| [docs/validation.md](./docs/validation.md) | 验证场景、测试矩阵和目标就绪度 |
| [docs/decisions.md](./docs/decisions.md) | 代码中不明显的长期架构决策 |

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
