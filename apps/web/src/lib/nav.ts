import type { Page } from "./types";
import { navItems, navItemsForRole } from "./types";

export type NavGroupId = "workspace" | "sources" | "delivery" | "governance";

export const NAV_GROUP_LABEL_KEYS = {
  workspace: "nav.groups.workspace",
  sources: "nav.groups.sources",
  delivery: "nav.groups.delivery",
  governance: "nav.groups.governance"
} as const satisfies Record<NavGroupId, string>;
export const NAV_PAGE_LABEL_KEYS = {
  dashboard: "nav.pages.dashboard",
  migrate: "nav.pages.migrate",
  build: "nav.pages.build",
  catalog: "nav.pages.catalog",
  plans: "nav.pages.plans",
  reports: "nav.pages.reports"
} as const satisfies Record<Page, string>;
export const NAV_PAGE_DESCRIPTION_KEYS = {
  dashboard: "nav.descriptions.dashboard",
  migrate: "nav.descriptions.migrate",
  build: "nav.descriptions.build",
  catalog: "nav.descriptions.catalog",
  plans: "nav.descriptions.plans",
  reports: "nav.descriptions.reports"
} as const satisfies Record<Page, string>;

export const NAV_GROUPS: Array<{
  id: NavGroupId;
  labelKey: (typeof NAV_GROUP_LABEL_KEYS)[NavGroupId];
  pages: Page[];
}> = [
  { id: "workspace", labelKey: NAV_GROUP_LABEL_KEYS.workspace, pages: ["dashboard"] },
  { id: "sources", labelKey: NAV_GROUP_LABEL_KEYS.sources, pages: ["migrate", "build"] },
  { id: "delivery", labelKey: NAV_GROUP_LABEL_KEYS.delivery, pages: ["plans"] },
  { id: "governance", labelKey: NAV_GROUP_LABEL_KEYS.governance, pages: ["catalog"] }
];

export function navGroupsForRole(role: "admin" | "user" | undefined) {
  const allowed = navItemsForRole(role);
  return NAV_GROUPS.map((group) => ({
    id: group.id,
    labelKey: group.labelKey,
    items: group.pages
      .map((pid) => allowed.find((item) => item.id === pid))
      .filter((item): item is (typeof navItems)[number] => Boolean(item))
  })).filter((group) => group.items.length > 0);
}
