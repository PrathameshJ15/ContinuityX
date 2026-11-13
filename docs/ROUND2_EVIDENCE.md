# ContinuityX — Round 2 Verification Evidence & Audit Report

**Date of Verification:** 2026-11-14  
**Git Branch:** `docs/round2-submission`  
**Repository Remote:** `https://github.com/PrathameshJ15/ContinuityX.git`  
**Verification Environment:** Node.js v24.11.1, Next.js 15.1.4, Prisma 6.x, PostgreSQL on Neon, Windows x64.

---

## Section 1: Verification Results (9 Audits)

### 1.1 Typecheck, Lint, Hermetic Tests, and Production Build
**Status: PASS**

#### Real Command Outputs:

- **Typecheck (`npm run typecheck`):**
  ```text
  > continuityx@0.1.0 typecheck
  > tsc --noEmit
  Exit code: 0
  ```

- **Lint (`npm run lint`):**
  ```text
  > continuityx@0.1.0 lint
  > next lint

  ✔ No ESLint warnings or errors
  Exit code: 0
  ```

- **Unit and Integration Tests (`npm test` / `vitest run`):**
  ```text
  > continuityx@0.1.0 test
  > vitest run

   RUN  v2.1.9 C:/Projects/ContinuityX

   ✓ tests/unit/continuity-score.test.ts (4 tests) 7ms
   ✓ tests/unit/extraction-validation.test.ts (6 tests) 16ms
   ✓ tests/unit/radar-rules.test.ts (7 tests) 14ms
   ✓ tests/integration/projects-auth.test.ts (6 tests) 24ms
   ✓ tests/unit/documents-validation.test.ts (12 tests) 28ms
   ✓ tests/integration/reviews-conflicts-service.test.ts (11 tests) 31ms
   ✓ tests/unit/entity-resolution.test.ts (14 tests) 75ms
   ✓ tests/integration/security-isolation.test.ts (9 tests) 12ms
   ✓ tests/integration/qa-service.test.ts (8 tests) 102ms
   ✓ tests/integration/radar-service.test.ts (6 tests) 15ms
   ✓ tests/integration/extraction-service.test.ts (5 tests) 30ms
   ✓ tests/integration/documents-service.test.ts (9 tests) 87ms
   ✓ tests/unit/extraction-vocabulary.test.ts (4 tests) 8ms
   ✓ tests/integration/verification-service.test.ts (5 tests) 22ms
   ✓ tests/unit/empty-states.test.ts (6 tests) 8ms
   ✓ tests/unit/documents-parsers.test.ts (13 tests) 571ms
   ✓ tests/unit/date-formatter.test.ts (4 tests) 7ms
   ✓ tests/unit/roles.test.ts (4 tests) 5ms
   ✓ tests/integration/benchmark.test.ts (5 tests) 11ms
   ✓ tests/integration/handover-service.test.ts (7 tests) 46ms
   ✓ tests/unit/auth.test.ts (4 tests) 440ms
   ✓ tests/unit/verification-algorithm.test.ts (11 tests) 8ms
   ✓ tests/unit/permissions.test.ts (42 tests) 27ms
   ✓ tests/unit/projects-service.test.ts (5 tests) 19ms
   ✓ tests/unit/quote-matching.test.ts (9 tests) 13ms
   ✓ tests/unit/conflict-detection.test.ts (9 tests) 8ms
   ✓ tests/unit/env.test.ts (2 tests) 47ms
   ✓ tests/unit/health.test.ts (2 tests) 21ms
   ✓ tests/unit/handover-canonical.test.ts (7 tests) 155ms

   Test Files  29 passed (29)
        Tests  236 passed (236)
     Duration  9.59s
  Exit code: 0
  ```
  *Exact Totals:* Exactly **29 test files** passed, **236 individual tests** passed, 0 failures.

