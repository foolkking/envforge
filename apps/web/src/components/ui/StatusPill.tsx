import type { Locale } from "../../lib/types";
import { Badge } from "./Badge";

/**
 * StatusPill — renders a pipeline/step state as a localized Badge.
 * Extracted from the inline StatusBadge logic in DashboardPage so the
 * four-state semantics (done / active / blocked / idle) are shared.
 */
type PillState = "done" | "active" | "blocked" | "idle";

const STATE_MAP: Record<PillState, { tone: "ok" | "warn" | "danger" | "neutral"; zh: string; en: string }> = {
  done: { tone: "ok", zh: "完成", en: "Done" },
  active: { tone: "warn", zh: "进行中", en: "Active" },
  blocked: { tone: "danger", zh: "阻塞", en: "Blocked" },
  idle: { tone: "neutral", zh: "等待", en: "Idle" }
};

export function StatusPill({ state, locale }: { state: PillState; locale: Locale }) {
  const s = STATE_MAP[state];
  return <Badge tone={s.tone}>{locale === "zh" ? s.zh : s.en}</Badge>;
}
