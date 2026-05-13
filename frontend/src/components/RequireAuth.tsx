import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getToken } from "@/lib/api";

interface RequireAuthProps {
  children: React.ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { isAuthenticated, isLoading, user, fetchMe } = useAuth();
  const location = useLocation();

  useEffect(() => {
    // If a token exists but no user is loaded yet, fetch /auth/me
    if (!user && !isLoading && getToken()) {
      void fetchMe();
    }
  }, [user, isLoading, fetchMe]);

  // Have a token, still loading the user — show a spinner
  if (getToken() && !isAuthenticated && isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--color-bg)", color: "var(--color-fg-subtle)" }}
      >
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  // No token at all → bounce to login
  if (!getToken()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}