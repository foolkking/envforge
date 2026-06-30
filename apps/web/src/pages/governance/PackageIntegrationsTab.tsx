import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import {
  fetchPackageIntegrationDetail,
  type PackageIntegrationRow,
  type PackageIntegrationDetail
} from "../../api";
import type { Locale } from "../../lib/types";
import { FilterPills, Section, Kvp, DetailList, Th, Td, type AdminCatalogRow } from "./shared";

// ── Package Integrations tab ──────────────────────────────────────────

export function PackageIntegrationsTab({
  locale, rows, meta, loading, authToken
}: {
  locale: Locale;
  rows: PackageIntegrationRow[];
  meta: { total: number; withRule: number; withoutRule: number } | null;
  loading: boolean;
  authToken: string;
}): JSX.Element {
  const { t } = useTranslation();
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
      <p style={{ color: "var(--ef-muted)", margin: "0 0 12px 0", maxWidth: 720 }}>
        {t("governance.integrations.intro")}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "0 0 12px 0" }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "var(--ef-surface)", border: "1px solid var(--ef-border)", borderRadius: 6, padding: "2px 8px" }}>
          <Search size={14} aria-hidden />
          <input
            type="search"
            placeholder={t("governance.integrations.searchPlaceholder")}
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
            { value: "all", label: t("governance.common.all") },
            { value: "with-rule", label: t("governance.common.withRule") },
            { value: "without-rule", label: t("governance.common.missingRule") }
          ]}
        />
        {meta ? (
          <span style={{ color: "var(--ef-muted)", fontSize: 12, display: "flex", alignItems: "center" }}>
            {`${t("governance.integrations.meta.withRule")} ${meta.withRule} / ${t("governance.integrations.meta.missing")} ${meta.withoutRule} / ${t("governance.integrations.meta.total")} ${meta.total}`}
          </span>
        ) : null}
      </div>

      {loading ? (
        <p style={{ color: "var(--ef-muted)" }}>{t("governance.common.loading")}</p>
      ) : (
        <div className="integrations-grid">
          <div style={{ border: "1px solid var(--ef-border)", borderRadius: 6, maxHeight: 560, overflow: "auto" }} data-testid="integrations-list">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead style={{ background: "var(--ef-surface-soft)", position: "sticky", top: 0 }}>
                <tr>
                  <Th>{t("governance.common.capability")}</Th>
                  <Th>{t("governance.common.rule")}</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}
                      data-testid={`integration-row-${row.id}`}
                      onClick={() => setActiveId(row.id)}
                      style={{ borderBottom: "1px solid var(--ef-border)", cursor: "pointer", background: row.id === activeId ? "var(--ef-info-soft)" : undefined }}>
                    <Td>
                      <strong>{row.name}</strong>
                      <div style={{ color: "var(--ef-muted)", fontSize: 11 }}>{row.id}</div>
                    </Td>
                    <Td>
                      {row.hasRule ? (
                        <span style={{ background: "var(--ef-success-soft)", color: "var(--ef-success)", padding: "1px 6px", borderRadius: 999, fontSize: 11 }}>
                          {t("governance.integrations.withRuleShort")}
                        </span>
                      ) : (
                        <span style={{ background: "var(--ef-warning-soft)", color: "var(--ef-warning)", padding: "1px 6px", borderRadius: 999, fontSize: 11 }}>
                          {t("governance.integrations.missingShort")}
                        </span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ border: "1px solid var(--ef-border)", borderRadius: 6, padding: 12 }} data-testid="integration-detail">
            {!activeRow ? (
              <p style={{ color: "var(--ef-muted)" }}>
                {t("governance.integrations.pickCapability")}
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
  const { t } = useTranslation();
  const summary = row.ruleSummary;
  return (
    <div>
      <h3 style={{ margin: "0 0 4px 0" }}>{row.name}</h3>
      <p style={{ margin: "0 0 12px 0", color: "var(--ef-muted)", fontSize: 12 }}>
        <code>{row.id}</code> · <code>{row.capabilityKey ?? "—"}</code> · {row.category}
      </p>

      {!row.hasRule || !summary ? (
        <div style={{ background: "var(--ef-warning-soft)", border: "1px solid var(--ef-warning)", padding: 12, borderRadius: 6 }}>
          <strong>{t("governance.integrations.missingCatalogRule")}</strong>
          <p style={{ margin: "4px 0 0 0", fontSize: 12 }}>
            {t("governance.integrations.missingCatalogRuleBody")}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          <Section title={t("governance.integrations.packageMap")} testId="package-map">
            <Kvp obj={summary.packageMap} />
          </Section>
          <Section title={t("governance.integrations.serviceMap")} testId="service-map">
            <Kvp obj={summary.serviceMap} />
          </Section>
          <Section title={t("governance.integrations.detection")} testId="detection">
            <DetailList label="binaries" items={summary.binaries} />
            <DetailList label="systemd" items={summary.systemd} />
            <DetailList label="ports" items={summary.ports.map(String)} />
          </Section>
          <Section title={t("governance.integrations.configPaths")} testId="config-paths">
            <DetailList label="files" items={summary.configFiles} />
            <DetailList label="globs" items={summary.configGlobs} />
            <DetailList label="secret patterns" items={summary.secretPatterns} />
          </Section>
          <Section title={t("governance.integrations.hooks")} testId="hooks">
            <DetailList label="data paths" items={summary.dataPaths} />
            <DetailList label="validate" items={summary.validate} />
            <DetailList label="restartServices" items={summary.restartServices} />
            <p style={{ margin: "4px 0", fontSize: 12 }}>
              <span style={{ color: "var(--ef-muted)" }}>{t("governance.integrations.dataStrategy")}:</span> <code>{summary.dataStrategy}</code>
              {summary.migrationStrategy ? <> · <span style={{ color: "var(--ef-muted)" }}>{t("governance.integrations.migrationStrategy")}:</span> <code>{summary.migrationStrategy}</code></> : null}
            </p>
          </Section>
          {detail ? (
            <details>
              <summary style={{ cursor: "pointer", fontSize: 12, color: "var(--ef-muted)" }}>
                {t("governance.integrations.rawJson")}
              </summary>
              <pre style={{ background: "var(--ef-text)", color: "var(--ef-border)", padding: 8, borderRadius: 4, overflow: "auto", fontSize: 11 }}>
                {JSON.stringify(detail.rule, null, 2)}
              </pre>
            </details>
          ) : null}
        </div>
      )}
    </div>
  );
}
