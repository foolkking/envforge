# Root Cause Analysis

## Symptom

The only check for remote SHA `8e5e390594...` failed in `CI / build` while
executing `npm run validate:design`. Static and Markdown validation passed;
Mermaid rendering exited before rendering because Puppeteer could not launch
Chromium.

## Root Cause

- Category: environment parity defect.
- GitHub `ubuntu-latest` runs Chromium in an AppArmor/user-namespace environment
  where Puppeteer's default sandbox is unavailable.
- `tools/preparation/render-mermaid.mjs` invoked `mmdc` without a
  `puppeteerConfigFile`, so the CI runner had no supported launch mode.

## Why Local Validation Missed It

Phase 0 Closure validation ran on Windows, where Chromium uses a different
sandbox implementation. The exact Mermaid command passed locally and therefore
did not exercise the Linux/AppArmor launch boundary.

## Corrective Action

Add a reviewed Puppeteer configuration containing `--no-sandbox` and
`--disable-setuid-sandbox`, and pass it only when both `CI=true` and the platform
is Linux. The renderer still launches Chromium, renders every `.mmd`, verifies
an SVG was created, hashes outputs, and propagates any non-zero exit.

## Risk and Recurrence

Disabling Chromium's sandbox is limited to an ephemeral GitHub runner and does
not affect production EnvForge processes. Mermaid source remains repository-
controlled. A future runner sandbox change can remove this compatibility file;
the real render gate will detect drift rather than silently pass.

Affected files: `tools/preparation/render-mermaid.mjs` and the new CI Puppeteer
configuration. No product, database, migration, auth, Artifact, or Plan behavior
is affected.
