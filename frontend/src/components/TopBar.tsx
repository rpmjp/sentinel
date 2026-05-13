import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { applyTheme, getInitialTheme, type Theme } from "@/lib/theme";

interface TopBarProps {
  title: string;
  tenantSlug?: string;
}

export function TopBar({ title, tenantSlug = "demo-bank-01" }: TopBarProps) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <div
      className="h-12 border-b flex items-center justify-between px-4 shrink-0"
      style={{ borderColor: "var(--color-border)" }}
    >
      <div className="flex items-center gap-3">
        <span className="font-medium text-sm">{title}</span>
        <span
          className="font-mono text-xs"
          style={{ color: "var(--color-fg-faint)" }}
        >
          {tenantSlug}
        </span>
      </div>

      <div
        className="flex items-center gap-4 text-xs"
        style={{ color: "var(--color-fg-subtle)" }}
      >
        <span className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "var(--color-success)" }}
          />
          model healthy
        </span>
        <span className="font-mono">p50 22ms</span>

        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-1.5 rounded-md transition-colors hover:bg-[var(--color-surface-elevated)]"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium text-white"
          style={{ background: "var(--color-brand)" }}
        >
          RJ
        </div>
      </div>
    </div>
  );
}