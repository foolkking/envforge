# EnvForge UI And Flow Audit Todo

Temporary working checklist for the current remediation round. This file is intentionally concrete so each visible surface can be checked against the product direction:

> EnvForge manages rebuildable Linux environments. It must not present itself as a generic server panel. Any target mutation must move through Environment Plan review, verification, and rollback.

## Global Navigation

- [x] Main navigation labels must match actual page responsibility.
- [x] No page should be called Reports if it mainly shows account/profile/workspace content.
- [x] Migrate page must cover Source VM, HostSnapshot, Analysis, Review Queue, Migration Plan, and config governance evidence.
- [x] Build page must cover Capability Catalog and Rebuild Plan generation.
- [x] Plans page must cover Environment Plans, Playbooks, dry-run/apply/verify/export.
- [x] Maintain page must cover managed environment settings and safe changes, not arbitrary server management.
- [x] Account page must cover identity, inbox, uploads, and user-owned workspace content.

## Internationalization

- [x] Sidebar, page titles, major buttons, empty states, and newly added migration/config text must be available in zh/en.
- [x] Mojibake text must be removed from visible core migration/config/account UI.
- [x] New labels must avoid "Install", "Uninstall", or "Save config" as primary concepts.

## Migrate Page

- [x] Connection cards should only expose Edit/Delete; "Reprobe" duplicates Collect HostSnapshot and should be removed.
- [x] Collect HostSnapshot is the single source-machine collection action.
- [x] "Capture & Generate Rebuild Playbook" must be removed or reframed. Source snapshots are evidence; plans are generated in Plans.
- [x] Capability evidence and config governance lists need fixed height/pagination so large hosts do not create unusable pages.
- [x] Config governance must distinguish migration-relevant config from general machine health/security facts.

## Migration Candidates And Plans

- [x] Low-confidence lists must be usable at scale with pagination/fixed height.
- [x] Bulk actions must not be dumped into the lower right; decision actions belong near the list and plan actions belong in the plan review panel.
- [x] Remove redundant buttons such as "Select all current" and "Clear current" if checkbox selection already covers the action.
- [x] Selected candidates should generate or update a migration plan, not run standalone playbooks.

## Config Governance

- [x] Config files are first-class migration artifacts.
- [x] Software selection must not silently imply config migration without showing config paths and risks.
- [x] Config file selection must be able to create plan items/actions.
- [x] Config changes must remain proposal based: diff, secret scan, validation, safe apply, rollback.

## Log Panel

- [x] The log panel should dock at the app's left bottom, inside the sidebar width by default.
- [x] Its right edge must align with the sidebar boundary when collapsed.
- [x] It must support resizing without blocking main content.
- [x] Default width should be around 260px, matching common desktop sidebar widths and current app density.

## Verification

- [x] Typecheck API and web.
- [x] Build API and web.
- [x] Run migration/environment-plan tests.
- [ ] Use browser verification for major layout changes. Browser plugin blocked access to the local URL in this session, so this remains a manual visual check item.
