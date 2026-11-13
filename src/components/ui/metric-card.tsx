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
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 transition-all duration-150 hover:border-border/90 shadow-[0_1px_2px_rgba(0,0,0,0.03)]",
        variant === "success" && "border-emerald-200/80 bg-emerald-50/20 dark:border-emerald-900/40",
        variant === "warning" && "border-amber-200/80 bg-amber-50/20 dark:border-amber-900/40",
        variant === "danger" && "border-rose-200/80 bg-rose-50/20 dark:border-rose-900/40",
        variant === "info" && "border-primary/20 bg-primary/5",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground truncate">
          {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" />}
          <span className="truncate">{title}</span>
        </div>
        {badge}
      </div>

      <div className="mt-2.5 flex items-baseline justify-between gap-2">
        <div className="text-2xl font-bold tracking-tight text-foreground">{value}</div>
        {trend && (
          <span
            className={cn(
              "text-[11px] font-semibold flex items-center gap-0.5",
              trend.direction === "up" && "text-emerald-600 dark:text-emerald-400",
              trend.direction === "down" && "text-rose-600 dark:text-rose-400",
              trend.direction === "neutral" && "text-muted-foreground"
            )}
          >
            {trend.label}
          </span>
        )}
      </div>

      {subtitle && <div className="mt-1 text-xs text-muted-foreground truncate">{subtitle}</div>}
    </div>
  );
}
