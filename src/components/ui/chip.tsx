import * as React from "react";
import { cn } from "@/lib/utils";

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "brand" | "ok" | "warn" | "bad" | "neutral";
  dot?: boolean;
  dotColor?: string;
  size?: "sm" | "default";
}

export function Chip({
  className,
  variant = "neutral",
  dot = false,
  dotColor,
  size = "default",
  children,
  ...props
}: ChipProps) {
  const variantStyles = {
    brand: "bg-tint text-brand border-transparent",
    ok: "bg-ok-tint text-ok border-transparent",
    warn: "bg-warn-tint text-warn border-transparent",
    bad: "bg-bad-tint text-bad border-transparent",
    neutral: "bg-bg text-muted border border-line",
  };

  const dotStyles = {
    brand: "bg-brand",
    ok: "bg-ok",
    warn: "bg-warn",
    bad: "bg-bad",
    neutral: "bg-faint",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-heading font-semibold select-none",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-[12px]",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full shrink-0",
            dotColor || dotStyles[variant]
          )}
        />
      )}
      <span>{children}</span>
    </span>
  );
}
