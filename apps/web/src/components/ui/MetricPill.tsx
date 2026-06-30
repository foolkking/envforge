import type { ReactNode } from "react";

export function MetricPill({ value, label }: { value: ReactNode; label: ReactNode }) {
  return (
    <span className="ui-metric-pill">
      <strong>{value}</strong>
      <span>{label}</span>
    </span>
  );
}
