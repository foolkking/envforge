import type { FastifyInstance } from "fastify";
import { collectSnapshotInputs } from "@fool/collectors";
import { createSnapshotManifest, defaultPolicy, diffSnapshots } from "@fool/core";
import { createRestorePlan } from "@fool/restorers";
import { getUserByToken, loginUser, registerUser, startRegistration, verifyRegistration, toPublicUser, updateUserProfile } from "./auth.js";
import {
  getAuthorizeUrl as getGitHubAuthorizeUrl,
  exchangeCodeForToken as exchangeGitHubCode,
  fetchProfile as fetchGitHubProfile,
  getGoogleAuthorizeUrl,
  exchangeGoogleCode,
  fetchGoogleProfile,
  verifyState,
  findOrCreateFromOAuth,
  linkIdentityToUser,
  listIdentities,
  unlinkIdentity,
  EmailConflictError,
  IdentityAlreadyLinkedError,
  LastLoginMethodError,
  createSessionToken,
  getSessionTtlMs,
  TWOFA_PENDING_TTL_MS,
  ENROLLMENT_REQUIRED_TTL_MS,
  enrollTotp,
  confirmTotp,
  disableTotp,
  regenerateTotpRecoveryCodes,
  getTotpStatus,
  TotpError,
  login2FA,
  Login2FAError,
  resolveSession,
  updateMyProfile,
  requestEmailChange,
  confirmEmailChange,
  changePassword,
  softDeleteUser,
  getNotificationPrefs,
  updateNotificationPrefs,
  getUserActivity,
  verifyTotp,
  requestPasswordReset,
  confirmPasswordReset,
  PasswordResetError
} from "./auth/index.js";
import { listCurrentUser } from "./catalog.js";
import { getConfig } from "./config.js";
import { createConnection, reprobeConnection, listUserConnections } from "./connections.js";
import { createUserProfile, listUserProfiles, getUserProfile, updateUserProfile as updateProfile, deleteUserProfile, listAllPublicProfilesAsCatalog, createVmSnapshot } from "./profiles.js";
import { buildInstallTask, buildSnapshotDeployTask, executeTask, getTask, subscribeTask } from "./executor.js";
import { listCatalogFromDatabase, listMigrationStrategies, readCatalogGuide } from "./database.js";
import { runReadinessChecks } from "./readiness.js";
import { readRuntimeDatabase, updateRuntimeDatabase, createId, writeAdminAuditLog, readAdminAuditLogs, addComment, getComments, toggleCommentLike, reportComment, getAdminReports, resolveReport, syncCommentsFts, addSuggestion, getSuggestions, getSuggestionById, processSuggestion, addInboxMessage, getUnreadInboxCount, type CapabilityRequirementSectionState, type CapabilityStandardProfile, type StoredMigrationConfigDecision, type StoredMigrationDataDecision, type StoredMigrationDecision, type StoredMigrationSession, type StoredMigrationSessionRun, type StoredConnection } from "./runtime-store.js";
import { enqueueEmail } from "./email/index.js";
import { listSnapshots, persistSnapshot } from "./snapshot-store.js";
import { probeAgent, pingAgent } from "./probe.js";
import { ConfigConnectionError, listConfigFiles, readConfigFile, writeConfigFile, readConfigFileWithBackup, getConfigRollbackPreview, restoreConfigFileFromBackup, validateConfigFile } from "./config-files.js";
import { buildMigrationCandidateReport, buildMigrationPlanFromCandidates } from "./migration-classifier.js";
import { exportMigrationPlan, type MigrationExportFormat } from "./migration-exporter.js";
import { buildMigrationDryRun } from "./migration-dry-run.js";
import { buildMigrationVerificationPreview } from "./migration-verify.js";
import { buildUnknownReviewQueue, decisionMap } from "./migration-review.js";
import { runMigrationVerificationPreview } from "./migration-verify-runner.js";
import { assessMigrationApplyReadiness } from "./migration-apply-readiness.js";
import { runMigrationApplyPlan, type MigrationApplyOptions } from "./migration-apply-runner.js";
import { buildMigrationSessionArtifacts, initialMigrationSessionState, isMigrationSessionStatus, isMigrationSessionStep } from "./migration-session.js";
import { buildConfigChangePlan, buildConfigMigrationPlan, buildImportedRecipePlan, buildPlanReport, buildRebuildPlan, buildRemovePlan, buildRepairPlan, evaluateApplyGate, migrationPlanToEnvironmentPlan, planReportToMarkdown, type EnvironmentPlan, type EnvironmentPlanStatus, type PlanApprovalState, type RepairFailure } from "./environment-plan.js";
import {
  appendPlanHistory,
  asEnvironmentPlan,
  getEnvironmentPlan as getStoredPlan,
  listEnvironmentPlans as listStoredPlans,
  mutateEnvironmentPlan,
  saveEnvironmentPlan,
  setPlanStatus
} from "./plan-store.js";
import { rollbackPlanAndPersist, verifyPlanAndPersist } from "./plan-runner.js";

/**
 * Build Mode helper: derive existing capabilities + snapshot freshness
 * from a target connection. Used by `/api/plans` so the rebuild planner
 * can emit target-state conflicts and label `targetStateConfidence`.
 *
 * The match is intentionally conservative — we only resolve a
 * capabilityKey when the target's reported software list contains an
 * exact name match for one of the catalog item's components. This
 * avoids over-reporting (e.g. confusing `python3` with `python-toolchain`).
 */
function computeTargetSnapshotMeta(
  connection: StoredConnection,
  catalogItems: Array<{ id: string; capabilityKey?: string; components?: Array<{ label: string }> }>
): {
  existingCapabilities: Record<string, string>;
  available: boolean;
  ageMs?: number;
} {
  const snap = connection.probeSnapshot;
  if (!snap) return { existingCapabilities: {}, available: false };
  const collectedAt = new Date(snap.collectedAt).getTime();
  const ageMs = Number.isFinite(collectedAt) ? Math.max(0, Date.now() - collectedAt) : undefined;
  const existing: Record<string, string> = {};
  const installedNames = new Set((snap.software ?? []).map((sw) => `${sw.name}`.toLowerCase()));
  for (const item of catalogItems) {
    if (!item.capabilityKey) continue;
    const labels = (item.components ?? []).map((c) => `${c.label}`.toLowerCase());
    const hit = labels.find((label) => installedNames.has(label));
    if (hit) {
      existing[item.capabilityKey] = `target reports software \`${hit}\` installed (catalog item \`${item.id}\`)`;
    }
  }
  return { existingCapabilities: existing, available: true, ageMs };
}

