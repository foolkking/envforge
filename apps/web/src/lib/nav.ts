import type { Locale, Page } from "./types";
import { navItems, navItemsForRole } from "./types";

export type NavGroupId = "workspace" | "sources" | "delivery" | "governance";

export const NAV_GROUPS: Array<{
  id: NavGroupId;
  label: Record<Locale, string>;
  pages: Page[];
}> = [
  { id: "workspace", label: { zh: "工作区", en: "Workspace" }, pages: ["dashboard"] },
  { id: "sources", label: { zh: "来源", en: "Sources" }, pages: ["migrate", "build"] },
  { id: "delivery", label: { zh: "计划与交付", en: "Plan & Delivery" }, pages: ["plans"] },
  { id: "governance", label: { zh: "治理", en: "Governance" }, pages: ["catalog"] }
];

export function navGroupsForRole(role: "admin" | "user" | undefined) {
  const allowed = navItemsForRole(role);
  return NAV_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    items: group.pages
      .map((pid) => allowed.find((item) => item.id === pid))
      .filter((item): item is (typeof navItems)[number] => Boolean(item))
  })).filter((group) => group.items.length > 0);
}
