import { Link } from "react-router-dom";
import { ArrowRight, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Metric } from "@/components/ui/Metric";
import { Sparkline } from "@/components/ui/Sparkline";
import { RiskBadge } from "@/components/ui/Badge";
import { useKpis, useQueue, useSparkline } from "@/lib/hooks";
import { fmtCurrencyCompact, fmtNumber, fmtRelativeTime, fmtScore } from "@/lib/format";

export default function Dashboard() {
  const kpis = useKpis();
  const sparkline = useSparkline();
  const recent = useQueue({ risk: "high", page_size: 5 });

  if (kpis.isLoading || sparkline.isLoading) {
    return (
      <div className="p-6" style={{ color: "var(--color-fg-subtle)" }}>
        Loading…
      </div>
    );
  }

  if (kpis.error) {
    return (
      <div className="p-6 flex items-start gap-2" style={{ color: "var(--color-danger)" }}>
        <AlertCircle size={16} />
        <span className="text-sm">Failed to load KPIs.</span>
      </div>
    );
  }

  const k = kpis.data!;
  const spark = sparkline.data ?? [];

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric
          label="Open cases"
          value={fmtNumber(k.open_cases)}
          delta={`${k.high_risk_24h} high-risk in 24h`}
          deltaTone={k.open_cases > 0 ? "negative" : "neutral"}
          sparkline={<Sparkline points={spark} color="var(--color-brand)" />}
        />
        <Metric
          label="Blocked (24h)"
          value={fmtCurrencyCompact(k.blocked_amount_24h)}
          delta={`${fmtNumber(k.high_risk_24h)} txns flagged`}
          deltaTone="positive"
          sparkline={<Sparkline points={spark} color="var(--color-success)" />}
        />
        <Metric
          label="Throughput (24h)"
          value={fmtNumber(k.txn_count_24h)}
          delta="scored"
          deltaTone="neutral"
          sparkline={<Sparkline points={spark} color="var(--color-fg-subtle)" />}
        />
        <Metric
          label="Avg score"
          value={fmtScore(k.avg_score_24h)}
          delta={`PR-AUC 0.992`}
          deltaTone="neutral"
          sparkline={<Sparkline points={spark} color="var(--color-fg-subtle)" />}
        />
      </div>

      {/* Risk distribution */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div
              className="text-[10px] uppercase tracking-wider mb-1"
              style={{ color: "var(--color-fg-subtle)" }}
            >
              Risk distribution · last 24h
            </div>
            <div className="text-xs" style={{ color: "var(--color-fg-faint)" }}>
              {fmtNumber(k.txn_count_24h)} transactions
            </div>
          </div>
          <Link
            to="/queue"
            className="text-xs flex items-center gap-1"
            style={{ color: "var(--color-brand)" }}
          >
            view queue <ArrowRight size={12} />
          </Link>
        </div>
        <RiskBar
          high={k.high_risk_24h}
          medium={k.medium_risk_24h}
          low={k.low_risk_24h}
        />
      </Card>

      {/* Recent high-risk */}
      <Card padding="none">
        <div
          className="px-4 py-3 border-b flex items-center justify-between"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div>
            <div className="text-sm font-medium">Recent high-risk transactions</div>
            <div
              className="text-xs mt-0.5"
              style={{ color: "var(--color-fg-faint)" }}
            >
              top 5, score desc
            </div>
          </div>
          <Link
            to="/queue"
            className="text-xs flex items-center gap-1"
            style={{ color: "var(--color-brand)" }}
          >
            full queue <ArrowRight size={12} />
          </Link>
        </div>

        {recent.isLoading ? (
          <div className="p-6 text-sm" style={{ color: "var(--color-fg-subtle)" }}>
            Loading…
          </div>
        ) : (recent.data?.items.length ?? 0) === 0 ? (
          <div className="p-6 text-sm" style={{ color: "var(--color-fg-subtle)" }}>
            No high-risk transactions yet.
          </div>
        ) : (
          <div>
            {recent.data!.items.map((item) => (
              <Link
                key={item.transaction_id}
                to={`/transactions/${item.transaction_id}`}
                className="grid grid-cols-[50px_70px_1fr_100px_80px] gap-3 px-4 py-3 border-t items-center text-sm hover:bg-[var(--color-surface-elevated)] transition-colors"
                style={{ borderColor: "var(--color-border)" }}
              >
                <RiskBadge risk={item.risk_band} />
                <span className="font-mono font-medium">{fmtScore(item.score)}</span>
                <span
                  className="font-mono text-xs truncate"
                  style={{ color: "var(--color-fg-muted)" }}
                >
                  {item.name_orig} → {item.name_dest}
                </span>
                <span className="font-mono text-right">
                  {fmtCurrencyCompact(item.amount)}
                </span>
                <span
                  className="text-xs text-right"
                  style={{ color: "var(--color-fg-faint)" }}
                >
                  {fmtRelativeTime(item.scored_at)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

interface RiskBarProps {
  high: number;
  medium: number;
  low: number;
}

function RiskBar({ high, medium, low }: RiskBarProps) {
  const total = high + medium + low;
  if (total === 0) {
    return (
      <div className="text-xs" style={{ color: "var(--color-fg-faint)" }}>
        No data in the last 24h.
      </div>
    );
  }
  const pct = (n: number) => (n / total) * 100;
  return (
    <div className="space-y-2">
      <div
        className="flex h-2 rounded overflow-hidden"
        style={{ background: "var(--color-surface)" }}
      >
        <div style={{ width: `${pct(high)}%`, background: "var(--color-risk-high)" }} />
        <div style={{ width: `${pct(medium)}%`, background: "var(--color-risk-medium)" }} />
        <div style={{ width: `${pct(low)}%`, background: "var(--color-risk-low)" }} />
      </div>
      <div
        className="flex gap-4 text-[11px] font-mono"
        style={{ color: "var(--color-fg-subtle)" }}
      >
        <span>
          <span style={{ color: "var(--color-risk-high)" }}>● </span>
          high · {fmtNumber(high)}
        </span>
        <span>
          <span style={{ color: "var(--color-risk-medium)" }}>● </span>
          medium · {fmtNumber(medium)}
        </span>
        <span>
          <span style={{ color: "var(--color-risk-low)" }}>● </span>
          low · {fmtNumber(low)}
        </span>
      </div>
    </div>
  );
}