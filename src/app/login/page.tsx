"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Logo } from "@/components/ui/logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Check if user is already signed in
  useEffect(() => {
    let isMounted = true;
    fetch("/api/auth/me")
      .then((res) => {
        if (res.ok && isMounted) {
          router.replace("/dashboard");
        }
      })
      .catch(() => {
        // Not signed in; stay on login page
      });
    return () => {
      isMounted = false;
    };
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "Invalid email or password.");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function setDemoUser(demoEmail: string, demoPass: string) {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  }

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col lg:flex-row antialiased selection:bg-brand/20 selection:text-brand overflow-x-hidden">
      {/* =========================================================================
          LEFT SIDE (Desktop): Brand Identity, Headline, Narrative & Proof Chain
          ========================================================================= */}
      <div className="hidden lg:flex w-[52%] xl:w-[50%] bg-soft-section border-r border-line p-10 lg:p-14 xl:p-16 flex-col justify-between relative overflow-hidden select-none">
        {/* Subtle background ambient graphic */}
        <div
          className="absolute -top-24 -left-24 w-96 h-96 bg-brand/5 dark:bg-brand/10 rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        {/* Top: Logo */}
        <div className="relative z-10">
          <Logo size="lg" href="/" />
        </div>

        {/* Center: Hero Narrative & Evidence-Backed Handover Visual */}
        <div className="my-auto py-8 relative z-10 max-w-[500px]">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-tint border border-line text-[12.5px] font-mono font-medium text-brand dark:text-[#a5b4fc] mb-6">
            <span className="w-2 h-2 rounded-full bg-brand dark:bg-[#818cf8] animate-pulse" />
            Proof-Carrying Knowledge Platform
          </div>

          <h1 className="text-[34px] xl:text-[40px] font-heading font-extrabold text-ink tracking-[-0.03em] leading-[1.14]">
            Your project knowledge,
            <br />
            never lost.
          </h1>

          <p className="mt-4 text-[15.5px] xl:text-[16.5px] text-muted leading-[1.65]">
            Access verified project knowledge, trace decisions to their sources,
            and create reliable team handovers.
          </p>

          {/* Connected Project Knowledge Visual Element */}
          <div className="mt-8 rounded-xl border border-line bg-card p-5 shadow-soft space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-line text-[12px]">
              <span className="font-mono text-muted uppercase tracking-wider font-semibold">
                Traceable Evidence Chain
              </span>
              <span className="inline-flex items-center gap-1 font-mono text-[11.5px] font-medium text-ok bg-ok-tint px-2 py-0.5 rounded">
                <CheckCircle2 className="h-3 w-3" />
                Deterministic
              </span>
            </div>

            {/* Row 1: Source Document */}
            <div className="flex items-start gap-3">
              <div className="h-7 w-7 rounded-md bg-tint flex items-center justify-center shrink-0 mt-0.5 text-brand">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold text-ink truncate">
                  architecture_spec_v2.pdf · p. 4
                </div>
                <div className="text-[12px] font-mono text-muted">
                  Source indexed · MD5 verified
                </div>
              </div>
            </div>

            {/* Row 2: Verification Gate */}
            <div className="flex items-start gap-3 pl-3.5 relative">
              <div
                className="absolute left-[20px] -top-3 w-[1.5px] h-3 bg-line"
                aria-hidden="true"
              />
              <div className="h-7 w-7 rounded-md bg-ok-tint flex items-center justify-center shrink-0 mt-0.5 text-ok -ml-3.5">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold text-ink">
                  4 of 4 verification gates passed
                </div>
                <div className="text-[12px] text-muted">
                  Direct quote confirmed · Semantic consensus
                </div>
              </div>
            </div>

            {/* Row 3: Sealed Handover */}
            <div className="flex items-start gap-3 pl-3.5 relative">
              <div
                className="absolute left-[20px] -top-3 w-[1.5px] h-3 bg-line"
                aria-hidden="true"
              />
              <div className="h-7 w-7 rounded-md bg-tint flex items-center justify-center shrink-0 mt-0.5 text-brand -ml-3.5">
                <Lock className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold text-ink">
                  Tamper-evident handover receipt
                </div>
                <div className="text-[12px] font-mono text-muted">
                  SHA-256: 9f2c1a7d...e41a0b
                </div>
              </div>
            </div>
          </div>

          {/* Micro trust indicators */}
          <div className="mt-6 flex flex-wrap items-center gap-4 text-[12.5px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-ok" />
              Server-enforced RBAC
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand" />
              Audit log integrity
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-ink" />
              Zero AI hallucinations
            </span>
          </div>
        </div>

        {/* Bottom: Version & Copyright */}
        <div className="relative z-10 text-[12.5px] text-muted flex items-center justify-between">
          <span>© ContinuityX Platform v3.2</span>
          <span>Enterprise Proof System</span>
        </div>
      </div>

      {/* =========================================================================
          RIGHT SIDE: Focused Login Form & Mobile Navigation
          ========================================================================= */}
      <div className="w-full lg:w-[48%] xl:w-[50%] bg-card flex flex-col justify-between p-6 sm:p-10 lg:p-14 min-h-screen">
        {/* Top Header: Mobile Logo & Theme Toggle */}
        <div className="flex items-center justify-between">
          <div className="lg:hidden">
            <Logo size="md" href="/" />
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>

        {/* Center: Focused Login Form Container (max-w-[392px]) */}
        <div className="w-full max-w-[392px] mx-auto my-auto py-8 space-y-6">
          {/* Header */}
          <div className="space-y-1.5">
            <h2 className="text-[28px] sm:text-[30px] font-heading font-extrabold text-ink tracking-tight leading-tight">
              Sign in to ContinuityX
            </h2>
            <p className="text-[14px] text-muted">
              Enter your work email and password to access your workspaces.
            </p>
          </div>

          {/* Segmented Control: Sign In / Create Account */}
          <div className="grid grid-cols-2 p-1 bg-bg border border-line rounded-lg text-center select-none">
            <button
              type="button"
              className="py-2 text-[13.5px] font-heading font-semibold rounded-md bg-card text-ink shadow-sm"
            >
              Sign in
            </button>
            <Link
              href="/register"
              className="py-2 text-[13.5px] font-heading font-semibold rounded-md text-muted hover:text-ink transition-colors"
            >
              Create account
            </Link>
          </div>

          {/* Error Alert Box */}
          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="flex items-start gap-2.5 rounded-lg border border-bad/30 bg-bad-tint p-3.5 text-[13.5px] text-bad font-medium"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4" noValidate={false}>
            {/* Email Address */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-[13.5px] font-heading font-semibold text-ink"
              >
                Work email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="h-11 w-full rounded-lg border border-line bg-bg dark:bg-[#101626] px-3.5 text-[14.5px] text-ink placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-colors"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-[13.5px] font-heading font-semibold text-ink"
                >
                  Password
                </label>
              </div>
              <div className="relative flex items-center">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 w-full rounded-lg border border-line bg-bg dark:bg-[#101626] px-3.5 pr-14 text-[14.5px] text-ink placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-colors"
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
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between text-[13px] pt-1">
              <label className="flex items-center gap-2 text-muted cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-line text-brand focus:ring-brand"
                />
                <span>Remember me</span>
              </label>
              <a
                href="mailto:support@continuityx.demo?subject=ContinuityX%20Password%20Reset%20Request"
                className="font-heading font-semibold text-brand hover:underline transition-colors"
              >
                Forgot password?
              </a>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              size="lg"
              variant="primary"
              isLoading={loading}
              className="w-full min-h-[44px] justify-center text-[15px] font-semibold mt-2 shadow-sm"
            >
              <span>Sign in</span>
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </form>

          {/* Registration Link Prompt */}
          <div className="text-center text-[13.5px] text-muted pt-1">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-heading font-semibold text-brand hover:underline transition-colors"
            >
              Create account
            </Link>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center pt-2">
            <div className="w-full border-t border-line" />
            <span className="absolute bg-card px-3 text-[12px] font-mono text-muted uppercase tracking-wider">
              Or use demo role
            </span>
          </div>

          {/* Quick Demo Accounts */}
          <div className="space-y-2 pt-1">
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => setDemoUser("lead@continuityx.demo", "DemoPassword123!")}
                className="flex-1 px-3 py-2 rounded-lg border border-line bg-bg hover:bg-tint hover:border-brand/40 text-left transition-colors select-none group"
              >
                <div className="text-[12.5px] font-heading font-bold text-ink group-hover:text-brand">
                  Arjun Mehta
                </div>
                <div className="text-[11.5px] text-muted">Tech Lead · Owner</div>
              </button>
              <button
                type="button"
                onClick={() => setDemoUser("member@continuityx.demo", "DemoPassword123!")}
                className="flex-1 px-3 py-2 rounded-lg border border-line bg-bg hover:bg-tint hover:border-brand/40 text-left transition-colors select-none group"
              >
                <div className="text-[12.5px] font-heading font-bold text-ink group-hover:text-brand">
                  Riya Sharma
                </div>
                <div className="text-[11.5px] text-muted">Engineer · Reviewer</div>
              </button>
            </div>
          </div>

          {/* Enterprise Security Disclaimer */}
          <p className="text-[12px] text-muted/80 text-center pt-3 leading-relaxed">
            By signing in, you acknowledge that project data access is governed
            by server-side role permissions and audit logging.
          </p>
        </div>

        {/* Footer info */}
        <div className="text-[12px] text-muted text-center pt-4">
          ContinuityX Platform · Enterprise Knowledge Continuity
        </div>
      </div>
    </div>
  );
}
