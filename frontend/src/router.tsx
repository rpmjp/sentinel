import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Queue from "@/pages/Queue";
import TransactionDetail from "@/pages/TransactionDetail";
import Tuner from "@/pages/Tuner";
import Drift from "@/pages/Drift";
import Models from "@/pages/Models";
import Investigate from "@/pages/Investigate";
import Settings from "@/pages/Settings";
import EntityProfile from "@/pages/EntityProfile";
import Watchlists from "@/pages/Watchlists";

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
      { path: "entities/:accountId", element: <EntityProfile /> },
      { path: "investigate", element: <Investigate /> },
      { path: "watchlists", element: <Watchlists /> },
      { path: "models", element: <Models /> },
      { path: "drift", element: <Drift /> },
      { path: "tuner", element: <Tuner /> },
      { path: "settings", element: <Settings /> },
    ],
  },
]);
