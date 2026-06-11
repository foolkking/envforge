export const en = {
  app: {
    name: "EnvForge",
    subtitle: "Linux environment rebuild and migration platform"
  },
  nav: {
    groups: {
      workspace: "Workspace",
      flow: "Workflow",
      governance: "Governance"
    },
    pages: {
      dashboard: "Dashboard",
      migrate: "Migrate",
      build: "Build",
      catalog: "Capability Admin",
      plans: "Plans",
      reports: "Reports"
    },
    descriptions: {
      dashboard: "Overview, recent plans, review queue, account and notifications",
      migrate: "Source VM, snapshot, analysis, candidates",
      build: "Build: pick certified capabilities, generate a Rebuild Plan; flows through Plan Review and the Apply Gate",
      plans: "Plans center, recipes, schedules, drift, webhooks, reports",
      reports: "Migration / rebuild / repair reports",
      catalog: "Admin capability rules workbench: rule governance, certification, suggestions, package integrations, users & queues"
    }
  },
  pipeline: {
    flow: "Flow",
    connect: "Connect",
    snapshot: "Snapshot",
    build: "Build",
    review: "Review",
    apply: "Apply",
    report: "Report"
  },
  shell: {
    search: "Search capabilities, configs, and migration rules",
    home: "Home",
    more: "More",
    account: "Account",
    profileSecurity: "Profile and security",
    inbox: "Inbox",
    noMessages: "No messages yet.",
    loadingInbox: "Loading inbox...",
    markRead: "Mark read",
    delete: "Delete",
    close: "Close",
    console: "Console",
    logout: "Logout",
    signIn: "Sign in",
    register: "Create account",
    language: "中文 / English",
    themeLight: "Light mode",
    themeDark: "Dark mode"
  },
  public: {
    nav: {
      workflow: "Workflow",
      matrix: "Matrix",
      safety: "Safety",
      docs: "Docs",
      quickstart: "Quick start"
    },
    kicker: "From source evidence to audited rebuilds",
    headline: "EnvForge makes Linux migration verifiable, reversible, and governed",
    intro: "The public site shows product context, workflows, docs, and auth CTAs. Connections, plans, reports, notifications, account security, and admin data stay inside /app.",
    getStarted: "Get started",
    openConsole: "Open console",
    viewQuickstart: "View quick start",
    productPreview: "Product interface preview",
    standardsLayer: "Versioned standards layer",
    overview: "Overview",
    ruleRegistry: "Rule Registry",
    standards: "Standards",
    active: "active",
    draft: "draft",
    certifiedV1: "Full Migration Certified v1",
    certifiedV2: "Full Migration Certified v2",
    requirementDraft: "Requirement draft",
    workflowTitle: "Migrate -> Build -> Review -> Apply -> Verify -> Report",
    matrixTitle: "Public content and authenticated workspace are separated",
    safetyTitle: "No user or secret data is injected into the public site",
    quickstartTitle: "Sign in to start from /app/dashboard",
    quickstartBody: "Connect a host, capture evidence, select certified capabilities, review the plan, then apply.",
    workflow: {
      migrate: ["Migrate", "Capture source", "Connect Linux hosts and capture read-only HostSnapshot evidence."],
      build: ["Build", "Select certified capabilities", "Users only see Full Migration Certified capabilities."],
      review: ["Review", "Review risks", "Plans pass through risk, conflict, and approval gates."],
      apply: ["Apply", "Controlled apply", "Real changes require Apply Gate approval and audit records."],
      verify: ["Verify", "Verify results", "Post-apply checks can generate Repair Plans from failures."],
      report: ["Report", "Report evidence", "Produce migration, rebuild, and repair evidence reports."]
    },
    matrix: {
      migrate: ["Migrate", "Connect, collect, and upload snapshots."],
      build: ["Build", "Create certified-only Rebuild Plans."],
      plans: ["Plans", "Review, apply, verify, and rollback."],
      reports: ["Reports", "Evidence and audit reporting."],
      admin: ["Capability Admin", "Admin rule, standard, and queue governance."],
      docs: ["Docs", "Public docs and quick start."]
    },
    safety: {
      anonymous: "Anonymous users can only access /, /login, /register, /docs, and /demo.",
      tokens: "Install scripts use authenticated short-lived tokens, masked by default.",
      destructive: "Delete, publish, rollback, and real apply actions require confirmation and audit logs."
    }
  },
  auth: {
    titleLogin: "Sign in to EnvForge",
    titleRegister: "Create account",
    titleTwoFactor: "Two-factor authentication",
    name: "Name",
    email: "Email",
    password: "Password",
    codeEmail: "Email verification code",
    codeTotp: "TOTP or recovery code",
    forgotPassword: "Forgot password",
    haveAccount: "Have an account",
    createAccount: "Create a new account",
    working: "Working...",
    verify: "Verify",
    enterEmail: "Enter your email first.",
    enterTwoFactor: "Enter your two-factor authentication code.",
    verificationSent: "Verification code sent. Enter it to finish registration.",
    passwordResetDone: "Password reset. Please sign in.",
    passwordTooShort: "Password must be at least 8 characters."
  },
  fields: {
    filter: "Filter",
    connectTitle: "Connect source Linux VM",
    connectHint: "A successful connection collects a read-only HostSnapshot for environment analysis.",
    runScan: "Collect HostSnapshot",
    upload: "Save environment snapshot",
    selected: "Selected",
    software: "Capability evidence",
    configs: "Host analysis checklist",
    addToVm: "Add to Plan",
    guest: "Guest",
    locked: "Visible after connection",
    connection: "Connection",
    connected: "Connected",
    disconnected: "Disconnected",
    connectBtn: "Connect & collect",
    privacyNote: "Source collection is read-only; every target change must go through an Environment Plan.",
    installCommand: "Plan action",
    packageAlias: "Packages and alias preferences",
    agentUrl: "Agent URL (optional)",
    agentProbe: "Probe live data",
    agentOnline: "SSH online",
    agentOffline: "SSH offline",
    probing: "Collecting...",
    realData: "Live data"
  }
} as const;
