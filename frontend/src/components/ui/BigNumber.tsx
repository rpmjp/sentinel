import type { ReactNode } from "react";
import { useCountUp } from "@/lib/animate";
import { cn } from "@/lib/cn";

interface BigNumberProps {
  label: string;
  value: number;
  format?: (n: number) => string;
  delta?: string;
  deltaTone?: "positive" | "negative" | "neutral";
  decimals?: number;
  sparkline?: ReactNode;
  highlighted?: boolean;
  accent?: string;
  className?: string;
}

const DELTA_COLORS = {
  positive: "var(--color-success)",
  negative: "var(--color-danger)",
  neutral: "var(--color-fg-subtle)",
} as const;

/**
 * Large dashboard number with animated count-up. Used for the headline
 * KPIs on the dashboard. The value animates smoothly when refreshed.
 */
export function BigNumber({
  label,
  value,
  format = (n) => n.toLocaleString(),
  delta,
  deltaTone = "neutral",
  decimals = 0,
  sparkline,
  highlighted,
  accent,
  className,
}: BigNumberProps) {
  const animated = useCountUp(value, { duration: 700, decimals });
  return (
    <div
      className={cn("kpi-card rounded-lg border p-4 flex flex-col gap-1.5", className)}
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
        className="text-[10px] uppercase tracking-wider flex items-center justify-between"
        style={{ color: "var(--color-fg-subtle)" }}
      >
        <span>{label}</span>
        {sparkline}
      </div>
      <div
        className="font-mono text-3xl font-medium tabular-nums leading-tight"
        style={{ color: accent ?? "var(--color-fg)" }}
      >
        {format(animated)}
      </div>
      {delta && (
        <div
          className="text-[11px]"
          style={{ color: DELTA_COLORS[deltaTone] }}
        >
          {delta}
        </div>
      )}
    </div>
  );
}
