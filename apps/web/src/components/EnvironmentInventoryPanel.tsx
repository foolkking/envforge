import React, { useMemo, useState } from "react";
import type { ExecutionTask } from "../api";
import type { Locale } from "../lib/types";
import type { LucideIcon } from "lucide-react";
import { RemoveCapabilityPanel } from "./RemoveCapabilityPanel";

const SOURCE_COLORS: Record<string, { bg: string; fg: string }> = {
  apt: { bg: "#fef3c7", fg: "#92400e" },
  "apt-manual": { bg: "#fde68a", fg: "#78350f" },
  rpm: { bg: "#fee2e2", fg: "#991b1b" },
  snap: { bg: "#e0e7ff", fg: "#3730a3" },
  flatpak: { bg: "#ede9fe", fg: "#5b21b6" },
  npm: { bg: "#dcfce7", fg: "#166534" },
  pip: { bg: "#f0fdf4", fg: "#14532d" },
  gem: { bg: "#fce7f3", fg: "#9d174d" },
  cargo: { bg: "#fff7ed", fg: "#9a3412" },
  "local-bin": { bg: "#f1f5f9", fg: "#334155" },
  opt: { bg: "#f8fafc", fg: "#475569" },
  "user-bin": { bg: "#f5f3ff", fg: "#6d28d9" },
  nvm: { bg: "#ecfdf5", fg: "#065f46" },
  pyenv: { bg: "#eff6ff", fg: "#1d4ed8" },
  rbenv: { bg: "#fef2f2", fg: "#b91c1c" },
  asdf: { bg: "#f0fdfa", fg: "#115e59" },
  sdkman: { bg: "#fefce8", fg: "#854d0e" },
  docker: { bg: "#dbeafe", fg: "#1e40af" },
  runtime: { bg: "#eff6ff", fg: "#1d4ed8" },
  system: { bg: "#f1f5f9", fg: "#475569" },
  container: { bg: "#dbeafe", fg: "#1e40af" },
  "local-app": { bg: "#fef3c7", fg: "#92400e" },
  systemd: { bg: "#e0e7ff", fg: "#3730a3" },
  srv: { bg: "#fef9c3", fg: "#854d0e" },
  "go-bin": { bg: "#ecfdf5", fg: "#065f46" },
  cron: { bg: "#fce7f3", fg: "#9d174d" },
  "systemd-timer": { bg: "#e0e7ff", fg: "#4338ca" }
};

function getSourceStyle(source: string) {
  return SOURCE_COLORS[source] ?? { bg: "#f8fafc", fg: "#475569" };
}

export interface InventoryRow {
  id: string;
  icon: LucideIcon;
  name: string;
  value: string;
  command: string;
  source?: string;
  /** Only set on apt source. "uncertain" rows are hidden by default in the software panel. */
  trust?: "user" | "uncertain";
}

