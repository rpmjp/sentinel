import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { RiskBadge, DecisionBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useQueue } from "@/lib/hooks";
import { fmtCurrencyCompact, fmtRelativeTime, fmtScore } from "@/lib/format";
import type { RiskBand } from "@/lib/types";
import { cn } from "@/lib/cn";

type RiskFilter = "all" | RiskBand;
type DecidedFilter = "all" | "pending" | "decided";

export default function Queue() {
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

  return (
    <div className="p-6 space-y-4 max-w-6xl">
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
      </Card>

      {/* Table */}
      <Card padding="none">
        <div
          className="grid grid-cols-[60px_70px_1fr_110px_110px_100px] gap-3 px-4 py-2.5 border-b text-[10px] uppercase tracking-wider"
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
          <div
            className="px-4 py-6 text-sm"
            style={{ color: "var(--color-fg-subtle)" }}
          >
            Loading…
          </div>
        ) : data?.items.length === 0 ? (
          <div
            className="px-4 py-12 text-sm text-center"
            style={{ color: "var(--color-fg-subtle)" }}
          >
            No transactions match these filters.
          </div>
        ) : (
          data!.items.map((item) => (
            <Link
              key={item.transaction_id}
              to={`/transactions/${item.transaction_id}`}
              className="grid grid-cols-[60px_70px_1fr_110px_110px_100px] gap-3 px-4 py-3 border-t items-center text-sm transition-colors hover:bg-[var(--color-surface-elevated)]"
              style={{ borderColor: "var(--color-border)" }}
            >
              <RiskBadge risk={item.risk_band} />
              <span className="font-mono font-medium">{fmtScore(item.score)}</span>
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
                <DecisionBadge decision={item.decision} />
              </span>
              <span
                className="text-xs text-right"
                style={{ color: "var(--color-fg-faint)" }}
              >
                {fmtRelativeTime(item.scored_at)}
              </span>
            </Link>
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