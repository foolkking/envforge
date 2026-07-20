# Current Persistence Audit

Phase 0 PostgreSQL is authoritative for foundation resources. Migration `0003`
adds only Phase 1 domain/planning tables and explicitly excludes Reference DDL
Discovery/Candidate and Phase 2 Run tables. New Workload, Blueprint, Decision,
Plan, Approval, placement and estimate writes are PostgreSQL-only. Legacy SQLite
EnvironmentPlan and ServiceStack remain read-only compatibility/evidence inputs.
