# Security and Secret Evidence

- Sensitive-shaped fields are rejected before service persistence.
- A controlled canary is rejected by the ControlPlaneOperation service and is
  absent from a plain PostgreSQL dump of the disposable database.
- SQL uses parameterized queries; user input never forms SQL or object keys.
- Local Artifact keys are opaque and workspace-derived; traversal is rejected.
- Cross-workspace Project, Endpoint, Artifact and operation reads are denied
  without resource enumeration.
- Audit/Event/Outbox payloads pass the same sensitive-key guard.
- Platform operations and metrics require the existing admin role and trusted
  PostgreSQL workspace membership.

No real credential, token, private key, or secret value is included in this
evidence.
