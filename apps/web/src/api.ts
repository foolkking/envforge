export interface ScanResponse {
  manifest: SnapshotManifest;
  persisted: boolean;
  paths?: {
    snapshotPath: string;
    latestPath: string;
  };
}

export interface SnapshotManifest {
  schemaVersion: string;
  createdAt: string;
  user: string;
  machine: {
    id: string;
    hostname: string;
    os: string;
    platform: string;
    arch: string;
  };
  collectors: Record<string, CollectorOutput>;
  files: unknown[];
  redactions: unknown[];
  restoreHints: unknown[];
}

export interface CollectorOutput {
  id: string;
  label: string;
  status: "available" | "partial" | "unavailable";
  completeness: number;
  commands: CollectorCommandEvidence[];
  collectedAt: string;
  data: unknown;
  issues: Array<{ code: string; message: string; needsPrivilege?: boolean }>;
}

export interface CollectorCommandEvidence {
  command: string;
  exitCode?: number;
  timedOut?: boolean;
  stderr?: string;
}

export interface SnapshotSummary {
  user: string;
  machineId: string;
  createdAt: string;
  path: string;
  isLatest: boolean;
}

export interface TargetVirtualMachine {
  id: string;
  name: string;
  provider: string;
  address: string;
  status: "healthy" | "warning" | "failed" | "unsynced";
  os: string;
  region: string;
  lastSeen: string;
  software: TargetSoftware[];
  configChecklist: SystemConfigItem[];
}

export interface CatalogItemCertification {
  status: "certified" | "not-ready";
  visibleToUsers: boolean;
  reasons: string[];
}

export interface CatalogItem {
  id: string;
  kind: "software" | "combo";
  name: string;
  nameEn: string;
  category: "runtime" | "developer" | "database" | "container" | "security" | "network" | "service";
  summary: string;
  summaryEn: string;
  rating: number;
  installs: string;
  imageTone: string;
  sensitivity: "safe" | "review" | "privileged";
  assets: string[];
  guidePath: string;
  guideAuthor: "admin" | "user";
  installMode: "skip-existing" | "replace-existing";
  components: CatalogComponent[];
  capabilityKey?: string;
  /** 支持的部署模式：system = apt 安装，docker = docker compose 部署 */
  deployModes?: Array<"system" | "docker">;
  supportLevel?: "detect-only" | "basic-rebuild" | "managed-config" | "full-migration";
  modeSupport?: {
    migrate?: boolean;
    build?: boolean;
    maintain?: boolean;
  };
  managedActions?: Array<"detect" | "install" | "config-read" | "config-migrate" | "validate" | "rollback" | "data-strategy">;
  /**
   * Full Migration Certified status, attached by the server's
   * annotateCertification overlay. End-user UI MUST consume this and
   * MUST NOT render the legacy supportLevel as a user-visible badge.
   */
  certification?: CatalogItemCertification;
}

export interface CatalogComponent {
  type: "software" | "system-command" | "system-config";
  label: string;
  labelEn: string;
  detail: string;
}

export interface CatalogGuide {
  item: CatalogItem;
  markdown: string;
}

export interface MigrationStrategy {
  id: string;
  name: string;
  source: string;
  useCase: string;
  conflictModes: Array<"skip-existing" | "replace-existing">;
}

export interface CurrentUser {
  id: string;
  name: string;
  nameEn: string;
  authenticated: boolean;
  uploadedProfiles: Array<{
    id: string;
    name: string;
    nameEn: string;
    items: number;
    updatedAt: string;
  }>;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  authenticated: true;
  role: "user" | "admin";
  defaultSshUser?: string;
  // Extended profile fields (auth-and-ecosystem spec P1.11)
  username?: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  timezone?: string;
  locale?: string;
  emailVerifiedAt?: string;
  totpEnabled?: boolean;
  deletedAt?: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

/** Result of POST /api/auth/login (auth-and-ecosystem spec P1.10). */
export type LoginResponse =
  | AuthResponse
  | { needs2FA: true; intermediateToken: string; expiresAt: string; user: AuthUser }
  | { needsEnrollment: true; intermediateToken: string; expiresAt: string; user: AuthUser };

/** Result of POST /api/auth/register/start (P1.5 two-step registration). */
export interface RegisterStartResponse {
  pendingId: string;
  message: string;
  /** Surfaced only in dev mode. */
  devCode?: string;
}

/** Identity entry (one row per linked OAuth provider, plus virtual local). */
export interface IdentityEntry {
  provider: "local" | "github" | "google";
  providerEmail?: string;
  providerLogin?: string;
  providerAvatarUrl?: string;
  providerDisplayName?: string;
  createdAt: string;
  lastUsedAt?: string;
}

/** Notification preferences (P1.11). */
export interface NotificationPrefs {
  userId: string;
  emailMentions: boolean;
  emailComments: boolean;
  emailSuggestionStatus: boolean;
  emailPublishStatus: boolean;
  updatedAt: string;
}

export interface UserActivityCounts {
  connections: number;
  uploadedProfiles: number;
  playbooks: number;
  tasksExecuted: number;
  identitiesLinked: number;
  apiTokens: number;
}

export interface TwoFactorStatus {
  enabled: boolean;
  enabledAt?: string;
  recoveryCodesRemaining: number;
  hasPendingEnrollment: boolean;
}

/** Full response from GET /api/me when authenticated. */
export interface MeFullResponse {
  user: AuthUser;
  identities: IdentityEntry[];
  twoFactor: TwoFactorStatus;
  notificationPrefs: NotificationPrefs;
  activity: UserActivityCounts;
}

export type ConnectionMethod = "ssh-password" | "ssh-key";

export interface ConnectionProfile {
  id: string;
  userId: string;
  method: ConnectionMethod;
  label: string;
  /** 用户自定义标签，用于分组（如 dev、staging、prod） */
  tags?: string[];
  status: "validated" | "ssh_ok" | "ssh_failed" | "probed" | "unreachable";
  sshError?: string;
  fields: Record<string, string>;
  maskedSecrets: string[];
  realConnection: false;
  agentUrl?: string;
  probeSnapshot?: AgentProbeResult;
  lastProbeAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionResponse {
  connection: ConnectionProfile;
  probe: AgentProbeResult | null;
  note: string;
}

export interface TargetSoftware {
  name: string;
  version: string;
  source: string; // apt | apt-manual | rpm | snap | flatpak | npm | pip | gem | cargo | local-bin | opt | user-bin | nvm | pyenv | rbenv | asdf | sdkman | docker | runtime | system | container
  status: string; // installed | synced | unsynced | warning
  /** "user" = matches curated whitelist (always shown); "uncertain" = passed system blacklist
   *  but not in whitelist (hidden by default; UI offers a "show all" toggle).
   *  Only set on apt source; other sources are inherently user-installed. */
  trust?: "user" | "uncertain";
}

export interface SystemConfigItem {
  id: string;
  label: string;
  category: "security" | "network" | "runtime" | "service";
  status: "healthy" | "warning" | "failed";
  lastChanged: string;
}

export interface AgentSystemInfo {
  hostname: string;
  platform: string;
  arch: string;
  release: string;
  uptime: number;
  osPretty?: string;
  cpu: { model: string; cores: number; speedMhz: number };
  memory: { totalBytes: number; freeBytes: number; usedBytes: number; totalGb: string; freeGb: string };
  disk?: { total: string; used: string; available: string; usePercent: string };
  uptimeText?: string;
}

export interface AgentProbeResult {
  reachable: true;
  agentId: string;
  collectedAt: string;
  collection?: {
    status: "ok" | "partial" | "failed";
    completeness: number;
    commands: CollectorCommandEvidence[];
    stderr?: string;
    errors: string[];
    timedOut: boolean;
  };
  collectors?: Record<string, {
    id: string;
    status: "ok" | "partial" | "failed";
    completeness: number;
    commands: CollectorCommandEvidence[];
    stdout?: string;
    stderr?: string;
    errors: string[];
    collectedAt: string;
    data: string[];
  }>;
  system: AgentSystemInfo;
  software: TargetSoftware[];
  configChecklist: SystemConfigItem[];
  /** Per-source counts for summary display */
  counts?: {
    apt: number;
    rpm: number;
    snap: number;
    flatpak: number;
    npm: number;
    pip: number;
    gem: number;
    cargo: number;
    localBin: number;
    opt: number;
    userBin: number;
    nvm: number;
    pyenv: number;
    docker: number;
    enabledServices: number;
    runningServices: number;
    total: number;
  };
}

export interface AgentProbeFailure {
  reachable: false;
  error: string;
}

export type ProbeResult = AgentProbeResult | AgentProbeFailure;

// ── 用户配置组合 ──────────────────────────────────────────

export interface ProfileComponent {
  type: "software" | "system-command" | "system-config";
  label: string;
  labelEn: string;
  detail: string;
}

export interface UserProfile {
  id: string;
  userId: string;
  kind: "software" | "combo" | "vm-snapshot";
  visibility: "public" | "private";
  name: string;
  nameEn: string;
  category: "runtime" | "developer" | "database" | "container" | "security" | "network" | "service";
  summary: string;
  summaryEn: string;
  sensitivity: "safe" | "review" | "privileged";
  components: ProfileComponent[];
  installMode: "skip-existing" | "replace-existing";
  guideMarkdown?: string;
  sourceConnectionId?: string;
  envSnapshot?: AgentProbeResult & { envVars?: Record<string, string>; userNotes?: string };
  createdAt: string;
  updatedAt: string;
}

export interface CreateProfileInput {
  kind: "software" | "combo" | "vm-snapshot";
  name: string;
  nameEn?: string;
  category: UserProfile["category"];
  summary: string;
  summaryEn?: string;
  sensitivity: UserProfile["sensitivity"];
  components: ProfileComponent[];
  installMode: UserProfile["installMode"];
  guideMarkdown?: string;
  sourceConnectionId?: string;
}

export interface UploadSnapshotInput {
  name?: string;
  userNotes?: string;
  envVars?: Record<string, string>;
}

export async function runScan(user = "default", persist = true): Promise<ScanResponse> {
  const response = await fetch("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user, persist })
  });

  if (!response.ok) {
    throw new Error(`Scan failed: ${response.status}`);
  }

