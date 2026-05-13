import type { TopFeature } from "@/lib/types";
import { cn } from "@/lib/cn";

interface ShapWaterfallProps {
  features: TopFeature[];
  baseValue?: number;
}

/**
 * Horizontal SHAP-style contributions. Positive (push toward fraud) shown
 * in coral on the right; negative (push toward legit) in teal on the left.
 */
export function ShapWaterfall({ features }: ShapWaterfallProps) {
  if (features.length === 0) {
    return (
      <div className="text-sm" style={{ color: "var(--color-fg-faint)" }}>
        No SHAP attributions available.
      </div>
    );
  }

  const maxAbs = Math.max(...features.map((f) => Math.abs(f.contribution)));

  return (
    <div className="space-y-2">
      {features.map((f) => {
        const pct = (Math.abs(f.contribution) / maxAbs) * 100;
        const positive = f.contribution > 0;
        return (
          <div
            key={f.name}
            className="grid grid-cols-[1fr_2fr_90px] gap-3 items-center text-xs"
          >
            <div className="font-mono truncate" title={f.name}>
              {f.name}
            </div>
            <div className="relative h-5 flex items-center">
              {/* center line */}
              <div
                className="absolute inset-y-0 left-1/2 w-px"
                style={{ background: "var(--color-border)" }}
              />
              {/* bar */}
              <div
                className={cn(
                  "absolute h-3 rounded-sm",
                  positive ? "left-1/2" : "right-1/2",
                )}
                style={{
                  width: `${pct / 2}%`,
                  background: positive
                    ? "var(--color-risk-high)"
                    : "var(--color-success)",
                }}
              />
            </div>
            <div
              className="font-mono text-right"
              style={{
                color: positive
                  ? "var(--color-risk-high)"
                  : "var(--color-success)",
              }}
            >
              {positive ? "+" : ""}
              {f.contribution.toFixed(3)}
            </div>
          </div>
        );
      })}
      <div
        className="grid grid-cols-[1fr_2fr_90px] gap-3 pt-2 text-[10px] font-mono"
        style={{ color: "var(--color-fg-faint)" }}
      >
        <div>feature</div>
        <div className="text-center">← legit | fraud →</div>
        <div className="text-right">contribution</div>
      </div>
    </div>
  );
}