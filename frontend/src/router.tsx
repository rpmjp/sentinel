import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Placeholder } from "@/pages/Placeholder";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        path: "dashboard",
        element: <Placeholder name="Dashboard" step="Step 3.5" />,
      },
      {
        path: "queue",
        element: <Placeholder name="Fraud queue" step="Step 3.6" />,
      },
      {
        path: "investigate",
        element: <Placeholder name="Investigations" step="Step 3.7" />,
      },
      {
        path: "models",
        element: <Placeholder name="Model registry" step="Step 3.9" />,
      },
      {
        path: "drift",
        element: <Placeholder name="Drift monitoring" step="Step 3.10" />,
      },
      {
        path: "tuner",
        element: <Placeholder name="Threshold tuner" step="Step 3.8" />,
      },
      {
        path: "settings",
        element: <Placeholder name="Settings" step="Step 3.12" />,
      },
    ],
  },
]);