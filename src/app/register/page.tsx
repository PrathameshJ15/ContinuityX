"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Logo } from "@/components/ui/logo";
import { GoogleIcon, GitHubIcon } from "@/components/ui/oauth-icons";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const urlError = urlParams.get("error");
      if (urlError) {
        setError(urlError);
      }
    }
  }, []);

  // Live password validation
  const hasMinLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const isValidPassword = hasMinLength && hasNumber;

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isValidPassword) {
      setError("Password must be at least 8 characters and include at least one number.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to create account.");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to register. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col lg:flex-row antialiased selection:bg-brand/20 selection:text-brand">
      {/* LEFT COLUMN: 46% (Form) */}
      <div className="w-full lg:w-[46%] bg-card flex flex-col justify-between p-4 sm:p-8 lg:p-12 border-r border-line min-h-screen">
        {/* Top bar with Logo & ThemeToggle */}
        <div className="flex items-center justify-between">
          <Logo size="md" href="/" />
          <ThemeToggle />
        </div>

        {/* Center 392px form block */}
        <div className="w-full max-w-[392px] mx-auto my-auto py-8 space-y-6">
          <div className="space-y-1.5">
            <h1 className="text-[28px] sm:text-[30px] font-heading font-bold text-ink tracking-tight leading-tight">
              Create your account
            </h1>
            <p className="text-[14.5px] text-muted">
              Start verifying project knowledge in minutes.
            </p>
          </div>

          {/* Segmented Control */}
          <div className="grid grid-cols-2 p-1 bg-bg border border-line rounded-lg text-center select-none">
            <Link
              href="/login"
              className="py-1.5 text-[13.5px] font-heading font-semibold rounded-md text-muted hover:text-ink transition-colors"
            >
              Sign in
            </Link>
            <button
              type="button"
              className="py-1.5 text-[13.5px] font-heading font-semibold rounded-md bg-card text-ink shadow-sm"
            >
              Create account
            </button>
          </div>

          {/* Error Summary */}
          {error && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-lg border border-bad/30 bg-bad-tint p-3 text-[13px] text-bad font-medium"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Social OAuth Sign Up Buttons */}
          <div className="space-y-2.5">
            <a
              href="/api/auth/oauth/google"
              className="flex items-center justify-center gap-3 w-full min-h-[44px] px-4 rounded-lg border border-line bg-card hover:bg-soft-section dark:hover:bg-[#161f36] text-[14px] font-heading font-semibold text-ink transition-colors shadow-sm select-none"
            >
              <GoogleIcon className="h-5 w-5 shrink-0" />
              <span>Continue with Google</span>
            </a>

            <a
              href="/api/auth/oauth/github"
              className="flex items-center justify-center gap-3 w-full min-h-[44px] px-4 rounded-lg border border-line bg-card hover:bg-soft-section dark:hover:bg-[#161f36] text-[14px] font-heading font-semibold text-ink transition-colors shadow-sm select-none"
            >
              <GitHubIcon className="h-5 w-5 shrink-0" />
              <span>Continue with GitHub</span>
            </a>
          </div>

          {/* Divider between OAuth and Email/Password */}
          <div className="relative flex items-center justify-center py-1">
            <div className="w-full border-t border-line" />
            <span className="absolute bg-card px-3 text-[12px] font-mono text-muted uppercase tracking-wider">
              Or register with email
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="name" className="block text-[13.5px] font-heading font-semibold text-ink">
                Full name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Riya Sharma"
                className="h-11 w-full rounded-lg border border-line bg-card px-3.5 text-[14.5px] text-ink placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-[13.5px] font-heading font-semibold text-ink">
                Work email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="h-11 w-full rounded-lg border border-line bg-card px-3.5 text-[14.5px] text-ink placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-[13.5px] font-heading font-semibold text-ink">
                Password
              </label>
              <div className="relative flex items-center">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 w-full rounded-lg border border-line bg-card px-3.5 pr-14 text-[14.5px] text-ink placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-3 p-1.5 text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded transition-colors select-none"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className={`text-[12.5px] transition-colors ${password.length === 0 ? "text-faint" : isValidPassword ? "text-ok" : "text-warn"}`}>
                Use 8+ characters with a number.
              </p>
            </div>

            <Button
              type="submit"
              size="lg"
              variant="primary"
              isLoading={loading}
              className="w-full justify-center"
            >
              <span>Create account</span>
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </form>

          <p className="text-[12px] text-faint text-center pt-2">
            By continuing you agree to the Terms and Privacy Policy.
          </p>
        </div>

        <div className="text-[12px] text-faint text-center">
          © ContinuityX Platform v3.2
        </div>
      </div>

      {/* RIGHT COLUMN: 54% (--tint decorative proof panel) */}
      <div className="hidden lg:flex flex-1 bg-tint p-10 lg:p-16 flex-col justify-center items-center select-none" aria-hidden="true">
        <div className="max-w-[440px] space-y-6">
          <Chip variant="neutral" dot size="sm">
            Proof-carrying handovers
          </Chip>

          <h2 className="text-[30px] font-heading font-bold text-ink tracking-tight max-w-[19ch] leading-[1.15]">
            Project knowledge that stays when people leave.
          </h2>

          <p className="text-[16px] text-muted leading-relaxed">
            Every claim is traced to its source, checked, and sealed, so the
            next owner inherits facts rather than guesses.
          </p>

          {/* White Proof Card with 3 dashed rows */}
          <div className="rounded-xl border border-line bg-card p-5 shadow-soft space-y-4">
            {/* Row 1: Claim */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-semibold text-brand uppercase bg-tint px-1.5 py-0.5 rounded">
                  CLAIM
                </span>
                <span className="text-[13.5px] font-semibold text-ink">
                  Attendance uses RFID scan plus face match
                </span>
              </div>
              <div className="font-mono text-[11px] text-faint pl-12">
                design_doc.pdf · p.3
              </div>
            </div>

            <div className="border-t border-dashed border-line" />

            {/* Row 2: Gate */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-semibold text-ok uppercase bg-ok-tint px-1.5 py-0.5 rounded">
                  GATE
                </span>
                <span className="text-[13.5px] font-semibold text-ink">
                  4 of 4 evidence checks passed
                </span>
              </div>
              <div className="font-mono text-[11px] text-faint pl-12">
                quote matched · reviewer accepted
              </div>
            </div>

            <div className="border-t border-dashed border-line" />

            {/* Row 3: Seal */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-semibold text-brand uppercase bg-tint px-1.5 py-0.5 rounded">
                  SEAL
                </span>
                <span className="text-[13.5px] font-semibold text-ink">
                  Handover receipt issued
                </span>
              </div>
              <div className="font-mono text-[11px] text-faint pl-12">
                sha256 · 9f2c...b71a
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
