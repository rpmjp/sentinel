import { useQuery } from "@tanstack/react-query";
import { Cpu, GitBranch } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { fmtScore, fmtRelativeTime } from "@/lib/format";

interface ModelVersion {
  id: string;
  name: string;
  version: string;
  stage: string;
  metrics: Record<string, number>;
  git_sha: string | null;
  threshold: number;
  created_at: string;
  activated_at: string | null;
}

const STAGE_STYLES: Record<string, { bg: string; fg: string }> = {
  production: {
    bg: "rgba(93,202,165,0.15)",
    fg: "var(--color-success)",
  },
  staging: {
    bg: "rgba(239,159,39,0.15)",
    fg: "var(--color-warning)",
  },
  archived: {
    bg: "var(--color-surface-elevated)",
    fg: "var(--color-fg-faint)",
  },
};

function useModels() {
  return useQuery({
    queryKey: ["models"],
    queryFn: async () => {
      const { data } = await api.get<ModelVersion[]>("/models");
      return data;
    },
  });
}

export default function Models() {
  const { data, isLoading, error } = useModels();

  if (isLoading) {
    return (
      <div className="p-6 text-sm" style={{ color: "var(--color-fg-subtle)" }}>
        Loading registry…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="p-6 text-sm" style={{ color: "var(--color-danger)" }}>
        Failed to load models.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <Card padding="md">
        <div className="flex items-center gap-2 mb-1">
          <Cpu size={14} style={{ color: "var(--color-fg-subtle)" }} />
          <span
            className="text-[10px] uppercase tracking-wider"
            style={{ color: "var(--color-fg-subtle)" }}
          >
            Model registry
          </span>
        </div>
        <div className="text-xs" style={{ color: "var(--color-fg-faint)" }}>
          All versions trained for this tenant. Production stage is what
          /score uses.
        </div>
      </Card>

      {data.length === 0 ? (
        <Card>
          <div className="text-sm" style={{ color: "var(--color-fg-subtle)" }}>
            No model versions registered yet.
          </div>
        </Card>
      ) : (
        data.map((m) => {
          const stage = STAGE_STYLES[m.stage] ?? STAGE_STYLES.archived;
          return (
            <Card key={m.id} padding="none">
              <div
                className="px-4 py-4 border-b"
                style={{ borderColor: "var(--color-border)" }}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-medium">{m.name}</span>
                      <span
                        className="font-mono text-xs"
                        style={{ color: "var(--color-fg-faint)" }}
                      >
                        v{m.version}
                      </span>
                      <span
                        className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{ background: stage.bg, color: stage.fg }}
                      >
                        {m.stage}
                      </span>
                    </div>
                    <div
                      className="text-xs mt-1 flex items-center gap-3"
                      style={{ color: "var(--color-fg-subtle)" }}
                    >
                      <span>created {fmtRelativeTime(m.created_at)}</span>
                      {m.git_sha && (
                        <span className="flex items-center gap-1 font-mono">
                          <GitBranch size={10} />
                          {m.git_sha}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className="text-[10px] uppercase tracking-wider"
                      style={{ color: "var(--color-fg-subtle)" }}
                    >
                      threshold
                    </div>
                    <div className="font-mono text-lg font-medium">
                      {m.threshold.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-4 py-3">
                <div
                  className="text-[10px] uppercase tracking-wider mb-2"
                  style={{ color: "var(--color-fg-subtle)" }}
                >
                  Test metrics
                </div>
                {Object.keys(m.metrics).length === 0 ? (
                  <div
                    className="text-xs"
                    style={{ color: "var(--color-fg-faint)" }}
                  >
                    No metrics recorded.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(m.metrics).map(([k, v]) => (
                      <MetricRow key={k} label={k} value={v} />
                    ))}
                  </div>
                )}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: number }) {
  const isMoney = label.toLowerCase().includes("savings");
  const isCount = label.startsWith("n_") || label === "n_total" || label === "n_positive";
  const display = isMoney
    ? value >= 1e6
      ? `$${(value / 1e6).toFixed(2)}M`
      : `$${value.toLocaleString()}`
    : isCount
    ? value.toLocaleString()
    : fmtScore(value);

  return (
    <div>
      <div
        className="text-[10px] uppercase tracking-wider mb-1 font-mono"
        style={{ color: "var(--color-fg-subtle)" }}
      >
        {label}
      </div>
      <div className="font-mono">{display}</div>
    </div>
  );
}