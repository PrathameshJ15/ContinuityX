# Progress

Update at the end of every phase and every work session. Status comes from the repository audit and passing tests, not from memory.

| Phase | Name | Status | Exit test passed? | Last updated | Notes / blockers |
|---|---|---|---|---|---|
| 0 | Repository Audit & Foundation | Done | Yes | 2026-11-12 | Foundation scaffolded, typecheck/lint/tests/build passing, 5 decisions recorded |
| 1 | Authentication & Project Workspace | Done | Yes | 2026-11-12 | Auth, User/Project/ProjectMember/AuditLog, permission matrix (61 tests pass) |
| 2 | Document Intelligence & Upload | Done | Yes | 2026-11-12 | Live Neon migration applied & seeded; validation, parsers, chunking, DEV dataset, 95 tests pass |
| 3 | AI Claim Extraction & Entity Registry | In progress | No | 2026-11-12 | Step 1 Inspect & Plan submitted for review |
| 4 | Proof-Carrying Verification Engine | Not started | No | | |
| 5 | Conflict Detection & Human Review | Not started | No | | |
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
- `npx tsx scripts/run-baseline-dev.ts`: Exit code 0 (parsed 5 DEV files cleanly; skipped Gemini call with explicit message `[Baseline] Skipped: GEMINI_API_KEY is not configured.`).
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
- [~] Baseline result saved (or explicitly skipped with a reason) — **SKIPPED cleanly** (no `GEMINI_API_KEY` configured yet; ready to run via `npm run baseline:dev`)
- [x] typecheck, lint, tests and build pass — **PASS**

### 4. Deviations and DECISIONS.md entries
- Added 4 Phase 2 entries in `DECISIONS.md` (`unpdf`/`mammoth`/`papaparse`, `ProcessingJob.stepData`, env-configurable upload caps, `USER_PROVIDED`/`UNKNOWN` date preservation).

### 5. Security confirmation: Document routes enforcement
Every document route enforces server-side auth & membership (`requireProjectAccess` with unified 404 for missing/non-member projects):
- `GET /api/projects/[id]/documents`: `project:read` (OWNER, REVIEWER, VIEWER)
- `GET /api/projects/[id]/documents/[docId]`: `project:read` (OWNER, REVIEWER, VIEWER)
- `GET /api/projects/[id]/documents/[docId]/download`: `project:read` (OWNER, REVIEWER, VIEWER), private `Cache-Control: private, no-cache, no-store, must-revalidate`
- `POST /api/projects/[id]/documents/upload`: `documents:upload_or_delete` (OWNER, REVIEWER only)
- `POST /api/projects/[id]/documents/[docId]/process`: `documents:upload_or_delete` (OWNER, REVIEWER only)
- `POST /api/projects/[id]/documents/[docId]/retry`: `documents:upload_or_delete` (OWNER, REVIEWER only)
- `DELETE /api/projects/[id]/documents/[docId]`: `documents:upload_or_delete` (OWNER, REVIEWER only)


