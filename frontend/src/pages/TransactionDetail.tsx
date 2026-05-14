import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { RiskBadge, DecisionBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ShapWaterfall } from "@/components/ShapWaterfall";
import {
  useSimilarTransactions,
  useSubmitFeedback,
  useTransaction,
} from "@/lib/hooks";
import {
  fmtCurrency,
  fmtCurrencyCompact,
  fmtRelativeTime,
  fmtScore,
} from "@/lib/format";
import type { Decision } from "@/lib/types";
import { toast } from "@/lib/toast";

export default function TransactionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useTransaction(id);
  const similar = useSimilarTransactions(id);
  const feedback = useSubmitFeedback(id);
  const [notes, setNotes] = useState("");

  if (isLoading) {
    return (
      <div className="p-6 text-sm" style={{ color: "var(--color-fg-subtle)" }}>
        Loading transaction…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <Card>
          <div
            className="flex items-center gap-2 text-sm"
            style={{ color: "var(--color-danger)" }}
          >
            <AlertTriangle size={14} />
            Transaction not found.
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => navigate("/queue")}
          >
            <ArrowLeft size={12} /> back to queue
          </Button>
        </Card>
      </div>
    );
  }

  const isDecided = !!data.decision;
  const features = data.explanation?.top_features ?? [];

  async function handleDecision(decision: Decision) {
    try {
      await feedback.mutateAsync({ decision, notes: notes || undefined });
      toast.success(`Decision recorded: ${decision.replace("_", " ")}`);
    } catch {
      toast.error("Failed to record decision. Please retry.");
    }
  }

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link
            to="/queue"
            className="text-xs flex items-center gap-1 mb-2"
            style={{ color: "var(--color-fg-subtle)" }}
          >
            <ArrowLeft size={12} /> back to queue
          </Link>
          <div className="flex items-center gap-3">
            <RiskBadge risk={data.risk_band} />
            <span className="font-mono text-2xl font-medium">
              {fmtScore(data.score)}
            </span>
            <span
              className="text-xs"
              style={{ color: "var(--color-fg-faint)" }}
            >
              threshold {data.threshold_at_scoring} · scored{" "}
              {fmtRelativeTime(data.scored_at)} · {data.latency_ms.toFixed(1)}ms
            </span>
          </div>
          <div className="font-mono text-xs" style={{ color: "var(--color-fg-faint)" }}>
            {data.transaction_id}
          </div>
        </div>

        <DecisionBadge decision={data.decision} />
      </div>

      {/* Action bar */}
      {!isDecided && (
        <Card padding="sm">
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="text"
              placeholder="Add notes (optional)…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="flex-1 min-w-[200px] px-3 py-1.5 rounded-md text-sm outline-none"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                color: "var(--color-fg)",
              }}
            />
            <Button
              variant="danger"
              size="sm"
              loading={feedback.isPending}
              onClick={() => handleDecision("confirmed_fraud")}
            >
              <XCircle size={12} /> confirm fraud
            </Button>
            <Button
              variant="secondary"
              size="sm"
              loading={feedback.isPending}
              onClick={() => handleDecision("false_positive")}
            >
              <CheckCircle2 size={12} /> false positive
            </Button>
            <Button
              variant="ghost"
              size="sm"
              loading={feedback.isPending}
              onClick={() => handleDecision("escalated")}
            >
              <ArrowRight size={12} /> escalate
            </Button>
          </div>
        </Card>
      )}

      {isDecided && (
        <Card padding="sm">
          <div
            className="flex items-start gap-3 text-sm"
            style={{ color: "var(--color-fg-muted)" }}
          >
            <CheckCircle2 size={14} style={{ color: "var(--color-success)" }} />
            <div>
              <div>
                Decision recorded:{" "}
                <DecisionBadge decision={data.decision} />
              </div>
              {data.decision_notes && (
                <div
                  className="text-xs mt-1"
                  style={{ color: "var(--color-fg-subtle)" }}
                >
                  "{data.decision_notes}"
                </div>
              )}
              <div
                className="text-xs mt-1"
                style={{ color: "var(--color-fg-faint)" }}
              >
                {data.decided_at && fmtRelativeTime(data.decided_at)}
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {/* SHAP — wide */}
        <Card className="md:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div
                className="text-[10px] uppercase tracking-wider mb-1"
                style={{ color: "var(--color-fg-subtle)" }}
              >
                Why was this flagged?
              </div>
              <div className="text-xs" style={{ color: "var(--color-fg-faint)" }}>
                Top {features.length} SHAP contributors
              </div>
            </div>
          </div>
          <ShapWaterfall features={features} />
        </Card>

        {/* Transaction context */}
        <Card>
          <div
            className="text-[10px] uppercase tracking-wider mb-3"
            style={{ color: "var(--color-fg-subtle)" }}
          >
            Transaction
          </div>
          <dl className="space-y-2 text-xs">
            <Row label="Type">
              <span className="font-mono">{data.type}</span>
            </Row>
            <Row label="Amount">
              <span className="font-mono font-medium">
                {fmtCurrency(data.amount)}
              </span>
            </Row>
            <Row label="Step">
              <span className="font-mono">{data.step}</span>
            </Row>
            <Row label="Received">
              <span style={{ color: "var(--color-fg-muted)" }}>
                {fmtRelativeTime(data.received_at)}
              </span>
            </Row>
          </dl>

          <div
            className="my-3 border-t"
            style={{ borderColor: "var(--color-border)" }}
          />

          <div
            className="text-[10px] uppercase tracking-wider mb-2"
            style={{ color: "var(--color-fg-subtle)" }}
          >
            Sender
          </div>
          <dl className="space-y-2 text-xs">
            <Row label="ID">
              <span className="font-mono">{data.name_orig}</span>
            </Row>
            <Row label="Balance before">
              <span className="font-mono">
                {fmtCurrencyCompact(data.old_balance_org)}
              </span>
            </Row>
          </dl>

          <div
            className="my-3 border-t"
            style={{ borderColor: "var(--color-border)" }}
          />

          <div
            className="text-[10px] uppercase tracking-wider mb-2"
            style={{ color: "var(--color-fg-subtle)" }}
          >
            Receiver
          </div>
          <dl className="space-y-2 text-xs">
            <Row label="ID">
              <span className="font-mono">{data.name_dest}</span>
            </Row>
            <Row label="Balance before">
              <span className="font-mono">
                {fmtCurrencyCompact(data.old_balance_dest)}
              </span>
            </Row>
          </dl>
        </Card>
      </div>

      <Card padding="none">
        <div
          className="px-4 py-2.5 border-b text-[10px] uppercase tracking-wider"
          style={{
            color: "var(--color-fg-subtle)",
            borderColor: "var(--color-border)",
          }}
        >
          Similar transactions
        </div>

        {similar.isLoading ? (
          <div
            className="px-4 py-6 text-sm"
            style={{ color: "var(--color-fg-subtle)" }}
          >
            Loading similar transactions…
          </div>
        ) : similar.data?.length === 0 ? (
          <div
            className="px-4 py-6 text-sm"
            style={{ color: "var(--color-fg-subtle)" }}
          >
            No similar transactions found.
          </div>
        ) : (
          similar.data?.map((item) => (
            <Link
              key={item.transaction_id}
              to={`/transactions/${item.transaction_id}`}
              className="grid grid-cols-[60px_70px_1fr_110px_110px] gap-3 px-4 py-3 border-t items-center text-sm hover:bg-[var(--color-surface-elevated)]"
              style={{ borderColor: "var(--color-border)" }}
            >
              <RiskBadge risk={item.risk_band} />
              <span className="font-mono font-medium">
                {fmtScore(item.score)}
              </span>
              <span
                className="font-mono text-xs truncate"
                style={{ color: "var(--color-fg-muted)" }}
              >
                {item.name_orig} → {item.name_dest}
                <span style={{ color: "var(--color-fg-faint)" }}>
                  {" · "}
                  {item.type}
                </span>
              </span>
              <span className="font-mono text-right">
                {fmtCurrencyCompact(item.amount)}
              </span>
              <span>
                <DecisionBadge decision={item.decision as Decision | null} />
              </span>
            </Link>
          ))
        )}
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt style={{ color: "var(--color-fg-faint)" }}>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
