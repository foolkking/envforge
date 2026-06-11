# AGENTS.md

Start by reading `PROJECT_STATE.md` for the current repository snapshot.

## Repo context

- npm workspaces monorepo. Main packages: `apps/web`, `apps/api`,
  `packages/{core,collectors,restorers,cli}`. Node >= 20, npm >= 10.
- Product invariant: every target mutation must flow through Environment Plan
  review/apply/verify/rollback. Do not add direct install, uninstall, or remote
  edit product paths.
- Active implementation area is `apps/web/src`; current status and backlog are
  tracked in `PROJECT_STATE.md`.

## Commands

| Task | Command |
|---|---|
| Web typecheck after any web edit | `cd apps/web && npx tsc --noEmit` |
| Typecheck all | `npm run typecheck` |
| Build all | `npm run build` |
| Build server | `npm run build:server` |
| API tests | `npm run test --workspace @fool/api` |
| Web dev | `npm run dev:web` |
| API dev | `npm run dev:api` |

## Web editing rules

- Prefer small, targeted edits. After web edits, run `cd apps/web && npx tsc
  --noEmit`; for large files also confirm line count or tail content to avoid
  truncation.
- `apps/web/src/pages/CapabilityCatalogPage.tsx` has mojibake comments. Do not
  bulk rewrite it; edit only clean target lines.
- When renaming, search both quoted forms (`"name"`) and object-key forms
  (`name:`). Local text dictionaries often hide from quoted-only searches.
- Do not rename page id `catalog` unless doing a full catalog/business-concept
  migration. It intentionally remains because it overlaps with `CatalogItem`,
  `fetchCatalog`, and plan source concepts.

## CSS and design system

- `apps/web/src/styles.css` has two cascading layers: legacy plus
  "operations-console UI refresh". They merge by property. Do not delete legacy
  selectors until old-only properties have been folded into the refresh layer.
- New override rules appended at the end of `styles.css` win by cascade.
- `components/ui/Button.tsx` maps to existing global button classes. Convert only
  exact clean variants (`primary-action`, `secondary-action`, `ghost-action`,
  `conn-btn conn-btn-danger`) and use the `loading` prop for `btn-loading`.
- Do not blindly convert `conn-btn conn-btn-ghost`, `catalog-md-link`,
  `filter-pill`, role tabs, list-item buttons, structural cards, or `score-pill`.
- Badge/StatusPill tone mapping changes appearance and should be reviewed page by
  page.

## IA decisions

- Settings/Account are not first-level routes. They are folded into topbar More,
  Dashboard, Plans, and Capability Admin surfaces. `SettingsPage.tsx` is a
  deprecated shell.
- Build is certified-only for end users. Do not surface supportLevel filters,
  not-ready capabilities, ratings, or market-style install controls.
- Capability Admin is admin-only governance: rule registry, standards,
  suggestions, package integrations, users and queues. It is not host package
  management.

## Documentation rules

- Durable docs are intentionally compact. Use `docs/index.md` for the map.
- Update `PROJECT_STATE.md` when current code/doc state changes.
- Put long-lived decisions in `docs/decisions.md`.
- Generated certification output belongs in `docs/generated/`.
- Do not persist raw chat logs, secrets, environment dumps, or local runtime data.

## Prohibited / caution

- Do not commit `.env`, tokens, private keys, `data/envforge.db*`, `data/keys/*`,
  logs, timestamped harness outputs, or local screenshots unless explicitly
  requested.
- Normalize CRLF churn before committing: add `.gitattributes` with
  `* text=auto eol=lf`, then `git add --renormalize .`.
- If `.git/index.lock` exists, do not run git operations until the lock clears.
