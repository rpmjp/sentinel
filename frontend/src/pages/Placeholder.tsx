interface PlaceholderProps {
  name: string;
  step: string;
}

export function Placeholder({ name, step }: PlaceholderProps) {
  return (
    <div className="p-8">
      <div
        className="rounded-lg border p-8 max-w-xl"
        style={{
          background: "var(--color-surface-elevated)",
          borderColor: "var(--color-border)",
        }}
      >
        <h2 className="text-lg font-medium mb-2">{name}</h2>
        <p className="text-sm" style={{ color: "var(--color-fg-subtle)" }}>
          To be built in {step}.
        </p>
      </div>
    </div>
  );
}