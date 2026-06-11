import { useMemo } from "react";
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
            ? "提示：普通用户的 Build 只展示已认证能力，认证升级请参考 docs/catalog.md。"
            : "Note: end-user Build only shows certified capabilities. Certification upgrades follow docs/catalog.md."}
        </p>
      </section>
    </div>
  );
}
