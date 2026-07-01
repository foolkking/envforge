import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requiresReviewInbox } from "./decision-engine/review-inbox.js";
import {
  assessmentReportToMarkdown,
  buildAssessmentSummary,
  type AssessmentSummary
} from "./migration-assessment.js";
import {
  buildMigrationCandidateReport,
  buildMigrationPlanFromCandidates,
  type MigrationCandidateReport,
  type MigrationPlan
} from "./migration-classifier.js";
import type { FullSystemSnapshot } from "./collectors/remote-collector.js";
import type { StoredMigrationSession } from "./runtime-store.js";

export const GOLDEN_SCENARIO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/golden-scenarios"
);

type ServiceStackCategory = AssessmentSummary["serviceStacks"][number]["category"];

export interface GoldenScenarioDefinition {
  id: string;
  name: string;
  goal: string;
  mode: "assessment-first";
  source: { type: "snapshot-fixture"; file: string };
  expected: {
    serviceStacks: ServiceStackCategory[];
    statefulStacks?: ServiceStackCategory[];
    reviewDecisions?: Array<{
      titleIncludes?: string;
      candidateIncludes?: string;
      reasonIncludes?: string;
      relatedServiceStackCategory?: ServiceStackCategory;
    }>;
    readiness: AssessmentSummary["readiness"]["status"][];
    collectors?: Array<{ name: string; status: "ok" | "partial" | "failed" | "skipped" | "unknown" }>;
    reports: { json: true; markdown: true; includes: string[] };
    planOnly?: { minimumItems: number };
    verification?: { status: "fixture-expectation"; signals: string[] };
  };
  security: {
    readOnlyAssessmentCreatesPlan: false;
    readOnlyAssessmentCreatesApproval: false;
    readOnlyAssessmentCreatesApplyRun: false;
    targetMutationPerformed: false;
    reviewDecisionApprovesPlan: false;
    reviewDecisionCreatesApplyRun: false;
    secretsRedacted: true;
    forbiddenValues?: string[];
  };
  limitations: string[];
}

export interface GoldenReviewProjection {
  source: "assessment-required-decision" | "decision-engine-outcome";
  title: string;
  reason: string;
  candidateId?: string;
  relatedServiceStackIds: string[];
  defaultSafeChoice?: string;
  optionIds: string[];
}

export interface GoldenScenarioRun {
  definition: GoldenScenarioDefinition;
  snapshot: FullSystemSnapshot;
  candidateReport: MigrationCandidateReport;
  assessment: AssessmentSummary;
  reviewItems: GoldenReviewProjection[];
  planOnly?: MigrationPlan;
  jsonReport: string;
  markdownReport: string;
  assertions: string[];
}