  return response.json() as Promise<ScanResponse>;
}

export async function fetchSnapshots(): Promise<SnapshotSummary[]> {
  const response = await fetch("/api/snapshots");
  if (!response.ok) {
    throw new Error(`Snapshot list failed: ${response.status}`);
  }

  const body = (await response.json()) as { snapshots: SnapshotSummary[] };
  return body.snapshots;
}

export async function fetchTargets(): Promise<TargetVirtualMachine[]> {
  const response = await fetch("/api/targets");
  if (!response.ok) {
    throw new Error(`Target VM list failed: ${response.status}`);
  }

  const body = (await response.json()) as { targets: TargetVirtualMachine[] };
  return body.targets;
}

export interface CatalogResponseMeta {
  total: number;
  certified: number;
  notReady: number;
  viewer: "user-certified-only" | "admin-all";
}

export async function fetchCatalog(): Promise<CatalogItem[]> {
  const response = await fetch("/api/catalog");
  if (!response.ok) {
    throw new Error(`Catalog failed: ${response.status}`);
  }

  const body = (await response.json()) as { items: CatalogItem[]; meta?: CatalogResponseMeta };
  return body.items;
}

/**
 * Fetch the certified-only catalog plus its server-side meta block.
 * Build pages should consume this — the items are already filtered to
 * the Full Migration Certified set, and the meta carries the totals
 * needed for the "X certified / Y total" callout.
 */
export async function fetchCatalogWithMeta(): Promise<{ items: CatalogItem[]; meta: CatalogResponseMeta }> {
  const response = await fetch("/api/catalog");
  if (!response.ok) throw new Error(`Catalog failed: ${response.status}`);
  const body = (await response.json()) as { items: CatalogItem[]; meta?: CatalogResponseMeta };
  return {
    items: body.items,
    meta: body.meta ?? {
      total: body.items.length,
      certified: body.items.length,
      notReady: 0,
      viewer: "user-certified-only"
    }
  };
}

/**
 * Admin-only: fetch the admin Capability Rules registry. Returns every
 * catalog item with its full certification metadata. The server
 * refuses to serve this surface to non-admin tokens — UI code MUST
 * pass a bearer token.
 */
export async function fetchCapabilityRulesAdmin(token: string): Promise<{
  items: Array<{
    id: string;
    capabilityKey?: string;
    name: string;
    category: string;
    certification: CatalogItemCertification;
  }>;
  meta: { total: number; certified: number; notReady: number };
}> {
  const response = await fetch("/api/catalog/certification", {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (response.status === 403) throw new Error("Capability Rules Admin requires an admin token.");
  if (!response.ok) throw new Error(`Admin catalog failed: ${response.status}`);
  return response.json();
}

export type CatalogPreviewOperation = "create" | "update" | "no-op" | "blocked";
export type CatalogPreviewSafetyStatus = "safe" | "needs-review" | "blocked";

export interface CatalogPreviewDiffSummary {
  added: number;
  modified: number;
  removed: number;
  blocked: number;
  riskChanges: number;
  gateChanges: number;
  permissionChanges: number;
  serviceStackMappingChanges: number;
}

export interface CatalogPreviewSafetySummary {
  hasRuntimeMutation: false;
  hasConfigCatalogMutation: false;
  hasSecretLeak: boolean;
  hasRiskDowngrade: boolean;
  hasGateRemoval: boolean;
  hasWritePermissionWithoutGate: boolean;
  hasApplyWithoutPlanBoundary: boolean;
  blockedReasons: string[];
}

export interface CatalogPreviewDiffItem {
  id: string;
  capabilityId: string;
  catalogItemId: string;
  changeType: "added" | "modified" | "removed" | "blocked";
  title: string;
  category: string;
  riskBefore?: string;
  riskAfter?: string;
  gatesBefore?: string[];
  gatesAfter?: string[];
  permissionsBefore?: string[];
  permissionsAfter?: string[];
  serviceStackBefore?: string[];
  serviceStackAfter?: string[];
  safetyStatus: CatalogPreviewSafetyStatus;
  reasons: string[];
  evidence: string[];
}

export interface CatalogPreviewReview {
  id: string;
  source: "generated-artifact" | "on-demand";
  artifactPath?: string;
  deterministic: boolean;
  runtimeEnabled: false;
  catalogMutated: false;
  capabilityCount: number;
  certifiedCapabilityCount: number;
  blockedCapabilityCount: number;
  diffSummary: CatalogPreviewDiffSummary;
  safetySummary: CatalogPreviewSafetySummary;
  serviceStackImpact: Array<{
    capabilityId: string;
    catalogId: string;
    operation: CatalogPreviewOperation;
    category: string;
    signals: string[];
  }>;
  reviewRequired: boolean;
  diffItems: CatalogPreviewDiffItem[];
  artifacts: Array<{
    capabilityId: string;
    operation: CatalogPreviewOperation;
    path?: string;
    hash?: string;
    enabledByDefault: false;
  }>;
}

export interface CatalogPromotionRequestDraft {
  id: string;
  previewId: string;
  status: "draft";
  runtimeEnabled: false;
  catalogMutated: false;
  summary: string;
  diffItems: CatalogPreviewDiffItem[];
  requiredReview: string[];
  blockedItems: CatalogPreviewDiffItem[];
  generatedArtifacts: string[];
  redactionNote: string;
  runtimeMutationNote: string;
  manualNextSteps: string[];
}

export async function fetchCapabilityCatalogPreview(token: string): Promise<CatalogPreviewReview> {
  const response = await fetch("/api/capabilities/catalog-preview", {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (response.status === 403) throw new Error("Capability Catalog Preview requires an admin token.");
  const body = await readJsonOrThrow<{ preview: CatalogPreviewReview }>(response, "Fetch catalog preview failed");
  return body.preview;
}

export async function fetchCapabilityCatalogPreviewDiff(token: string): Promise<{
  previewId: string;
  diffSummary: CatalogPreviewDiffSummary;
  safetySummary: CatalogPreviewSafetySummary;
  diffItems: CatalogPreviewDiffItem[];
}> {
  const response = await fetch("/api/capabilities/catalog-preview/diff", {
    headers: { Authorization: `Bearer ${token}` }
  });
  return readJsonOrThrow(response, "Fetch catalog preview diff failed");
}

export async function fetchCapabilityCatalogPreviewArtifact(token: string): Promise<{
  previewId: string;
  deterministic: boolean;
  runtimeEnabled: false;
  catalogMutated: false;
  artifacts: CatalogPreviewReview["artifacts"];
}> {
  const response = await fetch("/api/capabilities/catalog-preview/artifact", {
    headers: { Authorization: `Bearer ${token}` }
  });
  return readJsonOrThrow(response, "Fetch catalog preview artifact failed");
}

export async function createCapabilityCatalogPromotionRequest(token: string): Promise<CatalogPromotionRequestDraft> {
  const response = await fetch("/api/capabilities/catalog-preview/promotion-request", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });
  const body = await readJsonOrThrow<{ draft: CatalogPromotionRequestDraft }>(response, "Create promotion request draft failed");
  return body.draft;
}

/**
 * Admin-only: fetch every catalog item (certified + not-ready) for
 * display in the registry. End-user Build code MUST NOT call this.
 */
export async function fetchCatalogAdminAll(token: string): Promise<{ items: CatalogItem[]; meta: CatalogResponseMeta }> {
  const response = await fetch("/api/catalog?include=all", {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error(`Admin catalog failed: ${response.status}`);
  return response.json();
}

export interface BuildSuggestion {
  id: string;
  capabilityId: string;
  capabilityKey?: string;
  name: string;
  reason: string;
  evidence: string[];
  riskLevel: "safe" | "review" | "privileged" | "dangerous";
  certified: true;
  canAddToPlan: boolean;
  requiresManualSteps: boolean;
  touchesData: boolean;
  touchesSecrets: boolean;
  actions: Array<"accept" | "dismiss" | "snooze" | "view-reasoning">;
}

/**
 * Build suggestions for a target. Returns a list of CERTIFIED
 * capabilities the planner recommends adding to the next Rebuild Plan
 * given the target's snapshot evidence + current selection.
 *
 * The server-side filter MUST drop any not-ready capability before
 * returning. Admins fetching this endpoint receive the same
 * certified-only list — admin "improvement suggestions" for not-ready
 * items live in the Capability Rules Admin registry, not here.
 */
export async function fetchBuildSuggestions(token: string, targetId: string): Promise<BuildSuggestion[]> {
  const response = await fetch(`/api/build/${encodeURIComponent(targetId)}/suggestions`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error(`Suggestions failed: ${response.status}`);
  const body = (await response.json()) as { suggestions: BuildSuggestion[] };
  return body.suggestions;
}

// ── Admin Capability Workbench: Suggestion Inbox ─────────────────────────
//
// These helpers are consumed by Capability Admin → Suggestion Inbox.
// They reuse the existing /api/admin/suggestions endpoints and require
// an admin bearer token; the server returns 403 for non-admins.

export interface AdminSuggestionRecord {
  id: string;
  catalogId: string | null;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  type: string;
  nameZh: string;
  nameEn: string;
  category: string | null;
  playbookYaml: string | null;
  guideMarkdown: string | null;
  remark: string | null;
  status: "pending" | "accepted" | "rejected" | string;
  feedback: string | null;
  processedBy: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function fetchAdminSuggestions(
  token: string,
  query: { status?: string; limit?: number; cursorCreatedAt?: string; cursorId?: string } = {}
): Promise<{ suggestions: AdminSuggestionRecord[]; nextCursor?: { createdAt: string; id: string } }> {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.limit) params.set("limit", String(query.limit));
  if (query.cursorCreatedAt) params.set("cursorCreatedAt", query.cursorCreatedAt);
  if (query.cursorId) params.set("cursorId", query.cursorId);
  const qs = params.toString();
  const url = qs ? `/api/admin/suggestions?${qs}` : "/api/admin/suggestions";
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 403) throw new Error("Admin only.");
  if (!response.ok) throw new Error(`Admin suggestions failed: ${response.status}`);
  return response.json();
}

export async function processAdminSuggestion(
  token: string,
  suggestionId: string,
  action: "accepted" | "rejected",
  feedback?: string
): Promise<{ success: true }> {
  const response = await fetch(`/api/admin/suggestions/${encodeURIComponent(suggestionId)}/process`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action, feedback })
  });
  if (response.status === 403) throw new Error("Admin only.");
  if (!response.ok) throw new Error(`Process suggestion failed: ${response.status}`);
  return response.json();
}

// ── Admin Capability Workbench: Package Integrations ─────────────────────
//
// Rule-level package-integration governance. NOT a host-level package
// manager. Lists each capability with the cross-distro package map,
// service map, binary detection, config paths, secret patterns,
// validate / rollback hooks, and data strategy that drive certification.

export interface PackageIntegrationRuleSummary {
  packageMap: Partial<Record<"apt" | "dnf" | "yum" | "pacman" | "apk", string[]>>;
  serviceMap: Partial<Record<"debian" | "rhel" | "fedora" | "arch" | "alpine", string[]>>;
  binaries: string[];
  systemd: string[];
  ports: number[];
  configFiles: string[];
  configGlobs: string[];
  secretPatterns: string[];
  dataPaths: string[];
  validate: string[];
  restartServices: string[];
  dataStrategy: "none" | "optional" | "recommended" | string;
  migrationStrategy?: string;
}

export interface PackageIntegrationRow {
  id: string;
  capabilityKey?: string;
  name: string;
  category: string;
  certification: CatalogItemCertification;
  hasRule: boolean;
  ruleSummary: PackageIntegrationRuleSummary | null;
}

export async function fetchPackageIntegrations(
  token: string
): Promise<{ items: PackageIntegrationRow[]; meta: { total: number; withRule: number; withoutRule: number } }> {
  const response = await fetch("/api/admin/package-integrations", {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (response.status === 403) throw new Error("Admin only.");
  if (!response.ok) throw new Error(`Package integrations failed: ${response.status}`);
  return response.json();
}

export interface PackageIntegrationDetail {
  id: string;
  capabilityKey?: string;
  name: string;
  category: string;
  certification: CatalogItemCertification;
  rule: unknown | null;
}

export async function fetchPackageIntegrationDetail(
  token: string,
  capabilityId: string
): Promise<PackageIntegrationDetail> {
  const response = await fetch(`/api/admin/package-integrations/${encodeURIComponent(capabilityId)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (response.status === 403) throw new Error("Admin only.");
  if (response.status === 404) throw new Error("Capability not found.");
  if (!response.ok) throw new Error(`Package integration detail failed: ${response.status}`);
  return response.json();
}

export interface CapabilityStandardSection {
  id: string;
  label: string;
  description: string;
  required: boolean;
  allowNotApplicable: boolean;
  severity: "required" | "critical" | "advisory";
  schema?: unknown;
}

export interface CapabilityStandardProfile {
  id: string;
  key: string;
  name: string;
  version: number;
  status: "draft" | "active" | "retired";
  description?: string;
  sections: CapabilityStandardSection[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface CapabilityRequirementSectionState {
  status: "pending" | "satisfied" | "notApplicable" | "blocked";
  notes?: string;
  evidence?: string[];
  notApplicableReason?: string;
}

export interface CapabilityRequirementDraft {
  id: string;
  capabilityId: string;
  profileId: string;
  draftVersion: number;
  status: "draft" | "submitted" | "published";
  sections: Record<string, CapabilityRequirementSectionState>;
  ruleOverlay?: unknown;
  note?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface CapabilityRequirementVersion {
  id: string;
  capabilityId: string;
  profileId: string;
  version: number;
  status: "published" | "superseded" | "rolled-back";
  sections: Record<string, CapabilityRequirementSectionState>;
  ruleOverlay?: unknown;
  certificationRunId?: string;
  rollbackOfVersionId?: string;
  publishedAt: string;
  publishedBy: string;
}

export interface CapabilityCertificationRun {
  id: string;
  capabilityId: string;
  profileId: string;
  draftId?: string;
  versionId?: string;
  status: "certified" | "not-ready";
  visibleToUsers: boolean;
  reasons: string[];
  missingSections: string[];
  sectionResults: Record<string, { ok: boolean; reason?: string }>;
  createdAt: string;
  createdBy: string;
}

export interface AdminAuditLogEntry {
  id: string;
  adminId: string;
  action: string;
  targetId: string;
  oldValue: string | null;
  newValue: string | null;
  feedback: string | null;
  timestamp: string;
}

export async function fetchCapabilityStandards(
  token: string
): Promise<{ profiles: CapabilityStandardProfile[]; activeProfileId: string }> {
  const response = await fetch("/api/admin/capability-standards", {
    headers: { Authorization: `Bearer ${token}` }
  });
  return readJsonOrThrow(response, "Fetch capability standards failed");
}

export async function createCapabilityStandard(
  token: string,
  input: {
    key: string;
    name: string;
    description?: string;
    sections: CapabilityStandardSection[];
  }
): Promise<{ profile: CapabilityStandardProfile }> {
  const response = await fetch("/api/admin/capability-standards", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return readJsonOrThrow(response, "Create capability standard failed");
}

export async function updateCapabilityStandard(
  token: string,
  profileId: string,
  input: {
    name?: string;
    description?: string;
    status?: "draft" | "active" | "retired";
    sections?: CapabilityStandardSection[];
  }
): Promise<{ profile: CapabilityStandardProfile }> {
  const response = await fetch(`/api/admin/capability-standards/${encodeURIComponent(profileId)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return readJsonOrThrow(response, "Update capability standard failed");
}

export async function cloneCapabilityStandard(
  token: string,
  profileId: string,
  input: {
    key?: string;
    name?: string;
    description?: string;
    status?: "draft" | "active";
  } = {}
): Promise<{ profile: CapabilityStandardProfile }> {
  const response = await fetch(`/api/admin/capability-standards/${encodeURIComponent(profileId)}/clone`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return readJsonOrThrow(response, "Clone capability standard failed");
}

export async function fetchCapabilityRequirements(
  token: string,
  capabilityId: string,
  options: { profileId?: string } = {}
): Promise<{
  item: { id: string; capabilityKey?: string; name: string; category: string };
  activeProfile: CapabilityStandardProfile;
  certification: CatalogItemCertification;
  draft: CapabilityRequirementDraft | null;
  currentVersion: CapabilityRequirementVersion | null;
  versions: CapabilityRequirementVersion[];
  latestRun: CapabilityCertificationRun | null;
  projectedSections: Record<string, CapabilityRequirementSectionState>;
}> {
  const query = options.profileId ? `?profileId=${encodeURIComponent(options.profileId)}` : "";
  const response = await fetch(`/api/admin/capabilities/${encodeURIComponent(capabilityId)}/requirements${query}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return readJsonOrThrow(response, "Fetch capability requirements failed");
}

export async function saveCapabilityRequirementDraft(
  token: string,
  capabilityId: string,
  input: {
    profileId?: string;
    sections?: Record<string, Partial<CapabilityRequirementSectionState>>;
    ruleOverlay?: unknown;
    note?: string;
  }
): Promise<{ draft: CapabilityRequirementDraft }> {
  const response = await fetch(`/api/admin/capabilities/${encodeURIComponent(capabilityId)}/requirements/draft`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return readJsonOrThrow(response, "Save requirement draft failed");
}

export async function simulateCapabilityRequirementCertification(
  token: string,
  capabilityId: string,
  input: {
    profileId?: string;
    draftId?: string;
    sections?: Record<string, Partial<CapabilityRequirementSectionState>>;
  }
): Promise<{ run: CapabilityCertificationRun }> {
  const response = await fetch(`/api/admin/capabilities/${encodeURIComponent(capabilityId)}/certification/simulate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return readJsonOrThrow(response, "Simulate requirement certification failed");
}

export async function publishCapabilityRequirementDraft(
  token: string,
  capabilityId: string,
  input: { profileId?: string; draftId?: string; note?: string }
): Promise<{ version: CapabilityRequirementVersion; run: CapabilityCertificationRun }> {
  const response = await fetch(`/api/admin/capabilities/${encodeURIComponent(capabilityId)}/requirements/publish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return readJsonOrThrow(response, "Publish requirement draft failed");
}

export async function rollbackCapabilityRequirementVersion(
  token: string,
  capabilityId: string,
  input: { profileId?: string; versionId: string; note?: string }
): Promise<{ version: CapabilityRequirementVersion }> {
  const response = await fetch(`/api/admin/capabilities/${encodeURIComponent(capabilityId)}/rollback-version`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return readJsonOrThrow(response, "Rollback requirement version failed");
}

export async function fetchCapabilityCertificationRuns(
  token: string,
  capabilityId: string,
  options: { profileId?: string; limit?: number } = {}
): Promise<{ runs: CapabilityCertificationRun[] }> {
  const params = new URLSearchParams();
  if (options.profileId) params.set("profileId", options.profileId);
  if (options.limit) params.set("limit", String(options.limit));
  const query = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`/api/admin/capabilities/${encodeURIComponent(capabilityId)}/certification/runs${query}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return readJsonOrThrow(response, "Fetch certification runs failed");
}

export async function fetchCapabilityAuditLog(
  token: string,
  options: { targetId?: string; action?: string; limit?: number } = {}
): Promise<{ entries: AdminAuditLogEntry[] }> {
  const params = new URLSearchParams();
  if (options.targetId) params.set("targetId", options.targetId);
  if (options.action) params.set("action", options.action);
  if (options.limit) params.set("limit", String(options.limit));
  const query = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`/api/admin/capability-audit-log${query}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return readJsonOrThrow(response, "Fetch capability audit log failed");
}

export interface CapabilityWorkflowUser {
  id: string;
  name: string;
  role: "maintainer" | "reviewer" | "admin" | string;
  assignedCapabilities: string[];
  openSuggestions: number;
  openBacklogItems: number;
  reviewLoad: number;
  lastActive: string;
}

export interface CapabilityWorkflowQueue {
  id: string;
  name: string;
  type: "Suggestion Triage" | "Certification Review" | "Rule Upgrade" | "Package Integration Fix" | "Combo Adjustment" | "Harness Missing" | "Security Approval Design" | string;
  openItems: number;
  priority: "P0" | "P1" | "P2" | string;
  oldestItem: string | null;
  ownerGroup: string;
  status: "open" | "paused" | "archived" | string;
  nextAction: string;
}

export async function fetchCapabilityWorkflowUsers(token: string): Promise<{ users: CapabilityWorkflowUser[] }> {
  const response = await fetch("/api/admin/capability-users", {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (response.status === 403) throw new Error("Admin only.");
  if (!response.ok) throw new Error(`Capability users failed: ${response.status}`);
  return response.json();
}

export async function fetchCapabilityWorkflowQueues(token: string): Promise<{ queues: CapabilityWorkflowQueue[] }> {
  const response = await fetch("/api/admin/capability-queues", {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (response.status === 403) throw new Error("Admin only.");
  if (!response.ok) throw new Error(`Capability queues failed: ${response.status}`);
  return response.json();
}

export async function fetchCatalogGuide(id: string): Promise<CatalogGuide> {
  const response = await fetch(`/api/catalog/${encodeURIComponent(id)}/guide`);
  if (!response.ok) {
    throw new Error(`Catalog guide failed: ${response.status}`);
  }

  return response.json() as Promise<CatalogGuide>;
}

export async function fetchMigrationStrategies(): Promise<MigrationStrategy[]> {
  const response = await fetch("/api/migration/strategies");
  if (!response.ok) {
    throw new Error(`Migration strategies failed: ${response.status}`);
  }

  const body = (await response.json()) as { strategies: MigrationStrategy[] };
  return body.strategies;
}

export async function fetchCurrentUser(token?: string): Promise<CurrentUser> {
  const response = await fetch("/api/me", {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });
  if (!response.ok) {
    throw new Error(`Current user failed: ${response.status}`);
  }

  const body = (await response.json()) as CurrentUser | MeFullResponse;
  if ("user" in body) {
    return {
      id: body.user.id,
      name: body.user.name,
      nameEn: body.user.displayName || body.user.name,
      authenticated: true,
      uploadedProfiles: []
    };
  }
  return body;
}

export async function registerAccount(input: { name: string; email: string; password: string }): Promise<AuthResponse> {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return readJsonOrThrow<AuthResponse>(response, "Registration failed");
}

/** P1.5 step-1 — submit name/email/password, get pendingId + emailed code. */
export async function startRegistration(input: { name: string; email: string; password: string }): Promise<RegisterStartResponse> {
  const response = await fetch("/api/auth/register/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return readJsonOrThrow<RegisterStartResponse>(response, "Registration failed");
}

/** P1.5 step-2 — submit pendingId + 6-digit code, completes account creation. */
export async function verifyRegistration(input: { pendingId: string; code: string }): Promise<AuthResponse> {
  const response = await fetch("/api/auth/register/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return readJsonOrThrow<AuthResponse>(response, "Verification failed");
}

export async function loginAccount(input: { email: string; password: string }): Promise<LoginResponse> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return readJsonOrThrow<LoginResponse>(response, "Login failed");
}

/** P1.10 — submit TOTP / recovery code to upgrade a 2fa-pending session. */
export async function loginVerify2FA(input: { intermediateToken: string; code: string }): Promise<{
  token: string;
  expiresAt: string;
  user: AuthUser;
  usedRecoveryCode?: boolean;
  recoveryCodesRemaining?: number;
}> {
  const response = await fetch("/api/auth/login/2fa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return readJsonOrThrow(response, "2FA verification failed");
}

export async function connectServer(input: {
  token: string;
  method: ConnectionMethod;
  label?: string;
  fields: Record<string, string>;
  agentUrl?: string;
  keyId?: string;
}): Promise<ConnectionResponse> {
  const response = await fetch("/api/connections/connect", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${input.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      method: input.method,
      label: input.label,
      fields: input.fields,
      agentUrl: input.agentUrl,
      keyId: input.keyId
    })
  });
  return readJsonOrThrow<ConnectionResponse>(response, "Connection failed");
}

export async function updateProfile(input: {
  token: string;
  name: string;
  defaultSshUser: string;
}): Promise<AuthUser> {
  const response = await fetch("/api/auth/profile", {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${input.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: input.name,
      defaultSshUser: input.defaultSshUser
    })
  });
  const body = await readJsonOrThrow<{ user: AuthUser }>(response, "Profile update failed");
  return body.user;
}

// ── auth-and-ecosystem spec P1.7–P1.12 client helpers ─────────────────────

/** Provider availability — drives whether to render the GitHub button. */
export async function fetchAuthProviders(): Promise<{ github: boolean; google: boolean }> {
  const r = await fetch("/api/auth/providers");
  return readJsonOrThrow(r, "Provider lookup failed");
}

/** Full account snapshot: user + identities + 2FA + notification prefs + activity. */
export async function fetchMeFull(token: string): Promise<MeFullResponse> {
  const r = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
  return readJsonOrThrow<MeFullResponse>(r, "Failed to load account");
}

/** P1.11 — patch any subset of profile fields. */
export async function patchProfile(token: string, input: Partial<{
  displayName: string;
  bio: string;
  avatarUrl: string;
  timezone: string;
  locale: string;
  username: string;
  defaultSshUser: string;
}>): Promise<AuthUser> {
  const r = await fetch("/api/me", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const body = await readJsonOrThrow<{ user: AuthUser }>(r, "Profile update failed");
  return body.user;
}

// ── Email change ──
export async function requestEmailChange(token: string, newEmail: string): Promise<{ pendingId: string; message: string; devCode?: string }> {
  const r = await fetch("/api/me/email-change/request", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ newEmail })
  });
  return readJsonOrThrow(r, "Email change request failed");
}

export async function confirmEmailChange(token: string, input: { pendingId: string; code: string }): Promise<{ email: string; emailVerifiedAt: string }> {
  const r = await fetch("/api/me/email-change/confirm", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return readJsonOrThrow(r, "Email change confirm failed");
}

// ── Password change / soft-delete ──
export async function changePassword(token: string, input: {
  oldPassword?: string;
  newPassword: string;
  currentTotpCode?: string;
}): Promise<{ ok: true }> {
  const r = await fetch("/api/me/password", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return readJsonOrThrow(r, "Password change failed");
}

export async function deleteAccount(token: string, input: {
  password?: string;
  currentTotpCode?: string;
}): Promise<{ ok: true; deletedAt: string }> {
  const r = await fetch("/api/me", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return readJsonOrThrow(r, "Account deletion failed");
}

// ── Identities (link/unlink) ──
export async function fetchIdentities(token: string): Promise<{ identities: IdentityEntry[] }> {
  const r = await fetch("/api/me/identities", { headers: { Authorization: `Bearer ${token}` } });
  return readJsonOrThrow(r, "Identity list failed");
}

export async function startGitHubLink(token: string, redirectTo?: string): Promise<{ authorizeUrl: string }> {
  const r = await fetch("/api/me/identities/github/connect", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ redirectTo: redirectTo ?? "/account/identities" })
  });
  return readJsonOrThrow(r, "GitHub link failed");
}

export async function startGoogleLink(token: string, redirectTo?: string): Promise<{ authorizeUrl: string }> {
  const r = await fetch("/api/me/identities/google/connect", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ redirectTo: redirectTo ?? "/account/identities" })
  });
  return readJsonOrThrow(r, "Google link failed");
}

export async function unlinkIdentity(token: string, provider: "github" | "google"): Promise<{ ok: true }> {
  const r = await fetch(`/api/me/identities/${provider}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });
  return readJsonOrThrow(r, "Unlink failed");
}

// ── 2FA / TOTP ──
export async function fetchTwoFactorStatus(token: string): Promise<TwoFactorStatus> {
  const r = await fetch("/api/me/2fa/status", { headers: { Authorization: `Bearer ${token}` } });
  return readJsonOrThrow(r, "2FA status failed");
}

export async function startTwoFactorEnroll(token: string): Promise<{ secret: string; otpauthUri: string; qrDataUrl: string }> {
  const r = await fetch("/api/me/2fa/enroll", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });
  return readJsonOrThrow(r, "2FA enroll failed");
}

export async function confirmTwoFactorEnroll(token: string, code: string): Promise<{
  recoveryCodes: string[];
  /** Set when the confirm came from an enrollment-required session (P1.10). */
  sessionToken?: string;
  sessionExpiresAt?: string;
}> {
  const r = await fetch("/api/me/2fa/confirm", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ code })
  });
  return readJsonOrThrow(r, "2FA confirm failed");
}

export async function disableTwoFactor(token: string, input: { password?: string; code?: string }): Promise<{ ok: true }> {
  const r = await fetch("/api/me/2fa/disable", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return readJsonOrThrow(r, "2FA disable failed");
}

export async function regenerateRecoveryCodes(token: string): Promise<{ recoveryCodes: string[] }> {
  const r = await fetch("/api/me/2fa/regenerate-recovery", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });
  return readJsonOrThrow(r, "Regenerate failed");
}

// ── Notification prefs ──
export async function fetchNotificationPrefs(token: string): Promise<NotificationPrefs> {
  const r = await fetch("/api/me/notification-prefs", { headers: { Authorization: `Bearer ${token}` } });
  return readJsonOrThrow(r, "Notification prefs failed");
}

export async function updateNotificationPrefs(token: string, patch: Partial<Omit<NotificationPrefs, "userId" | "updatedAt">>): Promise<NotificationPrefs> {
  const r = await fetch("/api/me/notification-prefs", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(patch)
  });
  return readJsonOrThrow(r, "Notification prefs failed");
}

// ── Password reset (anonymous endpoints) ──
export async function sendNotificationTest(token: string): Promise<{ ok: boolean; inboxQueued: boolean; emailQueued: boolean; emailEnabled: boolean }> {
  const r = await fetch("/api/me/notification-prefs/test", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });
  return readJsonOrThrow(r, "Notification test failed");
}

export async function requestPasswordReset(email: string): Promise<{ message: string; devResetUrl?: string }> {
  const r = await fetch("/api/auth/password-reset/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });
  return readJsonOrThrow(r, "Password reset request failed");
}

export async function confirmPasswordReset(input: { token: string; newPassword: string }): Promise<{ email: string; sessionsRevoked: number }> {
  const r = await fetch("/api/auth/password-reset/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return readJsonOrThrow(r, "Password reset failed");
}

async function readJsonOrThrow<T>(response: Response, fallback: string): Promise<T> {
  const body = (await response.json()) as T | { error?: string };
  if (!response.ok) {
    const errorBody = body as { error?: string };
    throw new Error(errorBody.error ? errorBody.error : `${fallback}: ${response.status}`);
  }
  return body as T;
}

export async function probeAgent(agentUrl: string): Promise<ProbeResult> {
  const response = await fetch("/api/targets/probe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentUrl })
  });
  const body = (await response.json()) as ProbeResult;
  return body;
}

export async function pingAgent(agentUrl: string): Promise<boolean> {
  const response = await fetch("/api/targets/ping", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentUrl })
  });
  if (!response.ok) return false;
  const body = (await response.json()) as { online: boolean };
  return body.online;
}

