import { useTranslation } from "react-i18next";
import type { Locale } from "../../lib/types";
import { Badge } from "./Badge";

type PillState = "done" | "active" | "blocked" | "idle";

const STATE_MAP: Record<PillState, { tone: "ok" | "warn" | "danger" | "neutral" }> = {
  done: { tone: "ok" },
  active: { tone: "warn" },
  blocked: { tone: "danger" },
  idle: { tone: "neutral" }
};
const STATE_KEYS = {
  done: "statusPill.done",
  active: "statusPill.active",
  blocked: "statusPill.blocked",
  idle: "statusPill.idle"
} as const satisfies Record<PillState, string>;

export function StatusPill({ state, title }: { state: PillState; locale: Locale; title?: string }) {
  const { t } = useTranslation();
  const status = STATE_MAP[state];
  return <Badge tone={status.tone} title={title}>{t(STATE_KEYS[state])}</Badge>;
}
