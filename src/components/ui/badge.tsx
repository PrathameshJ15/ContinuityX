import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 font-medium transition-colors select-none",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary border border-primary/20",
        secondary: "bg-secondary text-secondary-foreground border border-border/80",
        outline: "text-foreground border border-border/90 bg-background/50",
        success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50",
        warning: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50",
        destructive: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50",
        verified: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-semibold",
        weak: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60",
        contradicted: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 font-semibold",
        unverified: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700",
        flagged: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60",
        critical: "bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200 border border-rose-300 dark:border-rose-800 font-bold",
        neutral: "bg-slate-50 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800",
      },
      size: {
        sm: "px-2 py-0.5 text-[11px] rounded-md tracking-tight",
        default: "px-2.5 py-0.5 text-xs rounded-full",
        lg: "px-3 py-1 text-xs rounded-full font-semibold",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, variant, size, dot, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full shrink-0",
            variant === "verified" || variant === "success"
              ? "bg-emerald-500"
              : variant === "weak" || variant === "warning"
              ? "bg-amber-500"
              : variant === "contradicted" || variant === "destructive" || variant === "critical"
              ? "bg-rose-500"
              : variant === "flagged"
              ? "bg-purple-500"
              : "bg-primary"
          )}
        />
      )}
      {children}
    </div>
  );
}
