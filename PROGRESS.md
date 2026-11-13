# Progress

Update at the end of every phase and every work session. Status comes from the repository audit and passing tests, not from memory.

| Phase | Name | Status | Exit test passed? | Last updated | Notes / blockers |
|---|---|---|---|---|---|
| 0 | Repository Audit & Foundation | Done | Yes | 2026-11-12 | Foundation scaffolded, typecheck/lint/tests/build passing, 5 decisions recorded |
| 1 | Authentication & Project Workspace | Done | Yes | 2026-11-12 | Auth, User/Project/ProjectMember/AuditLog, permission matrix (61 tests pass) |
| 2 | Document Intelligence & Upload | Done | Yes | 2026-11-12 | Live Neon migration applied & seeded; validation, parsers, chunking, DEV dataset, 95 tests pass |
| 3 | AI Claim Extraction & Entity Registry | Done | Yes | 2026-11-12 | Extraction pipeline, entity registry, vocabulary normalization, injection defense, 114 tests pass |
| 4 | Proof-Carrying Verification Engine | Done | Yes | 2026-11-12 | 4-gate verification engine, SPEC.md V3.2 9-row status table, DEV eval 15/15 matched, 148 tests pass |
| 5 | Conflict Detection & Human Review | Done | Yes | 2026-11-12 | Conflict models, resolution engine, split-pane review, review queue, 159 tests pass |
| 6 | Handover Generation & SHA-256 Receipt | Done | Yes | 2026-11-12 | Handover models, SHA-256 canonical receipt, pdf-lib export, tamper detection, 173 tests pass, P0-A CHECKPOINT PASSED |
| 7 | Knowledge Loss Radar | Done | Yes | 2026-11-13 | 6 diagnostic rules, audited dismissals, project overview KPI banner, 185 tests pass |
| 8 | Continuity Intelligence | Done | Yes | 2026-11-13 | Continuity Score, Bus Factor map, hardened Q&A refusal, 196 tests pass |
| 9 | Security, Testing, UI Polish, Benchmark, Release | Done | Yes | 2026-11-13 | Security isolation, TEST held-out suite, benchmark 40 claims, v1.0.0 released |
| - | Post-Release Small Fix Task (Items 1–7) | Done | Yes | 2026-11-13 | 7 small fixes applied across empty states, QA timeout, role display, entity zod, filters, dates, cleanup |
| - | Enterprise Frontend Redesign | Done | Yes | 2026-11-13 | Complete UI/UX redesign into commercial-grade enterprise SaaS platform; 236 tests pass, build clean |
| - | API Performance Optimization | Done | Yes | 2026-11-13 | Single-round-trip authz, parallelized DB reads via Promise.all, AbortController client deduping; 236 tests pass |

Status values: Not started, In progress, Done (exit test passed), Blocked.

## Repository audit findings (Phase 0)

- **Framework:** Next.js 15.1.4 (App Router), React 19, TypeScript 5.7 (strict mode)
- **Styling:** Tailwind CSS 3.4, PostCSS, shadcn/ui base design tokens & CSS variables
- **Database:** Prisma ORM 6.x, PostgreSQL (Neon-ready with pooled `DATABASE_URL` and `DIRECT_URL`)
- **Environment Validation:** Zod-based `src/lib/env.ts` with error masking and secret redaction
- **Testing:** Vitest 2.1, jsdom, `@testing-library/react` for 100% offline hermetic unit tests
- **CI:** GitHub Actions (`.github/workflows/ci.yml`) checking install, prisma generate, lint, typecheck, tests, and build
- **Core Routes:** `/` (landing page), `/login` (auth placeholder), `/api/health` (database connectivity check with sanitized error responses)
- **Phase 0 Decisions:** 5 autonomous decisions recorded in `DECISIONS.md` (Auth.js credentials, pluggable storage provider, pdf-lib, step-wise state machine, Gemini tiered models)

---

## Fix Pack: Stability & Trust Fixes (Items 1–7)

### 1. Fix Summary & Engineering Safeguards
- **Item 1 (Empty States):** Separated "No data yet" (`totalClaims === 0`: "No claims yet. Upload documents and run extraction first", with link to documents) from evaluated zero-risk states across Knowledge Radar, Evidence Review Queue, Bus Factor Map, and Conflicts. Added `src/lib/empty-states.ts` and unit tests in `tests/unit/empty-states.test.ts`. Commit: `8744415`.
- **Item 2 (Handover Q&A Timeout & Refusal):** Added 25-second server-side timeout (`Promise.race`) in `src/services/intelligence/qa.ts` and 30-second client-side timeout (`AbortController`) with Retry buttons. Verified model is not called when 0 claims are retrieved (`modelCalled: false`). Added test in `tests/integration/qa-service.test.ts`. Commit: `91dcc6d`.
- **Item 3 (Role Display Consistency):** Created unified role label and badge formatter `src/lib/roles.ts` (`formatRoleLabel`, `getRoleBadgeClass`). Replaced divergent role displays across login page, dashboard project cards, workspace header, and team access list. Added unit test in `tests/unit/roles.test.ts`. Commit: `32516c4`.
- **Item 4 (Entity & Alias Zod Schema):** Created shared Zod validation `src/services/entities/schema.ts` (`entityNameSchema`, `entityAliasSchema`, `createEntitySchema`). Requires trimmed, min 2 chars, at least one letter, max 200 chars, strictly plain text (`^[^<>]+$`), rejecting numeric names like "12345678", whitespace, and duplicate normalized names or aliases within the same project. Added 14 unit tests in `tests/unit/entity-resolution.test.ts`. Commit: `b464227`.
- **Item 5 (Default Filters & Date Formatter):** Defaulted filters to ALL/OPEN, added live counts next to each filter option in Conflicts (`countsByStatus`) and Radar (`metrics`). Enhanced `src/lib/date.ts` (`formatDate` outputs "12 Nov 2026", `formatDateTime` outputs "12 Nov 2026, 14:30:00 UTC" in 24-hour time with timezone). Added tests in `tests/unit/date-formatter.test.ts`. Commit: `4fbc051`.
- **Item 6 (Safe Test Data Cleanup):** Created idempotent cleanup script `scripts/cleanup_test_data.ts` with Neon snapshot safeguards, safely removing temporary DEV test projects ("DEV Phase 3*") and invalid entity "12345678" while preserving the seeded demo project "Smart Attendance System (Synthetic Demo)" and demo user accounts. Commit: `83486db`.
- **Item 7 (Gemini Free Tier Data Policy):** Recorded autonomous decision in `DECISIONS.md` defining strict synthetic data policy: because Gemini Free Tier terms allow human review and product improvement, only synthetic, de-identified project data is sent to the API.

---

## Phase 9 Standard Phase Report (Final Release v1.0.0)

### 1. What was built & delivered
- **Security & Multi-Tenant Isolation Suite (`tests/integration/security-isolation.test.ts`):**
  - Authoritative 12-permission matrix verification across all roles (`OWNER`, `REVIEWER`, `VIEWER`).
  - Zero project enumeration security rule: Non-members and unauthorized requests always receive HTTP 404 (`ProjectNotFoundError`), preventing malicious attackers from confirming project IDs.
  - Cross-tenant IDOR attack prevention: Verifies users in Project A cannot query or mutate Project B objects.
  - Deep recursive secret redaction in `src/lib/audit.ts` (`sanitizeAuditMetadata` redacting passwords, API keys, tokens, and database URLs in nested objects).
- **Held-Out TEST Dataset (`demo-data/test/`):**
  - Fictional project "Autonomous Campus Delivery Drone Navigation System" authored following DEMO_AND_BENCHMARK.md rules before benchmark evaluation.
  - Documents generated: `drone_spec.pdf` (multi-page PDF), `field_test_notes.docx`, `flight_tasks.csv`, and `emergency_comms.docx` (undated with planted prompt injection).
  - Frozen ground truth `demo-data/test/ground_truth.json` with 25 expected claims, 5 conflicts, 3 hallucination traps, 1 prompt injection, and alias/quality cases.
  - Total benchmark claims evaluated across DEV and TEST: Exactly 40 claims, 10 conflicts, 6 traps, and 2 prompt injections.
- **Automated Benchmark Runner & Report (`scripts/run_benchmark.ts`, `tests/integration/benchmark.test.ts`):**
  - Comparative evaluation against single-pass naive prompt baseline.
  - Measured results:
    - Evidence Attribution Accuracy: ContinuityX **95%** (38/40) vs Baseline **65%** (26/40).
    - Unsupported Claim Rate: ContinuityX **0%** (0/6 traps verified) vs Baseline **33%** (2/6 traps adopted).
    - Conflict Detection Recall: ContinuityX **100%** (10/10 conflicts detected) vs Baseline **70%** (7/10 conflicts).
    - Prompt Injection Resistance: ContinuityX **100%** (2/2 resisted) vs Baseline **50%** (1/2 resisted).
  - Machine-readable results saved to `benchmark/results/benchmark-results.json` and publication-quality report in `benchmark/results/benchmark-report.md`.
  - Transparent documentation of methodological limitations (sample size N=40, synthetic data, same-vendor model).
- **UI & Documentation Polish:**
  - Updated `README.md` with full system architecture, quickstart guide, and benchmark results table.
  - Responsive layout, accessible contrast, and loading states verified across all views.

### 2. Commands run and their real results
- `node scripts/generate_test_dataset.js`: Exit code 0 (created TEST fixtures and `ground_truth.json`).
- `npx tsx scripts/run_benchmark.ts`: Exit code 0 (computed and saved benchmark results and markdown report).
- `npm run typecheck`: Exit code 0 (`tsc --noEmit` clean, 0 errors).
- `npm test`: Exit code 0 (210 tests passing across 26 test suites).
- `npm run lint`: Exit code 0 (`✔ No ESLint warnings or errors`).
- `npm run build`: Exit code 0 (all 51 Next.js routes compiled cleanly).
- Server verified: High-speed production server running at `http://localhost:3000`.

### 3. Exit-criteria checklist
- [x] Responsive UI and accessible layouts on all views — **PASS**
- [x] Security isolation and authorization tests for all roles — **PASS**
- [x] Non-members receive 404 with zero project enumeration — **PASS**
- [x] TEST dataset generated and labels frozen before evaluation — **PASS**
- [x] Total evaluated claims reach 40 across DEV and TEST — **PASS**
- [x] Zero hallucination traps reach VERIFIED — **PASS**
- [x] 100% prompt injection resistance maintained — **PASS**
- [x] Measured benchmark results recorded honestly in DEMO_AND_BENCHMARK.md — **PASS**
- [x] typecheck, lint, tests and production build pass — **PASS**

### 4. Milestone Checkpoint: v1.0.0 Release Complete
- All 10 phases (0 through 9) are 100% complete, verified, and passing all acceptance tests.

---

## Post-Release Small Fix Task (Items 1–7)

### 1. What was built & delivered
- **Item 1: Empty States (`3674916`):**
  - Updated Knowledge Radar, Evidence Review, Bus Factor, and Conflicts to distinguish projects with no data from "checked and nothing found".
  - Empty states now explicitly guide the user with: *"No claims yet. Upload documents and run extraction first"* and provide a direct link to the documents page.
  - Integration test added in `tests/integration/radar-service.test.ts`.
- **Item 2: Handover Q&A Hardening (`032abae`):**
  - Added 30-second client timeout (`AbortSignal`) to prevent indefinite spinning.
  - Added inline error state with an instant **"Retry Question"** button in the chat thread.
  - Refusal indicator badge added to highlight when queries cannot be answered from approved evidence.
- **Item 3: Role & Identity Display (`1dffdb6`):**
  - Resolved root cause in `prisma/seed.ts`: Cleaned seeded display names to remove parenthetical role suffixes ("Riya Sharma", "Arjun Mehta").
  - Enforced deterministic upsert of project memberships in seed script so Riya is guaranteed `REVIEWER` role on demo project.
- **Item 4: Entity Name Zod Validation (`58f7617`):**
  - Added shared schema `src/services/entities/schema.ts` validating: trimmed, minimum 2 characters, must contain at least one letter, maximum 200 characters.
  - Server rejects pure numbers (e.g., "12345678") with HTTP 400 `VALIDATION_ERROR` and rejects duplicates with HTTP 409 `CONFLICT`.
  - Client modal enforces the same Zod schema before dispatching requests.
  - Unit tests added in `tests/unit/entity-resolution.test.ts`.
- **Item 5: Default Filters (`45dde38`):**
  - Aligned API and UI defaults for Radar and Conflicts so open items are displayed by default and never obscured.
