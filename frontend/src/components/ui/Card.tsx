import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg" | "none";
}

const PADDING = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
} as const;

export function Card({ children, className, padding = "md" }: CardProps) {
  return (
    <div
      className={cn("rounded-lg border", PADDING[padding], className)}
      style={{
        background: "var(--color-surface-elevated)",
        borderColor: "var(--color-border)",
      }}
    >
      {children}
    </div>
  );
}