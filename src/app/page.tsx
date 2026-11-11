import Link from "next/link";
import { ArrowRight, ShieldCheck, FileCheck, Layers } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-card">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-primary">
            <ShieldCheck className="h-6 w-6" />
            <span>ContinuityX</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link
              href="/login"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
            >
              Sign In
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="container mx-auto px-4 py-20 text-center sm:px-6">
          <div className="mx-auto max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs font-semibold text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Proof-Carrying Handover Platform
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
              Intelligence That Keeps Projects Moving.
            </h1>
            <p className="text-lg text-muted-foreground sm:text-xl">
              People may leave, but project knowledge should stay. ContinuityX
              reconstructs project truth from authorized documents, verifies
              claims with 4-gate evidence checking, resolves conflicts, and generates
              cryptographically verifiable handovers.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-base font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
              >
                Open Workspace <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="/api/health"
                className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-6 py-3 text-base font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                System Health Check
              </a>
            </div>
          </div>
        </section>

        <section className="border-t bg-muted/30 py-16">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="grid gap-8 md:grid-cols-3">
              <div className="rounded-lg border bg-card p-6 shadow-sm">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <FileCheck className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-lg">Evidence Before Confidence</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Every extracted decision, task, and dependency is linked to exact source
                  locations with strict 4-gate verification.
                </p>
              </div>
              <div className="rounded-lg border bg-card p-6 shadow-sm">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Layers className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-lg">Deterministic Conflict Engine</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Inconsistencies and status contradictions are surfaced automatically with
                  temporal audit rules and human review.
                </p>
              </div>
              <div className="rounded-lg border bg-card p-6 shadow-sm">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-lg">SHA-256 Handover Receipt</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Approved handovers produce a canonical snapshot and tamper-evident
                  cryptographic receipt for total auditability.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t bg-card py-6 text-center text-sm text-muted-foreground">
        <p>ContinuityX — Locked V3.2 Platform. Phase 0 Foundation.</p>
      </footer>
    </div>
  );
}
