import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight, Ban, Briefcase, ShieldCheck, Unlock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ChartContainer } from "@/components/ui/ChartContainer";
import { Metric } from "@/components/ui/Metric";
import { EmptyState, SkeletonRows } from "@/components/ui/States";
import { RiskBadge, DecisionBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CreateCaseDialog } from "@/components/CreateCaseDialog";
import {
  useAddWatchlistEntry,
  useEntityProfile,
  useRemoveWatchlistAccount,
  type EntityGraphEdge,
  type EntityGraphNode,
} from "@/lib/hooks";
import {
  fmtCurrencyCompact,
  fmtNumber,
  fmtRelativeTime,
  fmtScore,
} from "@/lib/format";
import { toast } from "@/lib/toast";

export default function EntityProfile() {
  const { accountId } = useParams<{ accountId: string }>();
  const { data, isLoading, error } = useEntityProfile(accountId);
  const addWatchlist = useAddWatchlistEntry();
  const removeWatchlist = useRemoveWatchlistAccount();
  const [caseDialogOpen, setCaseDialogOpen] = useState(false);

  async function addToWatchlist(listType: "blocked" | "trusted") {
    if (!accountId) return;
    try {
      await addWatchlist.mutateAsync({
        account_id: accountId,
        list_type: listType,
        reason: "Added from entity profile",
      });
      toast.success(`${accountId} added to ${listType}`);
    } catch {
      toast.error("Could not update watchlist");
    }
  }

  async function removeFromWatchlist(listType: "blocked" | "trusted") {
    if (!accountId) return;
    try {
      await removeWatchlist.mutateAsync({
        account_id: accountId,
        list_type: listType,
      });
      toast.info(`${accountId} removed from ${listType}`);
    } catch {
      toast.error("Could not update watchlist");
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Card padding="none">
          <SkeletonRows rows={5} columns="1fr 120px 120px" />
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <Card>
          <EmptyState
            title="Entity not found"
            description="No transactions are associated with this account ID."
          />
        </Card>
      </div>
    );
  }

  const { summary } = data;

  return (
    <div className="p-6 space-y-4">
      <Card padding="md">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div
              className="text-[10px] uppercase tracking-wider mb-1"
              style={{ color: "var(--color-fg-subtle)" }}
            >
              Entity profile
            </div>
            <div className="font-mono text-2xl font-medium">{summary.account_id}</div>
            <div className="text-xs mt-1" style={{ color: "var(--color-fg-faint)" }}>
              first seen {summary.first_seen ? fmtRelativeTime(summary.first_seen) : "unknown"} · last seen{" "}
              {summary.last_seen ? fmtRelativeTime(summary.last_seen) : "unknown"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {summary.watchlist && (
              <span
                className="px-2 py-1 rounded-md text-xs font-mono"
                style={{
                  background: summary.watchlist === "blocked"
                    ? "var(--color-danger-soft)"
                    : "var(--color-success-soft)",
                  color: summary.watchlist === "blocked"
                    ? "var(--color-danger)"
                    : "var(--color-success)",
                }}
              >
                {summary.watchlist}
              </span>
            )}
            {summary.watchlist === "blocked" ? (
              <Button
                variant="secondary"
                size="sm"
                loading={removeWatchlist.isPending}
                onClick={() => removeFromWatchlist("blocked")}
              >
                <Unlock size={12} /> unblock
              </Button>
            ) : (
              <Button
                variant="danger"
                size="sm"
                loading={addWatchlist.isPending}
                onClick={() => addToWatchlist("blocked")}
              >
                <Ban size={12} /> block
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              loading={addWatchlist.isPending}
              onClick={() => addToWatchlist("trusted")}
            >
              <ShieldCheck size={12} /> trust
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCaseDialogOpen(true)}
            >
              <Briefcase size={12} /> create case
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Metric label="Transactions" value={fmtNumber(summary.total_transactions)} />
        <Metric label="Total amount" value={fmtCurrencyCompact(summary.total_amount)} />
        <Metric label="Avg score" value={fmtScore(summary.avg_score)} />
        <Metric label="High risk" value={fmtNumber(summary.high_risk_count)} deltaTone="negative" />
        <Metric label="Confirmed fraud" value={fmtNumber(summary.confirmed_fraud_count)} deltaTone="negative" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <div
            className="text-[10px] uppercase tracking-wider mb-3"
            style={{ color: "var(--color-fg-subtle)" }}
          >
            Counterparty network
          </div>
          <NetworkGraph nodes={data.graph.nodes} edges={data.graph.edges} />
        </Card>

        <Card>
          <div
            className="text-[10px] uppercase tracking-wider mb-3"
            style={{ color: "var(--color-fg-subtle)" }}
          >
            Risk trend
          </div>
          <ChartContainer height={260}>
              <AreaChart data={data.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-grid)" />
                <XAxis dataKey="bucket" stroke="var(--color-fg-faint)" fontSize={10} />
                <YAxis stroke="var(--color-fg-faint)" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    fontSize: 11,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="avg_score"
                  stroke="var(--color-info)"
                  fill="var(--color-info-soft)"
                  name="Avg score"
                />
              </AreaChart>
          </ChartContainer>
        </Card>
      </div>

      <Card padding="none">
        <div
          className="px-4 py-3 border-b flex items-center justify-between"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div>
            <div className="text-sm font-medium">Transaction history</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--color-fg-faint)" }}>
              most recent activity involving this account
            </div>
          </div>
          <Link
            to={`/investigate?q=${encodeURIComponent(summary.account_id)}`}
            className="text-xs inline-flex items-center gap-1"
            style={{ color: "var(--color-brand)" }}
          >
            investigate <ArrowRight size={12} />
          </Link>
        </div>
        {data.transactions.map((item, index) => (
          <Link
            key={`${item.transaction_id}-${index}`}
            to={`/transactions/${item.transaction_id}`}
            state={{
              returnTo: `/entities/${encodeURIComponent(summary.account_id)}`,
              returnLabel: "entity profile",
            }}
            className="grid grid-cols-[70px_70px_1fr_110px_110px_100px] gap-3 px-4 py-3 border-t items-center text-sm hover:bg-[var(--color-surface-elevated)]"
            style={{ borderColor: "var(--color-border)" }}
          >
            <RiskBadge risk={item.risk_band} />
            <span className="font-mono">{fmtScore(item.score)}</span>
            <span className="font-mono text-xs truncate" style={{ color: "var(--color-fg-muted)" }}>
              {item.direction} · {item.counterparty} · {item.type}
            </span>
            <span className="font-mono text-right">{fmtCurrencyCompact(item.amount)}</span>
            <span><DecisionBadge decision={item.decision} /></span>
            <span className="text-xs text-right" style={{ color: "var(--color-fg-faint)" }}>
              {fmtRelativeTime(item.scored_at)}
            </span>
          </Link>
        ))}
      </Card>
      <CreateCaseDialog
        open={caseDialogOpen}
        onOpenChange={setCaseDialogOpen}
        initialTitle={`Entity review ${summary.account_id}`}
        initialDescription={`Created from entity profile for ${summary.account_id}.`}
        initialEntityIds={[summary.account_id]}
      />
    </div>
  );
}

function NetworkGraph({
  nodes,
  edges,
}: {
  nodes: EntityGraphNode[];
  edges: EntityGraphEdge[];
}) {
  const center = nodes[0];
  const outer = nodes.slice(1);
  const width = 520;
  const height = 260;
  const cx = width / 2;
  const cy = height / 2;
  const radius = 95;
  const positions = new Map<string, { x: number; y: number }>();
  if (center) positions.set(center.id, { x: cx, y: cy });
  outer.forEach((node, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(outer.length, 1) - Math.PI / 2;
    positions.set(node.id, {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    });
  });

  return (
    <div className="overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[260px]">
        {edges.map((edge) => {
          const source = positions.get(edge.source);
          const target = positions.get(edge.target);
          if (!source || !target) return null;
          return (
            <line
              key={`${edge.source}-${edge.target}`}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke="var(--color-border-strong)"
              strokeWidth={Math.min(6, 1 + edge.count)}
            />
          );
        })}
        {nodes.map((node) => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          const size = node.role === "entity" ? 16 : 9 + Math.min(9, node.risk_score * 10);
          return (
            <g key={node.id}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r={size}
                fill={
                  node.role === "entity"
                    ? "var(--color-brand)"
                    : node.risk_score >= 0.5
                    ? "var(--color-risk-high)"
                    : "var(--color-info)"
                }
                opacity={node.role === "entity" ? 1 : 0.78}
              />
              <text
                x={pos.x}
                y={pos.y + size + 12}
                textAnchor="middle"
                fontSize="10"
                fill="var(--color-fg-subtle)"
                fontFamily="monospace"
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
