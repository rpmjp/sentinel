import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { RiskBadge } from "@/components/ui/Badge";
import { useQueue } from "@/lib/hooks";
import { fmtCurrencyCompact, fmtRelativeTime, fmtScore } from "@/lib/format";

/**
 * Live transaction stream — polls /queue, highlights the most recently
 * arrived rows for a moment.
 */
export function LiveTicker() {
  const { data } = useQueue({ page: 1, page_size: 8 });
  const topId = data?.items[0]?.transaction_id;
  const [flashUntil, setFlashUntil] = useState<number>(0);
  const [flashedFor, setFlashedFor] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!topId || topId === flashedFor) return;
    setFlashedFor(topId);
    setFlashUntil(Date.now() + 1500);
  }, [topId, flashedFor]);

  const isFlashing = Date.now() < flashUntil;
  const recentIds = new Set(
    isFlashing ? (data?.items ?? []).slice(0, 3).map((i) => i.transaction_id) : [],
  );

  return (
    <Card padding="none">
      <div
        className="px-3 py-2 border-b flex items-center justify-between"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: "var(--color-success)" }}
          />
          <span
            className="text-[10px] uppercase tracking-wider"
            style={{ color: "var(--color-fg-subtle)" }}
          >
            Live stream
          </span>
        </div>
        <Link
          to="/queue"
          className="text-[10px]"
          style={{ color: "var(--color-brand)" }}
        >
          view all →
        </Link>
      </div>

      {!data || data.items.length === 0 ? (
        <div
          className="px-3 py-6 text-xs text-center"
          style={{ color: "var(--color-fg-subtle)" }}
        >
          No transactions yet. Start the live replay to see activity.
        </div>
      ) : (
        <div>
          {data.items.slice(0, 8).map((item, index) => {
            const isNew = recentIds.has(item.transaction_id);
            return (
              <Link
                key={`${item.transaction_id}-${index}`}
                to={`/transactions/${item.transaction_id}`}
                className="flex items-center gap-2 px-3 py-2 border-t text-xs transition-colors hover:bg-[var(--color-surface-elevated)]"
                style={{
                  borderColor: "var(--color-border)",
                  background: isNew ? "var(--color-brand-soft)" : "transparent",
                }}
              >
                <RiskBadge risk={item.risk_band} />
                <span className="font-mono font-medium w-10 shrink-0">
                  {fmtScore(item.score)}
                </span>
                <span
                  className="font-mono truncate flex-1"
                  style={{ color: "var(--color-fg-muted)" }}
                >
                  {fmtCurrencyCompact(item.amount)}
                </span>
                <span
                  className="text-[10px] shrink-0"
                  style={{ color: "var(--color-fg-faint)" }}
                >
                  {fmtRelativeTime(item.scored_at)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}
