import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { CommandMenu } from "./CommandMenu";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/queue": "Fraud queue",
  "/upload": "Batch upload",
  "/cases": "Case management",
  "/investigate": "Investigations",
  "/entities": "Entity profile",
  "/watchlists": "Watchlists",
  "/models": "Model registry",
  "/drift": "Drift monitoring",
  "/tuner": "Threshold tuner",
  "/settings": "Settings",
};

export function AppShell() {
  const { pathname } = useLocation();
  const [commandOpen, setCommandOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const title =
    TITLES[pathname] ??
    TITLES[Object.keys(TITLES).find((k) => pathname.startsWith(k)) ?? ""] ??
    "Sentinel";

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  return (
    <div className="h-dvh flex overflow-hidden" style={{ background: "var(--color-bg)" }}>
      <Sidebar className="hidden md:flex" />
      <main className="flex-1 flex flex-col min-w-0">
        <TopBar
          title={title}
          onCommandOpen={() => setCommandOpen(true)}
          onMenuClick={() => setNavOpen(true)}
        />
        <div className="app-content flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
      {navOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            className="absolute inset-0 w-full h-full"
            style={{ background: "rgba(0,0,0,0.48)" }}
            onClick={() => setNavOpen(false)}
            aria-label="Close navigation"
          />
          <Sidebar
            className="relative h-full shadow-2xl"
            onNavigate={() => setNavOpen(false)}
          />
        </div>
      )}
      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
