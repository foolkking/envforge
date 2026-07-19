#!/usr/bin/env python3
"""Generate deterministic, secret-free Preparation repository evidence."""

from __future__ import annotations

import csv
import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / "delivery" / "preparation" / "evidence"
INITIAL_HEAD = "a0a9a69cefc0888c32e9fb2ef3f5ca5416a4a254"
REMOTE_HEAD = "d522abe7fcc593b9038af3f24ea1ca7316d0022e"
AUDIT_HEAD = "a77f597b6f23a8d05d8186ad18ddf7b8a8f9190f"
PRE_INSTALL_HEAD = "d522abe7fcc593b9038af3f24ea1ca7316d0022e"


def run(*args: str) -> str:
    return subprocess.check_output(args, cwd=ROOT, text=True, encoding="utf-8").strip()


def write(path: Path, value: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value.rstrip() + "\n", encoding="utf-8", newline="\n")


def write_json(path: Path, value: object) -> None:
    write(path, json.dumps(value, ensure_ascii=False, indent=2))


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def git_manifest(commit: str, tree_path: str = "docs") -> tuple[list[dict[str, str]], str, str]:
    rows: list[dict[str, str]] = []
    for line in run("git", "ls-tree", "-r", commit, tree_path).splitlines():
        meta, path = line.split("\t", 1)
        mode, kind, blob = meta.split()
        rows.append({"path": path, "mode": mode, "type": kind, "blob": blob})
    rows.sort(key=lambda item: item["path"])
    payload = "".join(f'{row["path"]}\0{row["blob"]}\0{row["mode"]}\n' for row in rows).encode()
    return rows, hashlib.sha256(payload).hexdigest(), run("git", "rev-parse", f"{commit}:{tree_path}")


def api_inventory() -> dict[str, object]:
    route_file = ROOT / "apps" / "api" / "src" / "routes.ts"
    text = route_file.read_text("utf-8")
    matcher = re.compile(r"\bapp\.(get|post|put|patch|delete|head|options)\s*(?:<[^;]+?>\s*)?\(\s*[`\"']([^`\"']+)[`\"']", re.S)
    matches = list(matcher.finditer(text))
    tests = "\n".join(path.read_text("utf-8") for path in (ROOT / "apps" / "api" / "src" / "engine" / "tests").rglob("*.test.ts"))
    routes: list[dict[str, object]] = []
    for index, match in enumerate(matches):
        method = match.group(1).upper()
        path = match.group(2)
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        handler = text[match.start():end]
        line = text.count("\n", 0, match.start()) + 1
        auth = "none-found"
        if re.search(r"requireAdmin|user\.role\s*!==\s*[\"']admin", handler):
            auth = "admin"
        elif re.search(r"requireUser|requireAuth|authenticate|resolveRequestUser|getAuthenticatedUser", handler):
            auth = "authenticated"
        elif path in {"/api/health", "/api/ready", "/api/catalog"} or path.startswith("/api/auth/"):
            auth = "public-or-route-specific"
        path_probe = re.sub(r":[A-Za-z][A-Za-z0-9_]*", ":", path)
        test_covered = path in tests or path_probe in tests or path.replace(":", "${") in tests
        routes.append({
            "method": method,
            "path": path,
            "operation": f"legacy-{method.lower()}-{path.strip('/').replace('/', '-').replace(':', '') or 'root'}",
            "handler": f"apps/api/src/routes.ts:{line} inline handler",
            "auth": auth,
            "request": "inline TypeScript/handler validation; inspect source",
            "response": "inline handler response; inspect source",
            "mutation": method not in {"GET", "HEAD", "OPTIONS"},
            "transaction": "runtime-document mutex" if "updateRuntimeDatabase" in handler else ("SQLite direct" if "getSqliteDatabase" in handler else "none or not explicit"),
            "idempotency": "explicit" if re.search(r"idempotenc|Idempotency", handler, re.I) else "not found in handler",
            "optimisticLock": "explicit" if re.search(r"If-Match|expectedVersion|version mismatch", handler, re.I) else "not found in handler",
            "longRunning": bool(re.search(r"code\(202\)|enqueue|startTask|create.*Run", handler, re.I)),
            "testCoverage": "string reference found" if test_covered else "not established by inventory",
            "deprecation": "HTTP 410 disabled" if re.search(r"code\(410\)|status\(410\)", handler) else "active or not marked"
        })
    return {
        "classification": "informative-current-implementation",
        "targetArchitectureAuthority": False,
        "verifiedAgainstCommit": INITIAL_HEAD,
        "source": "apps/api/src/routes.ts",
        "sourceLines": text.count("\n") + 1,
        "routeCount": len(routes),
        "methodCounts": {method: sum(route["method"] == method for route in routes) for method in sorted({str(route["method"]) for route in routes})},
        "limitations": [
            "Authentication, transaction, idempotency, and coverage fields are conservative source heuristics and require handler/test inspection for acceptance.",
            "This is the current legacy API, not the target docs/08-api OpenAPI contract."
        ],
        "routes": routes
    }