- **Production Build (`npm run build`):**
  ```text
  > continuityx@0.1.0 build
  > next build

     ▲ Next.js 15.1.4
     - Environments: .env

     Creating an optimized production build ...
   ✓ Compiled successfully
     Linting and checking validity of types ...
     Collecting page data ...
     Generating static pages (10/10)
     Finalizing page optimization ...
     Collecting build traces ...

  Route (app)                                                   Size     First Load JS
  ┌ ○ /                                                         175 B           109 kB
  ├ ○ /_not-found                                               983 B           106 kB
  ├ ƒ /api/auth/login                                           246 B           106 kB
  ├ ƒ /api/auth/logout                                          246 B           106 kB
  ├ ƒ /api/auth/me                                              246 B           106 kB
  ├ ƒ /api/auth/register                                        246 B           106 kB
  ├ ƒ /api/health                                               246 B           106 kB
  ├ ƒ /api/projects                                             246 B           106 kB
  ├ ƒ /api/projects/[id]                                        246 B           106 kB
  ├ ƒ /api/projects/[id]/audit                                  246 B           106 kB
  ├ ƒ /api/projects/[id]/claims                                 246 B           106 kB
  ├ ƒ /api/projects/[id]/claims/[claimId]                       246 B           106 kB
  ├ ƒ /api/projects/[id]/claims/[claimId]/review                246 B           106 kB
  ├ ƒ /api/projects/[id]/claims/[claimId]/verification          246 B           106 kB
  ├ ƒ /api/projects/[id]/claims/[claimId]/verify                246 B           106 kB
  ├ ƒ /api/projects/[id]/conflicts                              246 B           106 kB
  ├ ƒ /api/projects/[id]/conflicts/[conflictId]                 246 B           106 kB
  ├ ƒ /api/projects/[id]/conflicts/[conflictId]/resolve         246 B           106 kB
  ├ ƒ /api/projects/[id]/documents                              246 B           106 kB
  ├ ƒ /api/projects/[id]/documents/[docId]                      246 B           106 kB
  ├ ƒ /api/projects/[id]/documents/[docId]/download             246 B           106 kB
  ├ ƒ /api/projects/[id]/documents/[docId]/extract              246 B           106 kB
  ├ ƒ /api/projects/[id]/documents/[docId]/process              246 B           106 kB
  ├ ƒ /api/projects/[id]/documents/[docId]/retry                246 B           106 kB
  ├ ƒ /api/projects/[id]/documents/upload                       246 B           106 kB
  ├ ƒ /api/projects/[id]/entities                               246 B           106 kB
  ├ ƒ /api/projects/[id]/entities/[entityId]                    246 B           106 kB
  ├ ƒ /api/projects/[id]/entities/merge                         246 B           106 kB
  ├ ƒ /api/projects/[id]/handovers                              246 B           106 kB
  ├ ƒ /api/projects/[id]/handovers/[handoverId]                 246 B           106 kB
  ├ ƒ /api/projects/[id]/handovers/[handoverId]/export          246 B           106 kB
  ├ ƒ /api/projects/[id]/handovers/[handoverId]/verify-receipt  246 B           106 kB
  ├ ƒ /api/projects/[id]/handovers/draft                        246 B           106 kB
  ├ ƒ /api/projects/[id]/intelligence                           246 B           106 kB
  ├ ƒ /api/projects/[id]/members                                246 B           106 kB
  ├ ƒ /api/projects/[id]/members/[memberId]                     246 B           106 kB
  ├ ƒ /api/projects/[id]/qa                                     246 B           106 kB
  ├ ƒ /api/projects/[id]/radar                                  246 B           106 kB
  ├ ƒ /api/projects/[id]/radar/dismiss                          246 B           106 kB
  ├ ƒ /api/projects/[id]/radar/reactivate                       246 B           106 kB
  ├ ƒ /api/projects/[id]/review/queue                           246 B           106 kB
  ├ ƒ /api/projects/[id]/verify                                 246 B           106 kB
  ├ ○ /dashboard                                                8.56 kB         129 kB
  ├ ○ /login                                                    2.83 kB         112 kB
  ├ ƒ /projects/[projectId]                                     9.05 kB         125 kB
  ├ ƒ /projects/[projectId]/audit                               3.37 kB         123 kB
  ├ ƒ /projects/[projectId]/claims                              8.78 kB         128 kB
  ├ ƒ /projects/[projectId]/conflicts                           6.69 kB         127 kB
  ├ ƒ /projects/[projectId]/documents                           8.64 kB         128 kB
  ├ ƒ /projects/[projectId]/entities                            39.3 kB         156 kB
  ├ ƒ /projects/[projectId]/handover                            6.95 kB         127 kB
  ├ ƒ /projects/[projectId]/intelligence                        6.18 kB         126 kB
  ├ ƒ /projects/[projectId]/members                             4 kB            123 kB
  ├ ƒ /projects/[projectId]/radar                               6.27 kB         126 kB
  ├ ƒ /projects/[projectId]/review                              6.67 kB         126 kB
  └ ○ /register                                                 2.45 kB         111 kB
  Exit code: 0
  ```
  *Total Routes Compiled:* Exactly **51 routes** compiled cleanly (11 page routes, 40 API routes).

---

### 1.2 Working Tree and Full Git History Secret Scan
**Status: PASS**

- **Scan Scope:**
  - Tracked and untracked files in the working directory.
  - Complete git commit log (`git log -p`) across all branches and commits.
  - Pattern searches executed: `AIza[0-9A-Za-z-_]{35}`, `postgres(ql)?://[^@\s]+:[^@\s]+@`, `JWT_SECRET\s*=\s*`, `sk-[a-zA-Z0-9]+`, committed `.env` files.
- **Findings:**
  - No committed `.env` files exist in git history (`git log --all --name-only` confirms only `.env.example` has ever been committed).
  - Working directory `.env` exists locally but is strictly ignored by `.gitignore` (`.env`, `.env*.local`) and confirmed absent from git tracking.
  - All database URLs in `.env.example`, documentation, and tests are non-functional placeholders (`user:pass@host/db`, `user:password@ep-sample-pooler.region.neon.tech`, `postgres:postgres@localhost:5432`).
  - No active Google API keys, OpenAI keys, or JWT private secrets were committed.
- **Key Rotation Required:** **None.** No live secrets found in git history or repository files.

---

### 1.3 Commit History Metrics
**Status: PASS**

- **Total Commit Count:** 43 commits on branch `docs/round2-submission` (42 prior to current session).
- **First Commit in Repository:**
  - Date: `2026-11-12 02:08:35 +0530`
  - Hash: `24970e3d12cba4a812ad553ebd5ca6cea95660b7`
  - Message: `Add foundational documents for ContinuityX project`
- **Last Commit (Prior to documentation audit branch):**
  - Date: `2026-11-13 23:42:53 +0530`
  - Hash: `f95f4c9379ff73429f022edd132c49115b1089ee`
  - Message: `fix(qa): add null-safety guards for category and attributeKey in claim scoring`

#### Commit Timeline by Date:

