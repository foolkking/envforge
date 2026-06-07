# Build Module Design

> **Audience.** End users (non-admin). Build is the everyday environment
> builder. It is **not** an app market and it never exposes the internal
> supportLevel ladder.

## What Build is

Build is the page where an ordinary user:

1. picks a Target VM,
2. reviews its Target Snapshot / readiness,
3. reviews suggested certified capabilities,
4. selects Full Migration Certified capabilities,
5. configures capability parameters,
6. generates a **Rebuild Plan** (an Environment Plan),
7. enters Plan Review → Apply Gate → Verify → Report.

Build talks to exactly one catalog endpoint: `GET /api/catalog`. That
endpoint returns **certified-only** items by default. Build never calls
`GET /api/catalog?include=all` or `GET /api/catalog/certification` —
those are admin surfaces.

## Hard rules

- Build only shows **Full Migration Certified** capabilities.
- Build does **not** show the supportLevel ladder
  (`detect-only` / `basic-rebuild` / `managed-config` / `full-migration`)
  anywhere in the user-facing UI.
- Build does **not** render any supportLevel filter pills (the legacy
  "全部 / 完整迁移 / 托管配置 / 基础重建 / 仅识别" ladder is gone). Only
  the **capability-type** filter (All / Runtime / Database / Security /
  Network / Container / Dev / Service) remains.
- Build does **not** show not-ready capabilities. They live in the admin
  Capability Admin workbench only (Capability Admin → Rule Registry).
- Build suggestions can only reference certified capabilities. The
  server filters not-ready items out of `GET /api/build/:targetId/suggestions`.
- Accepting a suggestion only adds the capability to the **Plan Draft**.
  It never executes anything directly.
- Every Build action flows through Environment Plan. There is no direct
  install, direct uninstall, or unverified remote edit.
- The non-admin nav drops the catalog entry entirely
  (`navItemsForRole("user")`); a non-admin who deep-links into
  `/catalog` is auto-redirected to `/market` (Build).
- The Build workflow stepper labels the catalog step **Certified
  Capabilities**, not "Capability Catalog".

## Information architecture (5 regions)

### 1. Target Context Bar

Shows the current target host, snapshot status, readiness, current mode
(Build), and plan-draft status.

```
Target: fool @ 20.89.235.19   Snapshot: collected 13:48   Readiness: ready
Mode: Build                   Certified capabilities available: 3
```

### 2. Suggestions Review

System-recommended certified capabilities, sourced from:

- target snapshot evidence (capability missing, or present-but-unmanaged),
- security-baseline gaps (future),
- common combos (future),
- conflict-repair suggestions (future).

Each suggestion shows: name, reason, evidence, risk, whether it needs
manual steps, whether it touches data. Actions: **Add to Plan**,
**Dismiss**, **Snooze**, **View reasoning**.

> Suggestions only reference certified capabilities. If a suggestion
> would map to a not-ready capability it is dropped server-side and the
> admin sees it as an "upgrade suggestion" in the registry instead.

Data source: `GET /api/build/:targetId/suggestions` →
`{ suggestions: BuildSuggestion[] }`. Every entry carries
`certified: true` and `canAddToPlan: true`.

### 3. Certified Capabilities

Only certified capabilities, filtered by **capability type** (All / Web
/ Database / Runtime / Container / Security / Network / Observability /
Dev Tools / Storage). No supportLevel filter.

When the certified set is small, the page shows:

> 当前仅展示已通过 Full Migration Certified 的能力。更多能力正在管理员规则库中完善。
> (Only Full Migration Certified capabilities are shown here. More
> capabilities are being upgraded in the admin Capability Rules registry.)

### 4. Selected Plan Draft

The user's current selection: name, capabilityKey, risk badge, data
badge, secret badge, manual-step badge, conflict status, Configure
button, Remove button.

### 5. Plan Preview

After **Generate Rebuild Plan**: action summary, conflicts, approvals
required, manual steps, data strategy, rollback coverage, report
preview. This is the gateway into Plan Review.

## Capability card design

Build cards are **not** app-market cards. They deliberately omit:

- Rating
- Download counts (`4.8k` / `10.1k`)
- Large coloured cover art
- "Install" / "One-click install" / "Configure & Install"
- supportLevel labels

A certified Build card shows:

```
[icon] Nginx Web 服务
       web-server.nginx · Web

描述：反向代理、静态站点和服务入口管理。

状态：已认证 (Certified)

标签：需要配置审查 · 涉及证书路径 · 可回滚 · 需要人工确认 (if any)

将生成：
  - 安装 nginx
  - 管理 /etc/nginx
  - 运行 nginx -t
  - reload nginx
  - 失败恢复

按钮：加入计划 · 配置 · 查看规则摘要
```

The only status badge is **Certified** (green pill). The badge derives
from `item.certification.status` returned by the server — the UI does
not infer it from supportLevel.

## Icon semantics

Reused from `lucide-react` (already the project icon library):

| Concept | Icon |
| --- | --- |
| Docs / Markdown | BookOpen |
| Config | Cog / Settings2 |
| Package | Box |
| systemd service | Server |
| Database | Database |
| Container | Box (container) |
| Secret / key | Key |
| Network / port | Network |
| Firewall | Shield |
| Validation | CheckCircle2 |
| Rollback | RefreshCcw |
| Manual step | Hand |
| Report | FileText |
| Risk | AlertTriangle |

## Server-side enforcement (defence in depth)

The UI hiding not-ready capabilities is **not** the only line of
defence:

- `GET /api/catalog` filters certified-only for non-admin requests
  (`apps/api/src/routes.ts`, using
  `catalog-certification.ts:filterUserVisible`).
- `POST /api/plans` with `source.kind="capability-selection"` refuses
  any not-ready id for non-admin callers and returns a structured
  `CertificationRefusedError` (HTTP 400) listing the refused ids and
  their reasons.
- `GET /api/build/:targetId/suggestions` only emits certified
  suggestions.

If a hand-crafted request tries to plan a not-ready capability, the
server refuses regardless of what the UI shows.

## Copy

- Build header: "Build 使用已认证能力生成 Rebuild Plan。所有操作都必须经过
  Plan Review 和 Apply Gate。"
- Empty certified state: "当前仅展示已通过 Full Migration Certified 的
  能力。更多能力正在管理员规则库中完善。"
- Full Migration Certified explainer: "Full Migration Certified 不表示
  完全自动化，而表示 EnvForge 已具备完整的检测、计划、配置治理、数据策略、
  验证、回滚、风险审批和报告能力。复杂能力可以包含结构化人工步骤。"

## Implementation references

- Page: `apps/web/src/pages/CapabilityCatalogPage.tsx` (Build mode).
- API helpers: `apps/web/src/api.ts` — `fetchCatalogWithMeta`,
  `fetchBuildSuggestions`.
- Server: `apps/api/src/routes.ts` — `/api/catalog`,
  `/api/build/:targetId/suggestions`, `/api/plans`.
- Certification source of truth:
  `apps/api/src/catalog-certification.ts`.
## Certified-Only User Contract

Build is the user-facing certified capability selector. It must not render supportLevel filters, supportLevel badges, not-ready states, ratings, download counts, or market-style governance controls.

Build keeps only the capability type filters: All, Runtime, Database, Security, Network, Container, Dev, and Service. Every selected capability enters a Plan Draft and must pass Environment Plan review, apply, verify, rollback, and report gates.

The empty state is: "当前仅展示已认证能力。更多能力正在管理员规则库中完善。" Admins upgrade not-ready capabilities in Capability Admin, not in Build.