def main() -> None:
    before_rows, before_sha, before_tree = git_manifest(PRE_INSTALL_HEAD)
    installed_rows, installed_sha, installed_tree = git_manifest(INITIAL_HEAD)
    integrated = Path(r"C:\Users\86182\Downloads\EnvForge_Design_Docs_v1.1_Integrated.zip")
    legacy = Path(r"C:\Users\86182\Downloads\EnvForge_Legacy_Docs_Rebuilt_v1.zip")
    disposition = ROOT / "delivery" / "history" / "LEGACY_FILE_DISPOSITION.csv"

    write_json(EVIDENCE / "repository-baseline.json", {
        "phase": "preparation",
        "repository": "E:/1project/EnvForge",
        "remote": "https://github.com/foolkking/envforge.git",
        "branch": "main",
        "initialHead": INITIAL_HEAD,
        "remoteHead": REMOTE_HEAD,
        "ahead": 2,
        "behind": 0,
        "workingTreeClean": False,
        "preExistingWorkingTree": ["D .claude/launch.json", "?? .migration-backup/", "?? git add docs"],
        "worktrees": ["E:/1project/EnvForge"],
        "submodules": [],
        "gitLfs": True,
        "operatingSystem": "Microsoft Windows 10.0.19045",
        "architecture": "X64",
        "shell": "Windows PowerShell 5.1.19041.6456",
        "packageManagers": ["npm@10.5.2"],
        "runtimeVersions": {"node": "20.13.1", "python": "3.11.7"},
        "lockfiles": ["package-lock.json"],
        "docker": {"available": False, "composeAvailable": False},
        "postgresql": {"psql": "17.10", "pgConfig": "12.17", "localService": "postgresql-x64-17 running", "use": "reference-DDL disposable validation only"},
        "ciProvider": "GitHub Actions",
        "database": {"currentEngine": "SQLite", "ddlMigrationVersion": 5, "runtimeDocumentDefaultSchemaVersion": "0.3.0", "jsonMigrationTargetObserved": "0.4.0"},
        "apiVersion": "legacy unversioned /api; target contract /api/v1 version 1.1.0 is design-only",
        "schemaVersion": "SQLite DDL migration 5 plus runtime document migration",
        "featureFlags": ["environment/configuration-driven legacy paths; no target Phase 0 authority flag implemented"],
        "designBaseline": "1.2",
        "sourceDesignPackage": "EnvForge_Design_Docs_v1.1_Integrated.zip",
        "existingDocsFileCount": len(before_rows),
        "existingDocsTreeHash": before_sha,
        "installedDocsFileCount": len(installed_rows),
        "installedDocsTreeHash": installed_sha,
        "capturedAt": "2026-07-19"
    })

    write(EVIDENCE / "git-status-before.txt", "\n".join([
        "branch=main",
        f"initial_head={INITIAL_HEAD}",
        f"remote_head={REMOTE_HEAD}",
        "ahead=2",
        "behind=0",
        " D .claude/launch.json",
        "?? .migration-backup/",
        '?? "git add docs"',
        "No conflicts. No Preparation files existed at capture time."
    ]))

    write_json(EVIDENCE / "hashes" / "input-hashes.json", {
        "algorithm": "SHA-256",
        "integratedPackage": {"path": str(integrated), "sha256": sha256(integrated), "bytes": integrated.stat().st_size},
        "legacyDocsPackage": {"path": str(legacy), "sha256": sha256(legacy), "bytes": legacy.stat().st_size},
        "legacyDisposition": {"path": "delivery/history/LEGACY_FILE_DISPOSITION.csv", "sha256": sha256(disposition), "bytes": disposition.stat().st_size},
        "preInstallDocs": {"commit": PRE_INSTALL_HEAD, "count": len(before_rows), "manifestSha256": before_sha, "gitTree": before_tree},
        "installedDesignDocs": {"commit": INITIAL_HEAD, "count": len(installed_rows), "manifestSha256": installed_sha, "gitTree": installed_tree}
    })
    write(EVIDENCE / "hashes" / "existing-docs-before-manifest.txt", "\n".join(f'{row["blob"]}  {row["path"]}' for row in before_rows))
    write(EVIDENCE / "hashes" / "installed-design-manifest.txt", "\n".join(f'{row["blob"]}  {row["path"]}' for row in installed_rows))

    with disposition.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    before_paths = {row["path"].removeprefix("docs/") for row in before_rows}
    disposition_paths = {row["source"].replace("\\", "/") for row in rows}
    actions: dict[str, int] = {}
    for row in rows:
        actions[row["action"]] = actions.get(row["action"], 0) + 1
    write_json(EVIDENCE / "legacy-docs" / "disposition-coverage.json", {
        "sourceCount": len(rows),
        "preInstallTrackedDocsCount": len(before_paths),
        "trackedDocsWithoutDisposition": sorted(before_paths - disposition_paths),
        "dispositionOnlyEphemeralInputs": sorted(disposition_paths - before_paths),
        "actionCounts": actions,
        "coverage": "PASS" if not before_paths - disposition_paths else "FAIL"
    })

    product_diff = run("git", "diff", "--name-status", f"{AUDIT_HEAD}..{INITIAL_HEAD}", "--", "apps", "packages", "scripts", "package.json", "package-lock.json", ".github")
    write(EVIDENCE / "historical-validation" / "code-diff-from-audit.txt", "\n".join([
        f"historical_audit_commit={AUDIT_HEAD}",
        f"verified_commit={INITIAL_HEAD}",
        "scope=apps packages scripts package.json package-lock.json .github",
        f"result={'NO PRODUCT OR TOOLCHAIN CHANGES' if not product_diff else 'CHANGES REQUIRE REVIEW'}",
        product_diff or "(empty diff)"
    ]))

    write_json(EVIDENCE / "api" / "current-api-inventory.json", api_inventory())

    write(EVIDENCE / "repository-inventory.md", f"""
# Current Repository Inventory

Verified against `{INITIAL_HEAD}`. Classification: `informative-current-implementation`; target architecture authority: false.

| Area | Current fact | Evidence |
|---|---|---|
| Layout | npm workspaces monorepo | root `package.json` |
| Workspaces | `apps/api`, `apps/web`, `packages/core`, `packages/collectors`, `packages/restorers`, `packages/cli` | workspace list |
| API | Fastify 4; one 6,555-line route registry with 228 registrations | `apps/api/src/server.ts`, `apps/api/src/routes.ts` |
| Web | React 18 + Vite; route state in `apps/web/src/main.tsx` | `apps/web/package.json` |
| Current persistence | SQLite tables plus a JSON runtime document in `system_kv`; local files for snapshots/artifacts | `db-sqlite.ts`, `db-store.ts`, `runtime-store.ts` |
| Current execution | HTTP-bound Environment Plan apply plus legacy process-local task queue | `routes.ts`, `plan-store.ts`, `executor.ts`, `task-queue.ts` |
| External action | agentless SSH through structured modules/managed adapters; direct legacy playbook routes disabled | collectors/restorers/API tests |
| CI | GitHub Actions build/typecheck/preflight/catalog audit only at entry | `.github/workflows/ci.yml` |
| Deployment | Dockerfile/compose files exist, but Docker is unavailable in this audit environment | repository and tool probe |

No independent durable worker entrypoint, PostgreSQL production authority, object-store runtime, Dataset engine, Secret delivery provider, Cutover state machine, or Archive service exists in current production code. Those are target-design objects.
""")

    write(EVIDENCE / "dependency-toolchain.md", """
# Dependency and Toolchain Baseline

| Tool | Version/result | Use |
|---|---|---|
| Node.js | 20.13.1 | product and validation runtime |
| npm | 10.5.2 | workspace package manager; `package-lock.json` authoritative |
| TypeScript | workspace-pinned 5.5.x | product typecheck/build |
| Python | 3.11.7 | existing static design validator |
| PyYAML | 6.0.3 | existing validator host dependency at entry |
| jsonschema | 4.23.0 | available host library; not yet repository-pinned at entry |
| Playwright | workspace-pinned 1.60.x | Web smoke; Chromium runtime installed during audit |
| PostgreSQL psql | 17.10 | disposable reference DDL validation |
| PostgreSQL server | local service 17; separate validation database/cluster required | never use project/user data |
| Docker/Compose | not available | Docker-dependent checks classified `SKIPPED-environment` |
| Git LFS | 3.5.1 | installed; no LFS requirement found for current docs |

At entry, Mermaid CLI, Redocly CLI, Ajv CLI, and OpenAPI codegen were not repository-pinned. Preparation will add development-only versions and record them in the lockfile.
""")

    write(EVIDENCE / "database" / "current-database-inventory.md", """
# Current Database Inventory

Classification: `informative-current-implementation`; verified against the Preparation initial HEAD.

- Engine: SQLite through `sqlite`/`sqlite3`.
- Bootstrap: `initializeDatabase()` applies five checksum-recorded SQLite DDL steps and creates `system_kv` before production routes are registered.
- Core authority: `system_kv(key='runtime_db')` stores the normalized `RuntimeDatabase` JSON document. Relational tables additionally serve comments, likes, reports, suggestions, inbox, audit logs, queues, and background tasks.
- JSON schema: new runtime documents default to `0.3.0`; post-listen legacy JSON migration code includes a `0.4.0` migration.
- Concurrency: process-local mutex around document read/modify/write; no database CAS for aggregate versions and no multi-process authority.
- Environment Plans and Apply claims: arrays inside the runtime document; Apply idempotency records are persisted, but the execution itself remains HTTP/process bound.
- Indexes/constraints: SQLite DDL contains table-local keys/indexes; it does not implement the target workspace-scoped PostgreSQL model, durable queue leases, resource fencing, outbox/inbox target contract, or immutable revision constraints.
- Backup: `npm run backup:db` exists for the legacy runtime. This is not target control-plane recovery.
- Production migrations: the target `docs/07-persistence/ddl/*.sql` files are reference DDL only and are not registered in the current application.
""")

    write(EVIDENCE / "current-state" / "current-execution-chain.md", """
# Current Execution Chain

```text
HTTP POST /api/plans/:id/apply
→ authenticate and owner-scope lookup
→ recompute/freeze Plan hash and validate approval
→ claim persisted StoredApplyRun / idempotency key
→ executeEnvironmentPlan() in the API process
→ managed adapter / SSH side effect
→ persist ActionRunRecord and finalize ApplyRun
→ separate HTTP verify or rollback command
→ dynamically build Plan report from stored Plan/current evidence
```

Current protections include approved Plan/hash binding, artifact hash checks, immutable stored Plan fields, action IDs, direct-playbook rejection, and redaction tests. Current gaps relative to the target are: no independent durable worker, lease/fencing, durable ActionAttempt queue, checkpoint/resume, reconciliation for unknown outcomes, independent rollback ExecutionRun, immutable ReportArtifact, Dataset transfer, Cutover, or Archive.

The legacy task queue is process-local and has SSE, while Environment Plan Apply is synchronous and does not use that queue. API restart can recover persisted Plan/Apply records but cannot resume an interrupted action from a durable checkpoint.
""")

    write(EVIDENCE / "experience" / "current-ui-inventory.md", """
# Current Web Inventory

Verified paths: `apps/web/src/main.tsx`, `lib/nav.ts`, `components/PipelineBar.tsx`, `components/ui/`, modular styles, and zh/en locale resources all exist.

The app has Dashboard, Migrate, Build, Plans, and admin Capability surfaces. Reports deep-link into the Plans center. Migrate persists a `StoredMigrationSession`, presents assessment/review/config-data/target/dry-run/plan/apply/report steps, and promotes into the Environment Plan center for real Apply. Build consumes certified catalog items and creates a rebuild Environment Plan. There is no current Archive/Restore product workflow implementing the target contract.

The 16-test Playwright smoke uses mocked API responses. It proves route rendering across four viewport/locale/theme projects and assessment/review copy; it does not prove a live Build, migration, SSH Apply, Dataset transfer, Cutover, or Archive/Restore flow.
""")

    write(EVIDENCE / "command-index.md", """
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
""")


if __name__ == "__main__":
    main()