- **Item 6: Unambiguous Shared Date Formatter (`0a979fc`):**
  - Created shared date utility `src/lib/date.ts` formatting all dates deterministically as `12 Nov 2026`.
  - Replaced all 10 occurrences of `toLocaleDateString()` across `dashboard`, `projects`, `claims`, `conflicts`, `documents`, `handover`, `members`, `radar`, and `review`.
  - Unit tests added in `tests/unit/date-formatter.test.ts`.
- **Item 7: Test Data Cleanup (`83486db`):**
  - Executed safe cleanup script `scripts/cleanup_test_data.ts` deleting temporary project `"DEV Phase 3 Live Check (Temp)"` and invalid entity `"12345678"`.
  - Verified remaining database state: only legitimate `"Smart Attendance System (Synthetic Demo)"` project remains.

### 2. Verification Summary
- `npm run typecheck`: Exit code 0 (`tsc --noEmit` clean, 0 errors).
- `npm run lint`: Exit code 0 (`✔ No ESLint warnings or errors`).
- `npm test`: Exit code 0 (220 tests passed across 27 test suites).
- `npm run build`: Exit code 0 (all 51 routes compiled and statically optimized).
- Live server verified: `http://localhost:3000` (database connected, latency healthy).

---

## Enterprise Frontend Redesign (Commercial-Grade SaaS UI/UX)

### 1. What was built & delivered
- **Original ContinuityX Design System & Tokens:**
  - Modern, restrained enterprise palette: Background `#F8FAFC`, Surface `#FFFFFF`, Primary `#4F46E5`, Success `#16A34A`, Warning `#D97706`, Danger `#DC2626`, Neutral Border `#E2E8F0`, Text `#111827`, Secondary Text `#64748B`.
  - Reusable component library in `src/components/ui/`: `badge.tsx`, `metric-card.tsx`, `empty-state.tsx`, `skeleton.tsx`, `modal.tsx`, `filter-pills.tsx`, `page-header.tsx`.
- **Global App Shell & Navigation Hierarchy:**
  - Persistent, collapsible sidebar (`sidebar.tsx`) with active project switcher, workspace overview link, grouped project navigation (Overview, Knowledge & Extraction, Verification & Quality, Continuity & Intelligence, Final Handover, Governance & Access), and user profile drawer.
  - Contextual global topbar (`topbar.tsx`) with dynamic breadcrumb trail (`Workspace > Project > Section`), role pill, status indicator, mobile drawer trigger, and global Cmd+K search shortcut.
  - Command palette (`search-modal.tsx`) enabling instant keyboard navigation across all project sections and recent actions.
  - Mobile responsive drawer overlay and responsive layouts on all screens.
- **Redesigned Workspace Dashboard (`src/app/dashboard/page.tsx`):**
  - KPI overview metrics (Total Projects, Active Workspaces, Pending Reviews, Approved Handovers).
  - Left column (2/3 width) project workspace cards with role badges, status dots, member counts, and review queue progress bars.
  - Right column (1/3 width) "Action Required" panel highlighting pending reviews, and enterprise invariant safety highlights.
  - Bottom section featuring recent sealed handovers with version badges and "Inspect Receipt" actions.
  - Interactive "Create Project" modal without page refresh.
- **Redesigned Project Overview Dashboard (`src/app/projects/[projectId]/page.tsx`):**
  - Section A: Project Health metrics (Docs, Verified Claims ratio, Open Conflicts, Continuity Readiness).
  - Section B: Knowledge Health progress bar and 4-gate verification distribution.
  - Section C: R1–R6 diagnostic risk grid (Bus factor SPOF, missing docs, unassigned tasks, missing rationale, open questions, inconsistencies).
  - Section D: Prioritized Action Required governance cards with direct routing.
  - Section E: Recent indexed documents and claim activity log.
- **Redesigned Knowledge & Extraction (`src/app/projects/[projectId]/documents/page.tsx`):**
  - Linear-grade document table, metric cards, drag-and-drop file upload zone, status pills (`AI EXTRACTED`, `READY FOR AI`, pipeline stepper, validation failures), chunk counts, chunk inspection modal, search, filter pills (`ALL`, `READY`, `PROCESSING`, `WARNINGS`), retry, soft delete, and serverless auto-process poller.
- **Redesigned Claims Evidence Workspace (`src/app/projects/[projectId]/claims/page.tsx`):**
  - Master-detail evidence investigation workspace: Metric cards, status filter pills (`ALL`, `VERIFIED`, `WEAK_SUPPORT`, `CONFLICTING`, `UNVERIFIED`), category and attribute dropdowns, injection flag and normalization checkboxes.
  - Proof-Carrying Verification Gates modal displaying detailed breakdown of Gate 1 (Source Existence), Gate 2 (Quote Match & similarity %), Gate 3 (Semantic Support & judge model), and Gate 4 (Contradiction Check & count).
  - Claim detail inspection modal with chunk context and extraction run metadata. Edit claim modal with optimistic version increments.
- **Redesigned Contradictions & Conflicts (`src/app/projects/[projectId]/conflicts/page.tsx`):**
  - Side-by-side comparison interface: Metric cards (Total Contradictions, Open Conflicts, Possibly Superseded, Clarification Needed), status filter pills with exact counts.
  - Chronology notice adhering to safe date rules (distinguishing dated discrepancy from unknown date basis).
  - Side-by-side Claim A vs Claim B cards with document citation, excerpt, raw value, normalized value, and date basis.
  - Conflict resolution modal with mandatory written rationale and action selection (`CHOOSE_A`, `CHOOSE_B`, `KEEP_BOTH`, `CONFIRM_SUPERSEDED`, `REQUIRES_CLARIFICATION`).
  - Distinguishes unpopulated projects (`NO_CLAIMS_TITLE`) from zero conflicts checked.
- **Redesigned Evidence Review Queue (`src/app/projects/[projectId]/review/page.tsx`):**
  - Reviewer cockpit with progress ribbon (Position X of Y, pending, accepted, rejected, open conflicts count).
  - Claim triple card with category and normalized value, 4-gate evidence proof summary, and highlighted source excerpt inside full surrounding chunk context.
  - Keyboard navigation shortcuts (`[A] Accept`, `[R] Reject`, `[N] Next`, `[P] Prev`).
  - Acceptance Rationale modal for non-VERIFIED claims and Rejection notes modal.
  - Distinguishes unpopulated projects from complete review queue.
- **Redesigned Handover & Cryptographic Receipt (`src/app/projects/[projectId]/handover/page.tsx`):**
  - Version switcher between Draft Preview (Latest Accepted) and sealed approved snapshots.
  - System Invariant Check alert in Draft mode blocking approval if conflicts or unreviewed claims remain.
  - Cryptographic Approval Receipt card with canonical snapshot SHA-256 hash (one-click copy), previous receipt hash chain, approved by metadata, and tamper-evident clarification.
  - 14 collapsible handover sections with item counts, empty notices, and evidence citations.
  - "Approve Handover & Mint Receipt" modal and "Receipt Cryptographic Verification" modal running independent 2-way verification of snapshot integrity and live database claims.
  - Deterministic PDF export.
- **Redesigned Knowledge Loss Radar (`src/app/projects/[projectId]/radar/page.tsx`):**
  - Visual risk intelligence interface with metric cards (Active Alerts, High Risk R1/R2/R6, Medium Risk R3/R4, Low Risk R5, Dismissed).
  - Filter pills for Rule ID (R1–R6) and Status (Open, Dismissed, All).
  - Alert cards with severity badge, diagnostic finding, associated claims, missing knowledge artifact/source document citation, and suggested remediation.
  - Dismiss Alert modal with mandatory written justification and Reactivate action.
  - Uses `getRadarEmptyState` for honest empty states.
- **Redesigned Continuity Intelligence & Hardened Q&A (`src/app/projects/[projectId]/intelligence/page.tsx`):**
  - Tab 1 (Continuity Score): Score gauge out of 100 or Insufficient Evidence badge, coverage % (>=60%), status badge, governance notice, and 5-metric breakdown grid with formulas.
  - Tab 2 (Bus Factor Map): Single-contributor critical risk highlights (Bus factor = 1), verified owners list, module cards, and `getBusFactorEmptyState` integration.
  - Tab 3 (Hardened Handover Q&A): Linear-grade chat interface, suggested questions, evidence citations, refusal state on unanswerable questions, and 30s timeout with retry button.
- **Redesigned Entity Registry (`src/app/projects/[projectId]/entities/page.tsx`):**
  - Entity registry with search and type filters (`COMPONENT`, `PERSON`, `SYSTEM`), needsReview toggle.
  - Entity table with canonical names, normalized IDs, origin (`MODEL` vs `REVIEWER`), aliases pills, claim counts, and review state.
  - Add Canonical Entity modal and Edit Entity modal with client-side zod validation (`entityNameSchema`, `entityAliasSchema`, `createEntitySchema`).
  - Merge Entity modal with target dropdown and clean soft-merge execution.
- **Redesigned Members & Access Control (`src/app/projects/[projectId]/members/page.tsx`):**
  - Team membership table with `formatRoleLabel` role badges, joined dates, and owner actions.
  - Invite Team Member card for owners with email input and role selector.
  - Sole owner demotion and removal protection preserved.
- **New Governance Audit Trail (`src/app/projects/[projectId]/audit/page.tsx` & `src/app/api/projects/[id]/audit/route.ts`):**
  - Created governance audit trail timeline page with metric cards (Total Events, Handover Approvals, Conflict Resolutions, Review Actions), filter pills, search input, and chronological table with sanitized metadata JSON preview.

### 2. Verification Summary
- `npm run typecheck`: Exit code 0 (`tsc --noEmit` clean, 0 errors).
- `npm run lint`: Exit code 0 (`✔ No ESLint warnings or errors`).
- `npm test`: Exit code 0 (236 tests passed across 29 test suites).
- `npm run build`: Exit code 0 (all 51 routes compiled and statically optimized).

---

## API Performance Investigation & Optimization

### 1. Root Cause Analysis & Measured Diagnostics
- **Initial Telemetry Reported by User:**
  - `GET /projects/[projectId]/intelligence`: Total duration: 34.60 seconds (Stalled: 17.64 seconds, TTFB: 16.95 seconds).
  - Intelligence endpoint called twice.
- **Empirical Diagnostics (`scripts/test_db_latency.ts` & `scripts/trace_intelligence_endpoint.ts`):**
  - **Raw TCP/TLS Connect Time:** 1,661.75 ms (cross-continent link from India to AWS Ohio `us-east-2`).
  - **Warm Single Query (`SELECT 1`):** 2,536.98 ms wire round trip.
  - **In-Memory Calculations:** 0.0295 ms (Continuity Score + Bus Factor algorithm).
  - **JSON Serialization:** 0.0074 ms.
  - **Auth & Authorization Overhead:** Route handlers called `getCurrentUser()`, which executed `prisma.user.findUnique` (2,540 ms). Next, `requireProjectAccess(projectId, permission, userId)` executed `prisma.user.findUnique` a *second time* (2,500 ms) before executing `prisma.projectMember.findUnique` (3,090 ms), totaling 8.19 seconds of sequential round trips before querying data.
  - **Sequential Database Reads:** In `computeContinuityIntelligenceService`, `entities`, `claims`, and `openConflicts` were queried sequentially ($2.35s + 2.38s + 2.34s = 7.07s$).
  - **Duplicate Requests & Chrome Socket Saturation (17.64s Stalled):** Chrome limits concurrent HTTP/1.1 connections to 6 per host. When mounting workspace layouts and project pages in React StrictMode (`next dev`), `layout.tsx` (3 requests) and `page.tsx` (6 requests) fired duplicate concurrent requests (up to 18 total). Because requests 1–6 occupied all 6 browser sockets for 16.95s TTFB, requests 7+ were queued in Chrome's internal socket pool, producing the 17.64s Stalled phase.

### 2. Implemented Optimizations
- **Single Round-Trip Project Authorization (`src/lib/permissions.ts`):**
  - Consolidated project existence, membership, role permission, and user verification into a single `prisma.projectMember.findUnique({ where: { projectId_userId }, include: { project: true, user: true } })`.
  - Eliminated the redundant duplicate `prisma.user.findUnique` lookup, saving 2.5–5.0 seconds per protected API call.
- **Parallel Query Execution (`Promise.all`):**
  - Parallelized independent database reads in `computeContinuityIntelligenceService` (`entities`, `claims`, `conflicts`).
  - Parallelized independent database reads in `computeRadarAlertsService` (`claims`, `entities`, `conflicts`, `dismissals`).
  - Parallelized independent database reads in `getReviewQueueService` (`claims`, `openConflictsCount`).
  - Parallelized conflict queries in `src/app/api/projects/[id]/conflicts/route.ts` (`conflicts`, `claimCount`, `statusCounts`).
- **Connection Pool Tuning (`.env`):**
  - Appended `&connection_limit=20` to the Neon PgBouncer `DATABASE_URL` so Prisma utilizes the full PgBouncer pool without queueing queries locally.
