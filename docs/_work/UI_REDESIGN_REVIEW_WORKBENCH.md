# EnvForge UI Redesign: Review Workbench

This document turns the selected direction into an implementation-ready UI design:

- Information architecture: GitLab-style plan review and approval.
- Visual style: Linear-style calm, flat, list/detail productivity UI.
- Machine Snapshot treatment: Cockpit/Portainer-style host overview, but only as evidence context.

EnvForge must continue to feel like a migration and rebuild workbench, not a generic server control panel.

## Product Frame

EnvForge's main user question is not "what can I install on this server?"

The main question is:

> What did we discover, what should be migrated, what will change, what is risky, and can we verify or roll back?

The UI should therefore optimize for:

1. Evidence visibility.
2. Review decisions.
3. Plan readiness.
4. Verification status.
5. Rollback/report confidence.

The mutation path stays:

```text
Evidence / Capability
  -> Environment Plan
  -> Review
  -> Apply
  -> Verify
  -> Rollback / Report
```

## IA Model

```yaml
navigation:
  Dashboard:
    role: command-center
    shows: [recent_plans, blockers, failed_verify, pending_review, next_step]
  Migrate:
    role: source-evidence-review-workbench
    shows: [source_vm, hostsnapshot, inventory, config_governance, candidates, migration_plan]
  Build:
    role: catalog-to-plan-workbench
    shows: [capability_catalog, compatibility, variable_config, preflight, rebuild_plan]
  Plans:
    role: plan-lifecycle-center
    shows: [drafts, approvals, dry_run, apply, verify, rollback, reports]
  Maintain:
    role: managed-environment-governance
    shows: [drift, schedules, webhooks, tokens, modules, admin_controls]
  Account:
    role: user-workspace
    shows: [profile, inbox, snapshots, security, identities, notifications]
```

Dashboard is a status surface. Migrate, Build, and Plans are the primary work surfaces. Maintain and Account are supporting surfaces.

## Global Shell

### Layout

```text
+--------------------------------------------------------------------------------+
| Sidebar 264 | Top context bar: mode, active VM/plan, search, inbox, account     |
|             +------------------------------------------------------------------+
|             | Page header / stage stepper / page-level action bar               |
|             +------------------------------------------------------------------+
|             | Main workbench area                                               |
|             |                                                                  |
|             | Left evidence/list rail | Center review/detail | Right inspector  |
|             |                                                                  |
|             +------------------------------------------------------------------+
|             | Optional task console, docked to sidebar bottom / expandable      |
+--------------------------------------------------------------------------------+
```

### Shell Rules

- Sidebar width: 264px desktop, collapsible on tablet/mobile.
- Top context bar: sticky, 64-72px tall, no oversized hero typography.
- Page headers use compact titles and operational context, not marketing copy.
- Search is scoped to current mode where possible.
- Terminal/log panel remains utility-first and docked, never the primary UX.
- Inbox and account are drawers/menus, not full-page interruptions unless the Account page is opened.

## Visual Language

### Tone

Calm, technical, precise. The UI should look like a serious review tool that an operator can keep open all day.

### Palette

Use a neutral base with limited semantic color:

```yaml
background: "#f6f8fb"
surface: "#ffffff"
surface_soft: "#f8fafc"
sidebar: "#101827"
border: "#dbe3ee"
border_subtle: "#e6edf5"
text: "#0f172a"
muted: "#64748b"
primary: "#0f766e"      # plan-safe action
primary_hover: "#0b5f59"
accent: "#2563eb"       # selected / navigational / informational
success: "#15803d"      # verified / passed
warning: "#b45309"      # review needed
danger: "#dc2626"       # blocked / failed / destructive
purple: "#7c3aed"       # rare: imported recipe / community
```

Avoid a single-hue interface. Teal is the primary action color, but status and data visualization should use blue, amber, green, red, and neutral gray intentionally.

### Shape And Density

