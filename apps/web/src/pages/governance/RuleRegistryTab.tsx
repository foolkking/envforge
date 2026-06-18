import React, { useMemo, useState } from "react";
import { BookOpen, Box as BoxIcon, CheckCircle2, Cog, Database, FileText, Hand, Key, Network, RefreshCcw, Search, Server, Shield, XCircle, AlertTriangle } from "lucide-react";
import type { Locale } from "../../lib/types";
import type { RuntimeRuleOverride, RulePromotionStatus } from "../../api";
import { CATEGORY_ICONS, REQUIREMENT_LABELS, FilterPills, Th, Td, buildUpgradePrompt, copyToClipboard, type AdminCatalogRow } from "./shared";
import { ReadinessChip, ReadinessScorecard } from "../../components/ReadinessScorecard";
import { PromotionBadge, PromotionControls } from "../../components/PromotionControls";
import { confirmDialog } from "../../lib/dialogs";

// ── Rule Registry tab ─────────────────────────────────────────────────

export function RuleRegistryTab({
  locale, rows, onCreate, onEdit,
  runtimeRules = [], onNewDetectionRule, onEditDetectionRule, onDeleteDetectionRule, onPromoteDetectionRule, onSetPromotion
}: {
  locale: Locale;
  rows: AdminCatalogRow[];
  onCreate?: () => void;
  onEdit?: (id: string) => void;
  runtimeRules?: RuntimeRuleOverride[];
  onNewDetectionRule?: () => void;
  onEditDetectionRule?: (rule: RuntimeRuleOverride) => void;
  onDeleteDetectionRule?: (id: string) => void;
  onPromoteDetectionRule?: (rule: RuntimeRuleOverride) => void;
  onSetPromotion?: (id: string, patch: { status?: RulePromotionStatus; prUrl?: string; notes?: string }) => void | Promise<void>;
}): JSX.Element {
  const [statusFilter, setStatusFilter] = useState<"all" | "certified" | "not-ready">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [openReadinessId, setOpenReadinessId] = useState<string | null>(null);

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
      <div className="rules-filters" style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "0 0 12px 0", alignItems: "center" }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "var(--ef-surface)", border: "1px solid var(--ef-border)", borderRadius: 6, padding: "2px 8px" }}>
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
        {onCreate ? (
          <button
            type="button"
            onClick={onCreate}
            data-testid="registry-new-capability"
            className="primary-action"
            style={{ marginLeft: "auto", minHeight: 34, padding: "0 14px" }}
          >
            {locale === "zh" ? "+ 新建能力" : "+ New capability"}
          </button>
        ) : null}
        {onNewDetectionRule ? (
          <button
            type="button"
            onClick={onNewDetectionRule}
            data-testid="registry-new-detection-rule"
            className="secondary-action"
            style={{ minHeight: 34, padding: "0 14px", ...(onCreate ? {} : { marginLeft: "auto" }) }}
          >
            {locale === "zh" ? "+ 检测规则(原型)" : "+ Detection rule"}
          </button>
        ) : null}
      </div>

      {runtimeRules.length > 0 ? (
        <div data-testid="runtime-rules" style={{ margin: "0 0 16px 0", border: "1px solid var(--ef-border)", borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            {locale === "zh" ? "运行时检测规则" : "Runtime detection rules"}
            <span className="ui-badge ui-badge-warn ui-badge-sm" style={{ marginLeft: 8 }}>
              {locale === "zh" ? "检测扩展 · 未认证" : "Detection-only · uncertified"}
            </span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "var(--ef-surface-soft)" }}>
              <tr>
                <Th>{locale === "zh" ? "名称" : "Name"}</Th>
                <Th>capabilityKey</Th>
                <Th>{locale === "zh" ? "类目" : "Category"}</Th>
                <Th>{locale === "zh" ? "就绪度" : "Readiness"}</Th>
                <Th>{locale === "zh" ? "晋升" : "Promotion"}</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {runtimeRules.map((r) => (
                <React.Fragment key={r.id}>
                  <tr style={{ borderBottom: "1px solid var(--ef-border)" }} data-testid={`runtime-rule-${r.id}`}>
                    <Td><strong>{r.rule.displayName || r.id}</strong><div style={{ color: "var(--ef-muted)", fontSize: 11 }}>{r.id}</div></Td>
                    <Td><code>{r.rule.capabilityKey}</code></Td>
                    <Td>{r.rule.category}</Td>
                    <Td>{r.readiness ? <ReadinessChip readiness={r.readiness} locale={locale} /> : <span style={{ color: "var(--ef-muted)" }}>—</span>}</Td>
                    <Td><PromotionBadge status={r.promotion?.status ?? "detection-only"} locale={locale} /></Td>
                    <Td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {r.readiness ? <button type="button" style={{ padding: "2px 8px" }} data-testid={`runtime-rule-readiness-${r.id}`} onClick={() => setOpenReadinessId(openReadinessId === r.id ? null : r.id)}>{openReadinessId === r.id ? (locale === "zh" ? "收起" : "Hide") : (locale === "zh" ? "就绪度" : "Readiness")}</button> : null}
                        {onPromoteDetectionRule ? <button type="button" style={{ padding: "2px 8px" }} data-testid={`runtime-rule-promote-${r.id}`} onClick={() => onPromoteDetectionRule(r)}>{locale === "zh" ? "晋升包" : "Promote"}</button> : null}
                        {onEditDetectionRule ? <button type="button" style={{ padding: "2px 8px" }} onClick={() => onEditDetectionRule(r)}>{locale === "zh" ? "编辑" : "Edit"}</button> : null}
                        {onDeleteDetectionRule ? <button type="button" style={{ padding: "2px 8px", color: "var(--ef-danger)" }} onClick={async () => { if (await confirmDialog({ message: locale === "zh" ? `删除检测规则 ${r.id}?` : `Delete rule ${r.id}?`, danger: true, confirmLabel: locale === "zh" ? "删除" : "Delete", cancelLabel: locale === "zh" ? "取消" : "Cancel" })) onDeleteDetectionRule(r.id); }}>{locale === "zh" ? "删除" : "Delete"}</button> : null}
                      </div>
                    </Td>
                  </tr>
                  {openReadinessId === r.id && r.readiness ? (
                    <tr>
                      <td colSpan={6} style={{ background: "var(--ef-surface-soft)", padding: 12 }}>
                        <ReadinessScorecard readiness={r.readiness} locale={locale} />
                        {onSetPromotion ? (
                          <PromotionControls rule={r} locale={locale} onSetPromotion={onSetPromotion} onDelete={onDeleteDetectionRule} />
                        ) : null}
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <table className="rules-table" data-testid="rules-table"
        style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead style={{ background: "var(--ef-surface-soft)" }}>
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
                <tr style={{ borderBottom: "1px solid var(--ef-border)" }} data-testid={`rules-row-${row.id}`}>
                  <Td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Icon size={16} aria-hidden />
                      <strong>{row.name}</strong>
                    </div>
                    <div style={{ color: "var(--ef-muted)", fontSize: 11 }}>{row.id}</div>
                  </Td>
                  <Td><code>{row.capabilityKey ?? "—"}</code></Td>
                  <Td>{row.category}</Td>
                  <Td>
                    <span
                      data-testid={`rules-status-${row.id}`}
                      style={{
                        background: status === "certified" ? "var(--ef-success-soft)" : "var(--ef-warning-soft)",
                        color: status === "certified" ? "var(--ef-success)" : "var(--ef-warning)",
                        border: `1px solid ${status === "certified" ? "var(--ef-success)" : "var(--ef-warning)"}`,
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
                      ? <span style={{ color: "var(--ef-muted)" }}>—</span>
                      : (
                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                          {row.certification.reasons.slice(0, 3).map((r) => <li key={r}>{r}</li>)}
                          {row.certification.reasons.length > 3 ? <li>…+{row.certification.reasons.length - 3}</li> : null}
                        </ul>
                      )}
                  </Td>
                  <Td>
                    <div style={{ display: "flex", gap: 6 }}>
                      {onEdit ? (
                        <button
                          type="button"
                          onClick={() => onEdit(row.id)}
                          data-testid={`rules-edit-${row.id}`}
                          style={{ padding: "2px 8px" }}
                        >
                          {locale === "zh" ? "编辑" : "Edit"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setOpenRowId(openRowId === row.id ? null : row.id)}
                        style={{ padding: "2px 8px" }}
                      >
                        {openRowId === row.id ? (locale === "zh" ? "收起" : "Hide") : (locale === "zh" ? "查看" : "View")}
                      </button>
                    </div>
                  </Td>
                </tr>
                {openRowId === row.id ? (
                  <tr>
                    <td colSpan={6} style={{ background: "var(--ef-surface-soft)", padding: 12 }}>
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

function RuleDetailDrawer({ row, locale }: { row: AdminCatalogRow; locale: Locale }): JSX.Element {
  const reasons = row.certification.reasons;
  const status = row.certification.status;
  const checklist = ["identity", "detection", "install", "config", "data", "references", "validate", "rollback", "security", "crossDistro", "conflicts", "planIntegration", "harness"];
  return (
    <div data-testid={`rule-drawer-${row.id}`}>
      <h3 style={{ margin: "0 0 8px 0" }}>{row.name}</h3>
      <p style={{ margin: "0 0 8px 0", color: "var(--ef-muted)" }}>
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
              {missing ? <XCircle size={14} color="var(--ef-warning)" aria-hidden /> : <CheckCircle2 size={14} color="var(--ef-success)" aria-hidden />}
              {icon}
              <span style={{ color: missing ? "var(--ef-warning)" : "var(--ef-success)" }}>{label}</span>
            </li>
          );
        })}
      </ul>

      {status === "not-ready" ? (
        <div style={{ background: "var(--ef-warning-soft)", border: "1px solid var(--ef-warning)", padding: 8, borderRadius: 6 }}>
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
