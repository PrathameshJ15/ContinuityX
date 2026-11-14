import * as React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  badge?: React.ReactNode;
  trend?: {
    direction: "up" | "down" | "neutral";
    label: string;
  };
  variant?: "default" | "success" | "warning" | "danger" | "info";
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  badge,
  trend,
  variant = "default",
  className,
  ...props
}: MetricCardProps) {
  const dotClasses = {
    default: "bg-brand",
    success: "bg-ok",
    warning: "bg-warn",
    danger: "bg-bad",
    info: "bg-brand",
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-card p-5 flex flex-col justify-between transition-colors",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {Icon ? (
            <Icon className="h-4 w-4 shrink-0 text-muted" />
          ) : (
            <span
              className={cn("h-2 w-2 rounded-full shrink-0", dotClasses[variant])}
              aria-hidden="true"
            />
          )}
          <span className="text-[13.5px] font-medium text-muted truncate">
            {title}
          </span>
        </div>
        {badge}
      </div>

      <div className="my-1 flex items-baseline justify-between gap-2">
        <div className="text-[28px] sm:text-[30px] font-heading font-bold text-ink tracking-tight tabular-nums leading-tight">
          {value}
        </div>
        {trend && (
          <span
            className={cn(
              "text-[12px] font-heading font-semibold",
              trend.direction === "up" && "text-ok",
              trend.direction === "down" && "text-bad",
              trend.direction === "neutral" && "text-muted"
            )}
          >
            {trend.label}
          </span>
        )}
      </div>

      {subtitle && (
        <div className="text-[13px] text-faint mt-1 leading-snug truncate">
          {subtitle}
        </div>
      )}
    </div>
  );
}