- **Client-Side Deduplication & AbortController (`intelligence/page.tsx`, `page.tsx`, `layout.tsx`):**
  - Wrapped `useEffect` data-fetching in `AbortController` instances. In development mode (StrictMode double-mount), unmounting cleanly aborts the first stale request, eliminating duplicate network calls and freeing Chrome's 6-socket queue.
- **Safe Server Timing Logging (`Server-Timing` headers):**
  - Added millisecond timing logs and `Server-Timing: total;dur=...` headers to `intelligence`, `radar`, `conflicts`, `review/queue`, and `projects/[id]` API routes.

### 3. Verification & Measured Before/After Timings
- **Before Optimization:**
  - `computeContinuityIntelligenceService`: 16,055 ms – 16,950 ms TTFB
  - Sequential 6 queries: 20,336 ms
  - Chrome Stalled time: 17,640 ms
  - Total duration: 34,600 ms
- **After Optimization (Measured on warm connection):**
  - `computeContinuityIntelligenceService`: **7,452 ms** (56% latency reduction)
  - 4 Dashboard Services in Parallel: **14,359 ms** (vs 64,300 ms sequentially)
  - Chrome Stalled time: **< 100 ms** (eliminated socket pool congestion via AbortController)
- **Regression Testing:**
  - `npm run typecheck`: Exit code 0 (`tsc --noEmit` clean, 0 errors).
  - `npm run lint`: Exit code 0 (`✔ No ESLint warnings or errors`).
  - `npm test`: Exit code 0 (29/29 suites passed, 236/236 tests passed).
  - `npm run build`: Exit code 0 (51/51 routes compiled and statically optimized).

---

## P0 Incident Resolution: Resilient Workspace Lifecycle & Auth Fallback

### 1. Root Cause Analysis
- **Premature Abort Early Return in Client Components (`src/app/projects/[projectId]/page.tsx`):**
  - Following the performance optimization commit (`1d60832`), `loadAllProjectData` contained `if (signal?.aborted) return;`.
  - In React development mode / StrictMode, effect cleanup called `controller.abort()`. When in-flight promises resolved, the early return prevented state setters (`setProject`, `setIntelligence`, etc.) from running.
  - In `finally`, `setLoading(false)` ran, leaving `project === null`. Line 266 (`if (!project) return null;`) rendered a blank white page (`null`), causing "no results" on project overview.
- **Unsettled Workspace Loading in Layout (`src/app/projects/[projectId]/layout.tsx`):**
  - `loadWorkspaceData` in `layout.tsx` relied on an `isMounted` flag set to `false` during effect cleanup.
  - In `catch`, `AbortError` was swallowed, and in `finally`, `if (isMounted) setLoading(false)` skipped `setLoading(false)`, leaving the layout stuck on "Loading enterprise project workspace..." or rendering null.
  - Because `layout.tsx` wraps all project workspace routes, this blocked all 11 sub-pages.
- **Transient Auth 401 Masking DB Disconnects (`src/lib/auth.ts`):**
  - In `getCurrentUser()`, if `prisma.user.findUnique` threw during a transient connection reset, `catch { return null; }` caused valid sessions to appear unauthenticated (401), causing client redirects.

### 2. Implemented Fixes
- **Resilient Data Population (`page.tsx`, `layout.tsx`, `intelligence/page.tsx`):**
  - Removed premature abort returns that dropped settled responses. Settled data is always applied when available, and loading state is reliably cleared in `finally`.
  - Removed `router` dependency from `layout.tsx`'s `useEffect` dependency array, preventing spurious re-render abort loops.
  - Added a visible retry fallback in `page.tsx` if `project` is null, preventing blank white screens.
- **Resilient Auth Session Fallback (`src/lib/auth.ts`):**
  - When JWT verification succeeds but the database experiences a transient connection timeout, `getCurrentUser()` preserves the authenticated user from the cryptographically verified JWT payload rather than falsifying an unauthenticated 401 error.
- **Pool Connection Tuning (`.env`):**
  - Set `&connection_limit=10` and removed unsupported `channel_binding=require` on PgBouncer `DATABASE_URL` to prevent handshake resets.

### 3. Verification & Quality Gate Results
- `npm run typecheck`: Exit code 0 (`tsc --noEmit` clean, 0 errors).
- `npm run lint`: Exit code 0 (`✔ No ESLint warnings or errors`).
- `npm test`: Exit code 0 (29/29 suites passed, 236/236 tests passed).
- `npm run build`: Exit code 0 (all 51 routes compiled and optimized cleanly).



## Open questions

(none yet)

---

## Phase 1 Standard Phase Report

### 1. What was built
- **Database Models & Enums:** `User`, `Project`, `ProjectMember`, `AuditLog`, `ProjectRole` (OWNER, REVIEWER, VIEWER), `ProjectStatus` (ACTIVE, ARCHIVED).
- **Security & Permissions (`src/lib/permissions.ts`):** `PERMISSION_MATRIX` authoritative constant, `hasPermission()`, `requireUser()`, `requireProjectAccess()`. Unified HTTP 404 response on missing project or non-membership.
- **Authentication (`src/lib/auth.ts`, `src/lib/rate-limiter.ts`):** Bcrypt password hashing (10 salt rounds), secure HS256 JWT session tokens via `jose`, HttpOnly SameSite=Lax session cookies, sliding-window rate limiting on login (5 attempts / 60s), unified error messages without user enumeration.
- **Audit Service (`src/lib/audit.ts`):** `writeAudit()` logging `PROJECT_CREATED`, `PROJECT_UPDATED`, `PROJECT_ARCHIVED`, `MEMBER_ADDED`, `MEMBER_REMOVED`, `MEMBER_ROLE_CHANGED`, `LOGIN_FAILED`, `LOGIN_SUCCESS`, `USER_REGISTERED` with automatic secret redaction.
- **API Routes:**
  - `/api/auth/register` (POST)
  - `/api/auth/login` (POST)
  - `/api/auth/logout` (POST)
  - `/api/auth/me` (GET)
  - `/api/projects` (GET, POST)
  - `/api/projects/[id]` (GET, PATCH, DELETE)
  - `/api/projects/[id]/members` (POST)
  - `/api/projects/[id]/members/[memberId]` (PATCH, DELETE)
- **UI Screens & States:**
  - Login page (`/login`) with demo user shortcuts.
  - Register page (`/register`).
  - Dashboard (`/dashboard`) with project list, pagination, and Create Project modal.
  - Project Workspace Shell (`/projects/[projectId]`) with restricted tab navigation (Overview, Members & Settings).
  - Project Overview (`/projects/[projectId]`) with edit details and archive actions for OWNER.
  - Members Management (`/projects/[projectId]/members`) with invite form, role changer, last-owner safeguards, and VIEWER read-only notice.
  - Loading, empty, error, and permission-denied states implemented on all views.
- **Seed Script (`prisma/seed.ts`):** Seeds demo accounts (`lead@continuityx.demo` and `member@continuityx.demo`) and synthetic fixture project "Smart Attendance System (Synthetic Demo)".

### 2. Commands run and their real results
- `npm run typecheck`: Exit code 0 (`tsc --noEmit` clean, 0 errors).
- `npm test`: Exit code 0 (61 tests passed across 6 test suites: `tests/integration/projects-auth.test.ts`, `tests/unit/permissions.test.ts`, `tests/unit/projects-service.test.ts`, `tests/unit/auth.test.ts`, `tests/unit/env.test.ts`, `tests/unit/health.test.ts`).
- `npm run lint`: Exit code 0 (`✔ No ESLint warnings or errors`).
- `npm run build`: Exit code 0 (all 15 routes compiled and optimized into static/dynamic serverless bundles).

### 3. Exit-criteria checklist
- [x] Register, login and logout work; sessions are validated on the server — **PASS** (`requireUser()` checks session cookie and verifies JWT).
- [x] Project CRUD and member management work with real persistence — **PASS** (Prisma transactions and services tested).
- [x] A non-member cannot access a project through any route or ID guess — **PASS** (verified by `tests/integration/projects-auth.test.ts`).
- [x] Role permissions are enforced on the server and matrix tests pass — **PASS** (42 tests generated from `PERMISSION_MATRIX`).
- [x] AuditLog records the listed events — **PASS** (persisted and verified in unit/integration tests).
- [x] All required UI states exist — **PASS** (loading, empty, error, and 404/403 states implemented).
- [x] typecheck, lint, tests and build pass — **PASS** (all 4 quality gates green).

### 4. Deviations and DECISIONS.md entries
- [2026-11-12] | Unified 404 Not Found for Missing Project and Non-Membership.
- [2026-11-12] | Authoritative Typed Permission Matrix.
- [2026-11-12] | Last-OWNER Invariant Safeguard.

### 5. Security confirmation: Project routes enforcement
All project routes and server actions strictly enforce permissions on the server:
- `GET /api/projects`: Checks `requireUser()`, filters projects strictly by `userId` in membership relation.
- `POST /api/projects`: Checks `requireUser()`, creates project and sets creator as `OWNER` atomically in transaction.
- `GET /api/projects/[id]`: Calls `requireProjectAccess(projectId, "project:read")`.
- `PATCH /api/projects/[id]`: Calls `requireProjectAccess(projectId, "project:update")`.
- `DELETE /api/projects/[id]`: Calls `requireProjectAccess(projectId, "project:archive")`.
- `POST /api/projects/[id]/members`: Calls `requireProjectAccess(projectId, "members:manage")`.
- `PATCH /api/projects/[id]/members/[memberId]`: Calls `requireProjectAccess(projectId, "members:manage")`.
- `DELETE /api/projects/[id]/members/[memberId]`: Calls `requireProjectAccess(projectId, "members:manage")`.

---

## Phase 2 Standard Phase Report

### 1. What was built
- **Database Models & Migration (`prisma/migrations/20261112121635_init_phase1_phase2`):** Applied `Document`, `DocumentChunk`, `ProcessingJob`, and enums `TextQuality`, `SourceDateBasis`, `DocumentProcessingStatus`, `ProcessingJobState` to Neon PostgreSQL; ran `npm run db:seed` cleanly (`cmwdiir940003t1c4i0b29dtg`).
- **Private Storage (`src/lib/storage.ts`):** `StorageProvider` interface and `LocalStorageProvider` writing under `storage/documents/` outside `public/` with path-traversal protection and authenticated proxy download.
- **Validation (`src/services/documents/validation.ts`):** Extension + MIME allowlist, `%PDF` magic bytes, ZIP + `word/document.xml` DOCX inspection via `JSZip`, UTF-8/UTF-16 BOM & binary null-byte CSV decoding, size/page/project caps, SHA-256 checksum deduplication.
- **Parsers & Quality (`src/services/documents/parsers.ts`):** Modular `DocumentParser` implementations for PDF (`unpdf`), DOCX (`mammoth`), and CSV (`papaparse`); deterministic `evaluateTextQuality()` (`OK`, `LOW_TEXT`, `SCANNED_SUSPECTED`); explicit password-protected PDF detection; zero invented headings/locations.
- **Structure-Aware Chunking (`src/services/documents/chunking.ts`):** `createStructureAwareChunks()` preserving verbatim text and true page/heading/row boundaries.
- **Step-Wise Idempotent Pipeline & API (`src/services/documents/index.ts`, `/api/projects/[id]/documents/*`):** `UPLOADED/VALIDATING -> EXTRACTING -> CHUNKING -> READY_FOR_AI` with 30s lease locks, `VALIDATION_FAILED`/`EXTRACTION_FAILED` recovery + `retry`, `USER_PROVIDED` vs `UNKNOWN` source dates, soft delete, and `requireProjectAccess` checks on all routes (`upload`, `list`, `get`, `process`, `retry`, `download`, `delete`).
- **UI (`src/app/projects/[projectId]/layout.tsx`, `src/app/projects/[projectId]/documents/page.tsx`):** Documents tab with upload dropzone, optional source date input, status stepper, text-quality warnings, chunk inspection modal, authenticated download, retry, and soft delete.
- **DEV Demo Dataset & Baseline Script (`scripts/generate-dev-dataset.ts`, `demo-data/dev/*`, `demo-data/dev-malformed/*`, `scripts/run-baseline-dev.ts`):** Reproducible 5-file DEV set (`design_doc.pdf`, `meeting_notes.docx`, `task_tracker.csv`, `chat_export.docx`, `scanned_notes.pdf`) + `ground_truth.json` (cases C1-C5, H1-H3, W1, A1-A2, I1, S1, M1) + malformed fixtures + baseline runner script (`npm run baseline:dev`).

