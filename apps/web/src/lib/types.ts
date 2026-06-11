import type { LucideIcon } from "lucide-react";
import type { CatalogItem } from "../api";
import {
  Box,
  Cpu,
  Database,
  FileText,
  LayoutDashboard,
  MonitorCog,
  PackagePlus,
  Server,
  Settings2,
  ShieldCheck,
  Wifi
} from "lucide-react";

export type Locale = "zh" | "en";
export type Page = "dashboard" | "migrate" | "build" | "catalog" | "plans" | "reports";
export type ConnectionMethod = "ssh-password" | "ssh-key";

export const text = {
  zh: {
    appName: "EnvForge",
    subtitle: "Linux 环境重建与迁移平台",
    dashboard: "总览",
    migrate: "迁移",
    build: "构建",
    catalog: "能力管理",
    plans: "计划",
    reports: "报告",
    search: "搜索能力、配置和迁移规则",
    filter: "筛选",
    connectTitle: "连接源 Linux 主机",
    connectHint: "连接成功后只读采集主机快照，并将结果作为环境分析证据。",
    runScan: "采集主机快照",
    upload: "保存环境快照",
    selected: "已选择",
    software: "能力证据",
    configs: "主机分析检查",
    addToVm: "加入计划",
    guest: "访客",
    login: "登录",
    register: "注册",
    logout: "退出",
    editProfile: "编辑资料",
    profile: "个人信息",
    uploads: "我的环境快照",
    language: "中文",
    locked: "连接后显示",
    connection: "连接状态",
    connected: "已连接",
    disconnected: "未连接",
    connectBtn: "连接并采集",
    privacyNote: "源机器采集默认只读；所有目标机器变更都必须进入环境计划。",
    installCommand: "计划动作",
    packageAlias: "包名与别名偏好",
    agentUrl: "Agent URL（可选）",
    agentProbe: "探测真实数据",
    agentOnline: "SSH 在线",
    agentOffline: "SSH 离线",
    probing: "采集中...",
    realData: "实时数据"
  },
  en: {
    appName: "EnvForge",
    subtitle: "Linux environment rebuild and migration platform",
    dashboard: "Dashboard",
    migrate: "Migrate",
    build: "Build",
    catalog: "Capability Admin",
    plans: "Plans",
    reports: "Reports",
    search: "Search capabilities, configs, and migration rules",
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
    login: "Login",
    register: "Register",
    logout: "Logout",
    editProfile: "Edit profile",
    profile: "Profile",
    uploads: "My environment snapshots",
    language: "English",
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

export type TextDict = typeof text.zh;

export const navItems: Array<{ id: Page; icon: LucideIcon; adminOnly?: boolean; description: Record<Locale, string> }> = [
  { id: "dashboard", icon: LayoutDashboard, description: { zh: "资源状态、最近计划、待审队列、通知", en: "Overview, recent plans, review queue, account and notifications" } },
  { id: "migrate", icon: MonitorCog, description: { zh: "源主机、快照、分析与迁移候选", en: "Source VM, snapshot, analysis, candidates" } },
  { id: "build", icon: PackagePlus, description: { zh: "选择已认证能力，生成重建计划，进入审查和执行门禁", en: "Build: pick certified capabilities, generate a Rebuild Plan; flows through Plan Review and the Apply Gate" } },
  { id: "plans", icon: Server, description: { zh: "计划中心、配方、排程、漂移、外发通知、报告", en: "Plans center, recipes, schedules, drift, webhooks, reports" } },
  { id: "reports", icon: FileText, description: { zh: "迁移 / 重建 / 修复报告", en: "Migration / rebuild / repair reports" } },
  { id: "catalog", icon: Box, adminOnly: true, description: { zh: "管理员能力规则工作台：规则治理、认证升级、用户建议、软件支持映射、用户与队列", en: "Admin capability rules workbench: rule governance, certification, suggestions, package integrations, users & queues" } }
];

export function navItemsForRole(role: "admin" | "user" | undefined): typeof navItems {
  return navItems.filter((item) => role === "admin" || !item.adminOnly);
}

export const categoryIcons: Record<CatalogItem["category"], LucideIcon> = {
  runtime: Cpu,
  developer: Settings2,
  database: Database,
  container: Box,
  security: ShieldCheck,
  network: Wifi,
  service: Server
};

export const connectionFields: Record<ConnectionMethod, string[]> = {
  "ssh-password": ["Host", "Port", "Username", "Password"],
  "ssh-key": ["Host", "Port", "Username", "Private key path", "Passphrase"]
};

export const connectionFieldKeys: Record<ConnectionMethod, string[]> = {
  "ssh-password": ["host", "port", "username", "password"],
  "ssh-key": ["host", "port", "username", "privateKeyPath", "passphrase"]
};

export const installCommands: Record<string, string> = {
  node: "package.present nodejs npm",
  docker: "capability.present docker-runtime",
  pm2: "package.present pm2",
  nginx: "capability.present web-server.nginx",
  git: "package.present git"
};
