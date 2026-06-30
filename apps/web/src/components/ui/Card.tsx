import type { HTMLAttributes, ReactNode } from "react";

/**
 * Card — neutral surface container built on the existing --ef-* tokens,
 * replacing the dozen+ bespoke *-card containers (capability-card,
 * config-bundle-card, data-strategy-card, conn-detail-card, ...).
 * Styles live in styles.css under `.ui-card`.
 */
type Tone = "default" | "ok" | "warn" | "danger";

export function Card({
  as: Component = "div",
  tone = "default",
  className = "",
  children,
  ...rest
}: {
  as?: "div" | "section" | "article";
  tone?: Tone;
  className?: string;
  children: ReactNode;
} & HTMLAttributes<HTMLElement>) {
  return <Component className={`ui-card ui-card-${tone} ${className}`.trim()} {...rest}>{children}</Component>;
}