export async function reprobeConnection(token: string, connectionId: string): Promise<ConnectionProfile> {
  const response = await fetch(`/api/connections/${encodeURIComponent(connectionId)}/reprobe`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  const body = await readJsonOrThrow<{ connection: ConnectionProfile }>(response, "Reprobe failed");
  return body.connection;
}

export async function fetchConnections(token: string): Promise<ConnectionProfile[]> {
  const response = await fetch("/api/connections", {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const body = await readJsonOrThrow<{ connections: ConnectionProfile[] }>(response, "Fetch connections failed");
  return body.connections;
}

export async function deleteConnection(token: string, id: string): Promise<void> {
  const response = await fetch(`/api/connections/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${token}` }
  });
  await readJsonOrThrow<{ ok: boolean }>(response, "Delete connection failed");
}

export async function updateConnection(token: string, id: string, input: { label?: string; agentUrl?: string; tags?: string[] }): Promise<ConnectionProfile> {
  const response = await fetch(`/api/connections/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const body = await readJsonOrThrow<{ connection: ConnectionProfile }>(response, "Update connection failed");
  return body.connection;
}

// ── 用户配置组合 ──────────────────────────────────────────

export async function fetchProfiles(token: string): Promise<UserProfile[]> {
  const response = await fetch("/api/profiles", {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const body = await readJsonOrThrow<{ profiles: UserProfile[] }>(response, "Fetch profiles failed");
  return body.profiles;
}

export async function createProfile(token: string, input: CreateProfileInput): Promise<UserProfile> {
  const response = await fetch("/api/profiles", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const body = await readJsonOrThrow<{ profile: UserProfile }>(response, "Create profile failed");
  return body.profile;
}

export async function updateProfileData(token: string, id: string, input: Partial<CreateProfileInput>): Promise<UserProfile> {
  const response = await fetch(`/api/profiles/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const body = await readJsonOrThrow<{ profile: UserProfile }>(response, "Update profile failed");
  return body.profile;
}

export async function deleteProfile(token: string, id: string): Promise<void> {
  const response = await fetch(`/api/profiles/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${token}` }
  });
  await readJsonOrThrow<{ ok: boolean }>(response, "Delete profile failed");
}

export async function uploadVmSnapshot(token: string, connectionId: string, input: UploadSnapshotInput): Promise<UserProfile> {
  const response = await fetch(`/api/connections/${encodeURIComponent(connectionId)}/upload-snapshot`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const body = await readJsonOrThrow<{ profile: UserProfile }>(response, "Upload snapshot failed");
  return body.profile;
}

// ── 任务执行 ──────────────────────────────────────────────

export interface TaskStep {
  id: string;
  label: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  status: "pending" | "running" | "succeeded" | "failed" | "skipped";
  durationMs: number;
  /** 关联到 batch task 的第几个 item */
  itemIndex?: number;
}

export interface BatchItem {
  index: number;
  catalogId: string;
  displayName: string;
  status: "pending" | "running" | "succeeded" | "failed" | "skipped";
  error?: string;
}

export interface ExecutionTask {
  id: string;
  userId: string;
  connectionId: string;
  profileId: string;
  kind: "install-software" | "apply-combo" | "deploy-snapshot" | "batch-install";
  status: "queued" | "pending" | "running" | "succeeded" | "failed" | "cancelled";
  /** Number of tasks ahead of this one in the per-connection queue. Only set when status="queued". */
  queuePosition?: number;
  steps: TaskStep[];
  /** 仅 batch-install 任务才有 */
  items?: BatchItem[];
  dryRun: boolean;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

/** @deprecated Direct catalog/profile execution is legacy-only. Use createEnvironmentPlan/applyEnvironmentPlan. */
export async function executeProfile(
  token: string,
  connectionId: string,
  profileId: string,
  dryRun = true,
  /** Optional form values for configurable Playbooks (vars.schema.json) */
  vars?: Record<string, unknown>
): Promise<{ taskId: string; steps: TaskStep[]; fieldErrors?: Record<string, string> }> {
  void token;
  void connectionId;
  void profileId;
  void dryRun;
  void vars;
  throw new Error("Legacy direct execute is disabled. Create an Environment Plan and apply it after review.");
}

// ─── Vars schema (configurable Playbooks) ────────────────────────────────

export type VarsSchemaField =
  | { type: "string"; label: string; labelEn?: string; help?: string; helpEn?: string;
      default?: string; required?: boolean; validate?: string; placeholder?: string; show_when?: string; }
  | { type: "number"; label: string; labelEn?: string; help?: string; helpEn?: string;
      default?: number; required?: boolean; min?: number; max?: number; step?: number; show_when?: string; }
  | { type: "boolean"; label: string; labelEn?: string; help?: string; helpEn?: string;
      default: boolean; required?: boolean; show_when?: string; }
  | { type: "choice"; label: string; labelEn?: string; help?: string; helpEn?: string;
      default?: string; required?: boolean; options: Array<{ value: string; label: string; labelEn?: string }>; show_when?: string; }
  | { type: "password"; label: string; labelEn?: string; help?: string; helpEn?: string;
      generate_length?: number; reveal_after_run?: boolean; required?: boolean; validate?: string; show_when?: string; }
  | { type: "port"; label: string; labelEn?: string; help?: string; helpEn?: string;
      default?: number; required?: boolean; show_when?: string; };

export type VarsSchema = Record<string, VarsSchemaField>;

/**
 * Fetch a Playbook's vars schema. Returns null when the Playbook has no schema
 * (caller should fall back to the simple "run with defaults" button).
 */
export async function fetchVarsSchema(id: string): Promise<VarsSchema | null> {
  const response = await fetch(`/api/catalog/${encodeURIComponent(id)}/vars-schema`);
  if (!response.ok) return null;
  const data = await response.json().catch(() => ({}));
  return (data?.schema ?? null) as VarsSchema | null;
}

// ─── Pre-apply preview ───────────────────────────────────────────────────

/** 单个任务的预览信息（与后端 PreviewTask 对应） */
export interface PreviewTask {
  name: string;
  module: string;
  resolvedArgs: Record<string, unknown>;
  willSkip: boolean;
  skipReason?: string;
  summary: string;
  effectKind: "install" | "config" | "service" | "command" | "filesystem" | "user" | "other";
}

/** 会被写入或修改的远端文件 */
export interface PreviewFile {
  path: string;
  via: string;
  contentPreview?: string;
  totalLines?: number;
  action: "create-or-replace" | "edit-line" | "delete";
}

/** 预览整体响应 */
export interface PlaybookPreview {
  renderedYaml: string;
  effectiveVars: Record<string, unknown>;
  hiddenVars: string[];
  tasks: PreviewTask[];
  files: PreviewFile[];
  impact: { disk?: string; time?: string; sudo?: boolean; risk?: "low" | "medium" | "high"; [key: string]: unknown };
  verifyChecks?: Array<{ name: string; cmd: string }>;
}

/**
 * 请求 catalog 项的执行预览。submittedVars 会经过后端 schema 校验；校验失败时返回
 * { fieldErrors }，供 UI 直接绑回表单字段。
 */
export async function fetchPlaybookPreview(
  token: string,
  catalogId: string,
  vars: Record<string, unknown>
): Promise<{ preview: PlaybookPreview } | { error: string; fieldErrors?: Record<string, string> }> {
  const response = await fetch(`/api/catalog/${encodeURIComponent(catalogId)}/preview`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ vars })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      error: (data as { error?: string })?.error ?? `Preview failed (${response.status})`,
      fieldErrors: (data as { fieldErrors?: Record<string, string> })?.fieldErrors
    };
  }
  return data as { preview: PlaybookPreview };
}

/** @deprecated Batch execution is legacy-only. Use createEnvironmentPlan with source.kind="capability-selection". */
export async function batchExecute(
  token: string,
  connectionId: string,
  catalogIds: string[],
  dryRun = true
): Promise<{ taskId: string; totalItems: number; items: BatchItem[]; plan?: EnvironmentPlan; planType?: "rebuild" }> {
  void token;
  void connectionId;
  void catalogIds;
  void dryRun;
  throw new Error("Legacy batch execute is disabled. Generate a Rebuild Plan from selected capabilities.");
}