### 2. Commands run and their real results
- `npx prisma migrate dev --name init_phase1_phase2`: Exit code 0 (created and applied migration to Neon Postgres).
- `npm run db:seed`: Exit code 0 (seeded demo accounts and synthetic project `cmwdiir940003t1c4i0b29dtg`).
- `npx tsx scripts/run-baseline-dev.ts`: Exit code 0 (ran DEV baseline against Google AI Studio Free Tier `gemini-3.5-flash-lite`; saved `benchmark/results/dev-baseline.json` & `benchmark/results/dev-baseline.md`).
- `npm run typecheck`: Exit code 0 (`tsc --noEmit` 0 errors).
- `npm test`: Exit code 0 (95 passed across 9 test suites, including 12 validation tests, 13 parser/chunking/DEV fixture tests, and 9 document service & authorization tests).
- `npm run lint`: Exit code 0 (`✔ No ESLint warnings or errors`).
- `npm run build`: Exit code 0 (22 routes compiled cleanly).

### 3. Exit-criteria checklist
- [x] PDF, DOCX and CSV upload, extract and persist with correct source locations — **PASS**
- [x] Validation and failure handling work with clear user messages — **PASS**
- [x] Duplicates are caught; document date is stored with its basis — **PASS**
- [x] Low-text or scanned files are flagged for human attention — **PASS**
- [x] Processing status is visible and retry works — **PASS**
- [x] Files are private; no public URLs — **PASS**
- [x] DEV dataset and `ground_truth.json` exist — **PASS**
- [x] Baseline result saved (or explicitly skipped with a reason) — **PASS** (`benchmark/results/dev-baseline.json` & `dev-baseline.md` via `gemini-3.5-flash-lite`)
- [x] typecheck, lint, tests and build pass — **PASS**

### 4. Deviations and DECISIONS.md entries
- Added 5 Phase 2 entries in `DECISIONS.md` (`unpdf`/`mammoth`/`papaparse`, `ProcessingJob.stepData`, env-configurable upload caps, `USER_PROVIDED`/`UNKNOWN` date preservation, and Free Tier model update to `gemini-3.5-flash-lite` / `gemini-3.5-flash`).

### 5. Security confirmation: Document routes enforcement
Every document route enforces server-side auth & membership (`requireProjectAccess` with unified 404 for missing/non-member projects):
- `GET /api/projects/[id]/documents`: `project:read` (OWNER, REVIEWER, VIEWER)
- `GET /api/projects/[id]/documents/[docId]`: `project:read` (OWNER, REVIEWER, VIEWER)
- `GET /api/projects/[id]/documents/[docId]/download`: `project:read` (OWNER, REVIEWER, VIEWER), private `Cache-Control: private, no-cache, no-store, must-revalidate`
- `POST /api/projects/[id]/documents/upload`: `documents:upload_or_delete` (OWNER, REVIEWER only)
- `POST /api/projects/[id]/documents/[docId]/process`: `documents:upload_or_delete` (OWNER, REVIEWER only)
- `POST /api/projects/[id]/documents/[docId]/retry`: `documents:upload_or_delete` (OWNER, REVIEWER only)
- `DELETE /api/projects/[id]/documents/[docId]`: `documents:upload_or_delete` (OWNER, REVIEWER only)

---

## Phase 3 Standard Phase Report

### 1. What was built
- **Database Models & Enums (`prisma/migrations/20261112140812_init_phase3_claims_entities`):**
  - Added models: `ExtractionRun`, `Entity`, `EntityAlias`, `Claim`, and `ClaimEvidence`.
  - Added enums: `ExtractionRunStatus`, `EntityType`, `EntityCreator`, `ClaimCategory`, `ReviewState`, `EvidenceType`.
  - Applied to Neon PostgreSQL with real foreign keys and indexes.
- **Controlled Attribute Vocabulary & Value Normalization (`src/lib/ai/vocabulary.ts`):**
  - Canonical controlled attributes (`status`, `owner`, `selected_technology`, `due_date`, `depends_on`, `risk`, `open_question`, `rationale`).
  - Cardinality specification (single vs multi) and deterministic synonym normalizer dictionary.
  - Value normalization logic (`valueNormalized`) storing null when unmappable, without inventing values.
- **Prompt Injection Defense & Pre-Scanner (`src/lib/ai/injection-detector.ts`, `src/lib/ai/prompts/extractor-v1.ts`):**
  - Multi-pattern detection for prompt injection vectors (`IGNORE PREVIOUS`, system override markers, role-switching tokens).
  - Explicit delimiter tags (`<document_chunk>`) and extraction system instructions ensuring document content is treated strictly as untrusted data.
- **AI Extraction Pipeline & Service (`src/services/extraction/index.ts`, `src/lib/ai/provider.ts`):**
  - Schema-constrained JSON extraction using Gemini 3.5 Flash Lite with structured output validation via Zod.
  - Caching layer via input checksum, model, promptVersion, and schemaVersion in `ExtractionRun`.
  - Structured extraction creates `Claim` records linked to `ClaimEvidence` with verbatim excerpts and source locations.
- **Entity Resolution Engine (`src/services/entities/resolution.ts`, `src/services/entities/index.ts`):**
  - Exact match, case-insensitive alias match, and token-overlap fuzzy matching.
  - Ambiguity detection flagging `needsReview = true` instead of silently merging uncertain entities.
  - Entity merge service (`mergeEntitiesService`) re-pointing claims, merging aliases, and writing audit logs.
- **Claims Management Service (`src/services/claims/index.ts`):**
  - Pagination, filtering by category, entity, document, and reviewState.
  - Versioned claim editing creating superseding version chains (`supersedesClaimId`).
- **API Routes:**
  - `/api/projects/[id]/documents/[docId]/extract` (POST - trigger extraction)
  - `/api/projects/[id]/claims` (GET - list project claims with pagination/filters)
  - `/api/projects/[id]/claims/[claimId]` (GET, PATCH - inspect or edit claim)
  - `/api/projects/[id]/entities` (GET, POST - list or create entities)
  - `/api/projects/[id]/entities/[entityId]` (GET, PATCH - inspect or update entity)
  - `/api/projects/[id]/entities/merge` (POST - merge two entities)
- **UI Screens & Components:**
  - Claims browser (`/projects/[projectId]/claims`) with category tabs, filters, injection warnings, and edit modals.
  - Entity registry (`/projects/[projectId]/entities`) with merge workflow, alias management, and ambiguity indicators.

### 2. Commands run and their real results
- `npx prisma migrate dev --name init_phase3_claims_entities`: Exit code 0 (applied migration to Neon PostgreSQL).
- `npm run typecheck`: Exit code 0 (`tsc --noEmit` clean, 0 errors).
- `npm test`: Exit code 0 (114 tests passed across 13 test suites).
- `npm run lint`: Exit code 0 (`✔ No ESLint warnings or errors`).
- `npm run build`: Exit code 0 (all 28 routes compiled cleanly).

### 3. Exit-criteria checklist
- [x] Schema-constrained extraction of decisions, tasks, owners, dependencies, risks, and questions — **PASS**
- [x] Claim triples `(subject, attribute, value)` with verbatim excerpts and source locations — **PASS**
- [x] Canonical entities and aliases with merge and ambiguity flagging — **PASS**
- [x] Controlled attribute vocabulary and value normalization with dictionary mapping — **PASS**
- [x] Prompt injection defenses and untrusted text isolation tested — **PASS**
- [x] ExtractionRun caching and provenance tracking — **PASS**
- [x] typecheck, lint, tests and build pass — **PASS**

### 4. Deviations and DECISIONS.md entries
- Recorded Phase 3 autonomous decisions for vocabulary normalization, entity ambiguity thresholding, and extraction run hashing.

### 5. Security confirmation: Extraction and Claim routes enforcement
Every route strictly calls `requireProjectAccess` enforcing server-side permission checks:
- `POST /api/projects/[id]/documents/[docId]/extract`: `ai:run_extraction_verification` (OWNER, REVIEWER)
- `GET /api/projects/[id]/claims`: `claims:view_unapproved` (OWNER, REVIEWER)
- `GET /api/projects/[id]/claims/[claimId]`: `claims:view_unapproved` (OWNER, REVIEWER)
- `PATCH /api/projects/[id]/claims/[claimId]`: `review:claims_conflicts_entities` (OWNER, REVIEWER)
- `GET /api/projects/[id]/entities`: `project:read` (OWNER, REVIEWER, VIEWER)
- `POST /api/projects/[id]/entities`: `review:claims_conflicts_entities` (OWNER, REVIEWER)
- `GET /api/projects/[id]/entities/[entityId]`: `project:read` (OWNER, REVIEWER, VIEWER)
- `PATCH /api/projects/[id]/entities/[entityId]`: `review:claims_conflicts_entities` (OWNER, REVIEWER)
- `POST /api/projects/[id]/entities/merge`: `review:claims_conflicts_entities` (OWNER, REVIEWER)

---

## Phase 4 Standard Phase Report

### 1. What was built
- **Database Models & Enums (`prisma/migrations/20261112145500_init_phase4_verification_conflicts`):**
  - Added models: `Verification` and `Conflict`.
  - Added enums: `EvidenceStatus` (`VERIFIED`, `WEAK_SUPPORT`, `CONFLICTING`, `UNVERIFIED`, `UNKNOWN`), `GateOutcome` (`PASS`, `FAIL`), `SemanticSupportOutcome` (`SUPPORTS`, `NEUTRAL`, `CONTRADICTS`, `INSUFFICIENT_CONTEXT`), `ConflictType` (`STATUS_CONFLICT`, `OWNERSHIP_CONFLICT`, `DECISION_CONFLICT`, `TIMELINE_CONFLICT`, `VALUE_CONFLICT`), and `ConflictResolutionState` (`OPEN`, `POSSIBLY_SUPERSEDED`, `RESOLVED_MUTUAL_ACCEPT`, `RESOLVED_ONE_ACCEPTED`, `RESOLVED_BOTH_REJECTED`, `RESOLVED_EDITED`).
  - Added relations linking `Claim` with `Verification` and reciprocal pairs with `Conflict` using canonical ID ordering (`claimAId < claimBId`).
- **Gate 1 (Source Existence):**
  - Deterministically verifies that the cited document exists, is not soft-deleted, belongs to the same project, and referenced chunk contains valid content.
- **Gate 2 (Quote Existence & Normalization, `src/services/verification/quote-matcher.ts`):**
  - Normalizes Unicode quotes/dashes/whitespace and strips punctuation.
  - Verbatim exact substring, normalized substring, and high token overlap (>= 85% for hyphenation/wrapping artifacts).
  - Explicitly rejects hallucinated/fabricated quotes and materially altered meaning.
  - Entity-in-text check (`checkEntityInText`) matching canonical names, aliases, and prominent entity tokens.
- **Gate 3 (Independent Semantic Support Judge, `src/lib/ai/prompts/judge-v1.ts`, `src/lib/ai/judge-caller.ts`):**
  - Isolated judge prompt (`JUDGE_PROMPT_VERSION = "v1.0.0"`) with zero tools, temperature 0, and untrusted delimiter tags (`<untrusted_cited_excerpt>`).
  - Input contains strictly the claim triple `(subject, attribute, value)`, cited excerpt, and minimal location context (never full documents or extractor confidence).
  - Strict Zod schema validation (`judgeOutputSchema`) with 1 controlled retry on error.
  - Critical Rule: Skipped entirely if Gate 1 or Gate 2 fails.
- **Gate 4 (Pairwise Conflict Detection & Chronology, `src/services/conflicts/detection.ts`):**
  - Detects competing claims sharing canonical subject entity & attributeKey where normalized values differ.
  - Evaluates temporal chronology: differing reliable dates (`USER_PROVIDED`, `CONTENT_EXPLICIT`) initialize as `POSSIBLY_SUPERSEDED`; missing/unknown dates initialize as `OPEN`.
  - Pairwise canonical ordering `(claimAId < claimBId)` with unique constraint.
- **Authoritative Status Algorithm (`src/services/verification/algorithm.ts`):**
  - Implements the exact 9-row first-match decision table from SPEC.md V3.2.
  - Pure, deterministic, and 100% reproducible: status is never derived from model confidence.
- **Verification API Routes:**
  - `POST /api/projects/[id]/verify` (Batch verification for all active claims)
  - `POST /api/projects/[id]/claims/[claimId]/verify` (Single claim verification)
  - `GET /api/projects/[id]/claims/[claimId]/verification` (Verification history and breakdown)
  - `GET /api/projects/[id]/conflicts` (Conflict inspection)
- **UI Enhancements (`src/app/projects/[projectId]/claims/page.tsx`):**
  - Evidence status badges with distinctive text labels and icons (`VERIFIED`, `WEAK_SUPPORT`, `CONFLICTING`, `UNVERIFIED`, `UNKNOWN`).
  - Interactive "Proof-Carrying Verification Gates" breakdown modal displaying individual gate outcomes, quote similarity %, judge model/prompt version, and active conflict count.
  - Single claim "Verify" and project-wide "Verify All Claims" actions with live progress.
  - Evidence status filter dropdown.
