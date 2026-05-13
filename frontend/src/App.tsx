export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg font-semibold"
            style={{ background: "var(--color-brand)" }}
          >
            S
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Sentinel</h1>
        </div>
        <p style={{ color: "var(--color-fg-subtle)" }}>
          Production-grade fraud detection · v0.1.0
        </p>
        <div
          className="font-mono text-xs px-3 py-1.5 rounded inline-block"
          style={{
            background: "var(--color-surface-elevated)",
            color: "var(--color-fg-faint)",
            border: "1px solid var(--color-border)",
          }}
        >
          frontend bootstrapping · phase 3
        </div>
      </div>
    </div>
  );
}