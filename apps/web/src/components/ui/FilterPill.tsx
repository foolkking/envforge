import type { ButtonHTMLAttributes } from "react";

export function FilterPill({
  active,
  className = "",
  children,
  ...rest
}: {
  active: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`filter-pill ${active ? "active" : ""} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}
