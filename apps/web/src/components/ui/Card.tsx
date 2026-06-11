import type { ReactNode } from "react";

/**
 * Card — neutral surface container built on the existing --ef-* tokens,
 * replacing the dozen+ bespoke *-card containers (capability-card,
 * config-bundle-card, data-strategy-card, conn-detail-card, ...).
 * Styles live in styles.css under `.ui-card`.
 */
type Tone = "default" | "ok" | "warn" | "danger";

export function Card({
  tone = "default",
  className = "",
  children
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return <div className={`ui-card ui-card-${tone} ${className}`.trim()}>{children}</div>;
}
