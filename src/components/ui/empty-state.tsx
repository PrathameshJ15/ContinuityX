import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { LucideIcon, FileText, CheckCircle2, ShieldCheck, AlertCircle, ArrowRight } from "lucide-react";

export interface EmptyStateProps {
  type?: "no-data" | "checked-empty" | "completed" | "error" | "custom";
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export function EmptyState({
  type = "no-data",
  icon: CustomIcon,
  title,
  description,
  actionHref,
  actionLabel,
  onAction,
  className,
  children,
}: EmptyStateProps) {
  const IconComponent =
    CustomIcon ||
    (type === "checked-empty"
      ? ShieldCheck
      : type === "completed"
      ? CheckCircle2
      : type === "error"
      ? AlertCircle
      : FileText);

  const iconColor =
    type === "checked-empty" || type === "completed"
      ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/60"
      : type === "error"
      ? "text-rose-500 bg-rose-50 dark:bg-rose-950/40 border-rose-200/60"
      : "text-muted-foreground bg-muted/50 border-border/60";

  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-border/80 bg-card/60 p-10 text-center flex flex-col items-center justify-center max-w-xl mx-auto",
        className
      )}
    >
      <div className={cn("h-12 w-12 rounded-2xl border flex items-center justify-center mb-3.5 shadow-sm", iconColor)}>
        <IconComponent className="h-6 w-6" />
      </div>

      <h3 className="text-base font-semibold text-foreground tracking-tight">{title}</h3>
      {description && (
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed max-w-md">{description}</p>
      )}

      {children}

      {(actionHref || onAction) && actionLabel && (
        <div className="mt-5">
          {actionHref ? (
            <Link
              href={actionHref}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-sm transition-all active:scale-[0.98]"
            >
              <span>{actionLabel}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <button
              onClick={onAction}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-sm transition-all active:scale-[0.98]"
            >
              <span>{actionLabel}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
