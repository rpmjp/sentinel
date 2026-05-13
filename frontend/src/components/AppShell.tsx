import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/queue": "Fraud queue",
  "/investigate": "Investigations",
  "/models": "Model registry",
  "/drift": "Drift monitoring",
  "/tuner": "Threshold tuner",
  "/settings": "Settings",
};

export function AppShell() {
  const { pathname } = useLocation();
  const title =
    TITLES[pathname] ??
    TITLES[Object.keys(TITLES).find((k) => pathname.startsWith(k)) ?? ""] ??
    "Sentinel";

  return (
    <div className="h-screen flex" style={{ background: "var(--color-bg)" }}>
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <TopBar title={title} />
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}