import { useState } from "react";
import type { HeatmapCell } from "@/lib/hooks";

interface HeatmapProps {
  data: HeatmapCell[];
  mode?: "count" | "fraud_rate";
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * 7 x 24 heatmap: rows are days, columns are hours of day.
 * Cell intensity from low (subtle border) to high (full brand color).
 */
export function Heatmap({ data, mode = "count" }: HeatmapProps) {
  const [hover, setHover] = useState<HeatmapCell | null>(null);

  // Build a lookup: day -> hour -> cell
  const grid: Record<number, Record<number, HeatmapCell>> = {};
  let maxVal = 0;
  for (const cell of data) {
    const v = mode === "count" ? cell.count : cell.fraud_rate;
    if (v > maxVal) maxVal = v;
    if (!grid[cell.day]) grid[cell.day] = {};
    grid[cell.day][cell.hour] = cell;
  }

  function intensity(cell: HeatmapCell | undefined): number {
    if (!cell || maxVal === 0) return 0;
    const v = mode === "count" ? cell.count : cell.fraud_rate;
    return Math.min(1, v / maxVal);
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <div className="inline-block">
          {/* Hour header */}
          <div className="flex pl-[40px] mb-1">
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className="w-[18px] text-[9px] font-mono text-center"
                style={{ color: "var(--color-fg-faint)" }}
              >
                {h % 3 === 0 ? h : ""}
              </div>
            ))}
          </div>

          {/* Grid */}
          {DAYS.map((day, dayIdx) => (
            <div key={day} className="flex items-center mb-0.5">
              <div
                className="w-[40px] text-[10px] font-mono"
                style={{ color: "var(--color-fg-subtle)" }}
              >
                {day}
              </div>
              {Array.from({ length: 24 }, (_, hour) => {
                const cell = grid[dayIdx]?.[hour];
                const i = intensity(cell);
                return (
                  <div
                    key={hour}
                    onMouseEnter={() => cell && setHover(cell)}
                    onMouseLeave={() => setHover(null)}
                    className="w-[16px] h-[16px] rounded-sm mx-px transition-all"
                    style={{
                      background:
                        i === 0
                          ? "var(--color-surface)"
                          : `rgba(216, 90, 48, ${0.15 + i * 0.85})`,
                      border:
                        i === 0
                          ? "1px solid var(--color-border)"
                          : "none",
                      cursor: cell?.count ? "pointer" : "default",
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend + tooltip */}
      <div
        className="flex items-center justify-between text-[10px] font-mono pt-1"
        style={{ color: "var(--color-fg-faint)" }}
      >
        <div className="flex items-center gap-2">
          <span>less</span>
          {[0.1, 0.3, 0.5, 0.7, 0.9].map((i) => (
            <div
              key={i}
              className="w-[12px] h-[12px] rounded-sm"
              style={{ background: `rgba(216, 90, 48, ${0.15 + i * 0.85})` }}
            />
          ))}
          <span>more</span>
        </div>
        {hover ? (
          <div>
            <span>{DAYS[hover.day]} {hover.hour}:00 — </span>
            <span style={{ color: "var(--color-fg)" }}>
              {hover.count} txns
            </span>
            {hover.count > 0 && (
              <span style={{ color: "var(--color-brand)" }}>
                {" · "}
                {(hover.fraud_rate * 100).toFixed(1)}% fraud
              </span>
            )}
          </div>
        ) : (
          <span>Hover for details · {mode === "count" ? "by volume" : "by fraud rate"}</span>
        )}
      </div>
    </div>
  );
}