export type EnvironmentPlanType = "migration" | "rebuild" | "change" | "remove" | "repair" | "imported-recipe";
export type EnvironmentPlanStatus =
  | "draft"
  | "needs-review"
  | "approved"
  | "applying"
  | "verifying"
  | "succeeded"
  | "partially-succeeded"
  | "failed"
  | "rolled-back"
  | "committed";
export interface EnvironmentPlanAction {
  id: string;
  kind: string;
  label: string;
  command?: string;
  packageNames?: string[];
  path?: string;
  serviceName?: string;
  requiresSudo: boolean;
  changesTarget: boolean;
  canRollback: boolean;
  risk: "safe" | "review" | "privileged" | "dangerous" | "low" | "medium" | "high";
  applySpec?: { command?: string; path?: string; requiresSudo?: boolean; retries?: number; artifactId?: string };
  verify?: string;
  rollback?: string;
  notes?: string[];
}
export interface EnvironmentPlanItem {
  id: string;
  name: string;
  type: string;
  sourceId?: string;
  confidence?: number;
  supportLevel?: CatalogItem["supportLevel"];
  risks: string[];
  evidence: string[];
  actions: EnvironmentPlanAction[];
  userDecision: "pending" | "approved" | "skipped";
  capabilityKey?: string;
  audit?: {
    supportLevel?: CatalogItem["supportLevel"];
    remainingRisks?: string[];
    capabilityKey?: string;
    reviewerNotes?: string;
  };
  requiredApprovals?: PlanRequiredApproval[];
}

/**
 * Approval gate kinds — match the server-side `PlanApprovalKind` enum.
 */
export type PlanApprovalKind =
  | "secret-confirm"
  | "data-strategy-confirm"
  | "ssh-lockout-confirm"
  | "firewall-lockout-confirm"
  | "identity-provider-confirm"
  | "backup-restore-confirm"
  | "manual-dns-confirm"
  | "target-conflict-confirm"
  | "partial-snapshot-confirm"
  | "high-risk-command-confirm";

export interface PlanRequiredApproval {
  id: string;
  kind: PlanApprovalKind;
  itemId: string;
  label: string;
  prompt: string;
}

export interface PlanReviewConflict {
  id: string;
  type: string;
  severity: "block" | "warn";
  reason: string;
  capabilityKeys: string[];
  participatingItemIds: string[];
  resolutionOptions: Array<{
    id: string;
    label: string;
    keepCapabilityKeys?: string[];
    removeCapabilityKeys?: string[];
  }>;
}

export interface PlanApprovalState {
  risks?: Record<string, string[]>;
  conflicts?: Array<{ conflictId: string; resolutionId?: string; ackedAt: string }>;
  approvals?: Array<{ itemId: string; gateId: string; ackedAt: string }>;
}

export interface EnvironmentPlanArtifact {
  id: string;
  kind: "config" | "recipe" | "data-manifest" | "script" | "report";
  contentSha256: string;
  canonicalJsonSha256?: string;
  storageRef: string;
  createdAt: string;
  redactedPreview?: string;
}

export interface PlanApprovalRecord {
  planHash: string;
  approvedBy: string;
  approvedAt: string;
  acceptedRisks: string[];
  acceptedConflicts: string[];
  confirmedGates: string[];
}

export interface EnvironmentPlan {
  id: string;
  type: EnvironmentPlanType;
  status?: EnvironmentPlanStatus;
  name: string;
  sourceHost?: string;
  targetConnectionId?: string;
  generatedAt: string;
  immutable?: true;
  planHash?: string;
  artifacts?: EnvironmentPlanArtifact[];
  approvedPlanHash?: string;
  approvedAt?: string;
  approvedBy?: string;
  approvalRecord?: PlanApprovalRecord;
  summary: {
    totalItems: number;
    totalActions: number;
    highRisk: number;
    requiresSudo: number;
    rollbackable: number;
    dataPreservedByDefault?: boolean;
  };
  review: {
    required: boolean;
    reasons: string[];
    conflicts?: PlanReviewConflict[];
    approvalsRequired?: PlanRequiredApproval[];
    snapshotCompleteness?: number;
    partialSnapshot?: boolean;
  };
  approvals?: PlanApprovalState;
  items: EnvironmentPlanItem[];
  export?: { yaml?: string; markdown?: string };
}

export interface CreateEnvironmentPlanInput {
  type: EnvironmentPlanType;
  source:
    | { kind: "capability-selection"; capabilityIds: string[] }
    | { kind: "recipe"; yaml: string; name?: string }
    | { kind: "remove-request"; packages: string[]; source?: string; managedByEnvForge?: boolean; preserveData?: boolean }
    | { kind: "config-change"; path: string; content: string }
    | { kind: "repair-failures"; failures: RepairFailureInput[]; name?: string; sourcePlanId?: string };
  targetConnectionId?: string;
  sourceConnectionId?: string;
}

/**
 * Repair failure descriptor accepted by `/api/plans` when
 * `source.kind="repair-failures"`. Mirrors `RepairFailure` on the server.
 */
export interface RepairFailureInput {
  label: string;
  kind?: "service-down" | "config-modified" | "package-missing" | "verify-failed" | "custom";
  serviceName?: string;
  path?: string;
  packageNames?: string[];
  validateCommand?: string;
  repairCommand?: string;
  severity?: "low" | "medium" | "high";
  evidence?: string[];
}

export async function createEnvironmentPlan(token: string, input: CreateEnvironmentPlanInput): Promise<{ plan: EnvironmentPlan }> {
  const response = await fetch("/api/plans", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return readJsonOrThrow(response, "Create Environment Plan failed");
}

/**
 * Phase 3 — promote a migration session into a first-class Environment Plan so
 * review / apply / verify / report run through the unified engine + Plan center.
 */
export async function createPlanFromMigrationSession(
  token: string,
  sessionId: string,
  targetConnectionId: string
): Promise<{ plan: EnvironmentPlan }> {
  const response = await fetch("/api/plans", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "migration", targetConnectionId, source: { kind: "migration-session", sessionId } })
  });
  return readJsonOrThrow(response, "Create migration plan failed");
}

export async function reviewEnvironmentPlan(
  token: string,
  planId: string,
  options: {
    decision?: "approved" | "rejected";
    note?: string;
    acknowledgedRisks?: Array<{ itemId: string; risks: string[] }>;
    acknowledgedConflicts?: Array<{ conflictId: string; resolutionId?: string }>;
    acknowledgedApprovals?: Array<{ itemId: string; gateId: string }>;
  } = {}
): Promise<{ plan: EnvironmentPlan }> {
  const response = await fetch(`/api/plans/${encodeURIComponent(planId)}/review`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ decision: options.decision ?? "approved", note: options.note, ...options })
  });
  return readJsonOrThrow(response, "Review Environment Plan failed");
}

export interface ApplyGateRefusal {
  blockingConflicts: PlanReviewConflict[];
  unresolvedWarnConflicts: PlanReviewConflict[];
  missingRiskAcks: Array<{ itemId: string; risks: string[] }>;
  missingApprovalGates: PlanRequiredApproval[];
  reasons: string[];
}

export async function applyEnvironmentPlan(
  token: string,
  planId: string,
  dryRunOrOptions: boolean | { dryRun?: boolean; targetConnectionId?: string; idempotencyKey?: string }
): Promise<{ dryRun: boolean; plan: EnvironmentPlan; execution: { ok: boolean; planId: string; planHash: string; actionRuns: Array<{ id: string; planId: string; planHash: string; actionId: string; status: string; dryRun: boolean }> } }> {
  const options = typeof dryRunOrOptions === "boolean" ? { dryRun: dryRunOrOptions } : dryRunOrOptions;
  const payload = Object.fromEntries(
    Object.entries({
      dryRun: options.dryRun,
      targetConnectionId: options.targetConnectionId,
      idempotencyKey: options.idempotencyKey
    }).filter(([, value]) => value !== undefined)
  );
  const response = await fetch(`/api/plans/${encodeURIComponent(planId)}/apply`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return readJsonOrThrow(response, "Apply Environment Plan failed");
}

/**
 * Per-action verify result returned by /api/plans/:id/verify.
 */
export interface PlanVerifyResult {
  actionId: string;
  label: string;
  status: "passed" | "warning" | "failed" | "skipped";
  message?: string;
  output?: string;
  ranAt: string;
}

export interface PlanRollbackResult {
  actionId: string;
  label: string;
  status: "passed" | "failed" | "skipped";
  message?: string;
  output?: string;
  ranAt: string;
}

export interface PlanHistoryEvent {
  at: string;
  event: "created" | "reviewed" | "applied" | "verified" | "rolled-back" | "imported";
  actor: string;
  note?: string;
}

export interface PlanListEntry {
  id: string;
  type: EnvironmentPlanType;
  status: EnvironmentPlan["status"];
  name: string;
  sourceHost?: string;
  targetConnectionId?: string;
  planHash?: string;
  approvedPlanHash?: string;
  artifactCount: number;
  lastDryRunAt?: string;
  lastDryRunResult?: PlanDryRunResult;
  createdAt: string;
  updatedAt: string;
  verifyResults: PlanVerifyResult[];
  rollbackResults: PlanRollbackResult[];
}

export interface PlanDryRunResult {
  ok: boolean;
  planHash: string;
  actionRunIds: string[];
  completedAt: string;
}

export interface PlanActionRunRecord {
  id: string;
  planId: string;
  planHash: string;
  itemId: string;
  actionId: string;
  targetConnectionId: string;
  dryRun: boolean;
  status: string;
  startedAt: string;
  endedAt?: string;
  exitCode?: number;
  commandSummaries: Array<{ phase: "snapshot" | "apply" | "verify" | "rollback"; command: string }>;
  error?: string;
}

export async function listEnvironmentPlans(
  token: string,
  filter?: { type?: EnvironmentPlanType; status?: EnvironmentPlan["status"]; targetConnectionId?: string }
): Promise<PlanListEntry[]> {
  const params = new URLSearchParams();
  if (filter?.type) params.set("type", filter.type);
  if (filter?.status) params.set("status", filter.status);
  if (filter?.targetConnectionId) params.set("targetConnectionId", filter.targetConnectionId);
  const url = params.toString() ? `/api/plans?${params.toString()}` : "/api/plans";
  const response = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
  const body = await readJsonOrThrow<{ plans: PlanListEntry[] }>(response, "List Environment Plans failed");
  return body.plans;
}

export async function fetchEnvironmentPlan(token: string, id: string): Promise<{
  plan: EnvironmentPlan;
  lastDryRunAt?: string;
  lastDryRunResult?: PlanDryRunResult;
  actionRuns: PlanActionRunRecord[];
  verifyResults: PlanVerifyResult[];
  rollbackResults: PlanRollbackResult[];
  history: PlanHistoryEvent[];
}> {
  const response = await fetch(`/api/plans/${encodeURIComponent(id)}`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  return readJsonOrThrow(response, "Fetch Environment Plan failed");
}

export async function verifyEnvironmentPlan(token: string, id: string): Promise<{ plan: EnvironmentPlan; results: PlanVerifyResult[] }> {
  const response = await fetch(`/api/plans/${encodeURIComponent(id)}/verify`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` }
  });
  return readJsonOrThrow(response, "Verify Environment Plan failed");
}

export async function rollbackEnvironmentPlan(token: string, id: string): Promise<{ plan: EnvironmentPlan; results: PlanRollbackResult[] }> {
  const response = await fetch(`/api/plans/${encodeURIComponent(id)}/rollback`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` }
  });
  return readJsonOrThrow(response, "Rollback Environment Plan failed");
}

/**
 * Build a Repair Plan from the verify failures of an existing plan.
 * The server reads the plan's stored verify results, classifies each
 * failure, and returns a fresh Repair Plan that the operator can review,
 * approve, and apply through the standard /api/plans/:id/* lifecycle.
 */
export async function repairFromVerify(token: string, planId: string): Promise<{ plan: EnvironmentPlan }> {
  const response = await fetch(`/api/plans/${encodeURIComponent(planId)}/repair-from-verify`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` }
  });
  return readJsonOrThrow(response, "Repair from verify failed");
}

export async function fetchEnvironmentPlanReport(token: string, id: string): Promise<string> {
  const response = await fetch(`/api/plans/${encodeURIComponent(id)}/report?format=markdown`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const body = await readJsonOrThrow<{ report: string }>(response, "Fetch Environment Plan report failed");
  return body.report;
}

export async function createRebuildPlan(token: string, connectionId: string, catalogIds: string[]): Promise<{ plan: EnvironmentPlan }> {
  return createEnvironmentPlan(token, {
    type: "rebuild",
    targetConnectionId: connectionId,
    source: { kind: "capability-selection", capabilityIds: catalogIds }
  });
}

export async function cancelTaskRequest(token: string, taskId: string): Promise<void> {
  await fetch(`/api/tasks/${encodeURIComponent(taskId)}/cancel`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` }
  });
}

// ── SSH 密钥管理 ──────────────────────────────────────────

export interface SshKeyMeta {
  id: string;
  userId: string;
  label: string;
  fingerprint: string;
  createdAt: string;
}

export async function uploadSshKey(token: string, label: string, privateKey: string): Promise<SshKeyMeta> {
  const response = await fetch("/api/keys", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ label, privateKey })
  });
  const body = await readJsonOrThrow<{ key: SshKeyMeta }>(response, "Upload SSH key failed");
  return body.key;
}

export async function fetchSshKeys(token: string): Promise<SshKeyMeta[]> {
  const response = await fetch("/api/keys", {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const body = await readJsonOrThrow<{ keys: SshKeyMeta[] }>(response, "Fetch SSH keys failed");
  return body.keys;
}

export async function deleteSshKey(token: string, keyId: string): Promise<void> {
  const response = await fetch(`/api/keys/${encodeURIComponent(keyId)}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${token}` }
  });
  await readJsonOrThrow<{ ok: boolean }>(response, "Delete SSH key failed");
}

// ── 环境保留 ──────────────────────────────────────────────

export interface RedactionHit {
  path: string;
  line: number;
  rule: string;
  preview: string;
}

export interface CaptureResult {
  playbookYaml: string;
  summary: {
    aptPackages: string[];
    enabledServices: string[];
    bashrcLines: string[];
    npmGlobals: string[];
    pipGlobals: string[];
    dockerContainers: string[];
    configFiles: string[];
    diskInfo?: string;
    uptimeInfo?: string;
  };
  redactions?: RedactionHit[];
  skippedPaths?: string[];
  connectionId: string;
  capturedAt: string;
}

export async function captureEnvironment(token: string, connectionId: string): Promise<CaptureResult> {
  const response = await fetch(`/api/connections/${encodeURIComponent(connectionId)}/capture`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  return readJsonOrThrow<CaptureResult>(response, "Capture failed");
}

// ── 影响范围预估 ──────────────────────────────────────────

export interface ImpactItem {
  kind: "package" | "service" | "file" | "command" | "user" | "firewall";
  action: string;
  target: string;
  diskDeltaMb?: number;
  needsSudo: boolean;
  risk: "low" | "medium" | "high";
  descZh: string;
  descEn: string;
}

export interface ImpactReport {
  items: ImpactItem[];
  totalDiskDeltaMb: number;
  needsSudo: boolean;
  maxRisk: "low" | "medium" | "high";
  estimatedSeconds: number;
  summaryZh: string;
  summaryEn: string;
}

export interface BatchImpactResult {
  reports: Array<{ catalogId: string; name: string; impact: ImpactReport }>;
  totals: {
    diskDeltaMb: number;
    estimatedSeconds: number;
    needsSudo: boolean;
    maxRisk: "low" | "medium" | "high";
    summaryZh: string;
    summaryEn: string;
  };
}

export async function fetchCatalogImpact(catalogId: string): Promise<ImpactReport> {
  const response = await fetch(`/api/catalog/${encodeURIComponent(catalogId)}/impact`);
  const body = await readJsonOrThrow<{ impact: ImpactReport }>(response, "Impact fetch failed");
  return body.impact;
}

export async function fetchBatchImpact(catalogIds: string[]): Promise<BatchImpactResult> {
  const response = await fetch("/api/impact/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ catalogIds })
  });
  return readJsonOrThrow<BatchImpactResult>(response, "Batch impact failed");
}

// ── 任务历史 ──────────────────────────────────────────────

