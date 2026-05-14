import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { useToastStore, type ToastVariant } from "@/lib/toast";

const ICONS: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const COLORS: Record<ToastVariant, string> = {
  success: "var(--color-success)",
  error: "var(--color-danger)",
  info: "var(--color-fg-subtle)",
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => {
        const Icon = ICONS[t.variant];
        return (
          <div
            key={t.id}
            className="flex items-start gap-3 px-3 py-2.5 rounded-md text-sm shadow-lg pointer-events-auto min-w-[280px] max-w-[420px]"
            style={{
              background: "var(--color-surface-elevated)",
              border: `1px solid var(--color-border)`,
              borderLeft: `3px solid ${COLORS[t.variant]}`,
            }}
          >
            <Icon
              size={14}
              style={{ color: COLORS[t.variant], marginTop: 2 }}
            />
            <span className="flex-1" style={{ color: "var(--color-fg)" }}>
              {t.message}
            </span>
            <button
              onClick={() => dismiss(t.id)}
              style={{ color: "var(--color-fg-faint)" }}
              aria-label="dismiss"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}