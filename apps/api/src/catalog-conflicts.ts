/**
 * catalog-conflicts.ts
 *
 * Formal conflict catalog for EnvForge.
 *
 * The 115-item catalog audit identified six classes of capability that
 * cannot safely co-exist on a single host. This module turns those
 * informal observations into machine-checkable conflict rules so the
 * Build Stepper, Plan Review, and Apply Gate can refuse or warn before a
 * plan mutates the target.
 *
 * Severity contract:
 *  - `"block"`  — plan apply MUST refuse until the operator picks one
 *                 capability and removes the others from the plan, or
 *                 explicitly resolves via {@link ConflictResolutionOption}.
 *  - `"warn"`   — plan apply requires explicit operator acknowledgement
 *                 (`acknowledgedConflicts` array on the apply request).
 *
 * Conflict detection is purely a function of the *capabilityKeys* present
 * in the plan and on the target host (when known). The runtime resolves
 * each plan item's capabilityKey via {@link
 * ./database.ts:withCapabilityMetadata}, so this module only needs the
 * keys, not the catalog item objects.
 */

export type CatalogConflictType =
  | "port-shared"
  | "exclusive-role"
  | "filter-stack"
  | "dns-resolver"
  | "identity-provider"
  | "kubernetes-cluster";

export type CatalogConflictSeverity = "block" | "warn";

/**
 * Resolution option presented to the operator when the conflict is
 * detected. Each option references the action the operator can take in
 * the UI; the runtime does not auto-execute these.
 */
export interface ConflictResolutionOption {
  /** Stable id used in audit logs and in the apply request body. */
  id: string;
  /** Short imperative label (e.g. "Keep nginx, remove openresty"). */
  label: string;
  /** Optional list of capabilityKeys the operator commits to keeping. */
  keepCapabilityKeys?: string[];
  /** Optional list of capabilityKeys the operator commits to removing. */
  removeCapabilityKeys?: string[];
}

export interface CatalogConflict {
  /** Stable id used in audit records and in the apply request body. */
  id: string;
  /** Conflict family — drives icon and copy in the UI. */
  type: CatalogConflictType;
  /** All capabilityKeys participating in the conflict. */
  capabilityKeys: string[];
  /** "block" prevents apply; "warn" requires acknowledgement. */
  severity: CatalogConflictSeverity;
  /** Human-readable explanation. Surfaced verbatim in the UI. */
  reason: string;
  /** At least one option must be presented to the operator. */
  resolutionOptions: ConflictResolutionOption[];
}

/**
 * Conflict instance returned by {@link detectPlanConflicts}.
 *
 * `participatingItemIds` lists the plan items that triggered the rule so
 * the UI can highlight them.
 */
export interface DetectedConflict {
  rule: CatalogConflict;
  participatingItemIds: string[];
  /** Plan item ids per capabilityKey, so resolution UIs can target the right cards. */
  participatingByCapabilityKey: Record<string, string[]>;
}

/**
 * The 6 catalog-level conflict rules identified during the V2 audit.
 *
 * Order matters only for stable iteration; consumers should treat the
 * list as a set. Adding a rule is the recommended way to introduce a new
 * conflict — do not reuse an existing id or change an existing key list
 * without bumping the audit batch.
 */
