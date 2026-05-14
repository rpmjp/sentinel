import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  Search, ChevronLeft, ChevronRight, X, SlidersHorizontal,
  Download, CheckSquare, Square, AlertCircle,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { RiskBadge, DecisionBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Metric } from "@/components/ui/Metric";
import { EmptyState, SkeletonRows } from "@/components/ui/States";
import {
  useInvestigate, useBulkAction,
  type InvestigateParams, type InvestigateResponse,
} from "@/lib/hooks";
import { getToken } from "@/lib/api";
import {
  fmtCurrencyCompact, fmtRelativeTime, fmtScore, fmtNumber,
} from "@/lib/format";
import type { Decision, RiskBand } from "@/lib/types";
import { toast } from "@/lib/toast";

const TYPES = ["", "TRANSFER", "CASH_OUT", "CASH_IN", "PAYMENT", "DEBIT"] as const;

interface Preset {
  label: string;
  params: InvestigateParams;
}

const PRESETS: Preset[] = [
  { label: "high-risk pending", params: { risk: "high", decision: "pending" } },
  { label: "confirmed fraud", params: { decision: "confirmed_fraud" } },
  { label: "false positives", params: { decision: "false_positive" } },
  { label: "high-value (>$100K)", params: { min_amount: 100_000 } },
  { label: "all transfers", params: { txn_type: "TRANSFER" } },
];

