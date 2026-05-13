import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Placeholder } from "@/pages/Placeholder";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Queue from "@/pages/Queue";
import TransactionDetail from "@/pages/TransactionDetail";
import Tuner from "@/pages/Tuner";
import Drift from "@/pages/Drift";
import Models from "@/pages/Models";
import Investigate from "@/pages/Investigate";

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
      { path: "dashboard", element: <Dashboard /> },
      { path: "queue", element: <Queue /> },
      { path: "transactions/:id", element: <TransactionDetail /> },
      { path: "investigate", element: <Investigate /> },
      { path: "models", element: <Models /> },
      { path: "drift", element: <Drift /> },
      { path: "tuner", element: <Tuner /> },
      { path: "settings", element: <Placeholder name="Settings" step="Step 3.12" /> },
    ],
  },
]);