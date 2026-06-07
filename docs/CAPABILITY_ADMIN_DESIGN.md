# Capability Admin (Catalog) Design

> **Audience.** Administrators. The Catalog page is the administrator
> **Capability Admin workbench** — not an end-user app market. End
> users build through `/market` (Build) and never see this page.

## Positioning

Capability Admin is the admin-only workbench that:

- governs catalog rules and combos,
- drives Full Migration Certification upgrades,
- processes user suggestions submitted from Build / Migrate / Maintain,
- maintains rule-level package / service / config integrations.

End users do **not** use this surface to consume capabilities. Only the
6 certified capabilities are usable after Batch 1, and they are consumed through
Build, not through the registry.

## Permission gating

Two enforcement layers must always agree:

1. **Route-level (UI):** `apps/web/src/main.tsx` only renders
   `CapabilityRulesAdminPage` when `authUser.role === "admin"`. Non-admin
   viewers landing on `/catalog` are auto-redirected to `/market`
   (Build) and shown a "Go to Build" notice as a belt-and-braces
   fallback.
2. **Endpoint-level (API):** every endpoint this page calls returns
   **403** to non-admin tokens (`/api/catalog/certification`,
   `/api/catalog?include=all`, `/api/admin/suggestions`,
   `/api/admin/package-integrations`).

The non-admin nav also drops the catalog entry through
`navItemsForRole(role)` in `apps/web/src/lib/types.ts` — the catalog
`navItem` is marked `adminOnly: true`.

## Two certification states only

The registry collapses the old supportLevel ladder into exactly two
user-meaningful states:

- **Certified** — Full Migration Certified; visible to end users in
  Build.
- **Not Ready** — not yet certified; hidden from end-user Build.

Internally the legacy supportLevel still exists for migration logic,
but it is never the primary axis in the admin UI and never surfaced to
end users.

## Information architecture (4 tabs)

The page renders a top-level tab bar (`data-testid="capability-admin-tabs"`)
with four sections:

1. **Overview** — counts, coverage, P0 backlog, pending suggestions, missing-rule integrations
2. **Rule Registry** — searchable table of every capability + status + missing metrics
3. **Suggestion Inbox** — user-submitted suggestions with status workflow
4. **Package Integrations** — rule-level package / service / config maps

### 1. Overview tab

Renders summary stat cards backed by the certification audit data:

- Certified count
- Not Ready count
- Certification coverage (%)
- Total catalog size
- P0 Backlog count
- Pending Suggestions count
- Integrations missing rule (when integrations data is loaded)

Plus a "P0 Backlog (top 5)" preview table showing the first 5
not-ready capabilities and their missing requirements.

### 2. Rule Registry tab

The core governance surface. Toolbar above a compact table:

- Search input across `capability`, `id`, `capabilityKey`
- Status filter pills: All / Certified / Not Ready
- Category filter pills: service / network / database / container / security / developer / runtime

Table columns:

| Column | Source |
| --- | --- |
| Capability | name + id |
| capabilityKey | `item.capabilityKey` |
| Category | `item.category` |
| Status | `certification.status` |
| Missing Metrics | `certification.reasons` (first 3) |
| Actions | View / drawer toggle |

The expandable detail drawer (per-row) shows the **Full Migration Checklist**:

- Identity, Detection, Install / Rebuild
- Config Governance, Data Strategy, References
- Validation, Rollback, Security
- Cross-distro, Conflict Rules, Plan Integration
- Harness

For not-ready items, the drawer surfaces missing requirements + an
"Generate Upgrade Prompt" button that copies a structured prompt
(capability id, capabilityKey, missing list, link to
`FULL_MIGRATION_REQUIREMENTS.md`) to the clipboard.

The legacy market-card grid is **not** used here — structured rule
data belongs in a table.

### 3. Suggestion Inbox tab

Workflow queue for processing user suggestions submitted from the
catalog suggestion forms. Each row shows:

- Title (zh + en) + remark snippet
- Submitter (display name or username)
- Type
- Related capability (catalog id) when provided
- Status badge: Pending / Accepted / Rejected
- Submitted timestamp
- Per-row actions: **Accept** / **Reject** (admins can attach feedback)

Status filter pills: All / Pending / Accepted / Rejected.

The inbox is backed by:

- `GET /api/admin/suggestions` — paginated list (admin-only)
- `GET /api/admin/suggestions/:id` — single detail (admin-only)
- `POST /api/admin/suggestions/:id/process` — accept/reject (admin-only)

Processing a suggestion updates the row's status; the inbox refetches
on each action so the badge counter on the tab stays in sync.

The current backend exposes `pending` / `accepted` / `rejected`. The
broader workflow vocabulary (`triaged`, `deferred`, `merged`, link to
backlog item) is reserved for a follow-up phase — the data shape and
endpoint contract are stable enough to extend without UI rework.

