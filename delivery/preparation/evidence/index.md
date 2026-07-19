# Preparation Evidence Index

Captured from the Preparation worktree. Evidence is classified as current
implementation, validation output, historical evidence, or generated artifact.
It contains no credentials or raw environment dumps.

| Area | Evidence |
|---|---|
| Repository and toolchain | `repository-baseline.json`, `repository-inventory.md`, `dependency-toolchain.md` |
| API and contracts | `api/current-api-inventory.json`, `api/openapi-validation.json`, `api/json-schema-validation.json` |
| Database | `database/current-database-inventory.md`, `database/reference-ddl-validation.json` |
| Runtime and security | `current-state/current-execution-chain.md`, `current-state/security-audit.md` |
| UI and experience | `experience/current-ui-inventory.md` |
| Legacy and history | `legacy-docs/disposition-coverage.json`, `historical-validation/code-diff-from-audit.txt` |
| Generated validation | `generated-artifacts/mermaid-validation.json` |
| Hashes | `hashes/input-hashes.json`, `hashes/existing-docs-before-manifest.txt`, `hashes/installed-design-manifest.txt` |
| Tests | `tests/baseline-test-report.md`, `tests/failure-paths.json`, `tests/security-scan.json` |

Commands and versions are recorded in `command-index.md` and
`dependency-toolchain.md`. Generated validation can be rerun with
`npm run validate:preparation`.
