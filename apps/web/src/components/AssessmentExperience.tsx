import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Download,
  FileJson,
  FileText,
  Layers3,
  LifeBuoy,
  RefreshCw,
  SearchCheck,
  ShieldCheck,
  Wrench
} from "lucide-react";
import type {
  AssessmentRequiredDecision,
  AssessmentServiceStack,
  AssessmentSummary,
  DecisionHistoryRecord,
  FailureDiagnostic,
  ReviewInboxItem
} from "../api";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { MetricPill } from "./ui/MetricPill";
import { Badge } from "./ui/Badge";

const READ_KEYS = ["os", "services", "ports", "packages", "docker", "configs", "certificates", "database", "security"] as const;
const NOT_READ_KEYS = ["privateKeys", "databaseContents", "secretValues", "applicationData", "homeDirectories"] as const;

export function AssessmentLandingPanel({
  canAssess,
  hasAssessment,
  loading,
  onAssess,
  onGeneratePlan
}: {
  canAssess: boolean;
  hasAssessment: boolean;
  loading: boolean;
  onAssess: () => void;
  onGeneratePlan: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="assessment-landing" data-testid="assessment-landing">
      <div className="assessment-landing-hero">
        <Badge tone="ok">{t("migratePipeline.assessment.readOnlyBadge")}</Badge>
        <p className="eyebrow">{t("migratePipeline.assessment.firstRunEyebrow")}</p>
        <h3>{t("migratePipeline.assessment.firstRunTitle")}</h3>
        <p>{t("migratePipeline.assessment.firstRunBody")}</p>
        <p className="read-only-promise"><ShieldCheck aria-hidden />{t("migratePipeline.assessment.noModifyPromise")}</p>
        <div className="first-run-cta-row">
          <Button variant="primary" disabled={!canAssess || loading} onClick={onAssess}>
            {loading ? <RefreshCw className="spinning" aria-hidden /> : <SearchCheck aria-hidden />}
            {t("migratePipeline.assessment.assessServer")}
          </Button>
          <Button variant="secondary" disabled={!hasAssessment || loading} onClick={onGeneratePlan}><FileText aria-hidden />{t("migratePipeline.assessment.generatePlan")}</Button>
          <Button variant="ghost" disabled title={t("migratePipeline.assessment.applyCtaHint")}><ShieldCheck aria-hidden />{t("migratePipeline.assessment.applyApprovedPlan")}</Button>
        </div>
      </div>
      <div className="assessment-disclosure-grid">
        <div><strong>{t("migratePipeline.assessment.whatReads")}</strong><ul>{READ_KEYS.map((key) => <li key={key}>{t(`migratePipeline.assessment.reads.${key}`)}</li>)}</ul></div>
        <div><strong>{t("migratePipeline.assessment.whatDoesNotRead")}</strong><ul>{NOT_READ_KEYS.map((key) => <li key={key}>{t(`migratePipeline.assessment.doesNotRead.${key}`)}</li>)}</ul></div>
      </div>
    </section>
  );
}

export type ReviewDecisionAction = {
  item: ReviewInboxItem;
  action: "accept-recommended" | "choose-option" | "defer" | "record-only" | "manual";
  optionId?: string;
  remember: boolean;
};

export function AssessmentExperience({
  assessment,
  assessmentLoading,
  assessmentError,
  reviewItems,
  reviewLoading,
  reviewError,
  reviewHistory,
  actionItemId,
  actionErrorItemId,
  actionError,
  reportLoading,
  reportError,
  failureDiagnostics,
  failureLoading,
  failureError,
  supportLoading,
  supportError,
  onRefresh,
  onExport,
  onExportSupport,
  onReviewAction,
  onContinue
}: {
  assessment: AssessmentSummary | null;
  assessmentLoading: boolean;
  assessmentError: string;
  reviewItems: ReviewInboxItem[];
  reviewLoading: boolean;
  reviewError: string;
  reviewHistory: Record<string, DecisionHistoryRecord[]>;
  actionItemId: string | null;
  actionErrorItemId: string | null;
  actionError: string;
  reportLoading: "json" | "markdown" | null;
  reportError: string;
  failureDiagnostics: FailureDiagnostic[];
  failureLoading: boolean;
  failureError: string;
  supportLoading: "json" | "markdown" | null;
  supportError: string;
  onRefresh: () => void;
  onExport: (format: "json" | "markdown") => void;
  onExportSupport: (format: "json" | "markdown") => void;
  onReviewAction: (input: ReviewDecisionAction) => void;
  onContinue: () => void;
}) {
  const { t } = useTranslation();
  if (assessmentLoading) {
    return <AssessmentState title={t("migratePipeline.assessment.loadingTitle")} body={t("migratePipeline.assessment.loadingBody")} />;
  }
  if (assessmentError || !assessment) {
    return (
      <AssessmentState
        title={t("migratePipeline.assessment.unavailableTitle")}
        body={assessmentError || t("migratePipeline.assessment.unavailableBody")}
        action={<Button variant="secondary" onClick={onRefresh}><RefreshCw aria-hidden />{t("migratePipeline.assessment.retry")}</Button>}
      />
    );
  }

  return (
    <div className="assessment-experience" data-testid="assessment-experience">
      <AssessmentOverview assessment={assessment} onRefresh={onRefresh} />
      <MigrationReadinessPanel assessment={assessment} onContinue={onContinue} />
      <ReviewInboxPanel
        assessment={assessment}
        items={reviewItems}
        loading={reviewLoading}
        error={reviewError}
        history={reviewHistory}
        actionItemId={actionItemId}
        actionErrorItemId={actionErrorItemId}
        actionError={actionError}
        onAction={onReviewAction}
      />
      <ServiceStackSection assessment={assessment} />
      <EvidenceQualityPanel assessment={assessment} />
      <FailureSupportPanel
        diagnostics={failureDiagnostics}
        loading={failureLoading}
        error={failureError}
        exportLoading={supportLoading}
        exportError={supportError}
        onExport={onExportSupport}
      />
      <AssessmentReportPanel
        assessment={assessment}
        loading={reportLoading}
        error={reportError}
        onExport={onExport}
      />
    </div>
  );
}

