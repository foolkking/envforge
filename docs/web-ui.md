# Web UI

EnvForge's UI should feel like an operations review workbench, not a marketing
page and not a generic server panel. The central question is:

```text
What was discovered, what should be migrated, what will change, what is risky,
and can it be verified or rolled back?
```

## Navigation

| Role | Top-level surfaces |
|---|---|
| Anonymous | Public landing, login/register, docs/demo when exposed |
| User | Dashboard, Migrate, Build, Plans, Reports |
| Admin | User surfaces plus Capability Admin |

Removed from first-level IA:

- Account/Settings: folded into topbar More, Dashboard, Plans, and Capability
  Admin context.
- Maintain: decomposed into Plans, Dashboard, and Capability Admin.
- Catalog for ordinary users: replaced by Build.

## Six-step mainline

```text
Migrate -> Build -> Review -> Apply -> Verify -> Report
```

Implementation source of truth:

- `apps/web/src/lib/nav.ts`: nav groups and pipeline mapping.
- `apps/web/src/components/PipelineBar.tsx`: persistent six-step bar.
- `navigateApp(page, view?)`: page and subview navigation.

## Global shell

Preferred pattern:

```text
Sidebar | Top context bar
        | Pipeline / page action bar
        | Workbench area: list rail + review/detail + inspector
```

Rules:

- Keep workspace density high and operational.
- Avoid large hero sections inside `/app`.
- Avoid nested cards. Use tables, rows, rails, dividers, inspectors, drawers.
- Keep terminal/log panel utility-first; it should not hide core navigation.
- Use drawers for secondary temporary context; avoid stacked modals.

## Page responsibilities

| Page | Purpose |
|---|---|
| Dashboard | Attention queue, blockers, failed verify, recent plans, connected hosts, account/security drawers |
| Migrate | Source connection, HostSnapshot, evidence, candidates, config/data review, migration plan readiness |
| Build | Certified capability selection, capability config, preflight, Rebuild Plan draft |
| Plans | Plan list/detail, approvals, dry-run, apply, verify, rollback, schedules, drift, webhooks, reports |
| Reports | Generated report and export history |
| Capability Admin | Admin governance for rules, standards, suggestions, integrations, users/queues |

## Migrate pattern

Migrate should expose evidence and decisions side by side:

- left rail: source facts, snapshot, OS/services/ports/runtimes/security/config
  categories;
- center: candidates, config/data bundles, unknown queue, evidence details;
- inspector: plan completeness, risk, blockers, target readiness, dry-run, apply
  readiness, rollback/report.

Config/data review must show `ConfigBundle`/data strategy, not a raw full file
tree. Secrets are explicit blockers. Data strategy must be confirmed before
apply.

## Build pattern

Build is certified-only:

- no supportLevel filter;
- no not-ready items;
- no app-store cards with ratings/downloads;
- no "install now" semantics.

The workflow is selection -> configure -> preflight -> plan review. Capability
cards/rows should show certification, risk/data/secret/manual-step indicators,
and "Add to Plan" style actions.

## Plans pattern

Plans is the lifecycle center:

- plans/runs/schedules/drift/webhooks/reports;
- GitLab-like review artifact behavior;
- approval gates block apply;
- dry-run failure blocks apply;
- verify results flow into report;
- rollback availability is visible before and after apply.

## Capability Admin pattern

Capability Admin is admin-only. Current intended tabs:

- Overview.
- Rule Registry.
- Standards.
- Suggestion Inbox.
- Package Integrations.
- Users & Queues.

Package Integrations is rule-level package/service/config mapping governance.
It must not become a host install/uninstall manager.

## Visual language

| Attribute | Direction |
|---|---|
| Tone | Calm, technical, precise |
| Density | Workbench/table/list detail, not marketing layout |
| Radius | 6-8px for most surfaces |
| Type | Page title 24-28px; section 15-18px; rows 12-14px |
| Color | Neutral base with semantic green/amber/red/blue; avoid one-hue UI |
| Dark mode | Token-driven, not per-component ad hoc patches |

## Design-system rollout

Current shared components:

- `components/ui/Button.tsx`
- `components/ui/Badge.tsx` (`tone`, `size`, and `title`)
- `components/ui/Card.tsx`
- `components/ui/StatusPill.tsx`

Conversion rules:

- Button wrapper maps to existing visual classes. Convert only exact clean
  variants.
- Badge/StatusPill are semantic and can change appearance; review page by page.
- Structural cards cannot be replaced blindly because layout classes may carry
  grid/padding/behavior.
- `score-pill` and similar ambiguous status elements need explicit mapping first.

## CSS rules

`apps/web/src/styles.css` imports modular CSS files first, then retains the
legacy monolith while rules are moved gradually:

```text
styles/tokens.css
styles/base.css
styles/components.css
styles/shell.css
styles/public.css
styles/pages-build.css
styles/pages-migrate.css
styles/pages-plans-reports.css
styles/pages-governance.css
```

The remaining monolith has two layers:

1. legacy layer;
2. operations-console refresh layer.

The refresh layer wins by cascade, but layers merge by property. Do not delete
legacy rules until old-only properties have been folded into the new layer.
Append targeted overrides at the end when needed.

New dark-mode work should prefer `--ef-*` tokens over page-specific patches.

## i18n rules

- `i18next` / `react-i18next` are the runtime i18n foundation.
- New visible UI copy must be added to `apps/web/src/i18n/locales/{zh,en}.ts`.
- Do not add new inline `locale === "zh" ? ... : ...` branches unless the value
  is a temporary compatibility bridge for an unmigrated child component.
- Mojibake user-visible text should be replaced only when the intended text is
  clear from existing English, product docs, or UI context.

## UI smoke

- Run `npm run smoke:web` for major shell, navigation, CSS, i18n, or dark-mode
  changes.
- Default smoke checks public, login/register, user app routes, admin route,
  desktop/mobile, zh/en, light/dark.
- Visual screenshots are opt-in with `PW_SNAPSHOT=1`; default smoke avoids
  baseline churn.

## Current known UI backlog

1. Continue migrating deep page i18n into dictionaries.
2. Move legacy/refresh CSS rules into the modular files by domain.
3. Design system deepening beyond clean Button/Badge cases.
4. Expand Playwright assertions as pages stabilize.