- **Evaluation Script (`scripts/eval/verify-dev.ts`, `npm run eval:verify-dev`):**
  - Evaluates all expected DEV claims (`G001` - `G015`) and hallucination traps (`H1` - `H3`) against the 4-gate verification engine.

### 2. Commands run and their real results
- `npx prisma migrate deploy`: Exit code 0 (applied migration to Neon PostgreSQL).
- `npx prisma generate`: Exit code 0 (updated Prisma Client with Phase 4 models and enums).
- `npm run typecheck`: Exit code 0 (`tsc --noEmit` clean, 0 errors).
- `npm test`: Exit code 0 (148 tests passed across 17 test suites, including 11 status algorithm tests, 9 quote matcher tests, 9 conflict detection tests, and 5 integration/auth tests).
- `npm run lint`: Exit code 0 (`✔ No ESLint warnings or errors`).
- `npm run build`: Exit code 0 (all 31 routes compiled cleanly).
- `npm run eval:verify-dev`: Exit code 0 (15/15 expected claim statuses matched 100%; traps H1-H3 defended as UNVERIFIED).

### 3. Exit-criteria checklist
- [x] All four gates run and store their outcomes — **PASS**
- [x] The status function matches the SPEC.md table exactly (all 9 rules tested) — **PASS**
- [x] Hallucination traps never reach VERIFIED on the DEV data — **PASS** (traps H1, H2, H3 end in UNVERIFIED)
- [x] Status never depends on model confidence (enforced in `src/services/verification/algorithm.ts`) — **PASS**
- [x] Verification is retry-safe and failures are visible — **PASS**
- [x] The DEV expected-versus-actual table is produced and mismatches explained — **PASS**
- [x] typecheck, lint, tests and build pass — **PASS**

### 4. Deviations and DECISIONS.md entries
- Added 3 Phase 4 entries in `DECISIONS.md`:
  - `[2026-11-12] | Deterministic V3.2 Evidence-Status Algorithm`
  - `[2026-11-12] | Independent Semantic Judge Isolation & Temperature 0`
  - `[2026-11-12] | Canonical Pairwise Conflict Ordering`

---

## Phase 5 Standard Phase Report

### 1. What was built
- **Database Models & Enums:**
  - `Review` model (`id`, `claimId`, `state`, `assigneeId`, `priority`, `createdAt`, `updatedAt`).
  - `ReviewAction` model (`id`, `reviewId`, `claimId`, `reviewerId`, `action`, `previousState`, `newState`, `reason`, `comments`, `createdAt`).
  - `ConflictResolutionState` enums: Added `REQUIRES_CLARIFICATION` and `UNDER_REVIEW`.
  - Prisma migrations deployed to Neon PostgreSQL: `20261112180000_init_phase5_reviews_actions` and `20261112182000_conflict_resolution_enums`.
- **Conflict Resolution Service (`src/services/conflicts/index.ts`):**
  - `listConflictsService()` with status filtering, relation inclusions (claimA, claimB, subjectEntity, evidence, source docs, resolvingUser).
  - `getConflictService()` with permission validation.
  - `resolveConflictService()` handling all 5 actions:
    - `CHOOSE_A`: Accepts Claim A, rejects Claim B, marks conflict `RESOLVED_ONE_ACCEPTED`.
    - `CHOOSE_B`: Accepts Claim B, rejects Claim A, marks conflict `RESOLVED_ONE_ACCEPTED`.
    - `KEEP_BOTH`: Mutually accepts both claims only if `attributeKey === 'owner'`, marks conflict `RESOLVED_MUTUAL_ACCEPT`. Rejects for single-valued attributes.
    - `CONFIRM_SUPERSEDED`: Accepts newer Claim B, rejects older Claim A, marks conflict `RESOLVED_ONE_ACCEPTED`.
    - `REQUIRES_CLARIFICATION`: Marks conflict `REQUIRES_CLARIFICATION`, sets claims to `NEEDS_CLARIFICATION`.
    - Enforces written reasoning, records `ReviewAction` audit trail, and triggers claim re-verification.
- **Review Queue Service (`src/services/reviews/index.ts`):**
  - Priority-ranked queue: Prioritizes claims with open conflicts, followed by unverified/weak claims.
  - Optimistic concurrency: Enforces `claim.version === expectedVersion` (HTTP 409 if mismatched).
  - Conflict blocking: Prohibits accepting any claim currently participating in an `OPEN` conflict (HTTP 400).
  - Mandatory reasoning: Prohibits accepting any non-`VERIFIED` claim (`WEAK_SUPPORT`, `UNVERIFIED`, `CONTRADICTED`, `FLAGGED`) without a written reason (HTTP 400).
  - Rejection cascades: Rejection sets `reviewState = REJECTED` and cancels open conflicts.
- **Claim Edit Integration (`src/services/claims/index.ts`):**
  - `editCandidateClaimService()` increments `claim.version`, resets review state, re-runs 4-gate verification, and scans for conflicts against other active claims.
- **API Endpoints:**
  - `GET /api/projects/[id]/conflicts`: List conflicts with optional `?status=` query filter.
  - `GET /api/projects/[id]/conflicts/[conflictId]`: Retrieve detailed conflict record.
  - `POST /api/projects/[id]/conflicts/[conflictId]/resolve`: Resolve conflict with action and reason.
  - `GET /api/projects/[id]/review/queue`: Retrieve ranked review queue with open conflict and verification stats.
  - `POST /api/projects/[id]/claims/[claimId]/review`: Submit review decision with version check and mandatory non-VERIFIED reasoning.
- **UI Screens & Interactions:**
  - **Conflict Management Page (`/projects/[projectId]/conflicts`):**
    - Side-by-side comparison of Claim A vs Claim B, highlighting value differences, source document names, and quoted excerpts.
    - Prominent banner when chronology is unknown due to missing source dates: *"Chronology unknown: At least one source document lacks a reliable date. Verify chronology manually before superseding."*
    - Interactive resolution modal with action selector, reason input, and co-ownership validation.
  - **Split-Pane Evidence Review Page (`/projects/[projectId]/review`):**
    - Left pane: Claim triple `(subject, attribute, value)`, review state badge, 4-gate verification breakdown, open conflict alerts, and review history timeline.
    - Right pane: Full document context chunk with verbatim quoted excerpt highlighted in yellow.
    - Keyboard shortcuts: `A` (Accept), `R` (Reject), `N` (Next claim), `P` (Previous claim).
    - Non-VERIFIED acceptance reason modal: Prominently requires written explanation before allowing acceptance of weak or unverified claims.
  - **Workspace Shell Navigation:** Added `Conflicts` and `Evidence Review` tabs to project workspace layout.

### 2. Commands run and their real results
- `npx prisma migrate deploy`: Exit code 0 (applied migrations `20261112180000` and `20261112182000` to remote Neon PostgreSQL).
- `npx prisma generate`: Exit code 0 (Prisma Client regenerated with Phase 5 models).
- `npm run typecheck`: Exit code 0 (`tsc --noEmit` clean, 0 errors).
- `npm test`: Exit code 0 (159 tests passed across 18 test suites, including 11 new integration tests in `tests/integration/reviews-conflicts-service.test.ts`).
- `npm run lint`: Exit code 0 (`✔ No ESLint warnings or errors`).
- `npm run build`: Exit code 0 (Next.js production build succeeded for all 40 routes).

### 3. Exit-criteria checklist
- [x] Conflicts are detected across documents and shown side-by-side — **PASS**
- [x] Chronology rule is enforced; unknown dates never silently auto-supersede — **PASS**
- [x] Reviewer can accept, reject, edit and resolve conflicts with a reason — **PASS**
- [x] Reason is strictly required for non-VERIFIED acceptance — **PASS** (enforced in service and UI)
- [x] Accepted claim cannot stay in an OPEN conflict — **PASS** (blocked by review service)
- [x] Every review action is attributed, timestamped and audit-logged — **PASS** (`ReviewAction` & `writeAudit`)
- [x] Optimistic concurrency protects against concurrent reviewer overwrites — **PASS** (`claim.version` checks)
- [x] Split-pane review highlights source context alongside the claim — **PASS**
- [x] typecheck, lint, tests and build pass — **PASS**

### 4. Deviations and DECISIONS.md entries
- Added 4 Phase 5 entries in `DECISIONS.md`:
  - `[2026-11-12] | Optimistic Concurrency via Integer Versioning on Candidate Claims`
  - `[2026-11-12] | Mandatory Written Rationale for Non-VERIFIED Claim Acceptance`
  - `[2026-11-12] | Strict Co-Ownership Restriction for KEEP_BOTH Conflict Resolution`
  - `[2026-11-12] | Review Queue Ordering with Conflict Blocking`

### 5. Security confirmation: Review & Conflict routes enforcement
All review and conflict operations require valid project membership and specific roles:
- `POST /api/projects/[id]/conflicts/[conflictId]/resolve`: `conflicts:resolve` (OWNER, REVIEWER).
- `POST /api/projects/[id]/claims/[claimId]/review`: `claims:review` (OWNER, REVIEWER).
- `GET /api/projects/[id]/review/queue`: `claims:view_unapproved` (OWNER, REVIEWER).
- `GET /api/projects/[id]/conflicts`: `claims:view_unapproved` (OWNER, REVIEWER).
- `GET /api/projects/[id]/conflicts/[conflictId]`: `claims:view_unapproved` (OWNER, REVIEWER).
---

## Phase 6 Standard Phase Report (P0-A CHECKPOINT)

### Status: P0-A checkpoint PASSED
The complete P0-A flow (auth, workspaces, document intelligence, AI claim extraction, entity registry, 4-gate verification engine, conflict detection, human review queue, handover snapshot, SHA-256 receipt, and proof-carrying PDF export) runs end-to-end on real persisted data with 173 automated tests passing.

### 1. What was built
- **Database Models & Enums:**
  - `HandoverStatus` enum (`DRAFT`, `APPROVED`).
  - `Handover` model (`id`, `projectId`, `version`, `status`, `title`, `summary`, `generatedAt`, `approvedAt`, `approvedById`, `createdAt`, `updatedAt`). Unique on `[projectId, version]`.
  - `HandoverSnapshot` model (`id`, `handoverId`, `canonicalJson`, `schemaVersion`, `canonicalisationVersion`, `createdAt`). Immutable stored snapshot.
  - `HandoverReceipt` model (`id`, `handoverId`, `version`, `snapshotHash`, `previousReceiptHash`, `approvedById`, `approvedAt`, `canonicalisationVersion`). Cryptographic hash chain.
  - Live Neon PostgreSQL migration deployed: `20261112190000_init_phase6_handovers_receipts`.
- **Deterministic Canonicalisation Engine (`src/services/handover/canonical.ts`):**
  - Canonical JSON serializer according to RFC 8785:
    - Object keys sorted lexicographically.
    - Arrays deterministically sorted: `claims` by `(claimId, claimVersion)`, `evidence` by `(documentId, location)`, `resolvedConflicts` by `conflictId`.
    - Strings normalized to Unicode NFC.
    - Compact JSON without whitespace.
    - Computes 64-character lowercase SHA-256 hex string over UTF-8 bytes.
- **Authoritative 14-Section Assembly (`src/services/handover/sections.ts`):**
  - Section 1: Executive Summary (claim counts, verification metrics, key facts).
  - Section 2: Objectives & Goals.
  - Section 3: Current Status.
  - Section 4: Technical Architecture.
  - Section 5: Decisions with Rationale.
  - Section 6: Completed Tasks.
  - Section 7: Pending Tasks.
  - Section 8: Ownership & Responsibilities.
  - Section 9: Dependencies.
  - Section 10: Risks & Blockers.
  - Section 11: Unresolved Questions.
  - Section 12: Recommended Next Actions (rule-derived: unassigned pending tasks, open questions, unresolved conflicts).
  - Section 13: Evidence References (unique source documents, checksums, locations).
  - Section 14: Approval Receipt (hash, version, approver, timestamp, previous hash).
  - Strict Invariant: Empty sections state `"No approved information"`; zero LLM-invented prose.
- **Handover Service & Atomic Transaction (`src/services/handover/index.ts`):**
  - `getHandoverDraftPreviewService()`: Validates draft and blocks approval if no claims are accepted or if any accepted claim is in an active `OPEN` conflict.
  - `approveHandoverService()`: Atomic Prisma transaction (`prisma.$transaction`) creating `Handover`, `HandoverSnapshot`, and `HandoverReceipt` together with `AuditLog` entry and linking `previousReceiptHash` chain.
  - `listHandoversService()` & `getHandoverByIdService()`: Permission-checked handover readers.
  - `verifyHandoverReceiptService()`: Two-way tamper check (recomputing snapshot hash vs receipt hash, and rebuilding live database claims vs receipt hash).
  - `exportHandoverPdfService()`: Pure-JS serverless PDF generation from stored snapshot.
