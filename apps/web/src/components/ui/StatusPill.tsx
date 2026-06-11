import type { Locale } from "../../lib/types";
import { Badge } from "./Badge";

type PillState = "done" | "active" | "blocked" | "idle";

const STATE_MAP: Record<PillState, { tone: "ok" | "warn" | "danger" | "neutral"; zh: string; en: string }> = {
  done: { tone: "ok", zh: "完成", en: "Done" },
  active: { tone: "warn", zh: "进行中", en: "Active" },
  blocked: { tone: "danger", zh: "阻塞", en: "Blocked" },
  idle: { tone: "neutral", zh: "等待", en: "Idle" }
};

export function StatusPill({ state, locale, title }: { state: PillState; locale: Locale; title?: string }) {
  const status = STATE_MAP[state];
  return <Badge tone={status.tone} title={title}>{locale === "zh" ? status.zh : status.en}</Badge>;
}
