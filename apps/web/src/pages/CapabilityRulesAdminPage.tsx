/**
 * CapabilityRulesAdminPage.tsx — Capability Admin workbench.
 *
 * Admin-only page that governs the catalog rule registry, drives
 * Full Migration Certification, processes user suggestions, and
 * surfaces rule-level package integrations.
 *
 * Information architecture (6 tabs):
 *   1. Overview            — counts, coverage, P0 backlog, pending suggestions
 *   2. Rule Registry       — searchable table of every capability + status
 *   3. Standards           — versioned standards layer, profiles, drafts
 *   4. Suggestion Inbox    — user-submitted suggestions with status workflow
 *   5. Package Integrations — rule-level package / service / config maps
 *   6. Users & Queues      — maintainers, reviewers, queue assignment
 *
 * Auth gating happens on two levels:
 *   1. The route is gated by `authUser.role === "admin"` in main.tsx.
 *   2. Every API endpoint this page calls returns 403 to non-admins.
 *
 * This page is NEVER rendered for end users — Build is their entrypoint.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  BookOpen,
  Inbox,
  LayoutDashboard,
  Package as PackageIcon,
  Shield,
  Table as TableIcon,
  UsersRound,
} from "lucide-react";
import {
  fetchCapabilityRulesAdmin,
  fetchAdminSuggestions,
  fetchCapabilityWorkflowQueues,
  fetchCapabilityWorkflowUsers,
  processAdminSuggestion,
  fetchPackageIntegrations,
  listCapabilityRules,
  deleteCapabilityRule,
  generatePromotionBundle,
  setRulePromotion,
  type AdminSuggestionRecord,
  type AdminCatalogInput,
  type CapabilityWorkflowQueue,
  type CapabilityWorkflowUser,
  type PackageIntegrationRow,
  type RuntimeRuleOverride,
  type PromotionBundle
} from "../api";
import type { Locale } from "../lib/types";
import {
  CATEGORY_ICONS,
  type AdminCatalogRow,
  type CapabilityRequirementsDetail,
  type StandardProfileEditorState,
  type WorkbenchTab
} from "./governance/shared";
import { OverviewTab } from "./governance/OverviewTab";
import { RuleRegistryTab } from "./governance/RuleRegistryTab";
import { StandardsTab } from "./governance/StandardsTab";
import { SuggestionInboxTab } from "./governance/SuggestionInboxTab";
import { PackageIntegrationsTab } from "./governance/PackageIntegrationsTab";
import { UsersQueuesTab } from "./governance/UsersQueuesTab";
import { CapabilityEditorDrawer } from "../components/CapabilityEditorDrawer";
import { ArchetypeRuleDrawer } from "../components/ArchetypeRuleDrawer";
import { PromotionBundleModal } from "../components/PromotionBundleModal";
import { TabButton } from "../components/ui/TabButton";

const CATALOG_CATEGORIES = new Set(["runtime", "developer", "database", "container", "security", "network", "service"]);

interface Props {
  authToken: string;
  isAdmin: boolean;
  locale: Locale;
}

export function CapabilityRulesAdminPage({ authToken, isAdmin, locale }: Props): JSX.Element {
  const { t } = useTranslation();
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

  // Capability editor drawer (create / edit). `fromSuggestionId` ties a save
  // back to the originating suggestion so it can be marked accepted.
  const [editor, setEditor] = useState<{
    mode: "create" | "edit";
    catalogId?: string;
    prefill?: Partial<AdminCatalogInput>;
    fromSuggestionId?: string;
  } | null>(null);

  // Runtime detection rules (Phase B2): UI-authored rules that extend
  // migrate detection only (never certify). `ruleDrawer` opens the editor.
  const [runtimeRules, setRuntimeRules] = useState<RuntimeRuleOverride[]>([]);
  const [ruleDrawer, setRuleDrawer] = useState<{ existing?: RuntimeRuleOverride } | null>(null);
  const [bundleModal, setBundleModal] = useState<PromotionBundle | null>(null);

  async function reloadRuntimeRules() {
    const res = await listCapabilityRules(authToken);
    setRuntimeRules(res.rules);
  }

  async function reloadRows() {
    const response = await fetchCapabilityRulesAdmin(authToken);
    setRows(response.items);
    setMeta(response.meta);
  }

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
    if (tab === "registry" && runtimeRules.length === 0) {
      listCapabilityRules(authToken)
        .then((res) => { if (!abort) setRuntimeRules(res.rules); })
        .catch(() => { /* registry still usable without runtime rules */ });
    }
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
        <h1 style={{ marginTop: 0 }}>{t("governance.admin.deniedTitle")}</h1>
        <p style={{ color: "var(--ef-danger)" }}>
          {t("governance.admin.deniedMessage")}
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
          <BookOpen aria-hidden /> {t("governance.admin.title")}
        </h1>
        <p style={{ color: "var(--ef-muted)", margin: "4px 0 0 0", maxWidth: 760 }}>
          {t("governance.admin.intro")}
        </p>
      </header>

      <nav className="capability-admin-tabs" role="tablist" data-testid="capability-admin-tabs"
        style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--ef-border)", marginBottom: 16 }}>
        <TabButton active={tab === "overview"} onClick={() => setTab("overview")}
          icon={<LayoutDashboard size={14} aria-hidden />} testId="tab-overview"
          label={t("governance.admin.tabs.overview")} />
        <TabButton active={tab === "registry"} onClick={() => setTab("registry")}
          icon={<TableIcon size={14} aria-hidden />} testId="tab-registry"
          label={t("governance.admin.tabs.registry")} />
        <TabButton active={tab === "standards"} onClick={() => setTab("standards")}
          icon={<Shield size={14} aria-hidden />} testId="tab-standards"
          label={t("governance.admin.tabs.standards")} />
        <TabButton active={tab === "suggestions"} onClick={() => setTab("suggestions")}
          icon={<Inbox size={14} aria-hidden />} testId="tab-suggestions"
          label={t("governance.admin.tabs.suggestions")}
          badge={pendingCount > 0 ? pendingCount : undefined} />
        <TabButton active={tab === "integrations"} onClick={() => setTab("integrations")}
          icon={<PackageIcon size={14} aria-hidden />} testId="tab-integrations"
          label={t("governance.admin.tabs.integrations")} />
        <TabButton active={tab === "users-queues"} onClick={() => setTab("users-queues")}
          icon={<UsersRound size={14} aria-hidden />} testId="tab-users-queues"
          label={t("governance.admin.tabs.usersQueues")}
          badge={workflowQueues.reduce((sum, queue) => sum + queue.openItems, 0) || undefined} />
      </nav>

      {error ? (
        <div style={{ background: "var(--ef-danger-soft)", color: "var(--ef-danger)", padding: 12, borderRadius: 6, marginBottom: 12 }}>
          <AlertTriangle aria-hidden /> {error}
        </div>
      ) : null}

      {tab === "overview" ? (
        <OverviewTab locale={locale} meta={meta} coverage={coverage} rows={rows}
          pendingSuggestions={pendingCount} integrationsMeta={integrationsMeta} />
      ) : null}

      {tab === "registry" ? (
        <RuleRegistryTab
          locale={locale}
          rows={rows}
          onCreate={() => setEditor({ mode: "create" })}
          onEdit={(catalogId) => setEditor({ mode: "edit", catalogId })}
          runtimeRules={runtimeRules}
          onNewDetectionRule={() => setRuleDrawer({})}
          onEditDetectionRule={(rule) => setRuleDrawer({ existing: rule })}
          onDeleteDetectionRule={async (id) => {
            try {
              await deleteCapabilityRule(authToken, id);
              await reloadRuntimeRules();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Delete rule failed");
            }
          }}
          onPromoteDetectionRule={async (rule) => {
            try {
              const res = await generatePromotionBundle(authToken, rule.id);
              setBundleModal(res.bundle);
              await reloadRuntimeRules();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Generate bundle failed");
            }
          }}
          onSetPromotion={async (id, patch) => {
            try {
              await setRulePromotion(authToken, id, patch);
              await reloadRuntimeRules();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Update promotion failed");
            }
          }}
        />
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
          onAuthorFromSuggestion={(s) => {
            if (s.catalogId) {
              setEditor({ mode: "edit", catalogId: s.catalogId, fromSuggestionId: s.id });
            } else {
              setEditor({
                mode: "create",
                fromSuggestionId: s.id,
                prefill: {
                  name: s.nameZh || s.nameEn,
                  nameEn: s.nameEn || s.nameZh,
                  category: s.category && CATALOG_CATEGORIES.has(s.category) ? (s.category as AdminCatalogInput["category"]) : undefined,
                  summary: s.remark ?? "",
                  playbookYaml: s.playbookYaml ?? undefined,
                  guideMarkdown: s.guideMarkdown ?? undefined
                }
              });
            }
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

      {editor ? (
        <CapabilityEditorDrawer
          authToken={authToken}
          locale={locale}
          mode={editor.mode}
          catalogId={editor.catalogId}
          prefill={editor.prefill}
          onClose={() => setEditor(null)}
          onGotoStandards={(id) => { setEditor(null); setTab("standards"); void id; }}
          onSaved={async (savedId) => {
            const originatingSuggestion = editor.fromSuggestionId;
            setEditor(null);
            try {
              await reloadRows();
              if (originatingSuggestion) {
                await processAdminSuggestion(authToken, originatingSuggestion, "accepted", `Authored capability ${savedId}`);
                const res = await fetchAdminSuggestions(authToken, { limit: 50 });
                setSuggestions(res.suggestions);
              }
            } catch (err) {
              setError(err instanceof Error ? err.message : "Refresh failed");
            }
          }}
        />
      ) : null}

      {ruleDrawer ? (
        <ArchetypeRuleDrawer
          authToken={authToken}
          locale={locale}
          existing={ruleDrawer.existing ?? null}
          onClose={() => setRuleDrawer(null)}
          onSaved={async () => {
            setRuleDrawer(null);
            try {
              await reloadRuntimeRules();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Refresh failed");
            }
          }}
        />
      ) : null}

      {bundleModal ? (
        <PromotionBundleModal
          bundle={bundleModal}
          locale={locale}
          onClose={() => setBundleModal(null)}
        />
      ) : null}
    </div>
  );
}