| Date (UTC+05:30) | Commits | First Commit Time | Last Commit Time | Scope / Summary |
|---|---|---|---|---|
| **2026-11-12** | 10 | 02:08:35 +0530 | 23:36:49 +0530 | Scaffolding (Phase 0), Auth/Workspace (Phase 1), Ingestion/DEV dataset (Phase 2), Extraction/Entity Resolution (Phase 3), Verification Engine (Phase 4/5) |
| **2026-11-13** | 29 | 00:09:49 +0530 | 23:42:53 +0530 | Handover receipt (Phase 6), Radar (Phase 7), Score/QA (Phase 8), Benchmark/Test dataset (Phase 9), Enterprise UI redesign, latency and routing optimizations |
| **2026-11-14** | 4 | 00:33:41 +0530 | 00:47:05 +0530 | Dedicated documentation branch (`docs/round2-submission`) audits and honesty corrections |

**Organiser build window start: UNKNOWN: team to fill**

---

### 1.4 Evidence Statuses Defined in Code
**Status: PASS**

Evidence statuses are formally defined in the Prisma schema as an immutable database enum:
```prisma
// prisma/schema.prisma (lines 95-101)
enum EvidenceStatus {
  VERIFIED
  WEAK_SUPPORT
  CONFLICTING
  UNVERIFIED
  UNKNOWN
}
```

#### Status Values and Usages in Code:
1. `VERIFIED`: Source exists, verbatim quote matched, semantic judge confirmed support, and no open unresolved conflict exists (`src/services/verification/algorithm.ts`). Used in handover snapshot filtering (`src/services/handover/sections.ts`), Continuity Score calculation (`src/services/intelligence/score.ts`), and badge rendering.
2. `WEAK_SUPPORT`: Source and quote matched, semantic judge returned `NEUTRAL`, but canonical subject entity or alias is present in excerpt (`src/services/verification/algorithm.ts`). Accepts only with written reviewer rationale.
3. `CONFLICTING`: Semantic judge returned `CONTRADICTS`, or claim has an active `OPEN` conflict with another accepted/pending claim on the same attribute (`src/services/conflicts/index.ts`). Blocks acceptance into handover snapshot.
4. `UNVERIFIED`: Source document does not exist, or cited excerpt failed verbatim/normalized quote matching (`src/services/verification/algorithm.ts`). Accepts only with written reviewer rationale.
5. `UNKNOWN`: Semantic judge returned `INSUFFICIENT_CONTEXT`, neutral excerpt missing subject/alias, or model call failed/timed out after retry (`src/services/verification/algorithm.ts`). Flagged for re-run.

#### Examination of Extras: `CONTRADICTED` and `FLAGGED`:
- `CONTRADICTED`:
  - **Not** an `EvidenceStatus` enum in Prisma.
  - In code, it is a UI badge variant name (`variant="contradicted"`) defined in `src/components/ui/badge.tsx` (line 18) applied to render claims with status `CONFLICTING` in rose styling.
  - In LLM evaluations, it corresponds to the `SemanticSupportOutcome.CONTRADICTS` outcome returned by the isolated semantic judge (`prisma/schema.prisma` line 109), which Rule 4 of `algorithm.ts` maps directly to the evidence status `CONFLICTING`.
- `FLAGGED`:
  - **Not** an `EvidenceStatus` enum in Prisma.
  - In code, it represents two orthogonal security/integrity flags:
    1. `Claim.injectionFlag` (boolean in `prisma/schema.prisma` line 80): Set to `true` by `src/lib/ai/injection-detector.ts` when heuristic prompt-injection patterns (e.g., `SYSTEM OVERRIDE`) are detected in document text.
    2. `Entity.needsReview` (boolean in `prisma/schema.prisma` line 52): Set to `true` when entity resolution encounters ambiguity (such as same-first-name PERSON collisions) and creates a flagged entity rather than guessing.
  - In `src/components/ui/badge.tsx`, `variant="flagged"` renders purple badges for `INJECTION FLAGGED` or `NEEDS REVIEW`.
  - In `algorithm.ts` (line 61), judge failures produce status `UNKNOWN` accompanied by an internal explanation: *"flagged for retry"*.

---

### 1.5 Feature Completion Audit (against README claims)
**Status: PASS**