export default function Investigate() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [params, setParams] = useState<InvestigateParams>(() =>
    paramsFromSearch(searchParams),
  );
  const [draftQ, setDraftQ] = useState(params.q ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkNotes, setBulkNotes] = useState("");

  const { data, isLoading } = useInvestigate(params);
  const bulk = useBulkAction();

  useEffect(() => {
    const next = paramsFromSearch(searchParams);
    setParams(next);
    setDraftQ(next.q ?? "");
    setSelected(new Set());
  }, [searchParams]);

  function update<K extends keyof InvestigateParams>(key: K, value: InvestigateParams[K] | undefined) {
    setParams((p) => {
      const next = { ...p, [key]: value, page: 1 };
      setSearchParams(searchFromParams(next));
      return next;
    });
    setSelected(new Set());
  }

  function clearFilters() {
    const next = { page: 1, page_size: 50 };
    setParams(next);
    setSearchParams(searchFromParams(next));
    setDraftQ("");
    setSelected(new Set());
  }

  function applyPreset(p: Preset) {
    const next = { ...p.params, page: 1, page_size: 50 };
    setParams(next);
    setSearchParams(searchFromParams(next));
    setDraftQ(p.params.q ?? "");
    setSelected(new Set());
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (!data) return;
    if (selected.size === data.items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.items.map((i) => i.transaction_id)));
    }
  }

  async function handleBulk(decision: Decision) {
    if (selected.size === 0) return;
    try {
      const result = await bulk.mutateAsync({
        transaction_ids: Array.from(selected),
        decision,
        notes: bulkNotes || undefined,
      });
      toast.success(
        `Updated ${result.updated} transaction${result.updated === 1 ? "" : "s"}: ${decision.replace("_", " ")}`,
      );
      setSelected(new Set());
      setBulkNotes("");
    } catch {
      toast.error("Bulk action failed. Please retry.");
    }
  }

  async function downloadCsv() {
    try {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== "" && k !== "page" && k !== "page_size") {
          qs.set(k, String(v));
        }
      });
      const resp = await fetch(`/api/investigate/export.csv?${qs}`, {
        headers: { Authorization: `Bearer ${getToken() ?? ""}` },
      });
      if (!resp.ok) throw new Error("export failed");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sentinel_investigate_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exported");
    } catch {
      toast.error("CSV export failed");
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / (params.page_size ?? 50))) : 1;
  const activeFilterCount = useMemo(
    () =>
      [params.q, params.txn_type, params.risk, params.decision,
       params.min_amount, params.max_amount, params.min_score, params.max_score]
        .filter((v) => v !== undefined && v !== "").length,
    [params],
  );
  const activeFilters = filterChips(params);
  const returnTo = `${location.pathname}${location.search}`;

  return (
    <div className="p-6 space-y-4 max-w-6xl">
      {/* Stats strip */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Metric label="Results" value={fmtNumber(data.stats.total)} />
          <Metric label="Total amount" value={fmtCurrencyCompact(data.stats.total_amount)} />
          <Metric label="Confirmed fraud" value={fmtNumber(data.stats.confirmed_fraud)} deltaTone="negative" />
          <Metric label="False positives" value={fmtNumber(data.stats.false_positives)} deltaTone="positive" />
          <Metric label="Avg score" value={fmtScore(data.stats.avg_score)} />
        </div>
      )}

      {/* Quick presets */}
      <div className="flex gap-2 flex-wrap">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => applyPreset(p)}
            className="text-xs px-2.5 py-1 rounded-md transition-colors"
            style={{
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-fg-muted)",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {activeFilters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {activeFilters.map((filter) => (
            <button
              key={filter.key}
              onClick={() => update(filter.key, undefined)}
              className="px-2 py-1 rounded-md text-xs"
              style={{
                background: "var(--color-brand-soft)",
                color: "var(--color-brand)",
              }}
            >
              {filter.label} ×
            </button>
          ))}
          <button
            onClick={clearFilters}
            className="text-xs"
            style={{ color: "var(--color-fg-faint)" }}
          >
            clear all
          </button>
        </div>
      )}

      {/* Global search */}
      <Card padding="sm">
        <div className="flex items-center gap-2">
          <Search size={14} style={{ color: "var(--color-fg-subtle)" }} />
          <input
            type="text"
            placeholder="Search sender or receiver ID (e.g. C1666544)"
            value={draftQ}
            onChange={(e) => setDraftQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") update("q", draftQ || undefined);
              if (e.key === "Escape") { setDraftQ(""); update("q", undefined); }
            }}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "var(--color-fg)" }}
          />
          {(params.q || draftQ) && (
            <button onClick={() => { setDraftQ(""); update("q", undefined); }} style={{ color: "var(--color-fg-faint)" }}>
              <X size={14} />
            </button>
          )}
        </div>
      </Card>

      {/* Filter grid */}
      <Card padding="sm">
        <div className="flex items-center gap-2 mb-3">
          <SlidersHorizontal size={12} style={{ color: "var(--color-fg-subtle)" }} />
          <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-fg-subtle)" }}>
            Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
          </span>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="ml-auto text-xs" style={{ color: "var(--color-fg-faint)" }}>
              clear all
            </button>
          )}
          <Button variant="secondary" size="sm" onClick={downloadCsv} className="ml-auto">
            <Download size={12} /> export CSV
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <Select label="type" value={params.txn_type ?? ""}
            options={TYPES.map((t) => ({ v: t, l: t || "any" }))}
            onChange={(v) => update("txn_type", v || undefined)} />
          <Select label="risk" value={params.risk ?? ""}
            options={[{ v: "", l: "any" }, { v: "high", l: "high" }, { v: "medium", l: "medium" }, { v: "low", l: "low" }]}
            onChange={(v) => update("risk", (v || undefined) as RiskBand | undefined)} />
          <Select label="decision" value={params.decision ?? ""}
            options={[
              { v: "", l: "any" }, { v: "pending", l: "pending" },
              { v: "confirmed_fraud", l: "confirmed fraud" },
              { v: "false_positive", l: "false positive" },
              { v: "escalated", l: "escalated" },
            ]}
            onChange={(v) => update("decision", (v || undefined) as Decision | "pending" | undefined)} />
          <RangeInput label="score" min={params.min_score} max={params.max_score} step={0.01}
            onChange={(min, max) => { update("min_score", min); update("max_score", max); }} />
          <RangeInput label="amount $" min={params.min_amount} max={params.max_amount} step={1000}
            onChange={(min, max) => { update("min_amount", min); update("max_amount", max); }} />
        </div>
      </Card>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <Card padding="sm">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm">
              <strong className="font-mono">{selected.size}</strong> selected
            </span>
            <input
              type="text"
              placeholder="Bulk notes (optional)…"
              value={bulkNotes}
              onChange={(e) => setBulkNotes(e.target.value)}
              className="flex-1 min-w-[200px] px-3 py-1.5 rounded-md text-sm outline-none"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-fg)" }}
            />
            <Button variant="danger" size="sm" loading={bulk.isPending} onClick={() => handleBulk("confirmed_fraud")}>
              <AlertCircle size={12} /> confirm fraud
            </Button>
            <Button variant="secondary" size="sm" loading={bulk.isPending} onClick={() => handleBulk("false_positive")}>
              false positive
            </Button>
            <Button variant="ghost" size="sm" loading={bulk.isPending} onClick={() => handleBulk("escalated")}>
              escalate
            </Button>
            <button onClick={() => setSelected(new Set())} style={{ color: "var(--color-fg-faint)" }}>
              <X size={14} />
            </button>
          </div>
        </Card>
      )}

      {/* Results */}
      <Results
        data={data}
        isLoading={isLoading}
        selected={selected}
        onToggle={toggleSelect}
        onToggleAll={toggleSelectAll}
        returnTo={returnTo}
      />

      {/* Pagination */}
      {data && data.total > (params.page_size ?? 50) && (
        <div className="flex items-center justify-between">
          <div className="text-xs" style={{ color: "var(--color-fg-subtle)" }}>
            page {params.page} of {totalPages} · {data.total.toLocaleString()} results
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={(params.page ?? 1) <= 1}
              onClick={() => setParams((p) => {
                const next = { ...p, page: Math.max(1, (p.page ?? 1) - 1) };
                setSearchParams(searchFromParams(next));
                return next;
              })}>
              <ChevronLeft size={12} /> prev
            </Button>
            <Button variant="secondary" size="sm" disabled={(params.page ?? 1) >= totalPages}
              onClick={() => setParams((p) => {
                const next = { ...p, page: (p.page ?? 1) + 1 };
                setSearchParams(searchFromParams(next));
                return next;
              })}>
              next <ChevronRight size={12} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function paramsFromSearch(searchParams: URLSearchParams): InvestigateParams {
  return {
    q: stringParam(searchParams, "q"),
    txn_type: stringParam(searchParams, "txn_type"),
    risk: stringParam(searchParams, "risk"),
    decision: stringParam(searchParams, "decision"),
    min_amount: numberParam(searchParams, "min_amount"),
    max_amount: numberParam(searchParams, "max_amount"),
    min_score: numberParam(searchParams, "min_score"),
    max_score: numberParam(searchParams, "max_score"),
    page: numberParam(searchParams, "page") ?? 1,
    page_size: numberParam(searchParams, "page_size") ?? 50,
  };
}

function stringParam(searchParams: URLSearchParams, key: string) {
  return searchParams.get(key) || undefined;
}

function numberParam(searchParams: URLSearchParams, key: string) {
  const value = searchParams.get(key);
  if (!value) return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function searchFromParams(params: InvestigateParams) {
  const next = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      next.set(key, String(value));
    }
  });
  return next;
}