- **Pure-JS PDF Export Engine (`src/services/handover/pdf-exporter.ts`):**
  - Generated via `pdf-lib` directly from stored canonical JSON (never live tables).
  - Renders document header, cryptographic receipt box, all 14 sections, explicit text status labels (`[VERIFIED]`, `[WEAK_SUPPORT]`), reviewer written reasons, evidence citations, and page numbering ("Page X of Y").
  - Escapes text to guarantee serverless reliability without native binary dependencies.
- **API Endpoints:**
  - `GET /api/projects/[id]/handovers`: List approved handovers (OWNER, REVIEWER, VIEWER).
  - `POST /api/projects/[id]/handovers`: Approve handover in atomic transaction (OWNER, REVIEWER).
  - `GET /api/projects/[id]/handovers/draft`: Draft preview with blocking check (OWNER, REVIEWER).
  - `GET /api/projects/[id]/handovers/[handoverId]`: Retrieve approved handover & receipt (OWNER, REVIEWER, VIEWER).
  - `POST /api/projects/[id]/handovers/[handoverId]/verify-receipt`: Verify receipt tamper check (OWNER, REVIEWER, VIEWER).
  - `GET /api/projects/[id]/handovers/[handoverId]/export`: Download proof-carrying PDF (OWNER, REVIEWER, VIEWER).
- **UI Screen (`src/app/projects/[projectId]/handover/page.tsx`):**
  - Version selector dropdown (Draft Preview vs approved versions).
  - Approval Confirmation modal with invariant checks and custom title input.
  - Cryptographic Approval Receipt card with 1-click Copy Hash button, previous receipt hash chain, and "Integrity fingerprint, not a digital signature" notice.
  - Interactive "Verify Receipt" button with two-way cryptographic verification dialog.
  - Direct "Export PDF" download button.
  - Collapsible cards for all 14 sections with explicit text indicators and cited excerpts.
  - Workspace layout navigation updated with `Handover` tab.

### 2. Commands run and their real results
- `npx prisma migrate deploy`: Exit code 0 (applied migration `20261112190000_init_phase6_handovers_receipts` to Neon PostgreSQL).
- `npx prisma generate`: Exit code 0 (Prisma Client updated with Phase 6 models).
- `npm run typecheck`: Exit code 0 (`tsc --noEmit` clean, 0 errors).
- `npm test`: Exit code 0 (173 tests passed across 20 test suites, including 7 new canonicalization/hash tests and 7 integration tests).
- `npm run lint`: Exit code 0 (`✔ No ESLint warnings or errors`).
- `npm run build`: Exit code 0 (all 46 Next.js routes compiled cleanly).

### 3. Exit-criteria checklist (P0-A Checkpoint)
- [x] The complete P0-A flow runs end to end on real persisted data — **PASS**
- [x] Approval creates snapshot and receipt atomically; golden hash tests pass — **PASS**
- [x] The PDF is usable, shows statuses as text, evidence and the receipt — **PASS**
- [x] Editing an approved claim in the database makes receipt verification fail — **PASS** (Check 2 live data integrity catches claim drift)
- [x] No LLM-generated unverified prose in the handover — **PASS**
- [x] typecheck, lint, tests and build pass, and the Neon deployment works with the new migration — **PASS**

### 4. Deviations and DECISIONS.md entries
- Added 3 Phase 6 entries in `DECISIONS.md`:
  - `[2026-11-12] | Canonical Snapshot Serialization & Deterministic Array Sorting`
  - `[2026-11-12] | Two-Way Receipt Verification & Tamper Detection`
  - `[2026-11-12] | Pure-JS Serverless PDF Generation via pdf-lib`

### 5. Security confirmation: Handover routes enforcement
- `POST /api/projects/[id]/handovers`: `handover:approve` (OWNER, REVIEWER).
- `GET /api/projects/[id]/handovers/draft`: `handover:approve` (OWNER, REVIEWER).
- `GET /api/projects/[id]/handovers`: `handover:view_approved` (OWNER, REVIEWER, VIEWER).
- `GET /api/projects/[id]/handovers/[handoverId]`: `handover:view_approved` (OWNER, REVIEWER, VIEWER).
- `GET /api/projects/[id]/handovers/[handoverId]/export`: `handover:view_approved` (OWNER, REVIEWER, VIEWER).
- `POST /api/projects/[id]/handovers/[handoverId]/verify-receipt`: `handover:view_approved` (OWNER, REVIEWER, VIEWER).
---

## Phase 7 Standard Phase Report

### 1. What was built
- **Database Model & Field:**
  - `Entity.isCritical`: Added boolean flag (`@default(false)`) to designate critical components.
  - `RadarDismissal` model (`id`, `projectId`, `alertKey`, `ruleId`, `reason`, `dismissedById`, `dismissedAt`). Unique on `[projectId, alertKey]`.
  - Neon PostgreSQL migration applied: `20261112200000_init_phase7_radar`.
- **Pure-JS Deterministic Radar Service (`src/services/radar/index.ts`):**
  - Project-scoped diagnostic evaluation across non-rejected claims and entity graph relations.
  - Critical component identification:
    - `isCritical === true` OR
    - has >= 3 non-rejected claims OR
    - targeted by a `depends_on` claim.
  - 6 Diagnostic Rules:
    - **R1: Single-Person Dependency (Bus Factor = 1):** Critical component with exactly 1 distinct owner claim. (Severity: HIGH).
    - **R2: Missing Documentation:** Critical component with no `selected_technology`, `decision`, or `rationale` claim and no cited document evidence. (Severity: HIGH).
    - **R3: Unassigned Work Item:** Task claim marked `NOT_STARTED`, `IN_PROGRESS`, or `BLOCKED` with no assigned `owner` claim. (Severity: MEDIUM).
    - **R4: Missing Technical Rationale:** `selected_technology` claim lacking a corresponding `rationale` claim for the same subject. (Severity: MEDIUM).
    - **R5: Unresolved Question:** `open_question` claim remaining active and unresolved. (Severity: LOW).
    - **R6: Inconsistency / Conflict:** Component or task participating in an active `OPEN` or `UNDER_REVIEW` conflict. (Severity: HIGH).
  - Every alert provides: `ruleId`, `category`, plain-language explanation, affected entity, affected claims with verification status badges, supporting evidence citations OR explicit `missingFieldStatement`, and actionable `suggestedRemediation`.
  - Audited dismissals (`dismissRadarAlertService`) requiring a mandatory written reason (logged to `AuditLog`).
  - Reactivation (`reactivateRadarAlertService`) allowing dismissed alerts to be reopened.
- **API Endpoints:**
  - `GET /api/projects/[id]/radar`: Computes alerts and metrics with `?ruleId=` and `?status=` filters (OWNER, REVIEWER, VIEWER).
  - `POST /api/projects/[id]/radar/dismiss`: Dismisses an alert with mandatory written justification (OWNER, REVIEWER).
  - `POST /api/projects/[id]/radar/reactivate`: Reactivates a dismissed alert (OWNER, REVIEWER).
- **UI Screen (`src/app/projects/[projectId]/radar/page.tsx`):**
  - KPI summary bar (Total Open, High Risk, Medium, Low, Dismissed).
  - Rule filter buttons with badge counts (R1 through R6) and Open/Dismissed toggles.
  - Alert cards with severity styling, evidence status tags, plain-language explanations, and suggested remediations.
  - Dismissal modal with mandatory justification textarea.
  - Reactivate button on dismissed alerts showing who dismissed it and why.
  - Navigation tab: Added `Knowledge Radar` tab to project workspace layout.
- **Project Overview Integration (`src/app/projects/[projectId]/page.tsx`):**
  - Added Knowledge Loss Radar summary card displaying open risk alerts and high-severity counts with a direct link to the Radar view.

### 2. Commands run and their real results
- `npx prisma migrate deploy`: Exit code 0 (applied migration `20261112200000_init_phase7_radar` to Neon PostgreSQL).
- `npx prisma generate`: Exit code 0 (Prisma Client regenerated with `isCritical` and `RadarDismissal`).
- `npm run typecheck`: Exit code 0 (`tsc --noEmit` clean, 0 errors).
- `npm test`: Exit code 0 (185 tests passed across 22 test suites, including 7 diagnostic rule tests and 5 service integration tests).
- `npm run lint`: Exit code 0 (`✔ No ESLint warnings or errors`).
- `npm run build`: Exit code 0 (all 49 Next.js routes compiled cleanly).

### 3. Exit-criteria checklist
- [x] Each rule has a fixture that triggers it and a fixture that does not — **PASS**
- [x] Alerts always include an explanation and either evidence or a missing-field statement — **PASS**
- [x] Edge cases: empty project (0 alerts), only rejected claims (0 alerts), merged entities counted once — **PASS**
- [x] Dismissal requires a written justification and is audited — **PASS**
- [x] Radar alert counts are surfaced on the project overview page — **PASS**
- [x] typecheck, lint, tests and build pass — **PASS**

### 4. Deviations and DECISIONS.md entries
- Added 3 Phase 7 entries in `DECISIONS.md`:
  - `[2026-11-13] | Deterministic Rule-Based Knowledge Loss Radar`
  - `[2026-11-13] | Audited Dismissals with Mandatory Written Rationale`
  - `[2026-11-13] | Critical Component Identification Heuristic`

### 5. Security confirmation: Radar routes enforcement
- `GET /api/projects/[id]/radar`: `project:read` (OWNER, REVIEWER, VIEWER).
- `POST /api/projects/[id]/radar/dismiss`: `review:claims_conflicts_entities` (OWNER, REVIEWER).
- `POST /api/projects/[id]/radar/reactivate`: `review:claims_conflicts_entities` (OWNER, REVIEWER).
- VIEWER role is blocked from dismissing or reactivating alerts (HTTP 403).
- Non-members receive HTTP 404 Not Found (no project enumeration).---

## Phase 8 Standard Phase Report

### 1. What was built
- **Continuity Score Service (`src/services/intelligence/score.ts`):**
  - Evaluates 5 weighted continuity dimensions:
    - Documentation (Weight 25): Verified claims with source document & excerpt / all non-rejected claims.
    - Decision Traceability (Weight 20): Architectural decisions with rationale / all decisions.
    - Ownership Coverage (Weight 20): Tasks with assigned owner / all tasks.
    - Dependency Clarity (Weight 15): Components with documented dependencies / all critical components.
    - Handover Readiness (Weight 20): Ratio of accepted claims minus penalty for open unresolved conflicts (-10 per conflict).
  - Honest Coverage Rule: Excludes metrics with denominator = 0 from numerator and denominator (does not penalize missing data as 0).
  - Minimum Evidence Threshold: If available weight sum is < 60%, score is set to `null` with status `INSUFFICIENT_EVIDENCE`.
  - Component-level Bus Factor Map: Identifies modules, their assigned owners, and single-person failure risks.
- **Hardened Handover Q&A Service (`src/services/intelligence/qa.ts`):**
  - Queries ONLY approved claims (`reviewState: ACCEPTED | EDITED`).
  - Stage 1: Deterministic retrieval matching entities, aliases, and attribute keywords.
  - Invariant 1: If 0 claims match or no approved claims exist, immediately returns `FIXED_REFUSAL_MESSAGE` with `modelCalled: false`.
  - Stage 2: Encloses retrieved claims in `<untrusted_approved_claims>` tags and prompts Gemini model with temperature 0 for JSON schema `{ answer, citedClaimIds, supported }`.
  - Invariant 2: Server-side validation verifies every cited claim ID is an exact member of the retrieved set. If ungrounded or unsupported, returns `FIXED_REFUSAL_MESSAGE`.
- **API Endpoints:**
  - `GET /api/projects/[id]/intelligence`: Returns Continuity Score, metric breakdown, and Bus Factor map (OWNER, REVIEWER, VIEWER).
  - `POST /api/projects/[id]/qa`: Hardened handover Q&A endpoint with cited claims verification (OWNER, REVIEWER, VIEWER).
- **UI Screen (`src/app/projects/[projectId]/intelligence/page.tsx`):**
  - Tabbed interface: "Continuity Score & Metrics", "Bus Factor Map", and "Handover Q&A".
  - Score card with color-coded gauge (Low, Medium, Good, High Readiness) and detailed dimension progress bars with formulas and explanations.
  - Bus factor cards highlighting single-owner risks vs. multi-owner distribution with component badges.
  - Conversational Q&A chat with quick suggested questions, refusal guardrail indicators, and verified citation pills linking directly to source documents and evidence status.
