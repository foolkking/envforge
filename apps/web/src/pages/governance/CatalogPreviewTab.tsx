import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, FileJson, GitCompareArrows, ShieldAlert } from "lucide-react";
import {
  createCapabilityCatalogPromotionRequest,
  fetchCapabilityCatalogPreview,
  type CatalogPreviewDiffItem,
  type CatalogPreviewReview,
  type CatalogPromotionRequestDraft
} from "../../api";
import { Button } from "../../components/ui/Button";
import { SummaryStat, Th, Td, summaryStyle } from "./shared";

export function CatalogPreviewTab({ authToken }: { authToken: string }): JSX.Element {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<CatalogPreviewReview | null>(null);
  const [draft, setDraft] = useState<CatalogPromotionRequestDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "needs-review" | "blocked">("all");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchCapabilityCatalogPreview(authToken)
      .then((result) => { if (!cancelled) setPreview(result); })
      .catch((err: Error) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [authToken]);

  const filteredDiff = useMemo(() => {
    const items = preview?.diffItems ?? [];
    if (filter === "all") return items;
    return items.filter((item) => item.safetyStatus === filter);
  }, [preview, filter]);

  async function generateDraft() {
    setDraftLoading(true);
    setError(null);
    try {
      const result = await createCapabilityCatalogPromotionRequest(authToken);
      setDraft(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("governance.catalogPreview.errors.draftFailed"));
    } finally {
      setDraftLoading(false);
    }
  }

  function exportDraft() {
    if (!draft) return;
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${draft.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <p style={{ color: "var(--ef-muted)" }}>{t("governance.common.loading")}</p>;
  }

  if (error) {
    return (
      <div style={{ background: "var(--ef-danger-soft)", color: "var(--ef-danger)", padding: 12, borderRadius: 6 }}>
        <AlertTriangle size={16} aria-hidden /> {error}
      </div>
    );
  }

  if (!preview) {
    return <p style={{ color: "var(--ef-muted)" }}>{t("governance.catalogPreview.unavailable")}</p>;
  }

  return (
    <div data-testid="catalog-preview-tab">
      <p style={{ color: "var(--ef-muted)", margin: "0 0 12px 0", maxWidth: 860 }}>
        {t("governance.catalogPreview.intro")}
      </p>

      <div
        data-testid="catalog-preview-readonly-note"
        style={{ background: "var(--ef-info-soft)", border: "1px solid var(--ef-info)", padding: 12, borderRadius: 8, marginBottom: 12 }}
      >
        <strong>{t("governance.catalogPreview.readOnlyTitle")}</strong>
        <ul style={{ margin: "6px 0 0 18px", padding: 0, fontSize: 12 }}>
          <li>{t("governance.catalogPreview.runtimeUnchanged")}</li>
          <li>{t("governance.catalogPreview.configsUnchanged")}</li>
          <li>{t("governance.catalogPreview.noDynamicPlugins")}</li>
          <li>{t("governance.catalogPreview.artifactsReviewOnly")}</li>
        </ul>
      </div>

      <div className="rules-summary" style={summaryStyle}>
        <SummaryStat label={t("governance.catalogPreview.capabilities")}
          value={preview.capabilityCount} icon={<FileJson size={16} aria-hidden />} tone="slate" />
        <SummaryStat label={t("governance.catalogPreview.certified")}
          value={preview.certifiedCapabilityCount} icon={<CheckCircle2 size={16} aria-hidden />} tone="green" />
        <SummaryStat label={t("governance.catalogPreview.blocked")}
          value={preview.blockedCapabilityCount} icon={<ShieldAlert size={16} aria-hidden />} tone={preview.blockedCapabilityCount ? "amber" : "slate"} />
        <SummaryStat label={t("governance.catalogPreview.diffItems")}
          value={preview.diffItems.length} icon={<GitCompareArrows size={16} aria-hidden />} tone="slate" />
        <SummaryStat label={t("governance.catalogPreview.riskChanges")}
          value={preview.diffSummary.riskChanges} icon={<AlertTriangle size={16} aria-hidden />} tone={preview.diffSummary.riskChanges ? "amber" : "slate"} />
        <SummaryStat label={t("governance.catalogPreview.gateChanges")}
          value={preview.diffSummary.gateChanges} icon={<ShieldAlert size={16} aria-hidden />} tone={preview.diffSummary.gateChanges ? "amber" : "slate"} />
        <SummaryStat label={t("governance.catalogPreview.permissionChanges")}
          value={preview.diffSummary.permissionChanges} icon={<ShieldAlert size={16} aria-hidden />} tone={preview.diffSummary.permissionChanges ? "amber" : "slate"} />
      </div>

      <section style={{ border: "1px solid var(--ef-border)", borderRadius: 8, padding: 12, marginBottom: 12 }} data-testid="catalog-preview-safety">
        <h2 style={{ fontSize: 15, margin: "0 0 8px 0" }}>{t("governance.catalogPreview.safetySummary")}</h2>
        <div style={{ display: "grid", gap: 4, fontSize: 12 }}>
          <SafetyLine label={t("governance.catalogPreview.runtimeCatalog")} ok={!preview.safetySummary.hasRuntimeMutation} value={preview.runtimeEnabled ? "true" : "false"} />
          <SafetyLine label={t("governance.catalogPreview.configCatalog")} ok={!preview.safetySummary.hasConfigCatalogMutation} value={preview.catalogMutated ? "true" : "false"} />
          <SafetyLine label={t("governance.catalogPreview.secretLeak")} ok={!preview.safetySummary.hasSecretLeak} value={String(preview.safetySummary.hasSecretLeak)} />
          <SafetyLine label={t("governance.catalogPreview.riskDowngrade")} ok={!preview.safetySummary.hasRiskDowngrade} value={String(preview.safetySummary.hasRiskDowngrade)} />
          <SafetyLine label={t("governance.catalogPreview.gateRemoval")} ok={!preview.safetySummary.hasGateRemoval} value={String(preview.safetySummary.hasGateRemoval)} />
          <SafetyLine label={t("governance.catalogPreview.writeWithoutGate")} ok={!preview.safetySummary.hasWritePermissionWithoutGate} value={String(preview.safetySummary.hasWritePermissionWithoutGate)} />
          <SafetyLine label={t("governance.catalogPreview.applyWithoutBoundary")} ok={!preview.safetySummary.hasApplyWithoutPlanBoundary} value={String(preview.safetySummary.hasApplyWithoutPlanBoundary)} />
        </div>
        {preview.safetySummary.blockedReasons.length ? (
          <ul style={{ margin: "8px 0 0 18px", padding: 0, color: "var(--ef-danger)", fontSize: 12 }}>
            {preview.safetySummary.blockedReasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        ) : null}
      </section>

      <section style={{ border: "1px solid var(--ef-border)", borderRadius: 8, padding: 12, marginBottom: 12 }} data-testid="catalog-preview-artifacts">
        <h2 style={{ fontSize: 15, margin: "0 0 8px 0" }}>{t("governance.catalogPreview.generatedArtifacts")}</h2>
        <p style={{ color: "var(--ef-muted)", fontSize: 12, margin: "0 0 8px 0" }}>
          {t("governance.catalogPreview.generatedArtifactNote")}
        </p>
        <div style={{ display: "grid", gap: 6 }}>
          {preview.artifacts.map((artifact) => (
            <div key={artifact.capabilityId} style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12 }}>
              <strong>{artifact.capabilityId}</strong>
              <code>{artifact.operation}</code>
              <code>{artifact.path ?? "n/a"}</code>
              <span>{t("governance.catalogPreview.enabledByDefault")}: {String(artifact.enabledByDefault)}</span>
              {artifact.hash ? <code>{artifact.hash.slice(0, 12)}</code> : null}
            </div>
          ))}
        </div>
      </section>

      <section style={{ border: "1px solid var(--ef-border)", borderRadius: 8, padding: 12, marginBottom: 12 }} data-testid="catalog-preview-service-stack-impact">
        <h2 style={{ fontSize: 15, margin: "0 0 8px 0" }}>{t("governance.catalogPreview.serviceStackImpact")}</h2>
        {preview.serviceStackImpact.map((impact) => (
          <div key={impact.capabilityId} style={{ marginBottom: 8, fontSize: 12 }}>
            <strong>{impact.capabilityId}</strong> <code>{impact.category}</code> <code>{impact.operation}</code>
            <div style={{ color: "var(--ef-muted)" }}>{impact.signals.join(", ")}</div>
          </div>
        ))}
      </section>

      <section style={{ border: "1px solid var(--ef-border)", borderRadius: 8, padding: 12, marginBottom: 12 }} data-testid="catalog-preview-diff-review">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 8 }}>
          <h2 style={{ fontSize: 15, margin: 0 }}>{t("governance.catalogPreview.catalogDiff")}</h2>
          <div style={{ display: "flex", gap: 4 }}>
            {(["all", "needs-review", "blocked"] as const).map((value) => (
              <Button key={value} variant={filter === value ? "primary" : "ghost"} onClick={() => setFilter(value)}>
                {t(`governance.catalogPreview.filters.${value}`)}
              </Button>
            ))}
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead style={{ background: "var(--ef-surface-soft)" }}>
            <tr>
              <Th>{t("governance.common.capability")}</Th>
              <Th>{t("governance.catalogPreview.change")}</Th>
              <Th>{t("governance.catalogPreview.risk")}</Th>
              <Th>{t("governance.catalogPreview.gates")}</Th>
              <Th>{t("governance.catalogPreview.permissions")}</Th>
              <Th>{t("governance.catalogPreview.serviceStack")}</Th>
              <Th>{t("governance.catalogPreview.safetyStatus")}</Th>
            </tr>
          </thead>
          <tbody>
            {filteredDiff.map((item) => <DiffRow key={item.id} item={item} />)}
          </tbody>
        </table>
      </section>

      <section style={{ border: "1px solid var(--ef-border)", borderRadius: 8, padding: 12 }} data-testid="catalog-preview-promotion-draft">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 8 }}>
          <div>
            <h2 style={{ fontSize: 15, margin: 0 }}>{t("governance.catalogPreview.promotionRequestDraft")}</h2>
            <p style={{ color: "var(--ef-muted)", fontSize: 12, margin: "4px 0 0 0" }}>
              {t("governance.catalogPreview.promotionDraftNote")}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" onClick={generateDraft} loading={draftLoading}>
              {t("governance.catalogPreview.generatePromotionRequest")}
            </Button>
            <Button variant="ghost" onClick={exportDraft} disabled={!draft}>
              {t("governance.catalogPreview.exportPromotionRequest")}
            </Button>
          </div>
        </div>
        {draft ? (
          <div style={{ display: "grid", gap: 8, fontSize: 12 }}>
            <div><strong>{draft.id}</strong> <code>{draft.status}</code></div>
            <div>{draft.summary}</div>
            <div>{draft.runtimeMutationNote}</div>
            <div>{draft.redactionNote}</div>
            <div>
              <strong>{t("governance.catalogPreview.requiredReview")}</strong>
              <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
                {draft.requiredReview.slice(0, 8).map((item) => <li key={item}>{item}</li>)}
                {draft.requiredReview.length === 0 ? <li>{t("governance.catalogPreview.noBlockedItems")}</li> : null}
              </ul>
            </div>
          </div>
        ) : (
          <p style={{ color: "var(--ef-muted)", fontSize: 12, margin: 0 }}>
            {t("governance.catalogPreview.noDraftYet")}
          </p>
        )}
      </section>
    </div>
  );
}

