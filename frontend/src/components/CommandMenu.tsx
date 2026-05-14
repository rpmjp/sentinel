import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Cpu,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Search,
  Settings,
  Sliders,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CommandItem {
  label: string;
  hint: string;
  to: string;
  icon: LucideIcon;
}

const COMMANDS: CommandItem[] = [
  { label: "Dashboard", hint: "Command center", to: "/dashboard", icon: LayoutDashboard },
  { label: "Queue", hint: "Analyst worklist", to: "/queue", icon: Inbox },
  { label: "Investigate", hint: "Search all transactions", to: "/investigate", icon: Search },
  {
    label: "High-risk pending",
    hint: "Investigate filtered cases",
    to: "/investigate?risk=high&decision=pending",
    icon: Search,
  },
  {
    label: "Confirmed fraud",
    hint: "Reviewed fraud decisions",
    to: "/investigate?decision=confirmed_fraud",
    icon: Search,
  },
  {
    label: "False positives",
    hint: "Reviewed false alarms",
    to: "/investigate?decision=false_positive",
    icon: Search,
  },
  { label: "Watchlists", hint: "Blocked and trusted accounts", to: "/watchlists", icon: ListChecks },
  { label: "Models", hint: "Registry and production model", to: "/models", icon: Cpu },
  { label: "Drift", hint: "Monitor feature shift", to: "/drift", icon: Activity },
  { label: "Tuner", hint: "Optimize threshold", to: "/tuner", icon: Sliders },
  { label: "Settings", hint: "Account and controls", to: "/settings", icon: Settings },
];

export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter((item) =>
      `${item.label} ${item.hint}`.toLowerCase().includes(q),
    );
  }, [query]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange, open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  if (!open) return null;

  function choose(item: CommandItem) {
    navigate(item.to);
    onOpenChange(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]"
      style={{ background: "rgba(0,0,0,0.42)" }}
      onMouseDown={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-xl rounded-lg border shadow-2xl overflow-hidden"
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--color-border-strong)",
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="border-b px-3 py-2" style={{ borderColor: "var(--color-border)" }}>
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((value) => Math.min(value + 1, filtered.length - 1));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((value) => Math.max(value - 1, 0));
              }
              if (event.key === "Enter" && filtered[active]) {
                event.preventDefault();
                choose(filtered[active]);
              }
            }}
            placeholder="Jump to a page, preset, or workflow..."
            className="w-full bg-transparent outline-none text-sm"
            style={{ color: "var(--color-fg)" }}
          />
        </div>
        <div className="max-h-[360px] overflow-auto p-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-8 text-sm text-center" style={{ color: "var(--color-fg-subtle)" }}>
              No commands found.
            </div>
          ) : (
            filtered.map((item, index) => {
              const Icon = item.icon;
              const isActive = index === active;
              return (
                <button
                  key={`${item.label}-${item.to}`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(item)}
                  className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-left"
                  style={{
                    background: isActive ? "var(--color-brand-soft)" : "transparent",
                    color: isActive ? "var(--color-brand)" : "var(--color-fg)",
                  }}
                >
                  <Icon size={14} />
                  <span className="flex-1">
                    <span className="block text-sm">{item.label}</span>
                    <span className="block text-xs" style={{ color: "var(--color-fg-faint)" }}>
                      {item.hint}
                    </span>
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: "var(--color-fg-faint)" }}>
                    {item.to}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
