import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, Folder, Inbox, Package as PackageIcon, RefreshCcw, XCircle } from "lucide-react";
import type { Locale } from "../../lib/types";
import { SummaryStat, Th, Td, summaryStyle, type AdminCatalogRow } from "./shared";

// ── Overview tab ──────────────────────────────────────────────────────

export function OverviewTab({
  locale, meta, coverage, rows, pendingSuggestions, integrationsMeta
}: {
  locale: Locale;
  meta: { total: number; certified: number; notReady: number } | null;
  coverage: number;
  rows: AdminCatalogRow[];
  pendingSuggestions: number;
  integrationsMeta: { total: number; withRule: number; withoutRule: number } | null;
}): JSX.Element {
  const { t } = useTranslation();
  const p0 = useMemo(() => rows.filter((r) => r.certification.status === "not-ready").slice(0, 5), [rows]);
  return (
    <div data-testid="overview-tab">
      <div className="rules-summary" style={summaryStyle}>
        <SummaryStat label={t("governance.common.certified")}
          value={meta?.certified ?? 0} icon={<CheckCircle2 size={16} aria-hidden />} tone="green" />
        <SummaryStat label={t("governance.common.notReady")}
          value={meta?.notReady ?? 0} icon={<XCircle size={16} aria-hidden />} tone="amber" />
        <SummaryStat label={t("governance.overview.coverage")}
          value={`${coverage}%`} icon={<RefreshCcw size={16} aria-hidden />} tone="slate" />
        <SummaryStat label={t("governance.common.total")}
          value={meta?.total ?? 0} icon={<Folder size={16} aria-hidden />} tone="slate" />
        <SummaryStat label={t("governance.overview.p0Backlog")}
          value={meta?.notReady ?? 0} icon={<AlertTriangle size={16} aria-hidden />} tone="amber" />
        <SummaryStat label={t("governance.overview.pendingSuggestions")}
          value={pendingSuggestions} icon={<Inbox size={16} aria-hidden />} tone="slate" />
        {integrationsMeta ? (
          <SummaryStat label={t("governance.overview.missingRule")}
            value={integrationsMeta.withoutRule} icon={<PackageIcon size={16} aria-hidden />} tone="amber" />
        ) : null}
      </div>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 15, margin: "0 0 8px 0" }}>
          {t("governance.overview.p0Title")}
        </h2>
        {p0.length === 0 ? (
          <p style={{ color: "var(--ef-muted)" }}>{t("governance.common.noBacklog")}</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "var(--ef-surface-soft)" }}>
              <tr><Th>{t("governance.common.capability")}</Th><Th>{t("governance.common.type")}</Th><Th>{t("governance.common.missing")}</Th></tr>
            </thead>
            <tbody>
              {p0.map((row) => (
                <tr key={row.id} style={{ borderBottom: "1px solid var(--ef-border)" }}>
                  <Td><strong>{row.name}</strong> <code style={{ color: "var(--ef-muted)" }}>{row.id}</code></Td>
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

      <section style={{ marginTop: 16, color: "var(--ef-muted)", fontSize: 12 }}>
        <p style={{ margin: 0 }}>
          {t("governance.overview.note")}
        </p>
      </section>
    </div>
  );
}
