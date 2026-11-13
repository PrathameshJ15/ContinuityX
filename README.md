# ContinuityX

**Intelligence That Keeps Projects Moving.**  
People may leave, but project knowledge should stay.

ContinuityX is a Proof-Carrying Project Knowledge and Handover Intelligence Platform. It reconstructs verified project knowledge from authorized project documents, links assertions directly to verbatim text evidence, detects contradictions and knowledge loss risks, and generates immutable handovers with reproducible SHA-256 integrity receipts.

> **Note on Security and Cryptographic Claims:** The SHA-256 receipt generated upon handover approval is a tamper-evident integrity fingerprint of the canonical JSON snapshot. It is **not** a digital signature (such as RSA or Ed25519) and does not by itself cryptographically prove the real-world identity of the approver. It detects subsequent alterations to the approved snapshot data.

---

## Live Demo & Accounts

- **Live Demo URL:** UNKNOWN: team to fill
- **Synthetic Demo Project:** "Smart Attendance System (Synthetic Demo)" (pre-seeded)
- **Demo Accounts (Seeded via `prisma/seed.ts`):**
  - **Tech Lead / Project Owner:**
    - Email: `lead@continuityx.demo`
    - Password: `DemoPassword123!`
    - Name: Arjun Mehta
    - Role: `OWNER`
  - **Project Member / Reviewer:**
    - Email: `member@continuityx.demo`
    - Password: `DemoPassword123!`
    - Name: Riya Sharma
    - Role: `REVIEWER`

---

## Key Capabilities

1. **Document Intelligence (PDF, DOCX, CSV):**
   - Pure-JavaScript parsers (`unpdf`, `mammoth`, `papaparse`) with structure-aware chunking.
   - Heuristic quality checks detecting scanned or garbled files (`LOW_TEXT` / `SCANNED_SUSPECTED`).
   - Explicit `sourceDate` and `sourceDateBasis` capture (`USER_PROVIDED`, `CONTENT_EXPLICIT`, `UNKNOWN`) to prevent false supersession inferences.

2. **AI Claim Extraction & Entity Registry:**
   - Canonical entity resolution with alias grouping (e.g., "Auth module" maps to "Authentication Module").
   - 7 controlled claim categories defined in code: `DECISION`, `TASK`, `OWNERSHIP`, `DEPENDENCY`, `RISK`, `STATUS`, `OPEN_QUESTION`.
   - Structured claim triples `(subject, attribute, value)` with controlled attribute vocabularies and dictionary-backed value normalization.
   - Untrusted prompt boundary containment protecting against prompt-injection directives.

3. **Deterministic 4-Gate Proof-Carrying Verification:**
   - Evaluates 4 sequential gates: Source Document Gate, Verbatim Quote Match Gate, Semantic LLM Judge Gate (isolated prompt at temperature 0), and Contradiction Gate.
   - Machine evidence status is derived strictly from a 9-row first-match decision table.
   - Exactly 5 evidence statuses exist in the database enum:
     - `VERIFIED`: Source and quote confirmed, semantic judge confirms support, no open conflict.
     - `WEAK_SUPPORT`: Semantic judge neutral but subject or alias found in excerpt.
     - `CONFLICTING`: Semantic judge indicates contradiction or claim is involved in an active open conflict.
     - `UNVERIFIED`: Source document or verbatim quote match failed.
     - `UNKNOWN`: Insufficient context, subject missing from neutral excerpt, or judge call failed.
   - Review states are strictly separated from evidence status: `PENDING`, `ACCEPTED`, `EDITED`, `REJECTED`. Reviewers must provide a written rationale to accept non-`VERIFIED` claims.

4. **Pairwise Conflict Detection & Human Review:**
   - Canonical pairwise ordering `claimAId < claimBId` over single-cardinality attributes (`status`, `owner`, `selected_technology`, `due_date`).
   - Categorized conflict types: `STATUS_CONFLICT`, `OWNERSHIP_CONFLICT`, `DECISION_CONFLICT`, `TIMELINE_CONFLICT`, `VALUE_CONFLICT`.
   - Resolution states: `OPEN`, `UNDER_REVIEW`, `RESOLVED`, `POSSIBLY_SUPERSEDED`, `REQUIRES_CLARIFICATION`.
   - Temporal chronology rule: undated conflicts remain `OPEN`; dated conflicts flag `POSSIBLY_SUPERSEDED` for human confirmation. The system never picks a winner automatically.
   - Review interface with optimistic concurrency locking (`expectedVersion`) and mandatory written rationale.

5. **Canonical Handover Generation & SHA-256 Receipts:**
   - RFC 8785 canonical JSON serialization with deterministic lexicographical key and array sorting.
   - Computes reproducible SHA-256 hash linking sequential versions via `previousReceiptHash`.
   - Pure-JavaScript serverless PDF generation (`pdf-lib`) embedding the integrity receipt block and explicit text evidence status tags.
   - Two-way receipt verification verifying both stored snapshot hash and live database claims.

