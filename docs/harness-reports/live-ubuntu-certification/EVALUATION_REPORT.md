# Live Target Certification — Evaluation Report

> **Status: not-run.** No live VM has been contacted. This file is the
> committed placeholder; the operator who runs `npm run harness:certify`
> against a real Ubuntu VM MUST overwrite this file with a filled-in
> copy of `docs/EVALUATION_REPORT_TEMPLATE.md` before promoting the
> certification.

## Why this is empty

The previous phases produced:
- a dry-run baseline at `docs/harness-reports/baseline-2026-05-29/`,
- harness scripts under `scripts/run-harness-*.mjs`,
- six golden scenarios under `scripts/harness/scenarios/`.

A *live* certification requires:
1. A disposable Ubuntu 22.04 / 24.04 VM (Multipass / Vagrant /
   cloud burner) — see `docs/HARNESS_UBUNTU_LIVE_RUN.md`.
2. The five env vars below set per shell:

   - `ENVFORGE_HARNESS_MODE=live`
   - `ENVFORGE_HARNESS_BASE_URL=<https://your-envforge>`
   - `ENVFORGE_HARNESS_BEARER_TOKEN=<token>`
   - `ENVFORGE_HARNESS_TARGET=<connection id>`
   - `ENVFORGE_HARNESS_ALLOW_DESTRUCTIVE=true` (for scenarios 2, 3, 4)

3. Running `npm run harness:certify`. The runner refuses to write any
   `certified-*` verdict without all four ENVFORGE_HARNESS_* vars
   present and `MODE=live`.

The `summary.json` / `summary.md` siblings of this file always reflect
the most recent invocation. As of this commit the verdict is
**`not-run`**.

## What the operator must produce

When a real run is performed, replace this file with the filled-in
template. The required fields are:

- target OS / kernel / package manager / init system
- ssh / nginx / docker service names actually observed
- sudo NOPASSWD status
- apt / dpkg lock state
- firewall stack (ufw / firewalld / nftables / iptables)
- per-scenario plan id, action run records, validate exit codes,
  rollback outcomes
- ManagedCapabilityRecord JSON snapshot (for build / remove scenarios)
- Plan Report path (the `<scenario>.report.md` siblings of this file)
- redaction status confirmation
- final verdict (must match `summary.json:verdict`)

Use `docs/EVALUATION_REPORT_TEMPLATE.md` as the source. Commit the
filled report under `docs/harness-reports/live-ubuntu-certification/`
together with the run's per-scenario `*.report.{json,md}` and
`*.actions.json` files.