- Border radius: 6-8px for most surfaces.
- Cards only for repeated items, modals, or framed tools.
- Avoid nested cards. Use split panes, rails, rows, tables, dividers, and sticky inspectors instead.
- Font sizes:
  - Page title: 24-28px.
  - Section title: 15-18px.
  - Dense list row: 12-14px.
  - Status metadata: 11-12px.
- Letter spacing stays `0`, except tiny uppercase labels may use `0.02em`.

## Core Workbench Pattern

The main reusable pattern is a three-zone review workbench:

```text
+----------------------+-------------------------------+------------------------+
| Evidence/List Rail   | Review Surface                | Plan Inspector         |
|----------------------|-------------------------------|------------------------|
| filters              | selected evidence/candidate   | plan status            |
| source facts         | diff / rationale / checks     | risk score             |
| candidate list       | decision actions              | blockers               |
| config list          | comments / notes              | approvals              |
| unknown queue        | related files/services        | verify/rollback        |
+----------------------+-------------------------------+------------------------+
```

Use this pattern in Migrate, Build, and Plans with different left rail content.

## Page Designs

### 1. Dashboard: Command Center

Purpose: show what needs attention, not a marketing overview.

```text
Header: EnvForge / Command Center
Subnav: All | Needs review | Failed verify | Recently applied

+----------------+----------------+----------------+----------------+
| Pending review | Failed verify  | Active plans   | Connected VMs  |
+----------------+----------------+----------------+----------------+

+----------------------------------------+----------------------------------+
| Attention queue                         | Recent plan activity             |
| - plan name / blocker / next action     | - status timeline                |
| - failed verification                   | - type / owner / updated         |
+----------------------------------------+----------------------------------+

+------------------------------------------------------------------------+
| Environment coverage: Migrate / Build / Maintain plan distribution      |
+------------------------------------------------------------------------+
```

Rules:

- Every tile should link to a real work surface.
- Failed verification and pending review are visually stronger than success counts.
- Avoid big hero areas.

### 2. Migrate: Source Evidence Review Workbench

Purpose: turn source VM evidence into reviewed migration intent.

```text
Top:
  Source: old-vm-01        Target: not selected        Stage: Classify
  Discover -> Classify -> Plan -> Review -> Apply -> Verify -> Report

Left rail: Machine Snapshot
  - OS / distro / kernel
  - services / ports / package managers
  - runtimes / containers / security warnings
  - config categories
  - unknown artifacts count

Center: Review Surface
  Tabs: Candidates | Config Governance | Unknown Queue | Snapshot
  List/detail:
    candidate name, score, band, evidence signals, decision state
    expanded detail shows why it matters and what plan action it creates

Right inspector: Migration Plan
  - completeness
  - risk score
  - selected actions
  - blockers
  - dry-run
  - verify preview
  - export
```

Machine Snapshot borrows from Cockpit/Portainer only here: compact host facts and health-like summaries. It must not expose general server administration controls.

Primary actions:

- Collect HostSnapshot.
- Add selected evidence to plan.
- Mark include / review / ignore.
- Open config diff.
- Generate or refresh Migration Plan.

Dangerous actions:

- Apply is not available directly in Migrate unless it is routed through the Plan Inspector and review gate.

### 3. Build: Catalog To Rebuild Plan

Purpose: select capabilities, configure them, and generate a reviewed rebuild plan.

```text
Top:
  Target: clean-vm-02        Stage: Configure
  Select -> Configure -> Preflight -> Plan -> Review -> Apply -> Verify -> Report

Left rail:
  - category filters
  - support level filters
  - selected capabilities
  - compatibility warnings

Center:
  capability list / compact catalog rows
  selected item detail with guide, variables, dependencies, validation hooks

Right inspector:
  Rebuild Plan preview
  batch impact
  required variables
  preflight blockers
  approve/apply gate
```

Catalog cards should become denser rows or compact tiles. The catalog is a rule library, not an app store.

### 4. Plans: Plan Lifecycle Center

