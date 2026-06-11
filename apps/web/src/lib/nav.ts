import type { Locale, Page } from "./types";
import { navItems, navItemsForRole } from "./types";

/**
 * Single source of truth for IA grouping and the six-step mainline.
 * Page metadata (icon / label / description) still lives in `navItems`
 * (types.ts); this module only adds the grouping and pipeline mapping
 * layered on top, so there is no duplication of per-page copy.
 */

export type NavGroupId = "workspace" | "flow" | "governance";

export const NAV_GROUPS: Array<{
  id: NavGroupId;
  label: Record<Locale, string>;
  pages: Page[];
}> = [
  { id: "workspace", label: { zh: "工作区", en: "Workspace" }, pages: ["dashboard"] },
  { id: "flow", label: { zh: "流程", en: "Workflow" }, pages: ["migrate", "build", "plans", "reports"] },
  { id: "governance", label: { zh: "治理", en: "Governance" }, pages: ["catalog"] }
];

/** Six-step mainline (迁移→构建→审查→执行→验证→报告) mapped to target pages. */
export type PipelineStepId = "connect" | "snapshot" | "build" | "review" | "apply" | "report";

export const PIPELINE: Array<{
  id: PipelineStepId;
  page: Page;
  view?: string;
  label: Record<Locale, string>;
}> = [
  { id: "connect", page: "migrate", label: { zh: "连接", en: "Connect" } },
  { id: "snapshot", page: "migrate", label: { zh: "快照", en: "Snapshot" } },
  { id: "build", page: "build", label: { zh: "构建", en: "Build" } },
  { id: "review", page: "plans", label: { zh: "审查", en: "Review" } },
  { id: "apply", page: "plans", view: "runs", label: { zh: "执行", en: "Apply" } },
  { id: "report", page: "reports", label: { zh: "报告", en: "Report" } }
];

/** Which top-level page a pipeline step belongs to (for highlighting the bar). */
export function pipelineStepForPage(page: Page): PipelineStepId | null {
  const match = PIPELINE.find((step) => step.page === page);
  return match ? match.id : null;
}

/** Role-filtered nav, grouped for the sidebar. Empty groups are dropped. */
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
