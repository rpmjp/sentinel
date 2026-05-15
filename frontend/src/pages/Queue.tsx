import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { RiskBadge, DecisionBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, SkeletonRows } from "@/components/ui/States";
import { useQueue } from "@/lib/hooks";
import { fmtCurrencyCompact, fmtRelativeTime, fmtScore } from "@/lib/format";
import type { RiskBand } from "@/lib/types";
import { cn } from "@/lib/cn";

type RiskFilter = "all" | RiskBand;
type DecidedFilter = "all" | "pending" | "decided";

export default function Queue() {
  const navigate = useNavigate();
  const [risk, setRisk] = useState<RiskFilter>("all");
  const [decided, setDecided] = useState<DecidedFilter>("all");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const params: { risk?: string; decided?: boolean; page: number; page_size: number } = {
    page,
    page_size: pageSize,
  };
  if (risk !== "all") params.risk = risk;
  if (decided === "pending") params.decided = false;
  if (decided === "decided") params.decided = true;

  const { data, isLoading } = useQueue(params);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;
  const activeFilters = [
    risk !== "all" ? { label: `risk: ${risk}`, clear: () => setRisk("all") } : null,
    decided !== "all" ? { label: `status: ${decided}`, clear: () => setDecided("all") } : null,
  ].filter((item): item is { label: string; clear: () => void } => item !== null);

  function clearFilters() {
    setRisk("all");
    setDecided("all");
    setPage(1);
  }

  return (
    <div className="p-6 space-y-4">
      {/* Filter bar */}
      <Card padding="sm">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter size={12} style={{ color: "var(--color-fg-subtle)" }} />
            <span
              className="text-xs uppercase tracking-wider"
              style={{ color: "var(--color-fg-subtle)" }}
            >
              Filter
            </span>
          </div>

          <FilterGroup<RiskFilter>
            label="risk"
            value={risk}
            options={[
              { v: "all", l: "all" },
              { v: "high", l: "high" },
              { v: "medium", l: "medium" },
              { v: "low", l: "low" },
            ]}
            onChange={(v) => {
              setRisk(v);
              setPage(1);
            }}
          />

          <FilterGroup<DecidedFilter>
            label="status"
            value={decided}
            options={[
              { v: "all", l: "all" },
              { v: "pending", l: "pending" },
              { v: "decided", l: "decided" },
            ]}
            onChange={(v) => {
              setDecided(v);
              setPage(1);
            }}
          />

          <div
            className="ml-auto text-xs font-mono"
            style={{ color: "var(--color-fg-faint)" }}
          >
            {data ? `${data.total.toLocaleString()} results` : "—"}
          </div>
        </div>
        {activeFilters.length > 0 && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {activeFilters.map((filter) => (
              <button
                key={filter.label}
                onClick={() => {
                  filter.clear();
                  setPage(1);
                }}
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
      </Card>

      {/* Table */}
      <Card padding="none">
        <div
          className="grid min-w-[720px] grid-cols-[60px_70px_1fr_110px_110px_100px] gap-3 px-4 py-2.5 border-b text-[10px] uppercase tracking-wider"
          style={{
            background: "var(--color-surface)",
            color: "var(--color-fg-subtle)",
            borderColor: "var(--color-border)",
          }}
        >
          <div>Risk</div>
          <div>Score</div>
          <div>Transaction</div>
          <div className="text-right">Amount</div>
          <div>Status</div>
          <div className="text-right">Age</div>
        </div>

        {isLoading ? (
          <SkeletonRows rows={8} />
        ) : data?.items.length === 0 ? (
          <EmptyState
            title="No queue matches"
            description="Try clearing filters or start the replay to generate fresh activity."
            action={
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                clear filters
              </Button>
            }
          />
        ) : (
          data!.items.map((item, index) => (
            <div
              key={`${item.transaction_id}-${index}`}
              role="link"
              tabIndex={0}
              onClick={() =>
                navigate(`/transactions/${item.transaction_id}`, {
                  state: { returnTo: "/queue", returnLabel: "queue" },
                })
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  navigate(`/transactions/${item.transaction_id}`, {
                    state: { returnTo: "/queue", returnLabel: "queue" },
                  });
                }
              }}
              className="grid min-w-[720px] grid-cols-[60px_70px_1fr_110px_110px_100px] gap-3 px-4 py-3 border-t items-center text-sm transition-colors hover:bg-[var(--color-surface-elevated)]"
              style={{ borderColor: "var(--color-border)" }}
            >
              <RiskBadge risk={item.risk_band} />
              <span className="font-mono font-medium">{fmtScore(item.score)}</span>
              <span
                className="font-mono text-xs truncate"
                style={{ color: "var(--color-fg-muted)" }}
              >
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
                <span style={{ color: "var(--color-fg-faint)" }}>
                  {" · "}
                  {item.type}
                </span>
              </span>
              <span className="font-mono text-right">
                {fmtCurrencyCompact(item.amount)}
              </span>
              <span>
                <DecisionBadge decision={item.decision} />
              </span>
              <span
                className="text-xs text-right"
                style={{ color: "var(--color-fg-faint)" }}
                >
                  {fmtRelativeTime(item.scored_at)}
                </span>
            </div>
          ))
        )}
      </Card>

      {/* Pagination */}
      {data && data.total > pageSize && (
        <div className="flex items-center justify-between">
          <div
            className="text-xs"
            style={{ color: "var(--color-fg-subtle)" }}
          >
            page {page} of {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={12} /> prev
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              next <ChevronRight size={12} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface FilterGroupProps<T extends string> {
  label: string;
  value: T;
  options: { v: T; l: string }[];
  onChange: (v: T) => void;
}

function FilterGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: FilterGroupProps<T>) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="text-xs"
        style={{ color: "var(--color-fg-faint)" }}
      >
        {label}:
      </span>
      <div
        className="flex gap-0.5 p-0.5 rounded-md"
        style={{ background: "var(--color-surface)" }}
      >
        {options.map(({ v, l }) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={cn(
              "px-2 py-0.5 rounded text-xs transition-colors",
              v === value && "active-filter",
            )}
            style={
              v === value
                ? {
                    background: "var(--color-surface-elevated)",
                    color: "var(--color-fg)",
                  }
                : { color: "var(--color-fg-subtle)" }
            }
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}
