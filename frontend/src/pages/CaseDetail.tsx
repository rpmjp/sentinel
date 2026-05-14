import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RiskBadge, DecisionBadge } from "@/components/ui/Badge";
import { EmptyState, SkeletonRows } from "@/components/ui/States";
import { CaseStatusBadge, PriorityBadge } from "@/pages/Cases";
import {
  useAddCaseNote,
  useCase,
  useLinkCaseEntities,
  useLinkCaseTransactions,
  useUnlinkCaseEntity,
  useUnlinkCaseTransaction,
  useUpdateCase,
  type CasePriority,
  type CaseStatus,
} from "@/lib/hooks";
import { fmtCurrencyCompact, fmtRelativeTime, fmtScore } from "@/lib/format";
import type { Decision } from "@/lib/types";
import { toast } from "@/lib/toast";

const STATUSES: CaseStatus[] = ["open", "investigating", "waiting", "escalated", "closed"];
const PRIORITIES: CasePriority[] = ["critical", "high", "medium", "low"];

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useCase(id);
  const updateCase = useUpdateCase(id);
  const addNote = useAddCaseNote(id);
  const linkTransactions = useLinkCaseTransactions(id);
  const unlinkTransaction = useUnlinkCaseTransaction(id);
  const linkEntities = useLinkCaseEntities(id);
  const unlinkEntity = useUnlinkCaseEntity(id);
  const [note, setNote] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [entityId, setEntityId] = useState("");
  const [titleDraft, setTitleDraft] = useState("");
  const [outcomeDraft, setOutcomeDraft] = useState("");

  useEffect(() => {
    if (data) {
      setTitleDraft(data.title);
      setOutcomeDraft(data.outcome ?? "");
    }
  }, [data]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Card padding="none">
          <SkeletonRows rows={6} columns="1fr 120px 120px" />
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <Card>
          <EmptyState title="Case not found" description="This case may have been closed or removed." />
          <Button variant="secondary" size="sm" className="mt-4" onClick={() => navigate("/cases")}>
            <ArrowLeft size={12} /> back to cases
          </Button>
        </Card>
      </div>
    );
  }

  async function updateField(payload: Parameters<typeof updateCase.mutateAsync>[0]) {
    try {
      await updateCase.mutateAsync(payload);
      toast.success("Case updated");
    } catch {
      toast.error("Could not update case");
    }
  }

  async function submitNote() {
    if (!note.trim()) return;
    try {
      await addNote.mutateAsync(note.trim());
      setNote("");
      toast.success("Note added");
    } catch {
      toast.error("Could not add note");
    }
  }

  async function submitTransactionLink() {
    if (!transactionId.trim()) return;
    try {
      await linkTransactions.mutateAsync([transactionId.trim()]);
      setTransactionId("");
      toast.success("Transaction linked");
    } catch {
      toast.error("Could not link transaction");
    }
  }

  async function submitEntityLink() {
    if (!entityId.trim()) return;
    try {
      await linkEntities.mutateAsync([entityId.trim()]);
      setEntityId("");
      toast.success("Entity linked");
    } catch {
      toast.error("Could not link entity");
    }
  }

  async function removeTransaction(transactionIdToRemove: string) {
    try {
      await unlinkTransaction.mutateAsync(transactionIdToRemove);
      toast.info("Transaction removed from case");
    } catch {
      toast.error("Could not remove transaction");
    }
  }

  async function removeEntity(accountId: string) {
    try {
      await unlinkEntity.mutateAsync(accountId);
      toast.info("Entity removed from case");
    } catch {
      toast.error("Could not remove entity");
    }
  }

  return (
    <div className="p-6 space-y-4">
      <Link
        to="/cases"
        className="text-xs inline-flex items-center gap-1"
        style={{ color: "var(--color-fg-subtle)" }}
      >
        <ArrowLeft size={12} /> back to cases
      </Link>

      <Card padding="md">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--color-fg-subtle)" }}>
              CASE-{data.id.slice(0, 8).toUpperCase()}
            </div>
            <input
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              onBlur={() => {
                if (titleDraft.trim() && titleDraft.trim() !== data.title) {
                  updateField({ title: titleDraft.trim() });
                }
              }}
              className="bg-transparent outline-none text-2xl font-medium w-full"
              style={{ color: "var(--color-fg)" }}
            />
            <div className="text-xs mt-1" style={{ color: "var(--color-fg-faint)" }}>
              created {fmtRelativeTime(data.created_at)} · updated {fmtRelativeTime(data.updated_at)}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <CaseStatusBadge status={data.status} />
            <PriorityBadge priority={data.priority} />
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-3 mt-4 text-xs">
          <Select
            label="status"
            value={data.status}
            options={STATUSES}
            onChange={(value) => updateField({ status: value as CaseStatus })}
          />
          <Select
            label="priority"
            value={data.priority}
            options={PRIORITIES}
            onChange={(value) => updateField({ priority: value as CasePriority })}
          />
          <Field
            label="SLA due"
            value={data.sla_due_at ? fmtRelativeTime(data.sla_due_at) : "none"}
          />
          <Field
            label="assignee"
            value={data.assigned_to ? data.assigned_to.slice(0, 8) : "unassigned"}
          />
        </div>
      </Card>

      <div className="grid lg:grid-cols-[1fr_360px] gap-4">
        <div className="space-y-4">
          <Card padding="none">
            <div
              className="px-4 py-3 border-b flex items-center justify-between gap-3"
              style={{ borderColor: "var(--color-border)" }}
            >
              <div>
                <div className="text-sm font-medium">Linked transactions</div>
                <div className="text-xs" style={{ color: "var(--color-fg-faint)" }}>
                  evidence gathered under this case
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  value={transactionId}
                  onChange={(event) => setTransactionId(event.target.value)}
                  placeholder="transaction id"
                  className="px-2 py-1 rounded text-xs outline-none font-mono w-48"
                  style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-fg)" }}
                />
                <Button size="sm" loading={linkTransactions.isPending} onClick={submitTransactionLink}>
                  <Plus size={12} /> link
                </Button>
              </div>
            </div>
            {data.transactions.length === 0 ? (
              <EmptyState title="No linked transactions" description="Link transactions from the detail page or by ID here." />
            ) : (
              data.transactions.map((item, index) => (
                <div
                  key={`${item.transaction_id}-${index}`}
                  className="grid grid-cols-[65px_70px_1fr_100px_100px_28px] gap-3 px-4 py-3 border-t items-center text-sm"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <RiskBadge risk={item.risk_band} />
                  <span className="font-mono">{fmtScore(item.score)}</span>
                  <Link
                    to={`/transactions/${item.transaction_id}`}
                    state={{ returnTo: `/cases/${data.id}`, returnLabel: "case" }}
                    className="font-mono text-xs truncate"
                    style={{ color: "var(--color-brand)" }}
                  >
                    {item.name_orig}{" -> "}{item.name_dest}
                    <span style={{ color: "var(--color-fg-faint)" }}> · {item.type}</span>
                  </Link>
                  <span className="font-mono text-right">{fmtCurrencyCompact(item.amount)}</span>
                  <DecisionBadge decision={item.decision as Decision | null} />
                  <button
                    onClick={() => removeTransaction(item.transaction_id)}
                    style={{ color: "var(--color-fg-faint)" }}
                    aria-label="remove transaction"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </Card>

          <Card padding="none">
            <div
              className="px-4 py-3 border-b flex items-center justify-between gap-3"
              style={{ borderColor: "var(--color-border)" }}
            >
              <div>
                <div className="text-sm font-medium">Linked entities</div>
                <div className="text-xs" style={{ color: "var(--color-fg-faint)" }}>
                  accounts, counterparties, or related parties
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  value={entityId}
                  onChange={(event) => setEntityId(event.target.value)}
                  placeholder="account id"
                  className="px-2 py-1 rounded text-xs outline-none font-mono w-40"
                  style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-fg)" }}
                />
                <Button size="sm" loading={linkEntities.isPending} onClick={submitEntityLink}>
                  <Plus size={12} /> link
                </Button>
              </div>
            </div>
            {data.entities.length === 0 ? (
              <EmptyState title="No linked entities" description="Create a case from an entity profile or link account IDs here." />
            ) : (
              data.entities.map((item) => (
                <div
                  key={item.account_id}
                  className="grid grid-cols-[1fr_100px_110px_28px] gap-3 px-4 py-3 border-t items-center text-sm"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <Link
                    to={`/entities/${encodeURIComponent(item.account_id)}`}
                    className="font-mono"
                    style={{ color: "var(--color-brand)" }}
                  >
                    {item.account_id}
                  </Link>
                  <span className="text-xs" style={{ color: "var(--color-fg-subtle)" }}>{item.role}</span>
                  <span className="text-xs text-right" style={{ color: "var(--color-fg-faint)" }}>
                    {fmtRelativeTime(item.added_at)}
                  </span>
                  <button
                    onClick={() => removeEntity(item.account_id)}
                    style={{ color: "var(--color-fg-faint)" }}
                    aria-label="remove entity"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <div className="text-[10px] uppercase tracking-wider mb-3" style={{ color: "var(--color-fg-subtle)" }}>
              Outcome
            </div>
            <textarea
              value={outcomeDraft}
              onChange={(event) => setOutcomeDraft(event.target.value)}
              onBlur={() => {
                if (outcomeDraft !== (data.outcome ?? "")) {
                  updateField({ outcome: outcomeDraft || null });
                }
              }}
              placeholder="Close-out summary, SAR decision, or analyst outcome"
              rows={4}
              className="w-full px-3 py-2 rounded-md text-sm outline-none resize-none"
              style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-fg)" }}
            />
          </Card>

          <Card padding="none">
            <div className="px-4 py-3 border-b" style={{ borderColor: "var(--color-border)" }}>
              <div className="text-sm font-medium">Notes</div>
              <div className="text-xs" style={{ color: "var(--color-fg-faint)" }}>
                analyst timeline
              </div>
            </div>
            <div className="p-3 border-b space-y-2" style={{ borderColor: "var(--color-border)" }}>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Add an investigation note..."
                rows={3}
                className="w-full px-3 py-2 rounded-md text-sm outline-none resize-none"
                style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-fg)" }}
              />
              <Button size="sm" loading={addNote.isPending} disabled={!note.trim()} onClick={submitNote}>
                add note
              </Button>
            </div>
            {data.notes.length === 0 ? (
              <EmptyState title="No notes yet" description="Capture the reasoning behind the investigation here." />
            ) : (
              data.notes.map((item) => (
                <div key={item.id} className="px-4 py-3 border-t text-sm" style={{ borderColor: "var(--color-border)" }}>
                  <div style={{ color: "var(--color-fg-muted)" }}>{item.content}</div>
                  <div className="text-[10px] font-mono mt-2" style={{ color: "var(--color-fg-faint)" }}>
                    {item.user_id.slice(0, 8)} · {fmtRelativeTime(item.created_at)}
                  </div>
                </div>
              ))
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-fg-faint)" }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="px-2 py-1.5 rounded text-xs outline-none"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          color: "var(--color-fg)",
        }}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-fg-faint)" }}>
        {label}
      </span>
      <span className="px-2 py-1.5 rounded text-xs font-mono" style={{ color: "var(--color-fg-muted)" }}>
        {value}
      </span>
    </div>
  );
}
