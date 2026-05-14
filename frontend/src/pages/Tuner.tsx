import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { ArrowRight, Sliders } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Metric } from "@/components/ui/Metric";
import { fmtCurrency, fmtPct } from "@/lib/format";

interface CostCurvePoint {
  threshold: number;
  precision: number;
  recall: number;
  net_savings: number;
}

interface TunerData {
  model_name: string;
  current_threshold: number;
  cost_curve: CostCurvePoint[];
}

function useTunerData() {
  return useQuery({
    queryKey: ["tuner"],
    queryFn: async () => {
      const { data } = await api.get<TunerData>("/tuner");
      return data;
    },
  });
}

export default function Tuner() {
  const { data, isLoading, error } = useTunerData();
  const [threshold, setThreshold] = useState(0.5);

  const current = useMemo(() => {
  if (!data) return null;
  return data.cost_curve.reduce((closest, point) =>
    Math.abs(point.threshold - threshold) <
    Math.abs(closest.threshold - threshold)
      ? point
      : closest,
  );
}, [data, threshold]);


  const optimal = useMemo(() => {
    if (!data) return null;
    return data.cost_curve.reduce((best, p) =>
      p.net_savings > best.net_savings ? p : best,
    );
  }, [data]);

  if (isLoading) {
    return (
      <div className="p-6 text-sm" style={{ color: "var(--color-fg-subtle)" }}>
        Loading curves…
      </div>
    );
  }
  if (error || !data || !current || !optimal) {
    return (
      <div className="p-6 text-sm" style={{ color: "var(--color-danger)" }}>
        Failed to load curve data.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <Card padding="md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div
              className="text-[10px] uppercase tracking-wider mb-1"
              style={{ color: "var(--color-fg-subtle)" }}
            >
              Threshold tuner
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--color-fg-faint)" }}>
              <Sliders size={12} />
              <span>
                Model: <span className="font-mono">{data.model_name}</span>
              </span>
              <span>·</span>
              <span>
                Production τ: <span className="font-mono">{data.current_threshold.toFixed(2)}</span>
              </span>
            </div>
            <div className="flex gap-3 mt-2 text-xs">
              <Link
                to="/models"
                className="inline-flex items-center gap-1"
                style={{ color: "var(--color-brand)" }}
              >
                production model <ArrowRight size={12} />
              </Link>
              <Link
                to="/investigate?risk=high"
                className="inline-flex items-center gap-1"
                style={{ color: "var(--color-brand)" }}
              >
                review flagged cases <ArrowRight size={12} />
              </Link>
            </div>
          </div>
          <button
            className="text-xs px-2 py-1 rounded"
            style={{
              background: "var(--color-brand-soft)",
              color: "var(--color-brand)",
            }}
            onClick={() => setThreshold(optimal.threshold)}
          >
            jump to optimum (τ = {optimal.threshold.toFixed(2)})
          </button>
        </div>

        <div className="space-y-2">
          <input
            type="range"
            min={0.01}
            max={0.99}
            step={0.01}
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            className="w-full accent-[var(--color-brand)]"
          />
          <div className="flex items-center justify-between text-[10px] font-mono" style={{ color: "var(--color-fg-faint)" }}>
            <span>0.01 (catch everything)</span>
            <span className="text-sm font-medium" style={{ color: "var(--color-fg)" }}>
              τ = {threshold.toFixed(2)}
            </span>
            <span>0.99 (catch nothing)</span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric
          label="Precision"
          value={fmtPct(current.precision, 1)}
          delta="of flagged are real fraud"
        />
        <Metric
          label="Recall"
          value={fmtPct(current.recall, 1)}
          delta="of fraud caught"
        />
        <Metric
          label="Net savings"
          value={fmtCurrency(current.net_savings)}
          delta="$1000/missed · $5/FP"
          deltaTone={current.net_savings >= 0 ? "positive" : "negative"}
          highlighted={current.net_savings === optimal.net_savings}
        />
        <Metric
          label="vs. optimum"
          value={fmtCurrency(current.net_savings - optimal.net_savings)}
          delta={
            current.net_savings === optimal.net_savings ? "best" : "below optimum"
          }
          deltaTone={
            current.net_savings === optimal.net_savings ? "positive" : "neutral"
          }
        />
      </div>

      <Card>
        <div
          className="text-[10px] uppercase tracking-wider mb-3"
          style={{ color: "var(--color-fg-subtle)" }}
        >
          Net savings vs threshold
        </div>
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer>
            <ComposedChart data={data.cost_curve}>
              <XAxis
                dataKey="threshold"
                tickFormatter={(t: number) => t.toFixed(1)}
                stroke="var(--color-fg-faint)"
                fontSize={10}
              />
              <YAxis
                stroke="var(--color-fg-faint)"
                fontSize={10}
                tickFormatter={(v: number) =>
                  v >= 1e6
                    ? `$${(v / 1e6).toFixed(1)}M`
                    : v >= 1e3
                    ? `$${(v / 1e3).toFixed(0)}K`
                    : `$${v}`
                }
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  fontSize: 11,
                }}
                labelFormatter={(t) =>
                  typeof t === "number" ? `τ = ${t.toFixed(2)}` : `τ = ${t}`
                }
                formatter={(v) =>
                  typeof v === "number" ? fmtCurrency(v) : v
                }
              />

              <Line
                type="monotone"
                dataKey="net_savings"
                stroke="var(--color-brand)"
                strokeWidth={2}
                dot={false}
              />
              <ReferenceLine
                x={threshold}
                stroke="var(--color-fg)"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <div
          className="text-[10px] uppercase tracking-wider mb-3"
          style={{ color: "var(--color-fg-subtle)" }}
        >
          Precision · recall vs threshold
        </div>
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer>
            <ComposedChart data={data.cost_curve}>
              <XAxis
                dataKey="threshold"
                tickFormatter={(t: number) => t.toFixed(1)}
                stroke="var(--color-fg-faint)"
                fontSize={10}
              />
              <YAxis
                stroke="var(--color-fg-faint)"
                fontSize={10}
                tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  fontSize: 11,
                }}
                labelFormatter={(t) =>
                  typeof t === "number" ? `τ = ${t.toFixed(2)}` : `τ = ${t}`
                }
                formatter={(v) =>
                  typeof v === "number" ? fmtPct(v, 1) : v
                }
              />

              <Line
                type="monotone"
                dataKey="precision"
                stroke="var(--color-success)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="recall"
                stroke="var(--color-warning)"
                strokeWidth={2}
                dot={false}
              />
              <ReferenceLine
                x={threshold}
                stroke="var(--color-fg)"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 text-xs font-mono mt-2" style={{ color: "var(--color-fg-subtle)" }}>
          <span><span style={{ color: "var(--color-success)" }}>●</span> precision</span>
          <span><span style={{ color: "var(--color-warning)" }}>●</span> recall</span>
        </div>
      </Card>
    </div>
  );
}
