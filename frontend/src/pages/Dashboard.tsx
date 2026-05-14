import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, AlertCircle, Clock, ShieldAlert } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, Line, XAxis, YAxis,
  Tooltip, CartesianGrid,
} from "recharts";
import { Card } from "@/components/ui/Card";
import { BigNumber } from "@/components/ui/BigNumber";
import { ChartContainer } from "@/components/ui/ChartContainer";
import { RiskBadge } from "@/components/ui/Badge";
import { Heatmap } from "@/components/Heatmap";
import { LiveTicker } from "@/components/LiveTicker";
import { ReplayControl } from "@/components/ReplayControl";
import { GeoMap } from "@/components/GeoMap";
import {
  useCases, useKpis, useQueue, useTimeseries, useHeatmap, useTypeBreakdown, useSparkline,
} from "@/lib/hooks";
import {
  fmtCurrencyCompact, fmtNumber, fmtPct, fmtRelativeTime, fmtScore,
} from "@/lib/format";

type HeatmapMode = "count" | "fraud_rate";
type DashboardRange = "24h" | "7d" | "30d" | "all";

const RANGE_OPTIONS: Array<{ value: DashboardRange; label: string; hours: number }> = [
  { value: "24h", label: "24h", hours: 24 },
  { value: "7d", label: "7d", hours: 168 },
  { value: "30d", label: "30d", hours: 720 },
  { value: "all", label: "All", hours: 0 },
];