export function EnvironmentInventoryPanel({
  title,
  rows,
  selected,
  onToggle,
  commandLabel,
  locale,
  panelKind,
  counts,
  authToken,
  connectionId
}: {
  title: string;
  rows: InventoryRow[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  commandLabel: string;
  locale: Locale;
  panelKind: "software" | "config";
  counts?: Record<string, number>;
  authToken?: string;
  connectionId?: string | null;
  onTaskUpdate?: (task: ExecutionTask) => void;
  pushLog?: (type: "info" | "success" | "error" | "cmd", text: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [showRemovePanel, setShowRemovePanel] = useState(false);

  const trustedRows = useMemo(() => {
    if (showAll || panelKind !== "software") return rows;
    return rows.filter((row) => row.trust !== "uncertain");
  }, [rows, showAll, panelKind]);
  const hiddenByTrust = rows.length - trustedRows.length;

  const sourceFilters = useMemo(() => {
    if (counts && Object.keys(counts).length > 0) {
      return Object.entries(counts)
        .filter(([key, val]) => val > 0 && key !== "total" && key !== "enabledServices" && key !== "runningServices")
        .sort((a, b) => b[1] - a[1]);
    }
    const map = new Map<string, number>();
    for (const row of rows) {
      const source = row.source ?? "other";
      map.set(source, (map.get(source) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [counts, rows]);

  const filterKeyToSource: Record<string, string> = { localBin: "local-bin", userBin: "user-bin" };

  const filteredRows = useMemo(() => {
    let result = trustedRows;
    if (activeFilter !== "all") {
      const matchSource = filterKeyToSource[activeFilter] ?? activeFilter;
      result = result.filter((row) => {
        const source = row.source ?? "";
        if (matchSource === "apt") return source === "apt" || source === "apt-manual";
        return source === matchSource;
      });
    }
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter((row) => row.name.toLowerCase().includes(query) || row.value.toLowerCase().includes(query));
    }
    return result;
  }, [trustedRows, activeFilter, searchQuery]);

  const MAX_DISPLAY = 200;
  const displayRows = filteredRows.slice(0, MAX_DISPLAY);
  const totalCount = counts?.total ?? rows.length;
  const hasMore = filteredRows.length > MAX_DISPLAY;

  return (
    <section className="panel-large">
      <div className="panel-heading">
        <h2>{title}</h2>
        <span className="panel-count">{totalCount}</span>
      </div>

      {panelKind === "software" && rows.length > 10 ? (
        <div className="inventory-filters">
          <div className="filter-pills">
            <button type="button" className={`filter-pill ${activeFilter === "all" ? "active" : ""}`} onClick={() => setActiveFilter("all")}>
              {locale === "zh" ? "全部" : "All"} ({totalCount})
            </button>
            {sourceFilters.slice(0, 12).map(([key, count]) => (
              <button
                key={key}
                type="button"
                className={`filter-pill ${activeFilter === key ? "active" : ""}`}
                onClick={() => setActiveFilter(activeFilter === key ? "all" : key)}
              >
                <span className="filter-pill-dot" style={{ background: getSourceStyle(filterKeyToSource[key] ?? key).fg }} />
                {key} ({count})
              </button>
            ))}
          </div>
          <input
            className="inventory-search"
            type="text"
            placeholder={locale === "zh" ? "搜索环境证据" : "Search environment evidence"}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          {hiddenByTrust > 0 ? (
            <label
              className="inventory-toggle"
              title={locale === "zh"
                ? "默认只显示更可能代表用户意图的能力证据。开启后会显示所有采集到的包和依赖证据。"
                : "By default EnvForge shows evidence that is more likely to represent user intent. Toggle on to inspect all package and dependency evidence."}
            >
              <input type="checkbox" checked={showAll} onChange={(event) => setShowAll(event.target.checked)} />
              <span>{locale === "zh" ? `显示全部证据（另有 ${hiddenByTrust} 项）` : `Show all evidence (${hiddenByTrust} hidden)`}</span>
            </label>
          ) : null}
        </div>
      ) : null}

      {panelKind === "software" ? (
        <div className="filter-status" style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span>
            {locale === "zh"
              ? "这里是环境证据清单。移除软件能力必须进入能力移除计划，而不是直接卸载任意系统包。"
              : "This is environment evidence. Removal must be handled through a reviewed Remove Capability Plan, not direct package uninstall."}
          </span>
          {selected.size > 0 && authToken && connectionId ? (
            <button
              type="button"
              className="conn-btn"
              onClick={() => setShowRemovePanel((value) => !value)}
            >
              {locale === "zh"
                ? `创建移除计划（${selected.size}）`
                : `Create Remove Plan (${selected.size})`}
            </button>
          ) : null}
        </div>
      ) : null}

      {showRemovePanel && panelKind === "software" && authToken && connectionId ? (
        <RemoveCapabilityPanel
          authToken={authToken}
          connectionId={connectionId}
          packages={Array.from(selected)
            .map((id) => rows.find((row) => row.id === id))
            .filter((row): row is InventoryRow => Boolean(row))
            .map((row) => row.value || row.name)}
          source={(() => {
            const first = Array.from(selected)
              .map((id) => rows.find((row) => row.id === id))
              .find((row): row is InventoryRow => Boolean(row));
            const src = first?.source ?? "apt";
            // Map our internal labels back to package-manager names the API
            // understands. Anything we cannot map falls back to apt so the
            // remove plan generation does not crash; the UI shows it clearly.
            return ["apt", "dnf", "yum", "pacman", "apk", "snap", "flatpak", "npm", "pip", "pipx", "gem", "cargo"].includes(src) ? src : "apt";
          })()}
          locale={locale}
          onClose={() => setShowRemovePanel(false)}
        />
      ) : null}

      {(activeFilter !== "all" || searchQuery) ? (
        <div className="filter-status">
          {locale === "zh" ? `显示 ${filteredRows.length} / ${totalCount} 项` : `Showing ${filteredRows.length} / ${totalCount} items`}
          <button type="button" className="filter-clear" onClick={() => { setActiveFilter("all"); setSearchQuery(""); }}>
            x {locale === "zh" ? "清除筛选" : "Clear filter"}
          </button>
        </div>
      ) : null}

      <div className="inventory-list">
        {displayRows.map((row) => {
          const Icon = row.icon;
          const isExpanded = expandedId === row.id;
          const srcStyle = getSourceStyle(row.source ?? "system");
          return (
            <div key={row.id} className="inventory-item-wrap">
              <div className={`inventory-item ${isExpanded ? "expanded" : ""}`}>
                {panelKind === "software" ? (
                  <input checked={selected.has(row.id)} onChange={() => onToggle(row.id)} type="checkbox" />
                ) : null}
                <Icon aria-hidden />
                <span>
                  <strong>{row.name}</strong>
                  <small style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ background: srcStyle.bg, color: srcStyle.fg, borderRadius: 4, fontSize: 10, fontWeight: 700, padding: "1px 5px" }}>{row.source ?? "system"}</span>
                    <span style={{ color: "#64748b" }}>{row.value}</span>
                  </small>
                </span>
                <div className="inventory-item-actions">
                  <button
                    className="inv-action-btn"
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : row.id)}
                    title={locale === "zh" ? "详情" : "Details"}
                  >
                    {isExpanded ? "^" : "v"}
                  </button>
                </div>
              </div>
              {isExpanded ? (
                <div className="inventory-detail">
                  <div className="inv-detail-grid">
                    <div className="inv-detail-row"><span>{locale === "zh" ? "名称" : "Name"}</span><strong>{row.name}</strong></div>
                    <div className="inv-detail-row"><span>{locale === "zh" ? "值" : "Value"}</span><span>{row.value}</span></div>
                    <div className="inv-detail-row"><span>{locale === "zh" ? "来源" : "Source"}</span><span style={{ background: srcStyle.bg, color: srcStyle.fg, borderRadius: 4, padding: "1px 6px", fontSize: 12, fontWeight: 600 }}>{row.source}</span></div>
                    {row.command ? <div className="inv-detail-row"><span>{commandLabel}</span><code>{row.command}</code></div> : null}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
        {hasMore ? (
          <div className="inventory-more-hint">
            {locale === "zh" ? `还有 ${filteredRows.length - MAX_DISPLAY} 项未显示，请使用搜索或筛选缩小范围` : `${filteredRows.length - MAX_DISPLAY} more items not shown.`}
          </div>
        ) : null}
      </div>
    </section>
  );
}