export interface TaskHistoryEntry {
  id: string;
  userId: string;
  connectionId: string;
  source: string;
  sourceKind: "catalog" | "user-profile" | "captured";
  status: "running" | "succeeded" | "failed" | "cancelled";
  dryRun: boolean;
  steps: Array<{
    name: string;
    module: string;
    status: "ok" | "changed" | "failed" | "skipped" | "running";
    durationMs?: number;
    msg?: string;
  }>;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export async function fetchTaskHistory(token: string): Promise<TaskHistoryEntry[]> {
  const response = await fetch("/api/tasks", {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const body = await readJsonOrThrow<{ tasks: TaskHistoryEntry[] }>(response, "Fetch task history failed");
  return body.tasks;
}

// ── Playbook 版本管理 ─────────────────────────────────────

export interface StoredPlaybook {
  id: string;
  userId: string;
  name: string;
  description?: string;
  version: number;
  yaml: string;
  history?: Array<{
    version: number;
    yaml: string;
    savedAt: string;
    comment?: string;
  }>;
  sourceKind: "catalog" | "capture" | "user";
  sourceId?: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchPlaybooks(token: string): Promise<StoredPlaybook[]> {
  const response = await fetch("/api/playbooks", {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const body = await readJsonOrThrow<{ playbooks: StoredPlaybook[] }>(response, "Fetch playbooks failed");
  return body.playbooks;
}

export async function fetchPlaybook(token: string, id: string): Promise<StoredPlaybook> {
  const response = await fetch(`/api/playbooks/${encodeURIComponent(id)}`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const body = await readJsonOrThrow<{ playbook: StoredPlaybook }>(response, "Fetch playbook failed");
  return body.playbook;
}

export async function createPlaybook(token: string, input: {
  name: string;
  description?: string;
  yaml: string;
  sourceKind?: "catalog" | "capture" | "user";
  sourceId?: string;
  comment?: string;
}): Promise<StoredPlaybook> {
  const response = await fetch("/api/playbooks", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const body = await readJsonOrThrow<{ playbook: StoredPlaybook }>(response, "Create playbook failed");
  return body.playbook;
}

export async function updatePlaybook(token: string, id: string, input: {
  name?: string;
  description?: string;
  yaml?: string;
  comment?: string;
}): Promise<StoredPlaybook> {
  const response = await fetch(`/api/playbooks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const body = await readJsonOrThrow<{ playbook: StoredPlaybook }>(response, "Update playbook failed");
  return body.playbook;
}

export async function restorePlaybookVersion(token: string, id: string, version: number): Promise<StoredPlaybook> {
  const response = await fetch(`/api/playbooks/${encodeURIComponent(id)}/restore/${version}`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` }
  });
  const body = await readJsonOrThrow<{ playbook: StoredPlaybook }>(response, "Restore playbook version failed");
  return body.playbook;
}

export async function deletePlaybook(token: string, id: string): Promise<void> {
  const response = await fetch(`/api/playbooks/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${token}` }
  });
  await readJsonOrThrow<{ ok: boolean }>(response, "Delete playbook failed");
}

// ── 多目标批量执行 ────────────────────────────────────────

export interface MultiExecuteResult {
  targets: Array<{ connectionId: string; label: string; taskId: string }>;
  dryRun: boolean;
  totalTargets: number;
  message: string;
}

/** @deprecated Direct YAML execution is legacy-only. Use createEnvironmentPlan with source.kind="recipe". */
export async function multiExecute(token: string, input: {
  yaml?: string;
  playbookId?: string;
  connectionIds?: string[];
  tags?: string[];
  dryRun?: boolean;
}): Promise<MultiExecuteResult> {
  void token;
  void input;
  throw new Error("Legacy direct YAML execution is disabled. Import the recipe as an Environment Plan.");
}

export async function fetchTask(token: string, taskId: string): Promise<ExecutionTask> {
  const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const body = await readJsonOrThrow<{ task: ExecutionTask }>(response, "Fetch task failed");
  return body.task;
}

export function streamTask(taskId: string, onUpdate: (task: ExecutionTask) => void, token?: string): () => void {
  const url = `/api/tasks/${encodeURIComponent(taskId)}/stream${token ? `?token=${encodeURIComponent(token)}` : ""}`;
  const es = new EventSource(url);
  es.onmessage = (event) => {
    try { onUpdate(JSON.parse(event.data as string) as ExecutionTask); } catch { /* ignore */ }
  };
  es.onerror = () => es.close();
  return () => es.close();
}

export async function extractCombo(token: string, connectionId: string): Promise<Partial<CreateProfileInput>> {
  const response = await fetch(`/api/connections/${encodeURIComponent(connectionId)}/extract-combo`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const body = await readJsonOrThrow<{ draft: Partial<CreateProfileInput> }>(response, "Extract combo failed");
  return body.draft;
}

export async function fetchDockerCompose(catalogId: string): Promise<string> {
  const response = await fetch(`/api/catalog/${encodeURIComponent(catalogId)}/docker-compose`);
  if (!response.ok) throw new Error(`No Docker Compose for ${catalogId}`);
  return response.text();
}


// ── 配置文件管理 ──────────────────────────────────────────

export interface ConfigFileInfo {
  path: string;
  size: number;
  modifiedAt: string;
  category: "system" | "user" | "app";
  associatedSoftware?: string;
  discovery?: {
    source: "catalog-rule" | "system-default" | "user-dotfile" | "package-manager-modified";
    ruleId?: string;
    ruleName?: string;
    reasons: string[];
    sensitivity: "safe" | "review" | "secret";
    secretPatterns?: string[];
  };
  governance?: {
    owners: Array<{ id: string; type: "software" | "system" | "user" | "unknown"; confidence: number; reason: string[] }>;
    defaultStatus: "default" | "modified" | "user-created" | "unknown";
    migrationStrategy: "copy" | "copy-with-review" | "redact-or-confirm" | "do-not-copy" | "manual-review";
    validationHint?: string;
    rollbackHint: string;
    riskNotes: string[];
  };
}

export interface ConfigFileContent {
  path: string;
  content: string;
  size: number;
  modifiedAt: string;
  encoding: "utf8";
  secretScan?: {
    hasSecrets: boolean;
    hits: Array<{ pattern: string; line: number }>;
  };
}

export interface ConfigValidationResult {
  path: string;
  command?: string;
  status: "passed" | "failed" | "skipped";
  stdout: string;
  stderr: string;
  exitCode: number | null;
  message: string;
  durationMs: number;
}

export async function fetchConfigFiles(token: string, connectionId: string): Promise<ConfigFileInfo[]> {
  const response = await fetch(`/api/connections/${encodeURIComponent(connectionId)}/configs`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const body = await readJsonOrThrow<{ files: ConfigFileInfo[] }>(response, "Fetch config files failed");
  return body.files;
}

export async function readRemoteConfigFile(token: string, connectionId: string, path: string): Promise<ConfigFileContent> {
  const response = await fetch(`/api/connections/${encodeURIComponent(connectionId)}/configs/read?path=${encodeURIComponent(path)}`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  return readJsonOrThrow<ConfigFileContent>(response, "Read config file failed");
}

/** @deprecated Direct config writes are disabled. Use Config Change Plans instead. */
export async function writeRemoteConfigFile(
  _token: string,
  _connectionId: string,
  _path: string,
  _content: string,
  _backup = true
): Promise<{ success: boolean; message: string }> {
  throw new Error("Direct config writes are disabled. Create a Config Change Plan instead.");
}

export async function createConfigChangePlan(
  token: string,
  connectionId: string,
  path: string,
  content: string
): Promise<{ plan: EnvironmentPlan; current: ConfigFileContent; validation: ConfigValidationResult }> {
  const [current, validation, created] = await Promise.all([
    readRemoteConfigFile(token, connectionId, path),
    validateRemoteConfigFile(token, connectionId, path),
    createEnvironmentPlan(token, {
      type: "change",
      targetConnectionId: connectionId,
      source: { kind: "config-change", path, content }
    })
  ]);
  return { plan: created.plan, current, validation };
}

export async function createConfigMigrationPlan(
  token: string,
  connectionId: string,
  paths: string[],
  targetConnectionId?: string
): Promise<{ plan: EnvironmentPlan }> {
  const response = await fetch(`/api/connections/${encodeURIComponent(connectionId)}/configs/migration-plan`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ paths, targetConnectionId })
  });
  return readJsonOrThrow<{ plan: EnvironmentPlan }>(response, "Create config migration plan failed");
}

export async function validateRemoteConfigFile(token: string, connectionId: string, path: string): Promise<ConfigValidationResult> {
  const response = await fetch(`/api/connections/${encodeURIComponent(connectionId)}/configs/validate`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ path })
  });
  return readJsonOrThrow<ConfigValidationResult>(response, "Validate config file failed");
}

export async function fetchConfigFileDiff(
  token: string,
  connectionId: string,
  path: string
): Promise<{ current: ConfigFileContent; backup?: ConfigFileContent & { backupPath: string } }> {
  const response = await fetch(`/api/connections/${encodeURIComponent(connectionId)}/configs/diff?path=${encodeURIComponent(path)}`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  return readJsonOrThrow(response, "Diff failed");
}

export type MigrationClass =
  | "managed-software"
  | "system-baseline"
  | "user-dotfile"
  | "service-config"
  | "language-global-package"
  | "container-workload"
  | "manual-install"
  | "unknown-review"
  | "do-not-migrate";

export type ConfidenceBand = "high" | "medium" | "low" | "ignore";
export type ReviewDecision = "pending" | "approved" | "skipped" | "ignore" | "record-only" | "migrate-artifact" | "create-catalog-draft" | "add-to-plan" | "needs-manual-instruction";
export type RiskLevel = "safe" | "review" | "privileged" | "dangerous";
export type DecisionBand = "auto" | "review" | "manual" | "ignore";
export type MigrationSupportLevel = "detect-only" | "basic-rebuild" | "managed-config" | "full-migration";
export type PackageArtifactClass =
  | "system-baseline"
  | "library-dependency"
  | "user-installed-package"
  | "language-global-package"
  | "container-workload"
  | "manual-install"
  | "runtime-service"
  | "unknown-review";
export type RawEvidenceKind =
  | "package"
  | "language-package"
  | "service"
  | "schedule"
  | "container"
  | "manual-path"
  | "port"
  | "config"
  | "security-check"
  | "unknown";

export interface RawMigrationEvidence {
  id: string;
  kind: RawEvidenceKind;
  source: string;
  name?: string;
  value?: string;
  version?: string;
  status?: string;
  trust?: "user" | "uncertain";
  path?: string;
  port?: number;
  label?: string;
  category?: string;
  catalogRuleId?: string;
}

export interface NormalizedArtifact {
  artifactKey: string;
  artifactClass: PackageArtifactClass;
  displayName: string;
  migrationClass: MigrationClass;
  userFacing: boolean;
  capabilityKey?: string;
  catalogRuleId?: string;
  catalogRuleName?: string;
  evidenceSources: string[];
  rawEvidence: RawMigrationEvidence[];
  packageNames: string[];
  serviceNames: string[];
  ports: number[];
  configPaths: string[];
  dataPaths: string[];
  configBundles: ConfigBundle[];
  reasons: string[];
}

export type ConfigOwnership = "catalog-owned" | "inferred-owner" | "user-dotfile" | "system-security" | "unknown";
export type ConfigDefaultStatus = "default" | "modified" | "user-created" | "unknown";
export type ConfigBundleSensitivity = "safe" | "review" | "secret" | "blocked";
export type ConfigBundleMigrationStrategy =
  | "omit-default"
  | "copy-with-review"
  | "template-with-vars"
  | "secret-out-of-band"
  | "manual-only"
  | "blocked";

export interface ConfigBundleFile {
  path: string;
  isGlob: boolean;
  defaultStatus: ConfigDefaultStatus;
  sensitivity: ConfigBundleSensitivity;
  source: "catalog" | "security-checklist" | "inferred";
}

export interface ConfigBundle {
  id: string;
  ownerCapabilityKey: string | null;
  ownerRuleId?: string;
  ownerDisplayName?: string;
  paths: ConfigBundleFile[];
  ownership: ConfigOwnership;
  defaultStatus: ConfigDefaultStatus;
  sensitivity: ConfigBundleSensitivity;
  migrationStrategy: ConfigBundleMigrationStrategy;
  validationHint?: string;
  rollbackStrategy?: string;
  riskLevel: RiskLevel;
  reasons: string[];
}

export interface MigrationCandidate {
  id: string;
  name: string;
  source: string;
  version: string;
  migrationClass: MigrationClass;
  confidence: number;
  intentConfidence: number;
  migrationReadiness: number;
  riskLevel: RiskLevel;
  supportLevel: MigrationSupportLevel;
  decisionBand: DecisionBand;
  band: ConfidenceBand;
  catalogRuleId?: string;
  catalogRuleName?: string;
  reasons: string[];
  risks: string[];
  recommendedActions: string[];
  normalizedArtifactKey?: string;
  artifactClass?: PackageArtifactClass;
  rawEvidence?: RawMigrationEvidence[];
  normalizedArtifacts?: NormalizedArtifact[];
  configBundles?: ConfigBundle[];
  blockers?: string[];
  reviewReasons?: string[];
  evidenceSources?: string[];
  packageNames?: string[];
  serviceNames?: string[];
  ports?: number[];
  configPaths?: string[];
  dataPaths?: string[];
  validateCommands?: string[];
  restartServices?: string[];
}

export interface MigrationCandidateReport {
  sourceHost: string;
  generatedAt: string;
  summary: Record<ConfidenceBand | "total", number>;
  normalizedArtifacts: NormalizedArtifact[];
  configBundles: ConfigBundle[];
  candidates: MigrationCandidate[];
}

export interface MigrationDecision {
  id: string;
  userId: string;
  connectionId: string;
  candidateId: string;
  decision: ReviewDecision;
  note?: string;
  updatedAt: string;
}

export type MigrationConfigDecisionStatus = "approved" | "blocked";
export type MigrationConfigStrategy =
  | "omit-default"
  | "copy-with-review"
  | "template-with-vars"
  | "secret-out-of-band"
  | "manual-only"
  | "blocked";

export interface MigrationConfigDecision {
  id: string;
  userId: string;
  sessionId: string;
  connectionId: string;
  bundleId: string;
  strategy: MigrationConfigStrategy;
  status: MigrationConfigDecisionStatus;
  note?: string;
  updatedAt: string;
}

export type MigrationDataStrategy = "no-data" | "backup-restore" | "rsync-copy" | "export-import" | "manual" | "external";

export interface MigrationDataDecision {
  id: string;
  userId: string;
  sessionId: string;
  connectionId: string;
  candidateId: string;
  strategy: MigrationDataStrategy;
  status: "confirmed" | "blocked";
  paths: string[];
  note?: string;
  updatedAt: string;
}

export interface MigrationReviewQueueItem {
  candidate: MigrationCandidate;
  reason: string;
  decision: ReviewDecision;
  note?: string;
}

export interface MigrationPlan {
  sourceHost: string;
  generatedAt: string;
  items: Array<{
    id: string;
    name: string;
    type: MigrationClass;
    confidence: number;
    intentConfidence?: number;
    migrationReadiness?: number;
    riskLevel?: RiskLevel;
    supportLevel?: MigrationSupportLevel;
    decisionBand?: DecisionBand;
    actions: Array<{ kind: string; label: string; command?: string; requiresSudo?: boolean; backup?: boolean }>;
    risks: string[];
    configBundles?: ConfigBundle[];
    userDecision: ReviewDecision;
  }>;
}

export type MigrationDryRunStepStatus = "would-run" | "needs-review" | "blocked";

export interface MigrationDryRunResult {
  sourceHost: string;
  generatedAt: string;
  dryRun: true;
  summary: Record<MigrationDryRunStepStatus | "total", number>;
  steps: Array<{
    id: string;
    itemId: string;
    itemName: string;
    actionKind: string;
    label: string;
    status: MigrationDryRunStepStatus;
    command?: string;
    reason: string;
    requiresSudo: boolean;
    validationHook?: string;
  }>;
}

export type MigrationVerificationSeverity = "required" | "recommended" | "manual";

export interface MigrationVerificationPreview {
  sourceHost: string;
  generatedAt: string;
  summary: Record<MigrationVerificationSeverity | "total", number>;
  checks: Array<{
    id: string;
    itemId: string;
    itemName: string;
    kind: "command" | "service" | "manual";
    severity: MigrationVerificationSeverity;
    label: string;
    command?: string;
    expected: string;
    sourceAction: string;
  }>;
}

export interface MigrationVerificationRunResult {
  sourceHost: string;
  generatedAt: string;
  ok: boolean;
  summary: { passed: number; failed: number; skipped: number; total: number };
  checks: Array<MigrationVerificationPreview["checks"][number] & {
    status: "passed" | "failed" | "skipped";
    stdout: string;
    stderr: string;
    exitCode: number | null;
    durationMs: number;
  }>;
}

export interface MigrationApplyReadiness {
  ready: boolean;
  generatedAt: string;
  blockers: string[];
  warnings: string[];
  items: Array<{ id: string; name: string; ready: boolean; blockers: string[]; warnings: string[] }>;
}

export interface MigrationApplyResult {
  sourceHost: string;
  generatedAt: string;
  ok: boolean;
  rolledBack: boolean;
  summary: { passed: number; failed: number; skipped: number; rolledBack: number; total: number };
  steps: Array<{
    itemId: string;
    itemName: string;
    action: string;
    label: string;
    status: "passed" | "failed" | "skipped" | "rolled-back";
    changed: boolean;
    message: string;
    stdout?: string;
    stderr?: string;
    startedAt: string;
    completedAt: string;
    durationMs: number;
  }>;
}

export type MigrationSessionStatus =
  | "created"
  | "source-connected"
  | "snapshot-collected"
  | "analysis-ready"
  | "selection-in-progress"
  | "config-review-required"
  | "plan-ready"
  | "target-connected"
  | "dry-run-passed"
  | "applying"
  | "applied"
  | "verified"
  | "reported"
  | "failed"
  | "rolled-back";

export type MigrationSessionStep = "source" | "analysis" | "select" | "unknown" | "config-data" | "plan" | "target" | "apply" | "report";

export interface MigrationSessionSummary {
  totalCandidates: number;
  autoCandidates: number;
  reviewCandidates: number;
  manualCandidates: number;
  ignoredArtifacts: number;
  selectedCount: number;
  skippedCount: number;
  recordOnlyCount: number;
  pendingReviewCount: number;
  blockerCount: number;
  configRiskCount: number;
  secretOrBlockedConfigCount: number;
  dataReviewCount: number;
  planItemCount: number;
  applyBlockerCount: number;
}

export interface MigrationSessionView {
  id: string;
  userId: string;
  connectionId: string;
  targetConnectionId?: string;
  status: MigrationSessionStatus;
  currentStep: MigrationSessionStep;
  recommendedStep: MigrationSessionStep;
  recommendedStatus: MigrationSessionStatus;
  createdAt: string;
  updatedAt: string;
  lastSnapshotAt?: string;
  lastAnalysisAt?: string;
  lastPlanAt?: string;
  lastDryRunAt?: string;
  lastApplyAt?: string;
  lastVerifyAt?: string;
  lastReportAt?: string;
  summary: MigrationSessionSummary;
}

export interface MigrationSessionAnalysis {
  session: MigrationSessionView;
  report?: MigrationCandidateReport;
  reviewQueue: MigrationReviewQueueItem[];
  decisions: MigrationDecision[];
}

export interface MigrationSessionPlanResponse {
  session: MigrationSessionView;
  plan: MigrationPlan;
  environmentPlan?: unknown;
  readiness?: MigrationApplyReadiness;
}

export interface MigrationSessionApplyReadiness {
  ready: boolean;
  generatedAt: string;
  blockers: string[];
  warnings: string[];
  targetConnectionId?: string;
  dryRun?: { id: string; status: "passed" | "failed" | "blocked" | "generated"; createdAt: string; summary?: Record<string, number | boolean | string> };
  items: MigrationApplyReadiness["items"];
}

export interface MigrationSessionReport {
  sessionId: string;
  sourceHost: string;
  targetConnectionId?: string;
  generatedAt: string;
  summary: MigrationSessionSummary;
  plan?: { items: number; generatedAt: string };
  configDecisions: MigrationConfigDecision[];
  dataDecisions: MigrationDataDecision[];
  readiness?: MigrationSessionApplyReadiness;
  dryRun?: { status: string; createdAt: string; summary?: Record<string, number | boolean | string>; result?: MigrationDryRunResult };
  apply?: { status: string; createdAt: string; summary?: Record<string, number | boolean | string>; result?: MigrationApplyResult };
  verify?: { status: string; createdAt: string; summary?: Record<string, number | boolean | string>; result?: MigrationVerificationRunResult };
  rollback?: { available: boolean; rolledBack: boolean; steps: Array<{ label?: string; message?: string; status?: string }> };
}

export type AssessmentServiceCategory =
  | "web-entry" | "app-runtime" | "database" | "cache" | "queue" | "storage"
  | "security" | "network" | "scheduled-job" | "unknown";

export interface AssessmentEvidenceRef {
  id: string;
  kind: string;
  source: string;
  label: string;
  value?: string;
  status?: string;
}

export interface AssessmentRequiredDecision {
  id: string;
  title: string;
  reason: string;
  relatedServiceStackIds: string[];
  defaultSafeChoice: string;
  options: Array<{ id: string; label: string; risk?: string }>;
}

export interface AssessmentServiceStack {
  id: string;
  name: string;
  category: AssessmentServiceCategory;
  summary: string;
  evidence: AssessmentEvidenceRef[];
  evidenceCount: number;
  confidence: "high" | "medium" | "low" | "unknown";
  confidenceReason: string;
  risk: "low" | "medium" | "high" | "unknown";
  riskReasons: string[];
  statefulness: "stateless" | "stateful" | "mixed" | "unknown";
  migrationReadiness: "assessment-complete" | "plan-possible" | "requires-decision" | "blocked-by-missing-evidence" | "record-only-recommended" | "manual";
  requiredDecisions: AssessmentRequiredDecision[];
  recommendedStrategy?: string;
  relationships: Array<{ type: string; targetServiceStackId: string; summary: string }>;
  capabilityRefs: string[];
}

export interface AssessmentEvidenceQuality {
  overallStatus: "ok" | "partial" | "failed" | "unknown";
  completeness: number;
  collectors: Array<{
    name: string;
    status: "ok" | "partial" | "failed" | "skipped" | "unknown";
    completeness?: number;
    failedCommands?: string[];
    timedOutCommands?: string[];
    stderrSummary?: string;
    errors?: string[];
  }>;
  notes: string[];
}

export interface AssessmentSummary {
  id: string;
  sessionId: string;
  availability: "ready" | "collector-incomplete";
  generatedAt: string;
  source?: { host?: string; os?: string; architecture?: string };
  snapshot?: {
    capturedAt?: string;
    completeness: {
      status: AssessmentEvidenceQuality["overallStatus"];
      score: number;
      failedCollectorCount: number;
      partialCollectorCount: number;
      timedOut: boolean;
    };
  };
  serviceStacks: AssessmentServiceStack[];
  riskSummary: { overall: "low" | "medium" | "high" | "unknown"; low: number; medium: number; high: number; unknown: number; reasons: string[] };
  readiness: {
    status: "assessment-complete" | "plan-possible" | "apply-requires-decisions" | "blocked-by-missing-evidence" | "record-only-recommended";
    summary: string;
    blockers: string[];
    warnings: string[];
    nextActions: string[];
  };
  requiredDecisions: AssessmentRequiredDecision[];
  evidenceQuality: AssessmentEvidenceQuality;
  unsupportedOrManualItems: string[];
  report: { jsonAvailable: boolean; markdownAvailable: boolean };
  metadata: { envForgeVersion?: string; catalogVersion?: string };
  redactionNote: string;
}

export type FailureCategory =
  | "validation-failed" | "command-failed" | "missing-artifact" | "missing-dependency"
  | "collector-failed" | "permission-denied" | "network-unreachable" | "service-unhealthy"
  | "config-invalid" | "secret-missing" | "data-risk" | "verification-failed"
  | "rollback-required" | "manual-follow-up" | "unknown";

export interface FailureDiagnostic {
  id: string;
  source: "assessment" | "review" | "plan" | "apply" | "verify" | "report" | "golden-scenario";
  severity: "info" | "warning" | "error" | "critical";
  category: FailureCategory;
  title: string;
  summary: string;
  whatFailed: string;
  whereFailed?: string;
  attempted?: string;
  impact: string;
  likelyCauses: string[];
  evidence: Array<{ id: string; kind: string; source: string; label: string; value?: string; exitCode?: number; timedOut?: boolean }>;
  recommendedActions: Array<{ kind: string; label: string; description: string; available: boolean; unavailableReason?: string }>;
  retry: { allowed: boolean; reason: string };
  skip: { allowed: boolean; reason: string };
  rollback: { required: boolean; available: boolean; boundary: string };
  repairPlanDraft?: {
    id: string;
    title: string;
    status: "draft" | "not-available";
    summary: string;
    proposedSteps: Array<{ id: string; description: string; risk: "low" | "medium" | "high" | "unknown"; requiresReview: boolean; wouldRequireApprovedPlan: boolean }>;
    safetyNotes: string[];
  };
  supportBundleRefs: string[];
  redactionApplied: boolean;
}

export interface SupportBundle {
  id: string;
  generatedAt: string;
  sessionId: string;
  failureDiagnostics: FailureDiagnostic[];
  redaction: { applied: true; note: string; excluded: string[] };
  safetyBoundary: {
    readOnlyExport: true;
    approvalCreated: false;
    applyRunCreated: false;
    actionRunCreated: false;
    repairExecuted: false;
    rollbackExecuted: false;
    statements: string[];
  };
  [key: string]: unknown;
}

export type DecisionOutcome = "auto-staged" | "required-decision" | "suggested-decision" | "record-only" | "hidden-noise" | "blocker";
export type ReviewInboxStatus = "open" | "accepted" | "rejected" | "deferred" | "resolved";
export type DecisionPreferenceScope = "global" | "connection" | "project" | "service" | "capability";

export interface DecisionScores {
  intentConfidence: number;
  evidenceStrength: number;
  migrationReadiness: number;
  riskScore: number;
  automationConfidence: number;
  businessCriticality: number;
  reviewCost: number;
  userPreferenceConfidence: number;
  collectorCompleteness: number;
}

export interface ReviewInboxItem {
  id: string;
  candidateId?: string;
  planId?: string;
  snapshotId?: string;
  targetId?: string;
  title: string;
  reason: string;
  outcome: DecisionOutcome;
  scores: DecisionScores;
  requiredGates: string[];
  status: ReviewInboxStatus;
  resolutionNote?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionHistoryRecord {
  id: string;
  subjectId: string;
  subjectType: "migration-candidate" | "environment-plan" | "capability" | "evidence";
  outcome: DecisionOutcome;
  scores: DecisionScores;
  reasons: string[];
  requiredGates: string[];
  preferenceId?: string;
  profileId: string;
  createdAt: string;
}

export interface UserDecisionPreference {
  id: string;
  scope: DecisionPreferenceScope;
  scopeId?: string;
  pattern: string;
  preferredOutcome: DecisionOutcome;
  confidence: number;
  observations: number;
  createdAt: string;
  updatedAt: string;
}

export async function fetchMigrationCandidates(token: string, connectionId: string): Promise<MigrationCandidateReport> {
  const response = await fetch(`/api/connections/${encodeURIComponent(connectionId)}/migration-candidates`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const body = await readJsonOrThrow<{ report: MigrationCandidateReport }>(response, "Fetch migration candidates failed");
  return body.report;
}

export async function fetchMigrationReviewQueue(token: string, connectionId: string): Promise<MigrationReviewQueueItem[]> {
  const response = await fetch(`/api/connections/${encodeURIComponent(connectionId)}/migration-review-queue`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const body = await readJsonOrThrow<{ queue: MigrationReviewQueueItem[] }>(response, "Fetch migration review queue failed");
  return body.queue;
}

export interface CatalogDraft {
  id: string;
  capabilityKey: string;
  yaml: string;
  notes: string[];
}

/**
 * Generate a Capability Catalog v2 YAML draft for a Review Queue candidate.
 * The server inspects the candidate's evidence (packages, configs, data
 * paths, validate commands) and returns a fillable rule template.
 */
export async function generateCatalogDraft(
  token: string,
  connectionId: string,
  candidateId: string
): Promise<CatalogDraft> {
  const response = await fetch(
    `/api/connections/${encodeURIComponent(connectionId)}/migration-candidates/${encodeURIComponent(candidateId)}/catalog-draft`,
    {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` }
    }
  );
  const body = await readJsonOrThrow<{ draft: CatalogDraft }>(response, "Generate catalog draft failed");
  return body.draft;
}

export async function saveMigrationDecision(
  token: string,
  connectionId: string,
  candidateId: string,
  decision: MigrationDecision["decision"],
  note?: string
): Promise<MigrationDecision> {
  const response = await fetch(`/api/connections/${encodeURIComponent(connectionId)}/migration-decisions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ candidateId, decision, note })
  });
  const body = await readJsonOrThrow<{ decision: MigrationDecision }>(response, "Save migration decision failed");
  return body.decision;
}

export async function saveMigrationDecisionsBulk(
  token: string,
  connectionId: string,
  candidateIds: string[],
  decision: MigrationDecision["decision"],
  note?: string
): Promise<MigrationDecision[]> {
  const response = await fetch(`/api/connections/${encodeURIComponent(connectionId)}/migration-decisions/bulk`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ candidateIds, decision, note })
  });
  const body = await readJsonOrThrow<{ decisions: MigrationDecision[] }>(response, "Save migration decisions failed");
  return body.decisions;
}

