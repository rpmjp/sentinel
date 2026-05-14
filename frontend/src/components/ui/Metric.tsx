import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface MetricProps {
  label: string;
  value: string | number;
  delta?: string;
  deltaTone?: "positive" | "negative" | "neutral";
  sparkline?: ReactNode;
  className?: string;
  highlighted?: boolean;
}

const DELTA_COLORS = {
  positive: "var(--color-success)",
  negative: "var(--color-danger)",
  neutral: "var(--color-fg-subtle)",
} as const;

export function Metric({
  label,
  value,
  delta,
  deltaTone = "neutral",
  sparkline,
  className,
  highlighted = false,
}: MetricProps) {
  return (
    <div
      className={cn("rounded-md border p-3", className)}
      style={{
        background: highlighted
          ? "var(--color-warning-soft)"
          : "var(--color-surface-elevated)",
        borderColor: highlighted
          ? "var(--color-warning)"
          : "var(--color-border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div
        className="text-[10px] uppercase tracking-wider mb-1"
        style={{ color: "var(--color-fg-subtle)" }}
      >
        {label}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <div
          className="font-mono text-xl font-medium"
          style={{ color: highlighted ? "var(--color-warning)" : "var(--color-fg)" }}
        >
          {value}
        </div>
        {sparkline && <div className="shrink-0">{sparkline}</div>}
      </div>
      {delta && (
        <div className="text-[10px] mt-1" style={{ color: DELTA_COLORS[deltaTone] }}>
          {delta}
        </div>
      )}
    </div>
  );
}
