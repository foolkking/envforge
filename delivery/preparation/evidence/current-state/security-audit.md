# Current Security and Authority Audit

- Authentication: local accounts plus GitHub/Google OAuth, bearer sessions, TOTP enrollment/gates, hashed API tokens, and admin checks exist. Target workspace RBAC/ABAC and recent high-risk reauthentication are not complete.
- Plan boundary: tests prove approval, plan hash, artifact hash, action IDs, ownership, and direct legacy playbook route rejection. Apply executes only a stored Plan and frozen artifact bytes on the audited path.
- Secrets: runtime includes encrypted credential/key-store mechanisms and redaction scanners. Snapshot SecretRef uses fingerprint/reference. No target Secret Requirement → Provider → JIT delivery lifecycle exists.
- SSH: agentless `ssh2`; host/credential behavior is current implementation, not target provider authority.
- Evidence: action/support/report paths call redaction utilities; Preparation does not read `.env` or external credentials.
- Command injection/path risks: structured command modules and validation tests exist, but target ReviewedCommandAction/fencing/provider boundaries remain future work.
- Workspace boundary: current user ownership checks exist on audited Plan/graph/session routes; target multi-workspace PostgreSQL scope/RLS is not implemented.

Current safety controls are preserved as migration inputs. They do not satisfy Phase 0+ target acceptance by themselves.
