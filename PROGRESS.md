# Progress

Update at the end of every phase and every work session. Status comes from the repository audit and passing tests, not from memory.

| Phase | Name | Status | Exit test passed? | Last updated | Notes / blockers |
|---|---|---|---|---|---|
| 0 | Repository Audit & Foundation | Done | Yes | 2026-11-12 | Foundation scaffolded, typecheck/lint/tests/build passing, 5 decisions recorded |
| 1 | Authentication & Project Workspace | Done | Yes | 2026-11-12 | Auth, User/Project/ProjectMember/AuditLog, permission matrix (61 tests pass) |
| 2 | Document Intelligence & Upload | Done | Yes | 2026-11-12 | Live Neon migration applied & seeded; validation, parsers, chunking, DEV dataset, 95 tests pass |
| 3 | AI Claim Extraction & Entity Registry | Done | Yes | 2026-11-12 | Extraction pipeline, entity registry, vocabulary normalization, injection defense, 114 tests pass |
| 4 | Proof-Carrying Verification Engine | Done | Yes | 2026-11-12 | 4-gate verification engine, SPEC.md V3.2 9-row status table, DEV eval 15/15 matched, 148 tests pass |
| 5 | Conflict Detection & Human Review | In progress | No | 2026-11-12 | Conflict models & pairwise detection implemented; building split-pane review & resolution flows |
| 6 | Handover Generation & SHA-256 Receipt | Not started | No | | |
| 7 | Knowledge Loss Radar | Not started | No | | |
| 8 | Continuity Intelligence | Not started | No | | |
| 9 | Security, Testing, UI Polish, Benchmark, Release | Not started | No | | |

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

### 5. Security confirmation: Verification and Conflict routes enforcement
All verification and conflict routes strictly call `requireProjectAccess` enforcing server-side permission checks:
- `POST /api/projects/[id]/verify`: `ai:run_extraction_verification` (OWNER, REVIEWER)
- `POST /api/projects/[id]/claims/[claimId]/verify`: `ai:run_extraction_verification` (OWNER, REVIEWER)
- `GET /api/projects/[id]/claims/[claimId]/verification`: `claims:view_unapproved` (OWNER, REVIEWER)
- `GET /api/projects/[id]/conflicts`: `claims:view_unapproved` (OWNER, REVIEWER)