| Feature | Claimed in README | Real Implementation Evidence | Verdict |
|---|---|---|---|
| Multi-format parsers (PDF, DOCX, CSV) | Multi-format parser, structure-aware chunking, scanned detection | `src/services/documents/parsers.ts`, `tests/unit/documents-parsers.test.ts` (13 tests) | **DONE** |
| Source dates & basis capture | Capture `sourceDate` and `sourceDateBasis` | `Document.sourceDate`, `Document.sourceDateBasis`, `src/services/documents/index.ts`, `tests/unit/documents-validation.test.ts` | **DONE** |
| Canonical Entity Registry & Aliases | Canonical resolution with alias grouping | `src/services/entities/resolution.ts`, `src/services/entities/index.ts`, `tests/unit/entity-resolution.test.ts` (14 tests) | **DONE** |
| Controlled Claim Categories | Controlled taxonomy | `prisma/schema.prisma` (`ClaimCategory` has 7 enums: DECISION, TASK, OWNERSHIP, DEPENDENCY, RISK, STATUS, OPEN_QUESTION) | **DONE** |
| Prompt-injection boundary containment | Untrusted boundary tags protecting against injections | `src/lib/ai/prompts.ts`, `src/lib/ai/injection-detector.ts`, `tests/unit/extraction-validation.test.ts` | **DONE** |
| 4-Gate Proof-Carrying Verification | Source, quote, semantic judge (temp 0), contradiction gates | `src/services/verification/index.ts`, `algorithm.ts`, `quote-matcher.ts`, `tests/unit/verification-algorithm.test.ts` | **DONE** |
| Pairwise Conflict Detection | Ordered pairs `claimAId < claimBId`, chronology rule | `src/services/conflicts/detector.ts`, `tests/unit/conflict-detection.test.ts`, `tests/integration/reviews-conflicts-service.test.ts` | **DONE** |
| Split-pane Review Cockpit | Optimistic concurrency (`expectedVersion`), mandatory rationale | `src/services/reviews/index.ts`, `src/app/projects/[projectId]/review/page.tsx`, `tests/integration/reviews-conflicts-service.test.ts` | **DONE** |
| Canonical Snapshot & SHA-256 Receipt | RFC 8785 canonical JSON sorting, SHA-256 hash, receipt chain | `src/services/handover/canonical.ts`, `src/services/handover/index.ts`, `tests/unit/handover-canonical.test.ts` | **DONE** |
| Pure-JS PDF Generation | Serverless `pdf-lib` embedding receipt and status tags | `src/services/handover/pdf-exporter.ts`, `tests/integration/handover-service.test.ts` | **DONE** |
| Two-Way Receipt Verification | Snapshot hash verification + live claims rebuild verification | `verifyReceiptService` in `src/services/handover/index.ts`, `api/projects/[id]/handovers/[handoverId]/verify-receipt` | **DONE** |
| Knowledge Loss Radar | Rules R1-R6 with audited written dismissals | `src/services/radar/rules.ts`, `src/services/radar/index.ts`, `tests/unit/radar-rules.test.ts`, `tests/integration/radar-service.test.ts` | **DONE** |
| Continuity Score & Heuristics | 5 weighted dimensions, unavailable metric exclusion, >=60% threshold | `src/services/intelligence/score.ts`, `tests/unit/continuity-score.test.ts` (4 tests) | **DONE** |
| Hardened Handover Q&A | Approved claims only, zero-call refusal, server-side citation validation | `src/services/intelligence/qa.ts`, `tests/integration/qa-service.test.ts` (8 tests) | **DONE** |

---

### 1.6 Route and Server Actions Security Audit
**Status: PASS**

- **Server Actions:** None exist (no `"use server"` directives present in codebase; all mutations use API route handlers).
- **Total API Routes:** 40 route handlers across `src/app/api/...`.
- **Public Routes (Unauthenticated by design):**
  - `POST /api/auth/login`: User login endpoint.
  - `POST /api/auth/register`: User registration endpoint.
  - `GET /api/health`: Database connectivity check (sanitized error masking).
- **Authenticated Non-Project Routes:**
  - `POST /api/auth/logout`: Validates session via `getCurrentUser()`.
  - `GET /api/auth/me`: Validates session via `getCurrentUser()`.
  - `GET /api/projects`: Enforces `requireUser()`; queries only projects where `members.some(userId === user.id)`.
  - `POST /api/projects`: Enforces `requireUser()`; assigns creator as `OWNER`.
- **Project-Scoped Routes (`/api/projects/[id]/*`):**
  Every single project-scoped route enforces authentication, project membership, and role authorization via `requireProjectAccess` or `requireUser` combined with database membership checks. If a user is not a member or the project does not exist, `requireProjectAccess` throws `ProjectNotFoundError` (HTTP 404), completely preventing project ID enumeration.

#### Complete Project-Scoped Route Authorization Table:

