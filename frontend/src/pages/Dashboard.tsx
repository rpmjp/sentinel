import { Link } from "react-router-dom";
import { ArrowRight, AlertCircle } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  ResponsiveContainer, Tooltip, CartesianGrid,
} from "recharts";
import { Card } from "@/components/ui/Card";
import { BigNumber } from "@/components/ui/BigNumber";
import { RiskBadge } from "@/components/ui/Badge";
import { Heatmap } from "@/components/Heatmap";
import { LiveTicker } from "@/components/LiveTicker";
import { ReplayControl } from "@/components/ReplayControl";
import {
  useKpis, useQueue, useTimeseries, useHeatmap, useTypeBreakdown,
} from "@/lib/hooks";
import {
  fmtCurrencyCompact, fmtNumber, fmtRelativeTime, fmtScore,
} from "@/lib/format";

export default function Dashboard() {
  const kpis = useKpis();
  const ts = useTimeseries(24);
  const heatmap = useHeatmap();
  const types = useTypeBreakdown();
  const recent = useQueue({ risk: "high", page_size: 5 });

  if (kpis.isLoading) {
    return (
      <div className="p-6" style={{ color: "var(--color-fg-subtle)" }}>
        Loading dashboard…
      </div>
    );
  }
  if (kpis.error || !kpis.data) {
    return (
      <div
        className="p-6 flex items-start gap-2"
        style={{ color: "var(--color-danger)" }}
      >
        <AlertCircle size={16} />
        <span className="text-sm">Failed to load KPIs.</span>
      </div>
    );
  }

  const k = kpis.data;

  return (
    <div className="p-6 space-y-4">
      {/* Headline KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <BigNumber
          label="Open cases"
          value={k.open_cases}
          format={fmtNumber}
          delta={`${k.high_risk_24h} high-risk in 24h`}
          deltaTone={k.open_cases > 0 ? "negative" : "neutral"}
          highlighted={k.open_cases > 100}
          accent={k.open_cases > 100 ? "var(--color-warning)" : undefined}
        />
        <BigNumber
          label="Blocked (24h)"
          value={k.blocked_amount_24h}
          format={fmtCurrencyCompact}
          delta="vs $0 baseline"
          deltaTone="positive"
          accent="var(--color-success)"
        />
        <BigNumber
          label="Throughput (24h)"
          value={k.txn_count_24h}
          format={fmtNumber}
          delta="transactions scored"
          deltaTone="neutral"
        />
        <BigNumber
          label="Avg score"
          value={k.avg_score_24h}
          decimals={3}
          format={(n) => n.toFixed(3)}
          delta="PR-AUC 0.992"
          deltaTone="neutral"
        />
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Main column */}
        <div className="col-span-12 lg:col-span-8 space-y-4">
          {/* Time-series area chart */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div
                  className="text-[10px] uppercase tracking-wider mb-1"
                  style={{ color: "var(--color-fg-subtle)" }}
                >
                  Transaction volume · last 24h
                </div>
                <div className="text-xs" style={{ color: "var(--color-fg-faint)" }}>
                  {ts.data?.length ?? 0} hourly buckets · auto-refresh every 10s
                </div>
              </div>
              <div className="flex gap-3 text-[10px] font-mono" style={{ color: "var(--color-fg-subtle)" }}>
                <span><span style={{ color: "var(--color-fg-faint)" }}>● </span>all txns</span>
                <span><span style={{ color: "var(--color-brand)" }}>● </span>flagged</span>
              </div>
            </div>
            <div style={{ width: "100%", height: 200 }}>
              <ResponsiveContainer>
                <AreaChart data={ts.data ?? []}>
                  <defs>
                    <linearGradient id="gAll" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-fg-subtle)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--color-fg-subtle)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gFraud" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-brand)" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="var(--color-brand)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="timestamp" stroke="var(--color-fg-faint)" fontSize={10} />
                  <YAxis stroke="var(--color-fg-faint)" fontSize={10} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      fontSize: 11,
                    }}
                  />
                  <Area
                    type="monotone" dataKey="txn_count"
                    stroke="var(--color-fg-subtle)" strokeWidth={1.5}
                    fill="url(#gAll)" name="All txns"
                  />
                  <Area
                    type="monotone" dataKey="fraud_count"
                    stroke="var(--color-brand)" strokeWidth={2}
                    fill="url(#gFraud)" name="Flagged"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Heatmap */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div
                  className="text-[10px] uppercase tracking-wider mb-1"
                  style={{ color: "var(--color-fg-subtle)" }}
                >
                  Activity heatmap · all time
                </div>
                <div className="text-xs" style={{ color: "var(--color-fg-faint)" }}>
                  Hour of day × day of week, by transaction volume
                </div>
              </div>
            </div>
            {heatmap.data && <Heatmap data={heatmap.data} mode="count" />}
          </Card>

          {/* Type breakdown */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div
                  className="text-[10px] uppercase tracking-wider mb-1"
                  style={{ color: "var(--color-fg-subtle)" }}
                >
                  Risk by transaction type
                </div>
                <div className="text-xs" style={{ color: "var(--color-fg-faint)" }}>
                  Stacked counts across the full history
                </div>
              </div>
              <div className="flex gap-3 text-[10px] font-mono" style={{ color: "var(--color-fg-subtle)" }}>
                <span><span style={{ color: "var(--color-risk-high)" }}>● </span>high</span>
                <span><span style={{ color: "var(--color-risk-medium)" }}>● </span>med</span>
                <span><span style={{ color: "var(--color-risk-low)" }}>● </span>low</span>
              </div>
            </div>
            <div style={{ width: "100%", height: 200 }}>
              <ResponsiveContainer>
                <BarChart data={types.data ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="type" stroke="var(--color-fg-faint)" fontSize={10} />
                  <YAxis stroke="var(--color-fg-faint)" fontSize={10} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      fontSize: 11,
                    }}
                  />
                  <Bar dataKey="high" stackId="r" fill="var(--color-risk-high)" />
                  <Bar dataKey="medium" stackId="r" fill="var(--color-risk-medium)" />
                  <Bar dataKey="low" stackId="r" fill="var(--color-risk-low)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
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

        {/* Right sidebar */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          <ReplayControl />
          <LiveTicker />
        </div>
      </div>
    </div>
  );
}