export function FailureSupportPanel({ diagnostics, loading, error, exportLoading, exportError, onExport }: {
  diagnostics: FailureDiagnostic[];
  loading: boolean;
  error: string;
  exportLoading: "json" | "markdown" | null;
  exportError: string;
  onExport: (format: "json" | "markdown") => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="failure-support-panel" aria-labelledby="failure-support-title" data-testid="failure-support-panel">
      <header className="assessment-card-heading">
        <div><p className="eyebrow">{t("migratePipeline.failure.eyebrow")}</p><h3 id="failure-support-title">{t("migratePipeline.failure.title")}</h3></div>
        <LifeBuoy aria-hidden />
      </header>
      <p className="pipeline-muted">{t("migratePipeline.failure.intro")}</p>
      {loading ? <AssessmentState title={t("migratePipeline.failure.loadingTitle")} body={t("migratePipeline.failure.loadingBody")} /> : null}
      {!loading && error ? <AssessmentState title={t("migratePipeline.failure.unavailableTitle")} body={error} /> : null}
      {!loading && !error && !diagnostics.length ? <AssessmentState title={t("migratePipeline.failure.emptyTitle")} body={t("migratePipeline.failure.emptyBody")} /> : null}
      {diagnostics.map((diagnostic) => <FailureDiagnosticCard key={diagnostic.id} diagnostic={diagnostic} />)}
      <Card className="support-bundle-card">
        <div><strong>{t("migratePipeline.failure.supportTitle")}</strong><p>{t("migratePipeline.failure.supportIntro")}</p></div>
        <div className="assessment-panel-actions">
          <Button variant="secondary" data-testid="support-export-json" disabled={exportLoading !== null} onClick={() => onExport("json")}><FileJson aria-hidden />{exportLoading === "json" ? t("migratePipeline.failure.exporting") : t("migratePipeline.failure.downloadJson")}</Button>
          <Button variant="secondary" data-testid="support-export-markdown" disabled={exportLoading !== null} onClick={() => onExport("markdown")}><Download aria-hidden />{exportLoading === "markdown" ? t("migratePipeline.failure.exporting") : t("migratePipeline.failure.downloadMarkdown")}</Button>
        </div>
        <ul className="assessment-report-boundary">
          <li>{t("migratePipeline.failure.redacted")}</li>
          <li>{t("migratePipeline.failure.noExecution")}</li>
          <li>{t("migratePipeline.failure.rollbackBoundary")}</li>
        </ul>
        {exportError ? <p className="pipeline-error"><AlertTriangle aria-hidden />{exportError}</p> : null}
      </Card>
    </section>
  );
}

