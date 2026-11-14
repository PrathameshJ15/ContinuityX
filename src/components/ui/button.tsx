import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger-text" | "success" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "default",
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center rounded-lg font-heading font-semibold transition-colors duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none select-none text-[14.5px]";

    const sizeStyles = {
      default: "min-h-[44px] px-4 py-2",
      sm: "min-h-[38px] sm:min-h-[36px] px-3 py-1.5 text-[13.5px]",
      lg: "min-h-[48px] px-6 py-2.5 text-[15px]",
      icon: "min-h-[44px] min-w-[44px] p-2 flex items-center justify-center",
    };

    const variantStyles = {
      primary:
        "bg-brand text-white hover:bg-brand-dark active:bg-brand-dark shadow-sm",
      secondary:
        "bg-card text-ink border border-line hover:bg-bg active:bg-bg/80 text-ink shadow-sm",
      "danger-text":
        "bg-transparent text-bad hover:bg-bad/10 active:bg-bad/20 p-2 min-h-0",
      success:
        "bg-ok text-white hover:bg-ok/90 active:bg-ok/80 shadow-sm",
      outline:
        "bg-transparent border border-line text-ink hover:bg-bg active:bg-bg/80",
      ghost:
        "bg-transparent text-muted hover:text-ink hover:bg-bg active:bg-bg/80",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, sizeStyles[size], variantStyles[variant], className)}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
