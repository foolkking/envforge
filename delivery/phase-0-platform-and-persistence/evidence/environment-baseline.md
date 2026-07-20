# Phase 0 Environment Baseline

- Windows 10 x64, PowerShell 5.1
- Node 20.13.1, npm 10.5.2, TypeScript workspace toolchain
- PostgreSQL client 17.10; isolated local clusters supported
- Docker/Compose/MinIO live environment unavailable
- Current data: `data/envforge.db` plus legacy runtime JSON and local files
- Existing API: Fastify `apps/api/src/server.ts` and monolithic `routes.ts`
- Existing background work: process-local scheduler/task mechanisms
- Existing artifact: local Plan artifact file implementation
- No `.env` contents were read or copied into evidence