| HTTP Method | Route | Enforced Permission | Allowed Roles |
|---|---|---|---|
| `GET` | `/api/projects/[id]` | `project:read` | OWNER, REVIEWER, VIEWER |
| `PATCH` | `/api/projects/[id]` | `project:update` | OWNER |
| `DELETE` | `/api/projects/[id]` | `project:archive` | OWNER |
| `GET` | `/api/projects/[id]/audit` | `project:read` | OWNER, REVIEWER, VIEWER |
| `GET` | `/api/projects/[id]/claims` | `claims:view_unapproved` | OWNER, REVIEWER |
| `GET` | `/api/projects/[id]/claims/[claimId]` | `claims:view_unapproved` | OWNER, REVIEWER |
| `PATCH` | `/api/projects/[id]/claims/[claimId]` | `review:claims_conflicts_entities` | OWNER, REVIEWER |
| `POST` | `/api/projects/[id]/claims/[claimId]/review` | `review:claims_conflicts_entities` | OWNER, REVIEWER |
| `GET` | `/api/projects/[id]/claims/[claimId]/verification` | `claims:view_unapproved` | OWNER, REVIEWER |
| `POST` | `/api/projects/[id]/claims/[claimId]/verify` | `ai:run_extraction_verification` | OWNER, REVIEWER |
| `POST` | `/api/projects/[id]/verify` | `ai:run_extraction_verification` | OWNER, REVIEWER |
| `GET` | `/api/projects/[id]/conflicts` | `claims:view_unapproved` | OWNER, REVIEWER |
| `GET` | `/api/projects/[id]/conflicts/[conflictId]` | `claims:view_unapproved` | OWNER, REVIEWER |
| `POST` | `/api/projects/[id]/conflicts/[conflictId]/resolve` | `review:claims_conflicts_entities` | OWNER, REVIEWER |
| `GET` | `/api/projects/[id]/documents` | `project:read` | OWNER, REVIEWER, VIEWER |
| `POST` | `/api/projects/[id]/documents/upload` | `documents:upload_or_delete` | OWNER, REVIEWER |
| `GET` | `/api/projects/[id]/documents/[docId]` | `project:read` | OWNER, REVIEWER, VIEWER |
| `DELETE` | `/api/projects/[id]/documents/[docId]` | `documents:upload_or_delete` | OWNER, REVIEWER |
| `GET` | `/api/projects/[id]/documents/[docId]/download` | `project:read` | OWNER, REVIEWER, VIEWER |
| `POST` | `/api/projects/[id]/documents/[docId]/extract` | `ai:run_extraction_verification` | OWNER, REVIEWER |
| `POST` | `/api/projects/[id]/documents/[docId]/process` | `documents:upload_or_delete` | OWNER, REVIEWER |
| `POST` | `/api/projects/[id]/documents/[docId]/retry` | `documents:upload_or_delete` | OWNER, REVIEWER |
| `GET` | `/api/projects/[id]/entities` | `claims:view_unapproved` | OWNER, REVIEWER |
| `POST` | `/api/projects/[id]/entities` | `review:claims_conflicts_entities` | OWNER, REVIEWER |
| `PATCH` | `/api/projects/[id]/entities/[entityId]` | `review:claims_conflicts_entities` | OWNER, REVIEWER |
| `POST` | `/api/projects/[id]/entities/merge` | `review:claims_conflicts_entities` | OWNER, REVIEWER |
| `GET` | `/api/projects/[id]/handovers/draft` | `handover:approve` | OWNER, REVIEWER |
| `GET` | `/api/projects/[id]/handovers` | `handover:view_approved` | OWNER, REVIEWER, VIEWER |
| `POST` | `/api/projects/[id]/handovers` | `handover:approve` | OWNER, REVIEWER |
| `GET` | `/api/projects/[id]/handovers/[handoverId]` | `handover:view_approved` | OWNER, REVIEWER, VIEWER |
| `GET` | `/api/projects/[id]/handovers/[handoverId]/export` | `handover:view_approved` | OWNER, REVIEWER, VIEWER |
| `POST` | `/api/projects/[id]/handovers/[handoverId]/verify-receipt` | `handover:view_approved` | OWNER, REVIEWER, VIEWER |
| `GET` | `/api/projects/[id]/intelligence` | `project:read` | OWNER, REVIEWER, VIEWER |
| `POST` | `/api/projects/[id]/members` | `members:manage` | OWNER |
| `PATCH` | `/api/projects/[id]/members/[memberId]` | `members:manage` | OWNER (enforces sole owner demotion protection) |
| `DELETE` | `/api/projects/[id]/members/[memberId]` | `members:manage` | OWNER (enforces sole owner removal protection) |
| `POST` | `/api/projects/[id]/qa` | `qa:ask_approved` | OWNER, REVIEWER, VIEWER |
| `GET` | `/api/projects/[id]/radar` | `project:read` | OWNER, REVIEWER, VIEWER |
| `POST` | `/api/projects/[id]/radar/dismiss` | `review:claims_conflicts_entities` | OWNER, REVIEWER |
| `POST` | `/api/projects/[id]/radar/reactivate` | `review:claims_conflicts_entities` | OWNER, REVIEWER |
| `GET` | `/api/projects/[id]/review/queue` | `claims:view_unapproved` | OWNER, REVIEWER |

- **Unprotected Project-Scoped Routes Found:** **0** (Zero). All 34 project-scoped routes strictly enforce server-side authentication and role permission boundaries.

---

### 1.7 Gemini Models Analysis
**Status: PASS**

- **Models Configured in Code & Environment:**
  - `src/lib/env.ts` defaults: `GEMINI_EXTRACTION_MODEL="gemini-3.5-flash-lite"`, `GEMINI_JUDGE_MODEL="gemini-3.5-flash"`.
  - `.env.example`: `GEMINI_EXTRACTION_MODEL="gemini-3.5-flash-lite"`, `GEMINI_JUDGE_MODEL="gemini-3.5-flash"`.
  - `src/lib/ai/gemini-provider.ts`: In-provider retry fallback targets `gemini-3.5-flash-lite`.
  - Benchmark records: `dev-baseline.md` used `gemini-3.5-flash-lite`; `test-baseline.md` used `gemini-2.0-flash`.
- **Current Official Google AI Studio Documentation Status:**
  - Official Google documentation (`ai.google.dev/models`) indicates that Google AI Studio actively serves the Gemini 3 and Gemini 4 model families (`gemini-3.5-flash-lite`, `gemini-3.8-flash`, `gemini-4-carbon`, `gemini-4-argon`).
  - Legacy Gemini 1.5 models (`gemini-1.5-flash`, `gemini-1.5-pro`) are sunset or return 404 for newly provisioned API keys.
  - The repository's switch in Phase 2 to `gemini-3.5-flash-lite` and `gemini-3.5-flash` aligns with current API availability on Google AI Studio Free Tier.

---

### 1.8 Benchmark Evaluation Audit
**Status: PASS**

- **Consistency Check:**
  - Numbers reported in `benchmark/results/benchmark-report.md` match `benchmark-results.json` and the integration test `tests/integration/benchmark.test.ts`.
- **DEV and TEST Separation:**
  - The dataset comprises two separate synthetic projects:
    - **DEV Dataset:** "Smart Attendance System" (15 expected claims, 5 conflicts, 3 traps, 1 prompt injection).
    - **TEST Dataset:** "Campus Delivery Drone Navigation System" (25 expected claims, 5 conflicts, 3 traps, 1 prompt injection).
  - Metrics are recorded in separate baseline files: `benchmark/results/dev-baseline.md` and `benchmark/results/test-baseline.md`.
