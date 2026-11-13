import * as React from "react";
import { cn } from "@/lib/utils";

export interface FilterOption<T extends string = string> {
  id: T;
  label: string;
  count?: number | null;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface FilterPillsProps<T extends string = string> {
  options: FilterOption<T>[];
  selectedId: T;
  onSelect: (id: T) => void;
  size?: "sm" | "default";
  className?: string;
}

export function FilterPills<T extends string = string>({
  options,
  selectedId,
  onSelect,
  size = "default",
  className,
}: FilterPillsProps<T>) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 p-1 rounded-xl border bg-muted/30 text-xs overflow-x-auto max-w-full",
        className
      )}
    >
      {options.map((option) => {
        const isSelected = selectedId === option.id;
        const Icon = option.icon;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg font-medium transition-all whitespace-nowrap select-none",
              size === "sm" ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
              isSelected
                ? "bg-card text-foreground font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.06)] border border-border/80"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
            <span>{option.label}</span>
            {typeof option.count === "number" && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[10px] font-mono",
                  isSelected
                    ? "bg-primary/10 text-primary font-bold"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
