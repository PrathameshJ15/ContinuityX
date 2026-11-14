import * as React from "react";
import { cn } from "@/lib/utils";

export interface FormFieldProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  rightElement?: React.ReactNode;
}

export const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(
  (
    {
      className,
      label,
      helperText,
      error,
      id,
      rightElement,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-[13.5px] font-heading font-semibold text-ink"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          <input
            id={inputId}
            ref={ref}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={
              error ? errorId : helperText ? helperId : undefined
            }
            className={cn(
              "h-11 w-full rounded-lg border bg-card px-3.5 text-[16px] sm:text-[14.5px] text-ink placeholder:text-faint transition-colors duration-150",
              "border-line focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20",
              error && "border-bad focus:border-bad focus:ring-bad/20",
              disabled && "opacity-60 cursor-not-allowed bg-bg",
              rightElement && "pr-11",
              className
            )}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-3 flex items-center text-muted">
              {rightElement}
            </div>
          )}
        </div>
        {error ? (
          <p id={errorId} role="alert" className="text-[13px] text-bad flex items-center gap-1 font-medium">
            <span>{error}</span>
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-[13px] text-faint">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

FormField.displayName = "FormField";