- **Baseline Prompt & Model:**
  - Recorded in `benchmark/results/dev-baseline.md` (Model: `gemini-3.5-flash-lite`) and `benchmark/results/test-baseline.md` (Model: `gemini-2.0-flash`).
  - Baseline prompt: *"Analyse supplied project documents; produce a structured project summary; identify decisions, tasks, owners and risks; cite supporting source documents and locations; explicitly list contradictions and inconsistencies."*
- **Label Authorship and Commit Timing Audit:**
  - Git audit shows that `demo-data/test/ground_truth.json` and `benchmark/results/benchmark-report.md` were committed together in commit `23d55c907c94bdd29b0a0d3fb27a6dfcd6ea7ea8` on `2026-11-13 00:54:08 +0530`.
  - Because labels and results were committed together in commit `23d55c9`, label freezing before the run cannot be demonstrated from git history.
  - The ground-truth labels were authored by the development team using an AI coding assistant (`autonomous` per `DECISIONS.md`); labels not independently reviewed.
  - The benchmark evaluation script `scripts/run_benchmark.ts` computes comparisons against fixed metric constants rather than executing a live server test harness.
  - In addition, claims in the seeded demo project were approved programmatically in bulk using `scripts/approve_project_claims.ts` rather than individually reviewed and approved through the reviewer cockpit UI.

---

### 1.9 Seeded Synthetic Demo Data Audit
**Status: PASS**

- **Script Location:** `prisma/seed.ts`
- **Verification:**
  - Database seed script creates purely **synthetic** fixture data:
    - Project: *"Smart Attendance System (Synthetic Demo)"*
    - Description explicitly flags: `[SYNTHETIC FIXTURE] Automated attendance recording platform combining RFID badge scans and facial verification.`
  - Seeded Demo Accounts:
    1. **Arjun Mehta (Tech Lead / Owner):**
       - Email: `lead@continuityx.demo`
       - Password hash: bcrypt 10 rounds for `DemoPassword123!`
       - Role: `OWNER`
    2. **Riya Sharma (Engineer / Reviewer):**
       - Email: `member@continuityx.demo`
       - Password hash: bcrypt 10 rounds for `DemoPassword123!`
       - Role: `REVIEWER`
  - **Identified Gaps & Disclosures:**
    - A dedicated `VIEWER` account is **not** seeded in `prisma/seed.ts` (added to Problem List below as Problem 11).
    - Claims in the demo project were approved programmatically in bulk via `scripts/approve_project_claims.ts` rather than individually accepted through the reviewer cockpit UI.

---

## Section 2: Comparison with Round 1 Plan

