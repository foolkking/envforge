import type { ReactNode } from "react";

/**
 * Badge — unified status/label pill. Tones map to a single semantic
 * system (ok / warn / danger / neutral / info), replacing the many
 * ad-hoc badge styles (risk-chip, sensitivity-tag, status-badge, etc.).
 * Styles live in styles.css under `.ui-badge`.
 */
type Tone = "ok" | "warn" | "danger" | "neutral" | "info";

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`ui-badge ui-badge-${tone}`}>{children}</span>;
}
