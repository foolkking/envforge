import { Button } from "./components/ui/Button";
import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import { Bell, CheckCircle2, Home, Languages, LogOut, Menu, Moon, MoreHorizontal, Search, Sun, Trash2, UserRound, X } from "lucide-react";
import {
  connectServer,
  deleteConnection,
  fetchCatalog,
  fetchCatalogGuide,
  fetchConnections,
  fetchCurrentUser,
  fetchMigrationStrategies,
  fetchProfiles,
  reprobeConnection,
  updateConnection,
  updateProfile,
  fetchSshKeys,
  confirmPasswordReset,
  deleteInboxMessage,
  fetchInboxMessages,
  fetchInboxUnreadCount,
  fetchAuthProviders,
  markInboxRead,
  loginAccount,
  loginVerify2FA,
  requestPasswordReset,
  startRegistration,
  verifyRegistration,
  type AgentProbeResult,
  type AuthUser,
  type CatalogGuide,
  type CatalogItem,
  type ConnectionProfile,
  type CurrentUser,
  type ExecutionTask,
  type InboxMessage,
  type MigrationStrategy,
  type SshKeyMeta,
  type UserProfile
} from "./api";
import { navItems, navItemsForRole, type Locale, type Page } from "./lib/types";
import { NAV_PAGE_DESCRIPTION_KEYS, NAV_PAGE_LABEL_KEYS, navGroupsForRole } from "./lib/nav";
import { useEscapeToClose } from "./lib/useEscapeToClose";
import { DialogHost, toast } from "./lib/dialogs";
import { MachinePage } from "./pages/MachinePage";
import { CapabilityCatalogPage } from "./pages/CapabilityCatalogPage";
import { CapabilityRulesAdminPage } from "./pages/CapabilityRulesAdminPage";
import { DashboardPage } from "./pages/DashboardPage";
import { PlanRecipesPage } from "./pages/PlanRecipesPage";
import { fetchPlaybooks, type StoredPlaybook } from "./api";
import { TerminalPanel } from "./components/TerminalPanel";
import { MarkdownOverlay } from "./components/MarkdownOverlay";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { AccountPanel } from "./components/AccountPanel";
import { i18n as appI18n, normalizeLanguage } from "./i18n";
import "@fontsource-variable/noto-sans-sc/index.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
import "./styles.css";

type ConnectionMethod = "ssh-password" | "ssh-key";

const pageRoutes: Record<Page, string> = {
  dashboard: "dashboard",
  migrate: "migrate",
  build: "build",
  catalog: "admin",
  plans: "plans",
  reports: "reports"
};

function pageFromPathname(pathname: string): Page {
  const segments = pathname.replace(/^\/+/, "").split("/").filter(Boolean);
  const route = segments[0] === "app" ? segments[1] : segments[0];
  const routeMap: Record<string, Page> = {
    dashboard: "dashboard",
    migrate: "migrate",
    machine: "migrate",
    build: "build",
    market: "build",
    admin: "catalog",
    catalog: "catalog",
    plans: "plans",
    playbooks: "plans",
    reports: "plans"
  };
  return routeMap[route ?? ""] ?? "dashboard";
}

/** Reports merged into the Plans center as its `reports` tab; legacy
 *  /app/reports deep links should land there instead of a standalone page. */
function isReportsPath(pathname: string): boolean {
  const segments = pathname.replace(/^\/+/, "").split("/").filter(Boolean);
  const route = segments[0] === "app" ? segments[1] : segments[0];
  return route === "reports";
}

function isAppPath(pathname: string): boolean {
  return pathname === "/app" || pathname.startsWith("/app/");
}

const publicPaths = new Set(["/", "/login", "/register", "/docs", "/demo"]);

function normalizePublicPath(pathname: string): string {
  if (publicPaths.has(pathname) || pathname.startsWith("/auth/password-reset")) return pathname;
  return "/";
}