function mergeAcks(
  stored: PlanApprovalState | undefined,
  fresh: {
    risks?: Array<{ itemId: string; risks: string[] }>;
    conflicts?: Array<{ conflictId: string; resolutionId?: string }>;
    approvals?: Array<{ itemId: string; gateId: string }>;
  }
): {
  risks: Record<string, string[]>;
  conflicts: Array<{ conflictId: string; resolutionId?: string }>;
  approvals: Array<{ itemId: string; gateId: string }>;
} {
  const risks: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(stored?.risks ?? {})) {
    risks[key] = [...value];
  }
  for (const entry of fresh.risks ?? []) {
    risks[entry.itemId] = [...new Set([...(risks[entry.itemId] ?? []), ...entry.risks])];
  }
  const conflictMap = new Map<string, { conflictId: string; resolutionId?: string }>();
  for (const entry of stored?.conflicts ?? []) {
    conflictMap.set(entry.conflictId, { conflictId: entry.conflictId, resolutionId: entry.resolutionId });
  }
  for (const entry of fresh.conflicts ?? []) {
    conflictMap.set(entry.conflictId, entry);
  }
  const approvalKey = (entry: { itemId: string; gateId: string }) => `${entry.itemId}::${entry.gateId}`;
  const approvalMap = new Map<string, { itemId: string; gateId: string }>();
  for (const entry of stored?.approvals ?? []) {
    approvalMap.set(approvalKey(entry), { itemId: entry.itemId, gateId: entry.gateId });
  }
  for (const entry of fresh.approvals ?? []) {
    approvalMap.set(approvalKey(entry), entry);
  }
  return {
    risks,
    conflicts: [...conflictMap.values()],
    approvals: [...approvalMap.values()]
  };
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/health", async () => ({
    ok: true,
    service: "envforge-api",
    version: "0.1.0",
    env: getConfig().nodeEnv
  }));

  app.get("/api/ready", async (request, reply) => {
    const result = await runReadinessChecks(getConfig());
    if (!result.ok) reply.code(503);
    return result;
  });

  app.post("/api/scan", async (request) => {
    const body = (request.body ?? {}) as { user?: string; persist?: boolean };
    const inputs = await collectSnapshotInputs(defaultPolicy);
    const manifest = createSnapshotManifest({
      user: body.user ?? "default",
      machine: inputs.machine,
      collectors: inputs.collectors,
      redactions: inputs.redactions
    });

    if (!body.persist) {
      return { manifest, persisted: false };
    }

    const paths = await persistSnapshot(manifest);
    return { manifest, persisted: true, paths };
  });

  app.get("/api/snapshots", async () => {
    return {
      snapshots: await listSnapshots()
    };
  });

  // 列出当前用户的已连接机器（从数据库读取，不再返回静态样例）
  app.get("/api/targets", async (request) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) {
      // 未登录时返回空列表
      return { targets: [] };
    }
    const db = await readRuntimeDatabase();
    const connections = db.connections.filter((c) => c.userId === user.id);
    return { targets: connections };
  });

  // 探测目标 agent，返回真实系统信息
  // agentUrl 示例：http://127.0.0.1:4001
  app.post("/api/targets/probe", async (request, reply) => {
    const body = (request.body ?? {}) as { agentUrl?: string };
    if (!body.agentUrl) {
      reply.code(400);
      return { error: "agentUrl is required. Example: http://127.0.0.1:4001" };
    }

    // 只允许 http/https，防止 SSRF 到内部协议
    let parsed: URL;
    try {
      parsed = new URL(body.agentUrl);
    } catch {
      reply.code(400);
      return { error: "agentUrl is not a valid URL." };
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      reply.code(400);
      return { error: "agentUrl must use http or https." };
    }

    const result = await probeAgent(body.agentUrl);
    if (!result.reachable) {
      reply.code(502);
    }
    return result;
  });

  // 仅 ping agent，检查是否在线
  app.post("/api/targets/ping", async (request, reply) => {
    const body = (request.body ?? {}) as { agentUrl?: string };
    if (!body.agentUrl) {
      reply.code(400);
      return { error: "agentUrl is required." };
    }
    const online = await pingAgent(body.agentUrl);
    return { online, agentUrl: body.agentUrl };
  });

  app.get("/api/catalog", async (request) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    const isAdmin = user?.role === "admin";
    const includeAll = isAdmin && (request.query as { include?: string })?.include === "all";
    const [items, db] = await Promise.all([listCatalogFromDatabase(), readRuntimeDatabase()]);
    const stats = db.catalogStats ?? {};
    const { annotateCertification, filterUserVisible } = await import("./catalog-certification.js");
    // Annotate every item with its certification metadata so the UI
    // can render the admin registry, then optionally filter for the
    // end-user Build / Migrate / Maintain surface.
    const annotated = annotateCertification(items);
    const visible = includeAll ? annotated : annotateCertification(filterUserVisible(items));
    const enriched = visible.map((item) => {
      const real = stats[item.id]?.installs ?? 0;
      if (real > 0) {
        return { ...item, installs: formatInstallCount(real), realInstalls: real };
      }
      return item;
    });
    return {
      items: enriched,
      meta: {
        total: items.length,
        certified: annotated.filter((i) => i.certification.status === "certified").length,
        notReady: annotated.filter((i) => i.certification.status === "not-ready").length,
        viewer: includeAll ? "admin-all" : "user-certified-only"
      }
    };
  });

  /**
   * GET /api/catalog/certification (admin only)
   *
   * Admin registry view: returns every catalog item with its full
   * certification metadata, missing requirements summary, and total
   * counts. End users use the filtered `/api/catalog` instead.
   */
  app.get("/api/catalog/certification", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") {
      reply.code(403);
      return { error: "Admin only." };
    }
    const items = await listCatalogFromDatabase();
    const { annotateCertification } = await import("./catalog-certification.js");
    const annotated = annotateCertification(items);
    return {
      items: annotated.map((item) => ({
        id: item.id,
        capabilityKey: item.capabilityKey,
        name: item.nameEn || item.name,
        category: item.category,
        certification: item.certification
      })),
      meta: {
        total: annotated.length,
        certified: annotated.filter((i) => i.certification.status === "certified").length,
        notReady: annotated.filter((i) => i.certification.status === "not-ready").length
      }
    };
  });

  /**
   * GET /api/build/:targetId/suggestions
   *
   * Returns a list of CERTIFIED capabilities the planner recommends
   * for the target. End users always get a certified-only list — the
   * server filters not-ready items out before returning.
   *
   * Suggestion sources (today):
   *   - Target Snapshot evidence: when nginx/docker/ssh-hardening is
   *     either missing or already running but unmanaged.
   *
   * Future sources (security-baseline gap analysis, common combos,
   * conflict-repair) plug in here without changing the contract; the
   * filter at the bottom guarantees not-ready items never leak.
   */
  app.get("/api/build/:targetId/suggestions", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { targetId } = request.params as { targetId: string };
    const db = await readRuntimeDatabase();
    const conn = db.connections.find((c) => c.id === targetId && c.userId === user.id);
    if (!conn) { reply.code(404); return { error: "Connection not found." }; }
    const items = await listCatalogFromDatabase();
    const { deriveCertification } = await import("./catalog-certification.js");

    // Build a tiny suggestion engine: for each certified item we know
    // about, decide whether the target evidence justifies recommending
    // it. Detect-only / not-ready items never enter this path.
    const installedNames = new Set((conn.probeSnapshot?.software ?? []).map((sw) => sw.name.toLowerCase()));
    const suggestions: Array<{
      id: string;
      capabilityId: string;
      capabilityKey?: string;
      name: string;
      reason: string;
      evidence: string[];
      riskLevel: string;
      certified: true;
      canAddToPlan: boolean;
      requiresManualSteps: boolean;
      touchesData: boolean;
      touchesSecrets: boolean;
      actions: string[];
    }> = [];
    for (const item of items) {
      const cert = deriveCertification(item);
      if (cert.status !== "certified") continue;
      const componentNames = (item.components ?? [])
        .map((c) => c.label.toLowerCase())
        .filter(Boolean);
      const alreadyInstalled = componentNames.some((name) => installedNames.has(name));
      const reason = alreadyInstalled
        ? `Target already runs ${componentNames.find((n) => installedNames.has(n))}; reconcile through an Environment Plan to bring it under EnvForge management.`
        : `Target is missing ${item.nameEn || item.name}; the certified rule can install + verify + rollback safely.`;
      suggestions.push({
        id: `suggest:${item.id}:${alreadyInstalled ? "reconcile" : "install"}`,
        capabilityId: item.id,
        capabilityKey: item.capabilityKey,
        name: item.nameEn || item.name,
        reason,
        evidence: alreadyInstalled
          ? [`probeSnapshot.software contains ${componentNames.find((n) => installedNames.has(n))}`]
          : ["target snapshot does not list this capability"],
        riskLevel: item.sensitivity === "privileged" ? "privileged" : item.sensitivity === "review" ? "review" : "safe",
        certified: true,
        canAddToPlan: true,
        requiresManualSteps: item.id === "ssh-hardening",
        touchesData: false,
        touchesSecrets: item.sensitivity === "privileged",
        actions: ["accept", "dismiss", "snooze", "view-reasoning"]
      });
    }
    return { suggestions };
  });

  /**
   * GET /api/admin/package-integrations (admin only)
   *
   * Rule-level Package Integrations registry. Surfaces every catalog
   * capability that has a backing CatalogDetectionRule along with its
   * cross-distro package map, service map, binary detection, config
   * paths, default ports, secret patterns, validate / rollback hooks,
   * and data-strategy hints.
   *
   * This is NOT a host-level package manager — it shows the rule
   * shape that drives detection, install planning, validation, and
   * rollback. Admins use it to spot mapping gaps that prevent a
   * capability from clearing Full Migration Certification.
   */
  app.get("/api/admin/package-integrations", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") {
      reply.code(403);
      return { error: "Admin only." };
    }
    const items = await listCatalogFromDatabase();
    const { catalogDetectionRules } = await import("./catalog-rules.js");
    const { deriveCertification } = await import("./catalog-certification.js");
    const ruleById = new Map(catalogDetectionRules.map((r) => [r.id, r]));
    const ruleByCapKey = new Map(catalogDetectionRules.map((r) => [r.capabilityKey, r]));
    // Curated alias map: the certified catalog items wrap a specific
    // CatalogDetectionRule whose id differs from the catalog item id.
    // This map keeps the matching honest without relying on brittle
    // string heuristics.
    const ruleAlias: Record<string, string> = {
      "nginx-web-service": "nginx",
      "docker-host-profile": "docker",
      "ssh-hardening": "ssh"
    };
    const findRule = (id: string, capabilityKey?: string) => {
      return ruleById.get(id)
        ?? (capabilityKey ? ruleByCapKey.get(capabilityKey) : undefined)
        ?? (ruleAlias[id] ? ruleById.get(ruleAlias[id]) : undefined);
    };
    const integrations = items.map((item) => {
      const rule = findRule(item.id, item.capabilityKey);
      const cert = deriveCertification(item);
      return {
        id: item.id,
        capabilityKey: item.capabilityKey,
        name: item.nameEn || item.name,
        category: item.category,
        certification: cert,
        hasRule: Boolean(rule),
        ruleSummary: rule
          ? {
              packageMap: rule.crossDistro?.packageMap ?? {},
              serviceMap: rule.crossDistro?.serviceMap ?? {},
              binaries: rule.detect.binaries ?? [],
              systemd: rule.detect.systemd ?? [],
              ports: rule.detect.ports ?? [],
              configFiles: rule.config?.files ?? [],
              configGlobs: rule.config?.globs ?? [],
              secretPatterns: rule.config?.secretPatterns ?? [],
              dataPaths: rule.data?.paths ?? [],
              validate: rule.migrate?.validate ?? [],
              restartServices: rule.migrate?.restartServices ?? [],
              dataStrategy: rule.migrate?.data ?? "none",
              migrationStrategy: rule.migrate?.strategy
            }
          : null
      };
    });
    return {
      items: integrations,
      meta: {
        total: integrations.length,
        withRule: integrations.filter((i) => i.hasRule).length,
        withoutRule: integrations.filter((i) => !i.hasRule).length
      }
    };
  });

  /**
   * GET /api/admin/package-integrations/:capabilityId (admin only)
   *
   * Detailed package-integration view for a single capability, used by
   * the Package Integrations detail panel in Capability Admin.
   */
  app.get("/api/admin/package-integrations/:capabilityId", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") {
      reply.code(403);
      return { error: "Admin only." };
    }
    const { capabilityId } = request.params as { capabilityId: string };
    const items = await listCatalogFromDatabase();
    const item = items.find((i) => i.id === capabilityId);
    if (!item) {
      reply.code(404);
      return { error: "Capability not found." };
    }
    const { catalogDetectionRules } = await import("./catalog-rules.js");
    const { deriveCertification } = await import("./catalog-certification.js");
    const ruleAlias: Record<string, string> = {
      "nginx-web-service": "nginx",
      "docker-host-profile": "docker",
      "ssh-hardening": "ssh"
    };
    const rule = catalogDetectionRules.find((r) => r.id === capabilityId)
      ?? (item.capabilityKey ? catalogDetectionRules.find((r) => r.capabilityKey === item.capabilityKey) : undefined)
      ?? (ruleAlias[capabilityId] ? catalogDetectionRules.find((r) => r.id === ruleAlias[capabilityId]) : undefined);
    return {
      id: item.id,
      capabilityKey: item.capabilityKey,
      name: item.nameEn || item.name,
      category: item.category,
      certification: deriveCertification(item),
      rule: rule ?? null
    };
  });

  /**
   * Admin-maintained capability standards.
   *
   * This is the online-maintainable layer on top of the source-controlled
   * baseline. Publishing a requirement version records governance state; it
   * does not directly bypass the existing Full Migration runtime gate.
   */
  app.get("/api/admin/capability-standards", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") {
      reply.code(403);
      return { error: "Admin only." };
    }
    const db = await readRuntimeDatabase();
    const { listStandardProfiles, getActiveStandardProfile } = await import("./capability-standards.js");
    const profiles = listStandardProfiles(db);
    return { profiles, activeProfileId: getActiveStandardProfile(db).id };
  });

  app.post("/api/admin/capability-standards", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") {
      reply.code(403);
      return { error: "Admin only." };
    }
    const body = (request.body ?? {}) as {
      key?: string;
      name?: string;
      description?: string;
      sections?: Array<{
        id?: string;
        label?: string;
        description?: string;
        required?: boolean;
        allowNotApplicable?: boolean;
        severity?: "required" | "critical" | "advisory";
        schema?: unknown;
      }>;
    };
    if (!body.key?.trim() || !body.name?.trim()) {
      reply.code(400);
      return { error: "key and name are required." };
    }
    const { normalizeStandardProfileSections, listStandardProfiles } = await import("./capability-standards.js");
    const normalized = normalizeStandardProfileSections(body.sections ?? []);
    if ("error" in normalized) {
      reply.code(400);
      return { error: normalized.error };
    }
    const now = new Date().toISOString();
    const created = await updateRuntimeDatabase((database) => {
      const key = body.key!.trim();
      const version = Math.max(0, ...listStandardProfiles(database).filter((entry) => entry.key === key).map((entry) => entry.version)) + 1;
      const profile: CapabilityStandardProfile = {
        id: createId("std"),
        key,
        name: body.name!.trim(),
        version,
        status: "draft" as const,
        description: body.description?.trim(),
        sections: normalized.sections,
        createdAt: now,
        updatedAt: now,
        createdBy: user.id,
        updatedBy: user.id
      };
      database.capabilityStandardProfiles = database.capabilityStandardProfiles ?? [];
      database.capabilityStandardProfiles.push(profile);
      return profile;
    });
    await writeAdminAuditLog(user.id, "capabilityStandard.create", created.id, null, JSON.stringify(created), null);
    return { profile: created };
  });

  app.patch("/api/admin/capability-standards/:id", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") {
      reply.code(403);
      return { error: "Admin only." };
    }
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as {
      name?: string;
      description?: string;
      status?: "draft" | "active" | "retired";
      sections?: Array<{
        id?: string;
        label?: string;
        description?: string;
        required?: boolean;
        allowNotApplicable?: boolean;
        severity?: "required" | "critical" | "advisory";
        schema?: unknown;
      }>;
    };
    if (body.name !== undefined && !body.name.trim()) {
      reply.code(400);
      return { error: "name cannot be empty." };
    }
    if (body.status !== undefined && !["draft", "active", "retired"].includes(body.status)) {
      reply.code(400);
      return { error: "invalid profile status." };
    }
    const { ensureMutableStandardProfile, normalizeStandardProfileSections } = await import("./capability-standards.js");
    const normalizedSections = body.sections !== undefined ? normalizeStandardProfileSections(body.sections) : null;
    if (normalizedSections && "error" in normalizedSections) {
      reply.code(400);
      return { error: normalizedSections.error };
    }
    const now = new Date().toISOString();
    let updated: unknown = null;
    const result = await updateRuntimeDatabase((database) => {
      database.capabilityStandardProfiles = database.capabilityStandardProfiles ?? [];
      const profile = ensureMutableStandardProfile(database, id, user.id, now);
      if (!profile) return { error: "Profile not found." } as const;
      const before = JSON.stringify(profile);
      if (body.name !== undefined) profile.name = body.name.trim();
      if (body.description !== undefined) profile.description = body.description.trim();
      if (body.status !== undefined) {
        if (body.status === "retired" && profile.status === "active") {
          const hasReplacement = database.capabilityStandardProfiles.some(
            (entry) => entry.key === profile.key && entry.id !== profile.id && entry.status === "active"
          );
          if (!hasReplacement) return { error: "cannot retire the last active profile for this key." } as const;
        }
        if (body.status === "active") {
          for (const entry of database.capabilityStandardProfiles ?? []) {
            if (entry.key === profile.key && entry.id !== profile.id && entry.status === "active") {
              entry.status = "retired";
              entry.updatedAt = now;
              entry.updatedBy = user.id;
            }
          }
        }
        profile.status = body.status;
      }
      if (body.sections !== undefined) {
        if (!normalizedSections || "error" in normalizedSections) return { error: "invalid sections." } as const;
        profile.sections = normalizedSections.sections;
        profile.version += 1;
      }
      profile.updatedAt = now;
      profile.updatedBy = user.id;
      updated = { before, after: JSON.stringify(profile), profile };
      return { ok: true } as const;
    });
    if ("error" in result) {
      reply.code(result.error === "Profile not found." ? 404 : 400);
      return { error: result.error };
    }
    const audit = updated as { before: string; after: string; profile: unknown } | null;
    if (audit) {
      await writeAdminAuditLog(user.id, "capabilityStandard.update", id, audit.before, audit.after, null);
      return { profile: audit.profile };
    }
    return { ok: true };
  });

  app.post("/api/admin/capability-standards/:id/clone", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") {
      reply.code(403);
      return { error: "Admin only." };
    }
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as {
      key?: string;
      name?: string;
      description?: string;
      status?: "draft" | "active";
    };
    if (body.status !== undefined && !["draft", "active"].includes(body.status)) {
      reply.code(400);
      return { error: "invalid profile status." };
    }
    const { listStandardProfiles } = await import("./capability-standards.js");
    const now = new Date().toISOString();
    const result = await updateRuntimeDatabase((database) => {
      const source = listStandardProfiles(database).find((entry) => entry.id === id);
      if (!source) return { error: "Profile not found." } as const;
      const key = body.key?.trim() || source.key;
      const version = Math.max(0, ...listStandardProfiles(database).filter((entry) => entry.key === key).map((entry) => entry.version)) + 1;
      const status = body.status ?? "draft";
      database.capabilityStandardProfiles = database.capabilityStandardProfiles ?? [];
      if (status === "active") {
        for (const entry of database.capabilityStandardProfiles) {
          if (entry.key === key && entry.status === "active") {
            entry.status = "retired";
            entry.updatedAt = now;
            entry.updatedBy = user.id;
          }
        }
      }
      const profile: CapabilityStandardProfile = {
        id: createId("std"),
        key,
        name: body.name?.trim() || `${source.name} v${version}`,
        version,
        status,
        description: body.description?.trim() || source.description,
        sections: source.sections.map((section) => ({ ...section })),
        createdAt: now,
        updatedAt: now,
        createdBy: user.id,
        updatedBy: user.id
      };
      database.capabilityStandardProfiles.push(profile);
      return { profile } as const;
    });
    if ("error" in result) {
      reply.code(404);
      return { error: result.error };
    }
    await writeAdminAuditLog(user.id, "capabilityStandard.clone", result.profile.id, id, JSON.stringify(result.profile), null);
    return { profile: result.profile };
  });

  app.get("/api/admin/capabilities/:id/requirements", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") {
      reply.code(403);
      return { error: "Admin only." };
    }
    const { id } = request.params as { id: string };
    const query = request.query as { profileId?: string };
    const items = await listCatalogFromDatabase();
    const item = items.find((entry) => entry.id === id);
    if (!item) {
      reply.code(404);
      return { error: "Capability not found." };
    }
    const db = await readRuntimeDatabase();
    const { deriveCertification } = await import("./catalog-certification.js");
    const {
      getActiveStandardProfile,
      findCurrentRequirementDraft,
      latestCertificationRun,
      listRequirementVersions,
      seedRequirementSectionsFromCertification
    } = await import("./capability-standards.js");
    const profile = getActiveStandardProfile(db, query.profileId);
    const certification = deriveCertification(item);
    const draft = findCurrentRequirementDraft(db, id, profile.id);
    const versions = listRequirementVersions(db, id, profile.id);
    const currentVersion = versions.find((version) => version.status === "published");
    const projectedSections = draft?.sections
      ?? currentVersion?.sections
      ?? seedRequirementSectionsFromCertification(profile, certification);
    return {
      item: {
        id: item.id,
        capabilityKey: item.capabilityKey,
        name: item.nameEn || item.name,
        category: item.category
      },
      activeProfile: profile,
      certification,
      draft: draft ?? null,
      currentVersion: currentVersion ?? null,
      versions,
      latestRun: latestCertificationRun(db, id, profile.id) ?? null,
      projectedSections
    };
  });

  app.patch("/api/admin/capabilities/:id/requirements/draft", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") {
      reply.code(403);
      return { error: "Admin only." };
    }
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as {
      profileId?: string;
      sections?: Record<string, Partial<CapabilityRequirementSectionState>>;
      ruleOverlay?: unknown;
      note?: string;
    };
    const items = await listCatalogFromDatabase();
    if (!items.some((entry) => entry.id === id)) {
      reply.code(404);
      return { error: "Capability not found." };
    }
    const now = new Date().toISOString();
    const { getActiveStandardProfile, findCurrentRequirementDraft, normalizeRequirementSections } = await import("./capability-standards.js");
    let saved: unknown = null;
    await updateRuntimeDatabase((database) => {
      const profile = getActiveStandardProfile(database, body.profileId);
      database.capabilityRequirementDrafts = database.capabilityRequirementDrafts ?? [];
      let draft = findCurrentRequirementDraft(database, id, profile.id);
      if (!draft) {
        draft = {
          id: createId("reqdraft"),
          capabilityId: id,
          profileId: profile.id,
          draftVersion: 1,
          status: "draft",
          sections: normalizeRequirementSections(profile, body.sections),
          ruleOverlay: body.ruleOverlay,
          note: body.note,
          createdAt: now,
          updatedAt: now,
          createdBy: user.id,
          updatedBy: user.id
        };
        database.capabilityRequirementDrafts.push(draft);
      } else {
        draft.sections = normalizeRequirementSections(profile, body.sections ?? draft.sections);
        if (body.ruleOverlay !== undefined) draft.ruleOverlay = body.ruleOverlay;
        if (body.note !== undefined) draft.note = body.note;
        draft.draftVersion += 1;
        draft.status = "draft";
        draft.updatedAt = now;
        draft.updatedBy = user.id;
      }
      saved = draft;
    });
    await writeAdminAuditLog(user.id, "capabilityRequirementDraft.save", id, null, JSON.stringify(saved), body.note ?? null);
    return { draft: saved };
  });

  app.post("/api/admin/capabilities/:id/certification/simulate", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") {
      reply.code(403);
      return { error: "Admin only." };
    }
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as {
      profileId?: string;
      draftId?: string;
      sections?: Record<string, Partial<CapabilityRequirementSectionState>>;
    };
    const items = await listCatalogFromDatabase();
    const item = items.find((entry) => entry.id === id);
    if (!item) {
      reply.code(404);
      return { error: "Capability not found." };
    }
    const now = new Date().toISOString();
    const { deriveCertification } = await import("./catalog-certification.js");
    const {
      getActiveStandardProfile,
      findCurrentRequirementDraft,
      normalizeRequirementSections,
      seedRequirementSectionsFromCertification,
      simulateRequirementCertification
    } = await import("./capability-standards.js");
    const baseCertification = deriveCertification(item);
    let run: unknown = null;
    await updateRuntimeDatabase((database) => {
      const profile = getActiveStandardProfile(database, body.profileId);
      const draft = body.draftId
        ? (database.capabilityRequirementDrafts ?? []).find((entry) => entry.id === body.draftId && entry.capabilityId === id)
        : findCurrentRequirementDraft(database, id, profile.id);
      const sections = body.sections
        ? normalizeRequirementSections(profile, body.sections)
        : draft?.sections ?? seedRequirementSectionsFromCertification(profile, baseCertification);
      const result = simulateRequirementCertification({ item, profile, baseCertification, sections });
      const created = {
        id: createId("certrun"),
        capabilityId: id,
        profileId: profile.id,
        draftId: draft?.id,
        status: result.status,
        visibleToUsers: result.visibleToUsers,
        reasons: result.reasons,
        missingSections: result.missingSections,
        sectionResults: result.sectionResults,
        createdAt: now,
        createdBy: user.id
      };
      database.capabilityCertificationRuns = database.capabilityCertificationRuns ?? [];
      database.capabilityCertificationRuns.push(created);
      run = created;
    });
    await writeAdminAuditLog(user.id, "capabilityCertification.simulate", id, null, JSON.stringify(run), null);
    return { run };
  });

  app.get("/api/admin/capabilities/:id/certification/runs", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") {
      reply.code(403);
      return { error: "Admin only." };
    }
    const { id } = request.params as { id: string };
    const query = request.query as { profileId?: string; limit?: string };
    const items = await listCatalogFromDatabase();
    if (!items.some((entry) => entry.id === id)) {
      reply.code(404);
      return { error: "Capability not found." };
    }
    const db = await readRuntimeDatabase();
    const { getActiveStandardProfile, listCertificationRuns } = await import("./capability-standards.js");
    const profile = getActiveStandardProfile(db, query.profileId);
    const limit = Number.parseInt(`${query.limit ?? "20"}`, 10);
    return { runs: listCertificationRuns(db, id, profile.id, Number.isFinite(limit) ? limit : 20) };
  });

  app.post("/api/admin/capabilities/:id/requirements/publish", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") {
      reply.code(403);
      return { error: "Admin only." };
    }
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { profileId?: string; draftId?: string; note?: string };
    const items = await listCatalogFromDatabase();
    const item = items.find((entry) => entry.id === id);
    if (!item) {
      reply.code(404);
      return { error: "Capability not found." };
    }
    const now = new Date().toISOString();
    const { deriveCertification } = await import("./catalog-certification.js");
    const { getActiveStandardProfile, findCurrentRequirementDraft, listRequirementVersions, simulateRequirementCertification } = await import("./capability-standards.js");
    let output: unknown = null;
    const result = await updateRuntimeDatabase((database) => {
      const profile = getActiveStandardProfile(database, body.profileId);
      const draft = body.draftId
        ? (database.capabilityRequirementDrafts ?? []).find((entry) => entry.id === body.draftId && entry.capabilityId === id)
        : findCurrentRequirementDraft(database, id, profile.id);
      if (!draft) return { error: "Requirement draft not found." } as const;
      const baseCertification = deriveCertification(item);
      const simulated = simulateRequirementCertification({ item, profile, baseCertification, sections: draft.sections });
      const run = {
        id: createId("certrun"),
        capabilityId: id,
        profileId: profile.id,
        draftId: draft.id,
        status: simulated.status,
        visibleToUsers: simulated.visibleToUsers,
        reasons: simulated.reasons,
        missingSections: simulated.missingSections,
        sectionResults: simulated.sectionResults,
        createdAt: now,
        createdBy: user.id
      };
      database.capabilityCertificationRuns = database.capabilityCertificationRuns ?? [];
      database.capabilityCertificationRuns.push(run);
      database.capabilityRequirementVersions = database.capabilityRequirementVersions ?? [];
      const nextVersion = Math.max(0, ...listRequirementVersions(database, id, profile.id).map((version) => version.version)) + 1;
      for (const version of database.capabilityRequirementVersions) {
        if (version.capabilityId === id && version.profileId === profile.id && version.status === "published") {
          version.status = "superseded";
        }
      }
      const version = {
        id: createId("reqver"),
        capabilityId: id,
        profileId: profile.id,
        version: nextVersion,
        status: "published" as const,
        sections: draft.sections,
        ruleOverlay: draft.ruleOverlay,
        certificationRunId: run.id,
        publishedAt: now,
        publishedBy: user.id
      };
      database.capabilityRequirementVersions.push(version);
      draft.status = "published";
      draft.updatedAt = now;
      draft.updatedBy = user.id;
      output = { version, run };
      return { ok: true } as const;
    });
    if ("error" in result) {
      reply.code(404);
      return { error: result.error };
    }
    await writeAdminAuditLog(user.id, "capabilityRequirementVersion.publish", id, null, JSON.stringify(output), body.note ?? null);
    return output;
  });

  app.post("/api/admin/capabilities/:id/rollback-version", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") {
      reply.code(403);
      return { error: "Admin only." };
    }
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { profileId?: string; versionId?: string; note?: string };
    if (!body.versionId) {
      reply.code(400);
      return { error: "versionId is required." };
    }
    const now = new Date().toISOString();
    const { getActiveStandardProfile, listRequirementVersions } = await import("./capability-standards.js");
    let output: unknown = null;
    const result = await updateRuntimeDatabase((database) => {
      const profile = getActiveStandardProfile(database, body.profileId);
      database.capabilityRequirementVersions = database.capabilityRequirementVersions ?? [];
      const source = database.capabilityRequirementVersions.find((version) => version.id === body.versionId && version.capabilityId === id);
      if (!source) return { error: "Requirement version not found." } as const;
      const nextVersion = Math.max(0, ...listRequirementVersions(database, id, profile.id).map((version) => version.version)) + 1;
      for (const version of database.capabilityRequirementVersions) {
        if (version.capabilityId === id && version.profileId === profile.id && version.status === "published") {
          version.status = "superseded";
        }
      }
      const restored = {
        id: createId("reqver"),
        capabilityId: id,
        profileId: profile.id,
        version: nextVersion,
        status: "published" as const,
        sections: source.sections,
        ruleOverlay: source.ruleOverlay,
        rollbackOfVersionId: source.id,
        publishedAt: now,
        publishedBy: user.id
      };
      database.capabilityRequirementVersions.push(restored);
      output = { version: restored };
      return { ok: true } as const;
    });
    if ("error" in result) {
      reply.code(404);
      return { error: result.error };
    }
    await writeAdminAuditLog(user.id, "capabilityRequirementVersion.rollback", id, body.versionId, JSON.stringify(output), body.note ?? null);
    return output;
  });

  app.get("/api/admin/capability-audit-log", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") {
      reply.code(403);
      return { error: "Admin only." };
    }
    const query = request.query as { targetId?: string; action?: string; limit?: string };
    const limit = Number.parseInt(`${query.limit ?? "50"}`, 10);
    const entries = await readAdminAuditLogs({
      targetId: query.targetId,
      action: query.action,
      limit: Number.isFinite(limit) ? limit : 50
    });
    return { entries };
  });

  app.get("/api/catalog/:id/guide", async (request, reply) => {
    const params = request.params as { id: string };
    try {
      return await readCatalogGuide(params.id);
    } catch (error) {
      reply.code(404);
      return { error: error instanceof Error ? error.message : "Guide not found" };
    }
  });

  /**
   * GET /api/catalog/:id/vars-schema
   *
   * Returns the configurable-vars schema for a Playbook (admin-defined form
   * fields the UI renders on the right side of the configure-and-run pane).
   * Returns { schema: null } when the Playbook has no schema, in which case
   * the UI falls back to the simple "run with defaults" button.
   *
   * Public endpoint — anyone who can see the catalog can see the form shape.
   */
  app.get("/api/catalog/:id/vars-schema", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { isValidCatalogId } = await import("./catalog-overrides.js");
    if (!isValidCatalogId(id)) {
      reply.code(400);
      return { error: "Invalid catalog id" };
    }
    try {
      const { loadVarsSchema } = await import("./catalog-vars-schema.js");
      const schema = await loadVarsSchema(id);
      return { schema };
    } catch (err) {
      reply.code(500);
      return { error: err instanceof Error ? err.message : "Failed to load schema" };
    }
  });

  /**
   * POST /api/catalog/:id/vars-schema (admin only)
   *
   * Save an override schema for a Playbook. Validated server-side before write
   * so we can never persist a broken schema that would break the form UI.
   */
  app.post("/api/catalog/:id/vars-schema", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") { reply.code(403); return { error: "Admin only." }; }
    const { id } = request.params as { id: string };
    const body = request.body as { schema?: unknown };
    if (!body?.schema) { reply.code(400); return { error: "schema is required" }; }
    try {
      // saveOverrideSchema runs validateSchema internally and throws on any
      // structural issue, so an invalid submission ends up here with a
      // descriptive Error.message — surfaced to the admin as 400.
      const { saveOverrideSchema } = await import("./catalog-vars-schema.js");
      await saveOverrideSchema(id, body.schema as Parameters<typeof saveOverrideSchema>[1]);
      return { ok: true };
    } catch (err) {
      reply.code(400);
      return { error: err instanceof Error ? err.message : "Invalid schema" };
    }
  });

  /**
   * DELETE /api/catalog/:id/vars-schema (admin only) — revert to baseline.
   */
  app.delete("/api/catalog/:id/vars-schema", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") { reply.code(403); return { error: "Admin only." }; }
    const { id } = request.params as { id: string };
    const { isValidCatalogId } = await import("./catalog-overrides.js");
    if (!isValidCatalogId(id)) { reply.code(400); return { error: "Invalid catalog id" }; }
    const { deleteOverrideSchema } = await import("./catalog-vars-schema.js");
    await deleteOverrideSchema(id);
    return { ok: true };
  });

  /**
   * POST /api/catalog/:id/preview
   *
   * Pre-apply preview: 给定用户在表单里填的 vars，返回完整的 "如果点 Run 会发生什么"
   * 报告 — 渲染后的 YAML、每个任务的最终参数、会被写入的文件路径、影响范围。
   *
   * 不连远端 SSH，纯本地计算（schema 验证 + var 替换）。安全：vars 经过 schema
   * 校验，避免随意值被模板进 shell 命令。schema 不存在的 Playbook 也支持，但只能
   * 看到原始 YAML 的渲染结果，没有 fieldErrors 校验。
   */
  app.post("/api/catalog/:id/preview", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const { isValidCatalogId } = await import("./catalog-overrides.js");
    if (!isValidCatalogId(id)) { reply.code(400); return { error: "Invalid catalog id" }; }

    const body = (request.body ?? {}) as { vars?: Record<string, unknown> };
    try {
      const { buildPlaybookPreview } = await import("./catalog-preview.js");
      const preview = await buildPlaybookPreview(id, body.vars ?? {});
      return { preview };
    } catch (err) {
      // schema 校验失败时附带 fieldErrors
      const e = err as Error & { fieldErrors?: Record<string, string> };
      reply.code(400);
      return {
        error: e.message ?? "Preview failed",
        ...(e.fieldErrors ? { fieldErrors: e.fieldErrors } : {})
      };
    }
  });

  app.get("/api/migration/strategies", async () => {
    return {
      strategies: await listMigrationStrategies()
    };
  });

  /**
   * GET /api/me — full snapshot of the authenticated user's account.
   *
   * P1.11 replaces the legacy guest stub with a real authenticated lookup.
   * Returns the public user projection + linked identities + 2FA status so
   * the SPA can render the account page in one round-trip. Anonymous callers
   * get the legacy `{ id: "guest" }` response so existing UI code that does
   * not gate on `authenticated` still works.
   */
  app.get("/api/me", async (request) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) return listCurrentUser(); // legacy guest shape

    const [identities, totpStatus, prefs, activity] = await Promise.all([
      listIdentities(user.id),
      getTotpStatus(user.id),
      getNotificationPrefs(user.id),
      getUserActivity(user.id)
    ]);

    // Project identities to public-safe shape (mirrors GET /api/me/identities).
    const publicIdents = identities.map((i) => ({
      provider: i.provider,
      providerEmail: i.providerEmail,
      providerLogin: i.providerData?.login,
      providerAvatarUrl: i.providerData?.avatarUrl,
      providerDisplayName: i.providerData?.displayName,
      createdAt: i.createdAt,
      lastUsedAt: i.lastUsedAt
    }));
    const hasLocal = !!user.passwordHash;
    if (hasLocal && !publicIdents.some((i) => i.provider === "local")) {
      publicIdents.unshift({
        provider: "local",
        providerEmail: user.email,
        providerLogin: undefined,
        providerAvatarUrl: undefined,
        providerDisplayName: undefined,
        createdAt: user.createdAt,
        lastUsedAt: undefined
      });
    }

    return {
      user: toPublicUser(user),
      identities: publicIdents,
      twoFactor: totpStatus,
      notificationPrefs: prefs,
      activity
    };
  });

  /**
   * PATCH /api/me — update profile fields.
   *
   * Accepts any subset of: displayName / bio / avatarUrl / timezone /
   * locale / username / defaultSshUser. Username uniqueness is enforced
   * server-side. Email is changed via the dedicated /email-change flow.
   */
  app.patch("/api/me", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    try {
      const updated = await updateMyProfile(user.id, request.body as Parameters<typeof updateMyProfile>[1]);
      return { user: updated };
    } catch (err) {
      reply.code(400);
      return { error: err instanceof Error ? err.message : "Profile update failed" };
    }
  });

  /**
   * POST /api/me/email-change/request — start the two-step email change.
   *
   * Body: { newEmail: "alice@new.example" }
   * Sends a verification code to the NEW address. The OLD address gets a
   * heads-up notification too (best-effort). Returns { pendingId } that the
   * client echoes on the /confirm step.
   */
  app.post("/api/me/email-change/request", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const body = (request.body ?? {}) as { newEmail?: string };
    try {
      const result = await requestEmailChange(user.id, body.newEmail ?? "");
      return result;
    } catch (err) {
      reply.code(400);
      return { error: err instanceof Error ? err.message : "Email change request failed." };
    }
  });

  /**
   * POST /api/me/email-change/confirm — finalize the change.
   *
   * Body: { pendingId, code }
   * On success: user.email is updated, emailVerifiedAt set to now.
   */
  app.post("/api/me/email-change/confirm", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const body = (request.body ?? {}) as { pendingId?: string; code?: string };
    try {
      const result = await confirmEmailChange({
        userId: user.id,
        pendingId: body.pendingId ?? "",
        code: body.code ?? ""
      });
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Confirm failed.";
      reply.code(/expired/i.test(msg) ? 410 : 400);
      return { error: msg };
    }
  });

  /**
   * POST /api/me/password — change the local password.
   *
   * For users WITH a local password: body must contain { oldPassword, newPassword }.
   * For OAuth-only users setting their first password: body is
   * { newPassword, currentTotpCode? } and we re-auth via TOTP if 2FA is on,
   * otherwise refuse (the caller should add 2FA first or provide a recovery
   * code via the password-reset flow in P1.12).
   */
  app.post("/api/me/password", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const body = (request.body ?? {}) as {
      oldPassword?: string;
      newPassword?: string;
      currentTotpCode?: string;
    };
    if (!body.newPassword) {
      reply.code(400);
      return { error: "newPassword is required." };
    }
    try {
      if (user.passwordHash) {
        // Standard change flow.
        await changePassword({
          userId: user.id,
          oldPassword: body.oldPassword ?? "",
          newPassword: body.newPassword
        });
      } else {
        // Initial-password flow. Demand fresh TOTP if 2FA is enabled; for
        // OAuth-only accounts WITHOUT 2FA we refuse (user should add 2FA
        // first or use the upcoming password-reset flow in P1.12).
        if (!user.totpEnabledAt) {
          reply.code(400);
          return {
            error: "Set up 2FA first, then set your password using a current 2FA code."
          };
        }
        const code = (body.currentTotpCode ?? "").trim();
        if (!/^\d{6}$/.test(code)) {
          reply.code(400);
          return { error: "currentTotpCode (6 digits) is required to set initial password." };
        }
        const verified = await verifyTotp(user.id, code);
        if (verified !== "ok") {
          reply.code(401);
          return { error: "Verification code is incorrect." };
        }
        await changePassword({
          userId: user.id,
          newPassword: body.newPassword,
          isInitialSet: true
        });
      }
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Password change failed.";
      reply.code(/incorrect/i.test(msg) ? 401 : 400);
      return { error: msg };
    }
  });

  /**
   * DELETE /api/me — soft-delete the authenticated user's account.
   *
   * Body: { password?: string; currentTotpCode?: string }
   *
   * Re-authentication required to prevent session-hijack-driven account
   * destruction. Local-password accounts must supply the password; OAuth-only
   * accounts must supply a current TOTP code (which means they must have
   * already enrolled in 2FA — fair price for irreversible action).
   *
   * Side effects: revokes all sessions; user.deletedAt set; 2FA cleared.
   * Their content (drafts, comments, etc.) is preserved.
   */
  app.delete("/api/me", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }

    const body = (request.body ?? {}) as { password?: string; currentTotpCode?: string };

    // Re-auth.
    if (user.passwordHash && user.passwordSalt) {
      if (!body.password) {
        reply.code(400);
        return { error: "Password is required to delete your account." };
      }
      const { verifyPassword } = await import("./auth/password.js");
      const ok = await verifyPassword(body.password, user.passwordSalt, user.passwordHash);
      if (!ok) {
        reply.code(401);
        return { error: "Password is incorrect." };
      }
    } else {
      if (!user.totpEnabledAt) {
        reply.code(400);
        return { error: "Account deletion requires either a password or 2FA — neither is set." };
      }
      const code = (body.currentTotpCode ?? "").trim();
      if (!/^\d{6}$/.test(code)) {
        reply.code(400);
        return { error: "currentTotpCode (6 digits) is required to delete this account." };
      }
      const verified = await verifyTotp(user.id, code);
      if (verified !== "ok") {
        reply.code(401);
        return { error: "Verification code is incorrect." };
      }
    }

    // Don't let the only admin delete themselves — system invariant.
    const db = await readRuntimeDatabase();
    if (user.role === "admin") {
      const otherAdmins = db.users.filter(
        (u) => u.id !== user.id && u.role === "admin" && !u.deletedAt
      );
      if (otherAdmins.length === 0) {
        reply.code(409);
        return { error: "Cannot delete the only remaining admin account." };
      }
    }

    await softDeleteUser(user.id);
    return { ok: true, deletedAt: new Date().toISOString() };
  });

  /**
   * GET /api/me/notification-prefs — return current per-user preferences.
   * If no row exists yet, returns sensible defaults.
   */
  app.get("/api/me/notification-prefs", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    return await getNotificationPrefs(user.id);
  });

  /**
   * PUT /api/me/notification-prefs — replace prefs (any missing field
   * keeps its prior value via merge inside updateNotificationPrefs).
   */
  app.put("/api/me/notification-prefs", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const body = (request.body ?? {}) as Partial<{
      emailMentions: boolean;
      emailComments: boolean;
      emailSuggestionStatus: boolean;
      emailPublishStatus: boolean;
    }>;
    // Coerce / pass through only the recognized fields.
    const patch: Parameters<typeof updateNotificationPrefs>[1] = {};
    if (typeof body.emailMentions === "boolean") patch.emailMentions = body.emailMentions;
    if (typeof body.emailComments === "boolean") patch.emailComments = body.emailComments;
    if (typeof body.emailSuggestionStatus === "boolean") patch.emailSuggestionStatus = body.emailSuggestionStatus;
    if (typeof body.emailPublishStatus === "boolean") patch.emailPublishStatus = body.emailPublishStatus;
    return await updateNotificationPrefs(user.id, patch);
  });

  app.post("/api/me/notification-prefs/test", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }

    const now = new Date().toISOString();
    await addInboxMessage(
      user.id,
      "EnvForge notification test",
      "Your in-app inbox is working. Email delivery is queued when notification preferences allow it."
    );

    const prefs = await getNotificationPrefs(user.id);
    const emailEnabled = prefs.emailMentions || prefs.emailComments || prefs.emailSuggestionStatus || prefs.emailPublishStatus;
    let emailQueued = false;
    if (emailEnabled) {
      emailQueued = await enqueueEmail({
        to: user.email,
        userId: user.id,
        templateId: "notification-test",
        context: {
          displayName: user.name || user.username || user.email,
          sentAt: now
        }
      });
    }

    return {
      ok: true,
      inboxQueued: true,
      emailQueued,
      emailEnabled
    };
  });

  /**
   * GET /api/me/activity — counters for the user's settings dashboard
   * (number of connections / playbooks / tasks / OAuth providers / etc.).
   */
  app.get("/api/me/activity", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    return await getUserActivity(user.id);
  });

  app.post("/api/auth/register", async (request, reply) => {
    // Two-step flow (auth-and-ecosystem spec P1.5): this endpoint is now the
    // step-1 "send verification code" call. The legacy `registerUser` helper
    // is a compat shim that calls startRegistration internally and returns
    // `{ pending: true, pendingId, message }` — old clients see a clearer
    // error than a silent change in semantics.
    try {
      const result = await registerUser(request.body as { name?: string; email?: string; password?: string });
      return result;
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : "Registration failed" };
    }
  });

  app.post("/api/auth/register/start", async (request, reply) => {
    try {
      return await startRegistration(request.body as { name?: string; email?: string; password?: string });
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : "Registration failed" };
    }
  });

  app.post("/api/auth/register/verify", async (request, reply) => {
    try {
      return await verifyRegistration(request.body as { pendingId?: string; code?: string });
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : "Verification failed" };
    }
  });

  // ── GitHub OAuth (auth-and-ecosystem spec P1.7) ────────────────────────
  // GET /api/auth/github → 302 to github.com/login/oauth/authorize
  // GET /auth/github/callback → exchange code → create-or-find user → set session → 302 home
  //
  // The callback path matches the GitHub OAuth App Authorization callback URL
  // configured in GitHub's developer settings (no `/api` prefix per the
  // user's existing app config).
  app.get("/api/auth/github", async (request, reply) => {
    const cfg = getConfig();
    if (!cfg.github.clientId || !cfg.github.redirectUri) {
      reply.code(503);
      return { error: "GitHub OAuth is not configured on this server." };
    }
    const url = getGitHubAuthorizeUrl({ purpose: "login" });
    reply.redirect(url);
  });

  app.get("/auth/github/callback", async (request, reply) => {
    const query = request.query as { code?: string; state?: string; error?: string };
    const cfg = getConfig();

    // GitHub may return user-aborted flows with ?error=access_denied (no code/state).
    if (query.error || !query.code || !query.state) {
      reply.redirect(`${cfg.publicBaseUrl}/?oauth_error=cancelled`);
      return;
    }

    // 1. Verify the state token (CSRF + replay protection)
    const stateResult = verifyState(query.state);
    if (!stateResult.ok) {
      // Don't leak which specific check failed — that's a CSRF oracle.
      // The client gets a single generic error; server logs may have details.
      request.log.warn({ reason: stateResult.reason }, "OAuth state verification failed");
      reply.redirect(`${cfg.publicBaseUrl}/?oauth_error=invalid_state`);
      return;
    }
    const { purpose, userId: linkUserId, redirectTo } = stateResult.payload;

    // 2. Exchange code → access_token → fetch profile
    let profile: Awaited<ReturnType<typeof fetchGitHubProfile>>;
    try {
      const accessToken = await exchangeGitHubCode(query.code);
      profile = await fetchGitHubProfile(accessToken);
    } catch (err) {
      request.log.warn({ err: err instanceof Error ? err.message : err }, "GitHub OAuth exchange/fetch failed");
      reply.redirect(`${cfg.publicBaseUrl}/?oauth_error=provider_error`);
      return;
    }

    // 3. Branch: login flow vs link-existing-user flow
    if (purpose === "link") {
      if (!linkUserId) {
        reply.redirect(`${cfg.publicBaseUrl}/?oauth_error=invalid_state`);
        return;
      }
      try {
        await linkIdentityToUser(linkUserId, {
          provider: "github",
          providerUserId: profile.id,
          email: profile.email,
          profile: {
            avatarUrl: profile.avatarUrl,
            displayName: profile.displayName,
            login: profile.login
          }
        });
        reply.redirect(`${cfg.publicBaseUrl}/#oauth=linked&provider=github`);
        return;
      } catch (err) {
        if (err instanceof IdentityAlreadyLinkedError) {
          reply.redirect(`${cfg.publicBaseUrl}/?oauth_error=already_linked`);
          return;
        }
        request.log.error({ err: err instanceof Error ? err.message : err }, "OAuth link failed");
        reply.redirect(`${cfg.publicBaseUrl}/?oauth_error=link_failed`);
        return;
      }
    }

    // Login flow
    let result: { user: { id: string; email: string }; created: boolean };
    try {
      result = await findOrCreateFromOAuth({
        provider: "github",
        providerUserId: profile.id,
        email: profile.email,
        profile: {
          avatarUrl: profile.avatarUrl,
          displayName: profile.displayName,
          login: profile.login
        }
      });
    } catch (err) {
      if (err instanceof EmailConflictError) {
        // Per spec D-1.1: user must log in with their existing local account
        // first, then link GitHub from settings. Surface this clearly.
        const emailHint = encodeURIComponent(err.email);
        reply.redirect(`${cfg.publicBaseUrl}/?oauth_error=email_conflict&email=${emailHint}`);
        return;
      }
      request.log.error({ err: err instanceof Error ? err.message : err }, "OAuth login failed");
      reply.redirect(`${cfg.publicBaseUrl}/?oauth_error=login_failed`);
      return;
    }

    // 4. Issue session — gate on 2FA / enrollment requirements (P1.10).
    //    Find the user record (we already have userId) so we can inspect
    //    role + totpEnabledAt.
    const dbForSession = await readRuntimeDatabase();
    const userRow = dbForSession.users.find((u) => u.id === result.user.id);
    if (!userRow) {
      request.log.error({ userId: result.user.id }, "OAuth: user vanished between create and session-issue");
      reply.redirect(`${cfg.publicBaseUrl}/?oauth_error=login_failed`);
      return;
    }

    const totpEnabled = !!userRow.totpEnabledAt;
    const adminNeedsEnrollment = false; // Cancel forced 2FA for administrators

    const now = new Date().toISOString();
    const token = createSessionToken();

    if (totpEnabled) {
      // 2fa-pending intermediate session. SPA must hand the user the 2FA
      // input page; intermediateToken is the only thing it can do anything with.
      const expiresAt = new Date(Date.now() + TWOFA_PENDING_TTL_MS).toISOString();
      await updateRuntimeDatabase((db) => {
        db.sessions = db.sessions.filter((s) => new Date(s.expiresAt).getTime() > Date.now());
        db.sessions.push({
          token,
          userId: userRow.id,
          createdAt: now,
          expiresAt,
          twofaPending: true
        });
      });
      const fragment = `#2fa=1&intermediateToken=${encodeURIComponent(token)}&new=${result.created ? "1" : "0"}`;
      reply.redirect(`${cfg.publicBaseUrl}/${fragment}`);
      return;
    }

    // Regular full-access session.
    const expiresAt = new Date(Date.now() + getSessionTtlMs()).toISOString();
    await updateRuntimeDatabase((db) => {
      db.sessions = db.sessions.filter((s) => new Date(s.expiresAt).getTime() > Date.now());
      db.sessions.push({ token, userId: result.user.id, createdAt: now, expiresAt });
    });

    // 5. Hand the session token to the browser via fragment so it lands in
    // localStorage (the SPA reads `#token=...` on /oauth/return). Fragments
    // never hit our server logs nor reverse-proxy access logs.
    const fragment = `#token=${encodeURIComponent(token)}&new=${result.created ? "1" : "0"}`;
    reply.redirect(`${cfg.publicBaseUrl}/${fragment}`);
  });

  // ── Google OAuth ──────────────────────────────────────────
  app.get("/api/auth/google", async (request, reply) => {
    const cfg = getConfig();
    if (!cfg.google.clientId || !cfg.google.redirectUri) {
      reply.code(503);
      return { error: "Google OAuth is not configured on this server." };
    }
    const url = getGoogleAuthorizeUrl({ purpose: "login" });
    reply.redirect(url);
  });

  app.get("/auth/google/callback", async (request, reply) => {
    const query = request.query as { code?: string; state?: string; error?: string };
    const cfg = getConfig();

    if (query.error || !query.code || !query.state) {
      reply.redirect(`${cfg.publicBaseUrl}/?oauth_error=cancelled`);
      return;
    }

    const stateResult = verifyState(query.state);
    if (!stateResult.ok) {
      request.log.warn({ reason: stateResult.reason }, "OAuth state verification failed");
      reply.redirect(`${cfg.publicBaseUrl}/?oauth_error=invalid_state`);
      return;
    }
    const { purpose, userId: linkUserId, redirectTo } = stateResult.payload;

    let profile: Awaited<ReturnType<typeof fetchGoogleProfile>>;
    try {
      const accessToken = await exchangeGoogleCode(query.code);
      profile = await fetchGoogleProfile(accessToken);
    } catch (err) {
      request.log.warn({ err: err instanceof Error ? err.message : err }, "Google OAuth exchange/fetch failed");
      reply.redirect(`${cfg.publicBaseUrl}/?oauth_error=provider_error`);
      return;
    }

    if (purpose === "link") {
      if (!linkUserId) {
        reply.redirect(`${cfg.publicBaseUrl}/?oauth_error=invalid_state`);
        return;
      }
      try {
        await linkIdentityToUser(linkUserId, {
          provider: "google",
          providerUserId: profile.id,
          email: profile.email,
          profile: {
            avatarUrl: profile.avatarUrl,
            displayName: profile.displayName,
            login: profile.displayName || profile.email?.split("@")[0]
          }
        });
        reply.redirect(`${cfg.publicBaseUrl}/#oauth=linked&provider=google`);
        return;
      } catch (err) {
        if (err instanceof IdentityAlreadyLinkedError) {
          reply.redirect(`${cfg.publicBaseUrl}/?oauth_error=already_linked`);
          return;
        }
        request.log.error({ err: err instanceof Error ? err.message : err }, "OAuth link failed");
        reply.redirect(`${cfg.publicBaseUrl}/?oauth_error=link_failed`);
        return;
      }
    }

    // Login flow
    let result: { user: { id: string; email: string }; created: boolean };
    try {
      result = await findOrCreateFromOAuth({
        provider: "google",
        providerUserId: profile.id,
        email: profile.email,
        profile: {
          avatarUrl: profile.avatarUrl,
          displayName: profile.displayName,
          login: profile.displayName || profile.email?.split("@")[0]
        }
      });
    } catch (err) {
      if (err instanceof EmailConflictError) {
        const emailHint = encodeURIComponent(err.email);
        reply.redirect(`${cfg.publicBaseUrl}/?oauth_error=email_conflict&email=${emailHint}`);
        return;
      }
      request.log.error({ err: err instanceof Error ? err.message : err }, "OAuth login failed");
      reply.redirect(`${cfg.publicBaseUrl}/?oauth_error=login_failed`);
      return;
    }

    const dbForSession = await readRuntimeDatabase();
    const userRow = dbForSession.users.find((u) => u.id === result.user.id);
    if (!userRow) {
      request.log.error({ userId: result.user.id }, "OAuth: user vanished between create and session-issue");
      reply.redirect(`${cfg.publicBaseUrl}/?oauth_error=login_failed`);
      return;
    }

    const totpEnabled = !!userRow.totpEnabledAt;
    const adminNeedsEnrollment = false; // Cancel forced 2FA for administrators

    const now = new Date().toISOString();
    const token = createSessionToken();

    if (totpEnabled) {
      const expiresAt = new Date(Date.now() + TWOFA_PENDING_TTL_MS).toISOString();
      await updateRuntimeDatabase((db) => {
        db.sessions = db.sessions.filter((s) => new Date(s.expiresAt).getTime() > Date.now());
        db.sessions.push({
          token,
          userId: userRow.id,
          createdAt: now,
          expiresAt,
          twofaPending: true
        });
      });
      const fragment = `#2fa=1&intermediateToken=${encodeURIComponent(token)}&new=${result.created ? "1" : "0"}`;
      reply.redirect(`${cfg.publicBaseUrl}/${fragment}`);
      return;
    }

    // Regular full-access session.
    const expiresAt = new Date(Date.now() + getSessionTtlMs()).toISOString();
    await updateRuntimeDatabase((db) => {
      db.sessions = db.sessions.filter((s) => new Date(s.expiresAt).getTime() > Date.now());
      db.sessions.push({ token, userId: result.user.id, createdAt: now, expiresAt });
    });

    const fragment = `#token=${encodeURIComponent(token)}&new=${result.created ? "1" : "0"}`;
    reply.redirect(`${cfg.publicBaseUrl}/${fragment}`);
  });


  app.post("/api/auth/login", async (request, reply) => {
    try {
      return await loginUser(request.body as { email?: string; password?: string });
    } catch (error) {
      reply.code(401);
      return { error: error instanceof Error ? error.message : "Login failed" };
    }
  });

  /**
   * POST /api/auth/login/2fa — second-factor verification step.
   *
   * Body: { intermediateToken: string, code: string }
   * The user gets `intermediateToken` from a previous /api/auth/login call
   * that returned `needs2FA: true`. `code` is either a 6-digit TOTP code
   * or a 16-char recovery code.
   *
   * Status mapping:
   *   - 200 ok                    {token, expiresAt, user, [usedRecoveryCode, recoveryCodesRemaining]}
   *   - 401 wrong-code / not-pending
   *   - 410 session-expired       (intermediate session past its 5-min TTL)
   *   - 401 session-not-found     (token unknown / never issued)
   */
  app.post("/api/auth/login/2fa", async (request, reply) => {
    const body = (request.body ?? {}) as { intermediateToken?: string; code?: string };
    try {
      return await login2FA(body);
    } catch (err) {
      if (err instanceof Login2FAError) {
        if (err.reason === "session-expired") {
          reply.code(410);
          return { error: "2FA session has expired. Please sign in again." };
        }
        if (err.reason === "session-not-found" || err.reason === "not-pending") {
          reply.code(401);
          return { error: "Invalid or unusable 2FA session." };
        }
        if (err.reason === "wrong-code") {
          reply.code(401);
          return { error: "Verification code is incorrect." };
        }
      }
      reply.code(500);
      return { error: err instanceof Error ? err.message : "Login failed." };
    }
  });

  /**
   * POST /api/auth/password-reset/request — kick off forgot-password flow.
   *
   * Body: { email: string }
   * Always returns 200 with the same generic message regardless of whether
   * the email matches a real account (anti-enumeration). The actual reset
   * email is only sent if the matched account has a local password.
   */
  app.post("/api/auth/password-reset/request", async (request) => {
    const body = (request.body ?? {}) as { email?: string };
    return await requestPasswordReset(body.email ?? "");
  });

  /**
   * POST /api/auth/password-reset/confirm — finalize the reset.
   *
   * Body: { token: string, newPassword: string }
   * On success: password is rewritten + ALL of the user's sessions are
   * revoked (forced log-out everywhere). Returns 200 with `{ email,
   * sessionsRevoked }`. Status mapping:
   *   - 400 malformed-token / bad-signature / new password too short
   *   - 404 not-found / user-not-found
   *   - 410 expired
   *   - 410 already-used
   */
  app.post("/api/auth/password-reset/confirm", async (request, reply) => {
    const body = (request.body ?? {}) as { token?: string; newPassword?: string };
    try {
      return await confirmPasswordReset({
        token: body.token ?? "",
        newPassword: body.newPassword ?? ""
      });
    } catch (err) {
      if (err instanceof PasswordResetError) {
        switch (err.reason) {
          case "malformed-token":
          case "bad-signature":
            reply.code(400);
            return { error: "Reset link is invalid." };
          case "expired":
          case "already-used":
            reply.code(410);
            return {
              error:
                err.reason === "expired"
                  ? "Reset link has expired. Please request a new one."
                  : "Reset link has already been used. Please request a new one."
            };
          case "not-found":
          case "user-not-found":
            reply.code(404);
            return { error: "Reset request not found." };
        }
      }
      // normalizePassword throws plain Error for short pw
      const msg = err instanceof Error ? err.message : "Reset failed.";
      reply.code(/at least 8 characters/i.test(msg) ? 400 : 500);
      return { error: msg };
    }
  });

  app.get("/api/auth/session", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) {
      reply.code(401);
      return { error: "Session is missing or expired." };
    }

    return { user: toPublicUser(user) };
  });

  // Lists which OAuth providers are configured on this server. The login UI
  // queries this to decide whether to render the GitHub / Google buttons.
  // Public — no auth required.
  app.get("/api/auth/providers", async () => {
    const cfg = getConfig();
    return {
      github: Boolean(cfg.github.clientId && cfg.github.redirectUri),
      google: Boolean(cfg.google.clientId && cfg.google.redirectUri)
    };
  });

  app.patch("/api/auth/profile", async (request, reply) => {
    try {
      const user = await updateUserProfile(
        readBearerToken(request.headers.authorization),
        request.body as { name?: string; defaultSshUser?: string }
      );
      if (!user) {
        reply.code(401);
        return { error: "Session is missing or expired." };
      }
      return { user };
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : "Profile update failed" };
    }
  });

  // ── Multi-provider identity management (auth-and-ecosystem spec P1.8) ──
  // List, connect, and disconnect OAuth providers for the current user.

  app.get("/api/me/identities", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }

    const idents = await listIdentities(user.id);
    // Project to a public-safe shape — strip internal id, keep what the UI needs
    // to render the "Connected accounts" panel.
    const publicIdents = idents.map((i) => ({
      provider: i.provider,
      providerEmail: i.providerEmail,
      providerLogin: i.providerData?.login,
      providerAvatarUrl: i.providerData?.avatarUrl,
      providerDisplayName: i.providerData?.displayName,
      createdAt: i.createdAt,
      lastUsedAt: i.lastUsedAt
    }));
    // The user also has a "local" login method when passwordHash is set, even
    // if no explicit `local` identity row was migrated. Surface this as a
    // virtual entry so the UI can show "Local password ✓" alongside OAuth ones.
    const hasLocal = !!user.passwordHash;
    const hasLocalRow = publicIdents.some((i) => i.provider === "local");
    if (hasLocal && !hasLocalRow) {
      publicIdents.unshift({
        provider: "local",
        providerEmail: user.email,
        providerLogin: undefined,
        providerAvatarUrl: undefined,
        providerDisplayName: undefined,
        createdAt: user.createdAt,
        lastUsedAt: undefined
      });
    }
    return { identities: publicIdents };
  });

  app.post("/api/me/identities/github/connect", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }

    const cfg = getConfig();
    if (!cfg.github.clientId || !cfg.github.redirectUri) {
      reply.code(503);
      return { error: "GitHub OAuth is not configured on this server." };
    }

    // Build authorize URL with purpose=link + userId. The callback at
    // GET /auth/github/callback (set up in P1.7) sees the link purpose
    // and goes through the linkIdentityToUser path instead of creating
    // a new account.
    const body = (request.body ?? {}) as { redirectTo?: string };
    const url = getGitHubAuthorizeUrl({
      purpose: "link",
      userId: user.id,
      redirectTo: body.redirectTo
    });
    return { authorizeUrl: url };
  });

  app.post("/api/me/identities/google/connect", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }

    const cfg = getConfig();
    if (!cfg.google.clientId || !cfg.google.redirectUri) {
      reply.code(503);
      return { error: "Google OAuth is not configured on this server." };
    }

    const body = (request.body ?? {}) as { redirectTo?: string };
    const url = getGoogleAuthorizeUrl({
      purpose: "link",
      userId: user.id,
      redirectTo: body.redirectTo
    });
    return { authorizeUrl: url };
  });

  app.delete("/api/me/identities/:provider", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }

    const { provider } = request.params as { provider: string };
    if (provider !== "github" && provider !== "google" && provider !== "local") {
      reply.code(400);
      return { error: "Unknown provider." };
    }
    // Don't let users unlink "local" via this endpoint — that's effectively
    // "remove my password", which is a separate flow (POST /api/me/password
    // with empty body in P1.11). The check is here for safety; the
    // unlinkIdentity function would also reject it via LastLoginMethodError
    // in most cases, but we want a clearer error message.
    if (provider === "local") {
      reply.code(400);
      return { error: "Use the password settings to remove your local password." };
    }

    try {
      await unlinkIdentity(user.id, provider);
      return { ok: true };
    } catch (err) {
      if (err instanceof LastLoginMethodError) {
        reply.code(409);
        return { error: err.message };
      }
      reply.code(500);
      return { error: err instanceof Error ? err.message : "Disconnect failed." };
    }
  });

  // ── Two-factor authentication (auth-and-ecosystem spec P1.9) ──
  // TOTP enrollment + verification + recovery codes. The disable / login-time
  // verify branches arrive in P1.10 (login flow with 2fa-pending session).

  /**
   * GET /api/me/2fa/status — inspect 2FA state for the current user.
   * Returns enabled flag, enabledAt, recovery code count, pending-enrollment flag.
   *
   * Accepts enrollment-required sessions (P1.10) so admins forced through
   * enrollment can read their own status from the enrollment UI.
   */
  app.get("/api/me/2fa/status", async (request, reply) => {
    const resolved = await resolveSession(readBearerToken(request.headers.authorization), {
      allowEnrollmentRequired: true
    });
    if (!resolved) { reply.code(401); return { error: "Login required." }; }
    return await getTotpStatus(resolved.user.id);
  });

  /**
   * POST /api/me/2fa/enroll — start 2FA enrollment.
   * Returns secret + otpauth URI + QR data URL. NO change to user state until
   * `confirm` succeeds. Replaces any prior pending enrollment for this user.
   *
   * Refusing to re-enroll while already enabled — user must disable first.
   * (Prevents accidental lockout: switching authenticators should be a
   * deliberate two-step flow.)
   *
   * Accepts enrollment-required sessions (P1.10): admin users forced through
   * enrollment after first login must complete this from the locked-down
   * intermediate session.
   */
  app.post("/api/me/2fa/enroll", async (request, reply) => {
    const resolved = await resolveSession(readBearerToken(request.headers.authorization), {
      allowEnrollmentRequired: true
    });
    if (!resolved) { reply.code(401); return { error: "Login required." }; }
    const user = resolved.user;
    if (user.totpEnabledAt) {
      reply.code(409);
      return { error: "Two-factor authentication is already enabled. Disable it first to re-enroll." };
    }
    try {
      const result = await enrollTotp(user.id);
      return result;
    } catch (err) {
      reply.code(500);
      return { error: err instanceof Error ? err.message : "Enrollment failed." };
    }
  });

  /**
   * POST /api/me/2fa/confirm — finalize enrollment.
   * Body: { code: "123456" }
   * On success: user.totpEnabledAt is set, secret encrypted, 8 recovery codes
   * generated. Returns recovery codes — show ONCE in the UI.
   *
   * Accepts enrollment-required sessions (P1.10). On successful confirm the
   * intermediate session is rotated to a regular full-access one, and the
   * new token is included in the response so the SPA can swap immediately.
   */
  app.post("/api/me/2fa/confirm", async (request, reply) => {
    const bearer = readBearerToken(request.headers.authorization);
    const resolved = await resolveSession(bearer, { allowEnrollmentRequired: true });
    if (!resolved) { reply.code(401); return { error: "Login required." }; }
    const user = resolved.user;
    const body = (request.body ?? {}) as { code?: string };
    const code = (body.code ?? "").trim();
    if (!/^\d{6}$/.test(code)) {
      reply.code(400);
      return { error: "Verification code must be 6 digits." };
    }
    try {
      const result = await confirmTotp(user.id, code);
      // If this confirm came from an enrollment-required session, rotate it
      // into a regular session so the user immediately has full access. The
      // SPA replaces its stored token from this response.
      if (resolved.restriction === "enrollment-required" && bearer) {
        const rotated = await (await import("./auth/session.js")).rotateSession(bearer);
        if (rotated) {
          return { ...result, sessionToken: rotated.token, sessionExpiresAt: rotated.expiresAt };
        }
      }
      return result;
    } catch (err) {
      if (err instanceof TotpError) {
        if (err.reason === "no-pending") {
          reply.code(404);
          return { error: "No pending enrollment found. Start enrollment first." };
        }
        if (err.reason === "expired") {
          reply.code(410);
          return { error: "Enrollment expired. Please start enrollment again." };
        }
        if (err.reason === "wrong-code") {
          reply.code(400);
          return { error: "Verification code is incorrect." };
        }
      }
      reply.code(500);
      return { error: err instanceof Error ? err.message : "Confirmation failed." };
    }
  });

  /**
   * POST /api/me/2fa/disable — turn off 2FA.
   * Body: { password: "..." }
   * Requires fresh password verification (or — for OAuth-only accounts — a
   * valid TOTP code) to prevent session-hijack-driven 2FA removal.
   */
  app.post("/api/me/2fa/disable", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    if (!user.totpEnabledAt) {
      reply.code(409);
      return { error: "Two-factor authentication is not enabled." };
    }
    const body = (request.body ?? {}) as { password?: string; code?: string };
    // Re-auth: prefer password (the dominant case). For OAuth-only accounts
    // without a password, fall back to a fresh TOTP code as proof of possession.
    const hasPasswordRecheck = typeof body.password === "string" && body.password.length > 0;
    const hasCodeRecheck = typeof body.code === "string" && /^\d{6}$/.test(body.code.trim());
    if (!hasPasswordRecheck && !hasCodeRecheck) {
      reply.code(400);
      return { error: "Re-authentication required: provide your password or a current 2FA code." };
    }
    if (hasPasswordRecheck) {
      if (!user.passwordHash || !user.passwordSalt) {
        reply.code(400);
        return { error: "This account has no local password; provide a current 2FA code instead." };
      }
      const { verifyPassword } = await import("./auth/password.js");
      const ok = await verifyPassword(body.password!, user.passwordSalt, user.passwordHash);
      if (!ok) {
        reply.code(401);
        return { error: "Password is incorrect." };
      }
    } else {
      const { verifyTotp } = await import("./auth/index.js");
      const result = await verifyTotp(user.id, body.code!.trim());
      if (result !== "ok") {
        reply.code(401);
        return { error: "Verification code is incorrect." };
      }
    }
    try {
      await disableTotp(user.id);
      return { ok: true };
    } catch (err) {
      reply.code(500);
      return { error: err instanceof Error ? err.message : "Disable failed." };
    }
  });

  /**
   * POST /api/me/2fa/regenerate-recovery — issue 8 fresh recovery codes,
   * invalidating the prior set. Returns the new plaintexts ONCE.
   */
  app.post("/api/me/2fa/regenerate-recovery", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    if (!user.totpEnabledAt) {
      reply.code(409);
      return { error: "Two-factor authentication is not enabled." };
    }
    try {
      const recoveryCodes = await regenerateTotpRecoveryCodes(user.id);
      return { recoveryCodes };
    } catch (err) {
      if (err instanceof TotpError && err.reason === "not-enrolled") {
        reply.code(409);
        return { error: "Two-factor authentication is not enabled." };
      }
      reply.code(500);
      return { error: err instanceof Error ? err.message : "Regenerate failed." };
    }
  });

  app.post("/api/connections/connect", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) {
      reply.code(401);
      return { error: "Login is required before saving a server connection." };
    }

    try {
      return await createConnection(user.id, request.body as Parameters<typeof createConnection>[1]);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : "Connection validation failed" };
    }
  });

  // 对已保存的连接重新探测，刷新 probeSnapshot
  app.post("/api/connections/:id/reprobe", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) {
      reply.code(401);
      return { error: "Login required." };
    }
    const { id } = request.params as { id: string };
    const updated = await reprobeConnection(id, user.id);
    if (!updated) {
      reply.code(404);
      return { error: "Connection not found or has no agentUrl." };
    }
    return { connection: updated };
  });

  // 列出当前用户所有连接档案
  app.get("/api/connections", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) {
      reply.code(401);
      return { error: "Login required." };
    }
    const connections = await listUserConnections(user.id);
    return { connections };
  });

  // 删除连接档案
  app.delete("/api/connections/:id", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const deleted = await updateRuntimeDatabase((db) => {
      const index = db.connections.findIndex((c) => c.id === id && c.userId === user.id);
      if (index === -1) return false;
      db.connections.splice(index, 1);
      return true;
    });
    if (!deleted) { reply.code(404); return { error: "Connection not found." }; }
    return { ok: true };
  });

  // 更新连接档案（标签、agentUrl）
  app.patch("/api/connections/:id", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { label?: string; agentUrl?: string };
    const updated = await updateRuntimeDatabase((db) => {
      const conn = db.connections.find((c) => c.id === id && c.userId === user.id);
      if (!conn) return null;
      if (body.label?.trim()) conn.label = body.label.trim().slice(0, 100);
      if (body.agentUrl !== undefined) conn.agentUrl = body.agentUrl.trim() || undefined;
      conn.updatedAt = new Date().toISOString();
      return conn;
    });
    if (!updated) { reply.code(404); return { error: "Connection not found." }; }
    return { connection: updated };
  });

  // ── 用户配置组合 CRUD ──────────────────────────────────────

  // 创建配置组合（权限由 profiles.ts 内部校验）
  app.post("/api/profiles", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    try {
      const profile = await createUserProfile(user, request.body as Parameters<typeof createUserProfile>[1]);
      return { profile };
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : "Failed to create profile." };
    }
  });

  // 从已连接机器快速生成私有运行环境快照
  app.post("/api/connections/:id/upload-snapshot", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    try {
      const profile = await createVmSnapshot(user, id, request.body as Parameters<typeof createVmSnapshot>[2]);
      return { profile };
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : "Failed to create snapshot." };
    }
  });

  // 列出当前用户可见的配置组合（自己的 private + 所有 public）
  app.get("/api/profiles", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const profiles = await listUserProfiles(user);
    return { profiles };
  });

  // 获取单个配置组合
  app.get("/api/profiles/:id", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const profile = await getUserProfile(user, id);
    if (!profile) { reply.code(404); return { error: "Profile not found." }; }
    return { profile };
  });

  // 更新配置组合
  app.patch("/api/profiles/:id", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    try {
      const profile = await updateProfile(user, id, request.body as Parameters<typeof updateProfile>[2]);
      if (!profile) { reply.code(404); return { error: "Profile not found." }; }
      return { profile };
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : "Failed to update profile." };
    }
  });

  // 删除配置组合
  app.delete("/api/profiles/:id", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const deleted = await deleteUserProfile(user, id);
    if (!deleted) { reply.code(404); return { error: "Profile not found." }; }
    return { ok: true };
  });

  // Capability Catalog: official rules plus user-published capability profiles.
  app.get("/api/catalog/all", async () => {
    const [official, userUploaded] = await Promise.all([
      listCatalogFromDatabase(),
      listAllPublicProfilesAsCatalog()
    ]);
    return { items: [...official, ...userUploaded] };
  });

  // ── 任务执行 ──────────────────────────────────────────────

  // 对已连接机器执行配置安装/应用（dry-run 或真实执行）
  app.post("/api/execute", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    if (process.env.ENVFORGE_ENABLE_LEGACY_EXECUTE !== "true") {
      reply.code(410);
      return {
        error: "Legacy direct execute is disabled. Create an Environment Plan, review it, then apply the approved plan."
      };
    }

    const body = (request.body ?? {}) as {
      connectionId?: string;
      profileId?: string;
      dryRun?: boolean;
      /**
       * Optional user-supplied vars from the configurable Playbook form.
       * Validated against the catalog item's vars.schema.json before being
       * passed to the runner. Ignored for items without a schema.
       */
      vars?: Record<string, unknown>;
    };
    if (!body.connectionId || !body.profileId) {
      reply.code(400);
      return { error: "connectionId and profileId are required." };
    }

    const db = await readRuntimeDatabase();
    const connection = db.connections.find((c) => c.id === body.connectionId && c.userId === user.id);
    if (!connection) { reply.code(404); return { error: "Connection not found." }; }

    const dryRun = body.dryRun !== false;
    const { registerBatchTask, executeCatalogTask, executePlaybookTask, getTask: gt } = await import("./executor.js");

    // Try catalog item first
    const catalogItems = await listCatalogFromDatabase();
    const catalogItem = catalogItems.find((c) => c.id === body.profileId);
    if (catalogItem) {
      // Validate user vars against the schema (if any). A vars schema makes the
      // form explicit; if user submits something the schema rejects, we fail
      // loudly here rather than silently feeding bad values to the runner.
      let normalizedVars: Record<string, unknown> | undefined;
      if (body.vars && Object.keys(body.vars).length > 0) {
        const { loadVarsSchema, validateAndNormalise } = await import("./catalog-vars-schema.js");
        const schema = await loadVarsSchema(catalogItem.id);
        if (schema) {
          const result = validateAndNormalise(schema, body.vars);
          if (!result.ok) {
            reply.code(400);
            return { error: "Invalid vars", fieldErrors: result.errors };
          }
          normalizedVars = result.values;
        } else {
          // No schema for this item — user vars are silently ignored to avoid
          // letting arbitrary template data reach the runner unchecked.
        }
      }

      const taskId = registerBatchTask(user.id, connection.id, [{ catalogId: catalogItem.id, displayName: catalogItem.name }], dryRun);
      void executeCatalogTask(user.id, connection, catalogItem.id, catalogItem.name, dryRun, taskId, normalizedVars);
      const task = gt(taskId);
      return { taskId, dryRun, steps: task?.steps ?? [] };
    }

    // Try user profile
    const profile = db.userProfiles.find((p) => p.id === body.profileId);
    if (profile) {
      const { buildPlaybookFromProfile } = await import("./executor.js");
      const yaml = buildPlaybookFromProfile(profile);
      const taskId = registerBatchTask(user.id, connection.id, [{ catalogId: profile.id, displayName: profile.name }], dryRun);
      void executePlaybookTask(user.id, connection, yaml, dryRun, taskId);
      const task = gt(taskId);
      return { taskId, dryRun, steps: task?.steps ?? [] };
    }

    reply.code(404);
    return { error: "Profile or catalog item not found." };
  });

  // ── 影响范围预估 ────────────────────────────────────────

  app.get("/api/catalog/:id/impact", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const { hasPlaybook, loadPlaybookFromCatalog, parsePlaybook } = await import("./engine/index.js");
      const { estimateImpact } = await import("./engine/impact.js");
      if (!(await hasPlaybook(id))) { reply.code(404); return { error: "Playbook not found." }; }
      const yaml = await loadPlaybookFromCatalog(id);
      const playbook = parsePlaybook(yaml);
      const impact = estimateImpact(playbook);
      return { impact };
    } catch (err) {
      reply.code(500);
      return { error: err instanceof Error ? err.message : "Impact estimation failed" };
    }
  });

  app.post("/api/impact/batch", async (request, reply) => {
    const body = (request.body ?? {}) as { catalogIds?: string[] };
    if (!Array.isArray(body.catalogIds) || body.catalogIds.length === 0) {
      reply.code(400); return { error: "catalogIds[] is required." };
    }
    try {
      const { hasPlaybook, loadPlaybookFromCatalog, parsePlaybook } = await import("./engine/index.js");
      const { estimateImpact } = await import("./engine/impact.js");
      const catalogItems = await listCatalogFromDatabase();
      const reports: Array<{ catalogId: string; name: string; impact: any }> = [];
      let totalDisk = 0, totalSeconds = 0, maxRisk: "low" | "medium" | "high" = "low";
      let needsSudo = false;

      for (const cid of body.catalogIds) {
        const item = catalogItems.find((c) => c.id === cid);
        if (!item) continue;
        if (!(await hasPlaybook(cid))) continue;
        const yaml = await loadPlaybookFromCatalog(cid);
        const playbook = parsePlaybook(yaml);
        const impact = estimateImpact(playbook);
        reports.push({ catalogId: cid, name: item.name, impact });
        totalDisk += impact.totalDiskDeltaMb;
        totalSeconds += impact.estimatedSeconds;
        if (impact.needsSudo) needsSudo = true;
        if (impact.maxRisk === "high") maxRisk = "high";
        else if (impact.maxRisk === "medium" && maxRisk !== "high") maxRisk = "medium";
      }

      return {
        reports,
        totals: {
          diskDeltaMb: totalDisk,
          estimatedSeconds: totalSeconds,
          needsSudo,
          maxRisk,
          summaryZh: `共 ${reports.length} 项，预计磁盘 +${totalDisk}MB，耗时 ~${totalSeconds}s`,
          summaryEn: `${reports.length} items, disk +${totalDisk}MB, ~${totalSeconds}s`
        }
      };
    } catch (err) {
      reply.code(500);
      return { error: err instanceof Error ? err.message : "Batch impact failed" };
    }
  });

  // ── Remove Capability Plan ─────────────────────────────────────────────
  // EnvForge does not expose direct uninstall. Removals must go through a
  // reviewable Remove Capability Plan that records evidence, preserves data
  // by default, and tracks rollback boundaries.

  app.post("/api/connections/:id/remove-capability-plan", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as {
      packages?: string[];
      source?: string;
      reason?: string;
      preserveData?: boolean;
      managedByEnvForge?: boolean;
    };
    if (!body.packages || body.packages.length === 0) {
      reply.code(400); return { error: "packages[] is required." };
    }
    const db = await readRuntimeDatabase();
    const conn = db.connections.find((c) => c.id === id && c.userId === user.id);
    if (!conn) { reply.code(404); return { error: "Connection not found." }; }

    const source = body.source ?? "apt";
    const pkgNames = body.packages.map((pkg) => pkg.trim()).filter(Boolean);
    const plan = buildRemovePlan({
      targetConnectionId: conn.id,
      packages: pkgNames,
      source,
      managedByEnvForge: body.managedByEnvForge === true,
      preserveDataByDefault: body.preserveData !== false
    });
    await saveEnvironmentPlan(plan, user.id);
    reply.header("Deprecation", "true");
    reply.header("Link", '</api/plans>; rel="successor-version"');
    return { plan };
  });

  app.post("/api/connections/:id/apply-remove-plan", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as {
      plan?: EnvironmentPlan;
      packages?: string[];
      source?: string;
      dryRun?: boolean;
      acknowledged?: boolean;
      unmanagedRiskAcknowledged?: boolean;
    };
    if (!body.acknowledged) {
      reply.code(400); return { error: "Remove plans require explicit risk acknowledgement." };
    }
    const db = await readRuntimeDatabase();
    const conn = db.connections.find((c) => c.id === id && c.userId === user.id);
    if (!conn) { reply.code(404); return { error: "Connection not found." }; }

    const dryRun = body.dryRun !== false;
    const plan = body.plan ?? buildRemovePlan({
      targetConnectionId: conn.id,
      packages: body.packages ?? [],
      source: body.source ?? "apt",
      managedByEnvForge: false,
      preserveDataByDefault: true
    });
    if (plan.type !== "remove" || !plan.export?.yaml) {
      reply.code(400); return { error: "A valid Remove Capability Plan is required." };
    }
    const unmanaged = plan.review.reasons.some((reason) => /unmanaged/i.test(reason));
    if (unmanaged && body.dryRun === false && !body.unmanagedRiskAcknowledged) {
      reply.code(400); return { error: "Unmanaged remove plans are blocked until unmanagedRiskAcknowledged=true." };
    }
    const pkgNames = plan.items.flatMap((item) => item.actions.flatMap((action) => action.packageNames ?? []));
    if (pkgNames.length === 0) {
      reply.code(400); return { error: "Remove plan has no packages." };
    }
    await saveEnvironmentPlan(plan, user.id);
    const { registerBatchTask, executePlaybookTask, getTask: gt } = await import("./executor.js");
    const taskId = registerBatchTask(user.id, conn.id, [{ catalogId: "remove-capability", displayName: `Remove capability ${pkgNames.join(", ")}` }], dryRun);
    void executePlaybookTask(user.id, conn, plan.export.yaml, dryRun, taskId);
    const nextStatus: EnvironmentPlan["status"] = dryRun ? "approved" : "applying";
    await setPlanStatus(plan.id, user.id, nextStatus);
    await appendPlanHistory(plan.id, user.id, "applied", dryRun ? "dry-run remove" : "remove applied");
    const task = gt(taskId);
    reply.header("Deprecation", "true");
    reply.header("Link", '</api/plans>; rel="successor-version"');
    return { taskId, dryRun, planType: "remove", packages: pkgNames, plan, steps: task?.steps ?? [] };
  });

  app.post("/api/connections/:id/uninstall", async (_request, reply) => {
    reply.code(410);
    return {
      error: "Direct uninstall is not part of the EnvForge product flow. Create a Remove Capability Plan and apply it after review."
    };
  });

  // ── Docker Compose 部署模式 ─────────────────────────────

  app.get("/api/catalog/:id/docker-compose", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const { resolveFromRoot } = await import("./repo.js");
      const path = await import("node:path");
      const fs = await import("node:fs/promises");
      const composePath = resolveFromRoot(path.join("configs/catalog/docker", `${id}.yaml`));
      const content = await fs.readFile(composePath, "utf8");
      reply.type("text/yaml");
      return content;
    } catch {
      reply.code(404);
      return { error: `No Docker Compose file for ${id}` };
    }
  });

  // ── vm-snapshot 四阶段部署 ────────────────────────────────

  app.get("/api/profiles/:id/staged-playbooks", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const profile = await getUserProfile(user, id);
    if (!profile) { reply.code(404); return { error: "Profile not found." }; }
    if (profile.kind !== "vm-snapshot") {
      reply.code(400);
      return { error: "Staged deployment is only supported for vm-snapshot profiles." };
    }
    const { buildSnapshotEvidenceStages } = await import("./snapshot-to-plan.js");
    return { stages: buildSnapshotEvidenceStages(profile) };
  });

  app.post("/api/profiles/:id/deploy-stage", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    reply.code(410);
    return {
      error: "Snapshot stages are evidence only. Build a Migration Plan from the snapshot before applying target changes."
    };
  });

  /**
   * Convert a vm-snapshot profile into review-ready evidence stages.
   *
   * EnvForge does not deploy snapshots. This endpoint replaces the legacy
   * `/api/profiles/:id/deploy-stage` name with the design-document name
   * `plan-stage`. It returns the same evidence stages produced by
   * `buildSnapshotEvidenceStages`, expressed as YAML the operator can
   * inspect before turning into a Migration Plan.
   */
  app.get("/api/profiles/:id/plan-stage", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const profile = await getUserProfile(user, id);
    if (!profile) { reply.code(404); return { error: "Profile not found." }; }
    if (profile.kind !== "vm-snapshot") {
      reply.code(400);
      return { error: "plan-stage is only supported for vm-snapshot profiles." };
    }
    const { buildSnapshotEvidenceStages } = await import("./snapshot-to-plan.js");
    return { stages: buildSnapshotEvidenceStages(profile) };
  });

  // 获取任务状态
  app.get("/api/tasks/:id", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const task = getTask(id);
    if (!task || task.userId !== user.id) { reply.code(404); return { error: "Task not found." }; }
    return { task };
  });

  // Queue snapshot — admin only (for monitoring concurrency)
  app.get("/api/admin/queues", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") { reply.code(403); return { error: "Admin only." }; }
    const { getQueueSnapshot } = await import("./task-queue.js");
    return { queues: getQueueSnapshot() };
  });

  app.get("/api/admin/queue", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") { reply.code(403); return { error: "Admin only." }; }
    const { getQueueSnapshot } = await import("./task-queue.js");
    return { queues: getQueueSnapshot() };
  });

  // GET /api/admin/users — admin only
  app.get("/api/admin/capability-users", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") { reply.code(403); return { error: "Admin only." }; }
    const db = await readRuntimeDatabase();
    const users = db.users
      .filter((u) => !u.deletedAt)
      .map((u, index) => ({
        id: u.id,
        name: u.name,
        role: u.role === "admin" ? "reviewer" : "maintainer",
        assignedCapabilities: index % 2 === 0 ? ["runtime.nodejs", "web-server.nginx"] : ["database.postgresql"],
        openSuggestions: u.role === "admin" ? 2 : 1,
        openBacklogItems: u.role === "admin" ? 3 : 1,
        reviewLoad: u.role === "admin" ? 5 : 2,
        lastActive: u.createdAt
      }));
    return { users };
  });

  app.get("/api/admin/capability-queues", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") { reply.code(403); return { error: "Admin only." }; }
    const now = new Date().toISOString();
    return {
      queues: [
        { id: "suggestion-triage", name: "Suggestion Triage", type: "Suggestion Triage", openItems: 4, priority: "P1", oldestItem: now, ownerGroup: "Capability reviewers", status: "open", nextAction: "Triage user suggestions and link related capabilities." },
        { id: "certification-review", name: "Certification Review", type: "Certification Review", openItems: 6, priority: "P0", oldestItem: now, ownerGroup: "Certification reviewers", status: "open", nextAction: "Review failed certification checks and assign rule owners." },
        { id: "package-integration-fix", name: "Package Integration Fix", type: "Package Integration Fix", openItems: 3, priority: "P1", oldestItem: now, ownerGroup: "Package rule maintainers", status: "open", nextAction: "Fill package maps, detection rules, validate commands, and rollback hooks." },
        { id: "rule-upgrade", name: "Rule Upgrade", type: "Rule Upgrade", openItems: 5, priority: "P0", oldestItem: now, ownerGroup: "Rule maintainers", status: "open", nextAction: "Generate upgrade prompts and move missing metrics into backlog." }
      ]
    };
  });

  app.get("/api/admin/users", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") { reply.code(403); return { error: "Admin only." }; }
    const db = await readRuntimeDatabase();
    const users = db.users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      deletedAt: u.deletedAt
    }));
    return { users };
  });

  // PUT /api/admin/users/:id/role — admin only
  app.put("/api/admin/users/:id/role", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") { reply.code(403); return { error: "Admin only." }; }
    const { id } = request.params as { id: string };
    const { role } = request.body as { role: string };
    if (role !== "user" && role !== "admin") {
      reply.code(400);
      return { error: "Invalid role. Must be 'user' or 'admin'." };
    }

    // Don't let the only remaining admin demote themselves
    if (id === user.id && role === "user") {
      const db = await readRuntimeDatabase();
      const otherAdmins = db.users.filter((u) => u.id !== user.id && u.role === "admin" && !u.deletedAt);
      if (otherAdmins.length === 0) {
        reply.code(400);
        return { error: "Cannot demote the only remaining admin." };
      }
    }

    const updatedUser = await updateRuntimeDatabase((db) => {
      const u = db.users.find((x) => x.id === id);
      if (!u) return null;
      u.role = role as "user" | "admin";
      u.updatedAt = new Date().toISOString();
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
        deletedAt: u.deletedAt
      };
    });

    if (!updatedUser) {
      reply.code(404);
      return { error: "User not found." };
    }
    return { user: updatedUser };
  });

  // POST /api/admin/users/:id/toggle-lock — admin only
  app.post("/api/admin/users/:id/toggle-lock", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") { reply.code(403); return { error: "Admin only." }; }
    const { id } = request.params as { id: string };

    // Don't let the only remaining admin lock/delete themselves
    if (id === user.id) {
      const db = await readRuntimeDatabase();
      const otherAdmins = db.users.filter((u) => u.id !== user.id && u.role === "admin" && !u.deletedAt);
      if (otherAdmins.length === 0) {
        reply.code(400);
        return { error: "Cannot lock the only remaining admin account." };
      }
    }

    const updatedUser = await updateRuntimeDatabase((db) => {
      const u = db.users.find((x) => x.id === id);
      if (!u) return null;
      if (u.deletedAt) {
        delete u.deletedAt; // unlock
      } else {
        u.deletedAt = new Date().toISOString(); // lock
      }
      u.updatedAt = new Date().toISOString();
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
        deletedAt: u.deletedAt
      };
    });

    if (!updatedUser) {
      reply.code(404);
      return { error: "User not found." };
    }
    return { user: updatedUser };
  });

  // (SSE stream moved to bottom with query token auth support)

  // 从当前连接的 probeSnapshot 提取热门组合草稿
  app.get("/api/connections/:id/extract-combo", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const db = await readRuntimeDatabase();
    const conn = db.connections.find((c) => c.id === id && c.userId === user.id);
    if (!conn) { reply.code(404); return { error: "Connection not found." }; }
    if (!conn.probeSnapshot) { reply.code(400); return { error: "No probe data. Please connect first." }; }

    const snap = conn.probeSnapshot;
    const components = [
      ...snap.software.map((s) => ({
        type: "software" as const,
        label: `${s.name} ${s.version}`,
        labelEn: `${s.name} ${s.version}`,
        detail: s.source
      })),
      ...snap.configChecklist.map((c) => ({
        type: "system-config" as const,
        label: c.label,
        labelEn: c.label,
        detail: c.category
      }))
    ];

    return {
      draft: {
        kind: "combo",
        name: `${snap.system.hostname} 配置组合`,
        nameEn: `${snap.system.hostname} combo`,
        category: "runtime",
        summary: `从 ${snap.system.hostname} 提取的配置组合，采集于 ${snap.collectedAt.slice(0, 10)}`,
        summaryEn: `Combo extracted from ${snap.system.hostname} on ${snap.collectedAt.slice(0, 10)}`,
        sensitivity: "review",
        components,
        installMode: "skip-existing"
      }
    };
  });

  app.post("/api/diff", async (request) => {
    const body = request.body as {
      current: Parameters<typeof diffSnapshots>[0];
      target: Parameters<typeof diffSnapshots>[1];
    };

    return {
      items: diffSnapshots(body.current, body.target)
    };
  });

  app.post("/api/restore/plan", async (request) => {
    const body = request.body as {
      snapshot: Parameters<typeof createRestorePlan>[0];
      targetSnapshotPath?: string;
    };

    return createRestorePlan(body.snapshot, body.targetSnapshotPath);
  });

  // ── SSH Key 管理 ────────────────────────────────────────

  app.post("/api/keys", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const body = (request.body ?? {}) as { label?: string; privateKey?: string };
    if (!body.privateKey) { reply.code(400); return { error: "privateKey is required." }; }
    const { saveUserKey } = await import("./key-store.js");
    const meta = await saveUserKey(user.id, body.label || "My key", body.privateKey);
    return { key: meta };
  });

  app.get("/api/keys", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { listUserKeys } = await import("./key-store.js");
    const keys = await listUserKeys(user.id);
    return { keys };
  });

  app.delete("/api/keys/:id", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const { deleteUserKey } = await import("./key-store.js");
    await deleteUserKey(user.id, id);
    return { ok: true };
  });

  // ── Environment evidence capture ───────────────────────────────────────
  // EnvForge captures evidence YAML from a connected VM. The output is *not*
  // a deployment artifact: it must enter a Migration or Imported Recipe Plan
  // before it can change a target host.

  app.get("/api/connections/:id/capture", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const db = await readRuntimeDatabase();
    const conn = db.connections.find((c) => c.id === id && c.userId === user.id);
    if (!conn) { reply.code(404); return { error: "Connection not found." }; }
    try {
      const { captureEnvironment } = await import("./capture.js");
      const { Ssh2Executor } = await import("./engine/ssh-executor.js");
      const client = await connectSshForUser(conn, user.id);
      const executor = new Ssh2Executor(client);
      try {
        const result = await captureEnvironment(executor);
        return {
          evidenceReport: result.evidenceReport,
          evidenceYaml: result.evidenceYaml,
          /**
           * @deprecated Old clients still read `playbookYaml`. New code should
           * read `evidenceReport.yaml` or `evidenceYaml`. All three fields
           * point at the same string.
           */
          playbookYaml: result.playbookYaml,
          summary: result.summary,
          redactions: result.redactions,
          skippedPaths: result.skippedPaths,
          connectionId: id,
          capturedAt: new Date().toISOString()
        };
      } finally { client.end(); }
    } catch (err) {
      reply.code(500);
      return { error: err instanceof Error ? err.message : "Capture failed" };
    }
  });

  // Preflight: read-only checks before running a Playbook
  app.get("/api/connections/:id/preflight", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const db = await readRuntimeDatabase();
    const conn = db.connections.find((c) => c.id === id && c.userId === user.id);
    if (!conn) { reply.code(404); return { error: "Connection not found." }; }
    try {
      const { runPreflight } = await import("./preflight.js");
      const { Ssh2Executor } = await import("./engine/ssh-executor.js");
      const client = await connectSshForUser(conn, user.id);
      const executor = new Ssh2Executor(client);
      try {
        const report = await runPreflight(executor);
        return { report };
      } finally { client.end(); }
    } catch (err) {
      reply.code(500);
      return { error: err instanceof Error ? err.message : "Preflight failed" };
    }
  });

  /**
   * GET /api/connections/:id/distro
   * 探测目标机器的发行版信息（仅 SSH 连一次跑 cat /etc/os-release + 检测 PM）。
   * 用途：Market 页让用户在选目标机器后立刻看到目标的 distro，并对照 catalog item 的
   * compatibility 字段标出每个 Playbook 的兼容性级别。
   */
  app.get("/api/connections/:id/distro", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const db = await readRuntimeDatabase();
    const conn = db.connections.find((c) => c.id === id && c.userId === user.id);
    if (!conn) { reply.code(404); return { error: "Connection not found." }; }
    try {
      const { detectDistroInfo } = await import("./distro-compat.js");
      const { Ssh2Executor } = await import("./engine/ssh-executor.js");
      const client = await connectSshForUser(conn, user.id);
      const executor = new Ssh2Executor(client);
      try {
        const distro = await detectDistroInfo(executor);
        return { distro };
      } finally { client.end(); }
    } catch (err) {
      reply.code(500);
      return { error: err instanceof Error ? err.message : "Distro detection failed" };
    }
  });

  /**
   * POST /api/compatibility/check
   * 给定 connectionId + 一组 catalogIds，返回每个 catalog item 的兼容性级别。
   * 不像上面的端点是单纯 distro 探测，这个会真正对照 Playbook 的 compatibility 声明。
   *
   * Body: { connectionId, catalogIds: string[] }
   * Response: {
   *   distro: DistroInfo,
   *   results: Array<{
   *     catalogId: string;
   *     level: "verified" | "compatible" | "untested" | "unsupported";
   *     reasonZh: string; reasonEn: string;
   *   }>
   * }
   */
  app.post("/api/compatibility/check", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const body = (request.body ?? {}) as { connectionId?: string; catalogIds?: string[] };
    if (!body.connectionId || !Array.isArray(body.catalogIds)) {
      reply.code(400);
      return { error: "connectionId and catalogIds[] are required." };
    }
    const db = await readRuntimeDatabase();
    const conn = db.connections.find((c) => c.id === body.connectionId && c.userId === user.id);
    if (!conn) { reply.code(404); return { error: "Connection not found." }; }
    try {
      const { detectDistroInfo, evaluateCompatibility } = await import("./distro-compat.js");
      const { Ssh2Executor } = await import("./engine/ssh-executor.js");
      const items = await listCatalogFromDatabase();
      const client = await connectSshForUser(conn, user.id);
      const executor = new Ssh2Executor(client);
      try {
        const distro = await detectDistroInfo(executor);
        const results = body.catalogIds.map((cid) => {
          const item = items.find((c) => c.id === cid);
          const evalResult = evaluateCompatibility(item?.compatibility, distro);
          return { catalogId: cid, ...evalResult };
        });
        return { distro, results };
      } finally { client.end(); }
    } catch (err) {
      reply.code(500);
      return { error: err instanceof Error ? err.message : "Compatibility check failed" };
    }
  });

  // Verify: re-probe target after a task completes; meant to be paired with task-history diff
  app.post("/api/connections/:id/verify", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { beforeProbe?: unknown };
    const db = await readRuntimeDatabase();
    const conn = db.connections.find((c) => c.id === id && c.userId === user.id);
    if (!conn) { reply.code(404); return { error: "Connection not found." }; }
    try {
      const { reprobeConnection } = await import("./connections.js");
      const updated = await reprobeConnection(id, user.id);
      const beforeSoftware = (body.beforeProbe as { software?: Array<{ name: string; version: string; source: string }> } | undefined)?.software ?? [];
      const afterSoftware = updated?.probeSnapshot?.software ?? [];
      const beforeKeys = new Set(beforeSoftware.map((s) => `${s.source}::${s.name}`));
      const afterKeys = new Set(afterSoftware.map((s) => `${s.source}::${s.name}`));
      const added = afterSoftware.filter((s) => !beforeKeys.has(`${s.source}::${s.name}`));
      const removed = beforeSoftware.filter((s) => !afterKeys.has(`${s.source}::${s.name}`));
      return {
        verifiedAt: new Date().toISOString(),
        addedSoftware: added,
        removedSoftware: removed,
        connection: updated
      };
    } catch (err) {
      reply.code(500);
      return { error: err instanceof Error ? err.message : "Verify failed" };
    }
  });

  // ── 任务历史 ────────────────────────────────────────────

  app.get("/api/tasks", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const db = await readRuntimeDatabase();
    const tasks = (db.tasks ?? []).filter((t) => t.userId === user.id).slice(0, 50);
    return { tasks };
  });

  // Capability catalog batch execution: apply a reviewed Environment Plan.

  app.post("/api/plans", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const body = (request.body ?? {}) as {
      type?: EnvironmentPlan["type"];
      targetConnectionId?: string;
      sourceConnectionId?: string;
      source?: (
        | { kind?: "capability-selection"; capabilityIds?: string[] }
        | { kind?: "recipe"; yaml?: string; name?: string }
        | { kind?: "remove-request"; packages?: string[]; source?: string; managedByEnvForge?: boolean; preserveData?: boolean }
        | { kind?: "config-change"; path?: string; content?: string }
        | { kind?: "repair-failures"; failures?: RepairFailure[]; name?: string; sourcePlanId?: string }
        | { kind?: "migration-session"; sessionId?: string }
        | { kind?: "existing-plan"; plan?: EnvironmentPlan }
      );
    };
    const db = await readRuntimeDatabase();
    const targetConnectionId = body.targetConnectionId;
    let plan: EnvironmentPlan | undefined;

    if (body.source?.kind === "existing-plan" && "plan" in body.source && body.source.plan) {
      plan = body.source.plan;
    } else if (body.source?.kind === "capability-selection" && "capabilityIds" in body.source) {
      if (!targetConnectionId) { reply.code(400); return { error: "targetConnectionId is required." }; }
      const connection = db.connections.find((c) => c.id === targetConnectionId && c.userId === user.id);
      if (!connection) { reply.code(404); return { error: "Connection not found." }; }
      const catalogItems = await listCatalogFromDatabase();
      const selected = (body.source.capabilityIds ?? [])
        .map((id) => catalogItems.find((item) => item.id === id))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
      if (!selected.length) { reply.code(400); return { error: "No capabilityIds matched the catalog." }; }
      // Certification gate: end-user plan creation refuses any
      // capability that is not Full Migration Certified. Admin tooling
      // (e.g. the registry edit page) goes through different routes.
      const { deriveCertification } = await import("./catalog-certification.js");
      const refused = selected.filter((item) => !deriveCertification(item).visibleToUsers);
      if (refused.length > 0 && user.role !== "admin") {
        reply.code(400);
        return {
          error: "Plan refused: one or more selected capabilities are not Full Migration Certified.",
          refused: refused.map((item) => ({
            id: item.id,
            certification: deriveCertification(item)
          }))
        };
      }
      // Build Mode contract: pull existing capabilities from the target
      // snapshot so the planner can emit target-state conflicts and
      // reconcile evidence. See docs/validation.md "Target Snapshot
      // in Build Mode".
      const targetSnapshotMeta = computeTargetSnapshotMeta(connection, catalogItems);
      plan = buildRebuildPlan(selected, connection.id, {
        existingCapabilities: targetSnapshotMeta.existingCapabilities,
        targetSnapshotAvailable: targetSnapshotMeta.available,
        targetSnapshotAgeMs: targetSnapshotMeta.ageMs
      });
    } else if (body.source?.kind === "recipe" && "yaml" in body.source) {
      if (!targetConnectionId) { reply.code(400); return { error: "targetConnectionId is required." }; }
      const connection = db.connections.find((c) => c.id === targetConnectionId && c.userId === user.id);
      if (!connection) { reply.code(404); return { error: "Connection not found." }; }
      if (!body.source.yaml?.trim()) { reply.code(400); return { error: "recipe yaml is required." }; }
      plan = buildImportedRecipePlan({ targetConnectionId: connection.id, yaml: body.source.yaml, name: body.source.name });
    } else if (body.source?.kind === "remove-request" && "packages" in body.source) {
      if (!targetConnectionId) { reply.code(400); return { error: "targetConnectionId is required." }; }
      const connection = db.connections.find((c) => c.id === targetConnectionId && c.userId === user.id);
      if (!connection) { reply.code(404); return { error: "Connection not found." }; }
      // Pull managed-capability markers for this target. The Remove
      // plan uses them to decide which packages can be auto-removed.
      const { findManagedCapabilities } = await import("./managed-execution.js");
      const markers = await findManagedCapabilities({ targetHostId: connection.id });
      plan = buildRemovePlan({
        targetConnectionId: connection.id,
        packages: body.source.packages ?? [],
        source: body.source.source ?? "apt",
        managedByEnvForge: body.source.managedByEnvForge === true,
        preserveDataByDefault: body.source.preserveData !== false,
        managedMarkers: markers
      });
    } else if (body.source?.kind === "config-change" && "path" in body.source) {
      if (!targetConnectionId || !body.source.path || body.source.content === undefined) {
        reply.code(400); return { error: "targetConnectionId, path, and content are required." };
      }
      const connection = db.connections.find((c) => c.id === targetConnectionId && c.userId === user.id);
      if (!connection) { reply.code(404); return { error: "Connection not found." }; }
      const current = await readConfigFile(connection, body.source.path);
      const validation = await validateConfigFile(connection, body.source.path);
      plan = buildConfigChangePlan({
        targetConnectionId: connection.id,
        path: body.source.path,
        originalContent: current.content,
        candidateContent: body.source.content,
        validationCommand: validation.command
      });
    } else if (body.source?.kind === "repair-failures" && "failures" in body.source) {
      if (!targetConnectionId) { reply.code(400); return { error: "targetConnectionId is required." }; }
      const connection = db.connections.find((c) => c.id === targetConnectionId && c.userId === user.id);
      if (!connection) { reply.code(404); return { error: "Connection not found." }; }
      const failures = body.source.failures ?? [];
      if (failures.length === 0) { reply.code(400); return { error: "At least one failure entry is required." }; }
      plan = buildRepairPlan({
        targetConnectionId: connection.id,
        name: body.source.name,
        sourcePlanId: body.source.sourcePlanId,
        failures
      });
    } else if (body.source?.kind === "migration-session" && "sessionId" in body.source) {
      // Phase 3: promote a migration session into a first-class Environment
      // Plan so review / apply / verify / report all run through the unified
      // engine + Plan center (instead of the legacy migration-session runner).
      const sessionId = body.source.sessionId;
      if (!sessionId) { reply.code(400); return { error: "sessionId is required." }; }
      const context = await loadMigrationSessionContext(user.id, sessionId);
      if (!context) { reply.code(404); return { error: "Migration session not found." }; }
      if (!context.conn.probeSnapshot) { reply.code(400); return { error: "Probe the source connection before generating a migration plan." }; }
      const artifacts = buildSessionArtifacts(context);
      if (!artifacts.plan) { reply.code(400); return { error: "Migration plan is not available yet — complete selection and review first." }; }
      const target = targetConnectionId ?? context.session.targetConnectionId;
      if (!target) { reply.code(400); return { error: "targetConnectionId is required to deliver the migration plan." }; }
      const targetConn = db.connections.find((c) => c.id === target && c.userId === user.id);
      if (!targetConn) { reply.code(404); return { error: "Target connection not found." }; }
      plan = migrationPlanToEnvironmentPlan(artifacts.plan, target);
    }

    if (!plan) { reply.code(400); return { error: "Unsupported Environment Plan source." }; }
    await saveEnvironmentPlan(plan, user.id);
    return { plan };
  });

  app.get("/api/plans", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const query = (request.query ?? {}) as { type?: EnvironmentPlan["type"]; status?: EnvironmentPlan["status"]; targetConnectionId?: string };
    const records = await listStoredPlans(user.id, {
      type: query.type,
      status: query.status,
      targetConnectionId: query.targetConnectionId
    });
    return {
      plans: records.map((row) => ({
        id: row.id,
        type: row.type,
        status: row.status,
        name: row.name,
        sourceHost: row.sourceHost,
        targetConnectionId: row.targetConnectionId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        verifyResults: row.verifyResults ?? [],
        rollbackResults: row.rollbackResults ?? []
      }))
    };
  });

  app.get("/api/plans/:id", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const record = await getStoredPlan(id, user.id);
    if (!record) { reply.code(404); return { error: "Plan not found." }; }
    const plan = asEnvironmentPlan(record);
    return { plan, verifyResults: record.verifyResults ?? [], rollbackResults: record.rollbackResults ?? [], history: record.history ?? [] };
  });

  app.post("/api/plans/:id/review", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as {
      plan?: EnvironmentPlan;
      decision?: "approved" | "rejected";
      note?: string;
      acknowledgedRisks?: Array<{ itemId: string; risks: string[] }>;
      acknowledgedConflicts?: Array<{ conflictId: string; resolutionId?: string }>;
      acknowledgedApprovals?: Array<{ itemId: string; gateId: string }>;
    };
    let record = await getStoredPlan(id, user.id);
    if (!record && body.plan) record = await saveEnvironmentPlan(body.plan, user.id);
    if (!record) { reply.code(404); return { error: "Plan not found." }; }

    // Persist any acknowledgements supplied during review onto the plan
    // payload so the apply gate can verify them later. Acknowledgements
    // are merged with prior values rather than replaced — the operator
    // builds them up as they tick checkboxes.
    if (body.acknowledgedRisks?.length || body.acknowledgedConflicts?.length || body.acknowledgedApprovals?.length) {
      const plan = asEnvironmentPlan(record);
      const merged = mergeAcks(plan.approvals, {
        risks: body.acknowledgedRisks,
        conflicts: body.acknowledgedConflicts,
        approvals: body.acknowledgedApprovals
      });
      const now = new Date().toISOString();
      const nextApprovals: PlanApprovalState = {
        risks: merged.risks,
        conflicts: merged.conflicts.map((entry) => ({
          conflictId: entry.conflictId,
          resolutionId: entry.resolutionId,
          ackedAt: plan.approvals?.conflicts?.find((c) => c.conflictId === entry.conflictId)?.ackedAt ?? now
        })),
        approvals: merged.approvals.map((entry) => ({
          itemId: entry.itemId,
          gateId: entry.gateId,
          ackedAt:
            plan.approvals?.approvals?.find((a) => a.itemId === entry.itemId && a.gateId === entry.gateId)?.ackedAt ?? now
        }))
      };
      record = await saveEnvironmentPlan({ ...plan, approvals: nextApprovals }, user.id);
    }

    // The decision is only honoured when the apply gate would accept the
    // plan — otherwise the plan stays needs-review with the stored
    // acknowledgements visible in the response.
    let nextStatus: EnvironmentPlanStatus = "needs-review";
    if (body.decision === "approved") {
      const plan = asEnvironmentPlan(record);
      const verdict = evaluateApplyGate(plan, {
        risks: plan.approvals?.risks,
        conflicts: plan.approvals?.conflicts,
        approvals: plan.approvals?.approvals
      });
      if (verdict.ok) nextStatus = "approved";
    }
    const updated = await setPlanStatus(id, user.id, nextStatus, body.note);
    return { plan: asEnvironmentPlan(updated ?? record) };
  });

  app.post("/api/plans/:id/apply", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as {
      plan?: EnvironmentPlan;
      dryRun?: boolean;
      acknowledged?: boolean;
      path?: string;
      content?: string;
      unmanagedRiskAcknowledged?: boolean;
      acknowledgedRisks?: Array<{ itemId: string; risks: string[] }>;
      acknowledgedConflicts?: Array<{ conflictId: string; resolutionId?: string }>;
      acknowledgedApprovals?: Array<{ itemId: string; gateId: string }>;
    };
    let record = await getStoredPlan(id, user.id);
    if (!record && body.plan) record = await saveEnvironmentPlan(body.plan, user.id);
    if (!record) { reply.code(404); return { error: "Plan not found." }; }
    const plan = asEnvironmentPlan(record);
    if (body.dryRun === false && plan.status !== "approved" && !body.acknowledged) {
      reply.code(400); return { error: "Only approved Environment Plans can be applied." };
    }
    // Honor `blockedUntilApproved` per-action: if any action is still
    // explicitly gated, refuse a non-dry apply unless every gated id is
    // listed in body.acknowledgedActionIds.
    if (body.dryRun === false) {
      const ackIds = new Set((body as { acknowledgedActionIds?: string[] }).acknowledgedActionIds ?? []);
      const gated = plan.items
        .flatMap((item) => item.actions)
        .filter((action) => action.blockedUntilApproved && !ackIds.has(action.id));
      if (gated.length > 0) {
        reply.code(400);
        return {
          error: "Plan contains actions marked blockedUntilApproved that have not been acknowledged.",
          gated: gated.map((a) => ({ id: a.id, label: a.label, risk: a.risk }))
        };
      }
    }

    // Catalog Audit Enforcement: conflict / risk / approval gate.
    // Acknowledgements arrive in the request body OR have already been
    // recorded onto plan.approvals during Plan Review. We merge both.
    if (body.dryRun === false) {
      const acks = mergeAcks(plan.approvals, {
        risks: body.acknowledgedRisks,
        conflicts: body.acknowledgedConflicts,
        approvals: body.acknowledgedApprovals
      });
      const verdict = evaluateApplyGate(plan, acks);
      if (!verdict.ok) {
        reply.code(400);
        return {
          error: "Apply gate refused: catalog audit acknowledgements are missing.",
          gate: {
            blockingConflicts: verdict.blockingConflicts,
            unresolvedWarnConflicts: verdict.unresolvedWarnConflicts,
            missingRiskAcks: verdict.missingRiskAcks,
            missingApprovalGates: verdict.missingApprovalGates,
            reasons: verdict.reasons
          }
        };
      }
    }
    const db = await readRuntimeDatabase();
    const conn = db.connections.find((c) => c.id === plan.targetConnectionId && c.userId === user.id);
    if (!conn) { reply.code(404); return { error: "Target connection not found." }; }
    const dryRun = body.dryRun !== false;

    if (plan.type === "remove") {
      const unmanaged = plan.review.reasons.some((reason) => /unmanaged/i.test(reason));
      if (unmanaged && body.dryRun === false && !body.unmanagedRiskAcknowledged) {
        reply.code(400);
        return { error: "Unmanaged remove plans are blocked until unmanagedRiskAcknowledged=true." };
      }
    }

    if (plan.type === "change") {
      if (!body.path || body.content === undefined) { reply.code(400); return { error: "path and content are required for config change apply." }; }
      const before = await readConfigFile(conn, body.path);
      const beforeValidation = await validateConfigFile(conn, body.path);
      const write = await writeConfigFile(conn, body.path, body.content, true);
      const afterValidation = await validateConfigFile(conn, body.path);
      let rollback: Awaited<ReturnType<typeof restoreConfigFileFromBackup>> | undefined;
      if (afterValidation.status === "failed") rollback = await restoreConfigFileFromBackup(conn, body.path);
      const finalStatus: EnvironmentPlan["status"] = afterValidation.status === "failed" ? "failed" : "succeeded";
      const updated = await setPlanStatus(id, user.id, finalStatus, write.message);
      await appendPlanHistory(id, user.id, "applied", `config write: ${write.message}`);
      return { plan: asEnvironmentPlan(updated ?? record), dryRun: false, before, beforeValidation, write, validation: afterValidation, rollback };
    }

    if (!plan.export?.yaml) { reply.code(400); return { error: "Plan has no executable recipe." }; }
    const { registerBatchTask, executePlaybookTask, getTask: gt } = await import("./executor.js");
    const taskItems = plan.items.map((item) => ({ catalogId: item.sourceId ?? item.id, displayName: item.name }));
    const taskId = registerBatchTask(user.id, conn.id, taskItems, dryRun);
    void executePlaybookTask(user.id, conn, plan.export.yaml, dryRun, taskId);
    const nextStatus: EnvironmentPlan["status"] = dryRun ? "approved" : "applying";
    const updated = await setPlanStatus(id, user.id, nextStatus);
    await appendPlanHistory(id, user.id, "applied", dryRun ? "dry-run" : "applied");
    const task = gt(taskId);
    return { taskId, dryRun, plan: asEnvironmentPlan(updated ?? record), totalItems: taskItems.length, items: task?.items ?? [] };
  });

  app.post("/api/plans/:id/verify", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const record = await getStoredPlan(id, user.id);
    if (!record) { reply.code(404); return { error: "Plan not found." }; }
    const plan = asEnvironmentPlan(record);
    if (!plan.targetConnectionId) {
      reply.code(400); return { error: "Plan has no target connection; verify cannot run." };
    }
    const db = await readRuntimeDatabase();
    const conn = db.connections.find((c) => c.id === plan.targetConnectionId && c.userId === user.id);
    if (!conn) { reply.code(404); return { error: "Target connection not found." }; }
    try {
      const outcome = await verifyPlanAndPersist({
        planId: id,
        userId: user.id,
        connection: conn,
        openClient: () => connectSshForUser(conn, user.id)
      });
      if (!outcome) { reply.code(404); return { error: "Plan not found." }; }
      return { plan: outcome.plan, results: outcome.results };
    } catch (err) {
      reply.code(500);
      return { error: err instanceof Error ? err.message : "Verify failed." };
    }
  });

  app.post("/api/plans/:id/rollback", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const record = await getStoredPlan(id, user.id);
    if (!record) { reply.code(404); return { error: "Plan not found." }; }
    const plan = asEnvironmentPlan(record);
    if (!plan.targetConnectionId) {
      reply.code(400); return { error: "Plan has no target connection; rollback cannot run." };
    }
    const db = await readRuntimeDatabase();
    const conn = db.connections.find((c) => c.id === plan.targetConnectionId && c.userId === user.id);
    if (!conn) { reply.code(404); return { error: "Target connection not found." }; }
    try {
      const outcome = await rollbackPlanAndPersist({
        planId: id,
        userId: user.id,
        connection: conn,
        openClient: () => connectSshForUser(conn, user.id)
      });
      if (!outcome) { reply.code(404); return { error: "Plan not found." }; }
      return { plan: outcome.plan, results: outcome.results };
    } catch (err) {
      reply.code(500);
      return { error: err instanceof Error ? err.message : "Rollback failed." };
    }
  });

  app.get("/api/plans/:id/report", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const query = (request.query ?? {}) as { format?: "markdown" | "json" };
    const record = await getStoredPlan(id, user.id);
    if (!record) { reply.code(404); return { error: "Plan not found." }; }
    const plan = asEnvironmentPlan(record);

    // Aggregate verify results into the structured report payload.
    const verifyPassed = (record.verifyResults ?? []).filter((r) => r.status === "passed").map((r) => r.label);
    const verifyFailed = (record.verifyResults ?? []).filter((r) => r.status === "failed" || r.status === "warning").map((r) => r.label);
    const verifyResults =
      (record.verifyResults?.length ?? 0) > 0
        ? { passed: verifyPassed, failed: verifyFailed }
        : undefined;

    // Pull action-run records from the runtime store. These are
    // produced by the managed-execution orchestrator (Managed Execution
    // Hardening phase). Empty when the plan has not been applied yet.
    const { listActionRunsForPlan } = await import("./managed-execution.js");
    const actionRuns = await listActionRunsForPlan(id);

    const structured = buildPlanReport(plan, { verifyResults, actionRuns });

    if (query.format === "markdown") {
      const markdown = planReportToMarkdown(structured);
      // Append legacy verify / rollback / history sections for parity
      // with the prior endpoint.
      const verifyLines = (record.verifyResults ?? []).map((r) => `- [${r.status}] ${r.label}${r.message ? ` — ${r.message}` : ""}`).join("\n");
      const rollbackLines = (record.rollbackResults ?? []).map((r) => `- [${r.status}] ${r.label}${r.message ? ` — ${r.message}` : ""}`).join("\n");
      const historyLines = (record.history ?? []).map((h) => `- ${h.at} ${h.event} (${h.actor})${h.note ? ` — ${h.note}` : ""}`).join("\n");
      const tail = [
        verifyLines ? `\n## Verify Results\n\n${verifyLines}\n` : "",
        rollbackLines ? `\n## Rollback Results\n\n${rollbackLines}\n` : "",
        historyLines ? `\n## History Trail\n\n${historyLines}\n` : ""
      ].join("");
      reply.header("Content-Type", "text/markdown; charset=utf-8");
      return { report: `${markdown}\n${tail}`, structured };
    }

    return { report: structured };
  });

  /**
   * Build a Repair Plan from the verify failures of an existing plan.
   *
   * Convenience endpoint: instead of asking the operator to assemble a
   * `RepairFailure[]` list by hand, we read the stored verify results for
   * `:id` and turn each non-passing entry into a repair candidate. The
   * mapping uses the action's kind to pick a default repair strategy:
   *
   *   - `restart` action → service-down (restart unit, then re-validate)
   *   - `writeConfig` / `copyConfig` → config-modified (restore backup)
   *   - `installPackage` → package-missing (reinstall)
   *   - anything else → verify-failed with manual review
   *
   * The operator still reviews and approves the resulting Repair Plan
   * through the normal `/api/plans/:id/review` + `/apply` flow.
   */
  app.post("/api/plans/:id/repair-from-verify", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const record = await getStoredPlan(id, user.id);
    if (!record) { reply.code(404); return { error: "Plan not found." }; }
    const sourcePlan = asEnvironmentPlan(record);
    if (!sourcePlan.targetConnectionId) {
      reply.code(400);
      return { error: "Plan has no target connection; cannot generate a Repair Plan." };
    }
    const failedResults = (record.verifyResults ?? []).filter((r) => r.status === "failed" || r.status === "warning");
    if (failedResults.length === 0) {
      reply.code(400);
      return { error: "Plan has no failed verify results to repair." };
    }
    // Build a quick action lookup from the source plan so we can map each
    // failed result back to its originating action.
    const actionLookup = new Map(sourcePlan.items.flatMap((item) => item.actions.map((action) => [action.id, action] as const)));
    const failures = failedResults.map((row): RepairFailure => {
      const action = actionLookup.get(row.actionId);
      const evidence = [
        `Verify result: ${row.status} at ${row.ranAt}.`,
        row.message ? `Message: ${row.message}` : "",
        row.output ? `Output: ${row.output}` : ""
      ].filter(Boolean) as string[];
      const severity: RepairFailure["severity"] = row.status === "failed" ? "high" : "medium";
      if (action?.kind === "restart" && action.serviceName) {
        return { label: row.label, kind: "service-down", serviceName: action.serviceName, validateCommand: action.verify, severity, evidence };
      }
      if ((action?.kind === "writeConfig" || action?.kind === "copyConfig") && action.path) {
        return { label: row.label, kind: "config-modified", path: action.path, validateCommand: action.verify, severity, evidence };
      }
      if (action?.kind === "installPackage" && action.packageNames?.length) {
        return { label: row.label, kind: "package-missing", packageNames: action.packageNames, validateCommand: action.verify, severity, evidence };
      }
      return {
        label: row.label,
        kind: "verify-failed",
        validateCommand: action?.command,
        severity,
        evidence
      };
    });
    const plan = buildRepairPlan({
      targetConnectionId: sourcePlan.targetConnectionId,
      name: `Repair: ${sourcePlan.name}`,
      sourcePlanId: sourcePlan.id,
      failures
    });
    await saveEnvironmentPlan(plan, user.id);
    return { plan };
  });

  // Deprecated: use POST /api/plans with source.kind="capability-selection".
  app.post("/api/rebuild-plan", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const body = (request.body ?? {}) as { connectionId?: string; catalogIds?: string[] };
    if (!body.connectionId || !Array.isArray(body.catalogIds) || body.catalogIds.length === 0) {
      reply.code(400); return { error: "connectionId and catalogIds[] are required." };
    }
    const db = await readRuntimeDatabase();
    const connection = db.connections.find((c) => c.id === body.connectionId && c.userId === user.id);
    if (!connection) { reply.code(404); return { error: "Connection not found." }; }
    const catalogItems = await listCatalogFromDatabase();
    const items = body.catalogIds
      .map((id) => catalogItems.find((item) => item.id === id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (items.length === 0) { reply.code(400); return { error: "None of the provided catalogIds were found." }; }
    const plan = buildRebuildPlan(items, connection.id);
    await saveEnvironmentPlan(plan, user.id);
    reply.header("Deprecation", "true");
    reply.header("Link", '</api/plans>; rel="successor-version"');
    return { plan };
  });

  // Deprecated: use POST /api/plans/:id/apply.
  app.post("/api/rebuild-plan/apply", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const body = (request.body ?? {}) as { connectionId?: string; plan?: EnvironmentPlan; dryRun?: boolean; acknowledged?: boolean };
    if (!body.connectionId || !body.plan || body.plan.type !== "rebuild" || !body.plan.export?.yaml) {
      reply.code(400); return { error: "connectionId and a valid Rebuild Plan are required." };
    }
    if (!body.acknowledged && body.dryRun === false) {
      reply.code(400); return { error: "Applying a Rebuild Plan requires explicit review acknowledgement." };
    }
    const db = await readRuntimeDatabase();
    const connection = db.connections.find((c) => c.id === body.connectionId && c.userId === user.id);
    if (!connection) { reply.code(404); return { error: "Connection not found." }; }
    const dryRun = body.dryRun !== false;
    await saveEnvironmentPlan(body.plan, user.id);
    const { registerBatchTask, executePlaybookTask, getTask: gt } = await import("./executor.js");
    const taskItems = body.plan.items.map((item) => ({ catalogId: item.sourceId ?? item.id, displayName: item.name }));
    const taskId = registerBatchTask(user.id, connection.id, taskItems, dryRun);
    void executePlaybookTask(user.id, connection, body.plan.export.yaml, dryRun, taskId);
    const nextStatus: EnvironmentPlan["status"] = dryRun ? "approved" : "applying";
    await setPlanStatus(body.plan.id, user.id, nextStatus);
    await appendPlanHistory(body.plan.id, user.id, "applied", dryRun ? "dry-run" : "applied");
    const task = gt(taskId);
    reply.header("Deprecation", "true");
    reply.header("Link", '</api/plans>; rel="successor-version"');
    return { taskId, dryRun, planType: "rebuild", plan: body.plan, totalItems: taskItems.length, items: task?.items ?? [] };
  });

  app.post("/api/batch-execute", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    if (process.env.ENVFORGE_ENABLE_LEGACY_EXECUTE !== "true") {
      reply.code(410);
      return { error: "Batch execute is deprecated. Create /api/plans from capability-selection and apply the approved Environment Plan." };
    }
    const body = (request.body ?? {}) as { connectionId?: string; catalogIds?: string[]; dryRun?: boolean };
    if (!body.connectionId || !Array.isArray(body.catalogIds) || body.catalogIds.length === 0) {
      reply.code(400); return { error: "connectionId and catalogIds[] are required." };
    }
    const db = await readRuntimeDatabase();
    const connection = db.connections.find((c) => c.id === body.connectionId && c.userId === user.id);
    if (!connection) { reply.code(404); return { error: "Connection not found." }; }
    const catalogItems = await listCatalogFromDatabase();
    const items = body.catalogIds.map((id) => { const item = catalogItems.find((c) => c.id === id); return item ? { catalogId: item.id, displayName: item.name } : null; }).filter((x): x is { catalogId: string; displayName: string } => x !== null);
    if (items.length === 0) { reply.code(400); return { error: "None of the provided catalogIds were found." }; }
    const dryRun = body.dryRun !== false;
    const selectedCatalogItems = catalogItems.filter((item) => body.catalogIds!.includes(item.id));
    const plan = buildRebuildPlan(selectedCatalogItems, connection.id);
    const { registerBatchTask, executePlaybookTask, getTask: gt } = await import("./executor.js");
    const taskId = registerBatchTask(user.id, connection.id, items, dryRun);
    void executePlaybookTask(user.id, connection, plan.export?.yaml ?? "", dryRun, taskId);
    const task = gt(taskId);
    return { taskId, dryRun, planType: "rebuild", plan, totalItems: items.length, items: task?.items ?? [] };
  });

  // ── Multi-execute (deprecated: imported recipe multi-target apply) ────
  // EnvForge no longer encourages running raw recipes against multiple
  // targets directly. New work flows through `/api/plans` with
  // `source.kind="recipe"` so each apply is reviewable and rollback-aware.

  app.post("/api/multi-execute", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    if (process.env.ENVFORGE_ENABLE_LEGACY_EXECUTE !== "true") {
      reply.code(410);
      return { error: "Direct recipe execution is disabled. Import YAML as an Environment Plan with source.kind=recipe." };
    }
    const body = (request.body ?? {}) as { yaml?: string; playbookId?: string; connectionIds?: string[]; tags?: string[]; dryRun?: boolean };
    let yamlText = body.yaml ?? "";
    if (!yamlText && body.playbookId) {
      const db = await readRuntimeDatabase();
      const pb = (db.playbooks ?? []).find((p) => p.id === body.playbookId && p.userId === user.id);
      if (pb) yamlText = pb.yaml;
    }
    if (!yamlText) { reply.code(400); return { error: "yaml or playbookId is required." }; }
    const db = await readRuntimeDatabase();
    let targetConns = db.connections.filter((c) => c.userId === user.id);
    if (body.connectionIds?.length) targetConns = targetConns.filter((c) => body.connectionIds!.includes(c.id));
    else if (body.tags?.length) targetConns = targetConns.filter((c) => c.tags?.some((t) => body.tags!.includes(t)));
    if (targetConns.length === 0) { reply.code(400); return { error: "No matching connections found." }; }
    const dryRun = body.dryRun !== false;
    const { registerBatchTask, executePlaybookTask, getTask: gt } = await import("./executor.js");
    const taskIds: Array<{ connectionId: string; label: string; taskId: string }> = [];
    for (const conn of targetConns) {
      const taskId = registerBatchTask(user.id, conn.id, [{ catalogId: "playbook", displayName: conn.label }], dryRun);
      taskIds.push({ connectionId: conn.id, label: conn.label, taskId });
      void executePlaybookTask(user.id, conn, yamlText, dryRun, taskId);
    }
    return { targets: taskIds, dryRun, totalTargets: targetConns.length, message: `Launched on ${targetConns.length} target(s)` };
  });

  // ── Task SSE stream ─────────────────────────────────────

  app.get("/api/tasks/:id/stream", async (request, reply) => {
    const queryToken = (request.query as Record<string, string>)?.token;
    const headerToken = readBearerToken(request.headers.authorization);
    const user = await getUserByToken(headerToken ?? queryToken);
    if (!user) { reply.code(401); return; }
    const { id } = request.params as { id: string };
    const { getTask: gt, subscribeTask: sub } = await import("./executor.js");
    const task = gt(id);
    if (!task || task.userId !== user.id) { reply.code(404); return; }
    reply.raw.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    reply.raw.write(`data: ${JSON.stringify(task)}\n\n`);
    if (task.status === "succeeded" || task.status === "failed" || task.status === "cancelled") { reply.raw.end(); return; }
    const unsub = sub(id, (updated) => {
      try { reply.raw.write(`data: ${JSON.stringify(updated)}\n\n`); } catch { unsub(); }
      if (updated.status === "succeeded" || updated.status === "failed" || updated.status === "cancelled") { unsub(); reply.raw.end(); }
    });
    request.raw.on("close", unsub);
  });

  // ── Task cancel ─────────────────────────────────────────

  app.post("/api/tasks/:id/cancel", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const { cancelTask } = await import("./executor.js");
    cancelTask(id);
    return { ok: true };
  });

  // ── Playbook CRUD ────────────────────────────────────────

  app.get("/api/playbooks", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const db = await readRuntimeDatabase();
    const playbooks = (db.playbooks ?? []).filter((p) => p.userId === user.id);
    return { playbooks };
  });

  app.get("/api/playbooks/:id", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const db = await readRuntimeDatabase();
    const playbook = (db.playbooks ?? []).find((p) => p.id === id && p.userId === user.id);
    if (!playbook) { reply.code(404); return { error: "Not found." }; }
    return { playbook };
  });

  app.post("/api/playbooks", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const body = (request.body ?? {}) as { name?: string; description?: string; yaml?: string; sourceKind?: string; sourceId?: string; comment?: string };
    if (!body.yaml) { reply.code(400); return { error: "yaml is required." }; }
    const playbook = { id: createId("pb"), userId: user.id, name: body.name || "Untitled", description: body.description, version: 1, yaml: body.yaml, history: [{ version: 1, yaml: body.yaml, savedAt: new Date().toISOString(), comment: body.comment }], sourceKind: (body.sourceKind ?? "user") as "catalog" | "capture" | "user", sourceId: body.sourceId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await updateRuntimeDatabase((db) => { if (!db.playbooks) db.playbooks = []; db.playbooks.push(playbook); });
    return { playbook };
  });

  app.patch("/api/playbooks/:id", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { name?: string; description?: string; yaml?: string; comment?: string };
    const result = await updateRuntimeDatabase((db) => {
      const pb = (db.playbooks ?? []).find((p) => p.id === id && p.userId === user.id);
      if (!pb) return null;
      if (body.name !== undefined) pb.name = body.name;
      if (body.description !== undefined) pb.description = body.description;
      if (body.yaml !== undefined && body.yaml !== pb.yaml) {
        pb.version++;
        pb.yaml = body.yaml;
        if (!pb.history) pb.history = [];
        pb.history.push({ version: pb.version, yaml: body.yaml, savedAt: new Date().toISOString(), comment: body.comment });
        if (pb.history.length > 20) pb.history = pb.history.slice(-20);
      }
      pb.updatedAt = new Date().toISOString();
      return pb;
    });
    if (!result) { reply.code(404); return { error: "Not found." }; }
    return { playbook: result };
  });

  app.delete("/api/playbooks/:id", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    await updateRuntimeDatabase((db) => { db.playbooks = (db.playbooks ?? []).filter((p) => !(p.id === id && p.userId === user.id)); });
    return { ok: true };
  });

  app.post("/api/playbooks/:id/restore/:version", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id, version } = request.params as { id: string; version: string };
    const ver = parseInt(version, 10);
    const result = await updateRuntimeDatabase((db) => {
      const pb = (db.playbooks ?? []).find((p) => p.id === id && p.userId === user.id);
      if (!pb) return null;
      const hist = pb.history?.find((h) => h.version === ver);
      if (!hist) return null;
      pb.version++;
      pb.yaml = hist.yaml;
      pb.history?.push({ version: pb.version, yaml: hist.yaml, savedAt: new Date().toISOString(), comment: `Restored from v${ver}` });
      pb.updatedAt = new Date().toISOString();
      return pb;
    });
    if (!result) { reply.code(404); return { error: "Not found or version not found." }; }
    return { playbook: result };
  });

  // ── Config files API ────────────────────────────────────

  app.get("/api/connections/:id/configs", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const db = await readRuntimeDatabase();
    const conn = db.connections.find((c) => c.id === id && c.userId === user.id);
    if (!conn) { reply.code(404); return { error: "Connection not found." }; }
    try {
      const softwareNames = conn.probeSnapshot?.software?.map((s) => s.name) ?? [];
      const files = await listConfigFiles(conn, softwareNames);
      return { files };
    } catch (err) {
      reply.code(err instanceof ConfigConnectionError ? err.statusCode : 500);
      return { error: err instanceof Error ? err.message : "Failed" };
    }
  });

  app.get("/api/connections/:id/configs/read", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const { path: filePath } = request.query as { path?: string };
    if (!filePath) { reply.code(400); return { error: "path query parameter is required." }; }
    const db = await readRuntimeDatabase();
    const conn = db.connections.find((c) => c.id === id && c.userId === user.id);
    if (!conn) { reply.code(404); return { error: "Connection not found." }; }
    try { return await readConfigFile(conn, filePath); }
    catch (err) {
      reply.code(err instanceof ConfigConnectionError ? err.statusCode : 500);
      return { error: err instanceof Error ? err.message : "Failed" };
    }
  });

  app.post("/api/connections/:id/configs/write", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    reply.code(410);
    return {
      error: "Direct config writes are disabled. Create a Config Change Plan and apply it after review."
    };
  });

  // Deprecated: use POST /api/plans with source.kind="config-change".
  app.post("/api/connections/:id/configs/change-plan", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { path?: string; content?: string };
    if (!body.path || body.content === undefined) { reply.code(400); return { error: "path and content are required." }; }
    const db = await readRuntimeDatabase();
    const conn = db.connections.find((c) => c.id === id && c.userId === user.id);
    if (!conn) { reply.code(404); return { error: "Connection not found." }; }
    try {
      const current = await readConfigFile(conn, body.path);
      const validation = await validateConfigFile(conn, body.path);
      const plan = buildConfigChangePlan({
        targetConnectionId: conn.id,
        path: body.path,
        originalContent: current.content,
        candidateContent: body.content,
        validationCommand: validation.command
      });
      await saveEnvironmentPlan(plan, user.id);
      reply.header("Deprecation", "true");
      reply.header("Link", '</api/plans>; rel="successor-version"');
      return { plan, current, validation };
    } catch (err) {
      reply.code(err instanceof ConfigConnectionError ? err.statusCode : 500);
      return { error: err instanceof Error ? err.message : "Failed to create config change plan." };
    }
  });

  app.post("/api/connections/:id/configs/migration-plan", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { paths?: string[]; targetConnectionId?: string };
    const paths = (body.paths ?? []).map((path) => path.trim()).filter(Boolean);
    if (paths.length === 0) { reply.code(400); return { error: "paths[] is required." }; }
    const db = await readRuntimeDatabase();
    const conn = db.connections.find((c) => c.id === id && c.userId === user.id);
    if (!conn) { reply.code(404); return { error: "Connection not found." }; }
    return { plan: buildConfigMigrationPlan({ sourceConnectionId: conn.id, paths, targetConnectionId: body.targetConnectionId }) };
  });

  // Deprecated: use POST /api/plans/:id/apply for the corresponding change Plan.
  app.post("/api/connections/:id/configs/apply-change-plan", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { plan?: EnvironmentPlan; path?: string; content?: string; acknowledged?: boolean };
    if (!body.plan || body.plan.type !== "change" || !body.path || body.content === undefined) {
      reply.code(400); return { error: "A Config Change Plan, path, and candidate content are required." };
    }
    if (!body.acknowledged) {
      reply.code(400); return { error: "Config changes require explicit review acknowledgement." };
    }
    const db = await readRuntimeDatabase();
    const conn = db.connections.find((c) => c.id === id && c.userId === user.id);
    if (!conn) { reply.code(404); return { error: "Connection not found." }; }
    try {
      const before = await readConfigFile(conn, body.path);
      const beforeValidation = await validateConfigFile(conn, body.path);
      const write = await writeConfigFile(conn, body.path, body.content, true);
      const afterValidation = await validateConfigFile(conn, body.path);
      let rollback: Awaited<ReturnType<typeof restoreConfigFileFromBackup>> | undefined;
      if (afterValidation.status === "failed") {
        rollback = await restoreConfigFileFromBackup(conn, body.path);
      }
      // Persist the plan record so it can be tracked in /api/plans even when
      // applied through this legacy route.
      await saveEnvironmentPlan(body.plan, user.id);
      const finalStatus: EnvironmentPlan["status"] = afterValidation.status === "failed" ? "failed" : "succeeded";
      await setPlanStatus(body.plan.id, user.id, finalStatus, write.message);
      await appendPlanHistory(body.plan.id, user.id, "applied", `legacy config apply: ${write.message}`);
      reply.header("Deprecation", "true");
      reply.header("Link", '</api/plans>; rel="successor-version"');
      return {
        success: afterValidation.status !== "failed",
        plan: body.plan,
        before,
        beforeValidation,
        write,
        validation: afterValidation,
        rollback,
        message: afterValidation.status === "failed"
          ? "Validation failed after apply; rollback was attempted."
          : "Config Change Plan applied and validated."
      };
    } catch (err) {
      reply.code(err instanceof ConfigConnectionError ? err.statusCode : 500);
      return { error: err instanceof Error ? err.message : "Failed to apply config change plan." };
    }
  });

  app.post("/api/connections/:id/configs/validate", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { path?: string };
    if (!body.path) { reply.code(400); return { error: "path is required." }; }
    const db = await readRuntimeDatabase();
    const conn = db.connections.find((c) => c.id === id && c.userId === user.id);
    if (!conn) { reply.code(404); return { error: "Connection not found." }; }
    try { return await validateConfigFile(conn, body.path); }
    catch (err) {
      reply.code(err instanceof ConfigConnectionError ? err.statusCode : 500);
      return { error: err instanceof Error ? err.message : "Failed" };
    }
  });

  app.post("/api/connections/:id/configs/rollback", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { path?: string };
    if (!body.path) { reply.code(400); return { error: "path is required." }; }
    const db = await readRuntimeDatabase();
    const conn = db.connections.find((c) => c.id === id && c.userId === user.id);
    if (!conn) { reply.code(404); return { error: "Connection not found." }; }
    try { return await restoreConfigFileFromBackup(conn, body.path); }
    catch (err) {
      reply.code(err instanceof ConfigConnectionError ? err.statusCode : 500);
      return { error: err instanceof Error ? err.message : "Failed" };
    }
  });

  // Diff: current file vs the .envforge.bak created on first write
  app.get("/api/connections/:id/configs/diff", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const { path: filePath } = request.query as { path?: string };
    if (!filePath) { reply.code(400); return { error: "path query parameter is required." }; }
    const db = await readRuntimeDatabase();
    const conn = db.connections.find((c) => c.id === id && c.userId === user.id);
    if (!conn) { reply.code(404); return { error: "Connection not found." }; }
    try { return await readConfigFileWithBackup(conn, filePath); }
    catch (err) {
      reply.code(err instanceof ConfigConnectionError ? err.statusCode : 500);
      return { error: err instanceof Error ? err.message : "Failed" };
    }
  });

  // ── Schedules (cron) ────────────────────────────────────

  app.get("/api/connections/:id/configs/rollback-preview", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const { path: filePath } = request.query as { path?: string };
    if (!filePath) { reply.code(400); return { error: "path query parameter is required." }; }
    const db = await readRuntimeDatabase();
    const conn = db.connections.find((c) => c.id === id && c.userId === user.id);
    if (!conn) { reply.code(404); return { error: "Connection not found." }; }
    try { return await getConfigRollbackPreview(conn, filePath); }
    catch (err) {
      reply.code(err instanceof ConfigConnectionError ? err.statusCode : 500);
      return { error: err instanceof Error ? err.message : "Failed" };
    }
  });

  async function loadMigrationSessionContext(userId: string, sessionId: string): Promise<{
    db: Awaited<ReturnType<typeof readRuntimeDatabase>>;
    session: StoredMigrationSession;
    conn: StoredConnection;
    decisions: StoredMigrationDecision[];
    configDecisions: StoredMigrationConfigDecision[];
    dataDecisions: StoredMigrationDataDecision[];
    runs: StoredMigrationSessionRun[];
  } | null> {
    const db = await readRuntimeDatabase();
    const session = (db.migrationSessions ?? []).find((row) => row.id === sessionId && row.userId === userId);
    if (!session) return null;
    const conn = db.connections.find((row) => row.id === session.connectionId && row.userId === userId);
    if (!conn) return null;
    const decisions = (db.migrationDecisions ?? []).filter((row) => row.userId === userId && row.connectionId === session.connectionId);
    const configDecisions = (db.migrationConfigDecisions ?? []).filter((row) => row.userId === userId && row.sessionId === session.id);
    const dataDecisions = (db.migrationDataDecisions ?? []).filter((row) => row.userId === userId && row.sessionId === session.id);
    const runs = (db.migrationSessionRuns ?? []).filter((row) => row.userId === userId && row.sessionId === session.id);
    return { db, session, conn, decisions, configDecisions, dataDecisions, runs };
  }

  function buildSessionArtifacts(context: NonNullable<Awaited<ReturnType<typeof loadMigrationSessionContext>>>) {
    return buildMigrationSessionArtifacts(context.session, context.conn.probeSnapshot, context.decisions, {
      host: context.conn.fields.host ?? context.conn.label,
      configDecisions: context.configDecisions,
      dataDecisions: context.dataDecisions
    });
  }

  function latestMigrationSessionRun<T = unknown>(
    context: NonNullable<Awaited<ReturnType<typeof loadMigrationSessionContext>>>,
    kind: StoredMigrationSessionRun["kind"]
  ): (StoredMigrationSessionRun & { result: T }) | undefined {
    return context.runs
      .filter((row) => row.kind === kind)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] as (StoredMigrationSessionRun & { result: T }) | undefined;
  }

  function targetConnectionForSession(context: NonNullable<Awaited<ReturnType<typeof loadMigrationSessionContext>>>): StoredConnection | undefined {
    if (!context.session.targetConnectionId) return undefined;
    return context.db.connections.find((row) => row.id === context.session.targetConnectionId && row.userId === context.session.userId);
  }

  function migrationSessionApplyReadiness(
    context: NonNullable<Awaited<ReturnType<typeof loadMigrationSessionContext>>>,
    artifacts: ReturnType<typeof buildSessionArtifacts>
  ) {
    const blockers: string[] = [];
    const warnings: string[] = [];
    const summary = artifacts.view.summary;
    const latestDryRun = latestMigrationSessionRun(context, "dry-run");
    const target = targetConnectionForSession(context);

    if (!target) blockers.push("Target connection must be selected before apply.");
    if (summary.pendingReviewCount > 0) blockers.push(`Pending review remains: ${summary.pendingReviewCount} item(s).`);
    if (summary.configRiskCount > 0) blockers.push(`Config bundle review remains: ${summary.configRiskCount} bundle(s).`);
    if (summary.secretOrBlockedConfigCount > 0) blockers.push(`Secret or blocked config requires explicit out-of-band decision: ${summary.secretOrBlockedConfigCount} bundle(s).`);
    if (summary.dataReviewCount > 0) blockers.push(`Data movement strategy must be confirmed: ${summary.dataReviewCount} item(s).`);
    if (summary.blockerCount > 0) blockers.push(`Migration blockers remain: ${summary.blockerCount}.`);
    if (!latestDryRun) blockers.push("Dry-run must pass before apply.");
    else if (latestDryRun.status !== "passed") blockers.push("Latest dry-run did not pass; rerun dry-run after fixing blockers.");
    if (artifacts.readiness) {
      blockers.push(...artifacts.readiness.blockers);
      warnings.push(...artifacts.readiness.warnings);
    }

    return {
      ready: blockers.length === 0,
      generatedAt: new Date().toISOString(),
      blockers: [...new Set(blockers)],
      warnings: [...new Set(warnings)],
      targetConnectionId: target?.id,
      dryRun: latestDryRun ? {
        id: latestDryRun.id,
        status: latestDryRun.status,
        createdAt: latestDryRun.createdAt,
        summary: latestDryRun.summary
      } : undefined,
      items: artifacts.readiness?.items ?? []
    };
  }

  app.post("/api/migration/sessions", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const body = (request.body ?? {}) as { connectionId?: string; targetConnectionId?: string; reuseLatest?: boolean; note?: string };
    if (!body.connectionId?.trim()) { reply.code(400); return { error: "connectionId is required." }; }
    const connectionId = body.connectionId.trim();
    const reuseLatest = body.reuseLatest !== false;
    const now = new Date().toISOString();
    const session = await updateRuntimeDatabase((db) => {
      const conn = db.connections.find((row) => row.id === connectionId && row.userId === user.id);
      if (!conn) return null;
      if (!db.migrationSessions) db.migrationSessions = [];
      if (reuseLatest) {
        const existing = db.migrationSessions
          .filter((row) => row.userId === user.id && row.connectionId === connectionId)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
        if (existing) {
          existing.targetConnectionId = body.targetConnectionId?.trim() || existing.targetConnectionId;
          existing.note = body.note?.trim() || existing.note;
          existing.updatedAt = now;
          return existing;
        }
      }
      const initial = initialMigrationSessionState(Boolean(conn.probeSnapshot));
      const created: StoredMigrationSession = {
        id: createId("msess"),
        userId: user.id,
        connectionId,
        targetConnectionId: body.targetConnectionId?.trim() || undefined,
        ...initial,
        createdAt: now,
        updatedAt: now,
        lastSnapshotAt: conn.probeSnapshot?.collectedAt,
        lastAnalysisAt: conn.probeSnapshot ? now : undefined,
        note: body.note?.trim() || undefined
      };
      db.migrationSessions.push(created);
      return created;
    });
    if (!session) { reply.code(404); return { error: "Connection not found." }; }
    const context = await loadMigrationSessionContext(user.id, session.id);
    if (!context) { reply.code(404); return { error: "Migration session not found." }; }
    const artifacts = buildSessionArtifacts(context);
    return { session: artifacts.view };
  });

  app.get("/api/migration/sessions/:sessionId", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { sessionId } = request.params as { sessionId: string };
    const context = await loadMigrationSessionContext(user.id, sessionId);
    if (!context) { reply.code(404); return { error: "Migration session not found." }; }
    const artifacts = buildSessionArtifacts(context);
    return { session: artifacts.view };
  });

  app.patch("/api/migration/sessions/:sessionId", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { sessionId } = request.params as { sessionId: string };
    const body = (request.body ?? {}) as { currentStep?: unknown; status?: unknown; targetConnectionId?: string; note?: string };
    if (body.currentStep !== undefined && !isMigrationSessionStep(body.currentStep)) {
      reply.code(400); return { error: "Invalid currentStep." };
    }
    if (body.status !== undefined && !isMigrationSessionStatus(body.status)) {
      reply.code(400); return { error: "Invalid status." };
    }
    const now = new Date().toISOString();
    const updated = await updateRuntimeDatabase((db) => {
      const session = (db.migrationSessions ?? []).find((row) => row.id === sessionId && row.userId === user.id);
      if (!session) return null;
      if (body.targetConnectionId?.trim()) {
        const target = db.connections.find((row) => row.id === body.targetConnectionId?.trim() && row.userId === user.id);
        if (!target) return null;
        session.targetConnectionId = target.id;
      }
      if (body.currentStep !== undefined && isMigrationSessionStep(body.currentStep)) session.currentStep = body.currentStep;
      if (body.status !== undefined && isMigrationSessionStatus(body.status)) session.status = body.status;
      if (body.note !== undefined) session.note = body.note.trim() || undefined;
      session.updatedAt = now;
      return session;
    });
    if (!updated) { reply.code(404); return { error: "Migration session not found." }; }
    const context = await loadMigrationSessionContext(user.id, sessionId);
    if (!context) { reply.code(404); return { error: "Migration session not found." }; }
    const artifacts = buildSessionArtifacts(context);
    return { session: artifacts.view };
  });

  app.post("/api/migration/sessions/:sessionId/snapshot", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { sessionId } = request.params as { sessionId: string };
    const now = new Date().toISOString();
    const updated = await updateRuntimeDatabase((db) => {
      const session = (db.migrationSessions ?? []).find((row) => row.id === sessionId && row.userId === user.id);
      if (!session) return { error: "not-found" as const };
      const conn = db.connections.find((row) => row.id === session.connectionId && row.userId === user.id);
      if (!conn?.probeSnapshot) return { error: "no-snapshot" as const };
      session.status = "snapshot-collected";
      session.currentStep = "analysis";
      session.lastSnapshotAt = conn.probeSnapshot.collectedAt;
      session.updatedAt = now;
      return { session };
    });
    if ("error" in updated) {
      reply.code(updated.error === "no-snapshot" ? 400 : 404);
      return { error: updated.error === "no-snapshot" ? "Probe this connection before attaching a snapshot to the migration session." : "Migration session not found." };
    }
    const context = await loadMigrationSessionContext(user.id, sessionId);
    if (!context) { reply.code(404); return { error: "Migration session not found." }; }
    const artifacts = buildSessionArtifacts(context);
    return { session: artifacts.view, report: artifacts.report };
  });

  app.get("/api/migration/sessions/:sessionId/analysis", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { sessionId } = request.params as { sessionId: string };
    const context = await loadMigrationSessionContext(user.id, sessionId);
    if (!context) { reply.code(404); return { error: "Migration session not found." }; }
    if (!context.conn.probeSnapshot) { reply.code(400); return { error: "Probe this connection before session analysis." }; }
    const artifacts = buildSessionArtifacts(context);
    return { session: artifacts.view, report: artifacts.report, reviewQueue: artifacts.reviewQueue, decisions: context.decisions };
  });

  app.post("/api/migration/sessions/:sessionId/decisions", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { sessionId } = request.params as { sessionId: string };
    const body = (request.body ?? {}) as { candidateId?: string; candidateIds?: string[]; decision?: StoredMigrationDecision["decision"]; note?: string };
    const allowedReviewDecisions: StoredMigrationDecision["decision"][] = ["pending", "approved", "skipped", "ignore", "record-only", "migrate-artifact", "create-catalog-draft", "add-to-plan", "needs-manual-instruction"];
    const candidateIds = [...new Set([...(body.candidateIds ?? []), body.candidateId].filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean))];
    if (candidateIds.length === 0 || candidateIds.length > 500 || !body.decision || !allowedReviewDecisions.includes(body.decision)) {
      reply.code(400); return { error: "candidateId/candidateIds and decision are required." };
    }
    const decision = body.decision;
    const note = body.note?.trim() || undefined;
    const now = new Date().toISOString();
    const saved = await updateRuntimeDatabase((db) => {
      const session = (db.migrationSessions ?? []).find((row) => row.id === sessionId && row.userId === user.id);
      if (!session) return null;
      const conn = db.connections.find((row) => row.id === session.connectionId && row.userId === user.id);
      if (!conn) return null;
      if (!db.migrationDecisions) db.migrationDecisions = [];
      const rows: StoredMigrationDecision[] = [];
      for (const candidateId of candidateIds) {
        const existing = db.migrationDecisions.find((row) => row.userId === user.id && row.connectionId === session.connectionId && row.candidateId === candidateId);
        if (existing) {
          existing.decision = decision;
          existing.note = note;
          existing.updatedAt = now;
          rows.push(existing);
          continue;
        }
        const row: StoredMigrationDecision = { id: createId("mdec"), userId: user.id, connectionId: session.connectionId, candidateId, decision, note, updatedAt: now };
        db.migrationDecisions.push(row);
        rows.push(row);
      }
      session.status = "selection-in-progress";
      session.currentStep = "select";
      session.updatedAt = now;
      return rows;
    });
    if (!saved) { reply.code(404); return { error: "Migration session not found." }; }
    const context = await loadMigrationSessionContext(user.id, sessionId);
    if (!context) { reply.code(404); return { error: "Migration session not found." }; }
    const artifacts = buildSessionArtifacts(context);
    await updateRuntimeDatabase((db) => {
      const session = (db.migrationSessions ?? []).find((row) => row.id === sessionId && row.userId === user.id);
      if (!session) return;
      session.status = artifacts.view.recommendedStatus;
      session.currentStep = artifacts.view.recommendedStep;
      session.updatedAt = new Date().toISOString();
      if (artifacts.plan) session.lastPlanAt = session.updatedAt;
      if (artifacts.report) session.lastAnalysisAt = session.updatedAt;
    });
    const refreshed = await loadMigrationSessionContext(user.id, sessionId);
    const refreshedArtifacts = refreshed
      ? buildSessionArtifacts(refreshed)
      : artifacts;
    return { session: refreshedArtifacts.view, decisions: saved };
  });

  app.get("/api/migration/sessions/:sessionId/config-bundles", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { sessionId } = request.params as { sessionId: string };
    const context = await loadMigrationSessionContext(user.id, sessionId);
    if (!context) { reply.code(404); return { error: "Migration session not found." }; }
    if (!context.conn.probeSnapshot) { reply.code(400); return { error: "Probe this connection before reviewing config bundles." }; }
    const artifacts = buildSessionArtifacts(context);
    return {
      session: artifacts.view,
      configBundles: artifacts.report?.configBundles ?? [],
      configDecisions: context.configDecisions,
      dataDecisions: context.dataDecisions
    };
  });

  app.post("/api/migration/sessions/:sessionId/config-decisions", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { sessionId } = request.params as { sessionId: string };
    const body = (request.body ?? {}) as {
      bundleId?: string;
      strategy?: StoredMigrationConfigDecision["strategy"];
      status?: StoredMigrationConfigDecision["status"];
      note?: string;
    };
    const allowedStrategies: StoredMigrationConfigDecision["strategy"][] = ["omit-default", "copy-with-review", "template-with-vars", "secret-out-of-band", "manual-only", "blocked"];
    const allowedStatuses: StoredMigrationConfigDecision["status"][] = ["approved", "blocked"];
    const bundleId = body.bundleId?.trim();
    if (!bundleId || !body.strategy || !allowedStrategies.includes(body.strategy) || !body.status || !allowedStatuses.includes(body.status)) {
      reply.code(400); return { error: "bundleId, strategy, and status are required." };
    }
    const strategy = body.strategy;
    const status = body.status;
    const context = await loadMigrationSessionContext(user.id, sessionId);
    if (!context) { reply.code(404); return { error: "Migration session not found." }; }
    if (!context.conn.probeSnapshot) { reply.code(400); return { error: "Probe this connection before reviewing config bundles." }; }
    const artifacts = buildSessionArtifacts(context);
    const bundle = artifacts.report?.configBundles.find((row) => row.id === bundleId);
    if (!bundle) { reply.code(404); return { error: "Config bundle not found for this session." }; }
    const now = new Date().toISOString();
    await updateRuntimeDatabase((db) => {
      if (!db.migrationConfigDecisions) db.migrationConfigDecisions = [];
      const existing = db.migrationConfigDecisions.find((row) => row.userId === user.id && row.sessionId === sessionId && row.bundleId === bundleId);
      if (existing) {
        existing.strategy = strategy;
        existing.status = status;
        existing.note = body.note?.trim() || undefined;
        existing.updatedAt = now;
      } else {
        db.migrationConfigDecisions.push({
          id: createId("mcfg"),
          userId: user.id,
          sessionId,
          connectionId: context.session.connectionId,
          bundleId,
          strategy,
          status,
          note: body.note?.trim() || undefined,
          updatedAt: now
        });
      }
    });
    const refreshed = await loadMigrationSessionContext(user.id, sessionId);
    if (!refreshed) { reply.code(404); return { error: "Migration session not found." }; }
    const refreshedArtifacts = buildSessionArtifacts(refreshed);
    await updateRuntimeDatabase((db) => {
      const session = (db.migrationSessions ?? []).find((row) => row.id === sessionId && row.userId === user.id);
      if (!session) return;
      session.status = refreshedArtifacts.view.recommendedStatus;
      session.currentStep = refreshedArtifacts.view.recommendedStep;
      session.updatedAt = new Date().toISOString();
      if (refreshedArtifacts.plan) session.lastPlanAt = session.updatedAt;
    });
    const finalContext = await loadMigrationSessionContext(user.id, sessionId);
    const finalArtifacts = finalContext ? buildSessionArtifacts(finalContext) : refreshedArtifacts;
    return {
      session: finalArtifacts.view,
      configDecisions: finalContext?.configDecisions ?? refreshed.configDecisions,
      dataDecisions: finalContext?.dataDecisions ?? refreshed.dataDecisions
    };
  });

  app.post("/api/migration/sessions/:sessionId/data-decisions", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { sessionId } = request.params as { sessionId: string };
    const body = (request.body ?? {}) as {
      candidateId?: string;
      strategy?: StoredMigrationDataDecision["strategy"];
      status?: StoredMigrationDataDecision["status"];
      paths?: string[];
      note?: string;
    };
    const allowedStrategies: StoredMigrationDataDecision["strategy"][] = ["no-data", "backup-restore", "rsync-copy", "export-import", "manual", "external"];
    const allowedStatuses: StoredMigrationDataDecision["status"][] = ["confirmed", "blocked"];
    const candidateId = body.candidateId?.trim();
    if (!candidateId || !body.strategy || !allowedStrategies.includes(body.strategy) || !body.status || !allowedStatuses.includes(body.status)) {
      reply.code(400); return { error: "candidateId, strategy, and status are required." };
    }
    const strategy = body.strategy;
    const status = body.status;
    const context = await loadMigrationSessionContext(user.id, sessionId);
    if (!context) { reply.code(404); return { error: "Migration session not found." }; }
    if (!context.conn.probeSnapshot) { reply.code(400); return { error: "Probe this connection before reviewing data strategy." }; }
    const artifacts = buildSessionArtifacts(context);
    const candidate = artifacts.report?.candidates.find((row) => row.id === candidateId);
    if (!candidate) { reply.code(404); return { error: "Migration candidate not found for this session." }; }
    const paths = [...new Set((body.paths?.length ? body.paths : candidate.dataPaths ?? []).map((value) => value.trim()).filter(Boolean))].slice(0, 100);
    const now = new Date().toISOString();
    await updateRuntimeDatabase((db) => {
      if (!db.migrationDataDecisions) db.migrationDataDecisions = [];
      const existing = db.migrationDataDecisions.find((row) => row.userId === user.id && row.sessionId === sessionId && row.candidateId === candidateId);
      if (existing) {
        existing.strategy = strategy;
        existing.status = status;
        existing.paths = paths;
        existing.note = body.note?.trim() || undefined;
        existing.updatedAt = now;
      } else {
        db.migrationDataDecisions.push({
          id: createId("mdat"),
          userId: user.id,
          sessionId,
          connectionId: context.session.connectionId,
          candidateId,
          strategy,
          status,
          paths,
          note: body.note?.trim() || undefined,
          updatedAt: now
        });
      }
    });
    const refreshed = await loadMigrationSessionContext(user.id, sessionId);
    if (!refreshed) { reply.code(404); return { error: "Migration session not found." }; }
    const refreshedArtifacts = buildSessionArtifacts(refreshed);
    await updateRuntimeDatabase((db) => {
      const session = (db.migrationSessions ?? []).find((row) => row.id === sessionId && row.userId === user.id);
      if (!session) return;
      session.status = refreshedArtifacts.view.recommendedStatus;
      session.currentStep = refreshedArtifacts.view.recommendedStep;
      session.updatedAt = new Date().toISOString();
      if (refreshedArtifacts.plan) session.lastPlanAt = session.updatedAt;
    });
    const finalContext = await loadMigrationSessionContext(user.id, sessionId);
    const finalArtifacts = finalContext ? buildSessionArtifacts(finalContext) : refreshedArtifacts;
    return {
      session: finalArtifacts.view,
      configDecisions: finalContext?.configDecisions ?? refreshed.configDecisions,
      dataDecisions: finalContext?.dataDecisions ?? refreshed.dataDecisions
    };
  });

  app.get("/api/migration/sessions/:sessionId/plan", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { sessionId } = request.params as { sessionId: string };
    const context = await loadMigrationSessionContext(user.id, sessionId);
    if (!context) { reply.code(404); return { error: "Migration session not found." }; }
    if (!context.conn.probeSnapshot) { reply.code(400); return { error: "Probe this connection before building a migration plan." }; }
    const artifacts = buildSessionArtifacts(context);
    if (!artifacts.plan) { reply.code(400); return { error: "Migration plan is not available yet." }; }
    return {
      session: artifacts.view,
      plan: artifacts.plan,
      environmentPlan: migrationPlanToEnvironmentPlan(artifacts.plan, context.conn.id),
      readiness: artifacts.readiness
    };
  });

  app.post("/api/migration/sessions/:sessionId/dry-run", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { sessionId } = request.params as { sessionId: string };
    const context = await loadMigrationSessionContext(user.id, sessionId);
    if (!context) { reply.code(404); return { error: "Migration session not found." }; }
    if (!context.conn.probeSnapshot) { reply.code(400); return { error: "Probe this connection before dry-running a migration plan." }; }
    const artifacts = buildSessionArtifacts(context);
    if (!artifacts.plan) { reply.code(400); return { error: "Migration plan is not available yet." }; }
    if (!targetConnectionForSession(context)) { reply.code(400); return { error: "Select a target connection before dry-run." }; }
    const result = buildMigrationDryRun(artifacts.plan);
    const passed = result.summary.blocked === 0;
    const now = new Date().toISOString();
    await updateRuntimeDatabase((db) => {
      const session = (db.migrationSessions ?? []).find((row) => row.id === sessionId && row.userId === user.id);
      if (!session) return;
      if (!db.migrationSessionRuns) db.migrationSessionRuns = [];
      db.migrationSessionRuns.push({
        id: createId("mrun"),
        userId: user.id,
        sessionId,
        connectionId: session.connectionId,
        targetConnectionId: session.targetConnectionId,
        kind: "dry-run",
        status: passed ? "passed" : "failed",
        summary: result.summary,
        result,
        createdAt: now
      });
      session.status = passed ? "dry-run-passed" : "config-review-required";
      session.currentStep = passed ? "apply" : "config-data";
      session.lastDryRunAt = now;
      session.updatedAt = now;
    });
    const refreshed = await loadMigrationSessionContext(user.id, sessionId);
    const refreshedArtifacts = refreshed
      ? buildSessionArtifacts(refreshed)
      : artifacts;
    return { session: refreshedArtifacts.view, result };
  });

  app.get("/api/migration/sessions/:sessionId/apply-readiness", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { sessionId } = request.params as { sessionId: string };
    const context = await loadMigrationSessionContext(user.id, sessionId);
    if (!context) { reply.code(404); return { error: "Migration session not found." }; }
    if (!context.conn.probeSnapshot) { reply.code(400); return { error: "Probe this connection before assessing apply readiness." }; }
    const artifacts = buildSessionArtifacts(context);
    if (!artifacts.plan) { reply.code(400); return { error: "Migration plan is not available yet." }; }
    return { session: artifacts.view, readiness: migrationSessionApplyReadiness(context, artifacts) };
  });

  app.post("/api/migration/sessions/:sessionId/apply", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { sessionId } = request.params as { sessionId: string };
    const options = (request.body ?? {}) as MigrationApplyOptions;
    const context = await loadMigrationSessionContext(user.id, sessionId);
    if (!context) { reply.code(404); return { error: "Migration session not found." }; }
    if (!context.conn.probeSnapshot) { reply.code(400); return { error: "Probe this connection before applying a migration plan." }; }
    const artifacts = buildSessionArtifacts(context);
    if (!artifacts.plan) { reply.code(400); return { error: "Migration plan is not available yet." }; }
    const readiness = migrationSessionApplyReadiness(context, artifacts);
    if (!readiness.ready) {
      reply.code(400);
      return { error: "Migration apply is blocked by readiness gates.", session: artifacts.view, readiness };
    }
    const target = targetConnectionForSession(context);
    if (!target) { reply.code(400); return { error: "Target connection not found." }; }
    const startedAt = new Date().toISOString();
    await updateRuntimeDatabase((db) => {
      const session = (db.migrationSessions ?? []).find((row) => row.id === sessionId && row.userId === user.id);
      if (!session) return;
      session.status = "applying";
      session.currentStep = "apply";
      session.updatedAt = startedAt;
    });
    try {
      const result = await runMigrationApplyPlan(user.id, target, artifacts.plan, {
        rollbackOnFailure: options.rollbackOnFailure !== false,
        restartServices: options.restartServices === true,
        requireAllActions: options.requireAllActions === true
      });
      const completedAt = new Date().toISOString();
      await updateRuntimeDatabase((db) => {
        if (!db.migrationSessionRuns) db.migrationSessionRuns = [];
        db.migrationSessionRuns.push({
          id: createId("mrun"),
          userId: user.id,
          sessionId,
          connectionId: context.session.connectionId,
          targetConnectionId: target.id,
          kind: "apply",
          status: result.ok ? "passed" : "failed",
          summary: { ...result.summary, ok: result.ok, rolledBack: result.rolledBack },
          result,
          createdAt: completedAt
        });
        const session = (db.migrationSessions ?? []).find((row) => row.id === sessionId && row.userId === user.id);
        if (!session) return;
        session.status = result.ok ? "applied" : (result.rolledBack ? "rolled-back" : "failed");
        session.currentStep = result.ok ? "apply" : "apply";
        session.lastApplyAt = completedAt;
        session.updatedAt = completedAt;
      });
      const refreshed = await loadMigrationSessionContext(user.id, sessionId);
      const refreshedArtifacts = refreshed ? buildSessionArtifacts(refreshed) : artifacts;
      return { session: refreshedArtifacts.view, result };
    } catch (err) {
      const completedAt = new Date().toISOString();
      await updateRuntimeDatabase((db) => {
        if (!db.migrationSessionRuns) db.migrationSessionRuns = [];
        db.migrationSessionRuns.push({
          id: createId("mrun"),
          userId: user.id,
          sessionId,
          connectionId: context.session.connectionId,
          targetConnectionId: target.id,
          kind: "apply",
          status: "failed",
          summary: { ok: false },
          result: { ok: false, error: err instanceof Error ? err.message : "Migration apply failed.", generatedAt: completedAt },
          createdAt: completedAt
        });
        const session = (db.migrationSessions ?? []).find((row) => row.id === sessionId && row.userId === user.id);
        if (!session) return;
        session.status = "failed";
        session.currentStep = "apply";
        session.lastApplyAt = completedAt;
        session.updatedAt = completedAt;
      });
      reply.code(500);
      return { error: err instanceof Error ? err.message : "Migration apply failed." };
    }
  });

  app.post("/api/migration/sessions/:sessionId/verify", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { sessionId } = request.params as { sessionId: string };
    const context = await loadMigrationSessionContext(user.id, sessionId);
    if (!context) { reply.code(404); return { error: "Migration session not found." }; }
    if (!context.conn.probeSnapshot) { reply.code(400); return { error: "Probe this connection before running verification." }; }
    const artifacts = buildSessionArtifacts(context);
    if (!artifacts.plan) { reply.code(400); return { error: "Migration plan is not available yet." }; }
    const latestApply = latestMigrationSessionRun(context, "apply");
    if (!latestApply || latestApply.status !== "passed") {
      reply.code(400);
      return { error: "A successful apply run is required before verification." };
    }
    const target = targetConnectionForSession(context);
    if (!target) { reply.code(400); return { error: "Target connection not found." }; }
    const preview = buildMigrationVerificationPreview(artifacts.plan);
    try {
      const result = await runMigrationVerificationPreview(user.id, target, preview);
      const now = new Date().toISOString();
      await updateRuntimeDatabase((db) => {
        if (!db.migrationSessionRuns) db.migrationSessionRuns = [];
        db.migrationSessionRuns.push({
          id: createId("mrun"),
          userId: user.id,
          sessionId,
          connectionId: context.session.connectionId,
          targetConnectionId: target.id,
          kind: "verify",
          status: result.ok ? "passed" : "failed",
          summary: { ...result.summary, ok: result.ok },
          result,
          createdAt: now
        });
        const session = (db.migrationSessions ?? []).find((row) => row.id === sessionId && row.userId === user.id);
        if (!session) return;
        session.status = result.ok ? "verified" : "failed";
        session.currentStep = result.ok ? "report" : "apply";
        session.lastVerifyAt = now;
        session.updatedAt = now;
      });
      const refreshed = await loadMigrationSessionContext(user.id, sessionId);
      const refreshedArtifacts = refreshed ? buildSessionArtifacts(refreshed) : artifacts;
      return { session: refreshedArtifacts.view, result, preview };
    } catch (err) {
      reply.code(500);
      return { error: err instanceof Error ? err.message : "Verification failed." };
    }
  });

  app.get("/api/migration/sessions/:sessionId/report", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { sessionId } = request.params as { sessionId: string };
    const context = await loadMigrationSessionContext(user.id, sessionId);
    if (!context) { reply.code(404); return { error: "Migration session not found." }; }
    const artifacts = buildSessionArtifacts(context);
    const latestDryRun = latestMigrationSessionRun(context, "dry-run");
    const latestApply = latestMigrationSessionRun(context, "apply");
    const latestVerify = latestMigrationSessionRun(context, "verify");
    const readiness = artifacts.plan ? migrationSessionApplyReadiness(context, artifacts) : undefined;
    const applyResult = latestApply?.result as { rolledBack?: boolean; steps?: Array<{ action?: string; status?: string; label?: string; message?: string }> } | undefined;
    const rollbackSteps = applyResult?.steps?.filter((step) => step.action === "rollback" || step.status === "rolled-back") ?? [];
    const report = {
      sessionId,
      sourceHost: artifacts.report?.sourceHost ?? context.conn.fields.host ?? context.conn.label,
      targetConnectionId: context.session.targetConnectionId,
      generatedAt: new Date().toISOString(),
      summary: artifacts.view.summary,
      plan: artifacts.plan ? { items: artifacts.plan.items.length, generatedAt: artifacts.plan.generatedAt } : undefined,
      configDecisions: context.configDecisions,
      dataDecisions: context.dataDecisions,
      readiness,
      dryRun: latestDryRun ? { status: latestDryRun.status, createdAt: latestDryRun.createdAt, summary: latestDryRun.summary, result: latestDryRun.result } : undefined,
      apply: latestApply ? { status: latestApply.status, createdAt: latestApply.createdAt, summary: latestApply.summary, result: latestApply.result } : undefined,
      verify: latestVerify ? { status: latestVerify.status, createdAt: latestVerify.createdAt, summary: latestVerify.summary, result: latestVerify.result } : undefined,
      rollback: {
        available: Boolean(latestApply),
        rolledBack: Boolean(applyResult?.rolledBack || rollbackSteps.length),
        steps: rollbackSteps
      }
    };
    const now = new Date().toISOString();
    await updateRuntimeDatabase((db) => {
      if (!db.migrationSessionRuns) db.migrationSessionRuns = [];
      db.migrationSessionRuns.push({
        id: createId("mrun"),
        userId: user.id,
        sessionId,
        connectionId: context.session.connectionId,
        targetConnectionId: context.session.targetConnectionId,
        kind: "report",
        status: "generated",
        summary: { blockers: readiness?.blockers.length ?? 0, warnings: readiness?.warnings.length ?? 0 },
        result: report,
        createdAt: now
      });
      const session = (db.migrationSessions ?? []).find((row) => row.id === sessionId && row.userId === user.id);
      if (!session) return;
      session.status = "reported";
      session.currentStep = "report";
      session.lastReportAt = now;
      session.updatedAt = now;
    });
    const refreshed = await loadMigrationSessionContext(user.id, sessionId);
    const refreshedArtifacts = refreshed ? buildSessionArtifacts(refreshed) : artifacts;
    return { session: refreshedArtifacts.view, report };
  });

  app.get("/api/connections/:id/migration-candidates", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const db = await readRuntimeDatabase();
    const conn = db.connections.find((c) => c.id === id && c.userId === user.id);
    if (!conn) { reply.code(404); return { error: "Connection not found." }; }
    if (!conn.probeSnapshot) { reply.code(400); return { error: "Probe this connection before building migration candidates." }; }
    const decisions = (db.migrationDecisions ?? []).filter((row) => row.userId === user.id && row.connectionId === id);
    return {
      report: buildMigrationCandidateReport(conn.probeSnapshot, { host: conn.fields.host ?? conn.label }),
      decisions
    };
  });

  app.get("/api/profiles/:id/migration-candidates", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const profile = await getUserProfile(user, id);
    if (!profile || profile.kind !== "vm-snapshot" || !profile.envSnapshot) {
      reply.code(404); return { error: "VM snapshot profile not found." };
    }
    const decisions = (await readRuntimeDatabase()).migrationDecisions?.filter((row) => row.userId === user.id && row.connectionId === profile.sourceConnectionId) ?? [];
    return {
      report: buildMigrationCandidateReport(profile.envSnapshot, { host: profile.envSnapshot.system?.hostname ?? profile.nameEn ?? profile.name }),
      decisions
    };
  });

  app.get("/api/profiles/:id/environment-plan", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const profile = await getUserProfile(user, id);
    if (!profile || profile.kind !== "vm-snapshot" || !profile.envSnapshot) {
      reply.code(404); return { error: "VM snapshot profile not found." };
    }
    const db = await readRuntimeDatabase();
    const decisions = (db.migrationDecisions ?? []).filter((row) => row.userId === user.id && row.connectionId === profile.sourceConnectionId);
    const report = buildMigrationCandidateReport(profile.envSnapshot, { host: profile.envSnapshot.system?.hostname ?? profile.nameEn ?? profile.name });
    const migrationPlan = buildMigrationPlanFromCandidates(report, decisionMap(decisions));
    return { plan: migrationPlanToEnvironmentPlan(migrationPlan) };
  });

  app.get("/api/connections/:id/migration-plan", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const db = await readRuntimeDatabase();
    const conn = db.connections.find((c) => c.id === id && c.userId === user.id);
    if (!conn) { reply.code(404); return { error: "Connection not found." }; }
    if (!conn.probeSnapshot) { reply.code(400); return { error: "Probe this connection before building a migration plan." }; }
    const decisions = (db.migrationDecisions ?? []).filter((row) => row.userId === user.id && row.connectionId === id);
    const report = buildMigrationCandidateReport(conn.probeSnapshot, { host: conn.fields.host ?? conn.label });
    const plan = buildMigrationPlanFromCandidates(report, decisionMap(decisions));
    return { plan, environmentPlan: migrationPlanToEnvironmentPlan(plan, conn.id) };
  });

  app.get("/api/connections/:id/migration-review-queue", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const db = await readRuntimeDatabase();
    const conn = db.connections.find((c) => c.id === id && c.userId === user.id);
    if (!conn) { reply.code(404); return { error: "Connection not found." }; }
    if (!conn.probeSnapshot) { reply.code(400); return { error: "Probe this connection before building review queue." }; }
    const decisions = (db.migrationDecisions ?? []).filter((row) => row.userId === user.id && row.connectionId === id);
    const report = buildMigrationCandidateReport(conn.probeSnapshot, { host: conn.fields.host ?? conn.label });
    return { queue: buildUnknownReviewQueue(report, decisions) };
  });

  /**
   * Generate a Capability Catalog v2 YAML draft for a Review Queue candidate.
   *
   * The Review Queue lets operators tag unknown items with the
   * `create-catalog-draft` decision; this endpoint turns the candidate's
   * evidence into a fillable rule template the contributor can finish.
   *
   * The endpoint never publishes a catalog item by itself — the draft is
   * returned so the operator can review and submit it through the catalog
   * admin path or save it locally.
   */
  app.post("/api/connections/:id/migration-candidates/:candidateId/catalog-draft", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id, candidateId } = request.params as { id: string; candidateId: string };
    const db = await readRuntimeDatabase();
    const conn = db.connections.find((c) => c.id === id && c.userId === user.id);
    if (!conn) { reply.code(404); return { error: "Connection not found." }; }
    if (!conn.probeSnapshot) {
      reply.code(400); return { error: "Probe this connection before generating catalog drafts." };
    }
    const report = buildMigrationCandidateReport(conn.probeSnapshot, { host: conn.fields.host ?? conn.label });
    const candidate = report.candidates.find((c) => c.id === candidateId);
    if (!candidate) { reply.code(404); return { error: "Candidate not found." }; }
    const { buildCatalogDraft } = await import("./catalog-draft.js");
    const draft = buildCatalogDraft(candidate);
    return { draft };
  });

  app.post("/api/connections/:id/migration-decisions", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { candidateId?: string; decision?: StoredMigrationDecision["decision"]; note?: string };
    const allowedReviewDecisions: StoredMigrationDecision["decision"][] = ["pending", "approved", "skipped", "ignore", "record-only", "migrate-artifact", "create-catalog-draft", "add-to-plan", "needs-manual-instruction"];
    if (!body.candidateId || !body.decision || !allowedReviewDecisions.includes(body.decision)) {
      reply.code(400);
      return { error: "candidateId and decision are required." };
    }
    const candidateId = body.candidateId;
    const decision = body.decision as StoredMigrationDecision["decision"];
    const now = new Date().toISOString();
    const saved = await updateRuntimeDatabase((db) => {
      const conn = db.connections.find((c) => c.id === id && c.userId === user.id);
      if (!conn) return null;
      if (!db.migrationDecisions) db.migrationDecisions = [];
      const existing = db.migrationDecisions.find((row) => row.userId === user.id && row.connectionId === id && row.candidateId === candidateId);
      if (existing) {
        existing.decision = decision;
        existing.note = body.note?.trim() || undefined;
        existing.updatedAt = now;
        return existing;
      }
      const row: StoredMigrationDecision = {
        id: createId("mdec"),
        userId: user.id,
        connectionId: id,
        candidateId,
        decision,
        note: body.note?.trim() || undefined,
        updatedAt: now
      };
      db.migrationDecisions.push(row);
      return row;
    });
    if (!saved) { reply.code(404); return { error: "Connection not found." }; }
    return { decision: saved };
  });

  app.post("/api/connections/:id/migration-decisions/bulk", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { candidateIds?: string[]; decision?: StoredMigrationDecision["decision"]; note?: string };
    const candidateIds = [...new Set((body.candidateIds ?? []).map((candidateId) => candidateId.trim()).filter(Boolean))];
    const allowedReviewDecisions: StoredMigrationDecision["decision"][] = ["pending", "approved", "skipped", "ignore", "record-only", "migrate-artifact", "create-catalog-draft", "add-to-plan", "needs-manual-instruction"];
    if (candidateIds.length === 0 || candidateIds.length > 500 || !body.decision || !allowedReviewDecisions.includes(body.decision)) {
      reply.code(400);
      return { error: "candidateIds (1-500) and decision are required." };
    }
    const decision = body.decision as StoredMigrationDecision["decision"];
    const note = body.note?.trim() || undefined;
    const now = new Date().toISOString();
    const saved = await updateRuntimeDatabase((db) => {
      const conn = db.connections.find((c) => c.id === id && c.userId === user.id);
      if (!conn) return null;
      if (!db.migrationDecisions) db.migrationDecisions = [];
      const rows: StoredMigrationDecision[] = [];
      for (const candidateId of candidateIds) {
        const existing = db.migrationDecisions.find((row) => row.userId === user.id && row.connectionId === id && row.candidateId === candidateId);
        if (existing) {
          existing.decision = decision;
          existing.note = note;
          existing.updatedAt = now;
          rows.push(existing);
          continue;
        }
        const row: StoredMigrationDecision = {
          id: createId("mdec"),
          userId: user.id,
          connectionId: id,
          candidateId,
          decision,
          note,
          updatedAt: now
        };
        db.migrationDecisions.push(row);
        rows.push(row);
      }
      return rows;
    });
    if (!saved) { reply.code(404); return { error: "Connection not found." }; }
    return { decisions: saved, count: saved.length };
  });

  app.get("/api/connections/:id/migration-plan/export", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const { format = "markdown" } = request.query as { format?: MigrationExportFormat };
    if (!["json", "markdown", "bash", "ansible"].includes(format)) {
      reply.code(400);
      return { error: "format must be json, markdown, bash, or ansible." };
    }
    const db = await readRuntimeDatabase();
    const conn = db.connections.find((c) => c.id === id && c.userId === user.id);
    if (!conn) { reply.code(404); return { error: "Connection not found." }; }
    if (!conn.probeSnapshot) { reply.code(400); return { error: "Probe this connection before exporting a migration plan." }; }
    const decisions = (db.migrationDecisions ?? []).filter((row) => row.userId === user.id && row.connectionId === id);
    const report = buildMigrationCandidateReport(conn.probeSnapshot, { host: conn.fields.host ?? conn.label });
    const plan = buildMigrationPlanFromCandidates(report, decisionMap(decisions));
    const content = exportMigrationPlan(plan, format);
    reply.header("content-type", format === "json" ? "application/json; charset=utf-8" : "text/plain; charset=utf-8");
    return content;
  });

  app.post("/api/connections/:id/migration-plan/dry-run", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const db = await readRuntimeDatabase();
    const conn = db.connections.find((c) => c.id === id && c.userId === user.id);
    if (!conn) { reply.code(404); return { error: "Connection not found." }; }
    if (!conn.probeSnapshot) { reply.code(400); return { error: "Probe this connection before dry-running a migration plan." }; }
    const decisions = (db.migrationDecisions ?? []).filter((row) => row.userId === user.id && row.connectionId === id);
    const report = buildMigrationCandidateReport(conn.probeSnapshot, { host: conn.fields.host ?? conn.label });
    const plan = buildMigrationPlanFromCandidates(report, decisionMap(decisions));
    return { result: buildMigrationDryRun(plan) };
  });

  app.get("/api/connections/:id/migration-plan/verify-preview", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const db = await readRuntimeDatabase();
    const conn = db.connections.find((c) => c.id === id && c.userId === user.id);
    if (!conn) { reply.code(404); return { error: "Connection not found." }; }
    if (!conn.probeSnapshot) { reply.code(400); return { error: "Probe this connection before building verification preview." }; }
    const decisions = (db.migrationDecisions ?? []).filter((row) => row.userId === user.id && row.connectionId === id);
    const report = buildMigrationCandidateReport(conn.probeSnapshot, { host: conn.fields.host ?? conn.label });
    const plan = buildMigrationPlanFromCandidates(report, decisionMap(decisions));
    return { preview: buildMigrationVerificationPreview(plan) };
  });

  app.post("/api/connections/:id/migration-plan/verify-run", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const db = await readRuntimeDatabase();
    const conn = db.connections.find((c) => c.id === id && c.userId === user.id);
    if (!conn) { reply.code(404); return { error: "Connection not found." }; }
    if (!conn.probeSnapshot) { reply.code(400); return { error: "Probe this connection before running verification." }; }
    const decisions = (db.migrationDecisions ?? []).filter((row) => row.userId === user.id && row.connectionId === id);
    const report = buildMigrationCandidateReport(conn.probeSnapshot, { host: conn.fields.host ?? conn.label });
    const plan = buildMigrationPlanFromCandidates(report, decisionMap(decisions));
    const preview = buildMigrationVerificationPreview(plan);
    try {
      return { result: await runMigrationVerificationPreview(user.id, conn, preview) };
    } catch (err) {
      reply.code(500);
      return { error: err instanceof Error ? err.message : "Verification failed." };
    }
  });

  app.get("/api/connections/:id/migration-plan/apply-readiness", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const db = await readRuntimeDatabase();
    const conn = db.connections.find((c) => c.id === id && c.userId === user.id);
    if (!conn) { reply.code(404); return { error: "Connection not found." }; }
    if (!conn.probeSnapshot) { reply.code(400); return { error: "Probe this connection before assessing apply readiness." }; }
    const decisions = (db.migrationDecisions ?? []).filter((row) => row.userId === user.id && row.connectionId === id);
    const report = buildMigrationCandidateReport(conn.probeSnapshot, { host: conn.fields.host ?? conn.label });
    const plan = buildMigrationPlanFromCandidates(report, decisionMap(decisions));
    return { readiness: assessMigrationApplyReadiness(plan) };
  });

  app.post("/api/connections/:id/migration-plan/apply", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const options = (request.body ?? {}) as MigrationApplyOptions;
    const db = await readRuntimeDatabase();
    const conn = db.connections.find((c) => c.id === id && c.userId === user.id);
    if (!conn) { reply.code(404); return { error: "Connection not found." }; }
    if (!conn.probeSnapshot) { reply.code(400); return { error: "Probe this connection before applying a migration plan." }; }
    const decisions = (db.migrationDecisions ?? []).filter((row) => row.userId === user.id && row.connectionId === id);
    const report = buildMigrationCandidateReport(conn.probeSnapshot, { host: conn.fields.host ?? conn.label });
    const plan = buildMigrationPlanFromCandidates(report, decisionMap(decisions));
    try {
      return { result: await runMigrationApplyPlan(user.id, conn, plan, options) };
    } catch (err) {
      reply.code(500);
      return { error: err instanceof Error ? err.message : "Migration apply failed." };
    }
  });

  app.get("/api/schedules", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const db = await readRuntimeDatabase();
    return { schedules: (db.schedules ?? []).filter((s) => s.userId === user.id) };
  });

  app.post("/api/schedules", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { validateScheduleInput } = await import("./scheduler.js");
    const { nextRunAfter } = await import("./cron.js");
    const body = (request.body ?? {}) as Partial<import("./runtime-store.js").StoredSchedule>;
    const err = validateScheduleInput(body);
    if (err) { reply.code(400); return { error: err }; }
    const now = new Date();
    const next = nextRunAfter(body.cron!, now);
    const created = await updateRuntimeDatabase((db) => {
      if (!db.schedules) db.schedules = [];
      const sch: import("./runtime-store.js").StoredSchedule = {
        id: createId("sched"),
        userId: user.id,
        name: body.name!.trim(),
        playbookId: body.playbookId,
        catalogId: body.catalogId,
        connectionIds: body.connectionIds ?? [],
        tags: body.tags ?? [],
        cron: body.cron!.trim(),
        dryRun: body.dryRun ?? false,
        enabled: body.enabled ?? true,
        nextRunAt: next ? next.toISOString() : undefined,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };
      db.schedules.push(sch);
      return sch;
    });
    return { schedule: created };
  });

  app.patch("/api/schedules/:id", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as Partial<import("./runtime-store.js").StoredSchedule>;
    const { validateCron, nextRunAfter } = await import("./cron.js");
    if (body.cron !== undefined) {
      const cronErr = validateCron(body.cron);
      if (cronErr) { reply.code(400); return { error: cronErr }; }
    }
    const updated = await updateRuntimeDatabase((db) => {
      const sch = (db.schedules ?? []).find((s) => s.id === id && s.userId === user.id);
      if (!sch) return null;
      if (body.name !== undefined) sch.name = body.name.trim();
      if (body.cron !== undefined) {
        sch.cron = body.cron.trim();
        const next = nextRunAfter(sch.cron, new Date());
        sch.nextRunAt = next ? next.toISOString() : undefined;
      }
      if (body.connectionIds !== undefined) sch.connectionIds = body.connectionIds;
      if (body.tags !== undefined) sch.tags = body.tags;
      if (body.dryRun !== undefined) sch.dryRun = body.dryRun;
      if (body.enabled !== undefined) sch.enabled = body.enabled;
      sch.updatedAt = new Date().toISOString();
      return sch;
    });
    if (!updated) { reply.code(404); return { error: "Schedule not found." }; }
    return { schedule: updated };
  });

  app.delete("/api/schedules/:id", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const removed = await updateRuntimeDatabase((db) => {
      const before = db.schedules?.length ?? 0;
      db.schedules = (db.schedules ?? []).filter((s) => !(s.id === id && s.userId === user.id));
      return before !== (db.schedules?.length ?? 0);
    });
    if (!removed) { reply.code(404); return { error: "Schedule not found." }; }
    return { ok: true };
  });

  // ── Drift detection ─────────────────────────────────────

  app.post("/api/connections/:id/drift/baseline", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const db = await readRuntimeDatabase();
    const conn = db.connections.find((c) => c.id === id && c.userId === user.id);
    if (!conn) { reply.code(404); return { error: "Connection not found." }; }
    try {
      const { setBaseline } = await import("./drift.js");
      const baseline = await setBaseline(user.id, conn);
      return { baseline };
    } catch (err) {
      reply.code(500);
      return { error: err instanceof Error ? err.message : "Failed to set baseline" };
    }
  });

  app.get("/api/connections/:id/drift", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const db = await readRuntimeDatabase();
    const conn = db.connections.find((c) => c.id === id && c.userId === user.id);
    if (!conn) { reply.code(404); return { error: "Connection not found." }; }
    try {
      const { runDriftCheck } = await import("./drift.js");
      const report = await runDriftCheck(user.id, conn);
      if (!report) { reply.code(400); return { error: "No baseline set for this connection. Set one first." }; }
      return { report };
    } catch (err) {
      reply.code(500);
      return { error: err instanceof Error ? err.message : "Drift check failed" };
    }
  });

  // ── Webhooks ────────────────────────────────────────────

  app.get("/api/webhooks", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const db = await readRuntimeDatabase();
    return { webhooks: (db.webhooks ?? []).filter((w) => w.userId === user.id) };
  });

  app.post("/api/webhooks", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const body = (request.body ?? {}) as Partial<import("./runtime-store.js").StoredWebhook>;
    if (!body.label?.trim() || !body.url?.trim()) {
      reply.code(400); return { error: "label and url are required." };
    }
    try {
      const u = new URL(body.url);
      if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("Only http(s) URLs allowed");
    } catch {
      reply.code(400); return { error: "Invalid URL." };
    }
    const events = (body.events ?? ["task.completed", "task.failed", "drift.detected", "schedule.fired"])
      .filter((e): e is "task.completed" | "task.failed" | "drift.detected" | "schedule.fired" =>
        ["task.completed", "task.failed", "drift.detected", "schedule.fired"].includes(e));
    const created = await updateRuntimeDatabase((db) => {
      if (!db.webhooks) db.webhooks = [];
      const hook: import("./runtime-store.js").StoredWebhook = {
        id: createId("hook"),
        userId: user.id,
        label: body.label!.trim(),
        url: body.url!.trim(),
        secret: body.secret?.trim() || undefined,
        events,
        enabled: body.enabled ?? true,
        createdAt: new Date().toISOString()
      };
      db.webhooks.push(hook);
      return hook;
    });
    return { webhook: created };
  });

  app.patch("/api/webhooks/:id", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as Partial<import("./runtime-store.js").StoredWebhook>;
    const updated = await updateRuntimeDatabase((db) => {
      const hook = (db.webhooks ?? []).find((w) => w.id === id && w.userId === user.id);
      if (!hook) return null;
      if (body.label !== undefined) hook.label = body.label.trim();
      if (body.url !== undefined) hook.url = body.url.trim();
      if (body.secret !== undefined) hook.secret = body.secret.trim() || undefined;
      if (body.events !== undefined) hook.events = body.events;
      if (body.enabled !== undefined) hook.enabled = body.enabled;
      return hook;
    });
    if (!updated) { reply.code(404); return { error: "Webhook not found." }; }
    return { webhook: updated };
  });

  app.delete("/api/webhooks/:id", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const removed = await updateRuntimeDatabase((db) => {
      const before = db.webhooks?.length ?? 0;
      db.webhooks = (db.webhooks ?? []).filter((w) => !(w.id === id && w.userId === user.id));
      return before !== (db.webhooks?.length ?? 0);
    });
    if (!removed) { reply.code(404); return { error: "Webhook not found." }; }
    return { ok: true };
  });

  app.post("/api/webhooks/:id/test", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const db = await readRuntimeDatabase();
    const hook = (db.webhooks ?? []).find((w) => w.id === id && w.userId === user.id);
    if (!hook) { reply.code(404); return { error: "Webhook not found." }; }
    const { fireWebhooks } = await import("./webhooks.js");
    // Pick one event the hook is subscribed to (fall back to task.completed)
    const evtType = hook.events[0] ?? "task.completed";
    await fireWebhooks(user.id, evtType, { test: true, message: "EnvForge webhook test" });
    // Re-read to surface delivery status
    const after = (await readRuntimeDatabase()).webhooks?.find((w) => w.id === id);
    return { delivered: after?.lastDeliveryStatus, error: after?.lastDeliveryError };
  });

  // ── Module documentation (for editor + onboarding) ──────

  app.get("/api/modules/docs", async () => {
    const { MODULE_DOCS } = await import("./engine/module-docs.js");
    return { modules: MODULE_DOCS };
  });

  // ── API tokens ──────────────────────────────────────────

  app.get("/api/tokens", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const db = await readRuntimeDatabase();
    return {
      tokens: (db.apiTokens ?? [])
        .filter((t) => t.userId === user.id)
        .map((t) => ({
          id: t.id,
          label: t.label,
          tokenPrefix: t.tokenPrefix,
          createdAt: t.createdAt,
          lastUsedAt: t.lastUsedAt,
          expiresAt: t.expiresAt
        }))
    };
  });

  app.post("/api/tokens", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const body = (request.body ?? {}) as { label?: string; expiresInDays?: number };
    if (!body.label?.trim()) { reply.code(400); return { error: "label is required." }; }
    const { randomBytes, createHash } = await import("node:crypto");
    const raw = `envf_${randomBytes(24).toString("base64url")}`;
    const tokenHash = createHash("sha256").update(raw).digest("hex");
    const expiresAt = body.expiresInDays && body.expiresInDays > 0
      ? new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined;
    const created = await updateRuntimeDatabase((db) => {
      if (!db.apiTokens) db.apiTokens = [];
      const tok: import("./runtime-store.js").StoredApiToken = {
        id: createId("token"),
        userId: user.id,
        label: body.label!.trim(),
        tokenHash,
        tokenPrefix: raw.slice(0, 12),
        createdAt: new Date().toISOString(),
        expiresAt
      };
      db.apiTokens.push(tok);
      return tok;
    });
    // Return the raw token ONCE
    return {
      token: raw,
      id: created.id,
      label: created.label,
      tokenPrefix: created.tokenPrefix,
      createdAt: created.createdAt,
      expiresAt: created.expiresAt
    };
  });

  app.delete("/api/tokens/:id", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    const { id } = request.params as { id: string };
    const removed = await updateRuntimeDatabase((db) => {
      const before = db.apiTokens?.length ?? 0;
      db.apiTokens = (db.apiTokens ?? []).filter((t) => !(t.id === id && t.userId === user.id));
      return before !== (db.apiTokens?.length ?? 0);
    });
    if (!removed) { reply.code(404); return { error: "Token not found." }; }
    return { ok: true };
  });

  // ── Admin: catalog management ──────────────────────────

  // List all catalog items (merged baseline + overrides) plus a status map
  app.get("/api/admin/catalog", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") { reply.code(403); return { error: "Admin only." }; }
    const { readDatabase } = await import("./database.js");
    const { mergeCatalog, annotateOverrides } = await import("./catalog-overrides.js");
    const db = await readRuntimeDatabase();
    const baseline = (await readDatabase()).catalog;
    const merged = mergeCatalog(baseline, db.catalogOverrides);
    const status = Object.fromEntries(annotateOverrides(baseline, db.catalogOverrides));
    return { items: merged, status };
  });

  // Get a single catalog item with its YAML and Markdown body for editing
  app.get("/api/admin/catalog/:id", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") { reply.code(403); return { error: "Admin only." }; }
    const { id } = request.params as { id: string };
    const { isValidCatalogId, loadOverrideYaml, loadOverrideMarkdown, resolvePlaybookYaml, hasResolvedPlaybook } = await import("./catalog-overrides.js");
    if (!isValidCatalogId(id)) { reply.code(400); return { error: "Invalid catalog id." }; }
    const { readDatabase } = await import("./database.js");
    const { mergeCatalog } = await import("./catalog-overrides.js");
    const db = await readRuntimeDatabase();
    const baseline = (await readDatabase()).catalog;
    const merged = mergeCatalog(baseline, db.catalogOverrides);
    const item = merged.find((c) => c.id === id);
    if (!item) { reply.code(404); return { error: "Catalog item not found." }; }
    // Pull YAML (override or baseline)
    let yaml = "";
    try {
      if (await hasResolvedPlaybook(id)) yaml = await resolvePlaybookYaml(id);
    } catch { /* ignore */ }
    // Pull markdown (override first, then baseline)
    let markdown = "";
    const overrideMd = await loadOverrideMarkdown(id);
    if (overrideMd !== null) markdown = overrideMd;
    else {
      try {
        const fs = await import("node:fs/promises");
        const path = await import("node:path");
        const { resolveFromRoot } = await import("./repo.js");
        markdown = await fs.readFile(resolveFromRoot(path.join(item.guidePath)), "utf8");
      } catch { /* no baseline guide */ }
    }
    const yamlOverride = await loadOverrideYaml(id);
    const overrideStatus = (db.catalogOverrides ?? []).find((o) => (o.baseId ?? o.id) === id);

    // Pull vars schema (override first, then baseline). Returns null when neither exists.
    let varsSchema: unknown = null;
    let hasSchemaOverride = false;
    try {
      const { loadVarsSchema } = await import("./catalog-vars-schema.js");
      varsSchema = await loadVarsSchema(id);
      // Detect override-vs-baseline by reading override path directly
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const overridePath = path.join(getConfig().dataDir, "catalog-overrides", "schemas", `${id}.vars.json`);
      try { await fs.access(overridePath); hasSchemaOverride = true; } catch { /* no override */ }
    } catch { /* schema loader threw — schema invalid; surface as null */ }

    return {
      item,
      yaml,
      markdown,
      varsSchema,
      hasYamlOverride: yamlOverride !== null,
      hasMarkdownOverride: overrideMd !== null,
      hasSchemaOverride,
      isUserAdded: overrideStatus ? !overrideStatus.baseId : false
    };
  });

  // Create a new catalog item (admin-only)
  app.post("/api/admin/catalog", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") { reply.code(403); return { error: "Admin only." }; }
    const body = (request.body ?? {}) as {
      id?: string;
      kind?: "software" | "combo";
      name?: string;
      nameEn?: string;
      category?: "runtime" | "developer" | "database" | "container" | "security" | "network" | "service";
      summary?: string;
      summaryEn?: string;
      imageTone?: string;
      sensitivity?: "safe" | "review" | "privileged";
      rating?: number;
      playbookYaml?: string;
      guideMarkdown?: string;
      components?: Array<{ type: "software" | "system-command" | "system-config"; label: string; labelEn: string; detail: string }>;
      deployModes?: Array<"system" | "docker">;
    };
    const { isValidCatalogId, saveOverrideYaml, saveOverrideMarkdown } = await import("./catalog-overrides.js");
    if (!body.id || !isValidCatalogId(body.id)) {
      reply.code(400); return { error: "id is required and must match [a-z0-9-]{1,60}" };
    }
    if (!body.name?.trim()) { reply.code(400); return { error: "name is required" }; }
    if (!body.playbookYaml?.trim()) { reply.code(400); return { error: "playbookYaml is required" }; }
    // Validate YAML by attempting to parse it
    try {
      const { parsePlaybook } = await import("./engine/index.js");
      parsePlaybook(body.playbookYaml);
    } catch (err) {
      reply.code(400);
      return { error: `Invalid playbook YAML: ${err instanceof Error ? err.message : err}` };
    }
    // Make sure the id isn't already in use (baseline OR another override)
    const { readDatabase } = await import("./database.js");
    const { mergeCatalog } = await import("./catalog-overrides.js");
    const db = await readRuntimeDatabase();
    const baseline = (await readDatabase()).catalog;
    const merged = mergeCatalog(baseline, db.catalogOverrides);
    if (merged.some((m) => m.id === body.id)) {
      reply.code(400); return { error: `Catalog id already exists: ${body.id}` };
    }
    const now = new Date().toISOString();
    await updateRuntimeDatabase((rdb) => {
      if (!rdb.catalogOverrides) rdb.catalogOverrides = [];
      rdb.catalogOverrides.push({
        id: body.id!,
        // No baseId → user-added
        overrides: {
          kind: body.kind ?? "software",
          name: body.name!,
          nameEn: body.nameEn ?? body.name!,
          category: body.category ?? "service",
          summary: body.summary ?? "",
          summaryEn: body.summaryEn ?? body.summary ?? "",
          imageTone: body.imageTone ?? "slate",
          sensitivity: body.sensitivity ?? "safe",
          rating: body.rating ?? 0,
          components: body.components ?? [],
          deployModes: body.deployModes ?? ["system"]
        },
        createdAt: now,
        updatedAt: now,
        modifiedBy: user.id
      });
    });
    await saveOverrideYaml(body.id, body.playbookYaml);
    if (body.guideMarkdown) await saveOverrideMarkdown(body.id, body.guideMarkdown);
    return { ok: true, id: body.id };
  });

  // Update a catalog item (creates an override on a baseline item, or edits a user-added one)
  app.patch("/api/admin/catalog/:id", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") { reply.code(403); return { error: "Admin only." }; }
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as {
      kind?: "software" | "combo";
      name?: string;
      nameEn?: string;
      category?: "runtime" | "developer" | "database" | "container" | "security" | "network" | "service";
      summary?: string;
      summaryEn?: string;
      imageTone?: string;
      sensitivity?: "safe" | "review" | "privileged";
      rating?: number;
      playbookYaml?: string;
      guideMarkdown?: string;
      /**
       * Optional vars schema override. `null` means "delete the override (revert to baseline)".
       * Object means "save as override". Undefined means "don't touch".
       */
      varsSchema?: unknown;
      components?: Array<{ type: "software" | "system-command" | "system-config"; label: string; labelEn: string; detail: string }>;
      deployModes?: Array<"system" | "docker">;
      hidden?: boolean;
    };
    const { isValidCatalogId, saveOverrideYaml, saveOverrideMarkdown } = await import("./catalog-overrides.js");
    if (!isValidCatalogId(id)) { reply.code(400); return { error: "Invalid catalog id." }; }

    // Validate YAML if provided
    if (body.playbookYaml) {
      try {
        const { parsePlaybook } = await import("./engine/index.js");
        parsePlaybook(body.playbookYaml);
      } catch (err) {
        reply.code(400);
        return { error: `Invalid playbook YAML: ${err instanceof Error ? err.message : err}` };
      }
    }

    const { readDatabase } = await import("./database.js");
    const baseline = (await readDatabase()).catalog;
    const baselineHas = baseline.some((b) => b.id === id);

    const now = new Date().toISOString();
    const result = await updateRuntimeDatabase((rdb) => {
      if (!rdb.catalogOverrides) rdb.catalogOverrides = [];
      // Find existing override
      let ov = rdb.catalogOverrides.find((o) => (o.baseId ?? o.id) === id);
      if (!ov) {
        // First time editing a baseline item
        if (baselineHas) {
          ov = {
            id,
            baseId: id,
            overrides: {},
            createdAt: now,
            updatedAt: now,
            modifiedBy: user.id
          };
          rdb.catalogOverrides.push(ov);
        } else {
          return { error: "Catalog item not found" } as { error: string };
        }
      }
      // Apply field updates
      if (body.hidden !== undefined) ov.hidden = body.hidden;
      ov.overrides = ov.overrides ?? {};
      if (body.kind !== undefined) ov.overrides.kind = body.kind;
      if (body.name !== undefined) ov.overrides.name = body.name;
      if (body.nameEn !== undefined) ov.overrides.nameEn = body.nameEn;
      if (body.category !== undefined) ov.overrides.category = body.category;
      if (body.summary !== undefined) ov.overrides.summary = body.summary;
      if (body.summaryEn !== undefined) ov.overrides.summaryEn = body.summaryEn;
      if (body.imageTone !== undefined) ov.overrides.imageTone = body.imageTone;
      if (body.sensitivity !== undefined) ov.overrides.sensitivity = body.sensitivity;
      if (body.rating !== undefined) ov.overrides.rating = body.rating;
      if (body.components !== undefined) ov.overrides.components = body.components;
      if (body.deployModes !== undefined) ov.overrides.deployModes = body.deployModes;
      ov.updatedAt = now;
      ov.modifiedBy = user.id;
      return { ok: true };
    });
    if ("error" in result) { reply.code(404); return result; }
    if (body.playbookYaml) await saveOverrideYaml(id, body.playbookYaml);
    if (body.guideMarkdown !== undefined) await saveOverrideMarkdown(id, body.guideMarkdown);
    // varsSchema: null → delete override; object → save override; undefined → no change
    if (body.varsSchema !== undefined) {
      const { saveOverrideSchema, deleteOverrideSchema } = await import("./catalog-vars-schema.js");
      if (body.varsSchema === null) {
        await deleteOverrideSchema(id);
      } else {
        try {
          await saveOverrideSchema(id, body.varsSchema as Parameters<typeof saveOverrideSchema>[1]);
        } catch (err) {
          reply.code(400);
          return { error: `Invalid vars schema: ${err instanceof Error ? err.message : err}` };
        }
      }
    }
    return { ok: true };
  });

  // Delete: hide a baseline item OR fully remove a user-added one
  app.delete("/api/admin/catalog/:id", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") { reply.code(403); return { error: "Admin only." }; }
    const { id } = request.params as { id: string };
    const { deleteOverrideYaml, deleteOverrideMarkdown } = await import("./catalog-overrides.js");
    const { readDatabase } = await import("./database.js");
    const baseline = (await readDatabase()).catalog;
    const baselineHas = baseline.some((b) => b.id === id);

    const now = new Date().toISOString();
    await updateRuntimeDatabase((rdb) => {
      if (!rdb.catalogOverrides) rdb.catalogOverrides = [];
      if (baselineHas) {
        // Hide the baseline item via override
        const existing = rdb.catalogOverrides.find((o) => o.baseId === id);
        if (existing) {
          existing.hidden = true;
          existing.updatedAt = now;
          existing.modifiedBy = user.id;
        } else {
          rdb.catalogOverrides.push({
            id,
            baseId: id,
            hidden: true,
            createdAt: now,
            updatedAt: now,
            modifiedBy: user.id
          });
        }
      } else {
        // Remove user-added entry entirely
        rdb.catalogOverrides = rdb.catalogOverrides.filter((o) => o.id !== id);
      }
    });
    if (!baselineHas) {
      // Drop body files for user-added items
      await deleteOverrideYaml(id);
      await deleteOverrideMarkdown(id);
    }
    return { ok: true };
  });

  // Reset: drop the override entirely so the baseline shines through again
  app.post("/api/admin/catalog/:id/reset", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") { reply.code(403); return { error: "Admin only." }; }
    const { id } = request.params as { id: string };
    const { deleteOverrideYaml, deleteOverrideMarkdown } = await import("./catalog-overrides.js");
    const { deleteOverrideSchema } = await import("./catalog-vars-schema.js");
    const { readDatabase } = await import("./database.js");
    const baseline = (await readDatabase()).catalog;
    const baselineHas = baseline.some((b) => b.id === id);
    if (!baselineHas) { reply.code(400); return { error: "Reset only applies to baseline items. Delete user-added items instead." }; }
    await updateRuntimeDatabase((rdb) => {
      rdb.catalogOverrides = (rdb.catalogOverrides ?? []).filter((o) => o.baseId !== id);
    });
    await deleteOverrideYaml(id);
    await deleteOverrideMarkdown(id);
    await deleteOverrideSchema(id);
    return { ok: true };
  });

  // ── Runtime detection rules (Phase B2) ───────────────────────────────
  // Admin-authored detection rules generated from an archetype factory.
  // They EXTEND migrate detection/classification only — they never enter
  // Build certification (cert reads the static rule export + opt-in).

  /** Generate (preview, no persist) a detection rule from an archetype. */
  app.post("/api/admin/capability-rules/generate", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") { reply.code(403); return { error: "Admin only." }; }
    const body = (request.body ?? {}) as { archetype?: string; params?: Record<string, unknown> };
    if (body.archetype !== "native" && body.archetype !== "docker-app") {
      reply.code(400); return { error: "archetype must be 'native' or 'docker-app'." };
    }
    try {
      const { nativeRule, dockerAppRule } = await import("./catalog-rules.js");
      const rule = body.archetype === "native"
        ? nativeRule(body.params as Parameters<typeof nativeRule>[0])
        : dockerAppRule(body.params as Parameters<typeof dockerAppRule>[0]);
      const { ruleOverrideRejectionReason } = await import("./catalog-rule-store.js");
      return { rule, conflict: ruleOverrideRejectionReason(rule) };
    } catch (error) {
      reply.code(400);
      return { error: `Rule generation failed: ${error instanceof Error ? error.message : error}` };
    }
  });

  /** List runtime (UI-authored) detection rules. */
  app.get("/api/admin/capability-rules", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") { reply.code(403); return { error: "Admin only." }; }
    const { listRuleOverrides } = await import("./catalog-rule-store.js");
    return { rules: await listRuleOverrides() };
  });

  /** Create or update a runtime detection rule (generate + persist). */
  async function upsertCapabilityRule(request: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply, existingId?: string) {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") { reply.code(403); return { error: "Admin only." }; }
    const body = (request.body ?? {}) as { archetype?: string; params?: Record<string, unknown> };
    if (body.archetype !== "native" && body.archetype !== "docker-app") {
      reply.code(400); return { error: "archetype must be 'native' or 'docker-app'." };
    }
    const { nativeRule, dockerAppRule } = await import("./catalog-rules.js");
    const { ruleOverrideRejectionReason, saveRuleOverride, getRuleOverride } = await import("./catalog-rule-store.js");
    let rule;
    try {
      rule = body.archetype === "native"
        ? nativeRule(body.params as Parameters<typeof nativeRule>[0])
        : dockerAppRule(body.params as Parameters<typeof dockerAppRule>[0]);
    } catch (error) {
      reply.code(400); return { error: `Rule generation failed: ${error instanceof Error ? error.message : error}` };
    }
    const reason = ruleOverrideRejectionReason(rule, existingId);
    if (reason) { reply.code(400); return { error: reason }; }
    // POST = create: reject when a runtime rule with this id already exists.
    if (!existingId && await getRuleOverride(rule.id)) {
      reply.code(400); return { error: `Runtime rule "${rule.id}" already exists; edit it instead.` };
    }
    const saved = await saveRuleOverride({ archetype: body.archetype, input: body.params ?? {}, rule, modifiedBy: user.id, existingId });
    return { ok: true, rule: saved };
  }

  app.post("/api/admin/capability-rules", async (request, reply) => upsertCapabilityRule(request, reply));
  app.patch("/api/admin/capability-rules/:id", async (request, reply) =>
    upsertCapabilityRule(request, reply, (request.params as { id: string }).id));

  app.delete("/api/admin/capability-rules/:id", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") { reply.code(403); return { error: "Admin only." }; }
    const { id } = request.params as { id: string };
    const { deleteRuleOverride } = await import("./catalog-rule-store.js");
    const removed = await deleteRuleOverride(id);
    if (!removed) { reply.code(404); return { error: "Runtime rule not found." }; }
    return { ok: true };
  });

  // ── Community Comments, Likes, Reports and FTS (Stage 2) ──────────────────────────

  /**
   * GET /api/catalog/:catalogId/comments
   * Returns keyset paginated comments list for a catalog item.
   */
  app.get("/api/catalog/:catalogId/comments", async (request) => {
    const { catalogId } = request.params as { catalogId: string };
    const query = (request.query ?? {}) as {
      limit?: string;
      cursorCreatedAt?: string;
      cursorId?: string;
    };
    const limit = Math.min(parseInt(query.limit || "20", 10) || 20, 100);

    let requestingUserId: string | undefined;
    try {
      const token = readBearerToken(request.headers.authorization);
      if (token) {
        const user = await getUserByToken(token);
        if (user) requestingUserId = user.id;
      }
    } catch {}

    return await getComments(
      catalogId,
      requestingUserId,
      limit,
      query.cursorCreatedAt,
      query.cursorId
    );
  });

  /**
   * POST /api/catalog/:catalogId/comments [Requires Rate Limiting] [Requires DB Transaction]
   * Adds a new comment to a catalog item. Standard HTML character entities are escaped.
   */
  app.post("/api/catalog/:catalogId/comments", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) {
      reply.code(401);
      return { error: "Login required to post comments." };
    }

    const { catalogId } = request.params as { catalogId: string };
    const body = (request.body ?? {}) as { content?: string };
    const content = (body.content || "").trim();

    if (!content) {
      reply.code(400);
      return { error: "Comment content cannot be empty." };
    }

    if (content.length > 1000) {
      reply.code(400);
      return { error: "Comment content cannot exceed 1000 characters." };
    }

    // [Requires Rate Limiting]: 5 comments per minute database-backed check
    const { getSqliteDb } = await import("./db-sqlite.js");
    const db = await getSqliteDb();
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const recentComments = await db.get(
      "SELECT COUNT(*) as count FROM catalog_comments WHERE user_id = ? AND created_at > ?",
      user.id,
      oneMinuteAgo
    );
    if (recentComments && recentComments.count >= 5) {
      reply.code(429);
      return { error: "Rate limit exceeded. You can post up to 5 comments per minute." };
    }

    // [Requires DB Transaction] handled inside addComment
    return await addComment(catalogId, user.id, content);
  });

  /**
   * POST /api/catalog/comments/:id/like [Requires DB Transaction]
   * Toggles like state for a comment.
   */
  app.post("/api/catalog/comments/:id/like", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) {
      reply.code(401);
      return { error: "Login required to like comments." };
    }

    const { id } = request.params as { id: string };
    try {
      // [Requires DB Transaction] handled inside toggleCommentLike
      return await toggleCommentLike(id, user.id);
    } catch (error) {
      reply.code(404);
      return { error: error instanceof Error ? error.message : "Comment not found" };
    }
  });

  /**
   * POST /api/catalog/comments/:id/report [Requires Rate Limiting] [Requires DB Transaction]
   * Submits a report for a comment.
   */
  app.post("/api/catalog/comments/:id/report", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) {
      reply.code(401);
      return { error: "Login required to report comments." };
    }

    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { reason?: string };
    const reason = (body.reason || "").trim();

    if (!reason) {
      reply.code(400);
      return { error: "Report reason cannot be empty." };
    }

    // [Requires Rate Limiting]: check if user reported this comment in the last 10 seconds
    const { getSqliteDb } = await import("./db-sqlite.js");
    const db = await getSqliteDb();
    const tenSecondsAgo = new Date(Date.now() - 10 * 1000).toISOString();
    const recentReports = await db.get(
      "SELECT COUNT(*) as count FROM comment_reports WHERE user_id = ? AND created_at > ?",
      user.id,
      tenSecondsAgo
    );
    if (recentReports && recentReports.count >= 1) {
      reply.code(429);
      return { error: "Please wait before submitting another report." };
    }

    try {
      // [Requires DB Transaction] handled inside reportComment
      await reportComment(id, user.id, reason);
      return { success: true };
    } catch (error) {
      reply.code(404);
      return { error: error instanceof Error ? error.message : "Comment not found" };
    }
  });

  /**
   * GET /api/admin/reports (admin only)
   * Pulls the list of reported comments for moderation.
   */
  app.get("/api/admin/reports", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") {
      reply.code(403);
      return { error: "Admin role required." };
    }

    const query = (request.query ?? {}) as { limit?: string; offset?: string };
    const limit = Math.min(parseInt(query.limit || "20", 10) || 20, 100);
    const offset = Math.max(parseInt(query.offset || "0", 10) || 0, 0);

    const reports = await getAdminReports(limit, offset);
    return { reports };
  });

  /**
   * POST /api/admin/reports/:id/resolve (admin only) [Requires DB Transaction]
   * Resolves a comment report by either keeping or deleting the comment.
   */
  app.post("/api/admin/reports/:id/resolve", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") {
      reply.code(403);
      return { error: "Admin role required." };
    }

    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { action?: "keep" | "delete" };
    const action = body.action;

    if (action !== "keep" && action !== "delete") {
      reply.code(400);
      return { error: "Invalid action. Must be 'keep' or 'delete'." };
    }

    try {
      // [Requires DB Transaction] handled inside resolveReport
      await resolveReport(id, action, user.id);
      return { success: true };
    } catch (error) {
      reply.code(404);
      return { error: error instanceof Error ? error.message : "Report not found" };
    }
  });

  /**
   * POST /api/admin/comments/sync-fts (admin only)
   * Manually triggers full-text search index synchronization.
   */
  app.post("/api/admin/comments/sync-fts", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") {
      reply.code(403);
      return { error: "Admin role required." };
    }

    await syncCommentsFts();
    return { success: true };
  });

  // ── Subsystem Operations Inbox (Stage 3) ──────────────────────────────────────────

  /**
   * GET /api/me/inbox/unread-count
   * Returns a cheap unread badge count for the current user.
   */
  app.get("/api/me/inbox/unread-count", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) { reply.code(401); return { error: "Login required." }; }
    return { count: await getUnreadInboxCount(user.id) };
  });

  /**
   * GET /api/me/inbox
   * Returns paginated inbox messages for the current user.
   */
  app.get("/api/me/inbox", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) {
      reply.code(401);
      return { error: "Login required." };
    }

    const query = (request.query ?? {}) as {
      limit?: string;
      cursorCreatedAt?: string;
      cursorId?: string;
    };
    const limit = Math.min(parseInt(query.limit || "20", 10) || 20, 100);

    const { getInboxMessages } = await import("./runtime-store.js");
    return await getInboxMessages(user.id, limit, query.cursorCreatedAt, query.cursorId);
  });

  /**
   * POST /api/me/inbox/:id/read
   * Marks a specific inbox message as read.
   */
  app.post("/api/me/inbox/:id/read", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) {
      reply.code(401);
      return { error: "Login required." };
    }

    const { id } = request.params as { id: string };
    const { markInboxMessageAsRead } = await import("./runtime-store.js");
    await markInboxMessageAsRead(id, user.id);
    return { success: true };
  });

  /**
   * DELETE /api/me/inbox/:id
   * Deletes a specific inbox message.
   */
  app.delete("/api/me/inbox/:id", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) {
      reply.code(401);
      return { error: "Login required." };
    }

    const { id } = request.params as { id: string };
    const { deleteInboxMessage } = await import("./runtime-store.js");
    await deleteInboxMessage(id, user.id);
    return { success: true };
  });

  // ── Catalog Suggestions (User + Admin) ──────────────────────────────────────────

  /**
   * GET /api/suggestions
   * Returns the authenticated user's own suggestions (keyset paginated).
   */
  app.get("/api/suggestions", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) {
      reply.code(401);
      return { error: "Login required." };
    }

    const query = (request.query ?? {}) as {
      status?: string;
      limit?: string;
      cursorCreatedAt?: string;
      cursorId?: string;
    };
    const limit = Math.min(parseInt(query.limit || "20", 10) || 20, 100);

    return await getSuggestions({
      userId: user.id,
      status: query.status,
      limit,
      cursorCreatedAt: query.cursorCreatedAt,
      cursorId: query.cursorId
    });
  });

  /**
   * POST /api/suggestions [Requires Rate Limiting]
   * Creates a new catalog suggestion.
   */
  app.post("/api/suggestions", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user) {
      reply.code(401);
      return { error: "Login required." };
    }

    const body = (request.body ?? {}) as {
      catalogId?: string;
      type?: string;
      nameZh?: string;
      nameEn?: string;
      category?: string;
      playbookYaml?: string;
      guideMarkdown?: string;
      remark?: string;
    };

    if (!body.type || (body.type !== "new_item" && body.type !== "modify")) {
      reply.code(400);
      return { error: "type must be 'new_item' or 'modify'." };
    }

    if (!body.nameZh?.trim() || !body.nameEn?.trim()) {
      reply.code(400);
      return { error: "nameZh and nameEn are required." };
    }

    // [Requires Rate Limiting]: 3 suggestions per minute database-backed check
    const { getSqliteDb } = await import("./db-sqlite.js");
    const db = await getSqliteDb();
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const recentSuggestions = await db.get(
      "SELECT COUNT(*) as count FROM catalog_suggestions WHERE user_id = ? AND created_at > ?",
      user.id,
      oneMinuteAgo
    );
    if (recentSuggestions && recentSuggestions.count >= 3) {
      reply.code(429);
      return { error: "Rate limit exceeded. You can submit up to 3 suggestions per minute." };
    }

    return await addSuggestion(user.id, {
      catalogId: body.catalogId,
      type: body.type,
      nameZh: body.nameZh!,
      nameEn: body.nameEn!,
      category: body.category,
      playbookYaml: body.playbookYaml,
      guideMarkdown: body.guideMarkdown,
      remark: body.remark
    });
  });

  /**
   * GET /api/admin/suggestions (admin only)
   * Returns all suggestions with optional status filter (keyset paginated).
   */
  app.get("/api/admin/suggestions", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") {
      reply.code(403);
      return { error: "Admin role required." };
    }

    const query = (request.query ?? {}) as {
      status?: string;
      limit?: string;
      cursorCreatedAt?: string;
      cursorId?: string;
    };
    const limit = Math.min(parseInt(query.limit || "20", 10) || 20, 100);

    return await getSuggestions({
      status: query.status,
      limit,
      cursorCreatedAt: query.cursorCreatedAt,
      cursorId: query.cursorId
    });
  });

  /**
   * GET /api/admin/suggestions/:id (admin only)
   * Returns a single suggestion detail.
   */
  app.get("/api/admin/suggestions/:id", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") {
      reply.code(403);
      return { error: "Admin role required." };
    }

    const { id } = request.params as { id: string };
    const suggestion = await getSuggestionById(id);
    if (!suggestion) {
      reply.code(404);
      return { error: "Suggestion not found." };
    }
    return { suggestion };
  });

  /**
   * POST /api/admin/suggestions/:id/process (admin only)
   * Accepts or rejects a suggestion.
   */
  app.post("/api/admin/suggestions/:id/process", async (request, reply) => {
    const user = await getUserByToken(readBearerToken(request.headers.authorization));
    if (!user || user.role !== "admin") {
      reply.code(403);
      return { error: "Admin role required." };
    }

    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { action?: string; feedback?: string };

    if (body.action !== "accepted" && body.action !== "rejected") {
      reply.code(400);
      return { error: "action must be 'accepted' or 'rejected'." };
    }

    try {
      await processSuggestion(id, user.id, body.action, body.feedback);
      return { success: true };
    } catch (error) {
      reply.code(404);
      return { error: error instanceof Error ? error.message : "Suggestion not found" };
    }
  });
}

