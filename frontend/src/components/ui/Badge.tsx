import type { RiskBand, Decision } from "@/lib/types";
import { cn } from "@/lib/cn";

interface RiskBadgeProps {
  risk: RiskBand;
  className?: string;
}

const RISK_STYLES: Record<RiskBand, { bg: string; fg: string; label: string }> = {
  high: { bg: "var(--color-risk-high)", fg: "#fff", label: "HIGH" },
  medium: { bg: "var(--color-risk-medium)", fg: "#2c1f08", label: "MED" },
  low: { bg: "var(--color-risk-low)", fg: "#fff", label: "LOW" },
};

export function RiskBadge({ risk, className }: RiskBadgeProps) {
  const s = RISK_STYLES[risk];
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium tracking-wide",
        className,
      )}
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}

interface DecisionBadgeProps {
  decision: Decision | null;
  className?: string;
}

const DECISION_LABELS: Record<Decision, string> = {
  confirmed_fraud: "fraud",
  false_positive: "false positive",
  escalated: "escalated",
};

const DECISION_BG: Record<Decision, string> = {
  confirmed_fraud: "var(--color-danger-soft)",
  false_positive: "var(--color-success-soft)",
  escalated: "var(--color-warning-soft)",
};

const DECISION_FG: Record<Decision, string> = {
  confirmed_fraud: "var(--color-brand)",
  false_positive: "var(--color-success)",
  escalated: "var(--color-warning)",
};

export function DecisionBadge({ decision, className }: DecisionBadgeProps) {
  if (!decision) {
    return (
      <span
        className={cn(
          "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono",
          className,
        )}
        style={{
          background: "var(--color-surface-elevated)",
          color: "var(--color-fg-faint)",
          border: "1px solid var(--color-border)",
        }}
      >
        pending
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono",
        className,
      )}
      style={{ background: DECISION_BG[decision], color: DECISION_FG[decision] }}
    >
      {DECISION_LABELS[decision]}
    </span>
  );
}
