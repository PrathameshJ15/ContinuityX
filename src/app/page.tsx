import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Logo } from "@/components/ui/logo";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col font-sans antialiased selection:bg-brand/20 selection:text-brand overflow-x-hidden">
      {/* 1. HEADER */}
      <header className="w-full bg-card/95 border-b border-line sticky top-0 z-50 backdrop-blur-sm">
        <div className="max-w-[1120px] mx-auto h-20 px-6 sm:px-8 flex items-center justify-between">
          {/* Logo / Brand Name */}
          <Logo size="md" href="/" className="min-h-[44px]" />

          {/* Navigation Links */}
          <nav className="hidden min-[901px]:flex items-center gap-8 text-[14px] text-muted font-normal">
            <a
              href="#verification"
              className="hover:text-ink transition-colors min-h-[44px] inline-flex items-center"
            >
              Verification
            </a>
            <a
              href="#conflicts"
              className="hover:text-ink transition-colors min-h-[44px] inline-flex items-center"
            >
              Conflicts
            </a>
            <a
              href="#receipt"
              className="hover:text-ink transition-colors min-h-[44px] inline-flex items-center"
            >
              Receipt
            </a>
            <a
              href="#limits"
              className="hover:text-ink transition-colors min-h-[44px] inline-flex items-center"
            >
              Limits
            </a>
          </nav>

          {/* Right Action */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-[6px] bg-[#111827] dark:bg-card dark:border dark:border-line px-4 py-2 text-[13px] font-medium text-white dark:text-ink hover:bg-[#1F2937] dark:hover:bg-bg transition-colors shadow-sm min-h-[44px] min-w-[44px]"
            >
              Open the demo
            </Link>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="pt-16 sm:pt-20 pb-16 sm:pb-20 px-4 sm:px-8 bg-bg">
        <div className="max-w-[1120px] mx-auto grid grid-cols-1 min-[901px]:grid-cols-12 gap-10 min-[901px]:gap-16 items-start">
          {/* Left Column: Headline, subtext, action buttons */}
          <div className="min-[901px]:col-span-7 pt-2">
            <h1 className="text-[34px] sm:text-[48px] min-[901px]:text-[56px] leading-[1.08] font-heading font-extrabold text-ink tracking-[-0.03em]">
              Every claim in the
              <br />
              handover shows
              <br />
              its source.
            </h1>

            <p className="mt-7 text-[16px] text-muted leading-[1.65] max-w-[480px]">
              ContinuityX reconstructs project knowledge from your documents,
              checks each claim against the original text, and shares the
              handover only after a person approves it.
            </p>

            {/* Buttons */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-[6px] bg-[#2563EB] dark:bg-brand px-5 py-2.5 text-[14px] font-medium text-white hover:bg-[#1D4ED8] dark:hover:bg-brand-dark transition-colors shadow-sm min-h-[44px]"
              >
                Open the demo
              </Link>
              <a
                href="#verification"
                className="inline-flex items-center justify-center rounded-[6px] border border-line bg-card px-5 py-2.5 text-[14px] font-medium text-ink hover:bg-bg transition-colors shadow-sm min-h-[44px]"
              >
                How verification works
              </a>
            </div>

            {/* Micro-copy below buttons (minimum 13px) */}
            <p className="mt-4 text-[13px] text-muted/80">
              Built by Team DreamToDone for a hackathon. All demo data is
              synthetic.
            </p>
          </div>

          {/* Right Column: Review Screen Claim Card */}
          <div className="min-[901px]:col-span-5 w-full">
            <div className="bg-card rounded-[12px] border border-line shadow-soft p-6 text-left w-full max-w-[460px] mx-auto min-[901px]:ml-auto min-[901px]:mr-0">
              {/* Card Header */}
              <div className="flex items-center justify-between pb-3">
                <span className="text-[13px] text-muted">
                  Claim · Decision
                </span>
                <span className="inline-flex items-center text-[13px] font-medium text-[#059669] dark:text-[#6ee7b7] bg-[#ecfdf5] dark:bg-[#064e3b]/40 border border-[#a7f3d0] dark:border-[#059669]/60 px-2.5 py-0.5 rounded-full">
                  ✓ Verified
                </span>
              </div>

              {/* Title & Technical Attributes */}
              <h3 className="mt-1 text-[15px] font-bold text-ink leading-snug">
                Use session-based login for the web client.
              </h3>
              <p className="mt-1 text-[13px] font-mono text-muted">
                (Authentication module, selected_technology, session-based login)
              </p>

              {/* Source Document Reference */}
              <p className="mt-4 text-[13px] text-muted">
                Source:{" "}
                <span className="font-mono text-ink">
                  meeting_notes_03.docx
                </span>{" "}
                · page 2
              </p>

              {/* Quoted Excerpt Box */}
              <div className="mt-2 rounded-[6px] bg-bg dark:bg-[#101626] border border-line p-2.5 text-[13px] font-mono text-ink">
                ...agreed to keep{" "}
                <span className="bg-[#dbeafe] text-[#1e40af] dark:bg-[#1e3a8a]/70 dark:text-[#bfdbfe] px-1.5 py-0.5 rounded font-medium">
                  sessions for the web client
                </span>
                ...
              </div>

              {/* 4-Gate Breakdown Table (Hero card body text 14px) */}
              <div className="mt-4 border-t border-line text-[14px] divide-y divide-line">
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-muted">1 · Source exists</span>
                  <span className="font-mono text-ink">Found</span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-muted">2 · Quote exists</span>
                  <span className="font-mono text-ink">Exact match</span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-muted">3 · Semantic support</span>
                  <span className="font-mono text-ink">Supports</span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-muted">4 · Contradiction scan</span>
                  <span className="font-mono text-ink">None found</span>
                </div>
              </div>

              {/* Card Footer */}
              <div className="mt-3 pt-3 border-t border-line flex items-center justify-between text-[13px] text-muted">
                <span>Review state: Accepted</span>
                <span>Evidence status is separate</span>
              </div>
            </div>

            {/* Caption beneath card */}
            <p className="mt-3 text-[13px] text-muted/80 text-center">
              Sample project, synthetic data. Illustration of the review screen.
            </p>
          </div>
        </div>
      </section>

      {/* 3. VERIFICATION SECTION */}
      <section
        id="verification"
        className="pt-24 pb-20 px-6 sm:px-8 bg-bg border-t border-line"
      >
        <div className="max-w-[1120px] mx-auto">
          {/* Top Two-Column Grid */}
          <div className="grid grid-cols-1 min-[901px]:grid-cols-12 gap-12 min-[901px]:gap-16 items-start">
            {/* Left: Tag, Heading, and Description */}
            <div className="min-[901px]:col-span-5">
              <div className="text-[13px] font-mono font-semibold tracking-wider text-brand uppercase mb-3">
                VERIFICATION
              </div>
              <h2 className="text-[32px] sm:text-[38px] font-heading font-extrabold text-ink leading-[1.14] tracking-tight">
                Four checks decide the
                <br />
                status. Model
                <br />
                confidence does not.
              </h2>
              <p className="mt-5 text-[14px] text-muted leading-[1.65] max-w-[420px]">
                Each claim is checked against the original text before it can be
                called verified. The status comes from fixed rules. Accepting a
                claim that is not verified requires a written reason.
              </p>
            </div>

            {/* Right: Four numbered verification stages */}
            <div className="min-[901px]:col-span-7 space-y-6 pt-2">
              {/* 01 */}
              <div className="border-b border-line pb-5">
                <div className="flex items-start gap-4">
                  <span className="font-mono text-[14px] text-muted pt-0.5">
                    01
                  </span>
                  <div>
                    <h3 className="text-[16px] font-bold text-ink">
                      Source exists
                    </h3>
                    <p className="mt-1 text-[14px] text-muted leading-normal">
                      The cited document and location are in the project.
                    </p>
                  </div>
                </div>
              </div>

              {/* 02 */}
              <div className="border-b border-line pb-5">
                <div className="flex items-start gap-4">
                  <span className="font-mono text-[14px] text-muted pt-0.5">
                    02
                  </span>
                  <div>
                    <h3 className="text-[16px] font-bold text-ink">
                      Quote exists
                    </h3>
                    <p className="mt-1 text-[14px] text-muted leading-normal">
                      The excerpt is found in the source text. A changed number or a
                      flipped negation fails the match.
                    </p>
                  </div>
                </div>
              </div>

              {/* 03 */}
              <div className="border-b border-line pb-5">
                <div className="flex items-start gap-4">
                  <span className="font-mono text-[14px] text-muted pt-0.5">
                    03
                  </span>
                  <div>
                    <h3 className="text-[16px] font-bold text-ink">
                      Semantic support
                    </h3>
                    <p className="mt-1 text-[14px] text-muted leading-normal">
                      A separate AI judge, run at temperature 0, sees only the
                      claim and the excerpt.
                    </p>
                  </div>
                </div>
              </div>

              {/* 04 */}
              <div className="pb-1">
                <div className="flex items-start gap-4">
                  <span className="font-mono text-[14px] text-muted pt-0.5">
                    04
                  </span>
                  <div>
                    <h3 className="text-[16px] font-bold text-ink">
                      Contradiction scan
                    </h3>
                    <p className="mt-1 text-[14px] text-muted leading-normal">
                      Other claims about the same entity and attribute are
                      compared.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Five Status Cards (Status cards text 14px) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 min-[901px]:grid-cols-5 gap-3.5 mt-14">
            {/* 1. Verified */}
            <div className="rounded-[8px] border border-line bg-card p-4 shadow-sm">
              <span className="inline-flex items-center text-[14px] font-medium text-[#065f46] dark:text-[#6ee7b7] bg-[#ecfdf5] dark:bg-[#064e3b]/40 border border-[#a7f3d0] dark:border-[#059669]/60 px-2.5 py-0.5 rounded">
                ✓ Verified
              </span>
              <p className="mt-2.5 text-[14px] text-muted leading-snug">
                Supported by the excerpt, with no open conflict.
              </p>
            </div>

            {/* 2. Weak support */}
            <div className="rounded-[8px] border border-line bg-card p-4 shadow-sm">
              <span className="inline-flex items-center text-[14px] font-medium text-[#92400e] dark:text-[#fde68a] bg-[#fef3c7] dark:bg-[#78350f]/40 border border-[#fde68a] dark:border-[#d97706]/60 px-2.5 py-0.5 rounded">
                ~ Weak support
              </span>
              <p className="mt-2.5 text-[14px] text-muted leading-snug">
                Related to the claim, but not enough.
              </p>
            </div>

            {/* 3. Conflicting */}
            <div className="rounded-[8px] border border-line bg-card p-4 shadow-sm">
              <span className="inline-flex items-center text-[14px] font-medium text-[#991b1b] dark:text-[#fca5a5] bg-[#fee2e2] dark:bg-[#7f1d1d]/40 border border-[#fecaca] dark:border-[#ef4444]/60 px-2.5 py-0.5 rounded">
                ≠ Conflicting
              </span>
              <p className="mt-2.5 text-[14px] text-muted leading-snug">
                Another source disagrees.
              </p>
            </div>

            {/* 4. Unverified */}
            <div className="rounded-[8px] border border-line bg-card p-4 shadow-sm">
              <span className="inline-flex items-center text-[14px] font-medium text-[#374151] dark:text-[#cbd5e1] bg-[#f3f4f6] dark:bg-[#1e293b] border border-[#d1d5db] dark:border-[#475569] px-2.5 py-0.5 rounded">
                ○ Unverified
              </span>
              <p className="mt-2.5 text-[14px] text-muted leading-snug">
                The source or quote could not be found.
              </p>
            </div>

            {/* 5. Unknown */}
            <div className="rounded-[8px] border border-line bg-card p-4 shadow-sm">
              <span className="inline-flex items-center text-[14px] font-medium text-[#3730a3] dark:text-[#c7d2fe] bg-[#eef2ff] dark:bg-[#312e81]/40 border border-[#c7d2fe] dark:border-[#6366f1]/60 px-2.5 py-0.5 rounded">
                ? Unknown
              </span>
              <p className="mt-2.5 text-[14px] text-muted leading-snug">
                The evidence cannot settle it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. CONFLICTS SECTION */}
      <section
        id="conflicts"
        className="py-16 sm:py-20 px-4 sm:px-8 bg-soft-section border-y border-line"
      >
        <div className="max-w-[1120px] mx-auto">
          {/* Header */}
          <div className="text-[13px] font-mono font-semibold tracking-wider text-brand uppercase mb-2">
            CONFLICTS
          </div>
          <h2 className="text-[28px] sm:text-[38px] font-heading font-extrabold text-ink leading-tight tracking-tight">
            When sources disagree, both are
            <br className="hidden sm:inline" /> shown.
          </h2>
          <p className="mt-3 text-[14px] text-muted max-w-2xl leading-normal">
            ContinuityX never picks a winner. Conflicts between undated sources
            stay open until a reviewer decides.
          </p>

          {/* Two Side-by-Side Cards (Stack at 900px and below) */}
          <div className="grid grid-cols-1 min-[901px]:grid-cols-2 gap-4 mt-8">
            {/* Card A */}
            <div className="bg-card rounded-[8px] p-5 border border-line shadow-sm">
              <div className="text-[13px] font-mono text-muted">
                Source A · tasks.csv · row 14
              </div>
              <div className="mt-1.5 text-[15px] font-bold text-ink">
                Fix token refresh bug
              </div>
              <div className="mt-1 text-[14px] text-muted">Owner: Asha</div>
            </div>

            {/* Card B */}
            <div className="bg-card rounded-[8px] p-5 border border-line shadow-sm">
              <div className="text-[13px] font-mono text-muted">
                Source B · meeting_notes_05.docx · page 1
              </div>
              <div className="mt-1.5 text-[15px] font-bold text-ink">
                Fix token refresh bug
              </div>
              <div className="mt-1 text-[14px] text-muted">Owner: Rohan</div>
            </div>
          </div>

          {/* Conflict resolution note below cards */}
          <div className="mt-5 flex flex-wrap items-center gap-2.5 text-[13px]">
            <span className="inline-flex items-center text-[13px] font-medium text-[#991b1b] dark:text-[#fca5a5] bg-[#fee2e2] dark:bg-[#7f1d1d]/40 border border-[#fecaca] dark:border-[#ef4444]/60 px-2 py-0.5 rounded">
              ≠ Conflicting
            </span>
            <span className="text-muted">
              A reviewer can choose one claim, keep both with a reason, or ask for
              clarification. Every decision is audited.
            </span>
          </div>

          <p className="mt-2 text-[13px] text-muted/80">Sample data, synthetic.</p>
        </div>
      </section>

      {/* 5. HANDOVER SECTION */}
      <section id="receipt" className="py-16 sm:py-24 px-4 sm:px-8 bg-bg border-t border-line">
        <div className="max-w-[1120px] mx-auto grid grid-cols-1 min-[901px]:grid-cols-12 gap-10 min-[901px]:gap-16 items-start">
          {/* Left: Explanation */}
          <div className="min-[901px]:col-span-6 pt-2">
            <div className="text-[13px] font-mono font-semibold tracking-wider text-brand uppercase mb-3">
              HANDOVER
            </div>
            <h2 className="text-[28px] sm:text-[38px] font-heading font-extrabold text-ink leading-[1.14] tracking-tight">
              Approved by a person,
              <br />
              then receipted.
            </h2>
            <p className="mt-5 text-[14px] text-muted leading-[1.65] max-w-[440px]">
              Only accepted claims enter the handover. Approval stores a canonical
              snapshot with a SHA-256 hash, chained to the previous version. The
              PDF is generated from that stored snapshot.
            </p>
          </div>

          {/* Right: Handover Receipt Sample Card */}
          <div className="min-[901px]:col-span-6 w-full">
            <div className="bg-receipt-bg rounded-[8px] p-6 border border-line text-[13px] w-full max-w-[460px] mx-auto min-[901px]:ml-auto min-[901px]:mr-0 shadow-sm">
              <div className="text-[14px] font-bold text-ink mb-4">
                Handover receipt (sample)
              </div>

              <div className="space-y-2.5 font-mono text-[13px] text-ink">
                <div className="flex justify-between">
                  <span className="text-muted">Version</span>
                  <span className="text-ink font-semibold">3</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Snapshot SHA-256</span>
                  <span className="text-ink">9f2c1a7d...e41a0b</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Previous receipt</span>
                  <span className="text-ink">7be04c11...c93d52</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Approved by</span>
                  <span className="text-ink">Reviewer (sample)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Check</span>
                  <span className="text-ink">
                    Recomputed from stored snapshot
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-3 text-[13px] text-muted leading-normal max-w-[460px] mx-auto min-[901px]:ml-auto min-[901px]:mr-0">
              A tamper-evident integrity fingerprint. It is not a digital
              signature and does not prove who approved.
            </p>
          </div>
        </div>
      </section>

      {/* 6. HONEST SCOPE SECTION */}
      <section
        id="limits"
        className="pt-16 pb-24 px-6 sm:px-8 bg-bg border-t border-line"
      >
        <div className="max-w-[1120px] mx-auto">
          <div className="text-[13px] font-mono font-semibold tracking-wider text-brand uppercase mb-3">
            HONEST SCOPE
          </div>
          <h2 className="text-[32px] sm:text-[38px] font-heading font-extrabold text-ink leading-tight tracking-tight mb-8">
            What it does, and what it does not.
          </h2>

          {/* Two-Column Comparison Table (Stack at 900px and below) */}
          <div className="w-full">
            {/* Table Header */}
            <div className="grid grid-cols-1 min-[901px]:grid-cols-2 gap-8 pb-3 border-b border-line text-[14px] font-bold text-ink">
              <div>Built in</div>
              <div>Limits</div>
            </div>

            {/* Rows (minimum 13px) */}
            <div className="divide-y divide-line text-[13px] text-ink">
              <div className="grid grid-cols-1 min-[901px]:grid-cols-2 gap-4 min-[901px]:gap-8 py-3.5">
                <div>Owner, reviewer and viewer roles checked on the server</div>
                <div className="text-muted min-[901px]:text-ink">No OCR: scanned documents are flagged, not read</div>
              </div>
              <div className="grid grid-cols-1 min-[901px]:grid-cols-2 gap-4 min-[901px]:gap-8 py-3.5">
                <div>Unauthorised projects return not found</div>
                <div className="text-muted min-[901px]:text-ink">The AI judge can be wrong, so reviewers decide</div>
              </div>
              <div className="grid grid-cols-1 min-[901px]:grid-cols-2 gap-4 min-[901px]:gap-8 py-3.5">
                <div>Audit log of review and approval actions</div>
                <div className="text-muted min-[901px]:text-ink">Extraction and judging use the same AI vendor</div>
              </div>
              <div className="grid grid-cols-1 min-[901px]:grid-cols-2 gap-4 min-[901px]:gap-8 py-3.5">
                <div>Q&A answers only from approved claims, or refuses</div>
                <div className="text-muted min-[901px]:text-ink">PDF, DOCX and CSV only</div>
              </div>
              <div className="grid grid-cols-1 min-[901px]:grid-cols-2 gap-4 min-[901px]:gap-8 py-3.5">
                <div className="hidden min-[901px]:block" />
                <div className="text-muted min-[901px]:text-ink">Radar rules and score weights are unvalidated heuristics</div>
              </div>
              <div className="grid grid-cols-1 min-[901px]:grid-cols-2 gap-4 min-[901px]:gap-8 py-3.5">
                <div className="hidden min-[901px]:block" />
                <div className="text-muted min-[901px]:text-ink">Tested only on a small synthetic benchmark</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FOOTER / FINAL CTA */}
      <footer className="w-full bg-footer-bg text-white py-16 px-6 sm:px-8 mt-auto border-t border-transparent dark:border-line">
        <div className="max-w-[1120px] mx-auto flex flex-col min-[901px]:flex-row items-start min-[901px]:items-center justify-between gap-8">
          {/* Left: Brand Logo, Final Headline & Subtext */}
          <div>
            <Logo size="md" textColor="text-white" href="/" className="mb-5" />
            <h2 className="text-[28px] sm:text-[32px] font-heading font-extrabold text-white tracking-tight">
              Intelligence That Keeps
              <br />
              Projects Moving.
            </h2>
            <p className="mt-2 text-[14px] text-gray-300 dark:text-gray-400">
              People may leave, but project knowledge should stay.
            </p>
          </div>

          {/* Right: Open the demo button */}
          <div className="flex flex-col items-start min-[901px]:items-end">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-[6px] bg-[#2563EB] dark:bg-brand px-6 py-2.5 text-[14px] font-medium text-white hover:bg-[#1D4ED8] dark:hover:bg-brand-dark transition-colors shadow-sm min-h-[44px]"
            >
              Open the demo
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
