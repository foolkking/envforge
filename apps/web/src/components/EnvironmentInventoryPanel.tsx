import { Button } from "./ui/Button";
import { FilterPill } from "./ui/FilterPill";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ExecutionTask } from "../api";
import type { Locale } from "../lib/types";
import type { LucideIcon } from "lucide-react";
import { RemoveCapabilityPanel } from "./RemoveCapabilityPanel";

const SOURCE_COLORS: Record<string, { bg: string; fg: string }> = {
  apt: { bg: "var(--ef-warning-soft)", fg: "var(--ef-warning)" },
  "apt-manual": { bg: "var(--ef-warning)", fg: "#78350f" },
  rpm: { bg: "var(--ef-danger-soft)", fg: "var(--ef-danger)" },
  snap: { bg: "#e0e7ff", fg: "#3730a3" },
  flatpak: { bg: "#ede9fe", fg: "#5b21b6" },
  npm: { bg: "var(--ef-success-soft)", fg: "var(--ef-success)" },
  pip: { bg: "var(--ef-success-soft)", fg: "#14532d" },
  gem: { bg: "#fce7f3", fg: "#9d174d" },
  cargo: { bg: "#fff7ed", fg: "#9a3412" },
  "local-bin": { bg: "var(--ef-surface-soft)", fg: "var(--ef-text)" },
  opt: { bg: "var(--ef-surface-soft)", fg: "var(--ef-muted)" },
  "user-bin": { bg: "#f5f3ff", fg: "#6d28d9" },
  nvm: { bg: "var(--ef-success-soft)", fg: "var(--ef-success)" },
  pyenv: { bg: "var(--ef-info-soft)", fg: "var(--ef-info)" },
  rbenv: { bg: "var(--ef-danger-soft)", fg: "var(--ef-danger)" },
  asdf: { bg: "#f0fdfa", fg: "#115e59" },
  sdkman: { bg: "#fefce8", fg: "#854d0e" },
  docker: { bg: "var(--ef-info-soft)", fg: "#1e40af" },
  runtime: { bg: "var(--ef-info-soft)", fg: "var(--ef-info)" },
  system: { bg: "var(--ef-surface-soft)", fg: "var(--ef-muted)" },
  container: { bg: "var(--ef-info-soft)", fg: "#1e40af" },
  "local-app": { bg: "var(--ef-warning-soft)", fg: "var(--ef-warning)" },
  systemd: { bg: "#e0e7ff", fg: "#3730a3" },
  srv: { bg: "var(--ef-warning-soft)", fg: "#854d0e" },
  "go-bin": { bg: "var(--ef-success-soft)", fg: "var(--ef-success)" },
  cron: { bg: "#fce7f3", fg: "#9d174d" },
  "systemd-timer": { bg: "#e0e7ff", fg: "#4338ca" }
};

function getSourceStyle(source: string) {
  return SOURCE_COLORS[source] ?? { bg: "var(--ef-surface-soft)", fg: "var(--ef-muted)" };
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
  const { t } = useTranslation();
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
            <FilterPill active={activeFilter === "all"} onClick={() => setActiveFilter("all")}>
              {t("environmentInventory.all")} ({totalCount})
            </FilterPill>
            {sourceFilters.slice(0, 12).map(([key, count]) => (
              <FilterPill
                key={key}
                active={activeFilter === key}
                onClick={() => setActiveFilter(activeFilter === key ? "all" : key)}
              >
                <span className="filter-pill-dot" style={{ background: getSourceStyle(filterKeyToSource[key] ?? key).fg }} />
                {key} ({count})
              </FilterPill>
            ))}
          </div>
          <input
            className="inventory-search"
            type="text"
            placeholder={t("environmentInventory.searchPlaceholder")}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          {hiddenByTrust > 0 ? (
            <label
              className="inventory-toggle"
              title={t("environmentInventory.showAllTitle")}
            >
              <input type="checkbox" checked={showAll} onChange={(event) => setShowAll(event.target.checked)} />
              <span>{t("environmentInventory.showAll", { count: hiddenByTrust })}</span>
            </label>
          ) : null}
        </div>
      ) : null}

      {panelKind === "software" ? (
        <div className="filter-status" style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span>{t("environmentInventory.removalNotice")}</span>
          {selected.size > 0 && authToken && connectionId ? (
            <Button variant="connection"
              type="button"

              onClick={() => setShowRemovePanel((value) => !value)}
            >
              {t("environmentInventory.createRemovePlan", { count: selected.size })}
            </Button>
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
          {t("environmentInventory.showing", { shown: filteredRows.length, total: totalCount })}
          <button type="button" className="filter-clear" onClick={() => { setActiveFilter("all"); setSearchQuery(""); }}>
            x {t("environmentInventory.clearFilter")}
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
                    <span style={{ color: "var(--ef-muted)" }}>{row.value}</span>
                  </small>
                </span>
                <div className="inventory-item-actions">
                  <button
                    className="inv-action-btn"
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : row.id)}
                    title={t("environmentInventory.details")}
                  >
                    {isExpanded ? "^" : "v"}
                  </button>
                </div>
              </div>
              {isExpanded ? (
                <div className="inventory-detail">
                  <div className="inv-detail-grid">
                    <div className="inv-detail-row"><span>{t("environmentInventory.name")}</span><strong>{row.name}</strong></div>
                    <div className="inv-detail-row"><span>{t("environmentInventory.value")}</span><span>{row.value}</span></div>
                    <div className="inv-detail-row"><span>{t("environmentInventory.source")}</span><span style={{ background: srcStyle.bg, color: srcStyle.fg, borderRadius: 4, padding: "1px 6px", fontSize: 12, fontWeight: 600 }}>{row.source}</span></div>
                    {row.command ? <div className="inv-detail-row"><span>{commandLabel}</span><code>{row.command}</code></div> : null}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
        {hasMore ? (
          <div className="inventory-more-hint">
            {t("environmentInventory.moreNotShown", { count: filteredRows.length - MAX_DISPLAY })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
