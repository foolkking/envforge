# EnvForge

> **Navigation and certification update.**
> - **End-user nav** keeps only Dashboard, Migrate, Build, Plans, Reports.
>   Catalog, Maintain, and Account are no longer first-level entries.
> - **Admin nav** adds **Capability Admin** (the page that used to be
>   Catalog) with five tabs: Overview, Rule Registry, Suggestion Inbox,
>   Package Integrations, Users & Queues.
> - **Build** only shows **Full Migration Certified** capabilities. The
>   `supportLevel` ladder (full-migration / managed-config /
>   basic-rebuild / detect-only) is no longer surfaced anywhere on the
>   end-user side. Not-ready capabilities never reach end-user Build.
> - The legacy **Maintain** page is gone. Schedules, Drift, and Webhooks
>   moved to **Plans**. Rule / package governance moved to **Capability
>   Admin → Package Integrations**. Platform user roles + the workspace
>   job queue moved to **Capability Admin → Users & Queues**.
> - The legacy **Account** page is gone. Profile, email, password, 2FA,
>   linked identities, and notification preferences are folded into the
>   **Dashboard** Account & Security panel.
> - Non-admins who land on `/catalog` are auto-redirected to `/build`.
> - Today: **6 / 119 capabilities certified** after Batch 1. See
>   [Full Migration Requirements](./docs/FULL_MIGRATION_REQUIREMENTS.md)
>   and the
>   [certification backlog](./docs/CAPABILITY_CERTIFICATION_BACKLOG.md)
>   for the upgrade path.

> **Catalog policy update.** End users only see **Full Migration
> Certified** capabilities in Build / Migrate. Capabilities
> that have not yet met the
> [Full Migration Requirements](./docs/FULL_MIGRATION_REQUIREMENTS.md)
> are hidden from end-user catalog browsing and refused server-side
> when added to a Plan. The Catalog page is admin-only and now ships
> as the **Capability Admin workbench**: Overview / Rule Registry /
> Suggestion Inbox / Package Integrations / Users & Queues. The non-admin nav drops the
> Catalog entry; non-admins are auto-redirected to Build. The
> [certification backlog](./docs/CAPABILITY_CERTIFICATION_BACKLOG.md)
> tracks the upgrade path. Today: **6 / 119 capabilities certified**.

EnvForge is a visual Linux VM environment migration and rebuild tool.

It analyzes an existing server over SSH, extracts the software capabilities, configuration files, service state, language runtimes, container workloads, and data dependencies that matter, then generates a reviewable, replayable, verifiable, and rollback-safe migration plan for rebuilding the environment on a new VM.

```text
Old VM -> Environment Snapshot -> Migration Plan -> New VM
```

EnvForge is not a general-purpose server control panel in the style of BaoTa, 1Panel, Cockpit, or a hosting dashboard. Its core job is not to install random software on a live server. Its core job is to understand an old Linux VM well enough to help a human rebuild it safely somewhere else.

EnvForge can also build a clean target VM from the Capability Catalog, but it uses the same safety model: select capabilities, generate an Environment Plan, review the actions, apply them, verify the result, and roll back when needed.

## Workspace Navigation

Regular users and guests see Dashboard, Migrate, Build, Plans, and Reports. Admins also see Capability Admin. Maintain and Account are no longer first-level navigation items: schedules, drift, and webhooks moved to Plans; runtime notices, snapshots, reports, inbox, and account security moved to Dashboard; user and queue governance moved to Capability Admin.

Build is certified-only and no longer exposes supportLevel buckets. Package Integrations is rule-level mapping governance, not a host package install/uninstall manager.

## Operating Modes

- **Migrate Mode**: Source VM -> HostSnapshot -> Analysis -> Review Queue -> Migration Plan -> Target VM -> Apply & Verify -> Report.
- **Build Mode**: Target VM -> Capability Catalog -> Rebuild Plan -> Review -> Apply & Verify -> Report.
- **Maintain Mode**: Managed Environment -> State Diff -> Config Change Proposal / Remove Capability Plan / Repair Plan -> Review -> Apply & Verify.

All target mutations flow through **Environment Plan**. Direct install, direct uninstall, and unverified remote file editing are not product-level operations.

## Mutation Contract

Every operation that can change a target VM must follow:

```text
Capability / Evidence -> Environment Plan -> Review -> Apply -> Verify -> Rollback / Report
```

Legacy direct execution endpoints are not part of the product flow. Catalog actions create Rebuild Plans, imported YAML becomes an Imported Recipe Plan, configuration edits become Change Plans, removals become Remove Plans, and snapshots remain evidence until a Migration Plan is generated.

## Product Principles

- Automatic discovery, cautious migration, human confirmation.
- Installed packages are not treated as user intent. EnvForge scores migration intent from multiple signals.
- The catalog is a capability rule library, not a simple app store.
- Every risky operation should be represented in a plan before it is applied.
- Secrets are not migrated by default; they must be redacted, reviewed, or explicitly confirmed.
- Data directories are not blindly copied; databases prefer logical dump and restore.
- Unknown software is not ignored and not automatically migrated. It enters a review queue.
- SSH configuration changes require special validation and rollback protection.

## Core Capabilities

- **SSH discovery**: read-only source host collection through a shell collector.
- **Inventory model**: packages, services, configs, users, runtimes, containers, network, security, and manual artifacts.
- **Package Intent Score**: distinguishes real migration candidates from base packages, dependencies, and image noise.
- **Config governance**: ownership, default-vs-custom detection, secret scanning, safe read, diff, backup, and validation hooks.
- **Capability Catalog**: software/profile migration rules with detect, config, data, validate, rollback, and cross-distro metadata.
- **Migration planning**: action graph, risk score, migration completeness score, dry run, and review decisions.
- **Apply / Verify / Rollback**: SSH executor, safe sudo writes, file backups, service state capture, validation checks, and rollback plans.
- **Community ecosystem**: comments, suggestions, moderation, in-app inbox, and email notification preferences for catalog evolution.

## Documentation Map

| Document | Purpose |
| :-- | :-- |
| [docs/PRODUCT.md](./docs/PRODUCT.md) | Product positioning, scope, users, non-goals, and roadmap |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Six-stage architecture and module boundaries |
| [docs/MIGRATION_SYSTEM.md](./docs/MIGRATION_SYSTEM.md) | Inventory, package intent, review queue, plan engine, data strategy, verify, rollback |
| [docs/CATALOG_SYSTEM.md](./docs/CATALOG_SYSTEM.md) | Capability Catalog, support levels, schema v2, authoring, LLM prompt, cross-distro mapping |
| [docs/CONFIG_AND_SECURITY.md](./docs/CONFIG_AND_SECURITY.md) | Config ownership, default detection, secrets, safe editing, audit, SSH protection |
| [docs/ROADMAP.md](./docs/ROADMAP.md) | Phased implementation plan and long-term scaling |
| [docs/DEPLOY.md](./docs/DEPLOY.md) | Deployment guide |
| [docs/DEPLOY_SELF.md](./docs/DEPLOY_SELF.md) | Self-hosting and bootstrap deployment notes |

## Technology

- Frontend: React 18, TypeScript, Vite, lucide-react
- Backend: Fastify, TypeScript, ssh2
- Storage: SQLite hybrid document/relational persistence
- Execution: TypeScript-native playbook and SSH execution modules
- Security: scrypt password hashing, AES-256-GCM credential encryption

## Build

```bash
npm run build:server
npm run build --workspace @fool/web
```

## License

MIT