function SafetyLine({ label, ok, value }: { label: string; ok: boolean; value: string }): JSX.Element {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <span style={{ color: ok ? "var(--ef-success)" : "var(--ef-danger)" }}>{ok ? "ok" : "blocked"}</span>
      <span>{label}</span>
      <code>{value}</code>
    </div>
  );
}

function DiffRow({ item }: { item: CatalogPreviewDiffItem }): JSX.Element {
  const { t } = useTranslation();
  const tone = item.safetyStatus === "blocked"
    ? { background: "var(--ef-danger-soft)", color: "var(--ef-danger)" }
    : item.safetyStatus === "needs-review"
      ? { background: "var(--ef-warning-soft)", color: "var(--ef-warning)" }
      : { background: "var(--ef-success-soft)", color: "var(--ef-success)" };
  return (
    <tr style={{ borderBottom: "1px solid var(--ef-border)" }} data-testid={`catalog-preview-diff-${item.id}`}>
      <Td>
        <strong>{item.capabilityId}</strong>
        <div style={{ color: "var(--ef-muted)", fontSize: 11 }}>{item.catalogItemId}</div>
      </Td>
      <Td>
        <code>{item.changeType}</code>
        <div style={{ color: "var(--ef-muted)", fontSize: 11 }}>{item.category}</div>
      </Td>
      <Td><BeforeAfter before={item.riskBefore} after={item.riskAfter} /></Td>
      <Td><ListBeforeAfter before={item.gatesBefore} after={item.gatesAfter} /></Td>
      <Td><ListBeforeAfter before={item.permissionsBefore} after={item.permissionsAfter} /></Td>
      <Td><ListBeforeAfter before={item.serviceStackBefore} after={item.serviceStackAfter} /></Td>
      <Td>
        <span style={{ ...tone, padding: "2px 8px", borderRadius: 999, fontSize: 11 }}>
          {t(`governance.catalogPreview.safetyStatuses.${item.safetyStatus}`)}
        </span>
        <ul style={{ margin: "4px 0 0 16px", padding: 0, color: "var(--ef-muted)", fontSize: 11 }}>
          {item.reasons.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
      </Td>
    </tr>
  );
}

function BeforeAfter({ before, after }: { before?: string; after?: string }): JSX.Element {
  if (!before && !after) return <span style={{ color: "var(--ef-muted)" }}>—</span>;
  return (
    <div style={{ display: "grid", gap: 2 }}>
      {before ? <code>{before}</code> : null}
      {after ? <code>{after}</code> : null}
    </div>
  );
}

function ListBeforeAfter({ before, after }: { before?: string[]; after?: string[] }): JSX.Element {
  const values = [...(before ?? []), ...(after ?? [])];
  if (values.length === 0) return <span style={{ color: "var(--ef-muted)" }}>—</span>;
  return (
    <div style={{ display: "grid", gap: 2 }}>
      {(before ?? []).slice(0, 3).map((value) => <code key={`b-${value}`}>{value}</code>)}
      {(after ?? []).slice(0, 4).map((value) => <code key={`a-${value}`}>{value}</code>)}
    </div>
  );
}
