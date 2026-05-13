import { useState, type FormEvent } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Shield, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated, isLoading } = useAuth();
  const [email, setEmail] = useState("analyst@sentinel.demo");
  const [password, setPassword] = useState("demopass123");
  const [error, setError] = useState<string | null>(null);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate("/dashboard", { replace: true });
    } catch {
      setError("Invalid email or password");
    }
  }

  return (
    <div
      className="min-h-screen flex"
      style={{ background: "var(--color-bg)", color: "var(--color-fg)" }}
    >
      {/* Hero side */}
      <div
        className="hidden md:flex flex-1 flex-col justify-between p-12 border-r"
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--color-border)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: "var(--color-brand)" }}
          >
            <Shield size={18} color="white" strokeWidth={2.5} />
          </div>
          <span className="font-semibold text-lg tracking-tight">Sentinel</span>
        </div>

        <div className="max-w-md space-y-4">
          <p
            className="text-2xl font-medium leading-snug"
            style={{ color: "var(--color-fg)" }}
          >
            Real-time fraud detection
            <br />
            <span style={{ color: "var(--color-fg-subtle)" }}>
              with calibrated risk scores, SHAP explanations, and a tunable
              cost model.
            </span>
          </p>
          <div
            className="grid grid-cols-3 gap-4 pt-4 text-xs"
            style={{ color: "var(--color-fg-subtle)" }}
          >
            <div>
              <div
                className="font-mono text-lg font-medium"
                style={{ color: "var(--color-fg)" }}
              >
                0.992
              </div>
              <div>PR-AUC</div>
            </div>
            <div>
              <div
                className="font-mono text-lg font-medium"
                style={{ color: "var(--color-fg)" }}
              >
                22ms
              </div>
              <div>p50 latency</div>
            </div>
            <div>
              <div
                className="font-mono text-lg font-medium"
                style={{ color: "var(--color-fg)" }}
              >
                $1.2M
              </div>
              <div>net savings</div>
            </div>
          </div>
        </div>

        <div
          className="text-xs font-mono"
          style={{ color: "var(--color-fg-faint)" }}
        >
          v0.1.0 · prod
        </div>
      </div>

      {/* Form side */}
      <div className="flex-1 flex items-center justify-center p-8">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm space-y-5"
          autoComplete="on"
        >
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
            <p
              className="text-sm"
              style={{ color: "var(--color-fg-subtle)" }}
            >
              Demo credentials are pre-filled.
            </p>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-xs"
                style={{ color: "var(--color-fg-subtle)" }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-md text-sm outline-none transition-colors focus:ring-2"
                style={{
                  background: "var(--color-surface-elevated)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-fg)",
                }}
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-xs"
                style={{ color: "var(--color-fg-subtle)" }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-md text-sm outline-none transition-colors focus:ring-2"
                style={{
                  background: "var(--color-surface-elevated)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-fg)",
                }}
              />
            </div>
          </div>

          {error && (
            <div
              className="text-xs px-3 py-2 rounded"
              style={{
                background: "rgba(216,90,48,0.1)",
                color: "var(--color-brand)",
                border: "1px solid rgba(216,90,48,0.3)",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{
              background: "var(--color-brand)",
              color: "var(--color-brand-fg)",
            }}
          >
            {isLoading && <Loader2 size={14} className="animate-spin" />}
            {isLoading ? "Signing in…" : "Sign in"}
          </button>

          <div
            className="text-xs font-mono pt-2 space-y-1"
            style={{ color: "var(--color-fg-faint)" }}
          >
            <div>analyst@sentinel.demo · demopass123</div>
            <div>senior@sentinel.demo · demopass123</div>
            <div>admin@sentinel.demo · demopass123</div>
          </div>
        </form>
      </div>
    </div>
  );
}