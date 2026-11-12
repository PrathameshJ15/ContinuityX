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

---

## Phase 1 Autonomous Decisions

- [2026-11-12] | Unified 404 Not Found for Missing Project and Non-Membership (autonomous) | In requireProjectAccess(), return HTTP 404 ("Project not found or you do not have permission to access it") for both non-existent project IDs and projects where the requesting user has no active membership. Rejected: HTTP 403 for non-members (reveals project existence to unauthorized probers via ID guessing / resource enumeration). | Eliminates project enumeration attacks while strictly denying unauthorized access.
- [2026-11-12] | Authoritative Typed Permission Matrix (autonomous) | Defined PERMISSION_MATRIX as a single immutable typed constant mapping all domain actions to allowed ProjectRole enums (OWNER, REVIEWER, VIEWER). Rejected: distributed in-route permission checks (prone to drift and omission). | Matrix is 100% testable; unit tests are generated dynamically across every role-permission pair.
- [2026-11-12] | Last-OWNER Invariant Safeguard (autonomous) | Both changeMemberRoleService() and removeMemberService() enforce that an OWNER cannot be demoted or removed if ownerCount <= 1. Rejected: client-side-only checks or allowing orphaned projects without owners. | Prevents unmanageable orphaned project workspaces.

---

## Phase 2 Autonomous Decisions

- [2026-11-12] | Document Parser Selection behind DocumentParser Interface (autonomous) | Selected `unpdf` (PDF page extraction), `mammoth` (DOCX HTML heading + paragraph structure), and `papaparse` (CSV batch parsing) with `jszip` inspecting `word/document.xml`. Rejected: `pdf-parse` (legacy CJS/worker packaging issues in Next.js 15 bundles). | Reliable pure-JS extraction inside Next.js App Router and serverless bundles with zero native binaries.
- [2026-11-12] | Intermediate Step State Persistence in ProcessingJob.stepData (autonomous) | Persist parsed `segments` JSON transiently in `ProcessingJob.stepData` between the `EXTRACTING` and `CHUNKING` steps and clear it on `READY_FOR_AI` (falling back to re-parse if missing). Rejected: running extraction and chunking in one long blocking request. | Keeps every processing API call short, resumable, idempotent, and protected by 30s lease locks.
- [2026-11-12] | Configurable Upload & Processing Caps via Environment Variables (autonomous) | Exposed `MAX_DOCUMENT_SIZE_MB` (default 10 MB), `MAX_DOCUMENT_PAGES` (default 100), and `MAX_PROJECT_DOCUMENTS` (default 50) in `src/lib/env.ts` / `.env.example`. Rejected: unconfigurable hard-coded magic numbers or unlimited uploads. | Prevents memory exhaustion and abuse while remaining adjustable per environment.
- [2026-11-12] | Strict Source Date Preservation (`USER_PROVIDED` vs `UNKNOWN`) (autonomous) | Optional user-supplied upload date records `sourceDateBasis = USER_PROVIDED`; omitted dates leave `sourceDate = null` and `sourceDateBasis = UNKNOWN`. Rejected: inferring `sourceDate` from OS file timestamps or `uploadedAt`. | Enforces V3.2 temporal integrity rule so Phase 5 never infers supersession without reliable dates.
- [2026-11-12] | Gemini Free Tier Model Update (autonomous): GEMINI_EXTRACTION_MODEL=gemini-3.5-flash-lite and GEMINI_JUDGE_MODEL=gemini-3.5-flash | Live verification against Google AI Studio Free Tier showed legacy `gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-2.5-flash`, and `gemini-2.5-pro` are unlisted/404 for new keys and `gemini-3.1-pro-preview`/`gemini-pro-latest` return 429 zero free-tier quota, whereas both `gemini-3.5-flash-lite` (extraction) and `gemini-3.5-flash` (reasoning judge) authenticate and respond HTTP 200 on Free Tier while keeping extractor and judge on distinct models. | Prevents 404/429 runtime failures without changing billing tier or AI architecture.

---

## Phase 3 Autonomous Decisions

- [2026-11-12] | Controlled Attribute Vocabulary with Cardinality & Synonym Normalization (autonomous) | Implemented canonical attribute vocabulary (`src/lib/ai/vocabulary.ts`) with strict cardinality rules and deterministic dictionary mapping for values. Rejected: unconstrained free-text attributes (causes silent conflict detection failure due to vocabulary mismatch). | Unlocks high-recall conflict detection while preserving verbatim `valueRaw`.
- [2026-11-12] | Conservative Entity Disambiguation with Review Flagging (autonomous) | In entity resolution, if multiple potential matches exist or similarity is ambiguous (< 0.85 threshold), system creates a new entity and flags `needsReview = true` instead of guessing. Rejected: aggressive fuzzy auto-merging. | Protects project knowledge graph from false merges while allowing human reviewers to execute clean merges via `mergeEntitiesService`.
- [2026-11-12] | Extraction Caching by Deterministic Input Checksum (autonomous) | Keyed `ExtractionRun` on `(inputChecksum, promptVersion, model, schemaVersion)`. If identical document content is extracted with the same model parameters, previous results can be reused or audited. | Saves API calls and provides transparent provenance tracking.

---

## Phase 4 Autonomous Decisions

- [2026-11-12] | Deterministic V3.2 Evidence-Status Algorithm (autonomous) | Implemented the authoritative 9-row first-match decision table (`src/services/verification/algorithm.ts`). Status is derived strictly from gate results and deterministic rules, never model confidence. Rejected: deriving verification status from LLM confidence scores or fuzzy thresholds. | Hallucination traps and fabricated quotes are deterministically blocked from reaching `VERIFIED`.
- [2026-11-12] | Independent Semantic Judge Isolation & Temperature 0 (autonomous) | The semantic judge (`GEMINI_JUDGE_MODEL` / `gemini-3.5-flash`) receives strictly the claim triple `(subject, attribute, value)`, the cited excerpt enclosed in untrusted tags, and minimal location context. The judge is never passed the full document, other claims, or extractor confidence, and runs at temperature 0 with a 1-retry fallback. | Ensures semantic evaluations are reproducible and resilient to prompt injection.
- [2026-11-12] | Canonical Pairwise Conflict Ordering (autonomous) | Enforced canonical ID ordering `(claimAId < claimBId)` with a database unique index `[claimAId, claimBId]` on the `Conflict` model, paired with date basis analysis (`sourceDateBasis != UNKNOWN` sets `POSSIBLY_SUPERSEDED`, otherwise `OPEN`). Rejected: storing unordered or duplicate reciprocal conflict rows. | Eliminates duplicate reciprocal conflict records and prevents unsupported auto-supersession assumptions without human review.





