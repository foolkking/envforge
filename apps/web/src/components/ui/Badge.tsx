import type { ReactNode } from "react";

type Tone = "ok" | "warn" | "danger" | "neutral" | "info";
type Size = "sm" | "md";

export function Badge({
  tone = "neutral",
  size = "md",
  title,
  children
}: {
  tone?: Tone;
  size?: Size;
  title?: string;
  children: ReactNode;
}) {
  return <span className={`ui-badge ui-badge-${tone} ui-badge-${size}`} title={title}>{children}</span>;
}