### 4. Package Integrations tab

Rule-level package-integration governance. **This is NOT a host-level
package manager** — it shows the rule shape that drives detection,
install planning, validation, and rollback for each capability.

Layout: searchable list on the left, detail panel on the right.

Toolbar:

- Search across capability / id / capabilityKey
- Filter pills: All / With rule / Missing rule
- Counter: `with rule X / missing Y / total Z`

List rows show capability + rule status pill (`rule` / `missing`).
Selecting a row loads the detail panel.

Detail panel sections (each carries a stable `data-testid`):

- **Cross-distro package map** (`testId="package-map"`): apt / dnf / yum / pacman / apk
- **Service map** (`testId="service-map"`): debian / rhel / fedora / arch / alpine
- **Detection** (`testId="detection"`): binaries, systemd units, ports
- **Config paths** (`testId="config-paths"`): files, globs, secret patterns
- **Hooks** (`testId="hooks"`): data paths, validate commands, restartServices, data strategy, migration strategy

Plus a collapsed "Raw rule JSON" disclosure for the full
`CatalogDetectionRule` payload. Spotting a missing rule entry from
this panel is the fastest path to fixing a Full Migration
Certification gap.

The integrations tab is backed by:

- `GET /api/admin/package-integrations` — registry list (admin-only)
- `GET /api/admin/package-integrations/:capabilityId` — detail (admin-only)

Both endpoints use a curated alias map so certified catalog items
(e.g. `nginx-web-service`) resolve to their underlying
CatalogDetectionRule (`nginx`).

## Maintain vs Capability Admin (responsibility split)

The Maintain page (`SettingsPage`) is **runtime / host-side**:
schedules, drift detection, webhooks, API tokens, module docs, account.
It used to ship a `CatalogAdminPanel` tab for catalog-item add / edit /
hide. That tab was removed in this phase — rule governance now lives
exclusively in Capability Admin.

| Concern | Owner |
| --- | --- |
| Catalog rule / combo registry | Capability Admin |
| Certification upgrade workflow | Capability Admin |
| User suggestion processing | Capability Admin |
| Cross-distro package / service / config maps | Capability Admin |
| Cron schedules | Maintain |
| Drift baselines and Repair Plan generation | Maintain |
| Webhooks / API tokens | Maintain |
| Module docs reference | Maintain |
| Account / 2FA / identities | Maintain |
| Users & queues admin (job control) | Maintain (Users & Queues tab) |

## Implementation references

- Page: `apps/web/src/pages/CapabilityRulesAdminPage.tsx`
- Nav gating: `apps/web/src/lib/types.ts` (`navItemsForRole`)
- Catalog redirect: `apps/web/src/main.tsx`
- API helpers: `apps/web/src/api.ts` —
  `fetchCapabilityRulesAdmin`, `fetchCatalogAdminAll`,
  `fetchAdminSuggestions`, `processAdminSuggestion`,
  `fetchPackageIntegrations`, `fetchPackageIntegrationDetail`
- Server: `apps/api/src/routes.ts` —
  `/api/catalog/certification`, `/api/catalog?include=all`,
  `/api/admin/suggestions(/...)`, `/api/admin/package-integrations(/...)`
- Audit data: `docs/catalog-audit/full-migration-certification.json`,
  `docs/CAPABILITY_CERTIFICATION_BACKLOG.md`
- Regression tests:
  `apps/api/src/engine/tests/capability-admin-workbench.test.ts`,
  `apps/api/src/engine/tests/catalog-certification-routes.test.ts`,
  `apps/api/src/engine/tests/build-ui-regression.test.ts`
## Capability Admin IA

Capability Admin replaces Catalog as the admin-only capability rules workbench. It contains five peer tabs:

- Overview
- Rule Registry
- Suggestion Inbox
- Package Integrations
- Users & Queues

Overview summarizes certified count, not-ready count, certification coverage, P0 backlog, pending suggestions, pending queue items, recent rule changes, recent certification results, failed certification checks, and owner/reviewer workload.

Rule Registry is a toolbar plus compact table for capability status, missing metrics, suggestions, owners, review queues, last audit, and rule actions.

Suggestion Inbox converts user requests and feedback into triage, acceptance/rejection, owner assignment, backlog items, queues, and upgrade prompts.

Package Integrations is rule-level software support mapping governance for apt/dnf/yum/apk/snap/docker names, service maps, binary/systemd detection, ports, config paths, secret patterns, validate commands, restart/reload hooks, rollback hooks, data strategy, migration strategy, and cross-distro notes. It must not become a host package install/uninstall manager.

Users & Queues manages maintainers, certification reviewers, suggestion handlers, backlog queues, certification review, package integration fixes, rule review, upgrade prompt generation, queue priority, queue status, and assignment. It is not Account, Linux user management, or a server queue monitor.
