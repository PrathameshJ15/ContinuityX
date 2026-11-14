import * as React from "react";
import Link from "next/link";

interface LogoProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "full" | "symbol" | "wordmark";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  href?: string;
  className?: string;
  textColor?: string;
}

const sizeMap = {
  xs: { symbol: 20, font: "text-[16px]", gap: "gap-1.5" },
  sm: { symbol: 24, font: "text-[18px]", gap: "gap-2" },
  md: { symbol: 32, font: "text-[21px]", gap: "gap-2.5" },
  lg: { symbol: 40, font: "text-[26px]", gap: "gap-3" },
  xl: { symbol: 52, font: "text-[32px]", gap: "gap-3.5" },
};

export function LogoSymbol({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      {/* Outer Lines & Network Edges */}
      <g
        className="stroke-brand dark:stroke-[#818cf8]"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Top & Bottom Horizontal Bars */}
        <path d="M 22 18 L 43 18" />
        <path d="M 57 18 L 78 18" />
        <path d="M 22 82 L 43 82" />
        <path d="M 57 82 L 78 82" />

        {/* Outer Diagonal Silhouettes */}
        <path d="M 22 18 L 32 33 L 37 50 L 32 67 L 22 82" />
        <path d="M 78 18 L 68 33 L 63 50 L 68 67 L 78 82" />

        {/* Diagonal Inner Flanges */}
        <path d="M 43 18 L 32 33" />
        <path d="M 57 18 L 68 33" />
        <path d="M 43 82 L 32 67" />
        <path d="M 57 82 L 68 67" />

        {/* Upper Constellation Mesh */}
        <path d="M 43 18 L 50 32 L 57 18" />
        <path d="M 32 33 L 50 32 L 68 33" />
        <path d="M 37 50 L 50 32 L 63 50" />
        <path d="M 50 32 L 50 50" />

        {/* Central Waist */}
        <path d="M 37 50 L 63 50" />

        {/* Lower Constellation Mesh */}
        <path d="M 50 50 L 50 68" />
        <path d="M 37 50 L 50 68 L 63 50" />
        <path d="M 32 67 L 50 68 L 68 67" />
        <path d="M 43 82 L 50 68 L 57 82" />
      </g>

      {/* Connected Knowledge Nodes */}
      <g className="fill-brand dark:fill-[#a5b4fc]">
        <circle cx="43" cy="18" r="3.4" />
        <circle cx="57" cy="18" r="3.4" />
        <circle cx="32" cy="33" r="3.4" />
        <circle cx="50" cy="32" r="3.8" className="fill-[#0f172a] dark:fill-white" />
        <circle cx="68" cy="33" r="3.4" />
        <circle cx="37" cy="50" r="3.4" />
        {/* Verified Central Hub */}
        <circle cx="50" cy="50" r="4.4" className="fill-[#0f8a5f] dark:fill-[#34d399]" />
        <circle cx="63" cy="50" r="3.4" />
        <circle cx="32" cy="67" r="3.4" />
        <circle cx="50" cy="68" r="3.8" className="fill-[#0f172a] dark:fill-white" />
        <circle cx="68" cy="67" r="3.4" />
        <circle cx="43" cy="82" r="3.4" />
        <circle cx="57" cy="82" r="3.4" />
      </g>
    </svg>
  );
}

export function Logo({
  variant = "full",
  size = "md",
  href,
  className = "",
  textColor = "text-ink",
  ...props
}: LogoProps) {
  const config = sizeMap[size];

  const content = (
    <div
      className={`inline-flex items-center ${config.gap} select-none ${className}`}
      {...props}
    >
      {variant !== "wordmark" && (
        <div className="flex items-center justify-center shrink-0">
          <LogoSymbol size={config.symbol} />
        </div>
      )}

      {variant !== "symbol" && (
        <span
          className={`font-heading font-extrabold ${textColor} tracking-tight ${config.font} leading-none`}
        >
          Continuity
          <span className="text-brand dark:text-[#818cf8]">X</span>
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded-lg">
        {content}
      </Link>
    );
  }

  return content;
}
