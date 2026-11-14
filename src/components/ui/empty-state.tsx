import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { LucideIcon, FileText, CheckCircle2, ShieldCheck, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "./button";

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

  const iconStyles = {
    "no-data": "text-muted bg-bg border-line",
    "checked-empty": "text-ok bg-ok-tint border-ok/20",
    completed: "text-ok bg-ok-tint border-ok/20",
    error: "text-bad bg-bad-tint border-bad/20",
    custom: "text-brand bg-tint border-brand/20",
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-card p-8 sm:p-10 text-center flex flex-col items-center justify-center max-w-lg mx-auto select-none",
        className
      )}
    >
      <div
        className={cn(
          "h-11 w-11 rounded-lg border flex items-center justify-center mb-3",
          iconStyles[type]
        )}
      >
        <IconComponent className="h-5 w-5" />
      </div>

      <h4 className="text-[15px] font-heading font-bold text-ink leading-snug">
        {title}
      </h4>
      {description && (
        <p className="mt-1 text-[13.5px] text-muted max-w-sm leading-normal">
          {description}
        </p>
      )}

      {children}

      {(actionHref || onAction) && actionLabel && (
        <div className="mt-4">
          {actionHref ? (
            <Link href={actionHref}>
              <Button size="sm" variant="primary">
                <span>{actionLabel}</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </Link>
          ) : (
            <Button size="sm" variant="primary" onClick={onAction}>
              <span>{actionLabel}</span>
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
