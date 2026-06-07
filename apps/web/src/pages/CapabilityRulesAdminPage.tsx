/**
 * CapabilityRulesAdminPage.tsx — Capability Admin workbench.
 *
 * Admin-only page that governs the catalog rule registry, drives
 * Full Migration Certification, processes user suggestions, and
 * surfaces rule-level package integrations.
 *
 * Information architecture (5 tabs):
 *   1. Overview            — counts, coverage, P0 backlog, pending suggestions
 *   2. Rule Registry       — searchable table of every capability + status
 *   3. Suggestion Inbox    — user-submitted suggestions with status workflow
 *   4. Package Integrations — rule-level package / service / config maps
 *
 * Auth gating happens on two levels:
 *   1. The route is gated by `authUser.role === "admin"` in main.tsx.
 *   2. Every API endpoint this page calls returns 403 to non-admins.
 *
 * This page is NEVER rendered for end users — Build is their entrypoint.
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Box as BoxIcon,
  CheckCircle2,
  Cog,
  Database,
  FileText,
  Folder,
  Hand,
  Inbox,
  Key,
  LayoutDashboard,
  Network,
  Package as PackageIcon,
  RefreshCcw,
  Search,
  Server,
  Shield,
  Table as TableIcon,
  UsersRound,
  XCircle,
  type LucideIcon
} from "lucide-react";
import {
  fetchCapabilityRulesAdmin,
  fetchAdminSuggestions,
  fetchCapabilityWorkflowQueues,
  fetchCapabilityWorkflowUsers,
  processAdminSuggestion,
  fetchPackageIntegrations,
  fetchPackageIntegrationDetail,
  fetchCapabilityRequirements,
  fetchCapabilityStandards,
  cloneCapabilityStandard,
  createCapabilityStandard,
  fetchCapabilityAuditLog,
  fetchCapabilityCertificationRuns,
  publishCapabilityRequirementDraft,
  rollbackCapabilityRequirementVersion,
  saveCapabilityRequirementDraft,
  simulateCapabilityRequirementCertification,
  updateCapabilityStandard,
  type AdminAuditLogEntry,
  type AdminSuggestionRecord,
  type CapabilityCertificationRun,
  type CapabilityRequirementDraft,
  type CapabilityRequirementSectionState,
  type CapabilityRequirementVersion,
  type CapabilityStandardProfile,
  type CapabilityStandardSection,
  type CapabilityWorkflowQueue,
  type CapabilityWorkflowUser,
  type CatalogItemCertification,
  type PackageIntegrationDetail,
  type PackageIntegrationRow
} from "../api";
import type { Locale } from "../lib/types";

interface AdminCatalogRow {
  id: string;
  capabilityKey?: string;
  name: string;
  category: string;
  certification: CatalogItemCertification;
}

type CapabilityRequirementsDetail = Awaited<ReturnType<typeof fetchCapabilityRequirements>>;

interface StandardProfileEditorState {
  id?: string;
  key: string;
  name: string;
  description: string;
  status: "draft" | "active" | "retired";
  sections: CapabilityStandardSection[];
}

interface Props {
  authToken: string;
  isAdmin: boolean;
  locale: Locale;
}

type WorkbenchTab = "overview" | "registry" | "standards" | "suggestions" | "integrations" | "users-queues";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  service: Server,
  network: Network,
  database: Database,
  container: BoxIcon,
  security: Shield,
  developer: Cog,
  runtime: Cog
};

const REQUIREMENT_LABELS: Record<string, { zh: string; en: string }> = {
  identity: { zh: "身份信息", en: "Identity" },
  detection: { zh: "检测", en: "Detection" },
  install: { zh: "安装计划", en: "Install / Rebuild" },
  config: { zh: "配置治理", en: "Config Governance" },
  data: { zh: "数据策略", en: "Data Strategy" },
  references: { zh: "依赖图", en: "References" },
  validate: { zh: "验证", en: "Validation" },
  rollback: { zh: "回滚", en: "Rollback" },
  security: { zh: "安全 & 审批", en: "Security" },
  crossDistro: { zh: "跨发行版", en: "Cross-distro" },
  conflicts: { zh: "冲突规则", en: "Conflicts" },
  planIntegration: { zh: "计划集成", en: "Plan Integration" },
  harness: { zh: "验证框架", en: "Harness" }
};

export function CapabilityRulesAdminPage({ authToken, isAdmin, locale }: Props): JSX.Element {
  const [tab, setTab] = useState<WorkbenchTab>("overview");
  const [rows, setRows] = useState<AdminCatalogRow[]>([]);
  const [meta, setMeta] = useState<{ total: number; certified: number; notReady: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AdminSuggestionRecord[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [integrations, setIntegrations] = useState<PackageIntegrationRow[]>([]);
  const [integrationsMeta, setIntegrationsMeta] = useState<{ total: number; withRule: number; withoutRule: number } | null>(null);
  const [integrationsLoading, setIntegrationsLoading] = useState(false);
  const [workflowUsers, setWorkflowUsers] = useState<CapabilityWorkflowUser[]>([]);
  const [workflowQueues, setWorkflowQueues] = useState<CapabilityWorkflowQueue[]>([]);
  const [workflowLoading, setWorkflowLoading] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    let abort = false;
    fetchCapabilityRulesAdmin(authToken)
      .then((response) => {
        if (abort) return;
        setRows(response.items);
        setMeta(response.meta);
      })
      .catch((err: Error) => {
        if (abort) return;
        setError(err.message);
      });
    return () => {
      abort = true;
    };
  }, [authToken, isAdmin]);

  // Lazy-load tab data
  useEffect(() => {
    if (!isAdmin) return;
    let abort = false;
    if (tab === "suggestions" && suggestions.length === 0 && !suggestionsLoading) {
      setSuggestionsLoading(true);
      fetchAdminSuggestions(authToken, { limit: 50 })
        .then((res) => { if (!abort) setSuggestions(res.suggestions); })
        .catch((err: Error) => { if (!abort) setError(err.message); })
        .finally(() => { if (!abort) setSuggestionsLoading(false); });
    }
    if (tab === "integrations" && integrations.length === 0 && !integrationsLoading) {
      setIntegrationsLoading(true);
      fetchPackageIntegrations(authToken)
        .then((res) => {
          if (abort) return;
          setIntegrations(res.items);
          setIntegrationsMeta(res.meta);
        })
        .catch((err: Error) => { if (!abort) setError(err.message); })
        .finally(() => { if (!abort) setIntegrationsLoading(false); });
    }
    if (tab === "users-queues" && workflowUsers.length === 0 && workflowQueues.length === 0 && !workflowLoading) {
      setWorkflowLoading(true);
      Promise.all([
        fetchCapabilityWorkflowUsers(authToken),
        fetchCapabilityWorkflowQueues(authToken)
      ])
        .then(([usersRes, queuesRes]) => {
          if (abort) return;
          setWorkflowUsers(usersRes.users);
          setWorkflowQueues(queuesRes.queues);
        })
        .catch((err: Error) => { if (!abort) setError(err.message); })
        .finally(() => { if (!abort) setWorkflowLoading(false); });
    }
    return () => { abort = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, isAdmin, authToken]);

  if (!isAdmin) {
    return (
      <div className="capability-rules-admin" style={{ padding: 24 }}>
        <h1 style={{ marginTop: 0 }}>{locale === "zh" ? "管理员视图" : "Admin view"}</h1>
        <p style={{ color: "#b91c1c" }}>
          {locale === "zh"
            ? "能力管理仅对管理员开放。普通用户请使用构建页面。"
            : "Capability Admin is admin-only. End users should use the Build page."}
        </p>
      </div>
    );
  }

  const coverage = meta && meta.total > 0 ? Math.round((meta.certified / meta.total) * 100) : 0;
  const pendingCount = suggestions.filter((s) => s.status === "pending").length;

  return (
    <div className="capability-rules-admin" style={{ padding: 24 }} data-testid="capability-admin-workbench">
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <BookOpen aria-hidden /> {locale === "zh" ? "能力管理" : "Capability Admin"}
        </h1>
        <p style={{ color: "#475569", margin: "4px 0 0 0", maxWidth: 760 }}>
          {locale === "zh"
            ? "管理员能力规则工作台：用于治理软件 / 组合规则、处理用户建议、推进认证升级与软件包支持映射。"
            : "Admin capability rules workbench: govern software / combo rules, process user suggestions, drive certification upgrades, maintain package integrations, and assign queues."}
        </p>
      </header>

      <nav className="capability-admin-tabs" role="tablist" data-testid="capability-admin-tabs"
        style={{ display: "flex", gap: 4, borderBottom: "1px solid #e2e8f0", marginBottom: 16 }}>
        <TabButton active={tab === "overview"} onClick={() => setTab("overview")}
          icon={<LayoutDashboard size={14} aria-hidden />} testId="tab-overview"
          label={locale === "zh" ? "概览" : "Overview"} />
        <TabButton active={tab === "registry"} onClick={() => setTab("registry")}
          icon={<TableIcon size={14} aria-hidden />} testId="tab-registry"
          label={locale === "zh" ? "规则库" : "Rule Registry"} />
        <TabButton active={tab === "standards"} onClick={() => setTab("standards")}
          icon={<Shield size={14} aria-hidden />} testId="tab-standards"
          label={locale === "zh" ? "标准" : "Standards"} />
        <TabButton active={tab === "suggestions"} onClick={() => setTab("suggestions")}
          icon={<Inbox size={14} aria-hidden />} testId="tab-suggestions"
          label={locale === "zh" ? "建议收件箱" : "Suggestion Inbox"}
          badge={pendingCount > 0 ? pendingCount : undefined} />
        <TabButton active={tab === "integrations"} onClick={() => setTab("integrations")}
          icon={<PackageIcon size={14} aria-hidden />} testId="tab-integrations"
          label={locale === "zh" ? "软件包映射" : "Package Integrations"} />
        <TabButton active={tab === "users-queues"} onClick={() => setTab("users-queues")}
          icon={<UsersRound size={14} aria-hidden />} testId="tab-users-queues"
          label={locale === "zh" ? "用户与队列" : "Users & Queues"}
          badge={workflowQueues.reduce((sum, queue) => sum + queue.openItems, 0) || undefined} />
      </nav>

      {error ? (
        <div style={{ background: "#fee2e2", color: "#991b1b", padding: 12, borderRadius: 6, marginBottom: 12 }}>
          <AlertTriangle aria-hidden /> {error}
        </div>
      ) : null}

      {tab === "overview" ? (
        <OverviewTab locale={locale} meta={meta} coverage={coverage} rows={rows}
          pendingSuggestions={pendingCount} integrationsMeta={integrationsMeta} />
      ) : null}

      {tab === "registry" ? (
        <RuleRegistryTab locale={locale} rows={rows} />
      ) : null}

      {tab === "standards" ? (
        <StandardsTab locale={locale} authToken={authToken} rows={rows} />
      ) : null}

      {tab === "suggestions" ? (
        <SuggestionInboxTab
          locale={locale}
          suggestions={suggestions}
          loading={suggestionsLoading}
          onProcess={async (id, action, feedback) => {
            await processAdminSuggestion(authToken, id, action, feedback);
            const res = await fetchAdminSuggestions(authToken, { limit: 50 });
            setSuggestions(res.suggestions);
          }}
        />
      ) : null}

      {tab === "integrations" ? (
        <PackageIntegrationsTab
          locale={locale}
          rows={integrations}
          meta={integrationsMeta}
          loading={integrationsLoading}
          authToken={authToken}
        />
      ) : null}

      {tab === "users-queues" ? (
        <UsersQueuesTab
          locale={locale}
          users={workflowUsers}
          queues={workflowQueues}
          loading={workflowLoading}
        />
      ) : null}
    </div>
  );
}

function TabButton({ active, onClick, icon, label, testId, badge }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  testId: string;
  badge?: number;
}): JSX.Element {
  return (
    <button type="button" onClick={onClick} data-testid={testId} role="tab" aria-selected={active}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "8px 12px",
        border: "none",
        borderBottom: active ? "2px solid #1e293b" : "2px solid transparent",
        background: "transparent",
        color: active ? "#1e293b" : "#64748b",
        fontWeight: active ? 600 : 500,
        fontSize: 13,
        cursor: "pointer"
      }}>
      {icon}
      <span>{label}</span>
      {badge ? (
        <span style={{
          background: "#fef3c7", color: "#92400e",
          padding: "1px 6px", borderRadius: 999, fontSize: 11
        }}>{badge}</span>
      ) : null}
    </button>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────

function OverviewTab({
  locale, meta, coverage, rows, pendingSuggestions, integrationsMeta
}: {
  locale: Locale;
  meta: { total: number; certified: number; notReady: number } | null;
  coverage: number;
  rows: AdminCatalogRow[];
  pendingSuggestions: number;
  integrationsMeta: { total: number; withRule: number; withoutRule: number } | null;
}): JSX.Element {
  const p0 = useMemo(() => rows.filter((r) => r.certification.status === "not-ready").slice(0, 5), [rows]);
  return (
    <div data-testid="overview-tab">
      <div className="rules-summary" style={summaryStyle}>
        <SummaryStat label={locale === "zh" ? "已认证" : "Certified"}
          value={meta?.certified ?? 0} icon={<CheckCircle2 size={16} aria-hidden />} tone="green" />
        <SummaryStat label={locale === "zh" ? "未就绪" : "Not Ready"}
          value={meta?.notReady ?? 0} icon={<XCircle size={16} aria-hidden />} tone="amber" />
        <SummaryStat label={locale === "zh" ? "认证覆盖率" : "Certification Coverage"}
          value={`${coverage}%`} icon={<RefreshCcw size={16} aria-hidden />} tone="slate" />
        <SummaryStat label={locale === "zh" ? "总数" : "Total"}
          value={meta?.total ?? 0} icon={<Folder size={16} aria-hidden />} tone="slate" />
        <SummaryStat label={locale === "zh" ? "P0 待办" : "P0 Backlog"}
          value={meta?.notReady ?? 0} icon={<AlertTriangle size={16} aria-hidden />} tone="amber" />
        <SummaryStat label={locale === "zh" ? "待处理建议" : "Pending Suggestions"}
          value={pendingSuggestions} icon={<Inbox size={16} aria-hidden />} tone="slate" />
        {integrationsMeta ? (
          <SummaryStat label={locale === "zh" ? "缺少规则" : "Missing rule"}
            value={integrationsMeta.withoutRule} icon={<PackageIcon size={16} aria-hidden />} tone="amber" />
        ) : null}
      </div>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 15, margin: "0 0 8px 0" }}>
          {locale === "zh" ? "P0 待升级能力（前 5）" : "P0 Backlog (top 5)"}
        </h2>
        {p0.length === 0 ? (
          <p style={{ color: "#64748b" }}>{locale === "zh" ? "无待办" : "No backlog."}</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#f1f5f9" }}>
              <tr><Th>Capability</Th><Th>Type</Th><Th>{locale === "zh" ? "缺失项" : "Missing"}</Th></tr>
            </thead>
            <tbody>
              {p0.map((row) => (
                <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <Td><strong>{row.name}</strong> <code style={{ color: "#64748b" }}>{row.id}</code></Td>
                  <Td>{row.category}</Td>
                  <Td>
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {row.certification.reasons.slice(0, 3).map((r) => <li key={r}>{r}</li>)}
                      {row.certification.reasons.length > 3 ? <li>…+{row.certification.reasons.length - 3}</li> : null}
                    </ul>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginTop: 16, color: "#64748b", fontSize: 12 }}>
        <p style={{ margin: 0 }}>
          {locale === "zh"
            ? "提示：普通用户的 Build 只展示已认证能力，认证升级请参考 docs/FULL_MIGRATION_REQUIREMENTS.md。"
            : "Note: end-user Build only shows certified capabilities. Certification upgrades follow docs/FULL_MIGRATION_REQUIREMENTS.md."}
        </p>
      </section>
    </div>
  );
}

// ── Rule Registry tab ─────────────────────────────────────────────────

function RuleRegistryTab({ locale, rows }: { locale: Locale; rows: AdminCatalogRow[] }): JSX.Element {
  const [statusFilter, setStatusFilter] = useState<"all" | "certified" | "not-ready">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [openRowId, setOpenRowId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.certification.status !== statusFilter) return false;
      if (categoryFilter !== "all" && row.category !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!row.name.toLowerCase().includes(q) &&
            !row.id.toLowerCase().includes(q) &&
            !(row.capabilityKey ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, statusFilter, categoryFilter, search]);

  return (
    <div data-testid="registry-tab">
      <div className="rules-filters" style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "0 0 12px 0" }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#fff", border: "1px solid #cbd5e1", borderRadius: 6, padding: "2px 8px" }}>
          <Search size={14} aria-hidden />
          <input
            type="search"
            placeholder={locale === "zh" ? "搜索能力 / 能力键" : "Search capability / capabilityKey"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ border: "none", outline: "none", fontSize: 12, padding: "4px 0", minWidth: 220 }}
            data-testid="registry-search"
          />
        </label>
        <FilterPills
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "all", label: locale === "zh" ? "全部" : "All" },
            { value: "certified", label: locale === "zh" ? "已认证" : "Certified" },
            { value: "not-ready", label: locale === "zh" ? "未就绪" : "Not Ready" }
          ]}
        />
        <FilterPills
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={[
            { value: "all", label: locale === "zh" ? "全部分类" : "All categories" },
            ...["service", "network", "database", "container", "security", "developer", "runtime"].map((cat) => ({
              value: cat,
              label: cat
            }))
          ]}
        />
      </div>

      <table className="rules-table" data-testid="rules-table"
        style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead style={{ background: "#f1f5f9" }}>
          <tr>
            <Th>Capability</Th>
            <Th>capabilityKey</Th>
            <Th>Category</Th>
            <Th>Status</Th>
            <Th>{locale === "zh" ? "缺失项" : "Missing Metrics"}</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => {
            const Icon = CATEGORY_ICONS[row.category] ?? FileText;
            const status = row.certification.status;
            return (
              <React.Fragment key={row.id}>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }} data-testid={`rules-row-${row.id}`}>
                  <Td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Icon size={16} aria-hidden />
                      <strong>{row.name}</strong>
                    </div>
                    <div style={{ color: "#64748b", fontSize: 11 }}>{row.id}</div>
                  </Td>
                  <Td><code>{row.capabilityKey ?? "—"}</code></Td>
                  <Td>{row.category}</Td>
                  <Td>
                    <span
                      data-testid={`rules-status-${row.id}`}
                      style={{
                        background: status === "certified" ? "#dcfce7" : "#fef3c7",
                        color: status === "certified" ? "#166534" : "#92400e",
                        border: `1px solid ${status === "certified" ? "#86efac" : "#fcd34d"}`,
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: 11
                      }}
                    >
                      {status === "certified" ? (locale === "zh" ? "已认证" : "Certified") : (locale === "zh" ? "未就绪" : "Not Ready")}
                    </span>
                  </Td>
                  <Td>
                    {row.certification.reasons.length === 0
                      ? <span style={{ color: "#64748b" }}>—</span>
                      : (
                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                          {row.certification.reasons.slice(0, 3).map((r) => <li key={r}>{r}</li>)}
                          {row.certification.reasons.length > 3 ? <li>…+{row.certification.reasons.length - 3}</li> : null}
                        </ul>
                      )}
                  </Td>
                  <Td>
                    <button
                      type="button"
                      onClick={() => setOpenRowId(openRowId === row.id ? null : row.id)}
                      style={{ padding: "2px 8px" }}
                    >
                      {openRowId === row.id ? (locale === "zh" ? "收起" : "Hide") : (locale === "zh" ? "查看" : "View")}
                    </button>
                  </Td>
                </tr>
                {openRowId === row.id ? (
                  <tr>
                    <td colSpan={6} style={{ background: "#f8fafc", padding: 12 }}>
                      <RuleDetailDrawer row={row} locale={locale} />
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StandardsTab({ locale, authToken, rows }: { locale: Locale; authToken: string; rows: AdminCatalogRow[] }): JSX.Element {
  const [profiles, setProfiles] = useState<CapabilityStandardProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState("");
  const [selectedCapabilityId, setSelectedCapabilityId] = useState(rows[0]?.id ?? "");
  const [detail, setDetail] = useState<CapabilityRequirementsDetail | null>(null);
  const [sections, setSections] = useState<Record<string, CapabilityRequirementSectionState>>({});
  const [runs, setRuns] = useState<CapabilityCertificationRun[]>([]);
  const [auditEntries, setAuditEntries] = useState<AdminAuditLogEntry[]>([]);
  const [profileEditor, setProfileEditor] = useState<StandardProfileEditorState | null>(null);
  const [sectionFilter, setSectionFilter] = useState<"all" | "open" | "satisfied">("all");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedCapabilityId && rows[0]?.id) setSelectedCapabilityId(rows[0].id);
  }, [rows, selectedCapabilityId]);

  useEffect(() => {
    let abort = false;
    fetchCapabilityStandards(authToken)
      .then((standards) => {
        if (abort) return;
        setProfiles(standards.profiles);
        setActiveProfileId((current) => current && standards.profiles.some((profile) => profile.id === current) ? current : standards.activeProfileId);
      })
      .catch((err: Error) => { if (!abort) setError(err.message); });
    return () => { abort = true; };
  }, [authToken]);

  useEffect(() => {
    if (!selectedCapabilityId) return;
    let abort = false;
    setLoading(true);
    setError("");
    fetchCapabilityRequirements(authToken, selectedCapabilityId, { profileId: activeProfileId || undefined })
      .then(async (requirement) => {
        if (abort) return;
        setDetail(requirement);
        setSections(requirement.projectedSections);
        setActiveProfileId((current) => current || requirement.activeProfile.id);
        const [runBody, auditBody] = await Promise.all([
          fetchCapabilityCertificationRuns(authToken, requirement.item.id, { profileId: requirement.activeProfile.id, limit: 20 }),
          fetchCapabilityAuditLog(authToken, { targetId: requirement.item.id, limit: 30 })
        ]);
        if (abort) return;
        setRuns(runBody.runs);
        setAuditEntries(auditBody.entries);
      })
      .catch((err: Error) => { if (!abort) setError(err.message); })
      .finally(() => { if (!abort) setLoading(false); });
    return () => { abort = true; };
  }, [authToken, selectedCapabilityId, activeProfileId]);

  async function reloadStandards(nextProfileId?: string) {
    const standards = await fetchCapabilityStandards(authToken);
    setProfiles(standards.profiles);
    setActiveProfileId((current) => nextProfileId ?? (current && standards.profiles.some((profile) => profile.id === current) ? current : standards.activeProfileId));
  }

  async function reloadRequirement(capabilityId = selectedCapabilityId, profileId = activeProfileId) {
    if (!capabilityId) return;
    const next = await fetchCapabilityRequirements(authToken, capabilityId, { profileId: profileId || undefined });
    setDetail(next);
    setSections(next.projectedSections);
    setActiveProfileId(next.activeProfile.id);
    const [runBody, auditBody] = await Promise.all([
      fetchCapabilityCertificationRuns(authToken, capabilityId, { profileId: next.activeProfile.id, limit: 20 }),
      fetchCapabilityAuditLog(authToken, { targetId: capabilityId, limit: 30 })
    ]);
    setRuns(runBody.runs);
    setAuditEntries(auditBody.entries);
  }

  function updateSection(sectionId: string, patch: Partial<CapabilityRequirementSectionState>) {
    setSections((current) => {
      const previous = current[sectionId];
      return {
        ...current,
        [sectionId]: {
          status: patch.status ?? previous?.status ?? "pending",
          evidence: patch.evidence ?? previous?.evidence ?? [],
          notes: patch.notes ?? previous?.notes,
          notApplicableReason: patch.notApplicableReason ?? previous?.notApplicableReason
        }
      };
    });
  }

  function setAllSections(status: CapabilityRequirementSectionState["status"]) {
    const profile = detail?.activeProfile ?? profiles.find((entry) => entry.id === activeProfileId);
    if (!profile) return;
    setSections((current) => {
      const next = { ...current };
      for (const section of profile.sections) {
        const previous = next[section.id];
        next[section.id] = {
          status,
          evidence: previous?.evidence ?? [],
          notes: previous?.notes,
          notApplicableReason: status === "notApplicable" ? previous?.notApplicableReason : undefined
        };
      }
      return next;
    });
  }

  async function saveDraft() {
    if (!detail) return;
    setSaving(true);
    setError("");
    try {
      await saveCapabilityRequirementDraft(authToken, detail.item.id, {
        profileId: detail.activeProfile.id,
        sections,
        note: "Saved from Capability Admin Standards tab"
      });
      await reloadRequirement(detail.item.id, detail.activeProfile.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function simulate() {
    if (!detail) return;
    setSaving(true);
    setError("");
    try {
      const result = await simulateCapabilityRequirementCertification(authToken, detail.item.id, {
        profileId: detail.activeProfile.id,
        sections
      });
      setDetail((current) => current ? { ...current, latestRun: result.run } : current);
      setRuns((current) => [result.run, ...current.filter((run) => run.id !== result.run.id)].slice(0, 20));
      const audit = await fetchCapabilityAuditLog(authToken, { targetId: detail.item.id, limit: 30 });
      setAuditEntries(audit.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!detail) return;
    setSaving(true);
    setError("");
    try {
      let draft: CapabilityRequirementDraft | null = detail.draft;
      if (!draft) {
        const saved = await saveCapabilityRequirementDraft(authToken, detail.item.id, {
          profileId: detail.activeProfile.id,
          sections,
          note: "Created automatically before publish"
        });
        draft = saved.draft;
      }
      await publishCapabilityRequirementDraft(authToken, detail.item.id, {
        profileId: detail.activeProfile.id,
        draftId: draft.id,
        note: "Published from Capability Admin Standards tab"
      });
      await reloadRequirement(detail.item.id, detail.activeProfile.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setSaving(false);
    }
  }

  async function rollback(version: CapabilityRequirementVersion) {
    if (!detail) return;
    if (!window.confirm(`Rollback ${detail.item.id} to v${version.version}? This creates a new published version.`)) return;
    setSaving(true);
    setError("");
    try {
      await rollbackCapabilityRequirementVersion(authToken, detail.item.id, {
        profileId: detail.activeProfile.id,
        versionId: version.id,
        note: `Rollback to v${version.version}`
      });
      await reloadRequirement(detail.item.id, detail.activeProfile.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rollback failed");
    } finally {
      setSaving(false);
    }
  }

  function startEditProfile(profile: CapabilityStandardProfile) {
    setProfileEditor({
      id: profile.id,
      key: profile.key,
      name: profile.name,
      description: profile.description ?? "",
      status: profile.status,
      sections: profile.sections.map((section) => ({ ...section }))
    });
  }

  function startNewProfile() {
    const source = detail?.activeProfile ?? profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0];
    setProfileEditor({
      key: source?.key ?? "full-migration",
      name: source ? `${source.name} draft` : "New standard profile",
      description: source?.description ?? "",
      status: "draft",
      sections: source?.sections.map((section) => ({ ...section })) ?? []
    });
  }

  async function cloneProfile(status: "draft" | "active") {
    const source = detail?.activeProfile ?? profiles.find((profile) => profile.id === activeProfileId);
    if (!source) return;
    setSaving(true);
    setError("");
    try {
      const cloned = await cloneCapabilityStandard(authToken, source.id, {
        name: `${source.name} v${source.version + 1}`,
        status
      });
      await reloadStandards(cloned.profile.id);
      setActiveProfileId(cloned.profile.id);
      startEditProfile(cloned.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clone failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveProfileEditor() {
    if (!profileEditor) return;
    setSaving(true);
    setError("");
    try {
      const input = {
        name: profileEditor.name,
        description: profileEditor.description,
        status: profileEditor.status,
        sections: profileEditor.sections
      };
      const saved = profileEditor.id
        ? await updateCapabilityStandard(authToken, profileEditor.id, input)
        : await createCapabilityStandard(authToken, {
            key: profileEditor.key,
            name: profileEditor.name,
            description: profileEditor.description,
            sections: profileEditor.sections
          });
      if (!profileEditor.id && profileEditor.status !== "draft") {
        await updateCapabilityStandard(authToken, saved.profile.id, { status: profileEditor.status });
      }
      await reloadStandards(saved.profile.id);
      setActiveProfileId(saved.profile.id);
      setProfileEditor(null);
      await reloadRequirement(selectedCapabilityId, saved.profile.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Profile save failed");
    } finally {
      setSaving(false);
    }
  }

  const activeProfile = detail?.activeProfile ?? profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0];
  const latestRun = detail?.latestRun ?? runs[0] ?? null;
  const sectionStats = useMemo(() => {
    const values = activeProfile?.sections.map((section) => sections[section.id]?.status ?? "pending") ?? [];
    return {
      total: values.length,
      satisfied: values.filter((status) => status === "satisfied").length,
      open: values.filter((status) => status === "pending" || status === "blocked").length,
      notApplicable: values.filter((status) => status === "notApplicable").length
    };
  }, [activeProfile, sections]);
  const visibleSections = useMemo(() => {
    const defs = activeProfile?.sections ?? [];
    return defs.filter((section) => {
      const status = sections[section.id]?.status ?? "pending";
      if (sectionFilter === "open") return status === "pending" || status === "blocked";
      if (sectionFilter === "satisfied") return status === "satisfied";
      return true;
    });
  }, [activeProfile, sectionFilter, sections]);

  return (
    <div data-testid="standards-tab" style={{ display: "grid", gap: 16 }}>
      <section style={panelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16 }}>Versioned standards layer</h2>
            <p style={{ color: "#64748b", margin: "4px 0 0 0", maxWidth: 780 }}>
              Admins maintain standard profiles, per-capability requirement drafts, simulation runs, published versions, rollback history, and audit logs. Published versions record governance state; the runtime certified-only gate still applies.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
            <label style={compactLabelStyle}>
              <span>Profile</span>
              <select value={activeProfileId} onChange={(event) => setActiveProfileId(event.target.value)}>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>{profile.name} v{profile.version} ({profile.status})</option>
                ))}
              </select>
            </label>
            <label style={compactLabelStyle}>
              <span>Capability</span>
              <select value={selectedCapabilityId} onChange={(event) => setSelectedCapabilityId(event.target.value)}>
                {rows.map((row) => (
                  <option key={row.id} value={row.id}>{row.name} ({row.id})</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      {error ? <div style={{ background: "#fee2e2", color: "#991b1b", padding: 12, borderRadius: 6 }}>{error}</div> : null}

      <section style={panelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15 }}>Standard profiles</h3>
            <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: 12 }}>
              Edit the default profile by materializing it online, clone profiles for new revisions, activate one profile per key, and retire older profiles only after a replacement exists.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="ghost-action" onClick={startNewProfile} disabled={saving}>New profile</button>
            <button type="button" className="ghost-action" onClick={() => cloneProfile("draft")} disabled={saving || !activeProfile}>Clone draft</button>
            <button type="button" className="ghost-action" onClick={() => cloneProfile("active")} disabled={saving || !activeProfile}>Clone active</button>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#f1f5f9" }}>
              <tr><Th>Profile</Th><Th>Key</Th><Th>Status</Th><Th>Sections</Th><Th>Updated</Th><Th>Action</Th></tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr key={profile.id} style={{ borderBottom: "1px solid #e2e8f0", background: profile.id === activeProfileId ? "#eff6ff" : undefined }}>
                  <Td><strong>{profile.name}</strong><div style={{ color: "#64748b", fontSize: 11 }}>{profile.id} / v{profile.version}</div></Td>
                  <Td><code>{profile.key}</code></Td>
                  <Td>{profile.status}</Td>
                  <Td>{profile.sections.length}</Td>
                  <Td>{new Date(profile.updatedAt).toLocaleString()}</Td>
                  <Td>
                    <button type="button" className="ghost-action" onClick={() => startEditProfile(profile)} disabled={saving}>Edit</button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {profileEditor ? (
          <StandardProfileEditor
            editor={profileEditor}
            saving={saving}
            onChange={setProfileEditor}
            onCancel={() => setProfileEditor(null)}
            onSave={saveProfileEditor}
          />
        ) : null}
      </section>

      {loading || !detail || !activeProfile ? (
        <p style={{ color: "#64748b" }}>Loading...</p>
      ) : (
        <>
          <section style={summaryStyle}>
            <SummaryStat label="Runtime gate" value={detail.certification.status} icon={<Shield size={16} aria-hidden />} tone={detail.certification.status === "certified" ? "green" : "amber"} />
            <SummaryStat label="Published version" value={detail.currentVersion ? `v${detail.currentVersion.version}` : "none"} icon={<BookOpen size={16} aria-hidden />} tone="slate" />
            <SummaryStat label="Draft" value={detail.draft ? `v${detail.draft.draftVersion}` : "none"} icon={<FileText size={16} aria-hidden />} tone="slate" />
            <SummaryStat label="Sections" value={`${sectionStats.satisfied}/${sectionStats.total}`} icon={<CheckCircle2 size={16} aria-hidden />} tone={sectionStats.open === 0 ? "green" : "amber"} />
            <SummaryStat label="Last simulation" value={latestRun?.status ?? "none"} icon={<RefreshCcw size={16} aria-hidden />} tone={latestRun?.status === "certified" ? "green" : "amber"} />
          </section>

          <section style={panelStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15 }}>{detail.item.name}</h3>
                <p style={{ margin: "4px 0 0 0", color: "#64748b" }}>
                  <code>{detail.item.id}</code> / <code>{detail.item.capabilityKey ?? "-"}</code> / {detail.item.category} / <code>{detail.activeProfile.name}</code>
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <FilterPills
                  value={sectionFilter}
                  onChange={setSectionFilter}
                  options={[
                    { value: "all", label: "All" },
                    { value: "open", label: "Open" },
                    { value: "satisfied", label: "Satisfied" }
                  ]}
                />
                <button type="button" className="ghost-action" onClick={() => setAllSections("satisfied")} disabled={saving}>Mark all satisfied</button>
                <button type="button" className="ghost-action" onClick={() => setAllSections("pending")} disabled={saving}>Mark all pending</button>
                <button type="button" className="ghost-action" onClick={() => setSections(detail.projectedSections)} disabled={saving}>Reset</button>
                <button type="button" className="ghost-action" onClick={saveDraft} disabled={saving}>Save draft</button>
                <button type="button" className="ghost-action" onClick={simulate} disabled={saving}>Simulate</button>
                <button type="button" className="primary-action" onClick={publish} disabled={saving}>Publish</button>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {visibleSections.map((section) => {
                const state = sections[section.id] ?? { status: "pending" as const, evidence: [] };
                const result = latestRun?.sectionResults?.[section.id];
                return (
                  <div key={section.id} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <div>
                        <strong>{REQUIREMENT_LABELS[section.id]?.[locale] ?? section.label}</strong>
                        <span style={{ marginLeft: 8, color: section.severity === "critical" ? "#991b1b" : "#64748b", fontSize: 11 }}>{section.severity}</span>
                        <p style={{ margin: "2px 0 0 0", color: "#64748b", fontSize: 12 }}>{section.description}</p>
                        {result && !result.ok ? <p style={{ margin: "3px 0 0 0", color: "#b45309", fontSize: 12 }}>{result.reason}</p> : null}
                      </div>
                      <select value={state.status} onChange={(event) => updateSection(section.id, { status: event.target.value as CapabilityRequirementSectionState["status"] })}>
                        <option value="pending">pending</option>
                        <option value="satisfied">satisfied</option>
                        <option value="notApplicable">notApplicable</option>
                        <option value="blocked">blocked</option>
                      </select>
                    </div>
                    <textarea
                      value={state.notes ?? ""}
                      onChange={(event) => updateSection(section.id, { notes: event.target.value })}
                      placeholder="Notes / evidence summary"
                      rows={2}
                      style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "8px 10px", resize: "vertical" }}
                    />
                    <textarea
                      value={(state.evidence ?? []).join("\n")}
                      onChange={(event) => updateSection(section.id, { evidence: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean) })}
                      placeholder="Evidence links or commands, one per line"
                      rows={2}
                      style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "8px 10px", resize: "vertical" }}
                    />
                    {state.status === "notApplicable" ? (
                      <input
                        value={state.notApplicableReason ?? ""}
                        onChange={(event) => updateSection(section.id, { notApplicableReason: event.target.value })}
                        placeholder="Not-applicable reason"
                        style={{ border: "1px solid #f59e0b", borderRadius: 6, padding: "8px 10px" }}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          <StandardsHistoryFull
            latestRun={latestRun}
            runs={runs}
            versions={detail.versions}
            auditEntries={auditEntries}
            locale={locale}
            saving={saving}
            onRollback={rollback}
            onRestoreVersion={(version) => setSections(version.sections)}
          />
        </>
      )}
    </div>
  );
}

function StandardProfileEditor({
  editor,
  saving,
  onChange,
  onCancel,
  onSave
}: {
  editor: StandardProfileEditorState;
  saving: boolean;
  onChange: (next: StandardProfileEditorState) => void;
  onCancel: () => void;
  onSave: () => void;
}): JSX.Element {
  function updateSection(index: number, patch: Partial<CapabilityStandardSection>) {
    const sections = editor.sections.map((section, i) => i === index ? { ...section, ...patch } : section);
    onChange({ ...editor, sections });
  }
  function addSection() {
    const nextIndex = editor.sections.length + 1;
    onChange({
      ...editor,
      sections: [
        ...editor.sections,
        { id: `custom-${nextIndex}`, label: `Custom ${nextIndex}`, description: "", required: true, allowNotApplicable: true, severity: "required" }
      ]
    });
  }
  function removeSection(index: number) {
    onChange({ ...editor, sections: editor.sections.filter((_, i) => i !== index) });
  }
  return (
    <div style={{ marginTop: 14, borderTop: "1px solid #e2e8f0", paddingTop: 12, display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        <label style={compactLabelStyle}>
          <span>Key</span>
          <input value={editor.key} onChange={(event) => onChange({ ...editor, key: event.target.value })} disabled={Boolean(editor.id)} />
        </label>
        <label style={compactLabelStyle}>
          <span>Name</span>
          <input value={editor.name} onChange={(event) => onChange({ ...editor, name: event.target.value })} />
        </label>
        <label style={compactLabelStyle}>
          <span>Status</span>
          <select value={editor.status} onChange={(event) => onChange({ ...editor, status: event.target.value as StandardProfileEditorState["status"] })}>
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="retired">retired</option>
          </select>
        </label>
      </div>
      <label style={compactLabelStyle}>
        <span>Description</span>
        <textarea value={editor.description} onChange={(event) => onChange({ ...editor, description: event.target.value })} rows={2} />
      </label>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <strong>Profile sections</strong>
        <button type="button" className="ghost-action" onClick={addSection} disabled={saving}>Add section</button>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {editor.sections.map((section, index) => (
          <div key={`${section.id}-${index}`} style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: 10, display: "grid", gap: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
              <label style={compactLabelStyle}>
                <span>Id</span>
                <input value={section.id} onChange={(event) => updateSection(index, { id: event.target.value })} />
              </label>
              <label style={compactLabelStyle}>
                <span>Label</span>
                <input value={section.label} onChange={(event) => updateSection(index, { label: event.target.value })} />
              </label>
              <label style={compactLabelStyle}>
                <span>Severity</span>
                <select value={section.severity} onChange={(event) => updateSection(index, { severity: event.target.value as CapabilityStandardSection["severity"] })}>
                  <option value="required">required</option>
                  <option value="critical">critical</option>
                  <option value="advisory">advisory</option>
                </select>
              </label>
            </div>
            <textarea value={section.description} onChange={(event) => updateSection(index, { description: event.target.value })} placeholder="Description" rows={2} />
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <input type="checkbox" checked={section.required} onChange={(event) => updateSection(index, { required: event.target.checked })} />
                Required
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <input type="checkbox" checked={section.allowNotApplicable} onChange={(event) => updateSection(index, { allowNotApplicable: event.target.checked })} />
                Allow N/A
              </label>
              <button type="button" className="ghost-action" onClick={() => removeSection(index)} disabled={saving || editor.sections.length <= 1}>Remove</button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="ghost-action" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="button" className="primary-action" onClick={onSave} disabled={saving}>Save profile</button>
      </div>
    </div>
  );
}

function StandardsHistoryFull({
  latestRun,
  runs,
  versions,
  auditEntries,
  locale,
  saving,
  onRollback,
  onRestoreVersion
}: {
  latestRun: CapabilityCertificationRun | null;
  runs: CapabilityCertificationRun[];
  versions: CapabilityRequirementVersion[];
  auditEntries: AdminAuditLogEntry[];
  locale: Locale;
  saving: boolean;
  onRollback: (version: CapabilityRequirementVersion) => void;
  onRestoreVersion: (version: CapabilityRequirementVersion) => void;
}): JSX.Element {
  return (
    <section style={panelStyle}>
      <h3 style={{ marginTop: 0 }}>Certification runs, versions, and audit log</h3>
      {latestRun ? (
        <div style={{ marginBottom: 12, color: latestRun.status === "certified" ? "#166534" : "#92400e" }}>
          <strong>{latestRun.status}</strong>
          <span style={{ marginLeft: 8, color: "#64748b" }}>{new Date(latestRun.createdAt).toLocaleString()}</span>
          {latestRun.reasons.length > 0 ? (
            <ul style={{ margin: "6px 0 0 16px" }}>
              {latestRun.reasons.slice(0, 6).map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          ) : null}
        </div>
      ) : (
        <p style={{ color: "#64748b" }}>No simulation run yet.</p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        <div style={{ overflowX: "auto" }}>
          <h4 style={{ margin: "0 0 8px 0" }}>Published versions</h4>
          {versions.length === 0 ? (
            <p style={{ color: "#64748b" }}>No published versions yet.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#f1f5f9" }}>
                <tr><Th>Version</Th><Th>Status</Th><Th>Published</Th><Th>Action</Th></tr>
              </thead>
              <tbody>
                {versions.map((version) => (
                  <tr key={version.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <Td>
                      <strong>v{version.version}</strong>
                      {version.rollbackOfVersionId ? <div style={{ color: "#64748b", fontSize: 11 }}>rollback of {version.rollbackOfVersionId}</div> : null}
                    </Td>
                    <Td>{version.status}</Td>
                    <Td>{new Date(version.publishedAt).toLocaleString()}</Td>
                    <Td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button type="button" className="ghost-action" onClick={() => onRestoreVersion(version)} disabled={saving}>Load</button>
                        <button type="button" className="ghost-action" onClick={() => onRollback(version)} disabled={saving || version.status === "published"}>Rollback</button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ overflowX: "auto" }}>
          <h4 style={{ margin: "0 0 8px 0" }}>Recent runs</h4>
          {runs.length === 0 ? (
            <p style={{ color: "#64748b" }}>No runs recorded.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#f1f5f9" }}>
                <tr><Th>Status</Th><Th>Missing</Th><Th>Created</Th></tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <Td>{run.status}</Td>
                    <Td>{run.missingSections.length}</Td>
                    <Td>{new Date(run.createdAt).toLocaleString()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div style={{ marginTop: 14, overflowX: "auto" }}>
        <h4 style={{ margin: "0 0 8px 0" }}>{locale === "zh" ? "管理审计日志" : "Admin audit log"}</h4>
        {auditEntries.length === 0 ? (
          <p style={{ color: "#64748b" }}>{locale === "zh" ? "暂无审计记录。" : "No audit entries."}</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#f1f5f9" }}>
              <tr><Th>Action</Th><Th>Admin</Th><Th>Feedback</Th><Th>Time</Th></tr>
            </thead>
            <tbody>
              {auditEntries.map((entry) => (
                <tr key={entry.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <Td><code>{entry.action}</code></Td>
                  <Td>{entry.adminId}</Td>
                  <Td>{entry.feedback ?? "-"}</Td>
                  <Td>{new Date(entry.timestamp).toLocaleString()}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function LegacyStandardsTab({ locale, authToken, rows }: { locale: Locale; authToken: string; rows: AdminCatalogRow[] }): JSX.Element {
  const [profiles, setProfiles] = useState<CapabilityStandardProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState("");
  const [selectedCapabilityId, setSelectedCapabilityId] = useState(rows[0]?.id ?? "");
  const [detail, setDetail] = useState<CapabilityRequirementsDetail | null>(null);
  const [sections, setSections] = useState<Record<string, CapabilityRequirementSectionState>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedCapabilityId && rows[0]?.id) setSelectedCapabilityId(rows[0].id);
  }, [rows, selectedCapabilityId]);

  useEffect(() => {
    let abort = false;
    setLoading(true);
    Promise.all([
      fetchCapabilityStandards(authToken),
      selectedCapabilityId ? fetchCapabilityRequirements(authToken, selectedCapabilityId) : Promise.resolve(null)
    ])
      .then(([standards, requirement]) => {
        if (abort) return;
        setProfiles(standards.profiles);
        setActiveProfileId(standards.activeProfileId);
        if (requirement) {
          setDetail(requirement);
          setSections(requirement.projectedSections);
        }
      })
      .catch((err: Error) => { if (!abort) setError(err.message); })
      .finally(() => { if (!abort) setLoading(false); });
    return () => { abort = true; };
  }, [authToken, selectedCapabilityId]);

  async function reloadRequirement(capabilityId = selectedCapabilityId) {
    if (!capabilityId) return;
    const next = await fetchCapabilityRequirements(authToken, capabilityId);
    setDetail(next);
    setSections(next.projectedSections);
  }

  function updateSection(sectionId: string, patch: Partial<CapabilityRequirementSectionState>) {
    setSections((current) => {
      const previous = current[sectionId];
      return {
        ...current,
        [sectionId]: {
          status: patch.status ?? previous?.status ?? "pending",
          evidence: patch.evidence ?? previous?.evidence ?? [],
          notes: patch.notes ?? previous?.notes,
          notApplicableReason: patch.notApplicableReason ?? previous?.notApplicableReason
        }
      };
    });
  }

  async function saveDraft() {
    if (!detail) return;
    setSaving(true);
    setError("");
    try {
      await saveCapabilityRequirementDraft(authToken, detail.item.id, {
        profileId: detail.activeProfile.id,
        sections,
        note: "Saved from Capability Admin Standards tab"
      });
      await reloadRequirement(detail.item.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function simulate() {
    if (!detail) return;
    setSaving(true);
    setError("");
    try {
      const result = await simulateCapabilityRequirementCertification(authToken, detail.item.id, {
        profileId: detail.activeProfile.id,
        sections
      });
      setDetail((current) => current ? { ...current, latestRun: result.run } : current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!detail) return;
    setSaving(true);
    setError("");
    try {
      let draft: CapabilityRequirementDraft | null = detail.draft;
      if (!draft) {
        const saved = await saveCapabilityRequirementDraft(authToken, detail.item.id, {
          profileId: detail.activeProfile.id,
          sections,
          note: "Created automatically before publish"
        });
        draft = saved.draft;
      }
      await publishCapabilityRequirementDraft(authToken, detail.item.id, {
        profileId: detail.activeProfile.id,
        draftId: draft.id,
        note: "Published from Capability Admin Standards tab"
      });
      await reloadRequirement(detail.item.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setSaving(false);
    }
  }

  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) ?? detail?.activeProfile ?? profiles[0];
  const latestRun = detail?.latestRun ?? null;

  return (
    <div data-testid="standards-tab" style={{ display: "grid", gap: 16 }}>
      <section style={panelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16 }}>{locale === "zh" ? "版本化标准层" : "Versioned standards layer"}</h2>
            <p style={{ color: "#64748b", margin: "4px 0 0 0", maxWidth: 760 }}>
              {locale === "zh"
                ? "管理员在这里维护标准 profile、逐能力 requirement draft、模拟认证和发布版本。发布不会绕过现有用户侧 certified-only 门禁。"
                : "Maintain standard profiles, per-capability requirement drafts, simulation runs, and published versions. Publishing does not bypass the user-side certified-only gate."}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label style={compactLabelStyle}>
              <span>Profile</span>
              <select value={activeProfileId} onChange={(event) => setActiveProfileId(event.target.value)} disabled>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>{profile.name} v{profile.version} ({profile.status})</option>
                ))}
              </select>
            </label>
            <label style={compactLabelStyle}>
              <span>Capability</span>
              <select value={selectedCapabilityId} onChange={(event) => setSelectedCapabilityId(event.target.value)}>
                {rows.map((row) => (
                  <option key={row.id} value={row.id}>{row.name} ({row.id})</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      {error ? <div style={{ background: "#fee2e2", color: "#991b1b", padding: 12, borderRadius: 6 }}>{error}</div> : null}
      {loading || !detail || !activeProfile ? (
        <p style={{ color: "#64748b" }}>{locale === "zh" ? "加载中..." : "Loading..."}</p>
      ) : (
        <>
          <section style={summaryStyle}>
            <SummaryStat label="Runtime gate" value={detail.certification.status} icon={<Shield size={16} aria-hidden />} tone={detail.certification.status === "certified" ? "green" : "amber"} />
            <SummaryStat label="Published version" value={detail.currentVersion ? `v${detail.currentVersion.version}` : "none"} icon={<BookOpen size={16} aria-hidden />} tone="slate" />
            <SummaryStat label="Draft" value={detail.draft ? `v${detail.draft.draftVersion}` : "none"} icon={<FileText size={16} aria-hidden />} tone="slate" />
            <SummaryStat label="Last simulation" value={latestRun?.status ?? "none"} icon={<RefreshCcw size={16} aria-hidden />} tone={latestRun?.status === "certified" ? "green" : "amber"} />
          </section>

          <section style={panelStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15 }}>{detail.item.name}</h3>
                <p style={{ margin: "4px 0 0 0", color: "#64748b" }}>
                  <code>{detail.item.id}</code> / <code>{detail.item.capabilityKey ?? "-"}</code> / {detail.item.category}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="ghost-action" onClick={saveDraft} disabled={saving}>Save draft</button>
                <button type="button" className="ghost-action" onClick={simulate} disabled={saving}>Simulate</button>
                <button type="button" className="primary-action" onClick={publish} disabled={saving}>Publish</button>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {activeProfile.sections.map((section) => {
                const state = sections[section.id] ?? { status: "pending" as const, evidence: [] };
                return (
                  <div key={section.id} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <div>
                        <strong>{REQUIREMENT_LABELS[section.id]?.[locale] ?? section.label}</strong>
                        <p style={{ margin: "2px 0 0 0", color: "#64748b", fontSize: 12 }}>{section.description}</p>
                      </div>
                      <select value={state.status} onChange={(event) => updateSection(section.id, { status: event.target.value as CapabilityRequirementSectionState["status"] })}>
                        <option value="pending">pending</option>
                        <option value="satisfied">satisfied</option>
                        <option value="notApplicable">notApplicable</option>
                        <option value="blocked">blocked</option>
                      </select>
                    </div>
                    <input
                      value={state.notes ?? ""}
                      onChange={(event) => updateSection(section.id, { notes: event.target.value })}
                      placeholder={locale === "zh" ? "备注 / 证据摘要" : "Notes / evidence summary"}
                      style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "8px 10px" }}
                    />
                    {state.status === "notApplicable" ? (
                      <input
                        value={state.notApplicableReason ?? ""}
                        onChange={(event) => updateSection(section.id, { notApplicableReason: event.target.value })}
                        placeholder={locale === "zh" ? "不适用原因" : "Not-applicable reason"}
                        style={{ border: "1px solid #f59e0b", borderRadius: 6, padding: "8px 10px" }}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          <StandardsHistory latestRun={latestRun} versions={detail.versions} locale={locale} />
        </>
      )}
    </div>
  );
}

function StandardsHistory({
  latestRun,
  versions,
  locale
}: {
  latestRun: CapabilityCertificationRun | null;
  versions: CapabilityRequirementVersion[];
  locale: Locale;
}): JSX.Element {
  return (
    <section style={panelStyle}>
      <h3 style={{ marginTop: 0 }}>{locale === "zh" ? "认证运行与版本历史" : "Certification runs and versions"}</h3>
      {latestRun ? (
        <div style={{ marginBottom: 12, color: latestRun.status === "certified" ? "#166534" : "#92400e" }}>
          <strong>{latestRun.status}</strong>
          {latestRun.reasons.length > 0 ? (
            <ul style={{ margin: "6px 0 0 16px" }}>
              {latestRun.reasons.slice(0, 6).map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          ) : null}
        </div>
      ) : (
        <p style={{ color: "#64748b" }}>{locale === "zh" ? "尚未运行模拟。" : "No simulation run yet."}</p>
      )}
      {versions.length === 0 ? (
        <p style={{ color: "#64748b" }}>{locale === "zh" ? "尚未发布版本。" : "No published versions yet."}</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "#f1f5f9" }}>
            <tr><Th>Version</Th><Th>Status</Th><Th>Published</Th><Th>Run</Th></tr>
          </thead>
          <tbody>
            {versions.map((version) => (
              <tr key={version.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                <Td>v{version.version}</Td>
                <Td>{version.status}</Td>
                <Td>{new Date(version.publishedAt).toLocaleString()}</Td>
                <Td><code>{version.certificationRunId ?? "-"}</code></Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function RuleDetailDrawer({ row, locale }: { row: AdminCatalogRow; locale: Locale }): JSX.Element {
  const reasons = row.certification.reasons;
  const status = row.certification.status;
  const checklist = ["identity", "detection", "install", "config", "data", "references", "validate", "rollback", "security", "crossDistro", "conflicts", "planIntegration", "harness"];
  return (
    <div data-testid={`rule-drawer-${row.id}`}>
      <h3 style={{ margin: "0 0 8px 0" }}>{row.name}</h3>
      <p style={{ margin: "0 0 8px 0", color: "#475569" }}>
        <code>{row.id}</code> · <code>{row.capabilityKey ?? "—"}</code> · {row.category}
      </p>
      <p>
        <strong>{locale === "zh" ? "认证状态：" : "Certification status: "}</strong>
        {status === "certified" ? (locale === "zh" ? "已认证" : "Certified") : (locale === "zh" ? "未就绪" : "Not Ready")}
      </p>

      <h4>{locale === "zh" ? "完整迁移检查项" : "Full Migration Checklist"}</h4>
      <ul style={{ margin: "0 0 12px 0", padding: 0, listStyle: "none" }}>
        {checklist.map((section) => {
          const missing = reasons.some((r) => r.toLowerCase().includes(section.toLowerCase())) ||
                          reasons.some((r) => r === section);
          const label = REQUIREMENT_LABELS[section]?.[locale] ?? section;
          const icon = section === "identity" ? <BookOpen size={14} aria-hidden /> :
                       section === "config" ? <Cog size={14} aria-hidden /> :
                       section === "install" ? <BoxIcon size={14} aria-hidden /> :
                       section === "validate" ? <CheckCircle2 size={14} aria-hidden /> :
                       section === "rollback" ? <RefreshCcw size={14} aria-hidden /> :
                       section === "security" ? <Shield size={14} aria-hidden /> :
                       section === "data" ? <Database size={14} aria-hidden /> :
                       section === "references" ? <Network size={14} aria-hidden /> :
                       section === "conflicts" ? <AlertTriangle size={14} aria-hidden /> :
                       section === "harness" ? <Hand size={14} aria-hidden /> :
                       section === "planIntegration" ? <FileText size={14} aria-hidden /> :
                       section === "crossDistro" ? <Server size={14} aria-hidden /> :
                       section === "detection" ? <Key size={14} aria-hidden /> :
                       <FileText size={14} aria-hidden />;
          return (
            <li key={section} style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 0" }}>
              {missing ? <XCircle size={14} color="#b45309" aria-hidden /> : <CheckCircle2 size={14} color="#16a34a" aria-hidden />}
              {icon}
              <span style={{ color: missing ? "#92400e" : "#166534" }}>{label}</span>
            </li>
          );
        })}
      </ul>

      {status === "not-ready" ? (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", padding: 8, borderRadius: 6 }}>
          <strong>{locale === "zh" ? "缺失项与升级任务" : "Missing requirements & upgrade tasks"}</strong>
          <ul style={{ margin: "4px 0 0 16px" }}>
            {reasons.map((r) => <li key={r}>{r}</li>)}
          </ul>
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <button type="button" onClick={() => copyToClipboard(reasons.join("\n"))}>
              {locale === "zh" ? "复制缺失项" : "Copy Missing Requirements"}
            </button>
            <button type="button" onClick={() => copyToClipboard(buildUpgradePrompt(row, locale))}>
              {locale === "zh" ? "生成升级提示词" : "Generate Upgrade Prompt"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Suggestion Inbox tab ──────────────────────────────────────────────

function SuggestionInboxTab({
  locale, suggestions, loading, onProcess
}: {
  locale: Locale;
  suggestions: AdminSuggestionRecord[];
  loading: boolean;
  onProcess: (id: string, action: "accepted" | "rejected", feedback?: string) => Promise<void>;
}): JSX.Element {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return suggestions.filter((s) => statusFilter === "all" || s.status === statusFilter);
  }, [suggestions, statusFilter]);

  return (
    <div data-testid="suggestions-tab">
      <p style={{ color: "#475569", margin: "0 0 12px 0", maxWidth: 720 }}>
        {locale === "zh"
          ? "处理用户提交的能力建议、组合调整、规则缺失反馈。状态在 pending / accepted / rejected 之间流转。"
          : "Process user-submitted capability requests, combo adjustments, and rule-gap feedback. Status flows through pending / accepted / rejected."}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "0 0 12px 0" }}>
        <FilterPills
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "all", label: locale === "zh" ? "全部" : "All" },
            { value: "pending", label: locale === "zh" ? "待处理" : "Pending" },
            { value: "accepted", label: locale === "zh" ? "已接受" : "Accepted" },
            { value: "rejected", label: locale === "zh" ? "已拒绝" : "Rejected" }
          ]}
        />
      </div>

      {loading ? (
        <p style={{ color: "#64748b" }}>{locale === "zh" ? "加载中..." : "Loading..."}</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: "#64748b" }}>{locale === "zh" ? "暂无建议" : "No suggestions yet."}</p>
      ) : (
        <table data-testid="suggestions-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "#f1f5f9" }}>
            <tr>
              <Th>{locale === "zh" ? "标题" : "Title"}</Th>
              <Th>{locale === "zh" ? "提交人" : "Submitter"}</Th>
              <Th>{locale === "zh" ? "类型" : "Type"}</Th>
              <Th>{locale === "zh" ? "关联能力" : "Related capability"}</Th>
              <Th>Status</Th>
              <Th>{locale === "zh" ? "提交时间" : "Submitted"}</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} style={{ borderBottom: "1px solid #e2e8f0" }} data-testid={`suggestion-row-${s.id}`}>
                <Td>
                  <strong>{locale === "zh" ? s.nameZh || s.nameEn : s.nameEn || s.nameZh}</strong>
                  {s.remark ? <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>{s.remark}</div> : null}
                </Td>
                <Td>{s.displayName || s.username}</Td>
                <Td><code>{s.type}</code></Td>
                <Td>{s.catalogId ? <code>{s.catalogId}</code> : <span style={{ color: "#64748b" }}>—</span>}</Td>
                <Td>
                  <SuggestionStatusBadge status={s.status} locale={locale} testId={`suggestion-status-${s.id}`} />
                </Td>
                <Td><span style={{ color: "#64748b", fontSize: 11 }}>{new Date(s.createdAt).toLocaleString()}</span></Td>
                <Td>
                  {s.status === "pending" ? (
                    <div style={{ display: "flex", gap: 4 }}>
                      <button type="button" disabled={busyId === s.id}
                        onClick={async () => {
                          setBusyId(s.id);
                          try { await onProcess(s.id, "accepted"); }
                          finally { setBusyId(null); }
                        }}
                        style={{ padding: "2px 8px", background: "#dcfce7", border: "1px solid #86efac", color: "#166534", borderRadius: 4 }}>
                        {locale === "zh" ? "接受" : "Accept"}
                      </button>
                      <button type="button" disabled={busyId === s.id}
                        onClick={async () => {
                          const feedback = window.prompt(locale === "zh" ? "拒绝理由（可选）" : "Reason (optional)") ?? "";
                          setBusyId(s.id);
                          try { await onProcess(s.id, "rejected", feedback); }
                          finally { setBusyId(null); }
                        }}
                        style={{ padding: "2px 8px", background: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 4 }}>
                        {locale === "zh" ? "拒绝" : "Reject"}
                      </button>
                    </div>
                  ) : <span style={{ color: "#64748b", fontSize: 11 }}>—</span>}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SuggestionStatusBadge({ status, locale, testId }: { status: string; locale: Locale; testId: string }): JSX.Element {
  const map: Record<string, { bg: string; fg: string; border: string; zh: string; en: string }> = {
    pending: { bg: "#fef3c7", fg: "#92400e", border: "#fcd34d", zh: "待处理", en: "Pending" },
    accepted: { bg: "#dcfce7", fg: "#166534", border: "#86efac", zh: "已接受", en: "Accepted" },
    rejected: { bg: "#fee2e2", fg: "#991b1b", border: "#fecaca", zh: "已拒绝", en: "Rejected" }
  };
  const colors = map[status] ?? { bg: "#f1f5f9", fg: "#475569", border: "#cbd5e1", zh: status, en: status };
  return (
    <span data-testid={testId}
      style={{ background: colors.bg, color: colors.fg, border: `1px solid ${colors.border}`, padding: "2px 8px", borderRadius: 999, fontSize: 11 }}>
      {locale === "zh" ? colors.zh : colors.en}
    </span>
  );
}

// ── Package Integrations tab ──────────────────────────────────────────

function PackageIntegrationsTab({
  locale, rows, meta, loading, authToken
}: {
  locale: Locale;
  rows: PackageIntegrationRow[];
  meta: { total: number; withRule: number; withoutRule: number } | null;
  loading: boolean;
  authToken: string;
}): JSX.Element {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "with-rule" | "without-rule">("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PackageIntegrationDetail | null>(null);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter === "with-rule" && !r.hasRule) return false;
      if (statusFilter === "without-rule" && r.hasRule) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!r.name.toLowerCase().includes(q) &&
            !r.id.toLowerCase().includes(q) &&
            !(r.capabilityKey ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter]);

  useEffect(() => {
    if (!activeId) { setDetail(null); return; }
    let abort = false;
    fetchPackageIntegrationDetail(authToken, activeId)
      .then((d) => { if (!abort) setDetail(d); })
      .catch(() => { if (!abort) setDetail(null); });
    return () => { abort = true; };
  }, [activeId, authToken]);

  const activeRow = activeId ? rows.find((r) => r.id === activeId) ?? null : null;

  return (
    <div data-testid="integrations-tab">
      <p style={{ color: "#475569", margin: "0 0 12px 0", maxWidth: 720 }}>
        {locale === "zh"
          ? "规则级软件包支持映射治理：跨发行版包名 / 服务 / 配置路径 / 端口 / 验证 / 回滚 / 数据策略。这不是主机级包管理器。"
          : "Rule-level package support governance: cross-distro packages / services / config paths / ports / validate / rollback / data strategy. This is NOT a host-level package manager."}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "0 0 12px 0" }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#fff", border: "1px solid #cbd5e1", borderRadius: 6, padding: "2px 8px" }}>
          <Search size={14} aria-hidden />
          <input
            type="search"
            placeholder={locale === "zh" ? "搜索能力" : "Search capability"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ border: "none", outline: "none", fontSize: 12, padding: "4px 0", minWidth: 220 }}
            data-testid="integrations-search"
          />
        </label>
        <FilterPills
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "all", label: locale === "zh" ? "全部" : "All" },
            { value: "with-rule", label: locale === "zh" ? "已有规则" : "With rule" },
            { value: "without-rule", label: locale === "zh" ? "缺规则" : "Missing rule" }
          ]}
        />
        {meta ? (
          <span style={{ color: "#64748b", fontSize: 12, display: "flex", alignItems: "center" }}>
            {locale === "zh"
              ? `已有规则 ${meta.withRule} / 缺规则 ${meta.withoutRule} / 共 ${meta.total}`
              : `with rule ${meta.withRule} / missing ${meta.withoutRule} / total ${meta.total}`}
          </span>
        ) : null}
      </div>

      {loading ? (
        <p style={{ color: "#64748b" }}>{locale === "zh" ? "加载中..." : "Loading..."}</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1fr) minmax(360px, 2fr)", gap: 12 }}>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 6, maxHeight: 560, overflow: "auto" }} data-testid="integrations-list">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead style={{ background: "#f1f5f9", position: "sticky", top: 0 }}>
                <tr>
                  <Th>Capability</Th>
                  <Th>{locale === "zh" ? "规则" : "Rule"}</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}
                      data-testid={`integration-row-${row.id}`}
                      onClick={() => setActiveId(row.id)}
                      style={{ borderBottom: "1px solid #e2e8f0", cursor: "pointer", background: row.id === activeId ? "#eff6ff" : undefined }}>
                    <Td>
                      <strong>{row.name}</strong>
                      <div style={{ color: "#64748b", fontSize: 11 }}>{row.id}</div>
                    </Td>
                    <Td>
                      {row.hasRule ? (
                        <span style={{ background: "#dcfce7", color: "#166534", padding: "1px 6px", borderRadius: 999, fontSize: 11 }}>
                          {locale === "zh" ? "有规则" : "rule"}
                        </span>
                      ) : (
                        <span style={{ background: "#fef3c7", color: "#92400e", padding: "1px 6px", borderRadius: 999, fontSize: 11 }}>
                          {locale === "zh" ? "缺规则" : "missing"}
                        </span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: 12 }} data-testid="integration-detail">
            {!activeRow ? (
              <p style={{ color: "#64748b" }}>
                {locale === "zh" ? "选择左侧能力查看规则细节。" : "Pick a capability on the left to view its rule details."}
              </p>
            ) : (
              <PackageIntegrationDetailPanel locale={locale} row={activeRow} detail={detail} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PackageIntegrationDetailPanel({
  locale, row, detail
}: {
  locale: Locale;
  row: PackageIntegrationRow;
  detail: PackageIntegrationDetail | null;
}): JSX.Element {
  const summary = row.ruleSummary;
  return (
    <div>
      <h3 style={{ margin: "0 0 4px 0" }}>{row.name}</h3>
      <p style={{ margin: "0 0 12px 0", color: "#475569", fontSize: 12 }}>
        <code>{row.id}</code> · <code>{row.capabilityKey ?? "—"}</code> · {row.category}
      </p>

      {!row.hasRule || !summary ? (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", padding: 12, borderRadius: 6 }}>
          <strong>{locale === "zh" ? "缺少检测规则" : "Missing CatalogDetectionRule"}</strong>
          <p style={{ margin: "4px 0 0 0", fontSize: 12 }}>
            {locale === "zh"
              ? "该能力没有规则，无法跨发行版安装、检测或验证。请在 catalog-rules.ts 中补充。"
              : "This capability has no rule entry; cross-distro install / detection / validation is impossible. Add a rule in catalog-rules.ts."}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          <Section title={locale === "zh" ? "跨发行版包映射" : "Cross-distro package map"} testId="package-map">
            <Kvp obj={summary.packageMap} />
          </Section>
          <Section title={locale === "zh" ? "服务映射" : "Service map"} testId="service-map">
            <Kvp obj={summary.serviceMap} />
          </Section>
          <Section title={locale === "zh" ? "二进制 / systemd / 端口检测" : "Binary / systemd / port detection"} testId="detection">
            <DetailList label="binaries" items={summary.binaries} />
            <DetailList label="systemd" items={summary.systemd} />
            <DetailList label="ports" items={summary.ports.map(String)} />
          </Section>
          <Section title={locale === "zh" ? "配置路径" : "Config paths"} testId="config-paths">
            <DetailList label="files" items={summary.configFiles} />
            <DetailList label="globs" items={summary.configGlobs} />
            <DetailList label="secret patterns" items={summary.secretPatterns} />
          </Section>
          <Section title={locale === "zh" ? "数据 & 验证 & 回滚" : "Data / Validate / Rollback hooks"} testId="hooks">
            <DetailList label="data paths" items={summary.dataPaths} />
            <DetailList label="validate" items={summary.validate} />
            <DetailList label="restartServices" items={summary.restartServices} />
            <p style={{ margin: "4px 0", fontSize: 12 }}>
              <span style={{ color: "#64748b" }}>data strategy:</span> <code>{summary.dataStrategy}</code>
              {summary.migrationStrategy ? <> · <span style={{ color: "#64748b" }}>migration strategy:</span> <code>{summary.migrationStrategy}</code></> : null}
            </p>
          </Section>
          {detail ? (
            <details>
              <summary style={{ cursor: "pointer", fontSize: 12, color: "#475569" }}>
                {locale === "zh" ? "完整规则 JSON" : "Raw rule JSON"}
              </summary>
              <pre style={{ background: "#0f172a", color: "#e2e8f0", padding: 8, borderRadius: 4, overflow: "auto", fontSize: 11 }}>
                {JSON.stringify(detail.rule, null, 2)}
              </pre>
            </details>
          ) : null}
        </div>
      )}
    </div>
  );
}

function UsersQueuesTab({
  locale,
  users,
  queues,
  loading
}: {
  locale: Locale;
  users: CapabilityWorkflowUser[];
  queues: CapabilityWorkflowQueue[];
  loading: boolean;
}): JSX.Element {
  return (
    <div data-testid="users-queues-tab">
      <p style={{ color: "#475569", margin: "0 0 12px 0", maxWidth: 760 }}>
        {locale === "zh"
          ? "这里管理规则维护负责人、认证审核人、建议处理人和队列分派，不是账号中心，也不是主机用户管理。"
          : "This workspace manages rule maintainers, certification reviewers, suggestion triage, and queue assignment. It is not an account center or a host user manager."}
      </p>

      <section style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 8px 0", fontSize: 14 }}>Users / Maintainers</h3>
        {loading ? (
          <p style={{ color: "#64748b" }}>Loading...</p>
        ) : users.length === 0 ? (
          <p style={{ color: "#64748b" }}>{locale === "zh" ? "暂无成员" : "No users yet."}</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#f1f5f9" }}>
              <tr>
                <Th>User</Th>
                <Th>Role</Th>
                <Th>Assigned Capabilities</Th>
                <Th>Open Suggestions</Th>
                <Th>Open Backlog Items</Th>
                <Th>Review Load</Th>
                <Th>Last Active</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <Td><strong>{user.name}</strong><div style={{ color: "#64748b", fontSize: 11 }}>{user.id}</div></Td>
                  <Td>{user.role}</Td>
                  <Td>{user.assignedCapabilities.join(", ") || "-"}</Td>
                  <Td>{user.openSuggestions}</Td>
                  <Td>{user.openBacklogItems}</Td>
                  <Td>{user.reviewLoad}</Td>
                  <Td>{new Date(user.lastActive).toLocaleString()}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h3 style={{ margin: "0 0 8px 0", fontSize: 14 }}>Queues</h3>
        {loading ? (
          <p style={{ color: "#64748b" }}>Loading...</p>
        ) : queues.length === 0 ? (
          <p style={{ color: "#64748b" }}>{locale === "zh" ? "暂无队列" : "No queues yet."}</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#f1f5f9" }}>
              <tr>
                <Th>Queue</Th>
                <Th>Type</Th>
                <Th>Open Items</Th>
                <Th>Priority</Th>
                <Th>Owner Group</Th>
                <Th>Next Action</Th>
              </tr>
            </thead>
            <tbody>
              {queues.map((queue) => (
                <tr key={queue.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <Td><strong>{queue.name}</strong><div style={{ color: "#64748b", fontSize: 11 }}>{queue.status}</div></Td>
                  <Td>{queue.type}</Td>
                  <Td>{queue.openItems}</Td>
                  <Td>{queue.priority}</Td>
                  <Td>{queue.ownerGroup}</Td>
                  <Td>{queue.nextAction}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Section({ title, testId, children }: { title: string; testId: string; children: React.ReactNode }): JSX.Element {
  return (
    <section data-testid={testId} style={{ borderTop: "1px solid #e2e8f0", paddingTop: 8 }}>
      <h4 style={{ margin: "0 0 4px 0", fontSize: 12, color: "#475569" }}>{title}</h4>
      {children}
    </section>
  );
}

function DetailList({ label, items }: { label: string; items: string[] }): JSX.Element {
  if (!items || items.length === 0) {
    return <p style={{ margin: "2px 0", fontSize: 12, color: "#94a3b8" }}>{label}: —</p>;
  }
  return (
    <p style={{ margin: "2px 0", fontSize: 12 }}>
      <span style={{ color: "#64748b" }}>{label}:</span>{" "}
      {items.map((it, idx) => (
        <code key={idx} style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 3, marginRight: 4 }}>{it}</code>
      ))}
    </p>
  );
}

function Kvp({ obj }: { obj: Record<string, string[] | undefined> }): JSX.Element {
  const entries = Object.entries(obj).filter(([, v]) => v && v.length > 0);
  if (entries.length === 0) {
    return <p style={{ margin: "2px 0", fontSize: 12, color: "#94a3b8" }}>—</p>;
  }
  return (
    <ul style={{ margin: "2px 0", paddingLeft: 16, fontSize: 12 }}>
      {entries.map(([k, v]) => (
        <li key={k}>
          <strong>{k}:</strong>{" "}
          {(v ?? []).map((it, idx) => (
            <code key={idx} style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 3, marginRight: 4 }}>{it}</code>
          ))}
        </li>
      ))}
    </ul>
  );
}

// ── shared bits ───────────────────────────────────────────────────────

function buildUpgradePrompt(row: AdminCatalogRow, locale: Locale): string {
  const lines = [];
  lines.push(`# Full Migration Certification upgrade — ${row.id}`);
  lines.push("");
  lines.push(`capabilityKey: ${row.capabilityKey ?? "(none)"}`);
  lines.push(`category: ${row.category}`);
  lines.push(`current status: ${row.certification.status}`);
  lines.push("");
  lines.push("Missing requirements:");
  for (const r of row.certification.reasons) lines.push(`- ${r}`);
  lines.push("");
  lines.push(locale === "zh"
    ? "请按照 docs/FULL_MIGRATION_REQUIREMENTS.md 补齐上述项后运行 `npm run certification:check`。"
    : "Address each missing requirement per docs/FULL_MIGRATION_REQUIREMENTS.md, then run `npm run certification:check`.");
  return lines.join("\n");
}

function copyToClipboard(text: string): void {
  if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => undefined);
}

function FilterPills<T extends string>({
  value,
  onChange,
  options
}: {
  value: T;
  onChange: (next: T) => void;
  options: Array<{ value: T; label: string }>;
}): JSX.Element {
  return (
    <div style={{ display: "inline-flex", gap: 4 }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          style={{
            padding: "4px 10px",
            border: "1px solid #cbd5e1",
            borderRadius: 999,
            background: value === opt.value ? "#1e293b" : "#fff",
            color: value === opt.value ? "#fff" : "#1e293b",
            fontSize: 12
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SummaryStat({ label, value, icon, tone }: { label: string; value: number | string; icon: React.ReactNode; tone: "green" | "amber" | "slate" }): JSX.Element {
  const colors = tone === "green"
    ? { bg: "#ecfdf5", border: "#86efac", fg: "#065f46" }
    : tone === "amber"
      ? { bg: "#fffbeb", border: "#fcd34d", fg: "#92400e" }
      : { bg: "#f1f5f9", border: "#cbd5e1", fg: "#1e293b" };
  return (
    <div
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.fg,
        padding: "8px 12px",
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        gap: 8,
        minWidth: 120
      }}
    >
      {icon}
      <div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>{value}</div>
        <div style={{ fontSize: 11 }}>{label}</div>
      </div>
    </div>
  );
}

const summaryStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginBottom: 12
};

const panelStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 16,
  background: "#ffffff"
};

const compactLabelStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  color: "#475569",
  fontSize: 12
};

function Th({ children }: { children: React.ReactNode }): JSX.Element {
  return <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600, fontSize: 11, color: "#475569" }}>{children}</th>;
}

function Td({ children }: { children: React.ReactNode }): JSX.Element {
  return <td style={{ padding: "8px 10px", verticalAlign: "top" }}>{children}</td>;
}
