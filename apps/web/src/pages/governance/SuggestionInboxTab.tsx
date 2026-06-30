import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AdminSuggestionRecord } from "../../api";
import type { Locale } from "../../lib/types";
import { Badge } from "../../components/ui/Badge";
import { FilterPills, Th, Td } from "./shared";
import { promptDialog } from "../../lib/dialogs";

// ── Suggestion Inbox tab ──────────────────────────────────────────────

export function SuggestionInboxTab({
  locale, suggestions, loading, onProcess, onAuthorFromSuggestion
}: {
  locale: Locale;
  suggestions: AdminSuggestionRecord[];
  loading: boolean;
  onProcess: (id: string, action: "accepted" | "rejected", feedback?: string) => Promise<void>;
  onAuthorFromSuggestion?: (suggestion: AdminSuggestionRecord) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return suggestions.filter((s) => statusFilter === "all" || s.status === statusFilter);
  }, [suggestions, statusFilter]);

  return (
    <div data-testid="suggestions-tab">
      <p style={{ color: "var(--ef-muted)", margin: "0 0 12px 0", maxWidth: 720 }}>
        {t("governance.suggestions.intro")}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "0 0 12px 0" }}>
        <FilterPills
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "all", label: t("governance.common.all") },
            { value: "pending", label: t("governance.common.pending") },
            { value: "accepted", label: t("governance.common.accepted") },
            { value: "rejected", label: t("governance.common.rejected") }
          ]}
        />
      </div>

      {loading ? (
        <p style={{ color: "var(--ef-muted)" }}>{t("governance.common.loading")}</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: "var(--ef-muted)" }}>{t("governance.suggestions.noSuggestions")}</p>
      ) : (
        <table data-testid="suggestions-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "var(--ef-surface-soft)" }}>
            <tr>
              <Th>{t("governance.suggestions.title")}</Th>
              <Th>{t("governance.suggestions.submitter")}</Th>
              <Th>{t("governance.common.type")}</Th>
              <Th>{t("governance.suggestions.relatedCapability")}</Th>
              <Th>{t("governance.common.status")}</Th>
              <Th>{t("governance.suggestions.submitted")}</Th>
              <Th>{t("governance.common.actions")}</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} style={{ borderBottom: "1px solid var(--ef-border)" }} data-testid={`suggestion-row-${s.id}`}>
                <Td>
                  <strong>{locale === "zh" ? s.nameZh || s.nameEn : s.nameEn || s.nameZh}</strong>
                  {s.remark ? <div style={{ color: "var(--ef-muted)", fontSize: 11, marginTop: 2 }}>{s.remark}</div> : null}
                </Td>
                <Td>{s.displayName || s.username}</Td>
                <Td><code>{s.type}</code></Td>
                <Td>{s.catalogId ? <code>{s.catalogId}</code> : <span style={{ color: "var(--ef-muted)" }}>—</span>}</Td>
                <Td>
                  <SuggestionStatusBadge status={s.status} locale={locale} testId={`suggestion-status-${s.id}`} />
                </Td>
                <Td><span style={{ color: "var(--ef-muted)", fontSize: 11 }}>{new Date(s.createdAt).toLocaleString()}</span></Td>
                <Td>
                  {s.status === "pending" ? (
                    <div style={{ display: "flex", gap: 4 }}>
                      {onAuthorFromSuggestion ? (
                        <button type="button" disabled={busyId === s.id}
                          data-testid={`suggestion-author-${s.id}`}
                          onClick={() => onAuthorFromSuggestion(s)}
                          style={{ padding: "2px 8px", background: "var(--ef-success-soft)", border: "1px solid var(--ef-success)", color: "var(--ef-success)", borderRadius: 4 }}>
                          {s.catalogId ? t("governance.suggestions.acceptAndEdit") : t("governance.suggestions.acceptAndCreate")}
                        </button>
                      ) : (
                        <button type="button" disabled={busyId === s.id}
                          onClick={async () => {
                            setBusyId(s.id);
                            try { await onProcess(s.id, "accepted"); }
                            finally { setBusyId(null); }
                          }}
                          style={{ padding: "2px 8px", background: "var(--ef-success-soft)", border: "1px solid var(--ef-success)", color: "var(--ef-success)", borderRadius: 4 }}>
                          {t("governance.common.accept")}
                        </button>
                      )}
                      <button type="button" disabled={busyId === s.id}
                        onClick={async () => {
                          const feedback = await promptDialog({ message: t("governance.suggestions.rejectReason"), confirmLabel: t("governance.common.reject"), cancelLabel: t("governance.common.cancel") });
                          if (feedback === null) return;
                          setBusyId(s.id);
                          try { await onProcess(s.id, "rejected", feedback); }
                          finally { setBusyId(null); }
                        }}
                        style={{ padding: "2px 8px", background: "var(--ef-danger-soft)", border: "1px solid var(--ef-danger)", color: "var(--ef-danger)", borderRadius: 4 }}>
                        {t("governance.common.reject")}
                      </button>
                    </div>
                  ) : <span style={{ color: "var(--ef-muted)", fontSize: 11 }}>—</span>}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SuggestionStatusBadge({ status, locale, testId }: { status: string; locale: Locale; testId: string }): JSX.Element {
  const { t } = useTranslation();
  const map: Record<string, { tone: "ok" | "warn" | "danger" | "neutral"; label: string }> = {
    pending: { tone: "warn", label: t("governance.common.pending") },
    accepted: { tone: "ok", label: t("governance.common.accepted") },
    rejected: { tone: "danger", label: t("governance.common.rejected") }
  };
  const item = map[status] ?? { tone: "neutral", label: status };
  return <span data-testid={testId}><Badge tone={item.tone} size="sm">{item.label}</Badge></span>;
}
