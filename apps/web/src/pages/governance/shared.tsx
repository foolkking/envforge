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
import { i18n } from "../../i18n";
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

export const REQUIREMENT_I18N_KEYS = {
  identity: "governance.requirements.identity",
  detection: "governance.requirements.detection",
  install: "governance.requirements.install",
  config: "governance.requirements.config",
  data: "governance.requirements.data",
  references: "governance.requirements.references",
  validate: "governance.requirements.validate",
  rollback: "governance.requirements.rollback",
  security: "governance.requirements.security",
  crossDistro: "governance.requirements.crossDistro",
  conflicts: "governance.requirements.conflicts",
  planIntegration: "governance.requirements.planIntegration",
  harness: "governance.requirements.harness"
} as const;

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
  const t = i18n.getFixedT(locale);
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
  lines.push(t("governance.requirements.upgradePromptInstruction"));
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