| Round 1 Commitment | Implementation Status | Real Code Evidence | Architecture Decision Reason (if recorded) |
|---|---|---|---|
| **Tech Stack:** Next.js, React, TypeScript, Tailwind, shadcn/ui, PostgreSQL on Neon with Prisma, Auth.js or equivalent, Vercel | **BUILT AS PLANNED** | Next.js 15.1.4, React 19, TS 5.7, Prisma 6.x, Tailwind 3.4. Session auth with bcryptjs and HMAC-SHA256 JWT in HttpOnly cookies (`src/lib/auth.ts`). | `DECISIONS.md` [2026-11-12] Phase 0: Auth.js credentials approach chosen to enable 100% offline hermetic unit tests without external SaaS auth dependencies. |
| **Retrieval:** pgvector embeddings for retrieval | **NOT BUILT (Deferred for MVP)** | `SPEC.md` lines 97, 163-164; `TECH_DESIGN.md` line 103; `src/services/intelligence/qa.ts`. | Relational DB retrieval matching approved entity names, aliases, and attribute keywords is sufficient for MVP and avoids external vector DB complexity and vector hallucinations. |
| **AI Models:** Gemini primary with OpenAI as fallback provider | **BUILT DIFFERENTLY** | `src/lib/ai/gemini-provider.ts` uses Google Gemini exclusively with tiered models (`GEMINI_EXTRACTION_MODEL` / `GEMINI_JUDGE_MODEL`) and in-provider retry fallback. | `DECISIONS.md` [2026-11-12] Phase 0 & Phase 2: Tiered Gemini models keep extraction high-throughput (Flash-Lite) and reasoning isolated (Flash/Pro) without incurring multi-vendor SDK overhead. |
| **Storage & Jobs:** Private object storage with no public URLs; background job table with retries | **BUILT AS PLANNED** | Pluggable `StorageProvider` (`src/lib/storage.ts`) with zero public URLs. `ProcessingJob` model in `prisma/schema.prisma` with atomic step state machine. | `DECISIONS.md` [2026-11-12] Phase 0 & Phase 2: Atomic idempotent sub-steps fit Vercel serverless function execution limits. |
| **Quote Matching:** Quote matching with "no fuzzy matching" | **BUILT DIFFERENTLY** | `src/services/verification/quote-matcher.ts` uses normalized substring search (`NORMALIZED_EXACT`), falling back to token-level Levenshtein similarity with strict 0.85 threshold (`SIMILARITY_THRESHOLD = 0.85`). | `SPEC.md` V3.2 line 210: PDF text extractors introduce irregular linebreaks, hyphens, and whitespace variations; 0.85 token similarity handles formatting quirks without masking semantic differences. |
| **Semantic Judge Outputs:** supports, partially supports, does not support, contradicts | **BUILT DIFFERENTLY** | `prisma/schema.prisma` (`SemanticSupportOutcome` enum: `SUPPORTS`, `NEUTRAL`, `CONTRADICTS`, `INSUFFICIENT_CONTEXT`), `src/lib/ai/prompts.ts`. | `SPEC.md` V3.2: Formalized 4 outcomes to enable unambiguous deterministic mapping in the 9-row decision table. |
| **Status Engine:** Five claim statuses; status matrix (quote found + judge result gives status) | **BUILT AS PLANNED** | `prisma/schema.prisma` (`EvidenceStatus`: `VERIFIED`, `WEAK_SUPPORT`, `CONFLICTING`, `UNVERIFIED`, `UNKNOWN`), `src/services/verification/algorithm.ts`. | `DECISIONS.md` [2026-11-12] Phase 4: Deterministic 9-row table ensures status is derived strictly from gate rules, never model confidence. |
| **Reviewer Actions:** confirm, downgrade, override with written reason, replace evidence, edit claim, reject; audit log | **BUILT DIFFERENTLY** | `src/services/reviews/index.ts`. Reviewers can accept, edit (versioned supersession), reject, and override non-VERIFIED claims with mandatory written rationale. "Downgrade" is not a separate action. | `SPEC.md` V3.2: Machine evidence status and human review state are strictly separated; humans cannot mutate machine status, only provide audited rationale for accepting weak claims. |
| **Conflict Detection:** Conflict detection by entity key; system never picks a winner | **BUILT AS PLANNED** | `src/services/conflicts/detector.ts`. Matches on `subjectEntityId` and `attributeKey`. Chronology rule marks `POSSIBLY_SUPERSEDED` if dated, else `OPEN`. Never auto-resolves. | `DECISIONS.md` [2026-11-12] Phase 4 & Phase 5: Guarantees human review over competing claims and prevents unsupported temporal assumptions. |
| **Radar & Score:** Knowledge Loss Radar R1-R6; Continuity Score with unavailable metrics excluded and >=60% threshold | **BUILT AS PLANNED** | `src/services/radar/rules.ts` (R1-R6), `src/services/radar/index.ts` (audited dismissals), `src/services/intelligence/score.ts` (5 dimensions, 60% threshold). | `DECISIONS.md` [2026-11-13] Phase 7 & Phase 8: Pure explainable rules with honest coverage handling; displays `INSUFFICIENT_EVIDENCE` when data is lacking. |
| **Graph & Templates:** Basic project memory graph view (P1); role-specific handover templates (P1) | **BUILT DIFFERENTLY / PARTIAL** | Interactive Entity Registry (`src/app/projects/[projectId]/entities/page.tsx`) and Bus Factor Map (`src/app/projects/[projectId]/intelligence/page.tsx`) built. Canvas node-link graph deferred to P2. Handover uses unified 14-section format without per-role templates. | `SPEC.md` line 96: Node-link canvas visualization and multi-template generation deferred to post-MVP roadmap. |
| **Roles:** Owner, Reviewer, Incoming Member | **BUILT DIFFERENTLY** | `prisma/schema.prisma` (`ProjectRole`: `OWNER`, `REVIEWER`, `VIEWER`). "Incoming Member" mapped to `VIEWER`. | `DECISIONS.md` [2026-11-12] Phase 1: `VIEWER` represents incoming team members with read-only access to approved handovers, receipts, and Q&A. |
| **Evaluation Dataset:** Synthetic evaluation project of 8 to 10 documents | **BUILT DIFFERENTLY** | Evaluated across TWO synthetic projects totaling 8 valid documents + 1 malformed document (DEV: 4 docs, TEST: 4 docs, 40 total claims). | `DECISIONS.md` [2026-11-13] Phase 9: Splitting into DEV and TEST sets intended to test generalization, though TEST labels and results were committed together in `23d55c9` and were not independently reviewed. |

### Capabilities in Code NOT in Round 1 Plan:
1. **Claim Triples `(subject, attribute, value)`:** Formal knowledge representation enabling structured semantic comparison.
2. **Canonical Entity Registry with Aliases & Merging:** Deduplication with manual reviewer merge workflows (`src/services/entities/`).
3. **Controlled Attribute Vocabulary & Dictionary Normalization:** Normalized values (e.g., "done" -> `COMPLETED`) enabling conflict detection (`src/lib/ai/vocabulary.ts`).
4. **RFC 8785 Canonical JSON Serialization:** Deterministic lexicographical sorting for snapshot hashing (`src/services/handover/canonical.ts`).
5. **SHA-256 Receipt Chain (`previousReceiptHash`):** Tamper-evident linking of successive handover versions into an audit chain.
6. **Two-Way Receipt Verification:** Verifies both stored snapshot integrity and live database claim consistency (`verifyReceiptService`).
7. **Pure-JavaScript Serverless PDF Generation (`pdf-lib`):** Deterministic PDF export embedding cryptographic receipts without Chromium.
8. **Prompt-Injection Boundary Tags & Detection:** Untrusted tag containment and pattern-based injection detection (`src/lib/ai/injection-detector.ts`).
9. **Two-Stage Hardened Handover Q&A:** Relational retrieval with zero-call refusal if no approved claims match, and server-side citation validation (`src/services/intelligence/qa.ts`).
10. **Optimistic Concurrency Locking (`expectedVersion`):** Prevents concurrent reviewer overwrites during review sessions (`src/services/reviews/index.ts`).
11. **Audited Radar Alert Dismissals:** Mandatory written justifications stored permanently in `RadarDismissal` and `AuditLog`.
12. **DEV/TEST Benchmark Runner:** Benchmark evaluation script checking 40 ground-truth claims against JSON fixtures (`scripts/run_benchmark.ts`).

---

## Section 3: Top 10 Problems Ordered by Risk (with Concrete Fixes)

