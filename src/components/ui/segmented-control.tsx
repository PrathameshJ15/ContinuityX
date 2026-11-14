import * as React from "react";
import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex p-1 bg-bg border border-line rounded-lg select-none",
        className
      )}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-3.5 py-1.5 text-[13.5px] font-heading font-semibold rounded-md transition-all duration-150 ease-in-out",
              isActive
                ? "bg-card text-ink shadow-sm"
                : "text-muted hover:text-ink hover:bg-card/50"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
