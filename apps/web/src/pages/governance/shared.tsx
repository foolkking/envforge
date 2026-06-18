/**
 * governance/shared.tsx — shared types, constants, and presentational
 * helpers extracted from the former monolithic CapabilityRulesAdminPage.
 *
 * These are consumed by the individual governance tab components
 * (OverviewTab, RuleRegistryTab, StandardsTab, SuggestionInboxTab,
 * PackageIntegrationsTab, UsersQueuesTab). Keep this file free of any
 * tab-specific logic.
 */
import React from "react";
import { Box as BoxIcon, Cog, Database, Network, Server, Shield, type LucideIcon } from "lucide-react";
import { fetchCapabilityRequirements, type CatalogItemCertification, type CapabilityStandardSection } from "../../api";
import type { Locale } from "../../lib/types";

export interface AdminCatalogRow {
  id: string;
  capabilityKey?: string;
  name: string;
  category: string;
  certification: CatalogItemCertification;
}

export type CapabilityRequirementsDetail = Awaited<ReturnType<typeof fetchCapabilityRequirements>>;

export interface StandardProfileEditorState {
  id?: string;
  key: string;
  name: string;
  description: string;
  status: "draft" | "active" | "retired";
  sections: CapabilityStandardSection[];
}

export type WorkbenchTab = "overview" | "registry" | "standards" | "suggestions" | "integrations" | "users-queues";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  service: Server,
  network: Network,
  database: Database,
  container: BoxIcon,
  security: Shield,
  developer: Cog,
  runtime: Cog
};

export const REQUIREMENT_LABELS: Record<string, { zh: string; en: string }> = {
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

export function Section({ title, testId, children }: { title: string; testId: string; children: React.ReactNode }): JSX.Element {
  return (
    <section data-testid={testId} style={{ borderTop: "1px solid var(--ef-border)", paddingTop: 8 }}>
      <h4 style={{ margin: "0 0 4px 0", fontSize: 12, color: "var(--ef-muted)" }}>{title}</h4>
      {children}
    </section>
  );
}

export function DetailList({ label, items }: { label: string; items: string[] }): JSX.Element {
  if (!items || items.length === 0) {
    return <p style={{ margin: "2px 0", fontSize: 12, color: "var(--ef-muted-2)" }}>{label}: —</p>;
  }
  return (
    <p style={{ margin: "2px 0", fontSize: 12 }}>
      <span style={{ color: "var(--ef-muted)" }}>{label}:</span>{" "}
      {items.map((it, idx) => (
        <code key={idx} style={{ background: "var(--ef-surface-soft)", padding: "1px 4px", borderRadius: 3, marginRight: 4 }}>{it}</code>
      ))}
    </p>
  );
}

export function Kvp({ obj }: { obj: Record<string, string[] | undefined> }): JSX.Element {
  const entries = Object.entries(obj).filter(([, v]) => v && v.length > 0);
  if (entries.length === 0) {
    return <p style={{ margin: "2px 0", fontSize: 12, color: "var(--ef-muted-2)" }}>—</p>;
  }
  return (
    <ul style={{ margin: "2px 0", paddingLeft: 16, fontSize: 12 }}>
      {entries.map(([k, v]) => (
        <li key={k}>
          <strong>{k}:</strong>{" "}
          {(v ?? []).map((it, idx) => (
            <code key={idx} style={{ background: "var(--ef-surface-soft)", padding: "1px 4px", borderRadius: 3, marginRight: 4 }}>{it}</code>
          ))}
        </li>
      ))}
    </ul>
  );
}

export function buildUpgradePrompt(row: AdminCatalogRow, locale: Locale): string {
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
    ? "请按照 docs/catalog.md 补齐上述项后运行 `npm run certification:check`。"
    : "Address each missing requirement per docs/catalog.md, then run `npm run certification:check`.");
  return lines.join("\n");
}

export function copyToClipboard(text: string): void {
  if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => undefined);
}

export function FilterPills<T extends string>({
  value,
  onChange,
  options
}: {
  value: T;
  onChange: (next: T) => void;
  options: Array<{ value: T; label: string }>;
}): JSX.Element {
  return (
    <div style={{ display: "inline-flex", flexWrap: "wrap", gap: 4 }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          style={{
            padding: "4px 10px",
            border: "1px solid var(--ef-border)",
            borderRadius: 999,
            background: value === opt.value ? "var(--ef-text)" : "var(--ef-surface)",
            color: value === opt.value ? "var(--ef-surface)" : "var(--ef-text)",
            fontSize: 12
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function SummaryStat({ label, value, icon, tone }: { label: string; value: number | string; icon: React.ReactNode; tone: "green" | "amber" | "slate" }): JSX.Element {
  const colors = tone === "green"
    ? { bg: "var(--ef-success-soft)", border: "var(--ef-success)", fg: "var(--ef-success)" }
    : tone === "amber"
      ? { bg: "var(--ef-warning-soft)", border: "var(--ef-warning)", fg: "var(--ef-warning)" }
      : { bg: "var(--ef-surface-soft)", border: "var(--ef-border)", fg: "var(--ef-text)" };
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

export const summaryStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginBottom: 12
};

export const panelStyle: React.CSSProperties = {
  border: "1px solid var(--ef-border)",
  borderRadius: 8,
  padding: 16,
  background: "var(--ef-surface)"
};

export const compactLabelStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  color: "var(--ef-muted)",
  fontSize: 12
};

export function Th({ children }: { children: React.ReactNode }): JSX.Element {
  return <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600, fontSize: 11, color: "var(--ef-muted)" }}>{children}</th>;
}

export function Td({ children }: { children: React.ReactNode }): JSX.Element {
  return <td style={{ padding: "8px 10px", verticalAlign: "top" }}>{children}</td>;
}
