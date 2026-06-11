import React, { useEffect, useMemo, useState } from "react";
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