export async function fetchMigrationPlan(token: string, connectionId: string): Promise<MigrationPlan> {
  const response = await fetch(`/api/connections/${encodeURIComponent(connectionId)}/migration-plan`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const body = await readJsonOrThrow<{ plan: MigrationPlan }>(response, "Fetch migration plan failed");
  return body.plan;
}

export async function exportMigrationPlan(
  token: string,
  connectionId: string,
  format: "json" | "markdown" | "bash" | "ansible"
): Promise<string> {
  const response = await fetch(`/api/connections/${encodeURIComponent(connectionId)}/migration-plan/export?format=${encodeURIComponent(format)}`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Export migration plan failed");
  }
  return response.text();
}

export async function dryRunMigrationPlan(token: string, connectionId: string): Promise<MigrationDryRunResult> {
  const response = await fetch(`/api/connections/${encodeURIComponent(connectionId)}/migration-plan/dry-run`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` }
  });
  const body = await readJsonOrThrow<{ result: MigrationDryRunResult }>(response, "Dry-run migration plan failed");
  return body.result;
}

export async function fetchMigrationVerifyPreview(token: string, connectionId: string): Promise<MigrationVerificationPreview> {
  const response = await fetch(`/api/connections/${encodeURIComponent(connectionId)}/migration-plan/verify-preview`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const body = await readJsonOrThrow<{ preview: MigrationVerificationPreview }>(response, "Fetch migration verification preview failed");
  return body.preview;
}

export async function runMigrationVerify(token: string, connectionId: string): Promise<MigrationVerificationRunResult> {
  const response = await fetch(`/api/connections/${encodeURIComponent(connectionId)}/migration-plan/verify-run`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` }
  });
  const body = await readJsonOrThrow<{ result: MigrationVerificationRunResult }>(response, "Run migration verification failed");
  return body.result;
}

export async function fetchMigrationApplyReadiness(token: string, connectionId: string): Promise<MigrationApplyReadiness> {
  const response = await fetch(`/api/connections/${encodeURIComponent(connectionId)}/migration-plan/apply-readiness`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const body = await readJsonOrThrow<{ readiness: MigrationApplyReadiness }>(response, "Fetch apply readiness failed");
  return body.readiness;
}

// ── 软件卸载 ──────────────────────────────────────────────

export async function createMigrationSession(
  token: string,
  input: { connectionId: string; targetConnectionId?: string; reuseLatest?: boolean; note?: string }
): Promise<MigrationSessionView> {
  const response = await fetch("/api/migration/sessions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const body = await readJsonOrThrow<{ session: MigrationSessionView }>(response, "Create migration session failed");
  return body.session;
}

export async function getMigrationSession(token: string, sessionId: string): Promise<MigrationSessionView> {
  const response = await fetch(`/api/migration/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const body = await readJsonOrThrow<{ session: MigrationSessionView }>(response, "Fetch migration session failed");
  return body.session;
}

export async function updateMigrationSession(
  token: string,
  sessionId: string,
  input: { currentStep?: MigrationSessionStep; status?: MigrationSessionStatus; targetConnectionId?: string; note?: string }
): Promise<MigrationSessionView> {
  const response = await fetch(`/api/migration/sessions/${encodeURIComponent(sessionId)}`, {
    method: "PATCH",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const body = await readJsonOrThrow<{ session: MigrationSessionView }>(response, "Update migration session failed");
  return body.session;
}

export async function attachMigrationSessionSnapshot(
  token: string,
  sessionId: string
): Promise<{ session: MigrationSessionView; report?: MigrationCandidateReport }> {
  const response = await fetch(`/api/migration/sessions/${encodeURIComponent(sessionId)}/snapshot`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` }
  });
  return readJsonOrThrow<{ session: MigrationSessionView; report?: MigrationCandidateReport }>(response, "Attach session snapshot failed");
}

