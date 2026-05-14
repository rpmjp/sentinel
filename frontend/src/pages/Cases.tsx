import { Link, useSearchParams } from "react-router-dom";
import { AlertCircle, Briefcase, Clock, UserX } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Metric } from "@/components/ui/Metric";
import { EmptyState, SkeletonRows } from "@/components/ui/States";
import { useCases, type CasePriority, type CaseStatus } from "@/lib/hooks";
import { fmtNumber, fmtRelativeTime } from "@/lib/format";

const STATUSES = ["", "open", "investigating", "waiting", "escalated", "closed"] as const;
const PRIORITIES = ["", "critical", "high", "medium", "low"] as const;

export default function Cases() {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = {
    status: searchParams.get("status") || undefined,
    priority: searchParams.get("priority") || undefined,
    assigned_to: searchParams.get("assigned_to") || undefined,
    overdue: searchParams.get("overdue") === "true" ? true : undefined,
  };
  const { data, isLoading, error } = useCases(params);

  function update(key: string, value: string | boolean | undefined) {
    const next = new URLSearchParams(searchParams);
    if (value === undefined || value === "") {
      next.delete(key);
    } else {
      next.set(key, String(value));
    }
    setSearchParams(next);
  }

  return (
    <div className="p-6 space-y-4">
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric label="Open cases" value={fmtNumber(data.stats.open)} />
          <Metric label="Overdue" value={fmtNumber(data.stats.overdue)} deltaTone="negative" />
          <Metric label="Critical" value={fmtNumber(data.stats.critical)} deltaTone="negative" />
          <Metric label="Unassigned" value={fmtNumber(data.stats.unassigned)} />
        </div>
      )}

      <Card padding="sm">
        <div className="grid md:grid-cols-[160px_150px_150px_auto] gap-2 text-xs">
          <Select
            label="status"
            value={params.status ?? ""}
            options={STATUSES.map((status) => ({ value: status, label: status || "any status" }))}
            onChange={(value) => update("status", value)}
          />
          <Select
            label="priority"
            value={params.priority ?? ""}
            options={PRIORITIES.map((priority) => ({ value: priority, label: priority || "any priority" }))}
            onChange={(value) => update("priority", value)}
          />
          <Select
            label="owner"
            value={params.assigned_to ?? ""}
            options={[
              { value: "", label: "any owner" },
              { value: "unassigned", label: "unassigned" },
            ]}
            onChange={(value) => update("assigned_to", value)}
          />
          <label className="flex items-end gap-2 pb-1.5">
            <input
              type="checkbox"
              checked={params.overdue === true}
              onChange={(event) => update("overdue", event.target.checked ? true : undefined)}
              className="accent-[var(--color-brand)]"
            />
            <span style={{ color: "var(--color-fg-subtle)" }}>SLA overdue only</span>
          </label>
        </div>
      </Card>

      <Card padding="none">
        <div
          className="grid grid-cols-[1fr_120px_100px_90px_90px_120px] gap-3 px-4 py-2.5 border-b text-[10px] uppercase tracking-wider"
          style={{
            background: "var(--color-surface)",
            borderColor: "var(--color-border)",
            color: "var(--color-fg-subtle)",
          }}
        >
          <div>Case</div>
          <div>Status</div>
          <div>Priority</div>
          <div>Links</div>
          <div>Notes</div>
          <div className="text-right">SLA</div>
        </div>

        {isLoading ? (
          <SkeletonRows rows={7} columns="1fr 120px 100px 90px 90px 120px" />
        ) : error ? (
          <EmptyState
            title="Could not load cases"
            description="The cases API returned an error. Run the case migration, then refresh this page."
          />
        ) : data?.items.length === 0 ? (
          <EmptyState
            title="No cases found"
            description="Cases are created from suspicious transactions, entity profiles, or selected investigation rows."
            action={
              <div className="flex justify-center gap-3 text-xs">
                <Link to="/investigate?risk=high" style={{ color: "var(--color-brand)" }}>
                  find high-risk rows
                </Link>
                <Link to="/queue" style={{ color: "var(--color-brand)" }}>
                  open queue
                </Link>
              </div>
            }
          />
        ) : (
          data?.items.map((item) => (
            <Link
              key={item.id}
              to={`/cases/${item.id}`}
              className="grid grid-cols-[1fr_120px_100px_90px_90px_120px] gap-3 px-4 py-3 border-t items-center text-sm hover:bg-[var(--color-surface-elevated)]"
              style={{ borderColor: "var(--color-border)" }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Briefcase size={13} style={{ color: "var(--color-brand)" }} />
                  <span className="font-medium truncate">{item.title}</span>
                </div>
                <div className="text-xs font-mono mt-0.5" style={{ color: "var(--color-fg-faint)" }}>
                  CASE-{item.id.slice(0, 8).toUpperCase()} · updated {fmtRelativeTime(item.updated_at)}
                </div>
              </div>
              <CaseStatusBadge status={item.status} />
              <PriorityBadge priority={item.priority} />
              <span className="font-mono text-xs" style={{ color: "var(--color-fg-muted)" }}>
                {item.transaction_count} tx · {item.entity_count} ent
              </span>
              <span className="font-mono text-xs" style={{ color: "var(--color-fg-muted)" }}>
                {item.note_count}
              </span>
              <span className="text-xs text-right" style={{ color: slaColor(item.sla_due_at, item.status) }}>
                {item.sla_due_at ? fmtRelativeTime(item.sla_due_at) : "none"}
              </span>
            </Link>
          ))
        )}
      </Card>
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
  options: { value: string; label: string }[];
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
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const color = status === "closed"
    ? "var(--color-success)"
    : status === "escalated"
    ? "var(--color-danger)"
    : status === "waiting"
    ? "var(--color-warning)"
    : "var(--color-brand)";
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono"
      style={{ background: "var(--color-surface-elevated)", color, border: "1px solid var(--color-border)" }}
    >
      {status === "escalated" ? <AlertCircle size={10} /> : <Clock size={10} />}
      {status}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: CasePriority }) {
  const color = priority === "critical"
    ? "var(--color-danger)"
    : priority === "high"
    ? "var(--color-brand)"
    : priority === "medium"
    ? "var(--color-warning)"
    : "var(--color-fg-subtle)";
  return (
    <span className="font-mono text-xs" style={{ color }}>
      {priority === "critical" && <UserX size={11} className="inline mr-1" />}
      {priority}
    </span>
  );
}

function slaColor(slaDueAt: string | null, status: CaseStatus) {
  if (!slaDueAt || status === "closed") return "var(--color-fg-faint)";
  return new Date(slaDueAt).getTime() < Date.now()
    ? "var(--color-danger)"
    : "var(--color-fg-subtle)";
}
