import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import { Bell, CheckCircle2, Home, Languages, LogOut, Moon, MoreHorizontal, Search, Sun, Trash2, UserRound, X } from "lucide-react";
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
import { text, navItems, navItemsForRole, type Locale, type Page } from "./lib/types";
import { navGroupsForRole } from "./lib/nav";
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
  const [themeMode, setThemeMode] = useState<"light" | "dark">(() => localStorage.getItem("envforge_theme") === "dark" ? "dark" : "light");
  const [connected, setConnected] = useState(false);
  const [method, setMethod] = useState<ConnectionMethod>("ssh-password");
  
  // 闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偞鐗犻、鏇㈡晝閳ь剛澹曡ぐ鎺撶厽闁绘梻鍘ф禍浼存煟閺傛寧顥為柟渚垮妼椤啰鎷犻煫顓烆棜闂佽崵濮崇拃锕傚垂閸洖钃熸繛鎴欏灩缁犳盯姊婚崼鐔衡姇闁诲繐绉瑰娲传閸曨剙顎涢梺鍛婃尰瀹€鎼佺嵁閸儱惟闁靛娴烽崰鏍х暦缁嬭鏃堝焵椤掑嫬绠洪柣銏犳啞閳锋垿鏌涘┑鍡楊仾妞ゃ儲绮庣槐鎺旂磼濡搫顫掑┑鐘亾濞达絿纭堕弨浠嬫煟濡鍤嬬€规悶鍎甸弻娑㈡偆娴ｉ晲鍠婂銈冨灪椤ㄥ﹥鎱ㄩ埀顒勬煏閸繃顥滃ù鐘叉惈椤啴濡堕崱娆忣潷濠殿喗菧閸旀垵鐣峰ú顏呮櫜闁搞儻绲芥禍楣冩偡濞嗗繐顏紒鈧崘鈺傚弿婵☆垳顭堟慨鍌涱殽閻愭潙鐏寸€规洜鍠栭、娑樷槈濞嗗繐濮冮梻浣藉吹閸犳劙鎮烽妷褉鍋撳顒€妲绘い顓炴喘婵＄兘鍩￠崒妤佸濠电偠鎻紞鈧い顐㈩樀婵＄敻鎮㈤崗鑲╁幈闂佺粯顭堝▍鏇犵矆閸喓绠鹃柛鈩冨姇閻忊晜銇勯锝囩畼闁圭懓瀚叅妞ゅ繐鎷戠槐顒勬⒒閸屾瑧顦﹂柟璇х磿缂傛捇宕稿Δ鈧壕璺ㄢ偓瑙勬礀濞层倝藟濮樿埖鐓熼柟浼存涧閸橀潧霉濠婂嫮鐭掗柡宀嬬節瀹曟﹢濡搁敂鑺ュ€锋俊鐐€戦崕杈╃矓瑜版帒钃熸繛鎴欏灩缁犲鏌涘Δ鍐ㄤ粶妞ゎ剙顑囩槐鎾存媴娴犲鎽甸柣銏╁灲缁绘繈鎮伴鈧畷鍫曨敆婢跺娅嶉柣鐔哥矊闁帮綁骞冩ィ鍐╁亗閹煎瓨蓱閺傗偓闂備胶绮崝妯间焊濞嗘劖娅犳繛鎴欏灪閻撴洟鏌曟繛鍨姕闁稿鍎查〃銉╂倷閹绘帗娈婚梺绯曟櫔缁绘繂鐣烽妸鈺婃晩闁稿繗鍋愰弶铏圭磽閸屾瑧顦﹀褑濮ら弲璺何旈崨顔芥珨婵?
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
  const t = text[locale];

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
      alert(locale === "zh"
        ? "Admin accounts must enable 2FA in Settings > Account."
        : "Admin accounts must enable 2FA before continuing.");
      setShellMode("app");
      setPage("dashboard");
      history.replaceState(null, "", "/app/dashboard");
      return;
    }

    // 4. OAuth link success callback
    const oauthLinked = url.searchParams.get("oauth") === "linked" || fragParams.get("oauth") === "linked";
    if (oauthLinked) {
      const provider = url.searchParams.get("provider") || fragParams.get("provider") || "OAuth";
      alert(locale === "zh"
        ? `${provider} account linked successfully.`
        : `${provider} account linked successfully!`);
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
        ? (locale === "zh"
          ? `Email ${conflictEmail ?? ""} is already registered. Sign in with password first, then link this provider in settings.`
          : `The email ${conflictEmail ?? ""} is already registered. Sign in with your password first, then link the provider from settings.`)
        : (locale === "zh"
          ? `Login failed (${oauthError}).`
          : `Login failed (${oauthError}).`);
      alert(msg);
      history.replaceState(null, "", url.origin + "/");
      return;
    }

    // 5. Password reset confirm landing (濠电姷鏁告慨鐑藉极閹间礁纾块柟瀵稿Т缁躲倝鏌﹀Ο渚＆鐟滅増甯掔壕濂告煟閹邦垰鐨洪柣娑栧劚閳规垶骞婇柛濠冩礋楠炲﹥鎯旈妸銉ュ殤婵炶揪绲跨涵鍫曞绩娴犲鐓曢悘鐐插⒔椤ｆ煡鏌涢悢鍝勪槐闁哄本绋掔换婵嬪礋椤愩垹绠ｉ梻浣告惈閻绱為埀顒併亜閿旂晫鍙€闁哄瞼鍠栭幊鐐哄Ψ瑜忛悡鍌滅磽娓氬洤娅欑紒鎻掆偓鐔轰簷闂備線鈧偛鑻晶瀛樼節閳ь剚绗熼埀顒€顫忓ú顏勭閹艰揪绲块悾鐢告⒑缂佹﹩娈旈柨鏇畱閳藉鎮界粙鍧楀敹闂佸搫娲ㄩ崰鎾诲储閸涘﹦绠鹃弶鍫濆⒔缁夘喗绻涙担鍐叉搐閻掑灚銇勯幒宥堝厡缂佺姷鍋為〃銉╂倷閹绘帗娈婚梺绯曟櫔缁绘繂鐣烽妸鈺婃晩闁稿繗鍋愰弶铏圭磽閸屾瑧顦﹀褑濮ら弲璺何旈崨顔芥珨婵犵數鍋涢悺銊у垝瀹ュ纾块柟鎯板Г缁犳帡姊绘担鐟邦嚋缂佽鍊哥叅闁挎洖鍊搁崥褰掓煃瑜滈崜姘辨崲濞戞埃鍋撻悽娈跨劸閺嶏繝姊洪幐搴㈢８闁搞劏妫勯锝囨嫚濞村顫嶉梺闈涚箳婵兘顢欐繝鍥ㄢ拺闁告繂瀚婵嬫煕閻樿櫕宕屽┑鈩冩尦楠炲洭鎮ч崼姘闂備胶顭堢换鎰板触鐎ｎ剛绀婇柟杈鹃檮閻撱儵鏌￠崶鏈电盎妞も晩鍓熼弻娑㈠箳閹捐櫕璇為梺杞扮劍閸旀瑥鐣烽妸鈺佺＜婵炴垶鐟㈤幏濠氭⒑闁偛鑻晶鍓х磽瀹ュ懏顥㈢€规洘绮岄埥澶愬煑閸濆嫭鍠樻い銏″哺閸┾偓妞ゆ巻鍋撴い顐㈢箰鐓ゆい蹇撳椤ρ囨⒑缁嬭法绠洪柛瀣姍瀹曟瑩鍩勯崘顏嗙槇闂傚倸鐗婄粙鎴﹀焵椤掑倹鍤€妞ゎ偄绻橀幊锟犲Χ閸涱厾浜版俊鐐€栭幐楣冨窗鎼达絾顐介柣鎰劋閻撴瑩姊洪銊х暠濠⒀屽枤閳?window.prompt)
    const urlResetToken = url.searchParams.get("token");
    if (url.pathname.startsWith("/auth/password-reset") && urlResetToken) {
      setResetToken(urlResetToken); // 婵犵數濮烽弫鍛婃叏閻戣棄鏋侀柛娑橈攻閸欏繘鏌ｉ幋婵愭綗闁逞屽墮閸婂湱绮嬮幒鏂哄亾閿濆簼绨介柨娑欑洴濮婅櫣鎲撮崟顐㈠Б濡炪倖娲﹂崢鍓у垝缂佹ǜ鍋呴柛鎰ㄦ櫇閸樼偓绻濋棃娑樷偓鍛婄珶婵犲洤绾ф繛宸簼閻撴洟鏌曢崼婵囶棤闁瑰啿娲弻锛勪沪鐠囨祴鍋撳┑鍡╁殨闁割偅娲栫粻锝嗐亜閺嶃劏澹樻い顐ゅХ缁?
      history.replaceState(null, "", url.origin + "/"); // 闂傚倸鍊搁崐鎼佸磹瀹勬噴褰掑炊椤掑﹦绋忔繝銏ｅ煐閸旀洜澹曢崹顔规斀闁稿瞼鍋炴禍銈囩磽瀹ュ棛澧い顓℃硶閹瑰嫰鎮滃Ο缁樺闂備礁鎼Λ娆戝垝閹捐钃?URL 闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偛顦甸弫鎾绘偐閸愯弓鐢婚梻渚€娼чˇ顐﹀疾濞戞艾顥氶柛锔诲幗閸犳劙鏌ｅΔ鈧悧鍡欑箔閹烘挻鍙忛悷娆忓閸欌偓闂佸搫鐭夌紞浣割嚕椤掑嫬鍨傛い鏃囨閳ь剦鍨跺娲箮閼恒儲鏆犻梺鍦嚀濞差厼顕ｇ拠娴嬫婵☆垶鏀遍悗濠氭椤愩垺绁紒鏌ョ畺閸┿垽骞樼紒妯锋嫼闂佸憡绋戦敃銉ョ暦瀹€鈧槐鎺楁偐瀹曞洤鈷岄悗娈垮枦椤曆囧煡婢舵劕顫呴柣妯活問閸炵儤绻濆閿嬫緲閳ь剚鎹囬幃鐐烘晝閸屾碍杈堥梺缁橆焽缁垶鍩涢幋锔界厱婵犻潧妫楅顒勬倵濮橆偄宓嗛柡灞诲姂瀵挳濡搁妶澶婁粣闁诲孩顔栭崰娑樼暦閸偆顩烽柨鏂垮⒔妞规娊鎮楅敐搴濈凹闁稿鍨跺缁樻媴閸涘﹤鏆堢紓渚囧枛閻楁捇骞冮悙鐑樻櫆閻犳亽鍔嶅Σ鈧梻鍌氬€峰ù鍥敋瑜忛埀顒佺▓閺呯娀銆佸▎鎾冲唨妞ゆ挾鍋熼悰銉╂⒑閸濆嫯鐧佺€广儱鐗冮崑鎾诲锤濡や讲鎷哄銈嗗坊閸嬫挾绱掓径灞炬毈鐎?
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
    pushLog("info", "Re-collecting system info via SSH...");
    try {
      const updated = await reprobeConnection(authToken, activeConnectionId);
      setConnections((prev) => prev.map((c) => c.id === updated.id ? updated : c));
      if (updated.probeSnapshot) {
        setProbeResult(updated.probeSnapshot as AgentProbeResult);
        const sw = updated.probeSnapshot.software?.length ?? 0;
        pushLog("success", locale === "zh"
          ? `采集完成：${sw} 个包，${new Date(updated.probeSnapshot.collectedAt).toLocaleTimeString()}`
          : `Collection done: ${sw} packages at ${new Date(updated.probeSnapshot.collectedAt).toLocaleTimeString()}`);
      } else {
        pushLog("error", locale === "zh" ? "采集失败：没有返回数据" : "Collection failed: no data returned");
      }
    } catch (err) {
      pushLog("error", err instanceof Error ? err.message : (locale === "zh" ? "采集失败" : "Scan failed"));
    }
  }

  async function handleConnect(fields: Record<string, string>, agentUrl: string) {
    setConnectionError("");
    setProbing(true);
    if (!authToken) {
      setConnectionError(locale === "zh" ? "请先登录，再保存服务器连接。" : "Please login before saving a server connection.");
      setProbing(false);
      return;
    }

    const host = fields.host || "unknown";
    const port = fields.port || "22";
    const user = fields.username || "root";
    pushLog("cmd", `ssh ${user}@${host}:${port}`);
    pushLog("info", locale === "zh" ? `正在通过 SSH 连接 ${host}:${port}...` : `Connecting via SSH to ${host}:${port}...`);

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
        pushLog("success", locale === "zh"
          ? `SSH 已连接，已采集 ${sw} 个包。`
          : `SSH connected! Collected ${sw} packages.`);
        pushLog("info", `hostname: ${result.probe.system.hostname}, OS: ${result.probe.system.platform} ${result.probe.system.arch}`);
      } else if (result.connection.status === "ssh_failed") {
        pushLog("error", locale === "zh" ? `SSH 失败：${result.connection.sshError ?? "未知错误"}` : `SSH failed: ${result.connection.sshError ?? "unknown error"}`);
      } else {
        pushLog("info", locale === "zh" ? "连接已保存（未采集数据）" : "Connection saved (no data collected)");
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
    pushLog("info", locale === "zh" ? `正在重新探测 ${host}...` : `Re-probing ${host}...`);
    setProbing(true);
    try {
      const updated = await reprobeConnection(authToken, connectionId);
      setConnections((prev) => prev.map((c) => c.id === updated.id ? updated : c));
      if (updated.probeSnapshot) {
        if (connectionId === activeConnectionId) {
          setProbeResult(updated.probeSnapshot as AgentProbeResult);
        }
        const sw = updated.probeSnapshot.software?.length ?? 0;
        pushLog("success", locale === "zh"
          ? `完成：${sw} 个包，${new Date(updated.probeSnapshot.collectedAt).toLocaleTimeString()}`
          : `Done: ${sw} packages at ${new Date(updated.probeSnapshot.collectedAt).toLocaleTimeString()}`);
      } else {
        pushLog("error", updated.sshError ?? (locale === "zh" ? "探测失败" : "Probe failed"));
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
              if (newPassword.length < 8) { alert("Password must be at least 8 characters."); return; }
              try {
                await confirmPasswordReset({ token: resetToken, newPassword });
                alert("Password reset. Please sign in.");
                setResetToken(null);
                setNewPassword("");
                setAuthDialog("login");
                window.history.replaceState(null, "", "/login");
              } catch (err) {
                alert(err instanceof Error ? err.message : "Reset failed");
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
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">E</div>
          <div>
            <strong>{t.appName}</strong>
            <span>{t.subtitle}</span>
          </div>
        </div>

        <nav className="main-nav">
          {navGroupsForRole(authUser?.role).map((group) => (
            <div className="nav-group" key={group.id}>
              <span className="nav-group-label">{group.label[locale]}</span>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    className={page === item.id ? "active" : ""}
                    key={item.id}
                    type="button"
                    title={item.description[locale]}
                    onClick={() => navigateApp(item.id)}
                  >
                    <Icon aria-hidden />
                    <span className="nav-item-copy">
                      <span className="nav-item-label">{t[item.id]}</span>
                      <span className="nav-item-description">{item.description[locale]}</span>
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
          <div className="topbar-context compact-topbar-context">
            <h1>{t[page]}</h1>
          </div>

          <div className="topbar-middle-slot">
            {page === "build" ? (
            <label className="search-box topbar-search">
              <Search aria-hidden />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} />
            </label>
            ) : null}
          </div>

          <div className="top-actions">
            <button className="primary-action topbar-route-action" type="button" onClick={() => navigatePublic("/")}>
              <Home aria-hidden />
              {locale === "zh" ? "返回首页" : "Home"}
            </button>
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
          <div className="inbox-drawer" role="dialog" aria-label={locale === "zh" ? "站内信" : "Inbox"}>
            <div className="inbox-drawer-header">
              <div>
                <h2>{locale === "zh" ? "站内信" : "Inbox"}</h2>
                <p>{locale === "zh" ? `${inboxUnreadCount} 条未读消息` : `${inboxUnreadCount} unread messages`}</p>
              </div>
              <button className="icon-action" type="button" onClick={() => setInboxOpen(false)} aria-label="Close inbox">
                <X aria-hidden />
              </button>
            </div>
            {inboxError ? <p className="connection-error">{inboxError}</p> : null}
            {inboxLoading ? (
              <p className="empty-hint">{locale === "zh" ? "正在加载站内信..." : "Loading inbox..."}</p>
            ) : inboxMessages.length === 0 ? (
              <p className="empty-hint">{locale === "zh" ? "暂无站内信。" : "No messages yet."}</p>
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
                        <button className="icon-action" type="button" onClick={() => void handleMarkInboxRead(message.id)} title={locale === "zh" ? "标为已读" : "Mark read"}>
                          <CheckCircle2 aria-hidden />
                        </button>
                      ) : null}
                      <button className="icon-action danger" type="button" onClick={() => void handleDeleteInboxMessage(message.id)} title={locale === "zh" ? "删除" : "Delete"}>
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
              <h1 style={{ marginTop: 0 }}>{locale === "zh" ? "能力规则库（管理员）" : "Capability Rules (admin)"}</h1>
              <p style={{ color: "#475569" }}>
                {locale === "zh"
                  ? "能力管理是管理员规则库。普通用户请使用构建页选择已认证能力生成重建计划。"
                  : "Catalog is the admin capability rules registry. As a regular user, use Build to select certified capabilities and generate a Rebuild Plan."}
              </p>
              <button
                type="button"
                className="primary-action"
                onClick={() => navigateApp("build")}
                style={{ marginTop: 8 }}
              >
                {locale === "zh" ? "去构建页使用已认证能力" : "Go to Build (certified capabilities)"}
              </button>
            </div>
          )
        ) : null}

        {page === "migrate" ? (
          <MachinePage
            t={t}
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
            t={t}
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
            if (newPassword.length < 8) { alert("Password must be at least 8 characters."); return; }
            try {
              await confirmPasswordReset({ token: resetToken, newPassword });
              alert("Password reset. Please sign in.");
              setResetToken(null);
              setNewPassword("");
              setAuthDialog("login");
              navigatePublic("/login");
            } catch (err) {
              alert(err instanceof Error ? err.message : "Reset failed");
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
  const zh = locale === "zh";
  const accountInitial = (authUser?.displayName || authUser?.name || "U").slice(0, 1).toUpperCase();
  const nextLanguage = zh ? "English" : "中文";
  const nextTheme = themeMode === "dark" ? (zh ? "浅色模式" : "Light mode") : (zh ? "深色模式" : "Dark mode");

  return (
    <div className="topbar-more-wrap">
      <button className="ghost-action more-action" type="button" onClick={onToggleOpen} aria-expanded={open} aria-haspopup="menu">
        {authUser ? <span className="more-avatar">{accountInitial}</span> : <MoreHorizontal aria-hidden />}
        <span>{zh ? "更多" : "More"}</span>
      </button>
      {open ? (
        <div className="topbar-more-menu" role="menu">
          {authUser && onAccount ? (
            <button type="button" role="menuitem" onClick={onAccount}>
              <UserRound aria-hidden />
              <span>{zh ? "账号与安全" : "Account & security"}</span>
            </button>
          ) : null}
          {onInbox ? (
            <button type="button" role="menuitem" onClick={onInbox}>
              <Bell aria-hidden />
              <span>{zh ? "通知" : "Notifications"}</span>
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
              <span>{zh ? "退出登录" : "Sign out"}</span>
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
  const matrix = [
    [t("public.matrix.migrate.0"), t("public.matrix.migrate.1")],
    [t("public.matrix.build.0"), t("public.matrix.build.1")],
    [t("public.matrix.plans.0"), t("public.matrix.plans.1")],
    [t("public.matrix.reports.0"), t("public.matrix.reports.1")],
    [t("public.matrix.admin.0"), t("public.matrix.admin.1")],
    [t("public.matrix.docs.0"), t("public.matrix.docs.1")]
  ];
  const navPreview = [t("nav.pages.dashboard"), t("nav.pages.migrate"), t("nav.pages.build"), t("nav.pages.plans"), t("nav.pages.reports"), t("nav.pages.catalog")];

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
          <button className="public-link-button" type="button" onClick={() => onNavigatePublic("/demo")}>Demo</button>
          <a href="#quickstart">{t("public.nav.quickstart")}</a>
        </nav>
        <div className="public-actions">
          {isAuthenticated ? (
            <button className="primary-action topbar-route-action" type="button" onClick={onEnterApp}>{t("shell.console")}</button>
          ) : (
            <>
              <button className="ghost-action" type="button" onClick={onLogin}>{t("shell.signIn")}</button>
              <button className="primary-action" type="button" onClick={onRegister}>{t("shell.register")}</button>
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
          <div className="public-hero-actions">
            <button className="primary-action" type="button" onClick={isAuthenticated ? onEnterApp : onLogin}>
              {isAuthenticated ? t("public.openConsole") : t("public.getStarted")}
            </button>
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
            <h2>{t("nav.pages.catalog")}</h2>
            <p>{t("public.standardsLayer")}</p>
            <div className="shot-tabs">
              <span>{t("public.overview")}</span>
              <span>{t("public.ruleRegistry")}</span>
              <strong>{t("public.standards")}</strong>
            </div>
            <div className="shot-table">
              {[t("public.certifiedV1"), t("public.certifiedV2"), t("public.requirementDraft")].map((row, index) => (
                <div key={row}><span>{row}</span><small>{index === 0 ? t("public.active") : t("public.draft")}</small><b>13/13</b></div>
              ))}
            </div>
          </div>
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
          <h2>{t("public.matrixTitle")}</h2>
        </div>
        <div className="matrix-grid">
          {matrix.map(([title, body]) => (
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
        <button className="primary-action" type="button" onClick={isAuthenticated ? onEnterApp : onLogin}>
          {isAuthenticated ? t("public.openConsole") : t("shell.signIn")}
        </button>
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
  return (
    <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", justifyContent: "center", alignItems: "center" }}>
      <div className="modal-content" style={{ background: "#fff", padding: "24px", borderRadius: "8px", minWidth: "320px", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
        <h3 style={{ marginTop: 0, marginBottom: "16px", fontSize: "18px" }}>{t("auth.titleLogin")}</h3>
        <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "12px" }}>{t("auth.passwordTooShort")}</p>
        <input type="password" value={value} onChange={(event) => onChange(event.target.value)} placeholder="New password..." style={{ width: "100%", padding: "10px", marginBottom: "20px", border: "1px solid #cbd5e1", borderRadius: "4px", boxSizing: "border-box" }} />
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button type="button" className="ghost-action" onClick={onCancel}>{t("shell.close")}</button>
          <button type="button" className="primary-action" onClick={onConfirm}>{t("auth.verify")}</button>
        </div>
      </div>
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
  return (
    <div className="modal-overlay account-modal-overlay" role="dialog" aria-modal="true" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="profile-modal account-settings-modal">
        <header>
          <div>
            <p className="eyebrow">{t("shell.account")}</p>
            <h2>{t("shell.profileSecurity")}</h2>
          </div>
          <button className="ghost-action icon-action" type="button" onClick={onClose} aria-label={t("shell.close")}>
            <X aria-hidden />
          </button>
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
          <button className="ghost-action icon-action" type="button" onClick={onClose} aria-label={t("shell.close")}>
            <X aria-hidden />
          </button>
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
              <button className="ghost-action" type="button" onClick={resetPassword} disabled={submitting}>
                {t("auth.forgotPassword")}
              </button>
            ) : (
              <button className="ghost-action" type="button" onClick={() => { setPendingId(""); setCode(""); onMode("login"); }}>
                {t("auth.haveAccount")}
              </button>
            )}
            <button className="primary-action" type="submit" disabled={submitting}>
              {submitting ? t("auth.working") : mode === "register" && pendingId ? t("auth.verify") : title}
            </button>
          </footer>
        </form>

        {mode === "login" ? (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "0 20px 16px" }}>
              {providers.github ? <button className="ghost-action" type="button" onClick={() => { window.location.href = "/api/auth/github"; }}>GitHub</button> : null}
              {providers.google ? <button className="ghost-action" type="button" onClick={() => { window.location.href = "/api/auth/google"; }}>Google</button> : null}
            </div>
            <footer>
              <button className="ghost-action" type="button" onClick={() => onMode("register")}>
                {t("auth.createAccount")}
              </button>
            </footer>
          </>
        ) : null}
      </section>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
