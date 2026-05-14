import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { AxiosError } from "axios";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileUp,
  History,
  ListChecks,
  Lock,
  UploadCloud,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Metric } from "@/components/ui/Metric";
import { useAuth } from "@/lib/auth";
import {
  useUploadAudits,
  useUploadTransactions,
  type UploadAudit,
  type UploadTransactionsResult,
} from "@/lib/hooks";
import { fmtNumber } from "@/lib/format";
import { toast } from "@/lib/toast";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_UPLOAD_MB = MAX_UPLOAD_BYTES / (1024 * 1024);

const SAMPLE_CSV = [
  "step,type,amount,nameOrig,oldbalanceOrg,newbalanceOrig,nameDest,oldbalanceDest,newbalanceDest",
  "1,TRANSFER,250000.00,C1000001,250000.00,0.00,C2000001,0.00,250000.00",
  "1,CASH_OUT,78000.00,C1000002,78000.00,0.00,C2000002,12000.00,90000.00",
].join("\n");

interface UploadRowError {
  row: number;
  field: string;
  message: string;
}

interface UploadErrorResponse {
  detail?: string | {
    message?: string;
    errors?: UploadRowError[];
    missing?: string[];
  };
}

export default function Upload() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const upload = useUploadTransactions();
  const audits = useUploadAudits();
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<UploadTransactionsResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<UploadRowError[]>([]);
  const canUpload = user?.role === "senior_analyst" || user?.role === "admin";

  function selectFile(selected: File) {
    setErrorMessage(null);
    setRowErrors([]);
    if (!selected.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please choose a CSV file.");
      return false;
    }
    if (selected.size > MAX_UPLOAD_BYTES) {
      toast.error(`CSV is too large. Uploads are capped at ${MAX_UPLOAD_MB} MB.`);
      return false;
    }
    setFile(selected);
    return true;
  }

  async function handleUpload(selected = file) {
    if (!selected) return;
    if (!canUpload) {
      toast.error("Batch upload requires a senior analyst or admin account.");
      return;
    }
    try {
      setResult(null);
      setErrorMessage(null);
      setRowErrors([]);
      const summary = await upload.mutateAsync(selected);
      setResult(summary);
      toast.success(`Scored ${summary.scored} transactions`);
    } catch (error) {
      const parsed = parseUploadError(error);
      setErrorMessage(parsed.message);
      setRowErrors(parsed.errors);
      toast.error(parsed.message);
    }
  }

  function downloadSample() {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sentinel_sample_transactions.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 space-y-4">
      <Card padding="md">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div
              className="text-[10px] uppercase tracking-wider mb-1"
              style={{ color: "var(--color-fg-subtle)" }}
            >
              Batch upload
            </div>
            <div className="text-sm font-medium">Score transactions from CSV</div>
            <div className="text-xs mt-1" style={{ color: "var(--color-fg-faint)" }}>
              Senior analyst or admin only · max {MAX_UPLOAD_MB} MB / 10,000 rows · persists to Queue and Investigate
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={downloadSample}>
            <Download size={12} /> sample CSV
          </Button>
        </div>
      </Card>

      <div className="grid md:grid-cols-3 gap-3">
        <GuideStep
          icon={Download}
          step="1"
          title="Download the sample"
          description="Use the sample file as a template for the exact PaySim-style columns Sentinel expects."
          action={
            <button
              onClick={downloadSample}
              className="text-xs"
              style={{ color: "var(--color-brand)" }}
            >
              download sample
            </button>
          }
        />
        <GuideStep
          icon={FileSpreadsheet}
          step="2"
          title="Replace the rows"
          description="Keep the header row unchanged, then paste or export your own transaction rows underneath it."
        />
        <GuideStep
          icon={ListChecks}
          step="3"
          title="Upload and review"
          description="Sentinel validates every row, scores the batch, then sends results into Queue and Investigate."
        />
      </div>

      {!canUpload && (
        <Card padding="sm">
          <div className="flex items-start gap-3">
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
              style={{ background: "var(--color-warning-soft)", color: "var(--color-warning)" }}
            >
              <Lock size={15} />
            </div>
            <div>
              <div className="text-sm font-medium">Upload permission required</div>
              <div className="text-xs mt-1" style={{ color: "var(--color-fg-subtle)" }}>
                Your current role can download the sample and review the schema, but scoring a batch requires a senior analyst or admin account.
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-[1fr_360px] gap-4">
        <Card>
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const dropped = event.dataTransfer.files.item(0);
            if (!dropped) return;
            if (selectFile(dropped)) handleUpload(dropped);
          }}
          className="min-h-[240px] rounded-lg border border-dashed flex flex-col items-center justify-center gap-3 text-center cursor-pointer"
          style={{
            borderColor: "var(--color-border-strong)",
            background: "var(--color-surface)",
          }}
        >
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center"
            style={{ background: "var(--color-info-soft)", color: "var(--color-info)" }}
          >
            <UploadCloud size={24} />
          </div>
          <div>
            <div className="text-sm font-medium">
              {file ? file.name : "Drop CSV here or click to browse"}
            </div>
            <div className="text-xs mt-1" style={{ color: "var(--color-fg-faint)" }}>
              CSV only · {MAX_UPLOAD_MB} MB max · strict validation runs before scoring or saving.
            </div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (!selected) return;
              selectFile(selected);
            }}
          />
        </div>

        <div className="flex items-center justify-between mt-4 gap-3">
          <div className="text-xs" style={{ color: "var(--color-fg-subtle)" }}>
            {file ? `${file.name} · ${(file.size / 1024).toFixed(1)} KB` : "No file selected"}
          </div>
          <Button
            variant="primary"
            loading={upload.isPending}
            disabled={!file || !canUpload}
            onClick={() => handleUpload()}
          >
            <FileUp size={14} /> upload and score
          </Button>
        </div>
        </Card>

        <Card padding="md">
          <div
            className="text-[10px] uppercase tracking-wider mb-3"
            style={{ color: "var(--color-fg-subtle)" }}
          >
            Expected schema
          </div>
          <div className="space-y-2">
            {[
              "step",
              "type",
              "amount",
              "nameOrig",
              "oldbalanceOrg",
              "newbalanceOrig",
              "nameDest",
              "oldbalanceDest",
              "newbalanceDest",
            ].map((column) => (
              <div
                key={column}
                className="flex items-center gap-2 text-xs font-mono"
                style={{ color: "var(--color-fg-muted)" }}
              >
                <CheckCircle2 size={12} style={{ color: "var(--color-success)" }} />
                {column}
              </div>
            ))}
          </div>
          <div
            className="mt-4 rounded-md border p-3 text-xs"
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--color-border)",
              color: "var(--color-fg-subtle)",
            }}
          >
            Backend-style aliases like <span className="font-mono">name_orig</span>{" "}
            and <span className="font-mono">old_balance_org</span> are accepted too.
          </div>
        </Card>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Metric label="Uploaded" value={fmtNumber(result.uploaded)} />
            <Metric label="Scored" value={fmtNumber(result.scored)} />
            <Metric label="High risk" value={fmtNumber(result.high)} deltaTone="negative" />
            <Metric label="Medium" value={fmtNumber(result.medium)} />
            <Metric label="Low" value={fmtNumber(result.low)} deltaTone="positive" />
          </div>
          <Card padding="sm">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="text-sm">
                Batch complete in{" "}
                <span className="font-mono">{result.total_latency_ms.toFixed(0)}ms</span>
              </div>
              <div className="flex gap-3 text-xs">
                <Link
                  to="/queue"
                  className="inline-flex items-center gap-1"
                  style={{ color: "var(--color-brand)" }}
                >
                  view queue <ArrowRight size={12} />
                </Link>
                <Link
                  to="/investigate?risk=high"
                  className="inline-flex items-center gap-1"
                  style={{ color: "var(--color-brand)" }}
                >
                  review high-risk <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          </Card>
        </>
      )}

      {errorMessage && (
        <UploadErrorPanel message={errorMessage} errors={rowErrors} />
      )}

      <UploadHistoryCard audits={audits.data ?? []} loading={audits.isLoading} />
    </div>
  );
}

