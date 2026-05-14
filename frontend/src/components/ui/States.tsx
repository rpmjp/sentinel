import type { ReactNode } from "react";
import { SearchX } from "lucide-react";

export function SkeletonRows({
  rows = 5,
  columns = "60px 70px 1fr 110px 110px 100px",
}: {
  rows?: number;
  columns?: string;
}) {
  return (
    <div>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="grid gap-3 px-4 py-3 border-t"
          style={{
            gridTemplateColumns: columns,
            borderColor: "var(--color-border)",
          }}
        >
          {Array.from({ length: columns.split(" ").length }, (_, col) => (
            <div
              key={col}
              className="h-4 rounded animate-pulse"
              style={{
                background: col === 2
                  ? "var(--color-border-strong)"
                  : "var(--color-border)",
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-4 py-12 text-center">
      <div
        className="mx-auto mb-3 w-9 h-9 rounded-md flex items-center justify-center"
        style={{
          background: "var(--color-surface)",
          color: "var(--color-fg-subtle)",
          border: "1px solid var(--color-border)",
        }}
      >
        <SearchX size={16} />
      </div>
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs mt-1" style={{ color: "var(--color-fg-subtle)" }}>
        {description}
      </div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
