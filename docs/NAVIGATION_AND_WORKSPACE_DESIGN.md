# Navigation and Workspace Design

EnvForge now treats the main navigation as a workspace map, not a feature dump.

## Main Navigation

Regular users and guests see only:

- Dashboard
- Migrate
- Build
- Plans
- Reports

Admins see the same items plus Capability Admin.

Catalog is no longer an end-user page. It is the admin-only Capability Admin workbench for rule governance, certification upgrades, suggestion triage, package integration mapping, maintainers, and queues. Non-admin visits to `/catalog` redirect to Build.

## Why Maintain Was Removed

Maintain mixed three different concerns:

- schedule, drift, and webhook operations
- admin rule and queue governance
- runtime notices and repair prompts

Those now live where users expect them:

- Schedules, Drift, and Webhooks moved to Plans because they operate on Environment Plans.
- Users & Queues moved to Capability Admin because they govern rule owners, certification reviewers, suggestion handling, backlog queues, and assignment.
- Runtime notices moved to Dashboard as actionable findings, not server monitoring metrics.

## Why Account Was Removed

Account is no longer a first-level page. Profile, SSH keys, API tokens, sessions, 2FA, and preferences are exposed through Dashboard / Account & Security drawers. Inbox, notifications, snapshots, reports, and exports are also summarized on Dashboard.

Full migration method tutorial content was removed instead of being merged.

## Build Contract

Build is certified-only. It calls `GET /api/catalog`, which returns only certified capabilities. Build does not call `GET /api/catalog?include=all` or `GET /api/catalog/certification`.

Build does not render supportLevel filters or badges. Users only filter by capability type: All, Runtime, Database, Security, Network, Container, Dev, and Service. Not-ready capabilities remain hidden in the admin rule library.

## Plans Contract

Plans is the Environment Plan Operations Center:

- Plans
- Runs
- Schedules
- Drift
- Webhooks
- Reports

Schedules trigger Snapshot, Drift Check, Report, and Certification Check workflows. Drift compares target state against snapshots and plans, then suggests Repair Plans. Webhooks trigger Snapshot, Plan, and Report workflows through reviewed Environment Plan paths.

## Capability Admin Contract

Capability Admin has five tabs:

- Overview
- Rule Registry
- Suggestion Inbox
- Package Integrations
- Users & Queues

Suggestion Inbox turns user software and combo feedback into triage, backlog, owner assignment, and upgrade prompts.

Package Integrations is rule-level governance for package maps, service maps, binary detection, systemd detection, default ports, config files, config globs, secret patterns, validate commands, restart/reload services, rollback hooks, data strategy, migration strategy, and cross-distro notes. It is not a host package install/uninstall manager.

Users & Queues supports maintainers, certification reviewers, suggestion handlers, backlog queues, package integration fixes, rule review queues, upgrade prompt queues, assignment, priority, and workflow status. It is not an account center, Linux user manager, or server queue monitor.
