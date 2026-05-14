import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Briefcase, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useCreateCase, type CasePriority } from "@/lib/hooks";
import { toast } from "@/lib/toast";

interface CreateCaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTitle?: string;
  initialDescription?: string;
  initialTransactionIds?: string[];
  initialEntityIds?: string[];
}

const SLA_PRESETS = [
  { label: "24h", hours: 24 },
  { label: "48h", hours: 48 },
  { label: "7d", hours: 24 * 7 },
  { label: "none", hours: null },
] as const;

export function CreateCaseDialog({
  open,
  onOpenChange,
  initialTitle = "",
  initialDescription = "",
  initialTransactionIds = [],
  initialEntityIds = [],
}: CreateCaseDialogProps) {
  const navigate = useNavigate();
  const create = useCreateCase();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [priority, setPriority] = useState<CasePriority>("high");
  const [slaHours, setSlaHours] = useState<number | null>(24);

  const linkedSummary = useMemo(() => {
    const parts = [];
    if (initialTransactionIds.length) {
      parts.push(`${initialTransactionIds.length} transaction${initialTransactionIds.length === 1 ? "" : "s"}`);
    }
    if (initialEntityIds.length) {
      parts.push(`${initialEntityIds.length} entit${initialEntityIds.length === 1 ? "y" : "ies"}`);
    }
    return parts.join(" + ");
  }, [initialEntityIds.length, initialTransactionIds.length]);

  if (!open) return null;

  async function handleCreate() {
    if (!title.trim()) return;
    try {
      const slaDueAt =
        slaHours === null
          ? null
          : new Date(Date.now() + slaHours * 60 * 60 * 1000).toISOString();
      const result = await create.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        sla_due_at: slaDueAt,
        transaction_ids: initialTransactionIds,
        entity_ids: initialEntityIds,
      });
      toast.success("Case created");
      onOpenChange(false);
      navigate(`/cases/${result.id}`);
    } catch {
      toast.error("Could not create case");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onMouseDown={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-lg rounded-lg border shadow-2xl"
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--color-border-strong)",
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div
          className="px-4 py-3 border-b flex items-center justify-between"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div className="flex items-center gap-2">
            <Briefcase size={15} style={{ color: "var(--color-brand)" }} />
            <div>
              <div className="text-sm font-medium">Create case</div>
              {linkedSummary && (
                <div className="text-xs" style={{ color: "var(--color-fg-faint)" }}>
                  will link {linkedSummary}
                </div>
              )}
            </div>
          </div>
          <button onClick={() => onOpenChange(false)} style={{ color: "var(--color-fg-faint)" }}>
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-fg-faint)" }}>
              Title
            </span>
            <input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Suspicious transfer cluster"
              className="mt-1 w-full px-3 py-2 rounded-md text-sm outline-none"
              style={{
                background: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                color: "var(--color-fg)",
              }}
            />
          </label>

          <label className="block">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-fg-faint)" }}>
              Description
            </span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Why this case needs review"
              rows={3}
              className="mt-1 w-full px-3 py-2 rounded-md text-sm outline-none resize-none"
              style={{
                background: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                color: "var(--color-fg)",
              }}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-fg-faint)" }}>
                Priority
              </span>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as CasePriority)}
                className="mt-1 w-full px-3 py-2 rounded-md text-sm outline-none"
                style={{
                  background: "var(--color-bg)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-fg)",
                }}
              >
                <option value="critical">critical</option>
                <option value="high">high</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
              </select>
            </label>

            <div>
              <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-fg-faint)" }}>
                SLA
              </span>
              <div className="mt-1 grid grid-cols-4 gap-1">
                {SLA_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setSlaHours(preset.hours)}
                    className="px-2 py-2 rounded-md text-xs"
                    style={{
                      background: slaHours === preset.hours
                        ? "var(--color-brand-soft)"
                        : "var(--color-bg)",
                      color: slaHours === preset.hours
                        ? "var(--color-brand)"
                        : "var(--color-fg-subtle)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div
          className="px-4 py-3 border-t flex justify-end gap-2"
          style={{ borderColor: "var(--color-border)" }}
        >
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            cancel
          </Button>
          <Button size="sm" loading={create.isPending} disabled={!title.trim()} onClick={handleCreate}>
            create case
          </Button>
        </div>
      </div>
    </div>
  );
}