export function FailureDiagnosticCard({ diagnostic }: { diagnostic: FailureDiagnostic }) {
  const { t } = useTranslation();
  return (
    <Card className={`failure-diagnostic-card severity-${diagnostic.severity}`} data-testid={`failure-diagnostic-${diagnostic.category}`} tone={diagnostic.severity === "critical" || diagnostic.severity === "error" ? "danger" : "warn"}>
      <header className="assessment-card-heading">
        <div><Badge tone={diagnostic.severity === "critical" || diagnostic.severity === "error" ? "danger" : "warn"}>{t(`migratePipeline.failure.categories.${diagnostic.category}`)}</Badge><h4>{diagnostic.title}</h4></div>
        <AlertTriangle aria-hidden />
      </header>
      <dl className="failure-diagnostic-fields">
        <DecisionField label={t("migratePipeline.failure.whatFailed")} value={diagnostic.whatFailed} />
        <DecisionField label={t("migratePipeline.failure.whereFailed")} value={diagnostic.whereFailed ?? t("migratePipeline.failure.unavailableValue")} />
        <DecisionField label={t("migratePipeline.failure.attempted")} value={diagnostic.attempted ?? t("migratePipeline.failure.unavailableValue")} />
        <DecisionField label={t("migratePipeline.failure.impact")} value={diagnostic.impact} />
      </dl>
      <div className="failure-diagnostic-grid">
        <div><strong>{t("migratePipeline.failure.likelyCauses")}</strong><ul>{diagnostic.likelyCauses.map((cause) => <li key={cause}>{cause}</li>)}</ul></div>
        <div><strong>{t("migratePipeline.failure.recommendedActions")}</strong><ul>{diagnostic.recommendedActions.filter((action) => action.available).map((action) => <li key={action.kind}><strong>{action.label}</strong><span>{action.description}</span></li>)}</ul></div>
      </div>
      <div className="failure-boundary-grid">
        <span><strong>{t("migratePipeline.failure.canRetry")}</strong>{diagnostic.retry.allowed ? t("migratePipeline.failure.yes") : t("migratePipeline.failure.no")} · {diagnostic.retry.reason}</span>
        <span><strong>{t("migratePipeline.failure.canSkip")}</strong>{diagnostic.skip.allowed ? t("migratePipeline.failure.yes") : t("migratePipeline.failure.no")} · {diagnostic.skip.reason}</span>
        <span><strong>{t("migratePipeline.failure.canRollback")}</strong>{diagnostic.rollback.available ? t("migratePipeline.failure.yes") : t("migratePipeline.failure.no")} · {diagnostic.rollback.boundary}</span>
      </div>
      <details><summary>{t("migratePipeline.failure.evidence", { count: diagnostic.evidence.length })}</summary>{diagnostic.evidence.length ? <ul>{diagnostic.evidence.map((item) => <li key={item.id}><strong>{item.label}</strong>{item.value ? <code>{item.value}</code> : null}</li>)}</ul> : <p>{t("migratePipeline.failure.noEvidence")}</p>}</details>
      {diagnostic.repairPlanDraft ? (
        <div className="repair-plan-draft" data-testid="repair-plan-draft">
          <div><Wrench aria-hidden /><strong>{diagnostic.repairPlanDraft.title}</strong><Badge tone="warn">{t("migratePipeline.failure.draft")}</Badge></div>
          <p>{diagnostic.repairPlanDraft.summary}</p>
          <ol>{diagnostic.repairPlanDraft.proposedSteps.map((step) => <li key={step.id}>{step.description}{step.wouldRequireApprovedPlan ? <small>{t("migratePipeline.failure.requiresApprovedPlan")}</small> : null}</li>)}</ol>
          {diagnostic.repairPlanDraft.safetyNotes.map((note) => <p className="assessment-boundary-note" key={note}><ShieldCheck aria-hidden />{note}</p>)}
        </div>
      ) : null}
      <div className="assessment-panel-actions">
        <Button variant="secondary" disabled title={diagnostic.retry.reason}>{t("migratePipeline.failure.retry")}</Button>
        <Button variant="secondary" disabled title={diagnostic.rollback.boundary}>{t("migratePipeline.failure.rollback")}</Button>
        <Button variant="ghost" disabled title={t("migratePipeline.failure.manualOnlyHint")}>{t("migratePipeline.failure.markManual")}</Button>
      </div>
    </Card>
  );
}

