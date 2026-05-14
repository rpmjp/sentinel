import { useState, type FormEvent } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import {
  Activity,
  BarChart3,
  Briefcase,
  FileSearch,
  ListChecks,
  Loader2,
  Shield,
  Upload,
} from "lucide-react";
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
      className="min-h-dvh flex items-center justify-center px-4 py-6 sm:px-6 lg:px-10"
      style={{ background: "var(--color-bg)", color: "var(--color-fg)" }}
    >
      <div
        className="w-full max-w-6xl overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          borderColor: "var(--color-border)",
          background: "var(--color-surface-elevated)",
          boxShadow: "var(--shadow-card-hover)",
        }}
      >
        <div className="grid lg:grid-cols-[0.85fr_1.15fr]">
          {/* Form side */}
          <div className="p-6 sm:p-8 lg:p-10">
            <div className="mb-8 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: "var(--color-brand)" }}
                >
                  <Shield size={18} color="white" strokeWidth={2.5} />
                </div>
                <div>
                  <div className="font-semibold text-lg tracking-tight">Sentinel</div>
                  <div className="text-xs font-mono" style={{ color: "var(--color-fg-faint)" }}>
                    demo-bank-01
                  </div>
                </div>
              </div>
              <div
                className="hidden sm:flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-mono"
                style={{
                  color: "var(--color-success)",
                  borderColor: "var(--color-border)",
                  background: "var(--color-success-soft)",
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-success)" }} />
                model healthy
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="w-full max-w-sm space-y-5"
              autoComplete="on"
            >
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
                <p
                  className="text-sm"
                  style={{ color: "var(--color-fg-subtle)" }}
                >
                  Sign in to the fraud operations workspace.
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
                    className="w-full px-3 py-2.5 rounded-md text-sm outline-none transition-colors"
                    style={{
                      background: "var(--color-bg)",
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
                    className="w-full px-3 py-2.5 rounded-md text-sm outline-none transition-colors"
                    style={{
                      background: "var(--color-bg)",
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
                    background: "var(--color-danger-soft)",
                    color: "var(--color-brand)",
                    border: "1px solid var(--color-danger)",
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-md text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{
                  background: "var(--color-brand)",
                  color: "var(--color-brand-fg)",
                }}
              >
                {isLoading && <Loader2 size={14} className="animate-spin" />}
                {isLoading ? "Signing in..." : "Sign in"}
              </button>

              <div
                className="rounded-lg border p-3 text-xs font-mono space-y-1"
                style={{
                  color: "var(--color-fg-faint)",
                  borderColor: "var(--color-border)",
                  background: "var(--color-surface)",
                }}
              >
                <div>analyst@sentinel.demo / demopass123</div>
                <div>senior@sentinel.demo / demopass123</div>
                <div>admin@sentinel.demo / demopass123</div>
              </div>
            </form>
          </div>

          {/* Product preview side */}
          <div
            className="border-t lg:border-l lg:border-t-0 p-5 sm:p-8 lg:p-10"
            style={{
              borderColor: "var(--color-border)",
              background:
                "linear-gradient(145deg, var(--color-surface) 0%, var(--color-bg) 55%, var(--color-surface-elevated) 100%)",
            }}
          >
            <div className="mx-auto max-w-xl space-y-5">
              <div>
                <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--color-info)" }}>
                  Fraud command center
                </div>
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight leading-tight">
                  Real-time fraud operations, ready for review.
                </h2>
                <p className="mt-3 text-sm leading-6" style={{ color: "var(--color-fg-subtle)" }}>
                  Monitor exposure, investigate entities, create cases, and tune thresholds from one workspace.
                </p>
              </div>

              <PreviewDashboard />

              <div className="grid sm:grid-cols-3 gap-2">
                <Signal icon={Activity} label="Model health" value="p50 22ms" />
                <Signal icon={Briefcase} label="Cases" value="SLA aware" />
                <Signal icon={ListChecks} label="Watchlists" value="Block/trust" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Feature icon={FileSearch} label="Investigate" />
                <Feature icon={Upload} label="Batch upload" />
                <Feature icon={BarChart3} label="Drift monitor" />
                <Feature icon={Shield} label="Risk scoring" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewDashboard() {
  return (
    <div
      className="rounded-xl border p-3 sm:p-4"
      style={{
        background: "var(--color-surface-elevated)",
        borderColor: "var(--color-border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-fg-subtle)" }}>
            Live posture
          </div>
          <div className="text-sm font-medium mt-1">Elevated fraud posture</div>
        </div>
        <div className="rounded-full px-2 py-1 text-[10px] font-mono" style={{ color: "var(--color-danger)", background: "var(--color-danger-soft)" }}>
          high risk
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <PreviewMetric label="open" value="147" tone="var(--color-brand)" />
        <PreviewMetric label="blocked" value="$149M" tone="var(--color-success)" />
        <PreviewMetric label="score" value="0.82" tone="var(--color-info)" />
      </div>

      <div className="rounded-lg border p-3" style={{ borderColor: "var(--color-border)", background: "var(--color-bg)" }}>
        <div className="flex items-end gap-1 h-24">
          {[32, 46, 38, 70, 45, 84, 54, 62, 34, 76, 48, 58].map((height, index) => (
            <div
              key={index}
              className="flex-1 rounded-t-sm"
              style={{
                height: `${height}%`,
                background: index === 5 || index === 9 ? "var(--color-brand)" : "var(--color-info-soft)",
                border: "1px solid var(--color-border)",
              }}
            />
          ))}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {[
          ["TRANSFER", "0.998", "$2.65M"],
          ["CASH_OUT", "0.941", "$842K"],
          ["PAYMENT", "0.702", "$184K"],
        ].map(([type, score, amount]) => (
          <div key={type} className="grid grid-cols-[70px_1fr_70px] gap-2 text-xs font-mono">
            <span style={{ color: "var(--color-brand)" }}>{type}</span>
            <span style={{ color: "var(--color-fg-subtle)" }}>{score}</span>
            <span className="text-right" style={{ color: "var(--color-fg)" }}>{amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-lg border p-2" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
      <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-fg-faint)" }}>
        {label}
      </div>
      <div className="font-mono text-lg mt-1" style={{ color: tone }}>
        {value}
      </div>
    </div>
  );
}

function Signal({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-elevated)" }}>
      <Icon size={14} style={{ color: "var(--color-info)" }} />
      <div className="text-xs mt-2" style={{ color: "var(--color-fg-subtle)" }}>{label}</div>
      <div className="text-sm font-mono mt-1">{value}</div>
    </div>
  );
}

function Feature({
  icon: Icon,
  label,
}: {
  icon: typeof Activity;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border px-2 py-2 text-xs" style={{ borderColor: "var(--color-border)", color: "var(--color-fg-subtle)" }}>
      <Icon size={13} style={{ color: "var(--color-brand)" }} />
      <span>{label}</span>
    </div>
  );
}
