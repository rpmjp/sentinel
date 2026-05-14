import { useEffect, useState } from "react";
import { Sun, Moon, LogOut, Search } from "lucide-react";
import { applyTheme, getInitialTheme, type Theme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";

interface TopBarProps {
  title: string;
  onCommandOpen: () => void;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function TopBar({ title, onCommandOpen }: TopBarProps) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme());
  const { user, logout } = useAuth();

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
          {user?.tenant_slug ?? "—"}
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
          onClick={onCommandOpen}
          className="hidden md:flex items-center gap-2 rounded-md border px-2 py-1 transition-colors hover:bg-[var(--color-surface-elevated)]"
          style={{
            borderColor: "var(--color-border)",
            color: "var(--color-fg-subtle)",
          }}
        >
          <Search size={12} />
          <span>Search</span>
          <span className="font-mono text-[10px]" style={{ color: "var(--color-fg-faint)" }}>
            Ctrl K
          </span>
        </button>

        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-1.5 rounded-md transition-colors hover:bg-[var(--color-surface-elevated)]"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        <button
          onClick={logout}
          className="p-1.5 rounded-md transition-colors hover:bg-[var(--color-surface-elevated)]"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut size={14} />
        </button>

        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium text-white"
          style={{ background: "var(--color-brand)" }}
          title={user?.email ?? ""}
        >
          {user ? initials(user.full_name) : "—"}
        </div>
      </div>
    </div>
  );
}
