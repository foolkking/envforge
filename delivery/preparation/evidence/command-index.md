
# Preparation Command Index

Every formal test record includes exact command, version/environment, exit code, result, and evidence path in `evidence/tests/baseline-test-report.md` and the Closure Report.

Initial official commands discovered from package manifests:

- `npm run typecheck`
- `npm run build`
- `npm test` (`npm run test --workspace @fool/api`)
- `npm run preflight`
- `npm run audit:catalog`
- `npm run test:golden`
- `npm run test:capabilities`
- `npm run smoke:web`
- `npm run harness:scenarios` (dry-run but writes generated reports; defer until output-path policy is fixed)
- `npm run harness:certify` (live and destructive-capable; prohibited without disposable target and explicit operator inputs)

There are no configured root lint, formatting-check, generic unit/integration split, production PostgreSQL migration, security-scan, or Docker E2E scripts at entry. Preparation records these as `NOT-CONFIGURED` or `SKIPPED-environment`, not PASS.