Purpose: approve, execute, verify, repair, roll back, and report.

```text
Left rail:
  filters: all, draft, needs-review, approved, applying, failed, verified
  plan list: name, type, status, updated, risk

Center:
  selected plan detail
  action graph
  YAML / task preview
  config diffs
  execution timeline
  verify results

Right inspector:
  approval gates
  risk acknowledgements
  target readiness
  dry-run/apply/verify/rollback/report actions
```

This page should feel closest to GitLab merge request review:

- A plan is a reviewable artifact.
- Conflicts and risks are first-class.
- Approval gates block execution.
- Verify and rollback are visible before apply.

### 5. Maintain: Managed Governance

Purpose: keep managed environments healthy without turning into a control panel.

Structure:

- Drift baseline/check.
- Schedules.
- Webhooks.
- API tokens.
- Module docs.
- Catalog admin.
- User/queue admin.

Maintain should use a settings/workbench hybrid:

```text
Left rail: settings groups
Center: selected group form/list
Right: help, recent events, safety notes
```

### 6. Account And Inbox

Purpose: identity, notifications, suggestion feedback, and user-owned content.

Keep it quiet and form-focused:

- Profile.
- Email.
- 2FA/recovery.
- OAuth identities.
- Notification preferences.
- Activity.
- Danger zone.

Inbox should remain a drawer for quick checks and a full Account subview for longer review.

## Component Set

```yaml
layout:
  AppShell:
    owns: [sidebar, top_context_bar, workspace]
  WorkbenchFrame:
    owns: [stage_stepper, left_rail, review_surface, inspector, task_console_slot]
  SplitListDetail:
    owns: [filter_bar, list, selected_detail]

navigation:
  SidebarNav
  ContextSearch
  StageStepper
  ModeSwitcher

data_display:
  MetricTile
  StatusChip
  RiskBadge
  EvidenceSignal
  EmptyState
  Timeline
  DiffViewer
  MarkdownReportViewer

review:
  DecisionToolbar
  ApprovalGate
  RiskCallout
  ConflictCard
  PlanInspector
  ReadinessChecklist

forms:
  FieldGroup
  VariableEditor
  ConfigEditor
  ModalShell
  DrawerShell

operations:
  TaskConsole
  VerifyResultPanel
  RollbackPanel
  ExportMenu
```

## Interaction Rules

- Selection should never move the user to a new page if list/detail can keep context.
- Review decisions must appear close to the item being reviewed.
- Plan actions belong in the inspector or Plans page, not scattered across candidate lists.
- Apply actions require visible readiness and review state.
- Export/report actions are secondary.
- Use drawers for guide/comments/inbox where the user needs temporary context.
- Use modals for focused configuration only, such as capability variable setup.

## Implementation Sequence

1. Clean visible mojibake and stabilize bilingual labels.
2. Consolidate CSS tokens and remove older duplicate visual rules.
3. Rebuild AppShell: sidebar, sticky context bar, compact page header.
4. Introduce `WorkbenchFrame` classes and layout utilities.
5. Redesign Migrate first because it defines the product mental model.
6. Redesign Plans around review/approval/verify/rollback.
7. Redesign Build catalog into compact catalog-to-plan workbench.
8. Redesign Dashboard as command center.
9. Normalize Maintain, Account, Reports to the same component language.
10. Run build and browser checks across desktop/mobile widths.

## Acceptance Criteria

- A new user can explain that EnvForge creates and reviews plans, not direct server changes.
- Every target mutation visibly passes through review, apply, verify, and rollback/report.
- Migrate page makes source evidence visible without becoming a server admin panel.
- Candidate/config review and plan readiness are visible at the same time.
- Long lists are bounded and scrollable.
- Text fits in buttons, list rows, cards, sidebars, and modal headers.
- UI uses consistent spacing, radius, typography, and status colors.
- No mojibake appears in core navigation, page headers, buttons, or safety messages.
