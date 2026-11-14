import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0 to 100
  max?: number;
  barColor?: "ok" | "brand" | "warn" | "bad";
}

export function ProgressBar({
  value,
  max = 100,
  barColor = "ok",
  className,
  ...props
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const barClasses = {
    ok: "bg-ok",
    brand: "bg-brand",
    warn: "bg-warn",
    bad: "bg-bad",
  };

  return (
    <div
      className={cn(
        "h-2 w-full rounded-full bg-line overflow-hidden select-none",
        className
      )}
      role="progressbar"
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
      {...props}
    >
      <div
        className={cn("h-full rounded-full transition-all duration-300 ease-out", barClasses[barColor])}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
