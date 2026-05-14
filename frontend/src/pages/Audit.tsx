import { AlertCircle, CheckCircle2, FileWarning } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState, SkeletonRows } from "@/components/ui/States";
import { useUploadAudits, type UploadAudit } from "@/lib/hooks";
import { fmtNumber } from "@/lib/format";

export default function Audit() {
  const audits = useUploadAudits();
  const items = audits.data ?? [];
  const rejected = items.filter((item) => item.status === "rejected").length;
  const failed = items.filter((item) => item.status === "failed").length;
  const successful = items.filter((item) => item.status === "success").length;

  return (
    <div className="p-6 space-y-4">
      <Card padding="md">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--color-fg-subtle)" }}>
              Audit log
            </div>
            <div className="text-sm font-medium">Upload and security events</div>
            <div className="text-xs mt-1" style={{ color: "var(--color-fg-faint)" }}>
              Tracks batch imports, rejected uploads, validation failures, and scored transaction counts.
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs min-w-[280px]">
            <AuditStat label="success" value={successful} tone="var(--color-success)" />
            <AuditStat label="failed" value={failed} tone="var(--color-warning)" />
            <AuditStat label="rejected" value={rejected} tone="var(--color-danger)" />
          </div>
        </div>
      </Card>

      <Card padding="none">
        <div
          className="grid grid-cols-[1fr_100px_100px_110px_140px] gap-3 px-4 py-2.5 border-b text-[10px] uppercase tracking-wider"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-fg-subtle)" }}
        >
          <div>Event</div>
          <div>Status</div>
          <div>Rows</div>
          <div>Risk</div>
          <div className="text-right">When</div>
        </div>

        {audits.isLoading ? (
          <SkeletonRows rows={8} columns="1fr 100px 100px 110px 140px" />
        ) : audits.isError ? (
          <EmptyState
            title="Audit log unavailable"
            description="The audit API returned an error. Run the upload audit migration, then refresh this page."
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="No audit events yet"
            description="Upload a CSV batch or run the upload audit migration to populate this operational log."
          />
        ) : (
          items.map((item) => <AuditRow key={item.id} item={item} />)
        )}
      </Card>
    </div>
  );
}

function AuditRow({ item }: { item: UploadAudit }) {
  const Icon = item.status === "success"
    ? CheckCircle2
    : item.status === "failed"
    ? FileWarning
    : AlertCircle;
  const color = item.status === "success"
    ? "var(--color-success)"
    : item.status === "failed"
    ? "var(--color-warning)"
    : "var(--color-danger)";

  return (
    <div
      className="grid grid-cols-[1fr_100px_100px_110px_140px] gap-3 px-4 py-3 border-t items-center text-sm"
      style={{ borderColor: "var(--color-border)" }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={14} style={{ color }} />
          <span className="font-medium truncate">{item.filename}</span>
        </div>
        <div className="text-xs mt-0.5 truncate" style={{ color: "var(--color-fg-faint)" }}>
          {item.error_message ?? `${fmtBytes(item.file_size_bytes)} uploaded`}
        </div>
      </div>
      <span className="font-mono text-xs" style={{ color }}>{item.status}</span>
      <span className="font-mono text-xs" style={{ color: "var(--color-fg-muted)" }}>
        {fmtNumber(item.rows_scored)}
      </span>
      <span className="font-mono text-xs" style={{ color: "var(--color-risk-high)" }}>
        {fmtNumber(item.high)} high
      </span>
      <span className="font-mono text-xs text-right" style={{ color: "var(--color-fg-faint)" }}>
        {new Date(item.created_at).toLocaleString()}
      </span>
    </div>
  );
}

function AuditStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-md border px-3 py-2" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
      <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-fg-faint)" }}>{label}</div>
      <div className="font-mono text-lg mt-1" style={{ color: tone }}>{fmtNumber(value)}</div>
    </div>
  );
}

function fmtBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}