export async function fetchMigrationSessionAnalysis(token: string, sessionId: string): Promise<MigrationSessionAnalysis> {
  const response = await fetch(`/api/migration/sessions/${encodeURIComponent(sessionId)}/analysis`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  return readJsonOrThrow<MigrationSessionAnalysis>(response, "Fetch migration session analysis failed");
}

export async function getMigrationSessionAssessment(token: string, sessionId: string): Promise<AssessmentSummary> {
  const response = await fetch(`/api/migration/sessions/${encodeURIComponent(sessionId)}/assessment`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const body = await readJsonOrThrow<{ assessment: AssessmentSummary }>(response, "Fetch migration assessment failed");
  return body.assessment;
}

export async function getMigrationSessionAssessmentReport(
  token: string,
  sessionId: string,
  format: "json"
): Promise<AssessmentSummary>;
export async function getMigrationSessionAssessmentReport(
  token: string,
  sessionId: string,
  format: "markdown"
): Promise<string>;
export async function getMigrationSessionAssessmentReport(
  token: string,
  sessionId: string,
  format: "json" | "markdown"
): Promise<AssessmentSummary | string> {
  const response = await fetch(`/api/migration/sessions/${encodeURIComponent(sessionId)}/assessment/report?format=${encodeURIComponent(format)}`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  if (format === "markdown") {
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? "Export Assessment Report failed");
    }
    return response.text();
  }
  const body = await readJsonOrThrow<{ format: "json"; report: AssessmentSummary }>(response, "Export Assessment Report failed");
  return body.report;
}

export async function getMigrationSessionFailures(token: string, sessionId: string): Promise<FailureDiagnostic[]> {
  const response = await fetch(`/api/migration/sessions/${encodeURIComponent(sessionId)}/failures`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const body = await readJsonOrThrow<{ diagnostics: FailureDiagnostic[] }>(response, "Fetch failure diagnostics failed");
  return body.diagnostics;
}

export async function getMigrationSessionSupportBundle(token: string, sessionId: string, format: "json"): Promise<SupportBundle>;
export async function getMigrationSessionSupportBundle(token: string, sessionId: string, format: "markdown"): Promise<string>;
export async function getMigrationSessionSupportBundle(token: string, sessionId: string, format: "json" | "markdown"): Promise<SupportBundle | string> {
  const response = await fetch(`/api/migration/sessions/${encodeURIComponent(sessionId)}/support-bundle?format=${encodeURIComponent(format)}`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  if (format === "markdown") {
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? "Export Support Bundle failed");
    }
    return response.text();
  }
  const body = await readJsonOrThrow<{ format: "json"; bundle: SupportBundle }>(response, "Export Support Bundle failed");
  return body.bundle;
}

export async function getReviewInbox(
  token: string,
  input: { status?: ReviewInboxStatus | "all"; limit?: number } = {}
): Promise<ReviewInboxItem[]> {
  const query = new URLSearchParams();
  if (input.status) query.set("status", input.status);
  if (input.limit !== undefined) query.set("limit", String(input.limit));
  const suffix = query.size ? `?${query.toString()}` : "";
  const response = await fetch(`/api/decision-engine/review-inbox${suffix}`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const body = await readJsonOrThrow<{ items: ReviewInboxItem[] }>(response, "Fetch Review Inbox failed");
  return body.items;
}

export async function resolveReviewInboxItem(
  token: string,
  itemId: string,
  input: {
    status: Exclude<ReviewInboxStatus, "open">;
    note?: string;
    remember?: {
      scope: DecisionPreferenceScope;
      scopeId?: string;
      pattern: string;
      preferredOutcome: DecisionOutcome;
      confidence?: number;
    };
  }
): Promise<{ item: ReviewInboxItem; preference?: UserDecisionPreference }> {
  const response = await fetch(`/api/decision-engine/review-inbox/${encodeURIComponent(itemId)}`, {
    method: "PATCH",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return readJsonOrThrow<{ item: ReviewInboxItem; preference?: UserDecisionPreference }>(response, "Update Review Inbox item failed");
}

export async function getDecisionHistory(token: string, subjectId: string, limit = 20): Promise<DecisionHistoryRecord[]> {
  const query = new URLSearchParams({ subjectId, limit: String(limit) });
  const response = await fetch(`/api/decision-engine/history?${query.toString()}`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const body = await readJsonOrThrow<{ history: DecisionHistoryRecord[] }>(response, "Fetch decision history failed");
  return body.history;
}

export async function saveMigrationSessionDecisions(
  token: string,
  sessionId: string,
  input: { candidateId?: string; candidateIds?: string[]; decision: MigrationDecision["decision"]; note?: string }
): Promise<{ session: MigrationSessionView; decisions: MigrationDecision[] }> {
  const response = await fetch(`/api/migration/sessions/${encodeURIComponent(sessionId)}/decisions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return readJsonOrThrow<{ session: MigrationSessionView; decisions: MigrationDecision[] }>(response, "Save migration session decisions failed");
}

export async function fetchMigrationSessionConfigBundles(
  token: string,
  sessionId: string
): Promise<{ session: MigrationSessionView; configBundles: ConfigBundle[]; configDecisions: MigrationConfigDecision[]; dataDecisions: MigrationDataDecision[] }> {
  const response = await fetch(`/api/migration/sessions/${encodeURIComponent(sessionId)}/config-bundles`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  return readJsonOrThrow<{ session: MigrationSessionView; configBundles: ConfigBundle[]; configDecisions: MigrationConfigDecision[]; dataDecisions: MigrationDataDecision[] }>(response, "Fetch session config bundles failed");
}

export async function saveMigrationSessionConfigDecision(
  token: string,
  sessionId: string,
  input: { bundleId: string; strategy: MigrationConfigStrategy; status: MigrationConfigDecisionStatus; note?: string }
): Promise<{ session: MigrationSessionView; configDecisions: MigrationConfigDecision[]; dataDecisions: MigrationDataDecision[] }> {
  const response = await fetch(`/api/migration/sessions/${encodeURIComponent(sessionId)}/config-decisions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return readJsonOrThrow<{ session: MigrationSessionView; configDecisions: MigrationConfigDecision[]; dataDecisions: MigrationDataDecision[] }>(response, "Save config decision failed");
}

export async function saveMigrationSessionDataDecision(
  token: string,
  sessionId: string,
  input: { candidateId: string; strategy: MigrationDataStrategy; status: "confirmed" | "blocked"; paths?: string[]; note?: string }
): Promise<{ session: MigrationSessionView; configDecisions: MigrationConfigDecision[]; dataDecisions: MigrationDataDecision[] }> {
  const response = await fetch(`/api/migration/sessions/${encodeURIComponent(sessionId)}/data-decisions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return readJsonOrThrow<{ session: MigrationSessionView; configDecisions: MigrationConfigDecision[]; dataDecisions: MigrationDataDecision[] }>(response, "Save data decision failed");
}

export async function fetchMigrationSessionPlan(token: string, sessionId: string): Promise<MigrationSessionPlanResponse> {
  const response = await fetch(`/api/migration/sessions/${encodeURIComponent(sessionId)}/plan`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  return readJsonOrThrow<MigrationSessionPlanResponse>(response, "Fetch session migration plan failed");
}

export async function dryRunMigrationSession(
  token: string,
  sessionId: string
): Promise<{ session: MigrationSessionView; result: MigrationDryRunResult }> {
  const response = await fetch(`/api/migration/sessions/${encodeURIComponent(sessionId)}/dry-run`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` }
  });
  return readJsonOrThrow<{ session: MigrationSessionView; result: MigrationDryRunResult }>(response, "Dry-run migration session failed");
}

export async function fetchMigrationSessionApplyReadiness(
  token: string,
  sessionId: string
): Promise<{ session: MigrationSessionView; readiness: MigrationSessionApplyReadiness }> {
  const response = await fetch(`/api/migration/sessions/${encodeURIComponent(sessionId)}/apply-readiness`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  return readJsonOrThrow<{ session: MigrationSessionView; readiness: MigrationSessionApplyReadiness }>(response, "Fetch migration apply readiness failed");
}

export async function verifyMigrationSession(
  token: string,
  sessionId: string
): Promise<{ session: MigrationSessionView; result: MigrationVerificationRunResult; preview: MigrationVerificationPreview }> {
  const response = await fetch(`/api/migration/sessions/${encodeURIComponent(sessionId)}/verify`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` }
  });
  return readJsonOrThrow<{ session: MigrationSessionView; result: MigrationVerificationRunResult; preview: MigrationVerificationPreview }>(response, "Verify migration session failed");
}

export async function fetchMigrationSessionReport(
  token: string,
  sessionId: string
): Promise<{ session: MigrationSessionView; report: MigrationSessionReport }> {
  const response = await fetch(`/api/migration/sessions/${encodeURIComponent(sessionId)}/report`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  return readJsonOrThrow<{ session: MigrationSessionView; report: MigrationSessionReport }>(response, "Fetch migration session report failed");
}

export interface RemoveCapabilityPlan {
  /** Persisted plan id assigned by the server. */
  id?: string;
  type: "remove";
  status?: "draft" | "needs-review" | "approved" | "applying" | "succeeded" | "failed" | "rolled-back" | "committed";
  name: string;
  targetConnectionId: string;
  packages?: string[];
  source?: string;
  reason?: string;
  preserveDataByDefault?: boolean;
  /** True when EnvForge installed the capability and tracks rollback. */
  managedByEnvForge?: boolean;
  risks?: string[];
  actions?: unknown[];
  /** Items, evidence, summary, review reasons — preserved opaquely so the
   *  client never has to re-implement plan parsing. */
  items?: Array<{ id: string; name: string; risks: string[]; evidence: string[] }>;
  review?: { required: boolean; reasons: string[] };
  summary?: { totalItems: number; totalActions: number; highRisk: number; requiresSudo: number; rollbackable: number; dataPreservedByDefault?: boolean };
  yaml?: string;
  export?: { yaml?: string; markdown?: string };
}

export async function createRemoveCapabilityPlan(
  token: string,
  connectionId: string,
  packages: string[],
  source: string,
  options: { managedByEnvForge?: boolean; preserveData?: boolean } = {}
): Promise<{ plan: EnvironmentPlan }> {
  const response = await fetch(`/api/connections/${encodeURIComponent(connectionId)}/remove-capability-plan`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      packages,
      source,
      managedByEnvForge: options.managedByEnvForge,
      preserveData: options.preserveData
    })
  });
  return readJsonOrThrow<{ plan: EnvironmentPlan }>(response, "Create remove plan failed");
}

/** @deprecated Direct package uninstall is no longer part of the product flow. */
export async function uninstallPackages(
  _token: string,
  _connectionId: string,
  _packages: string[],
  _source: string,
  _dryRun = false
): Promise<{ taskId: string; dryRun: boolean; packages: string[] }> {
  throw new Error("Direct uninstall is disabled. Create a Remove Capability Plan instead.");
}

// ── Preflight & Verify ───────────────────────────────────

export interface PreflightCheck {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail" | "skipped";
  detail: string;
}

export interface PreflightReport {
  ranAt: string;
  durationMs: number;
  checks: PreflightCheck[];
  summary: { pass: number; warn: number; fail: number };
}

export async function runPreflightCheck(token: string, connectionId: string): Promise<PreflightReport> {
  const response = await fetch(`/api/connections/${encodeURIComponent(connectionId)}/preflight`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const data = await readJsonOrThrow<{ report: PreflightReport }>(response, "Preflight failed");
  return data.report;
}

// ─── Distro detection + compatibility ──────────────────────────────────

export type DistroFamily = "debian-family" | "rhel-family" | "suse-family" | "arch-family" | "alpine" | "unknown";

export interface DistroInfo {
  id: string;
  idLike: string[];
  prettyName: string;
  major: number;
  versionId: string;
  family: DistroFamily;
  packageManager: "apt" | "dnf" | "yum" | "zypper" | "apk" | "pacman" | "unknown";
}

export type CompatibilityLevel = "verified" | "compatible" | "untested" | "unsupported";

export interface CompatibilityResult {
  catalogId: string;
  level: CompatibilityLevel;
  reasonZh: string;
  reasonEn: string;
}

export async function fetchTargetDistro(token: string, connectionId: string): Promise<DistroInfo> {
  const r = await fetch(`/api/connections/${encodeURIComponent(connectionId)}/distro`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const data = await readJsonOrThrow<{ distro: DistroInfo }>(r, "Distro detection failed");
  return data.distro;
}

export async function checkCompatibility(
  token: string,
  connectionId: string,
  catalogIds: string[]
): Promise<{ distro: DistroInfo; results: CompatibilityResult[] }> {
  const r = await fetch("/api/compatibility/check", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ connectionId, catalogIds })
  });
  return readJsonOrThrow(r, "Compatibility check failed");
}

export interface VerifyResult {
  verifiedAt: string;
  addedSoftware: Array<{ name: string; version: string; source: string }>;
  removedSoftware: Array<{ name: string; version: string; source: string }>;
}

export async function verifyAfterTask(
  token: string,
  connectionId: string,
  beforeProbe: { software?: Array<{ name: string; version: string; source: string }> }
): Promise<VerifyResult> {
  const response = await fetch(`/api/connections/${encodeURIComponent(connectionId)}/verify`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ beforeProbe })
  });
  return readJsonOrThrow<VerifyResult>(response, "Verify failed");
}


// ── Schedules (cron) ─────────────────────────────────────

export interface Schedule {
  id: string;
  userId: string;
  name: string;
  planId?: string;
  approvedPlanHash?: string;
  connectionIds: string[];
  tags: string[];
  cron: string;
  dryRun: boolean;
  enabled: boolean;
  nextRunAt?: string;
  lastRunAt?: string;
  lastStatus?: "succeeded" | "failed" | "partial" | "skipped";
  createdAt: string;
  updatedAt: string;
}

export async function fetchSchedules(token: string): Promise<Schedule[]> {
  const r = await fetch("/api/schedules", { headers: { "Authorization": `Bearer ${token}` } });
  return (await readJsonOrThrow<{ schedules: Schedule[] }>(r, "Fetch schedules failed")).schedules;
}

export async function deleteSchedule(token: string, id: string): Promise<void> {
  const r = await fetch(`/api/schedules/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${token}` }
  });
  await readJsonOrThrow(r, "Delete schedule failed");
}

// ── Drift detection ──────────────────────────────────────

export interface DriftReport {
  baselineCapturedAt: string;
  checkedAt: string;
  addedSoftware: Array<{ name: string; version: string; source: string }>;
  removedSoftware: Array<{ name: string; version: string; source: string }>;
  hasDrift: boolean;
}

export async function setDriftBaseline(token: string, connectionId: string): Promise<{ id: string; capturedAt: string }> {
  const r = await fetch(`/api/connections/${encodeURIComponent(connectionId)}/drift/baseline`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` }
  });
  const data = await readJsonOrThrow<{ baseline: { id: string; capturedAt: string } }>(r, "Baseline failed");
  return data.baseline;
}

export async function runDriftCheck(token: string, connectionId: string): Promise<DriftReport> {
  const r = await fetch(`/api/connections/${encodeURIComponent(connectionId)}/drift`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const data = await readJsonOrThrow<{ report: DriftReport }>(r, "Drift check failed");
  return data.report;
}

// ── Webhooks ─────────────────────────────────────────────

export interface Webhook {
  id: string;
  userId: string;
  label: string;
  url: string;
  secret?: string;
  events: Array<"task.completed" | "task.failed" | "drift.detected" | "schedule.fired">;
  enabled: boolean;
  createdAt: string;
  lastDeliveryAt?: string;
  lastDeliveryStatus?: "success" | "failed";
  lastDeliveryError?: string;
}

export async function fetchWebhooks(token: string): Promise<Webhook[]> {
  const r = await fetch("/api/webhooks", { headers: { "Authorization": `Bearer ${token}` } });
  return (await readJsonOrThrow<{ webhooks: Webhook[] }>(r, "Fetch webhooks failed")).webhooks;
}

export async function createWebhook(token: string, input: Partial<Webhook>): Promise<Webhook> {
  const r = await fetch("/api/webhooks", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return (await readJsonOrThrow<{ webhook: Webhook }>(r, "Create webhook failed")).webhook;
}

export async function deleteWebhook(token: string, id: string): Promise<void> {
  const r = await fetch(`/api/webhooks/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${token}` }
  });
  await readJsonOrThrow(r, "Delete webhook failed");
}

export async function testWebhook(token: string, id: string): Promise<{ delivered: string; error?: string }> {
  const r = await fetch(`/api/webhooks/${encodeURIComponent(id)}/test`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` }
  });
  return readJsonOrThrow(r, "Test webhook failed");
}

// ── API tokens ───────────────────────────────────────────

export interface ApiTokenInfo {
  id: string;
  label: string;
  tokenPrefix: string;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
}

export async function fetchApiTokens(token: string): Promise<ApiTokenInfo[]> {
  const r = await fetch("/api/tokens", { headers: { "Authorization": `Bearer ${token}` } });
  return (await readJsonOrThrow<{ tokens: ApiTokenInfo[] }>(r, "Fetch tokens failed")).tokens;
}

export async function createApiToken(token: string, label: string, expiresInDays?: number): Promise<{ token: string; id: string; label: string; tokenPrefix: string }> {
  const r = await fetch("/api/tokens", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ label, expiresInDays })
  });
  return readJsonOrThrow(r, "Create token failed");
}

export async function deleteApiToken(token: string, id: string): Promise<void> {
  const r = await fetch(`/api/tokens/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${token}` }
  });
  await readJsonOrThrow(r, "Delete token failed");
}

// ── Module docs ──────────────────────────────────────────

export interface ModuleArgSpec {
  name: string;
  type: string;
  required: boolean;
  default?: string;
  description?: string;
}

export interface ModuleDoc {
  name: string;
  summary: string;
  category: string;
  args: ModuleArgSpec[];
  example: string;
  notes?: string;
}

export async function fetchModuleDocs(): Promise<ModuleDoc[]> {
  const r = await fetch("/api/modules/docs");
  return (await readJsonOrThrow<{ modules: ModuleDoc[] }>(r, "Fetch module docs failed")).modules;
}


// ── Admin: catalog management ─────────────────────────────

export type CatalogStatus = "baseline" | "modified" | "added" | "hidden";

export interface AdminCatalogList {
  items: CatalogItem[];
  status: Record<string, CatalogStatus>;
}

export interface AdminCatalogDetail {
  item: CatalogItem;
  yaml: string;
  markdown: string;
  /** Vars schema (override 优先，没有则基线，都没有则 null) */
  varsSchema: VarsSchema | null;
  hasYamlOverride: boolean;
  hasMarkdownOverride: boolean;
  hasSchemaOverride: boolean;
  isUserAdded: boolean;
}

export interface AdminCatalogInput {
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
  /**
   * varsSchema:
   *  - undefined → 不动（保留现有 override 或基线）
   *  - null → 删除 override（恢复到基线 / 没有 schema）
   *  - object → 保存为 override
   */
  varsSchema?: VarsSchema | null;
  components?: Array<{ type: "software" | "system-command" | "system-config"; label: string; labelEn: string; detail: string }>;
  deployModes?: Array<"system" | "docker">;
  hidden?: boolean;
}

export async function fetchAdminCatalog(token: string): Promise<AdminCatalogList> {
  const r = await fetch("/api/admin/catalog", { headers: { "Authorization": `Bearer ${token}` } });
  return readJsonOrThrow(r, "Fetch admin catalog failed");
}

export async function fetchAdminCatalogItem(token: string, id: string): Promise<AdminCatalogDetail> {
  const r = await fetch(`/api/admin/catalog/${encodeURIComponent(id)}`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  return readJsonOrThrow(r, "Fetch catalog item failed");
}

export async function createAdminCatalog(token: string, input: AdminCatalogInput): Promise<{ id: string }> {
  const r = await fetch("/api/admin/catalog", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return readJsonOrThrow(r, "Create catalog failed");
}

export async function updateAdminCatalog(token: string, id: string, input: AdminCatalogInput): Promise<{ ok: true }> {
  const r = await fetch(`/api/admin/catalog/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return readJsonOrThrow(r, "Update catalog failed");
}

export async function deleteAdminCatalog(token: string, id: string): Promise<void> {
  const r = await fetch(`/api/admin/catalog/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${token}` }
  });
  await readJsonOrThrow(r, "Delete catalog failed");
}

export async function resetAdminCatalog(token: string, id: string): Promise<void> {
  const r = await fetch(`/api/admin/catalog/${encodeURIComponent(id)}/reset`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` }
  });
  await readJsonOrThrow(r, "Reset catalog failed");
}

// ── Runtime detection rules (Phase B2) ───────────────────────────────
// Admin-authored detection rules generated from an archetype factory; they
// extend migrate detection only and never enter Build certification.
export type RuleArchetype = "native" | "docker-app";

/** Structural view of a backend CatalogDetectionRule (display + round-trip). */
export interface CatalogDetectionRule {
  id: string;
  displayName: string;
  capabilityKey: string;
  category: string;
  detect?: { packages?: Record<string, string[]>; binaries?: string[]; systemd?: string[]; ports?: number[] };
  migrate?: { validate?: string[] };
  [key: string]: unknown;
}

export interface RuntimeRuleOverride {
  id: string;
  archetype: RuleArchetype;
  input: Record<string, unknown>;
  rule: CatalogDetectionRule;
  createdAt: string;
  updatedAt: string;
  modifiedBy: string;
  /** Phase C: live "how close to certified?" diagnostics (never certifies). */
  readiness?: RuleReadiness;
  /** Phase C3: promotion lifecycle state. */
  promotion?: RulePromotionState;
}

export type RulePromotionStatus =
  | "detection-only"
  | "promotion-requested"
  | "bundle-generated"
  | "in-review"
  | "certified";

export interface RulePromotionState {
  status: RulePromotionStatus;
  requestedBy?: string;
  requestedAt?: string;
  prUrl?: string;
  notes?: string;
  updatedAt?: string;
}

/** Result of the shared 13-section certification audit against a draft item. */
export interface RuleReadiness {
  certificationScore: number;
  missingRequirements: string[];
  sectionResults: Record<string, { ok: boolean; reasons: string[] }>;
}

export async function generateCapabilityRule(
  token: string,
  archetype: RuleArchetype,
  params: Record<string, unknown>
): Promise<{ rule: CatalogDetectionRule; conflict: string | null; readiness?: RuleReadiness }> {
  const r = await fetch("/api/admin/capability-rules/generate", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ archetype, params })
  });
  return readJsonOrThrow(r, "Rule generation failed");
}

export async function listCapabilityRules(token: string): Promise<{ rules: RuntimeRuleOverride[] }> {
  const r = await fetch("/api/admin/capability-rules", { headers: { "Authorization": `Bearer ${token}` } });
  return readJsonOrThrow(r, "List runtime rules failed");
}

export async function saveCapabilityRule(
  token: string,
  archetype: RuleArchetype,
  params: Record<string, unknown>,
  existingId?: string
): Promise<{ ok: true; rule: RuntimeRuleOverride }> {
  const url = existingId ? `/api/admin/capability-rules/${encodeURIComponent(existingId)}` : "/api/admin/capability-rules";
  const r = await fetch(url, {
    method: existingId ? "PATCH" : "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ archetype, params })
  });
  return readJsonOrThrow(r, "Save runtime rule failed");
}

export async function deleteCapabilityRule(token: string, id: string): Promise<void> {
  const r = await fetch(`/api/admin/capability-rules/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${token}` }
  });
  await readJsonOrThrow(r, "Delete runtime rule failed");
}

/** A single artifact in a Phase C promotion bundle (text the dev applies). */
export interface PromotionBundleFile {
  path: string;
  language: "typescript" | "json";
  action: "create" | "edit";
  title: string;
  contents: string;
}

/** PR-ready set of artifacts to graduate a runtime rule to certified. */
export interface PromotionBundle {
  id: string;
  capabilityKey: string;
  readiness: RuleReadiness;
  files: PromotionBundleFile[];
  instructions: string[];
}

export async function generatePromotionBundle(token: string, id: string): Promise<{ bundle: PromotionBundle }> {
  const r = await fetch(`/api/admin/capability-rules/${encodeURIComponent(id)}/promotion-bundle`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` }
  });
  return readJsonOrThrow(r, "Generate promotion bundle failed");
}

