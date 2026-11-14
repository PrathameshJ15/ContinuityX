import * as React from "react";
import { cn } from "@/lib/utils";

export interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  caption?: React.ReactNode;
  dotColor?: "brand" | "ok" | "warn" | "bad" | "faint";
  className?: string;
  loading?: boolean;
}

export function KpiCard({
  label,
  value,
  caption,
  dotColor = "brand",
  className,
  loading = false,
}: KpiCardProps) {
  const dotClasses = {
    brand: "bg-brand",
    ok: "bg-ok",
    warn: "bg-warn",
    bad: "bg-bad",
    faint: "bg-faint",
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-card p-5 flex flex-col justify-between transition-colors",
        className
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className={cn("h-2 w-2 rounded-full shrink-0", dotClasses[dotColor])}
          aria-hidden="true"
        />
        <span className="text-[13.5px] font-medium text-muted leading-none">
          {label}
        </span>
      </div>

      <div className="my-1">
        {loading ? (
          <div className="h-8 w-16 bg-line/60 rounded animate-pulse" />
        ) : (
          <div className="text-[30px] font-heading font-bold text-ink tracking-tight tabular-nums leading-tight">
            {value}
          </div>
        )}
      </div>

      {caption && (
        <div className="text-[13px] text-faint mt-1 leading-snug">
          {caption}
        </div>
      )}
    </div>
  );
}
