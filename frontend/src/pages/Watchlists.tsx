import { useState } from "react";
import { Link } from "react-router-dom";
import { Ban, ShieldCheck, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState, SkeletonRows } from "@/components/ui/States";
import {
  useAddWatchlistEntry,
  useDeleteWatchlistEntry,
  useWatchlists,
} from "@/lib/hooks";
import { fmtRelativeTime } from "@/lib/format";
import { toast } from "@/lib/toast";

export default function Watchlists() {
  const { data, isLoading } = useWatchlists();
  const add = useAddWatchlistEntry();
  const remove = useDeleteWatchlistEntry();
  const [accountId, setAccountId] = useState("");
  const [listType, setListType] = useState<"blocked" | "trusted">("blocked");
  const [reason, setReason] = useState("");

  async function handleAdd() {
    if (!accountId.trim()) return;
    try {
      await add.mutateAsync({
        account_id: accountId.trim(),
        list_type: listType,
        reason: reason || undefined,
      });
      toast.success(`${accountId.trim()} added to ${listType}`);
      setAccountId("");
      setReason("");
    } catch {
      toast.error("Could not add watchlist entry");
    }
  }

  async function handleDelete(id: string) {
    try {
      await remove.mutateAsync(id);
      toast.info("Watchlist entry removed");
    } catch {
      toast.error("Could not remove entry");
    }
  }

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <Card padding="md">
        <div
          className="text-[10px] uppercase tracking-wider mb-3"
          style={{ color: "var(--color-fg-subtle)" }}
        >
          Add account
        </div>
        <div className="grid md:grid-cols-[1fr_130px_1fr_auto] gap-2">
          <input
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            placeholder="account ID"
            className="px-3 py-2 rounded-md text-sm outline-none"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-fg)",
            }}
          />
          <select
            value={listType}
            onChange={(event) => setListType(event.target.value as "blocked" | "trusted")}
            className="px-3 py-2 rounded-md text-sm outline-none"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-fg)",
            }}
          >
            <option value="blocked">blocked</option>
            <option value="trusted">trusted</option>
          </select>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="reason"
            className="px-3 py-2 rounded-md text-sm outline-none"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-fg)",
            }}
          />
          <Button size="md" loading={add.isPending} onClick={handleAdd}>
            add
          </Button>
        </div>
      </Card>

      <Card padding="none">
        <div
          className="grid grid-cols-[90px_1fr_1fr_120px_40px] gap-3 px-4 py-2.5 border-b text-[10px] uppercase tracking-wider"
          style={{
            background: "var(--color-surface)",
            color: "var(--color-fg-subtle)",
            borderColor: "var(--color-border)",
          }}
        >
          <div>List</div>
          <div>Account</div>
          <div>Reason</div>
          <div>Added</div>
          <div />
        </div>
        {isLoading ? (
          <SkeletonRows rows={5} columns="90px 1fr 1fr 120px 40px" />
        ) : data?.items.length === 0 ? (
          <EmptyState
            title="No watchlist entries"
            description="Add blocked or trusted accounts from here or from transaction/entity details."
          />
        ) : (
          data?.items.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[90px_1fr_1fr_120px_40px] gap-3 px-4 py-3 border-t items-center text-sm"
              style={{ borderColor: "var(--color-border)" }}
            >
              <span
                className="inline-flex items-center gap-1 text-xs"
                style={{
                  color: item.list_type === "blocked"
                    ? "var(--color-danger)"
                    : "var(--color-success)",
                }}
              >
                {item.list_type === "blocked" ? <Ban size={12} /> : <ShieldCheck size={12} />}
                {item.list_type}
              </span>
              <Link
                to={`/entities/${encodeURIComponent(item.account_id)}`}
                className="font-mono"
                style={{ color: "var(--color-brand)" }}
              >
                {item.account_id}
              </Link>
              <span className="text-xs truncate" style={{ color: "var(--color-fg-subtle)" }}>
                {item.reason ?? "—"}
              </span>
              <span className="text-xs" style={{ color: "var(--color-fg-faint)" }}>
                {fmtRelativeTime(item.created_at)}
              </span>
              <button
                onClick={() => handleDelete(item.id)}
                disabled={remove.isPending}
                style={{ color: "var(--color-fg-faint)" }}
                aria-label="remove"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
