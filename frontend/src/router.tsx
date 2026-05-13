import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Placeholder } from "@/pages/Placeholder";
import Login from "@/pages/Login";

export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  {
    path: "/",
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <Placeholder name="Dashboard" step="Step 3.5" /> },
      { path: "queue", element: <Placeholder name="Fraud queue" step="Step 3.6" /> },
      { path: "investigate", element: <Placeholder name="Investigations" step="Step 3.7" /> },
      { path: "models", element: <Placeholder name="Model registry" step="Step 3.9" /> },
      { path: "drift", element: <Placeholder name="Drift monitoring" step="Step 3.10" /> },
      { path: "tuner", element: <Placeholder name="Threshold tuner" step="Step 3.8" /> },
      { path: "settings", element: <Placeholder name="Settings" step="Step 3.12" /> },
    ],
  },
]);