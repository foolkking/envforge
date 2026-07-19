
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
