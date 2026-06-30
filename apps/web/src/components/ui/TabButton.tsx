import type { ButtonHTMLAttributes, ReactNode } from "react";

export function TabButton({
  active,
  icon,
  label,
  badge,
  testId,
  className = "",
  ...rest
}: {
  active: boolean;
  icon?: ReactNode;
  label: string;
  badge?: number;
  testId?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-testid={testId}
      className={`ui-tab-button ${active ? "active" : ""} ${className}`.trim()}
      {...rest}
    >
      {icon}
      <span>{label}</span>
      {badge ? <span className="ui-tab-badge">{badge}</span> : null}
    </button>
  );
}