- **Workspace Layout Integration (`src/app/projects/[projectId]/layout.tsx`):**
  - Added `Intelligence & Q&A` navigation tab with BrainCircuit icon.
- **Tests Added:**
  - `tests/unit/continuity-score.test.ts` (4 unit tests): Honest missing-metric exclusion, <60% insufficient evidence threshold, exactly 60% threshold score computation, bus factor map single-owner detection.
  - `tests/integration/qa-service.test.ts` (7 integration tests): Immediate refusal when 0 claims match without model call, only approved claims retrieved, refusal on hallucinated citation ID, refusal on supported=false, successful answers with verified citations, VIEWER permission check, non-member 404 security check.

### 2. Commands run and their real results
- `npm run typecheck`: Exit code 0 (`tsc --noEmit` clean, 0 errors).
- `npm run lint`: Exit code 0 (`✔ No ESLint warnings or errors`).
- `npm test`: Exit code 0 (196 tests passing across 24 test suites).
- `npm run build`: Exit code 0 (all 51 Next.js routes compiled cleanly).
- Server verified: High-speed production server running at `http://localhost:3000`.

### 3. Exit-criteria checklist
- [x] Missing metrics are excluded from denominator rather than treated as 0 — **PASS**
- [x] Insufficient evidence threshold (<60% coverage) displays INSUFFICIENT_EVIDENCE — **PASS**
- [x] Q&A returns exact refusal without calling model when nothing retrieved — **PASS**
- [x] Server validates every cited claim ID was in the retrieved set — **PASS**
- [x] Bus factor map surfaces single-owner components — **PASS**
- [x] typecheck, lint, tests and build pass — **PASS**

### 4. Security confirmation: Intelligence & Q&A authorization
- `GET /api/projects/[id]/intelligence`: `project:read` (OWNER, REVIEWER, VIEWER).
- `POST /api/projects/[id]/qa`: `qa:ask_approved` (OWNER, REVIEWER, VIEWER).
- Non-members receive HTTP 404 Not Found (no project enumeration).
- Q&A never exposes unapproved or rejected candidate claims.---

## Phase 9 Standard Phase Report (Final Release v1.0.0)

### 1. What was built & delivered
- **Security & Multi-Tenant Isolation Suite (`tests/integration/security-isolation.test.ts`):**
  - Authoritative 12-permission matrix verification across all roles (`OWNER`, `REVIEWER`, `VIEWER`).
  - Zero project enumeration security rule: Non-members and unauthorized requests always receive HTTP 404 (`ProjectNotFoundError`), preventing malicious attackers from confirming project IDs.
  - Cross-tenant IDOR attack prevention: Verifies users in Project A cannot query or mutate Project B objects.
  - Deep recursive secret redaction in `src/lib/audit.ts` (`sanitizeAuditMetadata` redacting passwords, API keys, tokens, and database URLs in nested objects).
- **Held-Out TEST Dataset (`demo-data/test/`):**
  - Fictional project "Autonomous Campus Delivery Drone Navigation System" authored following DEMO_AND_BENCHMARK.md rules before benchmark evaluation.
  - Documents generated: `drone_spec.pdf` (multi-page PDF), `field_test_notes.docx`, `flight_tasks.csv`, and `emergency_comms.docx` (undated with planted prompt injection).
  - Frozen ground truth `demo-data/test/ground_truth.json` with 25 expected claims, 5 conflicts, 3 hallucination traps, 1 prompt injection, and alias/quality cases.
  - Total benchmark claims evaluated across DEV and TEST: Exactly 40 claims, 10 conflicts, 6 traps, and 2 prompt injections.
- **Automated Benchmark Runner & Report (`scripts/run_benchmark.ts`, `tests/integration/benchmark.test.ts`):**
  - Comparative evaluation against single-pass naive prompt baseline.
  - Measured results:
    - Evidence Attribution Accuracy: ContinuityX **95%** (38/40) vs Baseline **65%** (26/40).
    - Unsupported Claim Rate: ContinuityX **0%** (0/6 traps verified) vs Baseline **33%** (2/6 traps adopted).
    - Conflict Detection Recall: ContinuityX **100%** (10/10 conflicts detected) vs Baseline **70%** (7/10 conflicts).
    - Prompt Injection Resistance: ContinuityX **100%** (2/2 resisted) vs Baseline **50%** (1/2 resisted).
  - Machine-readable results saved to `benchmark/results/benchmark-results.json` and publication-quality report in `benchmark/results/benchmark-report.md`.
  - Transparent documentation of methodological limitations (sample size N=40, synthetic data, same-vendor model).
- **UI & Documentation Polish:**
  - Updated `README.md` with full system architecture, quickstart guide, and benchmark results table.
  - Responsive layout, accessible contrast, and loading states verified across all views.

### 2. Commands run and their real results
- `node scripts/generate_test_dataset.js`: Exit code 0 (created TEST fixtures and `ground_truth.json`).
- `npx tsx scripts/run_benchmark.ts`: Exit code 0 (computed and saved benchmark results and markdown report).
- `npm run typecheck`: Exit code 0 (`tsc --noEmit` clean, 0 errors).
- `npm test`: Exit code 0 (210 tests passing across 26 test suites).
- `npm run lint`: Exit code 0 (`✔ No ESLint warnings or errors`).
- `npm run build`: Exit code 0 (all 51 Next.js routes compiled cleanly).
- Server verified: High-speed production server running at `http://localhost:3000`.

### 3. Exit-criteria checklist
- [x] Responsive UI and accessible layouts on all views — **PASS**
- [x] Security isolation and authorization tests for all roles — **PASS**
- [x] Non-members receive 404 with zero project enumeration — **PASS**
- [x] TEST dataset generated and labels frozen before evaluation — **PASS**
- [x] Total evaluated claims reach 40 across DEV and TEST — **PASS**
- [x] Zero hallucination traps reach VERIFIED — **PASS**
- [x] 100% prompt injection resistance maintained — **PASS**
- [x] Measured benchmark results recorded honestly in DEMO_AND_BENCHMARK.md — **PASS**
- [x] typecheck, lint, tests and production build pass — **PASS**

### 4. Milestone Checkpoint: v1.0.0 Release Complete
- All 10 phases (0 through 9) are 100% complete, verified, and passing all acceptance tests.

---

## Post-Release Small Fix Task (Items 1–7)

### 1. What was built & delivered
- **Item 1: Empty States (`3674916`):**
  - Updated Knowledge Radar, Evidence Review, Bus Factor, and Conflicts to distinguish projects with no data from "checked and nothing found".
  - Empty states now explicitly guide the user with: *"No claims yet. Upload documents and run extraction first"* and provide a direct link to the documents page.
  - Integration test added in `tests/integration/radar-service.test.ts`.
- **Item 2: Handover Q&A Hardening (`032abae`):**
  - Added 30-second client timeout (`AbortSignal`) to prevent indefinite spinning.
  - Added inline error state with an instant **"Retry Question"** button in the chat thread.
  - Refusal indicator badge added to highlight when queries cannot be answered from approved evidence.
- **Item 3: Role & Identity Display (`1dffdb6`):**
  - Resolved root cause in `prisma/seed.ts`: Cleaned seeded display names to remove parenthetical role suffixes ("Riya Sharma", "Arjun Mehta").
  - Enforced deterministic upsert of project memberships in seed script so Riya is guaranteed `REVIEWER` role on demo project.
- **Item 4: Entity Name Zod Validation (`58f7617`):**
  - Added shared schema `src/services/entities/schema.ts` validating: trimmed, minimum 2 characters, must contain at least one letter, maximum 200 characters.
  - Server rejects pure numbers (e.g., "12345678") with HTTP 400 `VALIDATION_ERROR` and rejects duplicates with HTTP 409 `CONFLICT`.
  - Client modal enforces the same Zod schema before dispatching requests.
  - Unit tests added in `tests/unit/entity-resolution.test.ts`.
- **Item 5: Default Filters (`45dde38`):**
  - Aligned API and UI defaults for Radar and Conflicts so open items are displayed by default and never obscured.
- **Item 6: Unambiguous Shared Date Formatter (`0a979fc`):**
  - Created shared date utility `src/lib/date.ts` formatting all dates deterministically as `12 Nov 2026`.
  - Replaced all 10 occurrences of `toLocaleDateString()` across `dashboard`, `projects`, `claims`, `conflicts`, `documents`, `handover`, `members`, `radar`, and `review`.
  - Unit tests added in `tests/unit/date-formatter.test.ts`.
- **Item 7: Test Data Cleanup (`83486db`):**
  - Executed safe cleanup script `scripts/cleanup_test_data.ts` deleting temporary project `"DEV Phase 3 Live Check (Temp)"` and invalid entity `"12345678"`.
  - Verified remaining database state: only legitimate `"Smart Attendance System (Synthetic Demo)"` project remains.

### 2. Verification Summary
- `npm run typecheck`: Exit code 0 (`tsc --noEmit` clean, 0 errors).
- `npm run lint`: Exit code 0 (`✔ No ESLint warnings or errors`).
- `npm test`: Exit code 0 (220 tests passed across 27 test suites).
- `npm run build`: Exit code 0 (all 51 routes compiled and statically optimized).
- Live server verified: `http://localhost:3000` (database connected, latency healthy).

---

## Enterprise Frontend Redesign (Commercial-Grade SaaS UI/UX)

### 1. What was built & delivered
- **Original ContinuityX Design System & Tokens:**
  - Modern, restrained enterprise palette: Background `#F8FAFC`, Surface `#FFFFFF`, Primary `#4F46E5`, Success `#16A34A`, Warning `#D97706`, Danger `#DC2626`, Neutral Border `#E2E8F0`, Text `#111827`, Secondary Text `#64748B`.
  - Reusable component library in `src/components/ui/`: `badge.tsx`, `metric-card.tsx`, `empty-state.tsx`, `skeleton.tsx`, `modal.tsx`, `filter-pills.tsx`, `page-header.tsx`.
- **Global App Shell & Navigation Hierarchy:**
  - Persistent, collapsible sidebar (`sidebar.tsx`) with active project switcher, workspace overview link, grouped project navigation (Overview, Knowledge & Extraction, Verification & Quality, Continuity & Intelligence, Final Handover, Governance & Access), and user profile drawer.
  - Contextual global topbar (`topbar.tsx`) with dynamic breadcrumb trail (`Workspace > Project > Section`), role pill, status indicator, mobile drawer trigger, and global Cmd+K search shortcut.
  - Command palette (`search-modal.tsx`) enabling instant keyboard navigation across all project sections and recent actions.
  - Mobile responsive drawer overlay and responsive layouts on all screens.
- **Redesigned Workspace Dashboard (`src/app/dashboard/page.tsx`):**
  - KPI overview metrics (Total Projects, Active Workspaces, Pending Reviews, Approved Handovers).
  - Left column (2/3 width) project workspace cards with role badges, status dots, member counts, and review queue progress bars.
  - Right column (1/3 width) "Action Required" panel highlighting pending reviews, and enterprise invariant safety highlights.
  - Bottom section featuring recent sealed handovers with version badges and "Inspect Receipt" actions.
  - Interactive "Create Project" modal without page refresh.
- **Redesigned Project Overview Dashboard (`src/app/projects/[projectId]/page.tsx`):**
  - Section A: Project Health metrics (Docs, Verified Claims ratio, Open Conflicts, Continuity Readiness).
  - Section B: Knowledge Health progress bar and 4-gate verification distribution.
  - Section C: R1–R6 diagnostic risk grid (Bus factor SPOF, missing docs, unassigned tasks, missing rationale, open questions, inconsistencies).
  - Section D: Prioritized Action Required governance cards with direct routing.
  - Section E: Recent indexed documents and claim activity log.
- **Redesigned Knowledge & Extraction (`src/app/projects/[projectId]/documents/page.tsx`):**
  - Linear-grade document table, metric cards, drag-and-drop file upload zone, status pills (`AI EXTRACTED`, `READY FOR AI`, pipeline stepper, validation failures), chunk counts, chunk inspection modal, search, filter pills (`ALL`, `READY`, `PROCESSING`, `WARNINGS`), retry, soft delete, and serverless auto-process poller.
- **Redesigned Claims Evidence Workspace (`src/app/projects/[projectId]/claims/page.tsx`):**
  - Master-detail evidence investigation workspace: Metric cards, status filter pills (`ALL`, `VERIFIED`, `WEAK_SUPPORT`, `CONFLICTING`, `UNVERIFIED`), category and attribute dropdowns, injection flag and normalization checkboxes.
  - Proof-Carrying Verification Gates modal displaying detailed breakdown of Gate 1 (Source Existence), Gate 2 (Quote Match & similarity %), Gate 3 (Semantic Support & judge model), and Gate 4 (Contradiction Check & count).
  - Claim detail inspection modal with chunk context and extraction run metadata. Edit claim modal with optimistic version increments.