function AssessmentOverview({ assessment, onRefresh }: { assessment: AssessmentSummary; onRefresh: () => void }) {
  const { t } = useTranslation();
  const highRisk = assessment.serviceStacks.filter((stack) => stack.risk === "high").length;
  const completeness = Math.round(assessment.evidenceQuality.completeness * 100);
  return (
    <section className="assessment-overview" aria-labelledby="assessment-overview-title">
      <div className="pipeline-section-heading">
        <div>
          <p className="eyebrow">{t("migratePipeline.assessment.eyebrow")}</p>
          <h3 id="assessment-overview-title">{t("migratePipeline.assessment.title")}</h3>
          <p className="pipeline-muted">{t("migratePipeline.assessment.valueStatement")}</p>
        </div>
        <div className="assessment-heading-actions">
          <Badge tone="info">{t("migratePipeline.assessment.readOnlyBadge")}</Badge>
          <Button variant="secondary" onClick={onRefresh}><RefreshCw aria-hidden />{t("migratePipeline.assessment.refresh")}</Button>
        </div>
      </div>
      <div className="assessment-source-line">
        <strong>{assessment.source?.host ?? t("migratePipeline.assessment.unknownHost")}</strong>
        <span>{assessment.source?.os ?? "-"}</span>
        <span>{assessment.source?.architecture ?? "-"}</span>
        <span>{assessment.snapshot?.capturedAt ? new Date(assessment.snapshot.capturedAt).toLocaleString() : "-"}</span>
      </div>
      <div className="assessment-metric-grid">
        <MetricPill label={t("migratePipeline.assessment.metrics.stacks")} value={assessment.serviceStacks.length} />
        <MetricPill label={t("migratePipeline.assessment.metrics.highRisk")} value={highRisk} />
        <MetricPill label={t("migratePipeline.assessment.metrics.decisions")} value={assessment.requiredDecisions.length} />
        <MetricPill label={t("migratePipeline.assessment.metrics.completeness")} value={`${completeness}%`} />
        <MetricPill label={t("migratePipeline.assessment.metrics.readiness")} value={t(`migratePipeline.assessment.readiness.${assessment.readiness.status}`)} />
      </div>
    </section>
  );
}

function MigrationReadinessPanel({ assessment, onContinue }: { assessment: AssessmentSummary; onContinue: () => void }) {
  const { t } = useTranslation();
  const readiness = assessment.readiness;
  return (
    <Card as="section" className={`assessment-readiness ${readiness.status}`} tone={readiness.status === "blocked-by-missing-evidence" ? "danger" : readiness.status === "apply-requires-decisions" ? "warn" : "default"}>
      <header className="assessment-card-heading">
        <div>
          <p className="eyebrow">{t("migratePipeline.assessment.readinessTitle")}</p>
          <h3>{t(`migratePipeline.assessment.readiness.${readiness.status}`)}</h3>
        </div>
        <Badge tone={readinessTone(readiness.status)}>{t(`migratePipeline.assessment.readiness.${readiness.status}`)}</Badge>
      </header>
      <p>{readiness.summary}</p>
      <p className="assessment-boundary-note"><ShieldCheck aria-hidden />{t(`migratePipeline.assessment.readinessMeaning.${readiness.status}`)}</p>
      <AssessmentLists blockers={readiness.blockers} warnings={readiness.warnings} nextActions={readiness.nextActions} />
      <div className="assessment-panel-actions">
        <Button variant="secondary" disabled={readiness.status === "blocked-by-missing-evidence"} onClick={onContinue}>
          <ClipboardCheck aria-hidden />{assessment.requiredDecisions.length ? t("migratePipeline.assessment.reviewDecisions") : t("migratePipeline.assessment.continueToSelection")}
        </Button>
      </div>
    </Card>
  );
}

function AssessmentLists({ blockers, warnings, nextActions }: { blockers: string[]; warnings: string[]; nextActions: string[] }) {
  const { t } = useTranslation();
  return (
    <div className="assessment-list-grid">
      <AssessmentList title={t("migratePipeline.assessment.blockers")} items={blockers} empty={t("migratePipeline.assessment.noBlockers")} tone="danger" />
      <AssessmentList title={t("migratePipeline.assessment.warnings")} items={warnings} empty={t("migratePipeline.assessment.noWarnings")} tone="warn" />
      <AssessmentList title={t("migratePipeline.assessment.nextActions")} items={nextActions} empty={t("migratePipeline.assessment.noNextActions")} tone="info" />
    </div>
  );
}

function AssessmentList({ title, items, empty, tone }: { title: string; items: string[]; empty: string; tone: string }) {
  return (
    <div className={`assessment-list ${tone}`}>
      <strong>{title}</strong>
      {items.length ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p>{empty}</p>}
    </div>
  );
}

function ServiceStackSection({ assessment }: { assessment: AssessmentSummary }) {
  const { t } = useTranslation();
  const byId = useMemo(() => new Map(assessment.serviceStacks.map((stack) => [stack.id, stack])), [assessment.serviceStacks]);
  return (
    <section className="assessment-service-stacks" aria-labelledby="service-stacks-title">
      <div className="pipeline-section-heading">
        <div><p className="eyebrow">{t("migratePipeline.assessment.serviceStacksEyebrow")}</p><h3 id="service-stacks-title">{t("migratePipeline.assessment.serviceStacks")}</h3></div>
        <span className="selection-count">{assessment.serviceStacks.length}</span>
      </div>
      {assessment.serviceStacks.length ? (
        <div className="service-stack-grid">
          {assessment.serviceStacks.map((stack) => <ServiceStackCard key={stack.id} stack={stack} stacksById={byId} />)}
        </div>
      ) : <AssessmentState title={t("migratePipeline.assessment.emptyStacksTitle")} body={t("migratePipeline.assessment.emptyStacksBody")} />}
    </section>
  );
}

