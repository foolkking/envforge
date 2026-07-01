# Service Stack Model

EnvForge should not primarily show raw:

~~~text
packages
ports
files
processes
~~~

Those are evidence. Users need to understand:

- 这个服务器上有哪些服务栈？
- 它们之间是什么关系？
- 哪些重要？
- 哪些有状态？
- 哪些能迁？
- 哪些有风险？

Migration plans should be based on service relationships, not isolated
components.

迁移计划应该基于服务关系，而不是孤立组件。

## Core model

~~~ts
interface ServiceStack {
  id: string;
  name: string;
  category:
    | "web-entry"
    | "app-runtime"
    | "database"
    | "cache"
    | "queue"
    | "storage"
    | "security"
    | "network"
    | "scheduled-job"
    | "unknown";

  evidence: EvidenceRef[];
  confidence: number;
  businessCriticality: "unknown" | "low" | "medium" | "high" | "critical";
  statefulness: "stateless" | "stateful" | "mixed" | "unknown";
  migrationIntent: "migrate" | "record-only" | "ignore" | "manual";
  automationReadiness: "auto-staged" | "suggested" | "requires-decision" | "blocked";
  risks: Risk[];
  requiredDecisions: Decision[];
  recommendedStrategy: Strategy;
  relationships: StackRelationship[];
}
~~~

## Relationship examples

~~~text
Nginx → reverse proxies → Docker app
Docker app → depends on → PostgreSQL
Certbot → provides certs for → Nginx
UFW → exposes → 80/443/22
Cron → triggers → backup script
~~~

## Assessment API baseline

Prompt2A adds a service-stack view model as an additive projection over the
existing migration candidate report. It does not replace `MigrationCandidate`,
`NormalizedArtifact`, `ConfigBundle`, or `Environment Plan`.

The projection currently groups common web entry, application runtime,
database, cache, queue, storage, security, network, scheduled-job, and unknown
signals. It preserves evidence references, confidence reasons, statefulness,
risk reasons, required decisions, recommended strategy, capability references,
and inferred relationships. Unknown or unsupported components remain explicit
manual items instead of being forced into a supported category.

Collector envelopes remain authoritative: a successful empty Docker collector
means no Docker workload was found, while a failed Docker collector means the
Docker evidence is unavailable.

Prompt2B+C renders this model in Migrate as Service Stack cards. Each card keeps
the backend-provided summary, confidence and reason, risk and reasons,
statefulness, readiness, evidence, required decisions, recommended strategy,
relationships, and capability references. The Web does not reclassify raw
packages, ports, files, or processes.
