import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Button — unified button that maps a semantic `variant` onto the
 * existing global button classes (primary-action / secondary-action /
 * ghost-action / selected-action / conn-btn-danger). No new CSS, so it
 * is visually identical to the buttons it replaces; the value is a
 * single consistent API + built-in loading/icon handling.
 */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "selected";

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "primary-action",
  secondary: "secondary-action",
  ghost: "ghost-action",
  danger: "conn-btn conn-btn-danger",
  selected: "selected-action"
};

export function Button({
  variant = "secondary",
  loading = false,
  icon,
  children,
  className = "",
  type = "button",
  ...rest
}: {
  variant?: Variant;
  loading?: boolean;
  icon?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`${VARIANT_CLASS[variant]} ${loading ? "btn-loading" : ""} ${className}`.trim()}
      {...rest}
    >
      {loading ? <span className="spinning">...</span> : icon}
      {children}
    </button>
  );
}
