# EnvForge Phase 2 Entry Assessment

## Verdict

`ENTRY-PASS`

## Binding

- Branch/remote: `delivery/envforge-v1` / `origin/delivery/envforge-v1`
- Initial/local/remote HEAD: `bbfaafe80e4c8095430dba5a553aea5fde64dd2e`
- Phase 1 Closure SHA-256: `ac15f61391a227fa5eb48a525af4bf24fb6d77beb82ef3487e308c0687a9b6a4`
- Phase 1 Handoff SHA-256: `3b60db74d16315d0e3c0f712f69dfa46d74d5ddc143cd8e40e8bf10df37845b`
- External Phase 1 CI receipt: PASS for the exact initial HEAD.
- GitHub Actions: run `29749623596`, required check `CI / build`, completed/success.
- Prompt version: `1.1`; overlay `1.1`; effective `1.1+delivery-ci.2`.
- Effective Prompt SHA-256: `a4b47d9073fdb1febb4e94571466b8048fe73d741569f85b0243ad21ce0179b7`
- Prompt body stored in repository: false.
- Approved Plan fixture: `phase1-approved-build-v1`, Plan hash `797c27e8463d03b99d3f60cc90082fe3b249a6c6d1c048f6d0f87ec36a5ccfa2`.
- Approval hash: `edcba1a5af60514df05e61543924b3390d8b894ea053a116998d993844a97cc2`.

The Phase 1 Handoff's sole pending CI blocker is externally satisfied by the exact-SHA receipt and independently queried successful GitHub check. No other blocker exists.

## Baseline

- Build: PASS.
- Typecheck: PASS.
- API: first run 1028/1029, immediate identical rerun 1029/1029. The intermittent baseline is tracked for repeated stabilization runs.
- Existing PostgreSQL test harness: PostgreSQL 17 disposable clusters.
- Existing legacy Apply: SQLite/process-scoped and isolated from the new authority.

