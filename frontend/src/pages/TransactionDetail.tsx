import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  Briefcase,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { RiskBadge, DecisionBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, SkeletonRows } from "@/components/ui/States";
import { ShapWaterfall } from "@/components/ShapWaterfall";
import { CreateCaseDialog } from "@/components/CreateCaseDialog";
import {
  useSimilarTransactions,
  useAddWatchlistEntry,
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
  const location = useLocation();
  const { data, isLoading, error } = useTransaction(id);
  const similar = useSimilarTransactions(id);
  const feedback = useSubmitFeedback(id);
  const addWatchlist = useAddWatchlistEntry();
  const [notes, setNotes] = useState("");
  const [caseDialogOpen, setCaseDialogOpen] = useState(false);
  const returnState = location.state as
    | { returnTo?: string; returnLabel?: string }
    | null;
  const returnTo = returnState?.returnTo ?? "/queue";
  const returnLabel = returnState?.returnLabel ?? "queue";

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Card padding="none">
          <SkeletonRows rows={4} columns="1fr 90px 120px" />
        </Card>
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
            onClick={() => navigate(returnTo)}
          >
            <ArrowLeft size={12} /> back to {returnLabel}
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

  async function blockSender() {
    const transaction = data;
    if (!transaction) return;
    try {
      await addWatchlist.mutateAsync({
        account_id: transaction.name_orig,
        list_type: "blocked",
        reason: `Blocked from transaction ${transaction.transaction_id}`,
      });
      toast.success(`${transaction.name_orig} added to blocklist`);
    } catch {
      toast.error("Could not add sender to blocklist");
    }
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link
            to={returnTo}
            className="text-xs flex items-center gap-1 mb-2"
            style={{ color: "var(--color-fg-subtle)" }}
          >
            <ArrowLeft size={12} /> back to {returnLabel}
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

      <div className="flex gap-2 flex-wrap">
        <Link
          to={`/entities/${encodeURIComponent(data.name_orig)}`}
          className="text-xs px-2 py-1 rounded-md"
          style={{
            background: "var(--color-surface-elevated)",
            border: "1px solid var(--color-border)",
            color: "var(--color-brand)",
          }}
        >
          sender profile
        </Link>
        <Link
          to={`/entities/${encodeURIComponent(data.name_dest)}`}
          className="text-xs px-2 py-1 rounded-md"
          style={{
            background: "var(--color-surface-elevated)",
            border: "1px solid var(--color-border)",
            color: "var(--color-brand)",
          }}
        >
          receiver profile
        </Link>
        <Button
          variant="danger"
          size="sm"
          loading={addWatchlist.isPending}
          onClick={blockSender}
        >
          <Ban size={12} /> block sender
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setCaseDialogOpen(true)}
        >
          <Briefcase size={12} /> create case
        </Button>
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

      <Card padding="sm">
        <div
          className="text-[10px] uppercase tracking-wider mb-3"
          style={{ color: "var(--color-fg-subtle)" }}
        >
          Audit trail
        </div>
        <div className="grid md:grid-cols-4 gap-2">
          <AuditStep label="received" value={fmtRelativeTime(data.received_at)} done />
          <AuditStep label="scored" value={fmtRelativeTime(data.scored_at)} done />
          <AuditStep label="queued" value={data.risk_band} done />
          <AuditStep
            label="decision"
            value={data.decided_at ? fmtRelativeTime(data.decided_at) : "pending"}
            done={!!data.decided_at}
          />
        </div>
      </Card>

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
              <Link
                to={`/entities/${encodeURIComponent(data.name_orig)}`}
                className="font-mono"
                style={{ color: "var(--color-brand)" }}
              >
                {data.name_orig}
              </Link>
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
              <Link
                to={`/entities/${encodeURIComponent(data.name_dest)}`}
                className="font-mono"
                style={{ color: "var(--color-brand)" }}
              >
                {data.name_dest}
              </Link>
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
          <SkeletonRows rows={4} columns="60px 70px 1fr 110px 110px" />
        ) : similar.data?.length === 0 ? (
          <EmptyState
            title="No similar transactions"
            description="This transaction has no nearby matches by type, amount, and risk band."
          />
        ) : (
          similar.data?.map((item, index) => (
            <Link
              key={`${item.transaction_id}-${index}`}
              to={`/transactions/${item.transaction_id}`}
              state={{ returnTo, returnLabel }}
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

      <CreateCaseDialog
        open={caseDialogOpen}
        onOpenChange={setCaseDialogOpen}
        initialTitle={`Review ${data.name_orig} transfer`}
        initialDescription={`Created from high-risk transaction ${data.transaction_id}.`}
        initialTransactionIds={[data.transaction_id]}
        initialEntityIds={[data.name_orig, data.name_dest]}
      />
    </div>
  );
}

function AuditStep({
  label,
  value,
  done,
}: {
  label: string;
  value: string;
  done: boolean;
}) {
  return (
    <div
      className="rounded-md border px-3 py-2"
      style={{
        background: "var(--color-surface)",
        borderColor: done ? "var(--color-border-strong)" : "var(--color-border)",
      }}
    >
      <div
        className="text-[10px] uppercase tracking-wider"
        style={{ color: "var(--color-fg-faint)" }}
      >
        {label}
      </div>
      <div
        className="text-xs font-mono mt-1"
        style={{ color: done ? "var(--color-fg)" : "var(--color-fg-subtle)" }}
      >
        {value}
      </div>
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
