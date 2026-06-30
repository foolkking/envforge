import type { LucideIcon } from "lucide-react";
import type { CatalogItem } from "../api";
import {
  Box,
  Cpu,
  Database,
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
export type ConnectionFieldKey = "host" | "port" | "username" | "password" | "privateKeyPath" | "passphrase";

export const navItems: Array<{ id: Page; icon: LucideIcon; adminOnly?: boolean }> = [
  { id: "dashboard", icon: LayoutDashboard },
  { id: "migrate", icon: MonitorCog },
  { id: "build", icon: PackagePlus },
  { id: "plans", icon: Server },
  { id: "catalog", icon: Box, adminOnly: true }
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

export const connectionFieldKeys: Record<ConnectionMethod, ConnectionFieldKey[]> = {
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