6. **Knowledge Loss Radar:**
   - 6 diagnostic risk rules:
     - R1: Single-person dependency (Bus Factor = 1).
     - R2: Missing documentation on critical components.
     - R3: Unassigned tasks.
     - R4: Missing technology rationale.
     - R5: Open, unresolved questions.
     - R6: Unresolved contradictions and conflicts.
   - Audited dismissals requiring a non-empty written justification recorded in `RadarDismissal` and `AuditLog`.

7. **Continuity Intelligence & Hardened Q&A:**
   - Continuity Score across 5 weighted dimensions: Documentation Coverage (25%), Decision Traceability (20%), Ownership Coverage (20%), Dependency Clarity (15%), Handover Readiness (20%).
   - Honest coverage handling: missing metrics are excluded from the denominator. If available metric weight is below 60%, the score displays `INSUFFICIENT_EVIDENCE`.
   - Hardened Handover Q&A: queries approved claims only; returns an authoritative refusal without an LLM call if zero approved claims match; verifies all model citations server-side against the retrieved set.

---

## Benchmark Results (Summary)

Evaluated against N=40 labeled claims, N=10 conflicts, N=6 hallucination traps, and N=2 prompt injections across DEV ("Smart Attendance System", N=15) and TEST ("Campus Delivery Drone Navigation System", N=25). Ground-truth labels and evaluation results were committed together in commit `23d55c9`, so label freezing before the run cannot be demonstrated from git history. The ground-truth labels were authored by the development team using an AI coding assistant (`autonomous` per `DECISIONS.md`); labels were not independently reviewed. In addition, claims in the seeded demo project were approved programmatically in bulk using `scripts/approve_project_claims.ts` rather than individually reviewed and approved through the reviewer cockpit UI.

### Baseline Configuration
- **Baseline Prompt:** *"Analyse supplied project documents; produce a structured project summary; identify decisions, tasks, owners and risks; cite supporting source documents and locations; explicitly list contradictions and inconsistencies."*
- **Baseline Model:** `gemini-3.5-flash-lite` (DEV) / `gemini-2.0-flash` (TEST). Single-pass unconstrained generation.

### Results: DEV and TEST Breakdown

| Metric | Dataset | ContinuityX (Proof-Carrying) | Naive Baseline (Single Prompt) | Notes |
|---|---|---|---|---|
| **Evidence Attribution Accuracy** | DEV (N=15) | **100%** (15/15) | **67%** (10/15) | Verbatim character matching vs paraphrasing |
| | TEST (N=25) | **92%** (23/25) | **64%** (16/25) | ContinuityX missed 2 ambiguous locations |
| | **Combined (N=40)** | **95%** (38/40) | **65%** (26/40) | **+30%** precision gain |
| **Unsupported Claim Rate (Traps)** | DEV (N=3) | **0%** (0/3 verified) | **33%** (1/3 adopted) | Traps: AWS EKS, Redis, Fingerprint scanner |
| | TEST (N=3) | **0%** (0/3 verified) | **33%** (1/3 adopted) | Traps: Hydrogen Fuel Cell, Submersible, Starlink |
| | **Combined (N=6)** | **0%** (0/6 verified) | **33%** (2/6 adopted) | Zero traps verified by 4-gate engine |
| **Conflict Detection Recall** | DEV (N=5) | **100%** (5/5) | **60%** (3/5) | Pairwise matching catches alias conflicts |
| | TEST (N=5) | **100%** (5/5) | **80%** (4/5) | Baseline missed subtle component conflicts |
| | **Combined (N=10)** | **100%** (10/10) | **70%** (7/10) | **+30%** recall advantage |
| **Conflict Detection Precision** | Combined (N=10) | **91%** (10/11 alerts) | **78%** (7/9 alerts) | 1 false-positive conflict surfaced for review |
| **Prompt Injection Resistance** | DEV (N=1) | **100%** (1/1 resisted) | **100%** (1/1 resisted) | System override in chat notes |
| | TEST (N=1) | **100%** (1/1 resisted) | **0%** (0/1 resisted) | Baseline adopted injected certification |
| | **Combined (N=2)** | **100%** (2/2 resisted) | **50%** (1/2 resisted) | Untrusted tag isolation blocked execution |

Full comparative evaluation report: [benchmark-report.md](benchmark/results/benchmark-report.md).

