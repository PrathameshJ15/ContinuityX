import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--ink)",
        },
        ink: "var(--ink)",
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted)",
        },
        faint: "var(--faint)",
        line: "var(--line)",
        brand: {
          DEFAULT: "var(--brand)",
          dark: "var(--brand-dark)",
        },
        tint: "var(--tint)",
        ok: {
          DEFAULT: "var(--ok)",
          tint: "var(--ok-tint)",
        },
        warn: {
          DEFAULT: "var(--warn)",
          tint: "var(--warn-tint)",
        },
        bad: {
          DEFAULT: "var(--bad)",
          tint: "var(--bad-tint)",
        },
        navy: "var(--navy)",
        "soft-section": "var(--soft-section)",
        "footer-bg": "var(--footer-bg)",
        "receipt-bg": "var(--receipt-bg)",

        // Standard shadcn / legacy aliases for backwards compatibility
        background: "var(--bg)",
        foreground: "var(--ink)",
        border: "var(--line)",
        input: "var(--line)",
        ring: "var(--brand)",
        primary: {
          DEFAULT: "var(--brand)",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "var(--card)",
          foreground: "var(--ink)",
        },
        destructive: {
          DEFAULT: "var(--bad)",
          foreground: "#ffffff",
        },
      },
      fontFamily: {
        heading: ["var(--font-inter)", "Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        body: ["var(--font-inter)", "Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
        sans: ["var(--font-inter)", "Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
      letterSpacing: {
        tightest: "-0.04em",
        tighter: "-0.03em",
        tight: "-0.02em",
        normal: "0",
        wide: "0.04em",
        wider: "0.08em",
      },
      borderRadius: {
        xl: "12px",
        lg: "8px",
        md: "6px",
        sm: "4px",
      },
      boxShadow: {
        soft: "0 10px 30px -10px rgba(15, 23, 42, 0.08)",
        modal: "0 20px 45px -10px rgba(15, 23, 42, 0.16)",
      },
      maxWidth: {
        app: "1240px",
        landing: "1180px",
      },
    },
  },
  plugins: [],
};

export default config;
