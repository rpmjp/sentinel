import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  loading?: boolean;
  children: ReactNode;
}

const SIZES = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-3 py-1.5 text-sm",
} as const;

export function Button({
  variant = "primary",
  size = "md",
  loading,
  disabled,
  children,
  className,
  ...rest
}: ButtonProps) {
  const variantStyle: React.CSSProperties =
    variant === "primary"
      ? { background: "var(--color-brand)", color: "var(--color-brand-fg)" }
      : variant === "secondary"
      ? {
          background: "var(--color-surface-elevated)",
          color: "var(--color-fg)",
          border: "1px solid var(--color-border)",
        }
      : variant === "danger"
      ? { background: "var(--color-danger)", color: "#fff" }
      : { background: "transparent", color: "var(--color-fg-subtle)" };

  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-opacity disabled:opacity-60 disabled:cursor-not-allowed",
        SIZES[size],
        className,
      )}
      style={variantStyle}
    >
      {loading && <Loader2 size={12} className="animate-spin" />}
      {children}
    </button>
  );
}