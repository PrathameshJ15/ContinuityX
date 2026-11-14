import * as React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: React.ElementType;
}

export function Card({
  className,
  as: Component = "div",
  children,
  ...props
}: CardProps) {
  return (
    <Component
      className={cn(
        "rounded-xl border border-line bg-card p-5 sm:p-6 transition-colors",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export interface CardHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
  ...props
}: CardHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 pb-4 border-b border-line mb-4",
        className
      )}
      {...props}
    >
      <div>
        <h3 className="text-[16px] font-heading font-bold text-ink leading-tight">
          {title}
        </h3>
        {subtitle && (
          <p className="text-[13.5px] text-muted mt-1 leading-normal">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