export const catalogConflictRules: CatalogConflict[] = [
  {
    id: "firewall-stack",
    type: "filter-stack",
    capabilityKeys: ["security.firewall.ufw", "security.firewall.firewalld"],
    severity: "block",
    reason:
      "UFW and firewalld are both layer-4 packet filters and cannot run on the same host. Only one filter stack should be active at a time; running both produces undefined behaviour and can lock SSH.",
    resolutionOptions: [
      {
        id: "keep-ufw",
        label: "Keep UFW (firewall-baseline)",
        keepCapabilityKeys: ["security.firewall.ufw"],
        removeCapabilityKeys: ["security.firewall.firewalld"]
      },
      {
        id: "keep-firewalld",
        label: "Keep firewalld",
        keepCapabilityKeys: ["security.firewall.firewalld"],
        removeCapabilityKeys: ["security.firewall.ufw"]
      }
    ]
  },
  {
    id: "http-frontend",
    type: "port-shared",
    capabilityKeys: [
      "web-server.nginx",
      "web-server.openresty",
      "web-server.caddy",
      "network.reverse-proxy.traefik",
      "network.load-balancer.haproxy",
      "web-server.apache"
    ],
    severity: "block",
    reason:
      "nginx, OpenResty, Caddy, Traefik, HAProxy, and Apache all bind ports 80/443 by default. Only one HTTP frontend can claim those ports per host. Pick the one that owns the public TLS termination.",
    resolutionOptions: [
      { id: "keep-nginx", label: "Keep nginx", keepCapabilityKeys: ["web-server.nginx"] },
      { id: "keep-openresty", label: "Keep OpenResty", keepCapabilityKeys: ["web-server.openresty"] },
      { id: "keep-caddy", label: "Keep Caddy", keepCapabilityKeys: ["web-server.caddy"] },
      {
        id: "keep-traefik",
        label: "Keep Traefik",
        keepCapabilityKeys: ["network.reverse-proxy.traefik"]
      },
      { id: "keep-haproxy", label: "Keep HAProxy", keepCapabilityKeys: ["network.load-balancer.haproxy"] },
      { id: "keep-apache", label: "Keep Apache", keepCapabilityKeys: ["web-server.apache"] }
    ]
  },
  {
    id: "redis-port",
    type: "port-shared",
    capabilityKeys: ["cache.redis", "cache.valkey"],
    severity: "block",
    reason:
      "Redis and Valkey both bind TCP/6379 by default and use the same on-disk persistence layout. Pick one; clients see the same wire protocol.",
    resolutionOptions: [
      { id: "keep-redis", label: "Keep Redis", keepCapabilityKeys: ["cache.redis"] },
      { id: "keep-valkey", label: "Keep Valkey", keepCapabilityKeys: ["cache.valkey"] }
    ]
  },
  {
    id: "dns-resolver",
    type: "dns-resolver",
    capabilityKeys: ["app.dns.pihole", "app.dns.adguard-home", "system.dns.systemd-resolved"],
    severity: "block",
    reason:
      "Pi-hole, AdGuard Home, and systemd-resolved DNSStubListener all bind UDP/TCP 53. Running multiple resolvers leads to silent split-horizon. Disable systemd-resolved DNSStubListener before running Pi-hole or AdGuard Home.",
    resolutionOptions: [
      {
        id: "keep-pihole",
        label: "Keep Pi-hole (disable resolved DNSStubListener)",
        keepCapabilityKeys: ["app.dns.pihole"],
        removeCapabilityKeys: ["app.dns.adguard-home", "system.dns.systemd-resolved"]
      },
      {
        id: "keep-adguard",
        label: "Keep AdGuard Home (disable resolved DNSStubListener)",
        keepCapabilityKeys: ["app.dns.adguard-home"],
        removeCapabilityKeys: ["app.dns.pihole", "system.dns.systemd-resolved"]
      },
      {
        id: "keep-systemd-resolved",
        label: "Keep systemd-resolved",
        keepCapabilityKeys: ["system.dns.systemd-resolved"],
        removeCapabilityKeys: ["app.dns.pihole", "app.dns.adguard-home"]
      }
    ]
  },
  {
    id: "identity-provider",
    type: "identity-provider",
    capabilityKeys: ["security.sso.keycloak", "security.sso.authentik", "security.sso.authelia"],
    severity: "warn",
    reason:
      "Running multiple identity providers on the same deployment is supported but expensive: each provider holds its own user store and TLS material. Only proceed if you intend to migrate users between IdPs.",
    resolutionOptions: [
      { id: "keep-keycloak", label: "Use Keycloak", keepCapabilityKeys: ["security.sso.keycloak"] },
      {
        id: "keep-authentik",
        label: "Use Authentik",
        keepCapabilityKeys: ["security.sso.authentik"]
      },
      { id: "keep-authelia", label: "Use Authelia", keepCapabilityKeys: ["security.sso.authelia"] },
      { id: "ack-multi-idp", label: "Acknowledge: running multiple IdPs intentionally" }
    ]
  },
  {
    id: "kubernetes-cluster",
    type: "kubernetes-cluster",
    capabilityKeys: ["developer.kubectl", "container.kubernetes.k3s"],
    severity: "warn",
    reason:
      "kubernetes-tools (kubectl + helm) is a client; k3s is a single-node cluster. The two are not exclusive but operators often confuse the kubeconfig context after installing k3s on the same host. Confirm the intended cluster before applying.",
    resolutionOptions: [
      {
        id: "ack-kubeconfig-rewire",
        label: "Acknowledge: kubeconfig will be rewired to k3s on this host"
      },
      { id: "keep-kubectl-only", label: "Keep kubectl only", keepCapabilityKeys: ["developer.kubectl"] },
      {
        id: "keep-k3s-only",
        label: "Keep k3s only",
        keepCapabilityKeys: ["container.kubernetes.k3s"]
      }
    ]
  }
];

/** Look up a conflict rule by id; useful in apply-gate validation. */
export function getCatalogConflict(id: string): CatalogConflict | undefined {
  return catalogConflictRules.find((rule) => rule.id === id);
}

/**
 * Detect the conflicts triggered by the supplied plan-item summaries.
 *
 * The `items` argument is the minimum the detector needs: an `id` (so the
 * UI can highlight the offending plan card) and a `capabilityKey` (so we
 * can match against the rules). Items with no capabilityKey are skipped.
 */
export function detectPlanConflicts(items: Array<{ id: string; capabilityKey?: string | null }>): DetectedConflict[] {
  const byKey = new Map<string, string[]>();
  for (const item of items) {
    const key = item.capabilityKey?.trim();
    if (!key) continue;
    const list = byKey.get(key) ?? [];
    list.push(item.id);
    byKey.set(key, list);
  }
  const detected: DetectedConflict[] = [];
  for (const rule of catalogConflictRules) {
    const matchingKeys = rule.capabilityKeys.filter((key) => byKey.has(key));
    if (matchingKeys.length < 2) continue;
    const participatingByCapabilityKey: Record<string, string[]> = {};
    const participatingItemIds = new Set<string>();
    for (const key of matchingKeys) {
      const ids = byKey.get(key) ?? [];
      participatingByCapabilityKey[key] = ids;
      for (const id of ids) participatingItemIds.add(id);
    }
    detected.push({
      rule,
      participatingItemIds: [...participatingItemIds],
      participatingByCapabilityKey
    });
  }
  return detected;
}

/**
 * Returns the subset of conflict rules whose severity is "block". The
 * apply gate uses this to decide what must be resolved (not just
 * acknowledged) before non-dry apply.
 */
export function blockingConflicts(detected: DetectedConflict[]): DetectedConflict[] {
  return detected.filter((d) => d.rule.severity === "block");
}