function App() {
  const { i18n } = useTranslation();
  const [locale, setLocale] = useState<Locale>(() => normalizeLanguage(appI18n.language));
  const [shellMode, setShellMode] = useState<"public" | "app">(() => isAppPath(window.location.pathname) ? "app" : "public");
  const [page, setPage] = useState<Page>(() => pageFromPathname(window.location.pathname));
  const [requestedView, setRequestedView] = useState<string | null>(() => isReportsPath(window.location.pathname) ? "reports" : null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [userPlaybooks, setUserPlaybooks] = useState<StoredPlaybook[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [strategies, setStrategies] = useState<MigrationStrategy[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [guide, setGuide] = useState<CatalogGuide | null>(null);
  const [query, setQuery] = useState("");
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxMessages, setInboxMessages] = useState<InboxMessage[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxError, setInboxError] = useState("");
  const [inboxUnreadCount, setInboxUnreadCount] = useState(0);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<"light" | "dark">(() => localStorage.getItem("envforge_theme") === "dark" ? "dark" : "light");
  const [connected, setConnected] = useState(false);
  const [method, setMethod] = useState<ConnectionMethod>("ssh-password");

  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [authDialog, setAuthDialog] = useState<"login" | "register" | "twofa" | null>(() => {
    if (localStorage.getItem("envforge_pending_2fa")) return "twofa";
    if (window.location.pathname === "/login") return "login";
    if (window.location.pathname === "/register") return "register";
    return null;
  });

  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem("envforge_user");
      return saved ? JSON.parse(saved) as AuthUser : null;
    } catch { return null; }
  });
  const [authToken, setAuthToken] = useState(() => localStorage.getItem("envforge_token") ?? "");
  const [sshKeys, setSshKeys] = useState<SshKeyMeta[]>([]);

  async function reloadInbox() {
    if (!authToken || shellMode !== "app") {
      setInboxMessages([]);
      setInboxUnreadCount(0);
      return;
    }
    setInboxLoading(true);
    setInboxError("");
    try {
      const [result, unread] = await Promise.all([
        fetchInboxMessages(authToken, undefined, 30),
        fetchInboxUnreadCount(authToken)
      ]);
      setInboxMessages(result.messages);
      setInboxUnreadCount(unread);
    } catch (error) {
      setInboxError(error instanceof Error ? error.message : "Inbox failed");
    } finally {
      setInboxLoading(false);
    }
  }

  useEffect(() => {
    void reloadInbox();
  }, [authToken, shellMode]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    localStorage.setItem("envforge_theme", themeMode);
  }, [themeMode]);

  // Legacy /app/reports → Plans center (reports tab). Normalize the URL once
  // so the address bar matches the merged location.
  useEffect(() => {
    if (isReportsPath(window.location.pathname)) {
      window.history.replaceState(null, "", "/app/plans");
    }
  }, []);

  useEffect(() => {
    const syncLanguage = (language: string) => {
      const next = normalizeLanguage(language);
      setLocale(next);
      localStorage.setItem("envforge_locale", next);
    };
    syncLanguage(i18n.language);
    i18n.on("languageChanged", syncLanguage);
    return () => {
      i18n.off("languageChanged", syncLanguage);
    };
  }, [i18n]);

  async function toggleLocale() {
    const next = locale === "zh" ? "en" : "zh";
    localStorage.setItem("envforge_locale", next);
    setLocale(next);
    await i18n.changeLanguage(next);
  }

  // Capability Admin (catalog) is admin-only. If a non-admin lands on
  // /catalog (stale localStorage, deep link, or role downgrade), send
  // them to Build. The render block also shows a "Go to Build" notice
  // as a belt-and-braces fallback.
  useEffect(() => {
    if (page === "catalog" && authUser?.role !== "admin") {
      setPage("build");
      if (shellMode === "app") window.history.replaceState(null, "", `/app/${pageRoutes.build}`);
    }
  }, [page, authUser, shellMode]);

  async function handleMarkInboxRead(messageId: string) {
    if (!authToken) return;
    await markInboxRead(authToken, messageId);
    setInboxMessages((messages) => messages.map((message) => message.id === messageId ? { ...message, isRead: true } : message));
    setInboxUnreadCount((count) => Math.max(0, count - 1));
  }

  async function handleDeleteInboxMessage(messageId: string) {
    if (!authToken) return;
    const deleted = inboxMessages.find((message) => message.id === messageId);
    await deleteInboxMessage(authToken, messageId);
    setInboxMessages((messages) => messages.filter((message) => message.id !== messageId));
    if (deleted && !deleted.isRead) setInboxUnreadCount((count) => Math.max(0, count - 1));
  }
  const [connectionProfile, setConnectionProfile] = useState<ConnectionProfile | null>(null);
  const [connections, setConnections] = useState<ConnectionProfile[]>([]);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState("");
  const [probeResult, setProbeResult] = useState<AgentProbeResult | null>(null);
  const [probing, setProbing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
  const [activeTask, setActiveTask] = useState<ExecutionTask | null>(null);
  const [terminalLogs, setTerminalLogs] = useState<Array<{ time: string; type: "info" | "success" | "error" | "cmd"; text: string }>>([]);

  function navigatePublic(path = "/") {
    const safePath = normalizePublicPath(path);
    setMoreMenuOpen(false);
    setShellMode("public");
    if (safePath === "/login") setAuthDialog("login");
    else if (safePath === "/register") setAuthDialog("register");
    else if (authDialog !== "twofa") setAuthDialog(null);
    window.history.pushState(null, "", safePath);
  }

  function navigateApp(target: Page = page, view?: string) {
    setMoreMenuOpen(false);
    setNavOpen(false);
    setRequestedView(view ?? null);
    if (!authToken) {
      setShellMode("public");
      setAuthDialog("login");
      window.history.pushState(null, "", "/login");
      return;
    }
    const safeTarget = target === "catalog" && authUser?.role !== "admin" ? "build" : target;
    setPage(safeTarget);
    setShellMode("app");
    if (authDialog !== "twofa") setAuthDialog(null);
    window.history.pushState(null, "", `/app/${pageRoutes[safeTarget]}`);
  }

  const activeConnection = connections.find((c) => c.id === activeConnectionId) ?? connectionProfile ?? null;
  const activeProbe = (activeConnection?.probeSnapshot as AgentProbeResult | undefined) ?? probeResult;

  function pushLog(type: "info" | "success" | "error" | "cmd", text: string) {
    setTerminalLogs((prev) => [...prev.slice(-200), { time: new Date().toLocaleTimeString(), type, text }]);
  }

  useEffect(() => {
    void handleAuthLandingFragments();
  }, []);

  useEffect(() => {
    if (shellMode === "app" && authToken) {
      if (window.location.pathname === "/app") {
        window.history.replaceState(null, "", "/app/dashboard");
      }
      fetch("/api/auth/session", { headers: { Authorization: `Bearer ${authToken}` } })
        .then((res) => {
          if (!res.ok) {
            setAuthToken("");
            setAuthUser(null);
            localStorage.removeItem("envforge_token");
            localStorage.removeItem("envforge_user");
          }
        })
        .catch(() => { /* offline, keep local state */ });
      void load(authToken, { includePrivate: true });
      return;
    }

    if (shellMode === "public") {
      clearPrivateWorkspaceData();
      const normalizedPath = normalizePublicPath(window.location.pathname);
      if (normalizedPath !== window.location.pathname) {
        window.history.replaceState(null, "", normalizedPath);
      }
      if (authToken && (window.location.pathname === "/login" || window.location.pathname === "/register") && authDialog !== "twofa") {
        setAuthDialog(null);
        window.history.replaceState(null, "", "/");
      }
    }
  }, [shellMode, authToken]);

  useEffect(() => {
    const onPopState = () => {
      const normalizedPath = isAppPath(window.location.pathname) ? window.location.pathname : normalizePublicPath(window.location.pathname);
      if (normalizedPath !== window.location.pathname) {
        window.history.replaceState(null, "", normalizedPath);
      }
      const nextMode = isAppPath(window.location.pathname) ? "app" : "public";
      setShellMode(nextMode);
      setPage(pageFromPathname(window.location.pathname));
      if (window.location.pathname === "/login") setAuthDialog("login");
      else if (window.location.pathname === "/register") setAuthDialog("register");
      else if (nextMode === "public") setAuthDialog(null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (shellMode === "app" && !authToken) {
      setShellMode("public");
      setAuthDialog("login");
      window.history.replaceState(null, "", "/login");
    }
  }, [shellMode, authToken]);

  async function handleAuthLandingFragments() {
    const url = new URL(window.location.href);
    const fragment = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const fragParams = new URLSearchParams(fragment);

    // 1. OAuth callback (regular login)
    const oauthToken = fragParams.get("token");
    if (oauthToken && !fragParams.has("2fa") && !fragParams.has("enroll")) {
      try {
        const res = await fetch("/api/auth/session", {
          headers: { Authorization: `Bearer ${oauthToken}` }
        });
        if (res.ok) {
          const body = await res.json() as { user: AuthUser };
          handleAuthSuccess({ token: oauthToken, user: body.user }, "replace");
          return;
        }
      } catch { /* fall through */ }
    }

    // 2. OAuth callback signaling TOTP gate
    const intermediate = fragParams.get("intermediateToken");
    if (fragParams.has("2fa") && intermediate) {
      localStorage.setItem("envforge_pending_2fa", intermediate);
      history.replaceState(null, "", "/login");
      setAuthDialog("twofa");
      return;
    }

    // 3. OAuth callback for admin-enrollment
    if (fragParams.has("enroll") && oauthToken) {
      localStorage.setItem("envforge_enrollment_token", oauthToken);
      history.replaceState(null, "", url.origin + url.pathname);
      toast(i18n.t("auth.admin2faRequired"), "info");
      setShellMode("app");
      setPage("dashboard");
      history.replaceState(null, "", "/app/dashboard");
      return;
    }

    // 4. OAuth link success callback
    const oauthLinked = url.searchParams.get("oauth") === "linked" || fragParams.get("oauth") === "linked";
    if (oauthLinked) {
      const provider = url.searchParams.get("provider") || fragParams.get("provider") || "OAuth";
      toast(i18n.t("auth.oauthLinked", { provider }), "success");
      setShellMode("app");
      setPage("dashboard");
      history.replaceState(null, "", "/app/dashboard");
      return;
    }

    // 5. OAuth error
    const oauthError = url.searchParams.get("oauth_error") || fragParams.get("oauth_error");
    if (oauthError) {
      const conflictEmail = url.searchParams.get("email") || fragParams.get("email");
      const msg = oauthError === "email_conflict"
        ? i18n.t("auth.oauthEmailConflict", { email: conflictEmail ?? "" })
        : i18n.t("auth.oauthLoginFailed", { error: oauthError });
      toast(msg, "error");
      history.replaceState(null, "", url.origin + "/");
      return;
    }

    // 5. Password reset confirm landing
    const urlResetToken = url.searchParams.get("token");
    if (url.pathname.startsWith("/auth/password-reset") && urlResetToken) {
      setResetToken(urlResetToken);
      history.replaceState(null, "", url.origin + "/");
      return;
    }
  }

  async function load(token?: string, options: { includePrivate?: boolean } = {}) {
    const activeToken = token ?? authToken;
    const includePrivate = options.includePrivate ?? Boolean(activeToken);
    const [catalogResult, userResult] = await Promise.allSettled([
      fetchCatalog(),
      includePrivate ? fetchCurrentUser(activeToken) : Promise.resolve(null)
    ]);
    const strategyResult = await fetchMigrationStrategies().catch(() => []);
    if (catalogResult.status === "fulfilled") setCatalog(catalogResult.value);
    if (userResult.status === "fulfilled" && userResult.value) setCurrentUser(userResult.value);
    setStrategies(strategyResult);
    if (token && includePrivate) {
      void fetchPlaybooks(token).then(setUserPlaybooks).catch(() => setUserPlaybooks([]));
    }

    if (activeToken && includePrivate) {
      const [conns, profs, keys] = await Promise.all([
        fetchConnections(activeToken).catch(() => [] as ConnectionProfile[]),
        fetchProfiles(activeToken).catch(() => [] as UserProfile[]),
        fetchSshKeys(activeToken).catch(() => [] as SshKeyMeta[])
      ]);
      setConnections(conns);
      const retainedConnection = activeConnectionId ? conns.find((connection) => connection.id === activeConnectionId) : undefined;
      const defaultConnection = retainedConnection ?? conns.find((connection) => connection.status === "probed") ?? conns[0];
      if (defaultConnection) {
        setActiveConnectionId(defaultConnection.id);
        setConnectionProfile(defaultConnection);
        setConnected(true);
        setProbeResult(defaultConnection.probeSnapshot ? defaultConnection.probeSnapshot as AgentProbeResult : null);
      } else {
        setActiveConnectionId(null);
        setConnectionProfile(null);
        setConnected(false);
        setProbeResult(null);
      }
      setUserProfiles(profs);
      setSshKeys(keys);
    }
  }

  async function handleScan() {
    if (!authToken || !activeConnectionId) return;
    pushLog("cmd", `ssh reprobe -> ${activeConnectionId}`);
    pushLog("info", i18n.t("runtime.recollectingSsh"));
    try {
      const updated = await reprobeConnection(authToken, activeConnectionId);
      setConnections((prev) => prev.map((c) => c.id === updated.id ? updated : c));
      if (updated.probeSnapshot) {
        setProbeResult(updated.probeSnapshot as AgentProbeResult);
        const sw = updated.probeSnapshot.software?.length ?? 0;
        pushLog("success", i18n.t("runtime.collectionDone", { count: sw, time: new Date(updated.probeSnapshot.collectedAt).toLocaleTimeString() }));
      } else {
        pushLog("error", i18n.t("runtime.collectionNoData"));
      }
    } catch (err) {
      pushLog("error", err instanceof Error ? err.message : i18n.t("runtime.scanFailed"));
    }
  }

  async function handleConnect(fields: Record<string, string>, agentUrl: string) {
    setConnectionError("");
    setProbing(true);
    if (!authToken) {
      setConnectionError(i18n.t("runtime.loginBeforeSaveConnection"));
      setProbing(false);
      return;
    }

    const host = fields.host || "unknown";
    const port = fields.port || "22";
    const user = fields.username || "root";
    pushLog("cmd", `ssh ${user}@${host}:${port}`);
    pushLog("info", i18n.t("runtime.connectingSsh", { host, port }));

    try {
      const result = await connectServer({
        token: authToken,
        method,
        label: fields.host || fields.contextName || method,
        fields: Object.fromEntries(Object.entries(fields).filter(([k]) => k !== "_keyId")),
        keyId: fields._keyId || undefined
      });
      setConnectionProfile(result.connection);
      setActiveConnectionId(result.connection.id);
      setConnected(true);
      if (result.probe) {
        setProbeResult(result.probe as AgentProbeResult);
        const sw = result.probe.software?.length ?? 0;
        pushLog("success", i18n.t("runtime.sshConnectedCollected", { count: sw }));
        pushLog("info", `hostname: ${result.probe.system.hostname}, OS: ${result.probe.system.platform} ${result.probe.system.arch}`);
      } else if (result.connection.status === "ssh_failed") {
        pushLog("error", i18n.t("runtime.sshFailed", { error: result.connection.sshError ?? i18n.t("runtime.unknownError") }));
      } else {
        pushLog("info", i18n.t("runtime.connectionSavedNoData"));
      }
      const conns = await fetchConnections(authToken).catch(() => connections);
      setConnections(conns);
    } catch (error) {
      setConnected(false);
      const msg = error instanceof Error ? error.message : "Connection failed";
      setConnectionError(msg);
      pushLog("error", msg);
    } finally {
      setProbing(false);
    }
  }

  async function handleReprobe(connectionId: string) {
    if (!authToken) return;
    const conn = connections.find((c) => c.id === connectionId);
    const host = conn?.fields?.host ?? "unknown";
    pushLog("cmd", `ssh reprobe -> ${host}`);
    pushLog("info", i18n.t("runtime.reprobing", { host }));
    setProbing(true);
    try {
      const updated = await reprobeConnection(authToken, connectionId);
      setConnections((prev) => prev.map((c) => c.id === updated.id ? updated : c));
      if (updated.probeSnapshot) {
        if (connectionId === activeConnectionId) {
          setProbeResult(updated.probeSnapshot as AgentProbeResult);
        }
        const sw = updated.probeSnapshot.software?.length ?? 0;
        pushLog("success", i18n.t("runtime.reprobeDone", { count: sw, time: new Date(updated.probeSnapshot.collectedAt).toLocaleTimeString() }));
      } else {
        pushLog("error", updated.sshError ?? i18n.t("runtime.probeFailed"));
      }
    } catch (err) {
      pushLog("error", err instanceof Error ? err.message : "Reprobe failed");
    } finally {
      setProbing(false);
    }
  }

  async function handleDeleteConnection(id: string) {
    if (!authToken) return;
    try {
      await deleteConnection(authToken, id);
      setConnections((prev) => prev.filter((c) => c.id !== id));
      if (activeConnectionId === id) {
        setActiveConnectionId(null);
        setConnected(false);
        setProbeResult(null);
        setConnectionProfile(null);
      }
    } catch { /* silent */ }
  }

  async function handleUpdateConnection(id: string, input: { label?: string; agentUrl?: string; tags?: string[] }) {
    if (!authToken) return;
    try {
      const updated = await updateConnection(authToken, id, input);
      setConnections((prev) => prev.map((c) => c.id === id ? updated : c));
    } catch { /* silent */ }
  }

  function handleAuthSuccess(result: { token: string; user: AuthUser }, navigation: "push" | "replace" = "push") {
    setAuthToken(result.token);
    setAuthUser(result.user);
    setShellMode("app");
    setPage("dashboard");
    setShowOnboarding(localStorage.getItem("envforge_onboarded") !== "1");
    localStorage.setItem("envforge_token", result.token);
    localStorage.setItem("envforge_user", JSON.stringify(result.user));
    if (navigation === "replace") window.history.replaceState(null, "", "/app/dashboard");
    else window.history.pushState(null, "", "/app/dashboard");
    void load(result.token, { includePrivate: true });
  }

  function handleLogout() {
    setAccountModalOpen(false);
    setMoreMenuOpen(false);
    setAuthToken("");
    setAuthUser(null);
    setConnected(false);
    setConnectionProfile(null);
    setUserProfiles([]);
    clearPrivateWorkspaceData();
    localStorage.removeItem("envforge_token");
    localStorage.removeItem("envforge_user");
    setShellMode("public");
    setPage("dashboard");
    window.history.pushState(null, "", "/");
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filteredCatalog = useMemo(() => {
    const lower = query.trim().toLowerCase();
    return catalog.filter((item) => {
      const matchesQuery =
        !lower ||
        [item.name, item.nameEn, item.summary, item.summaryEn, item.category]
          .join(" ")
          .toLowerCase()
          .includes(lower);
      return matchesQuery;
    });
  }, [catalog, query]);

  function clearPrivateWorkspaceData() {
    setCurrentUser(null);
    setConnections([]);
    setConnectionProfile(null);
    setActiveConnectionId(null);
    setConnected(false);
    setProbeResult(null);
    setSelected(new Set());
    setUserProfiles([]);
    setUserPlaybooks([]);
    setSshKeys([]);
    setActiveTask(null);
    setTerminalLogs([]);
    setInboxOpen(false);
    setInboxMessages([]);
    setInboxUnreadCount(0);
  }

  const accountSettingsModal = accountModalOpen && authToken ? (
    <AccountSettingsModal locale={locale} authToken={authToken} onClose={() => setAccountModalOpen(false)} />
  ) : null;

  const showPublicShell = shellMode === "public" || !authToken;
  if (showPublicShell) {
    return (
      <>
        <PublicLanding
          locale={locale}
          isAuthenticated={Boolean(authToken && authUser)}
          authUser={authUser}
          themeMode={themeMode}
          moreMenuOpen={moreMenuOpen}
          onLocale={() => void toggleLocale()}
          onTheme={() => setThemeMode((value) => value === "dark" ? "light" : "dark")}
          onToggleMore={() => setMoreMenuOpen((value) => !value)}
          onCloseMore={() => setMoreMenuOpen(false)}
          onLogin={() => navigatePublic("/login")}
          onRegister={() => navigatePublic("/register")}
          onNavigatePublic={navigatePublic}
          onEnterApp={() => navigateApp("dashboard")}
          onAccount={() => setAccountModalOpen(true)}
          onLogout={handleLogout}
        />
        {authDialog ? (
          <AuthDialog
            mode={authDialog}
            locale={locale}
            onMode={setAuthDialog}
            onClose={() => {
              setAuthDialog(null);
              if (window.location.pathname === "/login" || window.location.pathname === "/register") {
                window.history.replaceState(null, "", "/");
              }
            }}
            onSuccess={(result) => {
              localStorage.removeItem("envforge_pending_2fa");
              handleAuthSuccess(result);
              setAuthDialog(null);
            }}
          />
        ) : null}
        {resetToken ? (
          <PasswordResetModal
            token={resetToken}
            value={newPassword}
            onChange={setNewPassword}
            onCancel={() => { setResetToken(null); setNewPassword(""); }}
            onConfirm={async () => {
              if (newPassword.length < 8) { toast(i18n.t("auth.passwordTooShort"), "error"); return; }
              try {
                await confirmPasswordReset({ token: resetToken, newPassword });
                toast(i18n.t("auth.passwordResetDone"), "success");
                setResetToken(null);
                setNewPassword("");
                setAuthDialog("login");
                window.history.replaceState(null, "", "/login");
              } catch (err) {
                toast(err instanceof Error ? err.message : i18n.t("auth.resetFailed"), "error");
              }
            }}
          />
        ) : null}
        {accountSettingsModal}
      </>
    );
  }

  return (
    <main className="app-shell">
      {navOpen ? <div className="nav-backdrop" onClick={() => setNavOpen(false)} aria-hidden /> : null}
      <aside className={`sidebar ${navOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">E</div>
          <div>
            <strong>{i18n.t("app.name")}</strong>
            <span>{i18n.t("app.subtitle")}</span>
          </div>
        </div>

        <nav className="main-nav">
          {navGroupsForRole(authUser?.role).map((group) => (
            <div className="nav-group" key={group.id}>
              <span className="nav-group-label">{i18n.t(group.labelKey)}</span>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    className={page === item.id ? "active" : ""}
                    key={item.id}
                    type="button"
                    title={i18n.t(NAV_PAGE_DESCRIPTION_KEYS[item.id])}
                    onClick={() => navigateApp(item.id)}
                  >
                    <Icon aria-hidden />
                    <span className="nav-item-copy">
                      <span className="nav-item-label">{i18n.t(NAV_PAGE_LABEL_KEYS[item.id])}</span>
                      <span className="nav-item-description">{i18n.t(NAV_PAGE_DESCRIPTION_KEYS[item.id])}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar workbench-topbar">
          <button type="button" className="nav-toggle" aria-label={i18n.t("shell.more")} onClick={() => setNavOpen(true)}>
            <Menu aria-hidden />
          </button>
          <div className="topbar-context compact-topbar-context">
            <h1>{i18n.t(NAV_PAGE_LABEL_KEYS[page])}</h1>
          </div>

          <div className="topbar-middle-slot">
            {page === "build" ? (
            <label className="search-box topbar-search">
              <Search aria-hidden />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={i18n.t("shell.search")} />
            </label>
            ) : null}
          </div>

          <div className="top-actions">
            <Button variant="primary" className="topbar-route-action" type="button" onClick={() => navigatePublic("/")}>
              <Home aria-hidden />
              {i18n.t("shell.home")}
            </Button>
            <TopbarMoreMenu
              locale={locale}
              authUser={authUser}
              themeMode={themeMode}
              open={moreMenuOpen}
              inboxUnreadCount={inboxUnreadCount}
              onToggleOpen={() => setMoreMenuOpen((value) => !value)}
              onClose={() => setMoreMenuOpen(false)}
              onAccount={() => { setAccountModalOpen(true); setMoreMenuOpen(false); }}
              onInbox={authUser ? () => { setMoreMenuOpen(false); setInboxOpen(true); void reloadInbox(); } : undefined}
              onLocale={() => void toggleLocale()}
              onTheme={() => setThemeMode((value) => value === "dark" ? "light" : "dark")}
              onLogout={authUser ? handleLogout : undefined}
            />
          </div>
        </header>

        {inboxOpen ? (
          <div className="inbox-drawer" role="dialog" aria-label={i18n.t("shell.inbox")}>
            <div className="inbox-drawer-header">
              <div>
                <h2>{i18n.t("shell.inbox")}</h2>
                <p>{i18n.t("shell.unreadMessages", { count: inboxUnreadCount })}</p>
              </div>
              <button className="icon-action" type="button" onClick={() => setInboxOpen(false)} aria-label={i18n.t("shell.closeInbox")}>
                <X aria-hidden />
              </button>
            </div>
            {inboxError ? <p className="connection-error">{inboxError}</p> : null}
            {inboxLoading ? (
              <p className="empty-hint">{i18n.t("shell.loadingInbox")}</p>
            ) : inboxMessages.length === 0 ? (
              <p className="empty-hint">{i18n.t("shell.noMessages")}</p>
            ) : (
              <ul className="inbox-list">
                {inboxMessages.map((message) => (
                  <li className={message.isRead ? "inbox-item" : "inbox-item unread"} key={message.id}>
                    <div>
                      <strong>{message.title}</strong>
                      <p>{message.content}</p>
                      <time>{new Date(message.createdAt).toLocaleString()}</time>
                    </div>
                    <div className="inbox-item-actions">
                      {!message.isRead ? (
                        <button className="icon-action" type="button" onClick={() => void handleMarkInboxRead(message.id)} title={i18n.t("shell.markRead")}>
                          <CheckCircle2 aria-hidden />
                        </button>
                      ) : null}
                      <button className="icon-action danger" type="button" onClick={() => void handleDeleteInboxMessage(message.id)} title={i18n.t("shell.delete")}>
                        <Trash2 aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {page === "dashboard" && authToken ? (
          <DashboardPage
            authToken={authToken}
            locale={locale}
            connections={connections}
            authUser={authUser}
            activeConnection={activeConnection}
            activeProbe={activeProbe ?? null}
            userProfiles={userProfiles}
            inboxUnreadCount={inboxUnreadCount}
            onJump={(target) => navigateApp(target as Page)}
            onAccount={() => setAccountModalOpen(true)}
          />
        ) : null}

        {page === "catalog" ? (
          authUser?.role === "admin" && authToken ? (
            <CapabilityRulesAdminPage
              authToken={authToken}
              isAdmin={true}
              locale={locale}
            />
          ) : (
            <div className="catalog-user-redirect" style={{ padding: 24, maxWidth: 640 }}>
              <h1 style={{ marginTop: 0 }}>{i18n.t("governance.admin.userRedirectTitle")}</h1>
              <p style={{ color: "#475569" }}>
                {i18n.t("governance.admin.userRedirectBody")}
              </p>
              <Button variant="primary"
                type="button"

                onClick={() => navigateApp("build")}
                style={{ marginTop: 8 }}
              >
                {i18n.t("governance.admin.goToBuild")}
              </Button>
            </div>
          )
        ) : null}

        {page === "migrate" ? (
          <MachinePage
            locale={locale}
            connections={connections}
            activeConnectionId={activeConnectionId}
            connected={connected}
            connectionProfile={connectionProfile}
            connectionError={connectionError}
            probeResult={activeProbe ?? null}
            probing={probing}
            method={method}
            onMethod={setMethod}
            onConnect={handleConnect}
            onSelectConnection={(id) => {
              setActiveConnectionId(id);
              const conn = connections.find((c) => c.id === id);
              if (conn?.probeSnapshot) {
                setProbeResult(conn.probeSnapshot as AgentProbeResult);
                setConnected(true);
                pushLog("info", `Selected: ${conn.label} (${conn.fields.host})`);
              } else {
                setConnected(true);
                setProbeResult(null);
                pushLog("info", `Selected: ${conn?.label ?? id} (no cached data, click reprobe)`);
              }
            }}
            onReprobe={handleReprobe}
            onScan={handleScan}
            authToken={authToken}
            sshKeys={sshKeys}
            onSshKeysChange={setSshKeys}
            onDeleteConnection={handleDeleteConnection}
            onUpdateConnection={handleUpdateConnection}
            pushLog={pushLog}
            onNavigateToPlans={() => navigateApp("plans", "plans")}
          />
        ) : null}

        {page === "build" ? (
          <CapabilityCatalogPage
            locale={locale}
            items={filteredCatalog}
            selected={selected}
            onOpenGuide={async (id) => setGuide(await fetchCatalogGuide(id))}
            onToggle={toggleSelected}
            authToken={authToken}
            activeConnectionId={activeConnectionId}
            activeTask={activeTask}
            onTaskUpdate={setActiveTask}
            onNavigateToPlans={() => navigateApp("plans", "plans")}
          />
        ) : null}

        {page === "plans" ? (
          <PlanRecipesPage
            locale={locale}
            authToken={authToken}
            connections={connections}
            playbooks={userPlaybooks}
            catalog={catalog}
            activeTask={activeTask}
            onTaskUpdate={setActiveTask}
            initialOpsTab={page === "plans" ? (requestedView as "plans" | "runs" | "schedules" | "drift" | "webhooks" | "reports" | null) : null}
          />
        ) : null}

        {guide ? <MarkdownOverlay guide={guide} locale={locale} authToken={authToken} onClose={() => setGuide(null)} /> : null}
        {authDialog ? (
          <AuthDialog
            mode={authDialog}
            locale={locale}
            onMode={setAuthDialog}
            onClose={() => setAuthDialog(null)}
            onSuccess={(result) => {
              localStorage.removeItem("envforge_pending_2fa");
              handleAuthSuccess(result);
              setAuthDialog(null);
            }}
          />
        ) : null}
        {accountSettingsModal}
        {showOnboarding ? <OnboardingWizard locale={locale} onClose={() => setShowOnboarding(false)} /> : null}
      </section>

      {connected ? (
        <TerminalPanel
          locale={locale}
          activeTask={activeTask}
          activeConnection={activeConnection}
          terminalLogs={terminalLogs}
          onClose={() => setActiveTask(null)}
        />
      ) : null}

      {resetToken ? (
        <PasswordResetModal
          token={resetToken}
          value={newPassword}
          onChange={setNewPassword}
          onCancel={() => { setResetToken(null); setNewPassword(""); }}
          onConfirm={async () => {
            if (newPassword.length < 8) { toast(i18n.t("auth.passwordTooShort"), "error"); return; }
            try {
              await confirmPasswordReset({ token: resetToken, newPassword });
              toast(i18n.t("auth.passwordResetDone"), "success");
              setResetToken(null);
              setNewPassword("");
              setAuthDialog("login");
              navigatePublic("/login");
            } catch (err) {
              toast(err instanceof Error ? err.message : i18n.t("auth.resetFailed"), "error");
            }
          }}
        />
      ) : null}

    </main>
  );
}

function TopbarMoreMenu({
  locale,
  authUser,
  themeMode,
  open,
  inboxUnreadCount,
  onToggleOpen,
  onClose,
  onAccount,
  onInbox,
  onLocale,
  onTheme,
  onLogout
}: {
  locale: Locale;
  authUser: AuthUser | null;
  themeMode: "light" | "dark";
  open: boolean;
  inboxUnreadCount?: number;
  onToggleOpen: () => void;
  onClose: () => void;
  onAccount?: () => void;
  onInbox?: () => void;
  onLocale: () => void;
  onTheme: () => void;
  onLogout?: () => void;
}) {
  const { t: tx } = useTranslation();
  const accountInitial = (authUser?.displayName || authUser?.name || "U").slice(0, 1).toUpperCase();
  const nextLanguage = tx("shell.switchLanguage");
  const nextTheme = themeMode === "dark" ? tx("shell.themeLight") : tx("shell.themeDark");

  return (
    <div className="topbar-more-wrap">
      <Button variant="ghost" className="more-action" type="button" onClick={onToggleOpen} aria-expanded={open} aria-haspopup="menu">
        {authUser ? <span className="more-avatar">{accountInitial}</span> : <MoreHorizontal aria-hidden />}
        <span>{tx("shell.more")}</span>
      </Button>
      {open ? (
        <div className="topbar-more-menu" role="menu">
          {authUser && onAccount ? (
            <button type="button" role="menuitem" onClick={onAccount}>
              <UserRound aria-hidden />
              <span>{tx("shell.accountSecurity")}</span>
            </button>
          ) : null}
          {onInbox ? (
            <button type="button" role="menuitem" onClick={onInbox}>
              <Bell aria-hidden />
              <span>{tx("shell.notifications")}</span>
              {inboxUnreadCount ? <b>{inboxUnreadCount > 99 ? "99+" : inboxUnreadCount}</b> : null}
            </button>
          ) : null}
          <div role="separator" aria-hidden style={{ height: 1, margin: "4px 10px", background: "rgba(148,163,184,0.25)" }} />
          <button type="button" role="menuitem" onClick={() => { onLocale(); onClose(); }}>
            <Languages aria-hidden />
            <span>{nextLanguage}</span>
          </button>
          <button type="button" role="menuitem" onClick={() => { onTheme(); onClose(); }}>
            {themeMode === "dark" ? <Sun aria-hidden /> : <Moon aria-hidden />}
            <span>{nextTheme}</span>
          </button>
          {onLogout ? (
            <button type="button" role="menuitem" onClick={onLogout}>
              <LogOut aria-hidden />
              <span>{tx("shell.signOut")}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PublicLanding({
  locale,
  isAuthenticated,
  authUser,
  themeMode,
  moreMenuOpen,
  onLocale,
  onTheme,
  onToggleMore,
  onCloseMore,
  onLogin,
  onRegister,
  onNavigatePublic,
  onEnterApp,
  onAccount,
  onLogout
}: {
  locale: Locale;
  isAuthenticated: boolean;
  authUser: AuthUser | null;
  themeMode: "light" | "dark";
  moreMenuOpen: boolean;
  onLocale: () => void;
  onTheme: () => void;
  onToggleMore: () => void;
  onCloseMore: () => void;
  onLogin: () => void;
  onRegister: () => void;
  onNavigatePublic: (path: string) => void;
  onEnterApp: () => void;
  onAccount: () => void;
  onLogout: () => void;
}) {
  const { t } = useTranslation();
  const workflow = [
    [t("public.workflow.migrate.0"), t("public.workflow.migrate.1"), t("public.workflow.migrate.2")],
    [t("public.workflow.build.0"), t("public.workflow.build.1"), t("public.workflow.build.2")],
    [t("public.workflow.review.0"), t("public.workflow.review.1"), t("public.workflow.review.2")],
    [t("public.workflow.apply.0"), t("public.workflow.apply.1"), t("public.workflow.apply.2")],
    [t("public.workflow.verify.0"), t("public.workflow.verify.1"), t("public.workflow.verify.2")],
    [t("public.workflow.report.0"), t("public.workflow.report.1"), t("public.workflow.report.2")]
  ];
  const navPreview = [t("nav.pages.dashboard"), t("nav.pages.migrate"), t("nav.pages.build"), t("nav.pages.plans"), t("nav.pages.reports"), t("nav.pages.catalog")];
  const pillars = [
    [t("public.pillars.verifiable.0"), t("public.pillars.verifiable.1")],
    [t("public.pillars.reversible.0"), t("public.pillars.reversible.1")],
    [t("public.pillars.governed.0"), t("public.pillars.governed.1")],
    [t("public.pillars.certified.0"), t("public.pillars.certified.1")]
  ];
  const metrics = [
    [t("public.metrics.certified.0"), t("public.metrics.certified.1")],
    [t("public.metrics.standard.0"), t("public.metrics.standard.1")],
    [t("public.metrics.readonly.0"), t("public.metrics.readonly.1")],
    [t("public.metrics.rollback.0"), t("public.metrics.rollback.1")]
  ];

  return (
    <main className="public-shell">
      <header className="public-nav">
        <div className="public-left-cluster">
          <button className="public-brand" type="button" onClick={() => onNavigatePublic("/")}>
            <span className="brand-mark">E</span>
            <span>
              <strong>{t("app.name")}</strong>
              <small>{t("app.subtitle")}</small>
            </span>
          </button>
        </div>
        <nav aria-label="Public sections">
          <a href="#workflow">{t("public.nav.workflow")}</a>
          <a href="#matrix">{t("public.nav.matrix")}</a>
          <a href="#security">{t("public.nav.safety")}</a>
          <button className="public-link-button" type="button" onClick={() => onNavigatePublic("/docs")}>{t("public.nav.docs")}</button>
          <button className="public-link-button" type="button" onClick={() => onNavigatePublic("/demo")}>{t("public.nav.demo")}</button>
          <a href="#quickstart">{t("public.nav.quickstart")}</a>
        </nav>
        <div className="public-actions">
          {isAuthenticated ? (
            <Button variant="primary" className="topbar-route-action" type="button" onClick={onEnterApp}>{t("shell.console")}</Button>
          ) : (
            <>
              <Button variant="ghost"  type="button" onClick={onLogin}>{t("shell.signIn")}</Button>
              <Button variant="primary"  type="button" onClick={onRegister}>{t("shell.register")}</Button>
            </>
          )}
          <TopbarMoreMenu
            locale={locale}
            authUser={authUser}
            themeMode={themeMode}
            open={moreMenuOpen}
            onToggleOpen={onToggleMore}
            onClose={onCloseMore}
            onAccount={isAuthenticated ? onAccount : undefined}
            onLocale={onLocale}
            onTheme={onTheme}
            onLogout={isAuthenticated ? onLogout : undefined}
          />
        </div>
      </header>

      <section className="public-hero" id="home">
        <div className="public-hero-copy">
          <span className="public-kicker">{t("public.kicker")}</span>
          <h1>{t("public.headline")}</h1>
          <p>{t("public.intro")}</p>
          <ul className="public-hero-points">
            <li><CheckCircle2 aria-hidden />{t("public.points.verifiable")}</li>
            <li><CheckCircle2 aria-hidden />{t("public.points.reversible")}</li>
            <li><CheckCircle2 aria-hidden />{t("public.points.governed")}</li>
          </ul>
          <div className="public-hero-actions">
            <Button variant="primary"  type="button" onClick={isAuthenticated ? onEnterApp : onLogin}>
              {isAuthenticated ? t("public.openConsole") : t("public.getStarted")}
            </Button>
            <a className="public-doc-link" href="#quickstart">{t("public.viewQuickstart")}</a>
          </div>
        </div>
        <div className="public-product-shot" aria-label={t("public.productPreview")}>
          <div className="shot-sidebar">
            <strong>{t("app.name")}</strong>
            {navPreview.map((item) => <span key={item}>{item}</span>)}
          </div>
          <div className="shot-main">
            <div className="shot-topline" />
            <h2>{t("public.previewTitle")}</h2>
            <p>{t("public.workflowTitle")}</p>
            <div className="shot-table">
              {["nginx", "postgresql", "redis"].map((row) => (
                <div key={row}><span>{row}</span><small>{t("public.certifiedTag")}</small><b>✓</b></div>
              ))}
            </div>
            <div className="shot-tabs">
              <span>{t("public.previewRisk")}</span>
              <strong>{t("public.previewGate")}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="public-metrics">
          {metrics.map(([value, label]) => (
            <div className="public-metric" key={label}><strong>{value}</strong><span>{label}</span></div>
          ))}
        </div>
      </section>

      <section className="public-section" id="workflow">
        <div className="public-section-heading">
          <span>{t("public.nav.workflow")}</span>
          <h2>{t("public.workflowTitle")}</h2>
        </div>
        <div className="workflow-grid">
          {workflow.map(([step, title, body]) => (
            <article key={step} className="workflow-card">
              <strong>{step}</strong>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="public-section" id="matrix">
        <div className="public-section-heading">
          <span>{t("public.nav.matrix")}</span>
          <h2>{t("public.pillarsTitle")}</h2>
        </div>
        <div className="matrix-grid">
          {pillars.map(([title, body]) => (
            <article key={title} className="matrix-card">
              <CheckCircle2 aria-hidden />
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="public-section public-safety" id="security">
        <div>
          <span>{t("public.nav.safety")}</span>
          <h2>{t("public.safetyTitle")}</h2>
        </div>
        <ul>
          <li>{t("public.safety.anonymous")}</li>
          <li>{t("public.safety.tokens")}</li>
          <li>{t("public.safety.destructive")}</li>
        </ul>
      </section>

      <section className="public-section quickstart-band" id="quickstart">
        <div>
          <span>{t("public.nav.quickstart")}</span>
          <h2>{t("public.quickstartTitle")}</h2>
          <p>{t("public.quickstartBody")}</p>
        </div>
        <Button variant="primary"  type="button" onClick={isAuthenticated ? onEnterApp : onLogin}>
          {isAuthenticated ? t("public.openConsole") : t("shell.signIn")}
        </Button>
      </section>
    </main>
  );
}

function PasswordResetModal({
  token,
  value,
  onChange,
  onCancel,
  onConfirm
}: {
  token: string;
  value: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  void token;
  useEscapeToClose(onCancel);
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section className="profile-modal" style={{ maxWidth: 420 }}>
        <header>
          <div>
            <p className="eyebrow">{t("shell.account")}</p>
            <h2>{t("auth.titleLogin")}</h2>
          </div>
          <Button variant="ghost" type="button" className="icon-action" onClick={onCancel} aria-label={t("shell.close")}>
            <X aria-hidden />
          </Button>
        </header>
        <div className="modal-form">
          <p className="settings-help" style={{ marginTop: 0 }}>{t("auth.passwordTooShort")}</p>
          <label>
            <span>{t("auth.password")}</span>
            <input type="password" value={value} onChange={(event) => onChange(event.target.value)} autoComplete="new-password" />
          </label>
          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <Button variant="ghost" type="button"  onClick={onCancel}>{t("shell.close")}</Button>
            <Button variant="primary" type="button"  onClick={onConfirm}>{t("auth.verify")}</Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function AccountSettingsModal({
  locale,
  authToken,
  onClose
}: {
  locale: Locale;
  authToken: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  useEscapeToClose(onClose);
  return (
    <div className="modal-overlay account-modal-overlay" role="dialog" aria-modal="true" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="profile-modal account-settings-modal">
        <header>
          <div>
            <p className="eyebrow">{t("shell.account")}</p>
            <h2>{t("shell.profileSecurity")}</h2>
          </div>
          <Button variant="ghost" className="icon-action" type="button" onClick={onClose} aria-label={t("shell.close")}>
            <X aria-hidden />
          </Button>
        </header>
        <div className="account-modal-body">
          <AccountPanel locale={locale} authToken={authToken} />
        </div>
      </section>
    </div>
  );
}

function AuthDialog({
  mode,
  locale,
  onMode,
  onClose,
  onSuccess
}: {
  mode: "login" | "register" | "twofa";
  locale: Locale;
  onMode: (mode: "login" | "register" | "twofa" | null) => void;
  onClose: () => void;
  onSuccess: (result: { token: string; user: AuthUser }) => void;
}) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingId, setPendingId] = useState("");
  const [pending2FA, setPending2FA] = useState(() => localStorage.getItem("envforge_pending_2fa") ?? "");
  const [devHint, setDevHint] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [providers, setProviders] = useState<{ github: boolean; google: boolean }>({ github: false, google: false });
  void locale;
  useEscapeToClose(onClose);

  useEffect(() => {
    fetchAuthProviders().then(setProviders).catch(() => setProviders({ github: false, google: false }));
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      if (mode === "login") {
        const result = await loginAccount({ email, password });
        if ("token" in result) {
          onSuccess({ token: result.token, user: result.user });
          return;
        }
        if ("needs2FA" in result) {
          localStorage.setItem("envforge_pending_2fa", result.intermediateToken);
          setPending2FA(result.intermediateToken);
          setMessage(t("auth.enterTwoFactor"));
          onMode("twofa");
          return;
        }
        if ("needsEnrollment" in result) {
          onSuccess({ token: result.intermediateToken, user: result.user });
          return;
        }
      }
      if (mode === "register") {
        if (!pendingId) {
          const result = await startRegistration({ name, email, password });
          setPendingId(result.pendingId);
          setDevHint(result.devCode ? `Dev code: ${result.devCode}` : "");
          setMessage(t("auth.verificationSent"));
          return;
        }
        const result = await verifyRegistration({ pendingId, code });
        onSuccess({ token: result.token, user: result.user });
        return;
      }
      if (mode === "twofa") {
        const result = await loginVerify2FA({ intermediateToken: pending2FA, code });
        onSuccess({ token: result.token, user: result.user });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function resetPassword() {
    if (!email.trim()) {
      setError(t("auth.enterEmail"));
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const result = await requestPasswordReset(email.trim());
      setMessage(result.devResetUrl ? `${result.message} ${result.devResetUrl}` : result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password reset request failed");
    } finally {
      setSubmitting(false);
    }
  }

  const title = mode === "login"
    ? t("auth.titleLogin")
    : mode === "register"
      ? t("auth.titleRegister")
      : t("auth.titleTwoFactor");

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="profile-modal auth-dialog">
        <header>
          <div>
            <p className="eyebrow">{t("shell.account")}</p>
            <h2>{title}</h2>
          </div>
          <Button variant="ghost" className="icon-action" type="button" onClick={onClose} aria-label={t("shell.close")}>
            <X aria-hidden />
          </Button>
        </header>

        <form className="modal-form" onSubmit={submit}>
          {mode === "register" && !pendingId ? (
            <label>
              <span>{t("auth.name")}</span>
              <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
            </label>
          ) : null}

          {mode !== "twofa" && !pendingId ? (
            <>
              <label>
                <span>{t("auth.email")}</span>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
              </label>
              <label>
                <span>{t("auth.password")}</span>
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} required />
              </label>
            </>
          ) : null}

          {mode === "register" && pendingId ? (
            <label>
              <span>{t("auth.codeEmail")}</span>
              <input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" required />
            </label>
          ) : null}

          {mode === "twofa" ? (
            <label>
              <span>{t("auth.codeTotp")}</span>
              <input value={code} onChange={(event) => setCode(event.target.value)} autoComplete="one-time-code" required />
            </label>
          ) : null}

          {error ? <p className="connection-error">{error}</p> : null}
          {message ? <p className="empty-hint">{message}</p> : null}
          {devHint ? <p className="empty-hint">{devHint}</p> : null}

          <footer>
            {mode === "login" ? (
              <Button variant="ghost"  type="button" onClick={resetPassword} disabled={submitting}>
                {t("auth.forgotPassword")}
              </Button>
            ) : (
              <Button variant="ghost"  type="button" onClick={() => { setPendingId(""); setCode(""); onMode("login"); }}>
                {t("auth.haveAccount")}
              </Button>
            )}
            <Button variant="primary"  type="submit" disabled={submitting}>
              {submitting ? t("auth.working") : mode === "register" && pendingId ? t("auth.verify") : title}
            </Button>
          </footer>
        </form>

        {mode === "login" ? (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "0 20px 16px" }}>
              {providers.github ? <Button variant="ghost"  type="button" onClick={() => { window.location.href = "/api/auth/github"; }}>GitHub</Button> : null}
              {providers.google ? <Button variant="ghost"  type="button" onClick={() => { window.location.href = "/api/auth/google"; }}>Google</Button> : null}
            </div>
            <footer>
              <Button variant="ghost"  type="button" onClick={() => onMode("register")}>
                {t("auth.createAccount")}
              </Button>
            </footer>
          </>
        ) : null}
      </section>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<><App /><DialogHost /></>);
