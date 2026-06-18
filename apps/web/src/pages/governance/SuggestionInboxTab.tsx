import React, { useMemo, useState } from "react";
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
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return suggestions.filter((s) => statusFilter === "all" || s.status === statusFilter);
  }, [suggestions, statusFilter]);

  return (
    <div data-testid="suggestions-tab">
      <p style={{ color: "var(--ef-muted)", margin: "0 0 12px 0", maxWidth: 720 }}>
        {locale === "zh"
          ? "处理用户提交的能力建议、组合调整、规则缺失反馈。状态在 pending / accepted / rejected 之间流转。"
          : "Process user-submitted capability requests, combo adjustments, and rule-gap feedback. Status flows through pending / accepted / rejected."}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "0 0 12px 0" }}>
        <FilterPills
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "all", label: locale === "zh" ? "全部" : "All" },
            { value: "pending", label: locale === "zh" ? "待处理" : "Pending" },
            { value: "accepted", label: locale === "zh" ? "已接受" : "Accepted" },
            { value: "rejected", label: locale === "zh" ? "已拒绝" : "Rejected" }
          ]}
        />
      </div>

      {loading ? (
        <p style={{ color: "var(--ef-muted)" }}>{locale === "zh" ? "加载中..." : "Loading..."}</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: "var(--ef-muted)" }}>{locale === "zh" ? "暂无建议" : "No suggestions yet."}</p>
      ) : (
        <table data-testid="suggestions-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "var(--ef-surface-soft)" }}>
            <tr>
              <Th>{locale === "zh" ? "标题" : "Title"}</Th>
              <Th>{locale === "zh" ? "提交人" : "Submitter"}</Th>
              <Th>{locale === "zh" ? "类型" : "Type"}</Th>
              <Th>{locale === "zh" ? "关联能力" : "Related capability"}</Th>
              <Th>Status</Th>
              <Th>{locale === "zh" ? "提交时间" : "Submitted"}</Th>
              <Th>Actions</Th>
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
                          {locale === "zh" ? (s.catalogId ? "接受并编辑" : "接受并新建") : (s.catalogId ? "Accept & edit" : "Accept & create")}
                        </button>
                      ) : (
                        <button type="button" disabled={busyId === s.id}
                          onClick={async () => {
                            setBusyId(s.id);
                            try { await onProcess(s.id, "accepted"); }
                            finally { setBusyId(null); }
                          }}
                          style={{ padding: "2px 8px", background: "var(--ef-success-soft)", border: "1px solid var(--ef-success)", color: "var(--ef-success)", borderRadius: 4 }}>
                          {locale === "zh" ? "接受" : "Accept"}
                        </button>
                      )}
                      <button type="button" disabled={busyId === s.id}
                        onClick={async () => {
                          const feedback = await promptDialog({ message: locale === "zh" ? "拒绝理由（可选）" : "Reason (optional)", confirmLabel: locale === "zh" ? "拒绝" : "Reject", cancelLabel: locale === "zh" ? "取消" : "Cancel" });
                          if (feedback === null) return;
                          setBusyId(s.id);
                          try { await onProcess(s.id, "rejected", feedback); }
                          finally { setBusyId(null); }
                        }}
                        style={{ padding: "2px 8px", background: "var(--ef-danger-soft)", border: "1px solid var(--ef-danger)", color: "var(--ef-danger)", borderRadius: 4 }}>
                        {locale === "zh" ? "拒绝" : "Reject"}
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
  const map: Record<string, { tone: "ok" | "warn" | "danger" | "neutral"; zh: string; en: string }> = {
    pending: { tone: "warn", zh: "待处理", en: "Pending" },
    accepted: { tone: "ok", zh: "已接受", en: "Accepted" },
    rejected: { tone: "danger", zh: "已拒绝", en: "Rejected" }
  };
  const item = map[status] ?? { tone: "neutral", zh: status, en: status };
  return <span data-testid={testId}><Badge tone={item.tone} size="sm">{locale === "zh" ? item.zh : item.en}</Badge></span>;
}
