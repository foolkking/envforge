# Phase 2 Design Delta

| ID | Classification | Resolution |
|---|---|---|
| PH2-DD-001 | implementation-detail | Production migration reconciles the proposed reference DDL with richer scheduled/manual/attention requirements. |
| PH2-DD-002 | documentation-path | Prompt paths `action-lifecycle.md`, `checkpoint-and-resume.md`, and `verification-and-commit.md` map to accepted `action-runtime-and-adapters.md`, `checkpoints-pause-and-resume.md`, and `verification-engine.md`. |
| PH2-DD-003 | authority-transition | New compatible approved Plans use ExecutionRun only; legacy Apply records remain historical and cannot enter the durable queue. |

No target invariant or product scope change is introduced.

