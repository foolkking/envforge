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