function ServiceStackCard({ stack, stacksById }: { stack: AssessmentServiceStack; stacksById: Map<string, AssessmentServiceStack> }) {
  const { t } = useTranslation();
  return (
    <Card as="article" id={stack.id} className="service-stack-card" data-testid={`service-stack-${stack.category}`}>
      <header className="service-stack-heading">
        <div><span className="service-stack-category">{t(`migratePipeline.assessment.categories.${stack.category}`)}</span><h4>{stack.name}</h4></div>
        <Badge tone={riskTone(stack.risk)}>{t(`migratePipeline.assessment.risk.${stack.risk}`)}</Badge>
      </header>
      <p>{stack.summary}</p>
      <dl className="service-stack-facts">
        <div><dt>{t("migratePipeline.assessment.confidence")}</dt><dd>{t(`migratePipeline.assessment.confidenceValues.${stack.confidence}`)}</dd></div>
        <div><dt>{t("migratePipeline.assessment.statefulness")}</dt><dd>{t(`migratePipeline.assessment.statefulnessValues.${stack.statefulness}`)}</dd></div>
        <div><dt>{t("migratePipeline.assessment.stackReadiness")}</dt><dd>{t(`migratePipeline.assessment.stackReadinessValues.${stack.migrationReadiness}`)}</dd></div>
        <div><dt>{t("migratePipeline.assessment.evidenceCount")}</dt><dd>{stack.evidenceCount}</dd></div>
      </dl>
      <div className="service-stack-explanation">
        <strong>{t("migratePipeline.assessment.whyDetected")}</strong><p>{stack.confidenceReason}</p>
        <strong>{t("migratePipeline.assessment.recommendedStrategy")}</strong><p>{stack.recommendedStrategy ?? t("migratePipeline.assessment.strategyUnavailable")}</p>
      </div>
      {stack.requiredDecisions.length ? (
        <div className="service-stack-decisions">
          <strong>{t("migratePipeline.assessment.requiredDecisions")}</strong>
          {stack.requiredDecisions.map((decision) => <span key={decision.id}>{decision.title}</span>)}
        </div>
      ) : null}
      <details><summary>{t("migratePipeline.assessment.evidenceDetails", { count: stack.evidence.length })}</summary><ul>{stack.evidence.map((item) => <li key={item.id}><strong>{item.label}</strong><small>{item.source}{item.status ? ` · ${item.status}` : ""}</small></li>)}</ul></details>
      <details><summary>{t("migratePipeline.assessment.riskReasons", { count: stack.riskReasons.length })}</summary>{stack.riskReasons.length ? <ul>{stack.riskReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : <p>{t("migratePipeline.assessment.noRiskReasons")}</p>}</details>
      {stack.relationships.length ? <div className="stack-relationships"><strong>{t("migratePipeline.assessment.relationships")}</strong>{stack.relationships.map((relationship) => <span key={`${relationship.type}:${relationship.targetServiceStackId}`}>{relationship.summary} → {stacksById.get(relationship.targetServiceStackId)?.name ?? t("migratePipeline.assessment.relatedStackMissing")}</span>)}</div> : null}
      {stack.capabilityRefs.length ? <small className="capability-refs">{t("migratePipeline.assessment.capabilityRefs")}: {stack.capabilityRefs.join(" · ")}</small> : null}
    </Card>
  );
}

function EvidenceQualityPanel({ assessment }: { assessment: AssessmentSummary }) {
  const { t } = useTranslation();
  const quality = assessment.evidenceQuality;
  const dockerCollector = quality.collectors.find((collector) => /docker/i.test(collector.name));
  const dockerStackFound = assessment.serviceStacks.some((stack) => /docker/i.test(`${stack.name} ${stack.capabilityRefs.join(" ")}`));
  const dockerMessage = !dockerCollector
    ? t("migratePipeline.assessment.dockerUnknown")
    : dockerCollector.status === "ok" && !dockerStackFound
      ? t("migratePipeline.assessment.dockerNotDetected")
      : dockerCollector.status === "failed"
        ? t("migratePipeline.assessment.dockerFailed")
        : dockerCollector.status === "partial"
          ? t("migratePipeline.assessment.dockerPartial")
          : t("migratePipeline.assessment.dockerDetected");
  return (
    <Card as="section" className="assessment-evidence-quality">
      <header className="assessment-card-heading">
        <div><p className="eyebrow">{t("migratePipeline.assessment.evidenceEyebrow")}</p><h3>{t("migratePipeline.assessment.evidenceQuality")}</h3></div>
        <div className="collector-evidence-metrics"><Badge tone={qualityTone(quality.overallStatus)}>{t(`migratePipeline.assessment.collectorStatus.${quality.overallStatus}`)}</Badge><strong>{Math.round(quality.completeness * 100)}%</strong></div>
      </header>
      <p className={`docker-evidence-callout ${dockerCollector?.status ?? "unknown"}`} data-testid="docker-evidence-status">{dockerMessage}</p>
      {quality.overallStatus !== "ok" ? <p className="collector-gate-warning"><AlertTriangle aria-hidden />{t("migratePipeline.assessment.partialEvidenceWarning")}</p> : null}
      <div className="assessment-collector-list">
        {quality.collectors.map((collector) => (
          <details key={collector.name} className={`assessment-collector-row ${collector.status}`}>
            <summary><strong>{collector.name}</strong><Badge tone={qualityTone(collector.status)}>{t(`migratePipeline.assessment.collectorStatus.${collector.status}`)}</Badge><span>{collector.completeness === undefined ? "-" : `${Math.round(collector.completeness * 100)}%`}</span></summary>
            {collector.failedCommands?.map((command) => <code key={`failed:${command}`}>{t("migratePipeline.assessment.failedCommand")}: {command}</code>)}
            {collector.timedOutCommands?.map((command) => <code key={`timeout:${command}`}>{t("migratePipeline.assessment.timedOutCommand")}: {command}</code>)}
            {collector.stderrSummary ? <pre>{collector.stderrSummary}</pre> : null}
            {collector.errors?.map((error) => <p key={error}>{error}</p>)}
            {!collector.failedCommands?.length && !collector.timedOutCommands?.length && !collector.stderrSummary && !collector.errors?.length ? <p>{t("migratePipeline.assessment.noCollectorErrors")}</p> : null}
          </details>
        ))}
      </div>
      {quality.notes.length ? <div className="assessment-evidence-notes"><strong>{t("migratePipeline.assessment.notes")}</strong><ul>{quality.notes.map((note) => <li key={note}>{note}</li>)}</ul></div> : null}
    </Card>
  );
}

function ReviewInboxPanel({ assessment, items, loading, error, history, actionItemId, actionErrorItemId, actionError, onAction }: {
  assessment: AssessmentSummary;
  items: ReviewInboxItem[];
  loading: boolean;
  error: string;
  history: Record<string, DecisionHistoryRecord[]>;
  actionItemId: string | null;
  actionErrorItemId: string | null;
  actionError: string;
  onAction: (input: ReviewDecisionAction) => void;
}) {
  const { t } = useTranslation();
  const open = items.filter((item) => item.status === "open" || item.status === "deferred");
  return (
    <section className="review-inbox-panel" aria-labelledby="review-inbox-title" data-testid="review-inbox-panel">
      <div className="pipeline-section-heading">
        <div><p className="eyebrow">{t("migratePipeline.reviewInbox.eyebrow")}</p><h3 id="review-inbox-title" tabIndex={-1}>{t("migratePipeline.reviewInbox.title")}</h3><p className="pipeline-muted">{t("migratePipeline.reviewInbox.intro")}</p></div>
        <MetricPill label={t("migratePipeline.reviewInbox.openItems")} value={open.length} />
      </div>
      <p className="review-security-boundary"><ShieldCheck aria-hidden />{t("migratePipeline.reviewInbox.securityBoundary")}</p>
      {loading ? <AssessmentState title={t("migratePipeline.reviewInbox.loadingTitle")} body={t("migratePipeline.reviewInbox.loadingBody")} /> : null}
      {!loading && error ? <AssessmentState title={t("migratePipeline.reviewInbox.unavailableTitle")} body={error} /> : null}
      {!loading && !error && !items.length ? <AssessmentState title={t("migratePipeline.reviewInbox.emptyTitle")} body={t("migratePipeline.reviewInbox.emptyBody")} /> : null}
      {!loading && !error && items.length ? (
        <div className="review-inbox-list">
          {items.map((item) => {
            const stack = assessment.serviceStacks.find((candidate) => candidate.id === `stack:${item.candidateId}`);
            const decision = assessment.requiredDecisions.find((candidate) => candidate.relatedServiceStackIds.includes(stack?.id ?? ""));
            return <DecisionExplanationCard key={item.id} item={item} stack={stack} decision={decision} history={history[item.id] ?? []} busy={actionItemId === item.id} actionError={actionErrorItemId === item.id ? actionError : ""} onAction={onAction} />;
          })}
        </div>
      ) : null}
    </section>
  );
}

function DecisionExplanationCard({ item, stack, decision, history, busy, actionError, onAction }: {
  item: ReviewInboxItem;
  stack?: AssessmentServiceStack;
  decision?: AssessmentRequiredDecision;
  history: DecisionHistoryRecord[];
  busy: boolean;
  actionError: string;
  onAction: (input: ReviewDecisionAction) => void;
}) {
  const { t } = useTranslation();
  const [optionId, setOptionId] = useState(decision?.options[0]?.id ?? "");
  const [remember, setRemember] = useState(false);
  const open = item.status === "open";
  const type = reviewDisplayType(item, stack);
  const confidence = stack?.confidence ?? scoreBand(item.scores.intentConfidence);
  const risk = stack?.risk ?? scoreBand(item.scores.riskScore);
  return (
    <Card as="article" className={`decision-explanation-card ${item.status}`} data-testid={`review-item-${item.outcome}`}>
      <header className="decision-card-heading">
        <div><span className="review-type">{t(`migratePipeline.reviewInbox.types.${type}`)}</span><h4>{decision?.title ?? item.title}</h4></div>
        <div><Badge tone={riskTone(risk)}>{t(`migratePipeline.assessment.risk.${risk}`)}</Badge><Badge tone={item.status === "open" ? "warn" : "neutral"}>{t(`migratePipeline.reviewInbox.status.${item.status}`)}</Badge></div>
      </header>
      {stack ? <a href={`#${stack.id}`} className="related-stack-link"><Layers3 aria-hidden />{t("migratePipeline.reviewInbox.relatedStack")}: {stack.name}</a> : <p className="pipeline-muted">{t("migratePipeline.reviewInbox.relatedStackMissing")}</p>}
      <div className="decision-explanation-grid">
        <DecisionField label={t("migratePipeline.reviewInbox.decision")} value={decision?.title ?? item.title} />
        <DecisionField label={t("migratePipeline.reviewInbox.confidence")} value={t(`migratePipeline.assessment.confidenceValues.${confidence}`)} />
        <DecisionField label={t("migratePipeline.reviewInbox.risk")} value={t(`migratePipeline.assessment.risk.${risk}`)} />
        <DecisionField label={t("migratePipeline.reviewInbox.reason")} value={decision?.reason ?? item.reason} />
        <DecisionField label={t("migratePipeline.reviewInbox.recommended")} value={stack?.recommendedStrategy ?? decision?.options[0]?.label ?? t("migratePipeline.reviewInbox.recommendationUnavailable")} />
        <DecisionField label={t("migratePipeline.reviewInbox.defaultSafeChoice")} value={decision?.defaultSafeChoice ?? t("migratePipeline.reviewInbox.defaultSafeFallback")} />
        <DecisionField label={t("migratePipeline.reviewInbox.requiredInput")} value={item.requiredGates.length ? item.requiredGates.join(" · ") : t("migratePipeline.reviewInbox.chooseOutcome")} />
        <DecisionField label={t("migratePipeline.reviewInbox.impactUnresolved")} value={t("migratePipeline.reviewInbox.unresolvedImpact")} />
        <DecisionField label={t("migratePipeline.reviewInbox.impactPlan")} value={t("migratePipeline.reviewInbox.planImpact")} />
      </div>
      <details open={item.outcome === "required-decision" || item.outcome === "blocker"}>
        <summary>{t("migratePipeline.reviewInbox.evidence", { count: stack?.evidence.length ?? 0 })}</summary>
        {stack?.evidence.length ? <ul>{stack.evidence.map((evidence) => <li key={evidence.id}>{evidence.label}<small>{evidence.source}</small></li>)}</ul> : <p>{t("migratePipeline.reviewInbox.evidenceMissing")}</p>}
      </details>
      <details><summary>{t("migratePipeline.reviewInbox.riskReasons", { count: stack?.riskReasons.length ?? 0 })}</summary>{stack?.riskReasons.length ? <ul>{stack.riskReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : <p>{t("migratePipeline.reviewInbox.noRiskReasons")}</p>}</details>
      {decision?.options.length ? (
        <div className="decision-options-panel">
          <label>{t("migratePipeline.reviewInbox.alternatives")}<select value={optionId} onChange={(event) => setOptionId(event.target.value)}>{decision.options.map((option) => <option key={option.id} value={option.id}>{option.label}{option.risk ? ` — ${option.risk}` : ""}</option>)}</select></label>
        </div>
      ) : null}
      {history.length ? <details><summary>{t("migratePipeline.reviewInbox.history", { count: history.length })}</summary><div className="decision-history-list">{history.slice(0, 5).map((record) => <span key={record.id}>{new Date(record.createdAt).toLocaleString()} · {record.outcome} · {record.profileId}</span>)}</div></details> : <p className="pipeline-muted">{t("migratePipeline.reviewInbox.historyUnavailable")}</p>}
      {item.resolutionNote ? <p className="decision-resolution-note">{item.resolutionNote}</p> : null}
      {actionError ? <p className="pipeline-error"><AlertTriangle aria-hidden />{actionError}</p> : null}
      {open ? (
        <>
          <label className="remember-decision"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />{t("migratePipeline.reviewInbox.rememberPreference")}</label>
          <small className="remember-decision-note">{t("migratePipeline.reviewInbox.rememberBoundary")}</small>
          <div className="decision-action-row">
            <Button variant="primary" disabled={busy || item.outcome === "blocker"} onClick={() => onAction({ item, action: "accept-recommended", optionId: decision?.options[0]?.id, remember })}><CheckCircle2 aria-hidden />{t("migratePipeline.reviewInbox.accept")}</Button>
            <Button variant="secondary" disabled={busy || !optionId} onClick={() => onAction({ item, action: "choose-option", optionId, remember })}>{t("migratePipeline.reviewInbox.chooseAlternative")}</Button>
            <Button variant="secondary" disabled={busy} onClick={() => onAction({ item, action: "record-only", remember })}>{t("migratePipeline.reviewInbox.recordOnly")}</Button>
            <Button variant="secondary" disabled={busy} onClick={() => onAction({ item, action: "manual", remember })}>{t("migratePipeline.reviewInbox.markManual")}</Button>
            <Button variant="ghost" disabled={busy} onClick={() => onAction({ item, action: "defer", remember: false })}>{t("migratePipeline.reviewInbox.defer")}</Button>
          </div>
        </>
      ) : null}
    </Card>
  );
}

function DecisionField({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function AssessmentReportPanel({ assessment, loading, error, onExport }: { assessment: AssessmentSummary; loading: "json" | "markdown" | null; error: string; onExport: (format: "json" | "markdown") => void }) {
  const { t } = useTranslation();
  return (
    <Card as="section" className="assessment-report-panel">
      <header className="assessment-card-heading"><div><p className="eyebrow">{t("migratePipeline.assessment.reportEyebrow")}</p><h3>{t("migratePipeline.assessment.reportTitle")}</h3></div><FileText aria-hidden /></header>
      <div className="assessment-panel-actions">
        <Button variant="secondary" disabled={!assessment.report.jsonAvailable || loading !== null} onClick={() => onExport("json")}><FileJson aria-hidden />{loading === "json" ? t("migratePipeline.assessment.exporting") : t("migratePipeline.assessment.downloadJson")}</Button>
        <Button variant="secondary" disabled={!assessment.report.markdownAvailable || loading !== null} onClick={() => onExport("markdown")}><Download aria-hidden />{loading === "markdown" ? t("migratePipeline.assessment.exporting") : t("migratePipeline.assessment.downloadMarkdown")}</Button>
      </div>
      <p>{t("migratePipeline.assessment.reportIntro")}</p>
      <ul className="assessment-report-boundary"><li>{t("migratePipeline.assessment.reportReadOnly")}</li><li>{t("migratePipeline.assessment.reportNoApply")}</li><li>{t("migratePipeline.assessment.reportNoMutation")}</li><li>{t("migratePipeline.assessment.reportRedacted")}</li></ul>
      {error ? <p className="pipeline-error"><AlertTriangle aria-hidden />{error}</p> : null}
    </Card>
  );
}

function AssessmentState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return <div className="assessment-state"><SearchCheck aria-hidden /><div><strong>{title}</strong><p>{body}</p></div>{action}</div>;
}

function reviewDisplayType(item: ReviewInboxItem, stack?: AssessmentServiceStack): "required-decision" | "suggested-decision" | "blocker" | "manual-confirmation" | "policy-violation" | "record-only" {
  if (item.requiredGates.some((gate) => /policy/i.test(gate))) return "policy-violation";
  if (item.outcome === "blocker") return "blocker";
  if (item.outcome === "record-only" || item.outcome === "hidden-noise") return "record-only";
  if (stack?.migrationReadiness === "manual") return "manual-confirmation";
  return item.outcome === "required-decision" ? "required-decision" : "suggested-decision";
}

function readinessTone(status: AssessmentSummary["readiness"]["status"]): "ok" | "info" | "warn" | "danger" | "neutral" {
  if (status === "blocked-by-missing-evidence") return "danger";
  if (status === "apply-requires-decisions") return "warn";
  if (status === "record-only-recommended") return "neutral";
  return status === "plan-possible" ? "info" : "ok";
}

function riskTone(risk: string): "ok" | "warn" | "danger" | "neutral" {
  return risk === "high" ? "danger" : risk === "medium" ? "warn" : risk === "low" ? "ok" : "neutral";
}

function qualityTone(status: string): "ok" | "warn" | "danger" | "neutral" {
  return status === "ok" ? "ok" : status === "partial" ? "warn" : status === "failed" ? "danger" : "neutral";
}

function scoreBand(score: number): "high" | "medium" | "low" | "unknown" {
  if (!Number.isFinite(score)) return "unknown";
  if (score >= 0.7) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}