function parseUploadError(error: unknown): { message: string; errors: UploadRowError[] } {
  const axiosError = error as AxiosError<UploadErrorResponse>;
  const detail = axiosError.response?.data?.detail;
  if (typeof detail === "string") {
    return { message: detail, errors: [] };
  }
  if (detail && typeof detail === "object") {
    if (detail.errors?.length) {
      return {
        message: detail.message ?? "CSV validation failed",
        errors: detail.errors,
      };
    }
    if (detail.missing?.length) {
      return {
        message: `${detail.message ?? "CSV is missing required columns"}: ${detail.missing.join(", ")}`,
        errors: [],
      };
    }
    if (detail.message) {
      return { message: detail.message, errors: [] };
    }
  }
  if (axiosError.response?.status === 429) {
    return { message: "Upload rate limit exceeded. Please wait before trying again.", errors: [] };
  }
  return { message: "Upload failed. Check the CSV schema and try again.", errors: [] };
}

function UploadErrorPanel({
  message,
  errors,
}: {
  message: string;
  errors: UploadRowError[];
}) {
  return (
    <Card padding="md">
      <div className="flex items-start gap-3">
        <AlertCircle size={16} className="mt-0.5 shrink-0" style={{ color: "var(--color-danger)" }} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium" style={{ color: "var(--color-danger)" }}>
            {message}
          </div>
          {errors.length > 0 && (
            <div className="mt-3 rounded-md overflow-hidden border" style={{ borderColor: "var(--color-border)" }}>
              {errors.slice(0, 8).map((error, index) => (
                <div
                  key={`${error.row}-${error.field}-${index}`}
                  className="grid grid-cols-[70px_120px_1fr] gap-3 px-3 py-2 text-xs border-t first:border-t-0"
                  style={{ borderColor: "var(--color-border)", color: "var(--color-fg-subtle)" }}
                >
                  <span className="font-mono">row {error.row}</span>
                  <span className="font-mono truncate">{error.field}</span>
                  <span>{error.message}</span>
                </div>
              ))}
              {errors.length > 8 && (
                <div className="px-3 py-2 text-xs" style={{ color: "var(--color-fg-faint)" }}>
                  Showing 8 of {errors.length} row errors.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function UploadHistoryCard({
  audits,
  loading,
}: {
  audits: UploadAudit[];
  loading: boolean;
}) {
  return (
    <Card padding="none">
      <div
        className="px-4 py-3 border-b flex items-center justify-between"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="flex items-center gap-2">
          <History size={14} style={{ color: "var(--color-fg-subtle)" }} />
          <div>
            <div className="text-sm font-medium">Recent imports</div>
            <div className="text-[10px]" style={{ color: "var(--color-fg-faint)" }}>
              audit trail for completed and rejected uploads
            </div>
          </div>
        </div>
      </div>
      {loading ? (
        <div className="p-4 text-xs" style={{ color: "var(--color-fg-subtle)" }}>
          Loading imports…
        </div>
      ) : audits.length === 0 ? (
        <div className="p-4 text-xs" style={{ color: "var(--color-fg-subtle)" }}>
          No upload history yet.
        </div>
      ) : (
        <div>
          {audits.map((audit) => (
            <div
              key={audit.id}
              className="grid grid-cols-[1fr_90px_90px_100px] gap-3 px-4 py-3 border-t text-xs items-center"
              style={{ borderColor: "var(--color-border)" }}
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{audit.filename}</div>
                <div className="mt-0.5 truncate" style={{ color: "var(--color-fg-faint)" }}>
                  {audit.error_message ?? `${fmtBytes(audit.file_size_bytes)} · ${new Date(audit.created_at).toLocaleString()}`}
                </div>
              </div>
              <StatusPill status={audit.status} />
              <div className="font-mono" style={{ color: "var(--color-fg-subtle)" }}>
                {fmtNumber(audit.rows_scored)} rows
              </div>
              <div className="font-mono text-right" style={{ color: "var(--color-risk-high)" }}>
                {fmtNumber(audit.high)} high
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function StatusPill({ status }: { status: UploadAudit["status"] }) {
  const colors = {
    success: "var(--color-success)",
    failed: "var(--color-warning)",
    rejected: "var(--color-danger)",
  };
  return (
    <span
      className="inline-flex w-fit rounded-sm px-2 py-1 text-[10px] uppercase tracking-wider"
      style={{ color: colors[status], background: "var(--color-surface-raised)" }}
    >
      {status}
    </span>
  );
}

function fmtBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function GuideStep({
  icon: Icon,
  step,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  step: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card padding="md">
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
          style={{ background: "var(--color-info-soft)", color: "var(--color-info)" }}
        >
          <Icon size={16} />
        </div>
        <div>
          <div
            className="text-[10px] uppercase tracking-wider mb-1"
            style={{ color: "var(--color-fg-faint)" }}
          >
            Step {step}
          </div>
          <div className="text-sm font-medium">{title}</div>
          <div className="text-xs mt-1" style={{ color: "var(--color-fg-subtle)" }}>
            {description}
          </div>
          {action && <div className="mt-2">{action}</div>}
        </div>
      </div>
    </Card>
  );
}
