# Product

Productization design roadmap: [docs/product/README.md](./product/README.md).

EnvForge turns an existing Linux host into a safe, explainable, rebuildable
Environment Plan. It discovers broadly, migrates cautiously, and asks for human
review when confidence, secrets, data, or cross-distro behavior are uncertain.

## Positioning

EnvForge is:

- a Linux VM migration and rebuild platform;
- a review workbench for software, config, services, data, runtimes, and manual
  artifacts;
- a plan generator that can apply, verify, roll back, and report changes.

EnvForge is not:

- a generic server control panel;
- a secret vault replacement;
- a full disk imaging/backup tool;
- a Kubernetes control plane;
- a direct remote text editor or package manager UI.

## Mutation contract

Every target mutation must follow:

```text
Capability / Evidence -> Environment Plan -> Review -> Apply -> Verify -> Rollback / Report
```

Snapshots and scans are evidence. They do not deploy by themselves. Catalog
selection creates Rebuild Plans. Config edits create Change Plans. Removals
create Remove Plans. Failed verification can create Repair Plans.

## Modes

| Mode | Input | Output | Boundary |
|---|---|---|---|
| Migrate | Existing source VM | Migration Plan | Source collection is read-only by default |
| Build | Clean target VM + certified catalog | Rebuild Plan | End users see certified capabilities only |
| Maintain | EnvForge-managed target | Change, Remove, Repair Plans | All changes still pass through Environment Plan |

All modes share the same plan/review/apply/verify/report path.

## User roles

| Role | Need |
|---|---|
| Individual developer | Rebuild a VPS or dev server |
| Homelab operator | Understand what matters before replacing a host |
| Small team admin | Standardize migration reports and reduce undocumented work |
| Platform engineer | Export reproducible plans and review risky changes |
| Catalog contributor | Improve capability rules and certification quality |
| Admin/maintainer | Govern rules, suggestions, queues, owners, standards |

## Workspace IA

| Surface | Responsibility |
|---|---|
| Dashboard | Command center, blockers, snapshots, recent plans, account/security drawers |
| Migrate | Source VM connection, HostSnapshot, evidence/config/data review, Migration Plan |
| Build | Certified capability selection, configuration, Rebuild Plan |
| Plans | Plan lifecycle: review, runs, schedules, drift, webhooks, reports |
| Reports | Generated report history and exports |
| Capability Admin | Admin-only rule registry, standards, suggestions, integrations, users/queues |

Removed first-level surfaces:

- Maintain: schedules/drift/webhooks moved to Plans; runtime notices moved to
  Dashboard; users/queues moved to Capability Admin.
- Account/Settings: folded into topbar More, Dashboard, Plans, and Capability
  Admin context.
- Catalog for end users: replaced by Build. Capability Admin is admin-only.

## Product principles

- Installed packages are not user intent. Package Intent Score combines catalog
  matches, services, ports, configs, data paths, manual install signals, and
  dependency/base package downranking.
- Unknown software is neither ignored nor auto-migrated. It enters a review
  queue.
- Secrets are redacted by default and are never copied silently.
- Database and stateful data prefer logical dump/restore or official backup
  tools. Raw live data-directory rsync is not a default strategy.
- Docker image lists are supporting evidence, not migration plans.
- SSH/firewall/sudoers changes need special validation and rollback protection.
- Manual steps are first-class when automation would be unsafe.

## Success metrics

A user should be able to answer:

- What was discovered?
- Why does EnvForge think it matters?
- What will change on the target?
- What is risky, incomplete, blocked, or manual?
- Which secrets/data paths need special handling?
- How will the rebuilt environment be verified?
- What rollback/report evidence will exist after apply?

## Roadmap themes

| Theme | Current direction |
|---|---|
| Catalog depth | Maintain Full Migration Certified rules and explicit terminal decisions |
| Package intent | Enrich evidence with configs, data, containers, language ecosystems |
| Config governance | Ownership, default/custom detection, secret review, safe apply |
| Plan engine | Improve target selection, config copy review, data actions, rollback depth |
| Execution | Managed execution, action runs, verification, reports |
| Admin loop | Suggestions, standards, package integrations, owners, review queues |
| Scaling | Keep SQLite default; define repository interfaces for future PostgreSQL/Redis/search backends |