function readBearerToken(header: string | undefined): string | undefined {
  if (!header?.startsWith("Bearer ")) return undefined;
  return header.slice("Bearer ".length).trim();
}

/** Open an SSH connection for the given stored connection profile (handles password / key). */
async function connectSshForUser(
  conn: { method: string; userId: string; fields: Record<string, string> },
  userId: string
): Promise<import("ssh2").Client> {
  const { Client: SshClient } = await import("ssh2");
  const { decryptStoredFields } = await import("./connections.js");
  const { readUserKey } = await import("./key-store.js");
  const decrypted = decryptStoredFields(conn.fields);
  return new Promise<import("ssh2").Client>((resolve, reject) => {
    const c = new SshClient();
    const timer = setTimeout(() => { c.destroy(); reject(new Error("SSH timeout")); }, 10000);
    c.on("ready", () => { clearTimeout(timer); resolve(c); });
    c.on("error", (err: Error) => { clearTimeout(timer); reject(err); });
    const cfg: Record<string, unknown> = {
      host: decrypted.host,
      port: parseInt(decrypted.port ?? "22", 10) || 22,
      username: decrypted.username,
      readyTimeout: 10000,
      keepaliveInterval: 30000,
      keepaliveCountMax: 3
    };
    if (conn.method === "ssh-key") {
      const keyId = decrypted._keyId;
      if (keyId) {
        readUserKey(userId, keyId).then((pk) => {
          cfg.privateKey = Buffer.from(pk, "utf8");
          if (decrypted._rawPassphrase) cfg.passphrase = decrypted._rawPassphrase;
          c.connect(cfg as any);
        }).catch((err: Error) => { clearTimeout(timer); reject(err); });
      } else if (decrypted.privateKeyPath) {
        import("node:fs/promises").then((fsm) => fsm.readFile(decrypted.privateKeyPath, "utf8")).then((pk) => {
          cfg.privateKey = pk;
          c.connect(cfg as any);
        }).catch((err: Error) => { clearTimeout(timer); reject(err); });
      } else {
        clearTimeout(timer);
        reject(new Error("No SSH key configured"));
      }
    } else {
      cfg.password = decrypted._rawPassword;
      if (!cfg.password) { clearTimeout(timer); reject(new Error("No password")); return; }
      c.connect(cfg as any);
    }
  });
}


/** Format raw install count for display (e.g. 1234 → "1.2k"). */
function formatInstallCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
  if (n < 1000000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1000000).toFixed(1)}M`;
}
