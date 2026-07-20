# Failed GitHub CI Run Summary

- Failed SHA: `8e5e390594fcc68149a24d5184a1710063fc733c`
- Original local Closure: `c146dbfefc54194dbd453940c6bbfe410c75f024`
- Workflow/run: `CI` / `29727165796`
- Run URL: `https://github.com/foolkking/envforge/actions/runs/29727165796`
- Job/check: `build` / `88302822582`
- Job URL: `https://github.com/foolkking/envforge/actions/runs/29727165796/job/88302822582`
- Event/runner: push / `ubuntu-latest`
- Started/completed: `2026-07-20T08:13:51Z` / `2026-07-20T08:15:28Z`
- Failed step: `Validate integrated design baseline`
- Exact subcommand: `npm run validate:docs:mermaid`
- Conclusion: failure
- Secrets redacted: yes; the retained excerpt contains no credentials or tokens

Initial hypothesis confirmed by logs: Chromium could not start because the
GitHub Ubuntu runner did not provide a usable user-namespace or setuid sandbox.
The Mermaid sources were not reached as a rendering failure.
