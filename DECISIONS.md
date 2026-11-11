# Architecture & Scope Decisions

Append meaningful changes to architecture, stack, scope, data model or
security behaviour.

## Required format

`[YYYY-MM-DD] | Change | Reason | Impact`

## Locked decisions

-   \[2026-11-12\] \| V3.1 scope locked \| Move from repeated R&D into
    engineering \| P0-A mandatory before P0-B; P1/P2 deferred.
-   \[2026-11-12\] \| Proof-Carrying Handover is core differentiator \|
    Important claims must trace to evidence and reviewer approval \|
    Claim/evidence/verification/review/receipt lifecycle is central.
-   \[2026-11-12\] \| Claims use triples \| Enable consistent
    subject/attribute comparison \| `(subject, attribute, value)`.
-   \[2026-11-12\] \| Verification status is rule-derived \| Model
    confidence is not proof \| Status comes from source, quote, semantic
    and contradiction outcomes.
-   \[2026-11-12\] \| No-date chronology rule \| Avoid unsupported
    supersession assumptions \| Undated conflicts remain for human
    review.
-   \[2026-11-12\] \| SHA-256 hashes canonical approved snapshot \|
    Avoid circular PDF hashing \| Store hash, approver, timestamp and
    version; hash is not a digital signature.

## Change control

Only change locked scope for technical impossibility or deadline-driven
cuts. Explain reason and impact. Append a dated decision; do not
silently rewrite locked decisions.

---

## V3.2 clarifications

These resolve ambiguities in the locked V3.1 documents. They add no P0-A features; they make existing rules precise and testable.

- [2026-11-12] | Status algorithm: first-match table; `NEUTRAL` -> `WEAK_SUPPORT` only if the excerpt contains the subject or alias, else `UNKNOWN`; judge failure -> `UNKNOWN` | V3.1 said "depending on evidence" without a rule | Deterministic, testable status mapping (see SPEC.md).
- [2026-11-12] | Evidence status and review state are separate fields | Prevent unverified claims from looking approved | Handover shows both; non-VERIFIED acceptance needs a reason.
- [2026-11-12] | Controlled attribute vocabulary, value normalisation and per-attribute cardinality | Conflict detection fails silently without them | Conflict recall depends on normalisation; measured in benchmark.
- [2026-11-12] | Document `sourceDate` with `sourceDateBasis`; file metadata and upload time are not reliable | No-date rule needs a defined date source | Optional document date field at upload.
- [2026-11-12] | Roles set to OWNER, REVIEWER, VIEWER | Incoming member needs read-only access to approved handover and Q&A | Permissions matrix in TECH_DESIGN.md.
- [2026-11-12] | Snapshot canonicalisation, immutable rows, `previousReceiptHash` chain, Verify Receipt design | Make the hash reproducible and tamper claims honest | New SPEC.md.
- [2026-11-12] | Q&A returns refusal without a model call when nothing is retrieved; cited claim IDs validated server-side | Reduce invented answers and second-order injection | Hardened Q&A flow.
- [2026-11-12] | Benchmark uses DEV and TEST sets; labels frozen before TEST run; baseline run early | Avoid tuning to the test and weak comparisons | DEMO_AND_BENCHMARK.md V3.2 rules.
- [2026-11-12] | Auth, storage, PDF library, processing pattern and Gemini models are chosen and recorded in Phase 0; skeleton deployed in Phase 0 | Avoid late deployment and serverless surprises | TECH_DESIGN.md.
- [2026-11-12] | Added ExtractionRun model and extra Document, Claim, Verification, Entity, Conflict fields | Needed for caching, provenance, reproducibility and dates | TECH_DESIGN.md.
- [2026-11-12] | Added AGENTS.md, SPEC.md, DEMO_AND_BENCHMARK.md, DEMO_AND_BENCHMARK.md, PROGRESS.md | Guide AI assistants, define receipt and dataset, plan the demo, track status | No scope change.
- [2026-11-12] | Consolidated 20 markdown files into 8 | Fewer files reduce drift, contradictions and AI context load | Content unchanged; file references updated to SPEC.md, TECH_DESIGN.md, PLAN_AND_TESTING.md, DEMO_AND_BENCHMARK.md.

---

## Phase 0 Autonomous Decisions

- [2026-11-12] | Auth Approach (autonomous): NextAuth.js / Auth.js with Credentials & JWT session | Chosen to enable server-side session checks (requireUser), simple demo logins without external identity dependencies, and 100% offline hermetic unit tests. Rejected: Clerk/Supabase Auth (external SaaS dependency, vendor lock-in, fails offline test requirement). | Clean session validation without exposing client credentials.
- [2026-11-12] | Private File Storage (autonomous): Pluggable StorageProvider with LocalDiskStorage (dev/tests) and S3/R2 client (prod) | Local disk storage keeps dev/testing fast, hermetic, and cost-free, while S3/R2 with signed URLs satisfies the strict private file storage requirement in production. Rejected: Vercel Blob (public by default or requires custom proxying). | Zero permanent public URLs; files stream via permission-checked API routes.
- [2026-11-12] | PDF Export Engine (autonomous): pdf-lib | Pure JavaScript/TypeScript with zero native binary or Chromium dependencies; guaranteed to run within Vercel serverless CPU/memory and 15s execution limits. Rejected: Puppeteer/Chromium (fragile on serverless, exceeds bundle limit, high cold start) and @react-pdf/renderer (heavier bundle and font issues). | Fast, deterministic byte generation for proof-carrying PDFs.
- [2026-11-12] | Serverless Processing Pattern (autonomous): Step-wise Idempotent State Machine via ProcessingJob | Breaks document ingestion and AI verification into atomic, idempotent sub-steps keyed by checksum and lease locks, well within serverless function timeouts. Rejected: monolithic blocking route (hits 10s-15s Vercel timeouts) and Redis/BullMQ (adds external paid infrastructure). | Resilient job execution with status polling and visible retry capability.
- [2026-11-12] | Gemini Model Tiering (autonomous): GEMINI_EXTRACTION_MODEL (gemini-1.5-flash) and GEMINI_JUDGE_MODEL (gemini-1.5-pro) | High-throughput structured JSON extraction via Flash tier; higher-reasoning zero-temperature judge via Pro tier to mitigate same-model confirmation bias. Rejected: single model for both tasks. | Model name and prompt version recorded on every run for reproducibility.