- **Redesigned Contradictions & Conflicts (`src/app/projects/[projectId]/conflicts/page.tsx`):**
  - Side-by-side comparison interface: Metric cards (Total Contradictions, Open Conflicts, Possibly Superseded, Clarification Needed), status filter pills with exact counts.
  - Chronology notice adhering to safe date rules (distinguishing dated discrepancy from unknown date basis).
  - Side-by-side Claim A vs Claim B cards with document citation, excerpt, raw value, normalized value, and date basis.
  - Conflict resolution modal with mandatory written rationale and action selection (`CHOOSE_A`, `CHOOSE_B`, `KEEP_BOTH`, `CONFIRM_SUPERSEDED`, `REQUIRES_CLARIFICATION`).
  - Distinguishes unpopulated projects (`NO_CLAIMS_TITLE`) from zero conflicts checked.
- **Redesigned Evidence Review Queue (`src/app/projects/[projectId]/review/page.tsx`):**
  - Reviewer cockpit with progress ribbon (Position X of Y, pending, accepted, rejected, open conflicts count).
  - Claim triple card with category and normalized value, 4-gate evidence proof summary, and highlighted source excerpt inside full surrounding chunk context.
  - Keyboard navigation shortcuts (`[A] Accept`, `[R] Reject`, `[N] Next`, `[P] Prev`).
  - Acceptance Rationale modal for non-VERIFIED claims and Rejection notes modal.
  - Distinguishes unpopulated projects from complete review queue.
- **Redesigned Handover & Cryptographic Receipt (`src/app/projects/[projectId]/handover/page.tsx`):**
  - Version switcher between Draft Preview (Latest Accepted) and sealed approved snapshots.
  - System Invariant Check alert in Draft mode blocking approval if conflicts or unreviewed claims remain.
  - Cryptographic Approval Receipt card with canonical snapshot SHA-256 hash (one-click copy), previous receipt hash chain, approved by metadata, and tamper-evident clarification.
  - 14 collapsible handover sections with item counts, empty notices, and evidence citations.
  - "Approve Handover & Mint Receipt" modal and "Receipt Cryptographic Verification" modal running independent 2-way verification of snapshot integrity and live database claims.
  - Deterministic PDF export.
- **Redesigned Knowledge Loss Radar (`src/app/projects/[projectId]/radar/page.tsx`):**
  - Visual risk intelligence interface with metric cards (Active Alerts, High Risk R1/R2/R6, Medium Risk R3/R4, Low Risk R5, Dismissed).
  - Filter pills for Rule ID (R1–R6) and Status (Open, Dismissed, All).
  - Alert cards with severity badge, diagnostic finding, associated claims, missing knowledge artifact/source document citation, and suggested remediation.
  - Dismiss Alert modal with mandatory written justification and Reactivate action.
  - Uses `getRadarEmptyState` for honest empty states.
- **Redesigned Continuity Intelligence & Hardened Q&A (`src/app/projects/[projectId]/intelligence/page.tsx`):**
  - Tab 1 (Continuity Score): Score gauge out of 100 or Insufficient Evidence badge, coverage % (>=60%), status badge, governance notice, and 5-metric breakdown grid with formulas.
  - Tab 2 (Bus Factor Map): Single-contributor critical risk highlights (Bus factor = 1), verified owners list, module cards, and `getBusFactorEmptyState` integration.
  - Tab 3 (Hardened Handover Q&A): Linear-grade chat interface, suggested questions, evidence citations, refusal state on unanswerable questions, and 30s timeout with retry button.
- **Redesigned Entity Registry (`src/app/projects/[projectId]/entities/page.tsx`):**
  - Entity registry with search and type filters (`COMPONENT`, `PERSON`, `SYSTEM`), needsReview toggle.
  - Entity table with canonical names, normalized IDs, origin (`MODEL` vs `REVIEWER`), aliases pills, claim counts, and review state.
  - Add Canonical Entity modal and Edit Entity modal with client-side zod validation (`entityNameSchema`, `entityAliasSchema`, `createEntitySchema`).
  - Merge Entity modal with target dropdown and clean soft-merge execution.
- **Redesigned Members & Access Control (`src/app/projects/[projectId]/members/page.tsx`):**
  - Team membership table with `formatRoleLabel` role badges, joined dates, and owner actions.
  - Invite Team Member card for owners with email input and role selector.
  - Sole owner demotion and removal protection preserved.
- **New Governance Audit Trail (`src/app/projects/[projectId]/audit/page.tsx` & `src/app/api/projects/[id]/audit/route.ts`):**
  - Created governance audit trail timeline page with metric cards (Total Events, Handover Approvals, Conflict Resolutions, Review Actions), filter pills, search input, and chronological table with sanitized metadata JSON preview.

### 2. Verification Summary
- `npm run typecheck`: Exit code 0 (`tsc --noEmit` clean, 0 errors).
- `npm run lint`: Exit code 0 (`✔ No ESLint warnings or errors`).
- `npm test`: Exit code 0 (236 tests passed across 29 test suites).
- `npm run build`: Exit code 0 (all 51 routes compiled and statically optimized).

---

## API Performance Investigation & Optimization

### 1. Root Cause Analysis & Measured Diagnostics
- **Initial Telemetry Reported by User:**
  - `GET /projects/[projectId]/intelligence`: Total duration: 34.60 seconds (Stalled: 17.64 seconds, TTFB: 16.95 seconds).
  - Intelligence endpoint called twice.
- **Empirical Diagnostics (`scripts/test_db_latency.ts` & `scripts/trace_intelligence_endpoint.ts`):**
  - **Raw TCP/TLS Connect Time:** 1,661.75 ms (cross-continent link from India to AWS Ohio `us-east-2`).
  - **Warm Single Query (`SELECT 1`):** 2,536.98 ms wire round trip.
  - **In-Memory Calculations:** 0.0295 ms (Continuity Score + Bus Factor algorithm).
  - **JSON Serialization:** 0.0074 ms.
  - **Auth & Authorization Overhead:** Route handlers called `getCurrentUser()`, which executed `prisma.user.findUnique` (2,540 ms). Next, `requireProjectAccess(projectId, permission, userId)` executed `prisma.user.findUnique` a *second time* (2,500 ms) before executing `prisma.projectMember.findUnique` (3,090 ms), totaling 8.19 seconds of sequential round trips before querying data.
  - **Sequential Database Reads:** In `computeContinuityIntelligenceService`, `entities`, `claims`, and `openConflicts` were queried sequentially ($2.35s + 2.38s + 2.34s = 7.07s$).
  - **Duplicate Requests & Chrome Socket Saturation (17.64s Stalled):** Chrome limits concurrent HTTP/1.1 connections to 6 per host. When mounting workspace layouts and project pages in React StrictMode (`next dev`), `layout.tsx` (3 requests) and `page.tsx` (6 requests) fired duplicate concurrent requests (up to 18 total). Because requests 1–6 occupied all 6 browser sockets for 16.95s TTFB, requests 7+ were queued in Chrome's internal socket pool, producing the 17.64s Stalled phase.

### 2. Implemented Optimizations
- **Single Round-Trip Project Authorization (`src/lib/permissions.ts`):**
  - Consolidated project existence, membership, role permission, and user verification into a single `prisma.projectMember.findUnique({ where: { projectId_userId }, include: { project: true, user: true } })`.
  - Eliminated the redundant duplicate `prisma.user.findUnique` lookup, saving 2.5–5.0 seconds per protected API call.
- **Parallel Query Execution (`Promise.all`):**
  - Parallelized independent database reads in `computeContinuityIntelligenceService` (`entities`, `claims`, `conflicts`).
  - Parallelized independent database reads in `computeRadarAlertsService` (`claims`, `entities`, `conflicts`, `dismissals`).
  - Parallelized independent database reads in `getReviewQueueService` (`claims`, `openConflictsCount`).
  - Parallelized conflict queries in `src/app/api/projects/[id]/conflicts/route.ts` (`conflicts`, `claimCount`, `statusCounts`).
- **Connection Pool Tuning (`.env`):**
  - Appended `&connection_limit=20` to the Neon PgBouncer `DATABASE_URL` so Prisma utilizes the full PgBouncer pool without queueing queries locally.
- **Client-Side Deduplication & AbortController (`intelligence/page.tsx`, `page.tsx`, `layout.tsx`):**
  - Wrapped `useEffect` data-fetching in `AbortController` instances. In development mode (StrictMode double-mount), unmounting cleanly aborts the first stale request, eliminating duplicate network calls and freeing Chrome's 6-socket queue.
- **Safe Server Timing Logging (`Server-Timing` headers):**
  - Added millisecond timing logs and `Server-Timing: total;dur=...` headers to `intelligence`, `radar`, `conflicts`, `review/queue`, and `projects/[id]` API routes.

### 3. Verification & Measured Before/After Timings
- **Before Optimization:**
  - `computeContinuityIntelligenceService`: 16,055 ms – 16,950 ms TTFB
  - Sequential 6 queries: 20,336 ms
  - Chrome Stalled time: 17,640 ms
  - Total duration: 34,600 ms
- **After Optimization (Measured on warm connection):**
  - `computeContinuityIntelligenceService`: **7,452 ms** (56% latency reduction)
  - 4 Dashboard Services in Parallel: **14,359 ms** (vs 64,300 ms sequentially)
  - Chrome Stalled time: **< 100 ms** (eliminated socket pool congestion via AbortController)
- **Regression Testing:**
  - `npm run typecheck`: Exit code 0 (`tsc --noEmit` clean, 0 errors).
  - `npm run lint`: Exit code 0 (`✔ No ESLint warnings or errors`).
  - `npm test`: Exit code 0 (29/29 suites passed, 236/236 tests passed).
  - `npm run build`: Exit code 0 (51/51 routes compiled and statically optimized).

---

## P0 Incident Resolution: Resilient Workspace Lifecycle & Auth Fallback

### 1. Root Cause Analysis
- **Premature Abort Early Return in Client Components (`src/app/projects/[projectId]/page.tsx`):**
  - Following the performance optimization commit (`1d60832`), `loadAllProjectData` contained `if (signal?.aborted) return;`.
  - In React development mode / StrictMode, effect cleanup called `controller.abort()`. When in-flight promises resolved, the early return prevented state setters (`setProject`, `setIntelligence`, etc.) from running.
  - In `finally`, `setLoading(false)` ran, leaving `project === null`. Line 266 (`if (!project) return null;`) rendered a blank white page (`null`), causing "no results" on project overview.
- **Unsettled Workspace Loading in Layout (`src/app/projects/[projectId]/layout.tsx`):**
  - `loadWorkspaceData` in `layout.tsx` relied on an `isMounted` flag set to `false` during effect cleanup.
  - In `catch`, `AbortError` was swallowed, and in `finally`, `if (isMounted) setLoading(false)` skipped `setLoading(false)`, leaving the layout stuck on "Loading enterprise project workspace..." or rendering null.
  - Because `layout.tsx` wraps all project workspace routes, this blocked all 11 sub-pages.
- **Transient Auth 401 Masking DB Disconnects (`src/lib/auth.ts`):**
  - In `getCurrentUser()`, if `prisma.user.findUnique` threw during a transient connection reset, `catch { return null; }` caused valid sessions to appear unauthenticated (401), causing client redirects.

### 2. Implemented Fixes
- **Resilient Data Population (`page.tsx`, `layout.tsx`, `intelligence/page.tsx`):**
  - Removed premature abort returns that dropped settled responses. Settled data is always applied when available, and loading state is reliably cleared in `finally`.
  - Removed `router` dependency from `layout.tsx`'s `useEffect` dependency array, preventing spurious re-render abort loops.
  - Added a visible retry fallback in `page.tsx` if `project` is null, preventing blank white screens.
- **Resilient Auth Session Fallback (`src/lib/auth.ts`):**
  - When JWT verification succeeds but the database experiences a transient connection timeout, `getCurrentUser()` preserves the authenticated user from the cryptographically verified JWT payload rather than falsifying an unauthenticated 401 error.
- **Pool Connection Tuning (`.env`):**
  - Set `&connection_limit=10` and removed unsupported `channel_binding=require` on PgBouncer `DATABASE_URL` to prevent handshake resets.

### 3. Verification & Quality Gate Results
- `npm run typecheck`: Exit code 0 (`tsc --noEmit` clean, 0 errors).
- `npm run lint`: Exit code 0 (`✔ No ESLint warnings or errors`).
- `npm test`: Exit code 0 (29/29 suites passed, 236/236 tests passed).
- `npm run build`: Exit code 0 (all 51 routes compiled and optimized cleanly).