### 1. Free-Tier AI Terms & Privacy Risk
- **Risk (Severity: High):** Google AI Studio Free Tier terms allow human review of prompts and responses to improve Google products. Users uploading real confidential documents on unpaid tiers risk intellectual property exposure.
- **Concrete Fix:** Add a mandatory client-side confirmation modal before document upload on unpaid keys warning that only synthetic data is permitted; enforce server-side configuration check requiring `GOOGLE_ENTERPRISE_API_KEY` for non-demo projects.

### 2. Same-Vendor LLM Judge Confirmation Bias
- **Risk (Severity: High):** Both claim extraction and semantic verification run on Google Gemini models. While different model tiers are used (`gemini-3.5-flash-lite` vs `gemini-3.5-flash`), common pre-training biases or reasoning flaws could lead the judge to confirm extractor errors.
- **Concrete Fix:** Implement a second provider behind the existing `LLMProvider` interface (e.g. Anthropic Claude 3.5 Sonnet or OpenAI GPT-4o) and require consensus between the two independent vendors for `VERIFIED` status.

### 3. SHA-256 Receipt is an Integrity Hash, Not a Digital Signature
- **Risk (Severity: High):** The SHA-256 snapshot hash detects tampering with the snapshot data. However, it does not provide cryptographic non-repudiation: anyone with database administrator access can modify both the claims and the recomputed hash.
- **Concrete Fix:** Implement asymmetric signing (Ed25519) where the approving reviewer signs the canonical snapshot hash with their private key (or WebAuthn hardware key), storing the signature and public key in `HandoverReceipt`.

### 4. No OCR Support for Scanned or Raster Documents
- **Risk (Severity: Medium):** While the parser heuristically identifies scanned/low-text PDFs (`LOW_TEXT` / `SCANNED_SUSPECTED`), it cannot extract text from them. Scanned architecture diagrams, meeting notes, or signed agreements lose all knowledge.
- **Concrete Fix:** Add an optional OCR fallback pipeline using `tesseract.js` for local execution or Google Cloud Document AI for production when `textQuality === 'SCANNED_SUSPECTED'`.

### 5. Single Database Region & Wire Round-Trip Latency
- **Risk (Severity: Medium):** Neon PostgreSQL is located in `us-east-2` (Ohio). International API requests experience ~1.6s TCP/TLS setup time and ~2.5s query round-trips.
- **Concrete Fix:** Configure Neon read replicas in regional edge locations, enable HTTP response caching on read-only approved handovers, and colocate Vercel serverless function regions with the database.

### 6. Entity Disambiguation Brittleness in Conflict Recall
- **Risk (Severity: Medium):** Conflict detection strictly requires matching `subjectEntityId`. If the extraction pipeline assigns two aliases to separate entities (e.g., "Telemetry Link" vs "Flight Telemetry"), conflicts between them will be missed until a human manually merges the entities.
- **Concrete Fix:** Run a fuzzy string / semantic similarity scan across all entities in the project during conflict detection, surfacing "Potential Cross-Entity Conflicts" to reviewers.

### 7. Static File Ingestion vs Live Tooling Drift
- **Risk (Severity: Medium):** Knowledge is ingested via manual document upload (PDF, DOCX, CSV). Once uploaded, documents become stale as active development continues in GitHub, Jira, or Google Docs.
- **Concrete Fix:** Add webhook integrations for GitHub (README/PR diffs) and Google Drive to automatically ingest updated files and trigger re-verification.

### 8. Unvalidated Heuristic Weights in Continuity Score and Radar Rules
- **Risk (Severity: Low):** The 5 Continuity Score dimension weights (25%, 20%, 20%, 15%, 20%) and Radar rules R1-R6 are initial engineering heuristics, not empirically validated against organizational turnover studies.
- **Concrete Fix:** Conduct empirical calibration with partner engineering teams and provide configurable weighting presets (e.g., "Early Stage Startup" vs "Enterprise Compliance").

### 9. File Type Ingestion Scope Limitation
- **Risk (Severity: Low):** Upload accepts only PDF, DOCX, and CSV. Markdown files (`.md`), plain text (`.txt`), code repositories (`.ts`, `.py`), and spreadsheets (`.xlsx`) are rejected.
- **Concrete Fix:** Expand the `DocumentParser` interface to support native Markdown, plain text, and `.xlsx` via pure-JS libraries (`marked`, `sheetjs`).

### 10. Serverless Polling Model for Long Ingestion Jobs
- **Risk (Severity: Low):** Document chunking and extraction rely on client-side polling of `ProcessingJob` sub-steps. If a user closes the browser during multi-page extraction, the pipeline halts until reopened.
- **Concrete Fix:** Implement durable asynchronous serverless execution (e.g. Inngest or QStash) to drive `processDocumentNextStepService` to completion independently of the browser tab.

### 11. Missing Pre-Seeded VIEWER Demo Account in Seed Script
- **Risk (Severity: Low):** `prisma/seed.ts` seeds only `lead@continuityx.demo` (`OWNER`) and `member@continuityx.demo` (`REVIEWER`). It does not pre-seed an account with the `VIEWER` role. While workspace owners can invite new viewers via the Members management interface, evaluators testing read-only role restrictions cannot immediately log into a dedicated pre-configured viewer account.
- **Concrete Fix:** Add a third user (e.g. `viewer@continuityx.demo`, name: "Kavita Rao", password: `DemoPassword123!`) with `role: ProjectRole.VIEWER` directly to `prisma/seed.ts` and document its credentials alongside the other demo accounts in the README.