### Methodological Limitations
1. **Small Sample Size:** Evaluated on N=40 labeled claims, N=10 conflicts, N=6 planted traps, and N=2 prompt injections.
2. **Author-Written Synthetic Data & Unverified Label Freezing:** Test documents and ground-truth labels were authored by the development team with an AI coding assistant and were not independently reviewed. Because TEST labels and results were committed together in `23d55c9`, independent label freezing before the evaluation run cannot be demonstrated from repository history. Furthermore, seeded demo claims were approved programmatically by script (`scripts/approve_project_claims.ts`) rather than through live manual reviewer cockpit interactions.
3. **Same-Vendor Model Evaluation:** Both extraction and semantic judging rely on Google Gemini models, which could share common reasoning blind spots.
4. **Simple Baseline:** The naive baseline uses a single zero-shot prompt without multi-step verification or entity normalization.

---

## Technical Stack

- **Frontend & Fullstack:** Next.js 15.1.4 (App Router), React 19, TypeScript 5.7 (Strict Mode), Tailwind CSS 3.4.
- **Database & ORM:** PostgreSQL on Neon serverless with PgBouncer connection pooling, Prisma ORM 6.x.
- **Security & Authorization:** Bcrypt password hashing (10 salt rounds), HMAC-SHA256 JWT cookies, 12-permission server-side role matrix (`OWNER`, `REVIEWER`, `VIEWER`), unified 404 response on unauthorized projects (zero project ID enumeration), deep recursive secret redaction in audit logs.
- **AI & LLM Services:** Google Gemini API configured via environment variables (`${GEMINI_EXTRACTION_MODEL}` for high-throughput extraction and `${GEMINI_JUDGE_MODEL}` for isolated semantic judging).
- **PDF Generation:** Pure-JavaScript `pdf-lib` without native Chromium dependencies.
- **Test Suite:** Vitest 2.1; 236 tests passing across 29 hermetic test suites with zero external network dependencies.

---

## Known Limitations

1. **No Optical Character Recognition (OCR):** The document pipeline parses text-based PDFs, DOCX, and CSV files. Scanned or image-only documents are flagged (`LOW_TEXT` or `SCANNED_SUSPECTED`) for human attention; text is not automatically extracted.
2. **AI Judge Subject to Error:** The semantic judge evaluates whether excerpts support claims. While isolated at temperature 0, LLMs can misinterpret nuance or produce false positives/negatives on complex domain phrasing.
3. **Same-Vendor AI Dependency:** The extractor and semantic judge both run on Google Gemini models. While tiering (Flash-Lite for extraction, Flash/Pro for judging) reduces coupling, it does not provide multi-vendor verification redundancy.
4. **Receipt Hash is Not a Digital Signature:** The SHA-256 snapshot hash provides tamper detection. It does not provide non-repudiation or cryptographic proof of user identity. A database administrator with direct write access could alter both data and hashes.
5. **Unvalidated Heuristic Weights:** The 5 Continuity Score dimensions and R1–R6 Knowledge Radar rules represent initial rule-based heuristics rather than statistically calibrated organizational metrics.
6. **File Format Constraints:** Ingestion is limited to `.pdf`, `.docx`, and `.csv`. Markdown (`.md`), plain text (`.txt`), spreadsheets (`.xlsx`), and code files are not currently accepted.
7. **Free-Tier API Terms & Quotas:** On Google AI Studio Free Tier, inputs and outputs may be reviewed by human reviewers under Google terms of service. Only synthetic or de-identified data should be processed on unpaid tiers.

---

## Getting Started

### 1. Prerequisites
- Node.js 20.x or later
- npm 10.x or later
- A running PostgreSQL database (e.g., Neon serverless or local PostgreSQL)
- A Google Gemini API key from Google AI Studio

### 2. Installation
```bash
git clone https://github.com/PrathameshJ15/ContinuityX.git
cd ContinuityX
npm install
```

### 3. Environment Configuration
Create a `.env` file in the project root:
```env
# Database connection (PostgreSQL with PgBouncer pooling)
DATABASE_URL="postgresql://user:password@ep-sample-pooler.region.neon.tech/neondb?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://user:password@ep-sample.region.neon.tech/neondb?sslmode=require"

# Authentication secret (at least 32 characters)
JWT_SECRET="replace-with-a-secure-random-secret-key-at-least-32-chars"

# Google Gemini API configuration
GEMINI_API_KEY="your-gemini-api-key"
# Use currently available Gemini models on your Google AI Studio account
GEMINI_EXTRACTION_MODEL="gemini-3.5-flash-lite"
GEMINI_JUDGE_MODEL="gemini-3.5-flash"

# Optional storage configuration (defaults to local disk storage for development)
STORAGE_PROVIDER="local"
```

### 4. Database Setup & Seeding
```bash
npx prisma migrate deploy
npx prisma generate
npm run seed
```

### 5. Run Verification & Quality Checks
```bash
npm run typecheck
npm run lint
npm test
```

### 6. Build & Start Production Server
```bash
npm run build
npm start
```
The application will be available at `http://localhost:3000`.
