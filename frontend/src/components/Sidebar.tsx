import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Inbox,
  Upload,
  Search,
  Briefcase,
  ClipboardList,
  ListChecks,
  Cpu,
  Activity,
  Sliders,
  Settings,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/cn";

import type { LucideIcon } from "lucide-react";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: boolean;
}

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/queue", label: "Queue", icon: Inbox, badge: true },
  { to: "/upload", label: "Upload", icon: Upload },
  { to: "/audit", label: "Audit", icon: ClipboardList },
  { to: "/cases", label: "Cases", icon: Briefcase },
  { to: "/investigate", label: "Investigate", icon: Search },
  { to: "/watchlists", label: "Watchlists", icon: ListChecks },
  { to: "/models", label: "Models", icon: Cpu },
  { to: "/drift", label: "Drift", icon: Activity },
  { to: "/tuner", label: "Tuner", icon: Sliders },
];

export function Sidebar({ className, onNavigate }: SidebarProps) {
  return (
    <aside
      className={cn("w-[220px] md:w-[180px] shrink-0 border-r flex flex-col", className)}
      style={{
        background: "var(--color-sidebar)",
        borderColor: "var(--color-border)",
      }}
    >
      <div className="px-4 py-4 flex items-center gap-2.5">
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center"
          style={{ background: "var(--color-brand)" }}
        >
          <Shield size={14} color="white" strokeWidth={2.5} />
        </div>
        <span className="font-semibold tracking-tight">Sentinel</span>
      </div>

      <nav className="px-2 flex flex-col gap-0.5">
        {NAV.map(({ to, label, icon: Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors",
                isActive ? "active-nav" : "inactive-nav",
              )
            }
            style={({ isActive }) =>
              isActive
                ? {
                    background: "var(--color-brand-soft)",
                    color: "var(--color-brand)",
                    borderLeft: "2px solid var(--color-brand)",
                    paddingLeft: "calc(0.625rem - 2px)",
                  }
                : { color: "var(--color-fg-muted)" }
            }
          >
            <Icon size={14} />
            <span className="flex-1">{label}</span>
            {badge && (
              <span
                className="text-[9px] font-mono px-1.5 py-0.5 rounded-full text-white"
                style={{ background: "var(--color-brand)" }}
              >
                147
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto px-2 pb-4">
        <NavLink
          to="/settings"
          onClick={onNavigate}
          className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm"
          style={{ color: "var(--color-fg-faint)" }}
        >
          <Settings size={14} />
          <span>Settings</span>
        </NavLink>
      </div>
    </aside>
  );
}
