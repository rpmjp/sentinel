import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Activity, AlertTriangle, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Metric } from "@/components/ui/Metric";
import { fmtNumber } from "@/lib/format";

interface FeatureDrift {
  feature: string;
  psi: number;
  status: "stable" | "warning" | "alert";
  baseline_mean: number;
  recent_mean: number;
}

interface ScoreDistribution {
  bucket: string;
  baseline_count: number;
  recent_count: number;
}

interface DriftResponse {
  overall_psi: number;
  overall_status: "stable" | "warning" | "alert";
  n_baseline: number;
  n_recent: number;
  features: FeatureDrift[];
  score_distribution: ScoreDistribution[];
}

const STATUS_COLOR = {
  stable: "var(--color-success)",
  warning: "var(--color-warning)",
  alert: "var(--color-danger)",
};

const STATUS_ICON = {
  stable: CheckCircle2,
  warning: AlertTriangle,
  alert: AlertTriangle,
};

function useDrift() {
  return useQuery({
    queryKey: ["drift"],
    queryFn: async () => {
      const { data } = await api.get<DriftResponse>("/drift");
      return data;
    },
    refetchInterval: 30_000,
  });
}

export default function Drift() {
  const { data, isLoading, error } = useDrift();

  if (isLoading) {
    return (
      <div className="p-6 text-sm" style={{ color: "var(--color-fg-subtle)" }}>
        Computing drift…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="p-6 text-sm" style={{ color: "var(--color-danger)" }}>
        Failed to load drift data.
      </div>
    );
  }

  const StatusIcon = STATUS_ICON[data.overall_status];

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <Card padding="md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StatusIcon size={18} style={{ color: STATUS_COLOR[data.overall_status] }} />
            <div>
              <div
                className="text-[10px] uppercase tracking-wider mb-1"
                style={{ color: "var(--color-fg-subtle)" }}
              >
                Overall drift
              </div>
              <div className="flex items-baseline gap-2">
                <span
                  className="font-mono text-2xl font-medium"
                  style={{ color: STATUS_COLOR[data.overall_status] }}
                >
                  {data.overall_psi.toFixed(3)}
                </span>
                <span
                  className="text-xs uppercase tracking-wider"
                  style={{ color: STATUS_COLOR[data.overall_status] }}
                >
                  {data.overall_status}
                </span>
              </div>
            </div>
          </div>
          <div className="text-xs font-mono text-right" style={{ color: "var(--color-fg-faint)" }}>
            <div>baseline: {fmtNumber(data.n_baseline)} txns</div>
            <div>recent: {fmtNumber(data.n_recent)} txns</div>
          </div>
        </div>

        <div className="mt-4 text-xs flex gap-4 font-mono" style={{ color: "var(--color-fg-subtle)" }}>
          <span><span style={{ color: "var(--color-success)" }}>●</span> stable (PSI &lt; 0.1)</span>
          <span><span style={{ color: "var(--color-warning)" }}>●</span> warning (0.1 - 0.25)</span>
          <span><span style={{ color: "var(--color-danger)" }}>●</span> alert (&gt; 0.25)</span>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {data.features.map((f) => (
          <Metric
            key={f.feature}
            label={f.feature}
            value={f.psi.toFixed(3)}
            delta={f.status}
            deltaTone={f.status === "stable" ? "positive" : f.status === "alert" ? "negative" : "neutral"}
            highlighted={f.status !== "stable"}
          />
        ))}
      </div>

      <Card>
        <div
          className="text-[10px] uppercase tracking-wider mb-1"
          style={{ color: "var(--color-fg-subtle)" }}
        >
          Score distribution: baseline vs recent
        </div>
        <div className="text-xs mb-3 flex items-center gap-2" style={{ color: "var(--color-fg-faint)" }}>
          <Activity size={12} />
          <span>Visual check that the model's score histogram hasn't shifted.</span>
        </div>
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={data.score_distribution}>
              <XAxis dataKey="bucket" stroke="var(--color-fg-faint)" fontSize={10} />
              <YAxis stroke="var(--color-fg-faint)" fontSize={10} />
              <Tooltip
                contentStyle={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  fontSize: 11,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="baseline_count" fill="var(--color-fg-subtle)" name="baseline" />
              <Bar dataKey="recent_count" fill="var(--color-brand)" name="recent" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card padding="none">
        <div
          className="px-4 py-3 border-b text-[10px] uppercase tracking-wider"
          style={{ color: "var(--color-fg-subtle)", borderColor: "var(--color-border)" }}
        >
          Feature drift detail
        </div>
        {data.features.map((f) => (
          <div
            key={f.feature}
            className="grid grid-cols-[1fr_100px_120px_120px] gap-3 px-4 py-3 border-t items-center text-xs"
            style={{ borderColor: "var(--color-border)" }}
          >
            <span className="font-mono">{f.feature}</span>
            <span
              className="font-mono"
              style={{ color: STATUS_COLOR[f.status] }}
            >
              PSI {f.psi.toFixed(3)}
            </span>
            <span style={{ color: "var(--color-fg-subtle)" }}>
              baseline μ <span className="font-mono">{f.baseline_mean.toFixed(2)}</span>
            </span>
            <span style={{ color: "var(--color-fg-subtle)" }}>
              recent μ <span className="font-mono">{f.recent_mean.toFixed(2)}</span>
            </span>
          </div>
        ))}
      </Card>
    </div>
  );
}