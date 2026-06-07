# UI And Flow Remediation Targets

This document is the implementation target for the current round. The 100+ catalog item-by-item audit remains intentionally out of scope.

## Target IA

Primary navigation is corrected to the surfaces that actually exist today:

| Nav | Purpose |
| --- | --- |
| Migrate | Source VM connection, HostSnapshot collection, analysis evidence, config governance, migration candidate review |
| Build | Capability Catalog selection and Rebuild Plan generation |
| Plans | Environment Plan / Playbook review, dry-run, apply, verify, export |
| Maintain | Managed environment settings, safe maintenance controls, admin settings |
| Account | Profile, inbox, uploads, user-owned workspace content |

Reports are still a product goal, but the current profile/workspace page must not be mislabeled as Reports.

## UI Changes

1. Remove the duplicate Reprobe action from connection cards. Keep Edit and Delete only.
2. Rename/reframe source capture actions:
   - Keep "Collect HostSnapshot".
   - Remove "Capture & Generate Rebuild Playbook" as a primary button.
   - Plans should be generated from classified evidence in the plan panel.
3. Make evidence/config/candidate lists bounded and scrollable.
4. Move terminal/log panel into the sidebar-bottom footprint by default. Keep height and width resizing.
5. Clean visible mojibake and add zh/en text for new labels.

## Plan Flow Changes

1. Build Mode: Capability Catalog creates Rebuild Plan, then applies after review.
2. Migrate Mode: HostSnapshot creates candidates; candidates/configs create Migration Plan items.
3. Configs:
   - Config ownership and secret risk are shown in Config Governance.
   - Config files can be selected into the migration plan as explicit copy/review actions.
   - Config editing remains Config Change Proposal.

## Config Migration Policy

Config migration is explicit, not silent:

1. Selecting Nginx/Docker/PostgreSQL capability shows catalog-owned config paths in the plan.
2. User-created or modified config files are separate migration artifacts.
3. Secret or blocked config files default to review/skip.
4. Generated plans include copy/review actions and validation hooks where available.

## Research Notes Used

- Sidebar navigation is appropriate for dashboard/admin-style products with multiple major sections because it keeps destinations visible and scannable.
- For dense enterprise tools, common sidebar widths are around 240-280px; this informs the default sidebar/log footprint.
- Scrolling content should be contained in panels when lists are long, rather than expanding the entire page indefinitely.