export async function loadGoldenScenarioDefinitions(root = GOLDEN_SCENARIO_ROOT): Promise<GoldenScenarioDefinition[]> {
  const candidates = (await fs.readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const directories: string[] = [];
  for (const directory of candidates) {
    try {
      await fs.access(path.join(root, directory, "scenario.json"));
      directories.push(directory);
    } catch {
      // Container directories such as failures/ are loaded by their own harness.
    }
  }
  return Promise.all(directories.map(async (directory) => {
    const raw = await fs.readFile(path.join(root, directory, "scenario.json"), "utf8");
    return JSON.parse(raw) as GoldenScenarioDefinition;
  }));
}

export async function runGoldenScenario(
  definition: GoldenScenarioDefinition,
  root = GOLDEN_SCENARIO_ROOT
): Promise<GoldenScenarioRun> {
  const fixtureDirectory = path.join(root, definition.id);
  const snapshot = JSON.parse(await fs.readFile(path.join(fixtureDirectory, definition.source.file), "utf8")) as FullSystemSnapshot;
  const candidateReport = buildMigrationCandidateReport(snapshot, { host: snapshot.system.hostname });
  const assessment = buildAssessmentSummary({
    session: sessionFor(definition, snapshot),
    snapshot,
    report: candidateReport,
    host: snapshot.system.hostname,
    generatedAt: snapshot.collectedAt,
    envForgeVersion: "golden-fixture",
    catalogVersion: "repository-catalog"
  });
  const reviewItems = reviewProjection(assessment, candidateReport);
  const planOnly = definition.expected.planOnly
    ? buildMigrationPlanFromCandidates(candidateReport)
    : undefined;
  const jsonReport = JSON.stringify(assessment, null, 2);
  const markdownReport = assessmentReportToMarkdown(assessment);
  const run: GoldenScenarioRun = {
    definition,
    snapshot,
    candidateReport,
    assessment,
    reviewItems,
    planOnly,
    jsonReport,
    markdownReport,
    assertions: []
  };
  assertGoldenScenario(run);
  return run;
}

export async function runAllGoldenScenarios(root = GOLDEN_SCENARIO_ROOT): Promise<GoldenScenarioRun[]> {
  const definitions = await loadGoldenScenarioDefinitions(root);
  const runs: GoldenScenarioRun[] = [];
  for (const definition of definitions) runs.push(await runGoldenScenario(definition, root));
  return runs;
}

function assertGoldenScenario(run: GoldenScenarioRun): void {
  const { definition, assessment, reviewItems, planOnly, jsonReport, markdownReport } = run;
  const expected = definition.expected;
  invariant(assessment.availability === "ready" || assessment.availability === "collector-incomplete", definition.id, "Assessment was not generated");
  run.assertions.push("assessment-generated");

  const categories = new Set(assessment.serviceStacks.map((stack) => stack.category));
  for (const category of expected.serviceStacks) invariant(categories.has(category), definition.id, `missing Service Stack category ${category}`);
  run.assertions.push("service-stacks");

  for (const category of expected.statefulStacks ?? []) {
    invariant(assessment.serviceStacks.some((stack) => stack.category === category && stack.statefulness !== "stateless"), definition.id, `${category} is not stateful`);
  }
  invariant(expected.readiness.includes(assessment.readiness.status), definition.id, `unexpected readiness ${assessment.readiness.status}`);
  invariant(Number.isFinite(assessment.evidenceQuality.completeness), definition.id, "evidence completeness missing");
  run.assertions.push("evidence-quality-and-readiness");

  for (const collector of expected.collectors ?? []) {
    const actual = assessment.evidenceQuality.collectors.find((item) => item.name === collector.name);
    invariant(actual?.status === collector.status, definition.id, `collector ${collector.name} expected ${collector.status}, got ${actual?.status ?? "missing"}`);
  }

  for (const decision of expected.reviewDecisions ?? []) {
    const matched = reviewItems.find((item) =>
      (!decision.titleIncludes || includes(item.title, decision.titleIncludes))
      && (!decision.candidateIncludes || includes(item.candidateId ?? "", decision.candidateIncludes))
      && (!decision.reasonIncludes || includes(item.reason, decision.reasonIncludes))
      && (!decision.relatedServiceStackCategory || item.relatedServiceStackIds.some((stackId) =>
        assessment.serviceStacks.some((stack) => stack.id === stackId && stack.category === decision.relatedServiceStackCategory)
      ))
    );
    invariant(Boolean(matched), definition.id, `missing Review decision ${JSON.stringify(decision)}`);
  }
  for (const item of reviewItems) {
    invariant(item.relatedServiceStackIds.length > 0, definition.id, `Review item ${item.title} has no related Service Stack`);
    invariant(item.relatedServiceStackIds.every((stackId) => assessment.serviceStacks.some((stack) => stack.id === stackId)), definition.id, `Review item ${item.title} references a missing Service Stack`);
  }
  run.assertions.push("review-decisions");

  if (expected.planOnly) invariant((planOnly?.items.length ?? 0) >= expected.planOnly.minimumItems, definition.id, "plan-only projection is empty");
  else invariant(planOnly === undefined, definition.id, "Assessment-only scenario must not build a plan-only projection");
  invariant(expected.reports.json && jsonReport.length > 0, definition.id, "JSON report missing");
  invariant(expected.reports.markdown && markdownReport.length > 0, definition.id, "Markdown report missing");
  for (const text of expected.reports.includes) {
    invariant(includes(`${jsonReport}\n${markdownReport}`, text), definition.id, `report text missing: ${text}`);
  }
  for (const secret of definition.security.forbiddenValues ?? []) {
    invariant(!jsonReport.includes(secret) && !markdownReport.includes(secret), definition.id, `secret leaked into report: ${secret}`);
  }
  for (const boundary of [
    "This assessment was generated in read-only mode.",
    "No apply run was created.",
    "No target mutation was performed.",
    "Sensitive values are redacted by default."
  ]) invariant(markdownReport.includes(boundary), definition.id, `read-only report boundary missing: ${boundary}`);
  run.assertions.push("reports-and-redaction");

  invariant(definition.security.readOnlyAssessmentCreatesPlan === false, definition.id, "fixture must forbid Assessment Plan creation");
  invariant(definition.security.readOnlyAssessmentCreatesApproval === false, definition.id, "fixture must forbid Assessment approval");
  invariant(definition.security.readOnlyAssessmentCreatesApplyRun === false, definition.id, "fixture must forbid Assessment Apply Run");
  invariant(definition.security.targetMutationPerformed === false, definition.id, "fixture must forbid target mutation");
  invariant(definition.security.reviewDecisionApprovesPlan === false, definition.id, "fixture must keep Review separate from approval");
  invariant(definition.security.reviewDecisionCreatesApplyRun === false, definition.id, "fixture must keep Review separate from Apply");
  invariant(definition.security.secretsRedacted === true, definition.id, "fixture must require redaction");
  invariant(definition.limitations.length > 0, definition.id, "limitations must be documented");
  run.assertions.push("read-only-security-boundary", "limitations-documented");
}

function reviewProjection(assessment: AssessmentSummary, report: MigrationCandidateReport): GoldenReviewProjection[] {
  const required = assessment.requiredDecisions.map((decision) => ({
    source: "assessment-required-decision" as const,
    title: decision.title,
    reason: decision.reason,
    relatedServiceStackIds: decision.relatedServiceStackIds,
    defaultSafeChoice: decision.defaultSafeChoice,
    optionIds: decision.options.map((option) => option.id)
  }));
  const engine = report.candidates
    .filter((candidate) => candidate.decisionOutcome !== undefined && requiresReviewInbox(candidate.decisionOutcome))
    .map((candidate) => ({
      source: "decision-engine-outcome" as const,
      title: candidate.name,
      reason: [...(candidate.reviewReasons ?? []), ...(candidate.blockers ?? [])].join(" "),
      candidateId: candidate.id,
      relatedServiceStackIds: [`stack:${candidate.id}`],
      optionIds: ["record-only", "manual"]
    }));
  return dedupeReviewItems([...required, ...engine]);
}

function dedupeReviewItems(items: GoldenReviewProjection[]): GoldenReviewProjection[] {
  const byIdentity = new Map<string, GoldenReviewProjection>();
  for (const item of items) byIdentity.set(`${item.source}:${item.title}:${item.candidateId ?? ""}`, item);
  return [...byIdentity.values()];
}

function sessionFor(definition: GoldenScenarioDefinition, snapshot: FullSystemSnapshot): StoredMigrationSession {
  return {
    id: `golden-${definition.id}`,
    userId: "golden-harness",
    connectionId: `fixture-${definition.id}`,
    status: "analysis-ready",
    currentStep: "analysis",
    createdAt: snapshot.collectedAt,
    updatedAt: snapshot.collectedAt
  };
}

function invariant(condition: unknown, scenarioId: string, message: string): asserts condition {
  if (!condition) throw new Error(`[${scenarioId}] ${message}`);
}

function includes(value: string, expected: string): boolean {
  return value.toLocaleLowerCase().includes(expected.toLocaleLowerCase());
}