function Results({
  data, isLoading, selected, onToggle, onToggleAll, returnTo,
}: {
  data: InvestigateResponse | undefined;
  isLoading: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  returnTo: string;
}) {
  const allSelected = !!data && data.items.length > 0 && selected.size === data.items.length;
  return (
    <Card padding="none">
      <div
        className="grid grid-cols-[32px_60px_70px_1fr_110px_110px_100px] gap-3 px-4 py-2.5 border-b text-[10px] uppercase tracking-wider"
        style={{ background: "var(--color-surface)", color: "var(--color-fg-subtle)", borderColor: "var(--color-border)" }}
      >
        <button onClick={onToggleAll} aria-label="select all">
          {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
        </button>
        <div>Risk</div>
        <div>Score</div>
        <div>Transaction</div>
        <div className="text-right">Amount</div>
        <div>Status</div>
        <div className="text-right">Scored</div>
      </div>

      {isLoading ? (
        <SkeletonRows
          rows={8}
          columns="32px 60px 70px 1fr 110px 110px 100px"
        />
      ) : data?.items.length === 0 ? (
        <EmptyState
          title="No matching transactions"
          description="Clear filters or try one of the investigation presets."
        />
      ) : (
        data!.items.map((item) => {
          const isSel = selected.has(item.transaction_id);
          return (
            <div
              key={item.transaction_id}
              className="grid grid-cols-[32px_60px_70px_1fr_110px_110px_100px] gap-3 px-4 py-3 border-t items-center text-sm transition-colors hover:bg-[var(--color-surface-elevated)]"
              style={{ borderColor: "var(--color-border)" }}
            >
              <button
                onClick={(e) => { e.preventDefault(); onToggle(item.transaction_id); }}
                aria-label="select"
                style={{ color: isSel ? "var(--color-brand)" : "var(--color-fg-faint)" }}
              >
                {isSel ? <CheckSquare size={14} /> : <Square size={14} />}
              </button>
              <Link
                to={`/transactions/${item.transaction_id}`}
                state={{ returnTo, returnLabel: "investigation results" }}
                className="contents"
              >
                <RiskBadge risk={item.risk_band} />
                <span className="font-mono font-medium">{fmtScore(item.score)}</span>
                <span className="font-mono text-xs truncate" style={{ color: "var(--color-fg-muted)" }}>
                  <Link
                    to={`/entities/${encodeURIComponent(item.name_orig)}`}
                    onClick={(event) => event.stopPropagation()}
                    style={{ color: "var(--color-brand)" }}
                  >
                    {item.name_orig}
                  </Link>
                  {" → "}
                  <Link
                    to={`/entities/${encodeURIComponent(item.name_dest)}`}
                    onClick={(event) => event.stopPropagation()}
                    style={{ color: "var(--color-brand)" }}
                  >
                    {item.name_dest}
                  </Link>
                  <span style={{ color: "var(--color-fg-faint)" }}>{" · "}{item.type}</span>
                </span>
                <span className="font-mono text-right">{fmtCurrencyCompact(item.amount)}</span>
                <span><DecisionBadge decision={item.decision as Decision | null} /></span>
                <span className="text-xs text-right" style={{ color: "var(--color-fg-faint)" }}>
                  {fmtRelativeTime(item.scored_at)}
                </span>
              </Link>
            </div>
          );
        })
      )}
    </Card>
  );
}

function filterChips(params: InvestigateParams): Array<{
  key: keyof InvestigateParams;
  label: string;
}> {
  const chips: Array<{ key: keyof InvestigateParams; label: string }> = [];
  if (params.q) chips.push({ key: "q", label: `search: ${params.q}` });
  if (params.txn_type) chips.push({ key: "txn_type", label: `type: ${params.txn_type}` });
  if (params.risk) chips.push({ key: "risk", label: `risk: ${params.risk}` });
  if (params.decision) chips.push({ key: "decision", label: `decision: ${params.decision}` });
  if (params.min_amount !== undefined) chips.push({ key: "min_amount", label: `min $${params.min_amount}` });
  if (params.max_amount !== undefined) chips.push({ key: "max_amount", label: `max $${params.max_amount}` });
  if (params.min_score !== undefined) chips.push({ key: "min_score", label: `min score ${params.min_score}` });
  if (params.max_score !== undefined) chips.push({ key: "max_score", label: `max score ${params.max_score}` });
  return chips;
}

function Select({ label, value, options, onChange }: {
  label: string; value: string;
  options: { v: string; l: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-fg-faint)" }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="px-2 py-1.5 rounded text-xs outline-none"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-fg)" }}>
        {options.map(({ v, l }) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function RangeInput({ label, min, max, step = 1, onChange }: {
  label: string;
  min: number | undefined;
  max: number | undefined;
  step?: number;
  onChange: (min: number | undefined, max: number | undefined) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-fg-faint)" }}>{label}</span>
      <div className="flex gap-1">
        <input type="number" placeholder="min" step={step} value={min ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value), max)}
          className="w-full px-2 py-1.5 rounded text-xs outline-none font-mono"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-fg)" }} />
        <input type="number" placeholder="max" step={step} value={max ?? ""}
          onChange={(e) => onChange(min, e.target.value === "" ? undefined : Number(e.target.value))}
          className="w-full px-2 py-1.5 rounded text-xs outline-none font-mono"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-fg)" }} />
      </div>
    </div>
  );
}
