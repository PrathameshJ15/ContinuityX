# ContinuityX

**Intelligence That Keeps Projects Moving.**  
People may leave, but project knowledge should stay.

ContinuityX is a production-grade, Proof-Carrying Project Knowledge & Handover Intelligence Platform. It reconstructs verified project knowledge from authorized project documents, links assertions directly to verbatim text evidence, detects contradictions and knowledge loss risks, and generates cryptographically signed handovers with reproducible SHA-256 integrity receipts.

---

## Key Capabilities (v1.0.0 Release)

1. **Document Intelligence (PDF, DOCX, CSV):**
   - Multi-format parser with structure-aware chunking and scanned/garbled document detection (`LOW_TEXT` / `SCANNED_SUSPECTED`).
   - Explicit `sourceDate` and `sourceDateBasis` capture to prevent false supersession inferences.

2. **AI Claim Extraction & Entity Registry:**
   - Canonical entity resolution with alias grouping (e.g. `Auth module` $\rightarrow$ `Authentication Module`).
   - Controlled 4-category taxonomy (`DECISION`, `TASK`, `OWNERSHIP`, `DEPENDENCY`, `RISK`, `STATUS`, `OPEN_QUESTION`).
   - Untrusted prompt boundary containment protecting against adversarial prompt injections.

3. **Deterministic 4-Gate Proof-Carrying Verification:**
   - Evaluates 4 sequential gates: Source Document Gate, Verbatim Quote Match Gate, Semantic LLM Judge Gate (isolated at temperature 0), and Contradiction Gate.
   - Status is derived strictly from the authoritative 9-row decision table (`VERIFIED`, `WEAK_SUPPORT`, `CONFLICTING`, `CONTRADICTED`, `UNVERIFIED`, `UNKNOWN`, `FLAGGED`). Never derived from model confidence.

4. **Pairwise Conflict Detection & Human Review:**
   - Pairwise conflict analysis enforcing canonical ordering `claimAId < claimBId`.
   - Strict temporal chronology: undated conflicts remain `OPEN`; dated conflicts flag `POSSIBLY_SUPERSEDED` for human confirmation.
   - Split-pane review interface with optimistic concurrency locking (`expectedVersion`) and mandatory written rationale for non-VERIFIED claims.

5. **Canonical Handover Generation & SHA-256 Receipts:**
   - RFC 8785 canonical JSON serialization with deterministic lexicographical key and array sorting.
   - Computes reproducible SHA-256 hash forming a tamper-evident audit chain (`previousReceiptHash`).
   - Serverless PDF generation (`pdf-lib`) embedding cryptographic receipt box and explicit text evidence statuses.
   - Two-way receipt verification verifying both stored snapshot hash and live database claims.

6. **Knowledge Loss Radar:**
   - 6 diagnostic risk rules (R1 single-person bus factor, R2 missing documentation on critical components, R3 unassigned tasks, R4 missing technology rationale, R5 open questions, R6 unresolved conflicts).
   - Audited dismissals requiring written justification permanently stored in the audit log.

7. **Continuity Intelligence & Hardened Q&A:**
   - Continuity Score across 5 weighted dimensions (Documentation, Decision Traceability, Ownership, Dependency Clarity, Handover Readiness).
   - Honest coverage handling: excludes missing metrics from denominator; enforces $\ge 60\%$ coverage threshold (`INSUFFICIENT_EVIDENCE` if below).
   - Hardened Handover Q&A: queries approved claims only; returns authoritative refusal without model call if 0 claims match; verifies every cited claim server-side.

---

## Benchmark Results (Summary)

Evaluated against N=40 labeled claims, N=10 conflicts, N=6 hallucination traps, and N=2 prompt injections across DEV (Smart Attendance System) and held-out TEST (Campus Delivery Drone):

| Metric | ContinuityX (Proof-Carrying) | Naive Baseline (Single Prompt) |
|---|---|---|
| **Evidence Attribution Accuracy** | **95%** (38/40 claims) | **65%** (26/40 claims) |
| **Unsupported Claim Rate (Traps)** | **0%** (0/6 traps verified) | **33%** (2/6 traps adopted) |
| **Conflict Detection Recall** | **100%** (10/10 conflicts) | **70%** (7/10 conflicts) |
| **Prompt Injection Resistance** | **100%** (2/2 resisted) | **50%** (1/2 resisted) |

Full report: [benchmark-report.md](file:///benchmark/results/benchmark-report.md).

---

## Technical Stack

- **Frontend & Fullstack:** Next.js 15 (App Router), React 19, TypeScript 5.7 (Strict Mode), Tailwind CSS, shadcn/ui design tokens.
- **Database & ORM:** PostgreSQL on Neon serverless, Prisma ORM 6.x with connection pooling and direct migrations.
- **Security & Multi-Tenancy:** Bcrypt password hashing, HS256 JWT sessions in HttpOnly cookies, 12-permission role-based authorization matrix (OWNER, REVIEWER, VIEWER), zero project enumeration (404 on missing/unauthorized projects), audit logging with secret redaction.
- **AI & LLM Services:** Google Gemini API (`gemini-2.0-flash` / `gemini-1.5-pro`) isolated behind server-side provider interfaces with JSON schema validation.
- **Testing & Quality:** Vitest 2.1, 100% offline hermetic unit and integration tests (210 tests passing across 26 suites).

---

## Getting Started

### 1. Prerequisites & Environment Setup
Clone the repository and install dependencies:
\`\`\`bash
git clone https://github.com/PrathameshJ15/ContinuityX.git
cd ContinuityX
npm install
\`\`\`

Create a `.env` file in the root directory:
\`\`\`env
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://user:pass@host/db?sslmode=require"
JWT_SECRET="your-secure-jwt-secret-at-least-32-chars-long"
GEMINI_API_KEY="your-gemini-api-key"
GEMINI_EXTRACTION_MODEL="models/gemini-2.0-flash"
GEMINI_JUDGE_MODEL="models/gemini-2.0-flash"
\`\`\`

### 2. Database Migrations
\`\`\`bash
npx prisma migrate deploy
npx prisma generate
\`\`\`

### 3. Run Quality Checks
\`\`\`bash
npm run typecheck
npm run lint
npm test
\`\`\`

### 4. Build & Start Production Server
\`\`\`bash
npm run build
npm start
\`\`\`
The application is available at \`http://localhost:3000\`.

