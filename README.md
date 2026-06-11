# EnvForge

EnvForge is a Linux environment migration and rebuild platform. It connects to an existing VM over SSH, collects read-only evidence, classifies the software/config/data that matter, and turns that evidence into a reviewable, verifiable, rollback-aware Environment Plan.

```text
Source VM -> HostSnapshot -> Environment Plan -> Review -> Apply -> Verify -> Report
```

EnvForge is not a general server control panel. It does not treat "install package", "edit remote file", or "uninstall software" as direct product actions. Target mutations must pass through Environment Plan review, apply gates, verification, and rollback/reporting.

## 中文概览

EnvForge 用于把一台旧 Linux 机器整理成可审查、可重放、可验证、可回滚的迁移/重建计划。它不是宝塔、1Panel、Cockpit 这类服务器面板；核心任务是理解旧环境、解释风险、生成计划，并在目标机器上安全执行。

## Main Surfaces

| Surface | Purpose |
|---|---|
| Dashboard | Command center for blockers, recent plans, snapshots, reports, account/security drawers |
| Migrate | Source VM discovery, HostSnapshot, evidence review, config/data review, migration planning |
| Build | Certified capability selection and Rebuild Plan generation |
| Plans | Plan review, dry-run, apply, verify, rollback, schedules, drift, webhooks, reports |
| Reports | Plan/report history and generated artifacts |
| Capability Admin | Admin-only catalog rules, certification, suggestions, integrations, users and queues |

Build exposes only Full Migration Certified capabilities. The internal `supportLevel` ladder is not shown to ordinary users.

## Technology

| Layer | Stack |
|---|---|
| Frontend | React 18, TypeScript, Vite, lucide-react |
| Backend | Fastify, TypeScript, ssh2 |
| Storage | SQLite hybrid document/relational persistence |
| Runtime | Node >= 20, npm >= 10 |
| Security | scrypt password hashing, AES-256-GCM credential encryption |

## Common Commands

```bash
npm run build
npm run build:server
npm run typecheck
npm run test --workspace @fool/api
npm run dev:web
npm run dev:api
```

## Documentation

Start here:

- Current repository state for AI agents: [PROJECT_STATE.md](./PROJECT_STATE.md)
- Agent working rules: [AGENTS.md](./AGENTS.md)
- Full documentation index: [docs/index.md](./docs/index.md)

Core docs:

- [docs/product.md](./docs/product.md)
- [docs/system-design.md](./docs/system-design.md)
- [docs/catalog.md](./docs/catalog.md)
- [docs/web-ui.md](./docs/web-ui.md)
- [docs/operations.md](./docs/operations.md)
- [docs/validation.md](./docs/validation.md)
- [docs/decisions.md](./docs/decisions.md)

## License

MIT