export default function Dashboard() {
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>("count");
  const [range, setRange] = useState<DashboardRange>("24h");
  const [autoFallback, setAutoFallback] = useState(false);
  const rangeConfig = RANGE_OPTIONS.find((option) => option.value === range) ?? RANGE_OPTIONS[0];
  const allKpis = useKpis(0);
  const kpis = useKpis(rangeConfig.hours);
  const ts = useTimeseries(rangeConfig.hours);
  const heatmap = useHeatmap();
  const types = useTypeBreakdown();
  const sparkline = useSparkline(rangeConfig.hours);
  const recent = useQueue({ risk: "high", page_size: 5 });
  const pendingHighRisk = useQueue({ risk: "high", page_size: 1 });
  const cases = useCases();
  useEffect(() => {
    if (
      range === "24h" &&
      kpis.data &&
      allKpis.data &&
      kpis.data.txn_count_24h === 0 &&
      allKpis.data.txn_count_24h > 0
    ) {
      setRange("all");
      setAutoFallback(true);
    }
  }, [allKpis.data, kpis.data, range]);

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
  const windowLabel = rangeConfig.label;
  const windowCopy = range === "all" ? "all time" : `last ${windowLabel}`;
  const totalRiskWindow = k.high_risk_24h + k.medium_risk_24h + k.low_risk_24h;
  const highRiskShare = totalRiskWindow > 0 ? k.high_risk_24h / totalRiskWindow : 0;
  const fraudRateSeries = (ts.data ?? []).map((point) => ({
    ...point,
    fraud_rate: point.txn_count > 0 ? point.fraud_count / point.txn_count : 0,
  }));
  const peakBucket = fraudRateSeries.reduce(
    (peak, point) => (point.fraud_count > peak.fraud_count ? point : peak),
    fraudRateSeries[0] ?? {
      timestamp: "--",
      txn_count: 0,
      fraud_count: 0,
      blocked_amount: 0,
      avg_score: 0,
      fraud_rate: 0,
    },
  );
  const topRiskType = (types.data ?? []).reduce(
    (top, item) => (item.high > top.high ? item : top),
    { type: "none", high: 0, medium: 0, low: 0 },
  );
  const incidentTone = k.high_risk_24h > 0 || k.open_cases > 0 ? "Elevated" : "Normal";
  const oldestPending = recent.data?.items.at(-1);
  const topTypePath = topRiskType.type === "none"
    ? investigatePath({ risk: "high" })
    : investigatePath({ risk: "high", txn_type: topRiskType.type });

  return (
    <div className="p-6 space-y-4">
      {/* Incident pulse */}
      <Card padding="sm">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
              style={{
                background: k.high_risk_24h > 0
                  ? "rgba(216,90,48,0.12)"
                  : "rgba(93,202,165,0.12)",
                color: k.high_risk_24h > 0
                  ? "var(--color-danger)"
                  : "var(--color-success)",
              }}
            >
              <ShieldAlert size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium">
                {incidentTone} fraud posture
              </div>
              <div
                className="text-xs truncate"
                style={{ color: "var(--color-fg-subtle)" }}
              >
                {k.high_risk_24h} high-risk in {windowCopy} · {fmtCurrencyCompact(k.blocked_amount_24h)} exposure blocked · {topRiskType.type} leading risk type
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {autoFallback && (
              <span className="text-xs" style={{ color: "var(--color-info)" }}>
                No scored volume in 24h. Showing all-time activity.
              </span>
            )}
            <RangeSelector
              value={range}
              onChange={(next) => {
                setRange(next);
                setAutoFallback(false);
              }}
            />
          </div>
          <Link
            to={topTypePath}
            className="text-xs inline-flex items-center gap-1"
            style={{ color: "var(--color-brand)" }}
          >
            investigate <ArrowRight size={12} />
          </Link>
        </div>
      </Card>

      {/* Headline KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link to={investigatePath({ risk: "high", decision: "pending" })}>
          <BigNumber
            label="Open cases"
            value={k.open_cases}
            format={fmtNumber}
            delta={`${k.high_risk_24h} high-risk in ${windowCopy}`}
            deltaTone={k.open_cases > 0 ? "negative" : "neutral"}
            highlighted={k.open_cases > 100}
            accent={k.open_cases > 100 ? "var(--color-warning)" : undefined}
            sparkline={<TinyBars values={[k.low_risk_24h, k.medium_risk_24h, k.high_risk_24h]} />}
          />
        </Link>
        <Link to={investigatePath({ risk: "high" })}>
          <BigNumber
            label={`Blocked (${windowLabel})`}
            value={k.blocked_amount_24h}
            format={fmtCurrencyCompact}
            delta="review high-risk exposure"
            deltaTone="positive"
            accent="var(--color-success)"
            sparkline={<TinySparkline values={fraudRateSeries.map((point) => point.blocked_amount)} />}
          />
        </Link>
        <Link to="/queue">
          <BigNumber
            label={`Throughput (${windowLabel})`}
            value={k.txn_count_24h}
            format={fmtNumber}
            delta="open analyst queue"
            deltaTone="neutral"
            sparkline={<TinySparkline values={fraudRateSeries.map((point) => point.txn_count)} />}
          />
        </Link>
        <Link to={investigatePath({ min_score: 0.5 })}>
          <BigNumber
            label="Avg score"
            value={k.avg_score_24h}
            decimals={3}
            format={(n) => n.toFixed(3)}
            delta="inspect elevated scores"
            deltaTone="neutral"
            sparkline={<TinySparkline values={sparkline.data ?? []} />}
          />
        </Link>
      </div>

      {/* Risk mix */}
      <Card padding="sm">
        <div className="flex items-center justify-between gap-4 mb-2">
          <div>
            <div
              className="text-[10px] uppercase tracking-wider mb-1"
              style={{ color: "var(--color-fg-subtle)" }}
            >
              Risk mix · {windowCopy}
            </div>
            <div className="text-xs" style={{ color: "var(--color-fg-faint)" }}>
              {fmtPct(highRiskShare, 1)} high risk across {fmtNumber(totalRiskWindow)} scored transactions
            </div>
          </div>
          <div className="text-xs font-mono" style={{ color: "var(--color-fg-subtle)" }}>
            H {k.high_risk_24h} · M {k.medium_risk_24h} · L {k.low_risk_24h}
          </div>
        </div>
        <RiskMixBar
          high={k.high_risk_24h}
          medium={k.medium_risk_24h}
          low={k.low_risk_24h}
        />
        <div className="flex gap-3 mt-3 text-xs">
          <Link to={investigatePath({ risk: "high" })} style={{ color: "var(--color-risk-high)" }}>
            high risk
          </Link>
          <Link to={investigatePath({ risk: "medium" })} style={{ color: "var(--color-risk-medium)" }}>
            medium risk
          </Link>
          <Link to={investigatePath({ risk: "low" })} style={{ color: "var(--color-risk-low)" }}>
            low risk
          </Link>
        </div>
      </Card>

      <div className="grid grid-cols-12 gap-4">
        {/* Main column */}
        <div className="col-span-12 lg:col-span-8 space-y-4">
          {/* Geographic distribution */}
          <GeoMap />

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
            <ChartContainer height={200}>
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
            </ChartContainer>
            <div className="flex gap-3 mt-2 text-xs flex-wrap">
              {(types.data ?? []).slice(0, 5).map((item) => (
                <Link
                  key={item.type}
                  to={investigatePath({ txn_type: item.type })}
                  style={{ color: "var(--color-brand)" }}
                >
                  {item.type}
                </Link>
              ))}
            </div>
          </Card>

          {/* Time-series area chart */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div
                  className="text-[10px] uppercase tracking-wider mb-1"
                  style={{ color: "var(--color-fg-subtle)" }}
                >
                  Transaction volume · {windowCopy}
                </div>
                <div className="text-xs" style={{ color: "var(--color-fg-faint)" }}>
                  {ts.data?.length ?? 0} {rangeConfig.hours > 72 || rangeConfig.hours === 0 ? "daily" : "hourly"} buckets · auto-refresh every 10s
                </div>
              </div>
              <div className="flex gap-3 text-[10px] font-mono" style={{ color: "var(--color-fg-subtle)" }}>
                <span><span style={{ color: "var(--color-fg-faint)" }}>● </span>all txns</span>
                <span><span style={{ color: "var(--color-brand)" }}>● </span>flagged</span>
              </div>
            </div>
            <ChartContainer height={200}>
                <AreaChart data={fraudRateSeries}>
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
                  <YAxis yAxisId="left" stroke="var(--color-fg-faint)" fontSize={10} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="var(--color-info)"
                    fontSize={10}
                    tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      fontSize: 11,
                    }}
                    formatter={(value, name) => {
                      if (typeof value !== "number") return value;
                      if (name === "Fraud rate") return fmtPct(value, 1);
                      if (name === "Blocked amount") return fmtCurrencyCompact(value);
                      return fmtNumber(value);
                    }}
                  />
                  <Area
                    yAxisId="left" type="monotone" dataKey="txn_count"
                    stroke="var(--color-fg-subtle)" strokeWidth={1.5}
                    fill="url(#gAll)" name="All txns"
                  />
                  <Area
                    yAxisId="left" type="monotone" dataKey="fraud_count"
                    stroke="var(--color-brand)" strokeWidth={2}
                    fill="url(#gFraud)" name="Flagged"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="fraud_rate"
                    stroke="var(--color-info)"
                    strokeWidth={1.5}
                    dot={false}
                    name="Fraud rate"
                  />
                </AreaChart>
            </ChartContainer>
            <div className="mt-2 text-xs" style={{ color: "var(--color-fg-faint)" }}>
              Peak flagged bucket: {peakBucket.timestamp} · {peakBucket.fraud_count} flagged · {fmtCurrencyCompact(peakBucket.blocked_amount)} blocked
              <Link
                to={investigatePath({ risk: "high" })}
                className="ml-2"
                style={{ color: "var(--color-brand)" }}
              >
                review flagged
              </Link>
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
              <div className="flex rounded-md border overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
                {[
                  { value: "count", label: "count" },
                  { value: "fraud_rate", label: "fraud %" },
                ].map((option) => (
                  <button
                    key={option.value}
                    className="px-2 py-1 text-[10px] font-mono"
                    style={{
                      background: heatmapMode === option.value
                        ? "var(--color-brand-soft)"
                        : "var(--color-surface)",
                      color: heatmapMode === option.value
                        ? "var(--color-brand)"
                        : "var(--color-fg-subtle)",
                    }}
                    onClick={() => setHeatmapMode(option.value as HeatmapMode)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            {heatmap.data && <Heatmap data={heatmap.data} mode={heatmapMode} />}
          </Card>

        </div>

        {/* Right sidebar */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          <ReplayControl />
          <CasesWidget stats={cases.data?.stats} />
          <Card padding="md">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} style={{ color: "var(--color-fg-subtle)" }} />
              <span
                className="text-[10px] uppercase tracking-wider"
                style={{ color: "var(--color-fg-subtle)" }}
              >
                Action queue
              </span>
            </div>
            <div className="space-y-3">
              <ActionRow
                label="High-risk pending"
                value={fmtNumber(pendingHighRisk.data?.total ?? k.open_cases)}
                tone="var(--color-danger)"
              />
              <ActionRow
                label="Oldest visible case"
                value={oldestPending ? fmtRelativeTime(oldestPending.scored_at) : "none"}
                tone="var(--color-fg)"
              />
              <ActionRow
                label="Peak hour"
                value={`${peakBucket.timestamp} · ${peakBucket.fraud_count}`}
                tone="var(--color-info)"
              />
            </div>
            <Link
              to={investigatePath({ risk: "high", decision: "pending" })}
              className="mt-4 text-xs inline-flex items-center gap-1"
              style={{ color: "var(--color-brand)" }}
            >
              open investigation filters <ArrowRight size={12} />
            </Link>
          </Card>
          <LiveTicker />
          <RecentHighRiskCard recent={recent} />
        </div>
      </div>
    </div>
  );
}

function investigatePath(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  });
  const search = searchParams.toString();
  return search ? `/investigate?${search}` : "/investigate";
}

function RangeSelector({
  value,
  onChange,
}: {
  value: DashboardRange;
  onChange: (value: DashboardRange) => void;
}) {
  return (
    <div
      className="flex rounded-md border overflow-hidden"
      style={{ borderColor: "var(--color-border)" }}
    >
      {RANGE_OPTIONS.map((option) => (
        <button
          key={option.value}
          className="px-2 py-1 text-[10px] font-mono"
          style={{
            background: value === option.value
              ? "var(--color-brand-soft)"
              : "var(--color-surface)",
            color: value === option.value
              ? "var(--color-brand)"
              : "var(--color-fg-subtle)",
          }}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function RecentHighRiskCard({
  recent,
}: {
  recent: ReturnType<typeof useQueue>;
}) {
  return (
    <Card padding="none">
      <div
        className="px-3 py-2 border-b flex items-center justify-between"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div>
          <div className="text-sm font-medium">Recent high-risk</div>
          <div
            className="text-[10px] mt-0.5"
            style={{ color: "var(--color-fg-faint)" }}
          >
            top 5, score desc
          </div>
        </div>
        <Link
          to={investigatePath({ risk: "high" })}
          className="text-[10px] flex items-center gap-1"
          style={{ color: "var(--color-brand)" }}
        >
          investigate <ArrowRight size={12} />
        </Link>
      </div>

      {recent.isLoading ? (
        <div className="p-4 text-xs" style={{ color: "var(--color-fg-subtle)" }}>
          Loading…
        </div>
      ) : (recent.data?.items.length ?? 0) === 0 ? (
        <div className="p-4 text-xs" style={{ color: "var(--color-fg-subtle)" }}>
          No high-risk transactions yet.
        </div>
      ) : (
        <div>
          {recent.data!.items.map((item, index) => (
            <Link
              key={`${item.transaction_id}-${index}`}
              to={`/transactions/${item.transaction_id}`}
              className="grid grid-cols-[42px_54px_1fr_72px] gap-2 px-3 py-2 border-t items-center text-xs hover:bg-[var(--color-surface-elevated)] transition-colors"
              style={{ borderColor: "var(--color-border)" }}
            >
              <RiskBadge risk={item.risk_band} />
              <span className="font-mono font-medium">{fmtScore(item.score)}</span>
              <span
                className="font-mono truncate"
                style={{ color: "var(--color-fg-muted)" }}
              >
                {item.type}
              </span>
              <span className="font-mono text-right">
                {fmtCurrencyCompact(item.amount)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

function CasesWidget({
  stats,
}: {
  stats: { open: number; overdue: number; critical: number; unassigned: number } | undefined;
}) {
  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertCircle size={14} style={{ color: "var(--color-fg-subtle)" }} />
          <span
            className="text-[10px] uppercase tracking-wider"
            style={{ color: "var(--color-fg-subtle)" }}
          >
            Case load
          </span>
        </div>
        <Link to="/cases" className="text-xs" style={{ color: "var(--color-brand)" }}>
          view all
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <CaseMiniStat label="open" value={stats?.open ?? 0} color="var(--color-brand)" to="/cases" />
        <CaseMiniStat label="overdue" value={stats?.overdue ?? 0} color="var(--color-danger)" to="/cases?overdue=true" />
        <CaseMiniStat label="critical" value={stats?.critical ?? 0} color="var(--color-warning)" to="/cases?priority=critical" />
        <CaseMiniStat label="unassigned" value={stats?.unassigned ?? 0} color="var(--color-info)" to="/cases?assigned_to=unassigned" />
      </div>
    </Card>
  );
}

function CaseMiniStat({
  label,
  value,
  color,
  to,
}: {
  label: string;
  value: number;
  color: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-md border px-3 py-2"
      style={{ borderColor: "var(--color-border)", background: "var(--color-surface-elevated)" }}
    >
      <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-fg-faint)" }}>
        {label}
      </div>
      <div className="font-mono text-lg mt-1" style={{ color }}>
        {fmtNumber(value)}
      </div>
    </Link>
  );
}

function TinySparkline({ values }: { values: number[] }) {
  const width = 56;
  const height = 18;
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const points = values
    .slice(-20)
    .map((value, index, arr) => {
      const x = arr.length === 1 ? width : (index / (arr.length - 1)) * width;
      const y = height - ((value - min) / span) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} role="img" aria-label="trend">
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-brand)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TinyBars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const colors = [
    "var(--color-risk-low)",
    "var(--color-risk-medium)",
    "var(--color-risk-high)",
  ];
  return (
    <div className="flex items-end gap-0.5 h-[18px]" aria-label="risk mix bars">
      {values.map((value, index) => (
        <div
          key={index}
          className="w-1.5 rounded-sm"
          style={{
            height: `${Math.max(3, (value / max) * 18)}px`,
            background: colors[index],
          }}
        />
      ))}
    </div>
  );
}

function RiskMixBar({
  high,
  medium,
  low,
}: {
  high: number;
  medium: number;
  low: number;
}) {
  const total = high + medium + low || 1;
  return (
    <div className="h-3 rounded-sm overflow-hidden flex" style={{ background: "var(--color-surface)" }}>
      <div
        style={{
          width: `${(high / total) * 100}%`,
          background: "var(--color-risk-high)",
        }}
      />
      <div
        style={{
          width: `${(medium / total) * 100}%`,
          background: "var(--color-risk-medium)",
        }}
      />
      <div
        style={{
          width: `${(low / total) * 100}%`,
          background: "var(--color-risk-low)",
        }}
      />
    </div>
  );
}

function ActionRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs" style={{ color: "var(--color-fg-subtle)" }}>
        {label}
      </span>
      <span className="font-mono text-sm" style={{ color: tone }}>
        {value}
      </span>
    </div>
  );
}