export async function setRulePromotion(
  token: string,
  id: string,
  patch: { status?: RulePromotionStatus; prUrl?: string; notes?: string }
): Promise<{ ok: true; rule: RuntimeRuleOverride }> {
  const r = await fetch(`/api/admin/capability-rules/${encodeURIComponent(id)}/promotion`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(patch)
  });
  return readJsonOrThrow(r, "Update promotion failed");
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  createdAt: string;
  deletedAt?: string;
}

export interface AdminQueueItem {
  connectionId: string;
  running: boolean;
  queued: number;
}

export async function fetchAdminUsers(token: string): Promise<{ users: AdminUser[] }> {
  const r = await fetch("/api/admin/users", { headers: { "Authorization": `Bearer ${token}` } });
  return readJsonOrThrow(r, "Fetch admin users failed");
}

export async function updateAdminUserRole(token: string, userId: string, role: "user" | "admin"): Promise<{ user: AdminUser }> {
  const r = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/role`, {
    method: "PUT",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ role })
  });
  return readJsonOrThrow(r, "Update user role failed");
}

export async function toggleAdminUserLock(token: string, userId: string): Promise<{ user: AdminUser }> {
  const r = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/toggle-lock`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` }
  });
  return readJsonOrThrow(r, "Toggle user lock failed");
}

export async function fetchAdminQueues(token: string): Promise<{ queues: AdminQueueItem[] }> {
  const r = await fetch("/api/admin/queue", { headers: { "Authorization": `Bearer ${token}` } });
  return readJsonOrThrow(r, "Fetch admin queues failed");
}

// ── Community Comments & Suggestions ────────────────────────

export interface CatalogComment {
  id: string;
  catalogId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  content: string;
  visibility: string;
  createdAt: string;
  likesCount: number;
  likedByMe: boolean;
}

export interface CommentCursor {
  createdAt: string;
  id: string;
}

export interface CatalogSuggestion {
  id: string;
  catalogId: string | null;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  type: "new_item" | "modify";
  nameZh: string;
  nameEn: string;
  category: string | null;
  playbookYaml: string | null;
  guideMarkdown: string | null;
  remark: string | null;
  status: "pending" | "accepted" | "rejected";
  feedback: string | null;
  processedBy: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InboxMessage {
  id: string;
  userId: string;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export interface AdminReport {
  id: string;
  commentId: string;
  userId: string;
  reason: string;
  status: string;
  createdAt: string;
  commentContent: string;
  commentUsername: string;
  commentDisplayName: string;
}

// ── Comments ──

export async function fetchCatalogComments(
  catalogId: string,
  token?: string,
  cursor?: CommentCursor,
  limit = 20
): Promise<{ comments: CatalogComment[]; nextCursor?: CommentCursor }> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (cursor) {
    params.set("cursorCreatedAt", cursor.createdAt);
    params.set("cursorId", cursor.id);
  }
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const r = await fetch(`/api/catalog/${encodeURIComponent(catalogId)}/comments?${params}`, { headers });
  return readJsonOrThrow(r, "Fetch comments failed");
}

export async function postCatalogComment(
  token: string,
  catalogId: string,
  content: string
): Promise<CatalogComment> {
  const r = await fetch(`/api/catalog/${encodeURIComponent(catalogId)}/comments`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ content })
  });
  return readJsonOrThrow(r, "Post comment failed");
}

export async function toggleCommentLike(
  token: string,
  commentId: string
): Promise<{ liked: boolean; likesCount: number }> {
  const r = await fetch(`/api/catalog/comments/${encodeURIComponent(commentId)}/like`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` }
  });
  return readJsonOrThrow(r, "Toggle like failed");
}

export async function reportCatalogComment(
  token: string,
  commentId: string,
  reason: string
): Promise<{ success: boolean }> {
  const r = await fetch(`/api/catalog/comments/${encodeURIComponent(commentId)}/report`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ reason })
  });
  return readJsonOrThrow(r, "Report comment failed");
}

// ── Inbox ──

export async function fetchInboxMessages(
  token: string,
  cursor?: CommentCursor,
  limit = 20
): Promise<{ messages: InboxMessage[]; nextCursor?: CommentCursor }> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (cursor) {
    params.set("cursorCreatedAt", cursor.createdAt);
    params.set("cursorId", cursor.id);
  }
  const r = await fetch(`/api/me/inbox?${params}`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  return readJsonOrThrow(r, "Fetch inbox failed");
}

export async function markInboxRead(token: string, messageId: string): Promise<void> {
  const r = await fetch(`/api/me/inbox/${encodeURIComponent(messageId)}/read`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` }
  });
  await readJsonOrThrow(r, "Mark inbox read failed");
}

export async function deleteInboxMessage(token: string, messageId: string): Promise<void> {
  const r = await fetch(`/api/me/inbox/${encodeURIComponent(messageId)}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${token}` }
  });
  await readJsonOrThrow(r, "Delete inbox message failed");
}

export async function fetchInboxUnreadCount(token: string): Promise<number> {
  const r = await fetch("/api/me/inbox/unread-count", {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const result = await readJsonOrThrow<{ count: number }>(r, "Fetch unread inbox count failed");
  return result.count;
}

// ── Suggestions ──

export async function fetchMySuggestions(
  token: string,
  cursor?: CommentCursor,
  limit = 20
): Promise<{ suggestions: CatalogSuggestion[]; nextCursor?: CommentCursor }> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (cursor) {
    params.set("cursorCreatedAt", cursor.createdAt);
    params.set("cursorId", cursor.id);
  }
  const r = await fetch(`/api/suggestions?${params}`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  return readJsonOrThrow(r, "Fetch suggestions failed");
}

export async function submitSuggestion(
  token: string,
  input: {
    catalogId?: string;
    type: "new_item" | "modify";
    nameZh: string;
    nameEn: string;
    category?: string;
    playbookYaml?: string;
    guideMarkdown?: string;
    remark?: string;
  }
): Promise<CatalogSuggestion> {
  const r = await fetch("/api/suggestions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return readJsonOrThrow(r, "Submit suggestion failed");
}

// ── Admin: Reports ──

export async function fetchAdminReports(
  token: string,
  limit = 20,
  offset = 0
): Promise<{ reports: AdminReport[] }> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  const r = await fetch(`/api/admin/reports?${params}`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  return readJsonOrThrow(r, "Fetch admin reports failed");
}

export async function resolveAdminReport(
  token: string,
  reportId: string,
  action: "keep" | "delete"
): Promise<{ success: boolean }> {
  const r = await fetch(`/api/admin/reports/${encodeURIComponent(reportId)}/resolve`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action })
  });
  return readJsonOrThrow(r, "Resolve report failed");
}

// ── Admin: Suggestions ──

export async function fetchLegacyAdminSuggestions(
  token: string,
  status?: string,
  cursor?: CommentCursor,
  limit = 20
): Promise<{ suggestions: CatalogSuggestion[]; nextCursor?: CommentCursor }> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (status) params.set("status", status);
  if (cursor) {
    params.set("cursorCreatedAt", cursor.createdAt);
    params.set("cursorId", cursor.id);
  }
  const r = await fetch(`/api/admin/suggestions?${params}`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  return readJsonOrThrow(r, "Fetch admin suggestions failed");
}

export async function fetchAdminSuggestionDetail(
  token: string,
  id: string
): Promise<CatalogSuggestion> {
  const r = await fetch(`/api/admin/suggestions/${encodeURIComponent(id)}`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  return readJsonOrThrow(r, "Fetch suggestion detail failed");
}

export async function processLegacyAdminSuggestion(
  token: string,
  id: string,
  action: "accepted" | "rejected",
  feedback?: string
): Promise<{ success: boolean }> {
  const r = await fetch(`/api/admin/suggestions/${encodeURIComponent(id)}/process`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action, feedback })
  });
  return readJsonOrThrow(r, "Process suggestion failed");
}
