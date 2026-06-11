# Decisions

Durable decisions that are not obvious from code and should not be silently
reversed.

| ID | Decision | Rationale | Reverse only if |
|---|---|---|---|
| D1 | Settings/Account are not first-level IA surfaces. They are folded into topbar More, Dashboard, Plans, and Capability Admin context. `SettingsPage.tsx` is a deprecated shell. | Keeps the app focused on operational work rather than settings navigation. | Product explicitly reintroduces standalone Settings. |
| D2 | Page id `catalog` is intentionally not renamed. | It overlaps with business concepts such as `CatalogItem`, `fetchCatalog`, and plan source data. Renaming has high regression risk. | A full test-backed sweep of catalog business usage is done. |
| D3 | `styles.css` has two cascading layers and must not be blindly reduced. | Legacy-only properties still affect UI while the refresh layer overrides newer properties. | CSS split is completed and old-only properties are folded forward. |
| D4 | Build shows only Full Migration Certified capabilities to ordinary users. | Safety and trust: not-ready capabilities remain in admin governance. | Certification policy changes product-side. |
| D5 | Capability Admin is rule/certification governance, not host package management. | Package Integrations manage mappings and rules, not live target installs. | Product scope expands explicitly into server management. |
| D6 | Design-system wrappers are gradual. | `Button` can preserve existing visuals, but Badge/Card/StatusPill can change layout/color and need review. | A deliberate visual redesign is scoped and reviewed. |
| D7 | Persistent docs are compact and consolidated. | Fewer maintained docs reduce drift; generated outputs and archives are separated. | A specific doc grows enough to justify independent maintenance. |

Historical drafts may exist in `docs/archive/`, but active decisions are the rows
above plus current code behavior.
