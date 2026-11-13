# ContinuityX — Round 2 Hackathon Submission Document

**Submission Date:** 2026-11-14  
**Project Name:** ContinuityX — Proof-Carrying Project Knowledge & Handover Platform  
**Target Category:** Developer Tools / Knowledge Management / AI Productivity  

---

## 1. Project Links

- **Working Application URL:** UNKNOWN: team to fill
- **Repository URL:** [https://github.com/PrathameshJ15/ContinuityX.git](https://github.com/PrathameshJ15/ContinuityX.git)
- **Primary Branch:** `docs/round2-submission`
- **Seeded Demo Accounts (Local / Staging via `prisma/seed.ts`):**
  - **Tech Lead / Project Owner:** `lead@continuityx.demo` / `DemoPassword123!` (Arjun Mehta)
  - **Project Reviewer:** `member@continuityx.demo` / `DemoPassword123!` (Riya Sharma)

---

## 2. List of Completed Features

| Feature | Status | Real Implementation Evidence |
|---|---|---|
| **Multi-Format Document Parsing (PDF, DOCX, CSV)** | **Done** | `src/services/documents/parsers.ts` using `unpdf`, `mammoth`, and `papaparse`. Structure-aware chunking preserving page numbers and table rows. Tested by 13 unit tests in `tests/unit/documents-parsers.test.ts`. |
| **Document Quality & Scanned Detection** | **Done** | Heuristic character density and whitespace analysis detecting scanned or garbled files (`LOW_TEXT` / `SCANNED_SUSPECTED`). `src/services/documents/index.ts`. |
| **Explicit Source Date & Basis Tracking** | **Done** | Optional user date capture recording `sourceDateBasis` (`USER_PROVIDED`, `CONTENT_EXPLICIT`, `UNKNOWN`) to prevent false supersession inferences. `Document.sourceDate` and `Document.sourceDateBasis`. |
| **Canonical Entity Registry & Alias Management** | **Done** | Project-scoped entity resolution with alias grouping (`src/services/entities/resolution.ts`), manual entity merging (`src/app/api/projects/[id]/entities/merge`), and ambiguous entity review flags (`needsReview`). 14 tests in `tests/unit/entity-resolution.test.ts`. |
| **Structured Claim Triples & Vocabulary Normalization** | **Done** | Claims modeled as `(subjectEntityId, attributeKey, valueRaw/valueNormalized)`. 7 controlled categories (`DECISION`, `TASK`, `OWNERSHIP`, `DEPENDENCY`, `RISK`, `STATUS`, `OPEN_QUESTION`) and deterministic dictionary normalization. `src/lib/ai/vocabulary.ts`. |
| **Adversarial Prompt-Injection Defense** | **Done** | Ingested document content enclosed in `<untrusted_source_text>` isolation tags; heuristic prompt-injection detector (`src/lib/ai/injection-detector.ts`) flags instruction-like strings without halting ingestion. 6 tests in `tests/unit/extraction-validation.test.ts`. |
| **Deterministic 4-Gate Verification Engine** | **Done** | Sequential evaluation: Gate 1 (Source Existence), Gate 2 (Verbatim Quote Match with 0.85 fallback), Gate 3 (Semantic Judge at temperature 0), Gate 4 (Contradiction Check). Status derived strictly from a 9-row first-match algorithm. `src/services/verification/algorithm.ts`. |
| **Evidence Status vs Review State Separation** | **Done** | Machine status (`VERIFIED`, `WEAK_SUPPORT`, `CONFLICTING`, `UNVERIFIED`, `UNKNOWN`) strictly decoupled from human review state (`PENDING`, `ACCEPTED`, `EDITED`, `REJECTED`). Acceptance of non-`VERIFIED` claims strictly enforces a written rationale. `src/services/reviews/index.ts`. |
| **Pairwise Conflict Detection & Temporal Chronology** | **Done** | Enforces canonical order `claimAId < claimBId` over single-cardinality attributes (`status`, `owner`, `selected_technology`, `due_date`). Temporal rule marks dated conflicts `POSSIBLY_SUPERSEDED` and undated conflicts `OPEN`. Never auto-resolves. `src/services/conflicts/detector.ts`. |
| **Human Review Cockpit & Optimistic Locking** | **Done** | Split-pane review interface with keyboard navigation (`[A] Accept`, `[R] Reject`, `[N] Next`). Optimistic concurrency locking (`expectedVersion`) rejects concurrent reviewer collisions with HTTP 409. `src/app/projects/[projectId]/review/page.tsx`. |
| **Canonical Handover Snapshot & SHA-256 Receipt** | **Done** | RFC 8785 canonical JSON serialization with deterministic lexicographical key and array sorting (`src/services/handover/canonical.ts`). Computes SHA-256 hash linking sequential versions in an audit chain (`previousReceiptHash`). 7 tests in `tests/unit/handover-canonical.test.ts`. |
| **Pure-JavaScript Serverless PDF Export** | **Done** | Client and server-side PDF compilation using `pdf-lib` with embedded receipt block, explicit evidence status labels, and verbatim citations without native Chromium dependencies. `src/services/handover/pdf-exporter.ts`. |
| **Two-Way Receipt Verification & Tamper Detection** | **Done** | Recomputes SHA-256 hash against stored snapshot JSON and independently verifies live database claims against the receipt hash to detect out-of-band database mutations. `verifyReceiptService` in `src/services/handover/index.ts`. |
| **Knowledge Loss Radar (Rules R1 to R6)** | **Done** | Diagnostic risk rules: R1 (Bus factor = 1), R2 (Missing docs on critical components), R3 (Unassigned tasks), R4 (Missing technology rationale), R5 (Open questions), R6 (Unresolved conflicts). Audited dismissals require written rationale. `src/services/radar/rules.ts`. |
| **Honest Continuity Score & Heuristic Engine** | **Done** | 5 weighted dimensions (Documentation 25%, Decisions 20%, Ownership 20%, Dependencies 15%, Readiness 20%). Missing metrics excluded from denominator; displays `INSUFFICIENT_EVIDENCE` when available weight is below 60%. `src/services/intelligence/score.ts`. |
| **Hardened Handover Q&A with Citation Enforcement** | **Done** | Stage 1: Relational retrieval over approved claims only; returns authoritative refusal without model call if 0 claims match. Stage 2: Structured model output (`citedClaimIds`); verifies every citation server-side against retrieved set. 8 tests in `tests/integration/qa-service.test.ts`. |
| **Multi-Tenant RBAC & Zero Project ID Enumeration** | **Done** | 12-permission server-side matrix across `OWNER`, `REVIEWER`, `VIEWER`. Unauthenticated requests or non-members always receive unified HTTP 404 (`ProjectNotFoundError`), preventing project existence probing. `src/lib/permissions.ts`. |
| **Audit Logging with Deep Secret Redaction** | **Done** | Structured audit logging (`AuditLog` table) tracking uploads, reviews, entity merges, conflict resolutions, and approvals. Deep recursive sanitizer redacts passwords, tokens, API keys, and connection strings. `src/lib/audit.ts`. |
| **Automated DEV & Held-Out TEST Benchmark Suite** | **Done** | Automated evaluation harness comparing ContinuityX against a single-pass Gemini baseline across 40 claims, 10 conflicts, 6 traps, and 2 injections with frozen JSON fixtures. `scripts/run_benchmark.ts`, `tests/integration/benchmark.test.ts`. |

---

## 3. Technology and Implementation Details

### 3.1 Stack and Architectural Decisions

```text
Browser / Next.js 15 Client UI (Tailwind CSS, Cmd+K Search, Responsive Shell)
                      |
        HTTPS / JWT HttpOnly Cookie Session
                      |
Next.js Server API Routes (src/app/api/...)
  - Session verification (getCurrentUser)
  - Unified 404 access control (requireProjectAccess)
  - Zod input/output schema validation
                      |
+---------------------+---------------------+
|                                           |
Domain Services Layer                 Prisma ORM 6.x
- Document Ingestion (unpdf, mammoth) - Neon PostgreSQL (PgBouncer)
- AI Extraction (Gemini Flash-Lite)   - Connection pooling (limit=20)
- 4-Gate Verification (Algorithm)     - Strict foreign key constraints
- Pairwise Conflict Detection         - Single round-trip auth queries
- Review Queue & Concurrency
- Canonical Handover (RFC 8785)
- Knowledge Radar & Continuity Score
- Hardened Q&A (Approved Claims Only)
                      |
Google AI Studio API Server-Side
- Isolated extraction prompt
- Isolated zero-temperature judge
- Untrusted boundary tag containment
```

- **Frontend & Fullstack Framework:** Next.js 15.1.4 (App Router) with React 19 and TypeScript 5.7.
  *Why:* Server-side API route handlers execute all database queries and LLM API calls securely, keeping credentials and business rules completely isolated from client bundles.
- **Database Layer:** PostgreSQL hosted on Neon serverless, queried via Prisma ORM 6.x.
  *Why:* Relational schema enforcement, transactional integrity for handover snapshots, and foreign key cascades prevent orphaned records; PgBouncer connection pooling ensures fast serverless execution.
- **Authentication & Authorization:** Bcryptjs password hashing (10 salt rounds) and HMAC-SHA256 JWT tokens stored in secure HttpOnly cookies.
  *Why:* Eliminates external third-party SaaS identity dependencies, enabling fast, 100% hermetic offline testing (`vitest run`) without internet access.
- **PDF Generation:** Pure-JavaScript `pdf-lib`.
  *Why:* Avoids heavy, fragile headless Chromium dependencies (Puppeteer), guaranteeing deterministic byte generation within Vercel's 15-second execution and memory limits.

### 3.2 The Four-Gate Proof-Carrying Verification Engine

To eliminate model hallucinations, ContinuityX enforces that no claim reaches `VERIFIED` status based on model confidence. Candidate claims must pass four sequential deterministic gates:

1. **Gate 1: Source Document Existence:** Deterministically verifies that the cited `documentId` exists in the project workspace and has not been deleted. If missing, status immediately resolves to `UNVERIFIED`.
2. **Gate 2: Verbatim Quote Match:** Evaluates whether the cited excerpt exists verbatim in the source text using whitespace/punctuation normalization. If exact matching fails, it tests token-level similarity against a strict 0.85 threshold (`SIMILARITY_THRESHOLD = 0.85`) to handle PDF formatting quirks. If quote matching fails, status resolves to `UNVERIFIED`.
3. **Gate 3: Semantic LLM Judge (Isolated at Temperature 0):** An independent model call (`GEMINI_JUDGE_MODEL`) receives *only* the claim triple `(subject, attribute, value)` and the cited excerpt enclosed in untrusted tags. It returns structured JSON: `SUPPORTS`, `NEUTRAL`, `CONTRADICTS`, or `INSUFFICIENT_CONTEXT`. The judge never sees extractor confidence or the full document.
4. **Gate 4: Contradiction & Conflict Gate:** Scans existing claims for conflicting assertions on the same canonical subject and attribute. If an active `OPEN` conflict exists, the claim is assigned `CONFLICTING` even if the semantic judge returned `SUPPORTS`.

**Authoritative 9-Row Status Table (`src/services/verification/algorithm.ts`):**
- Gate 1 Fail -> `UNVERIFIED`
- Gate 2 Fail -> `UNVERIFIED`
- Gate 3 Failed/Timeout -> `UNKNOWN` (flagged for retry; never `VERIFIED`)
- Gate 3 `CONTRADICTS` -> `CONFLICTING`
- Gate 3 `INSUFFICIENT_CONTEXT` -> `UNKNOWN`
- Gate 3 `NEUTRAL` + subject found in excerpt -> `WEAK_SUPPORT`
- Gate 3 `NEUTRAL` + subject missing from excerpt -> `UNKNOWN`
- Gate 3 `SUPPORTS` + open conflict exists -> `CONFLICTING`
- Gate 3 `SUPPORTS` + no open conflict -> `VERIFIED`

### 3.3 Conflict Rule and Chronology Rule

- **Pairwise Matching:** Conflicts are detected across claims sharing the same `projectId`, same canonical `subjectEntityId`, and same single-cardinality `attributeKey` (e.g. `status`, `owner`, `selected_technology`, `due_date`), where both normalized values are non-null and differ.
- **Canonical Ordering:** Stored with canonical ordering `claimAId < claimBId` and a unique database index `[claimAId, claimBId]` to prevent duplicate reciprocal conflict records.
- **Strict Chronology Rule:**
  - If both source documents possess a reliable date (`sourceDateBasis !== 'UNKNOWN'`) and the dates differ, the conflict is assigned `POSSIBLY_SUPERSEDED`.
  - If either source document lacks a verified date (`sourceDateBasis === 'UNKNOWN'`), the conflict remains `OPEN`.
  - *Invariance:* The system **never** auto-resolves a conflict or declares a winner. A human reviewer must explicitly resolve it with a written rationale (`CHOOSE_A`, `CHOOSE_B`, `KEEP_BOTH` for co-ownership, `CONFIRM_SUPERSEDED`, or `REQUIRES_CLARIFICATION`).

### 3.4 Canonical Snapshot & Receipt Design

- **Deterministic Serialization:** In `src/services/handover/canonical.ts`, approved claims and resolved conflicts are compiled into schemaVersion 1 JSON following RFC 8785 principles: object keys are sorted lexicographically, arrays are sorted deterministically (`claimId` then `claimVersion`), and strings are normalized to Unicode NFC.
- **Receipt Hashing:** Computes a SHA-256 hash over the canonical JSON string. The receipt stores `snapshotHash`, `previousReceiptHash`, `approvedBy`, `approvedAt`, and `version`.
- **Receipt Chain:** Each new version incorporates `previousReceiptHash`, forming an append-only hash chain that makes the deletion or re-ordering of prior handovers immediately detectable.
- **Tamper Detection:** Two-way verification compares the stored hash against the serialized stored snapshot and checks whether live database claims match the snapshot.
- *Honest Cryptographic Boundary:* The hash is an integrity fingerprint, not a digital signature. It proves the data has not been modified since approval, but does not provide non-repudiation or prove approver identity without asymmetric private keys.

### 3.5 Security Controls and Multi-Tenant Isolation

- **Zero Project Enumeration:** `requireProjectAccess` returns HTTP 404 (`ProjectNotFoundError`) for both non-existent project IDs and unauthorized users, preventing malicious actors from enumerating project IDs.
- **Role-Based Authorization:** Server-side 12-permission matrix enforces `OWNER`, `REVIEWER`, and `VIEWER` permissions on every project-scoped route. Sole project owners cannot be demoted or removed.
- **Adversarial Prompt Containment:** Untrusted document text is enclosed in strict boundary tags (`<untrusted_source_text>`); heuristic detectors flag prompt-injection directives; LLMs receive no direct tools, database access, or client permissions.
- **Hardened Q&A Guardrail:** Q&A operates strictly over approved claims. If zero claims match relational retrieval, the service immediately returns a fixed refusal without an LLM call (`modelCalled: false`). All cited claim IDs are validated server-side.
- **Deep Audit Redaction:** All security and domain events write to `AuditLog`, with sensitive keys (`password`, `secret`, `token`, `key`, `databaseurl`) recursively redacted to `[REDACTED]`.

---

## 4. Changes from the Original Round 1 Plan

| Round 1 Plan Item | Status | What Was Built | Architectural Reason (from `DECISIONS.md`) |
|---|---|---|---|
| **pgvector Embeddings for Retrieval** | **Dropped / Postponed** | Relational DB retrieval matching approved entity names, aliases, and attribute keywords. | Avoids external vector database operational complexity in MVP; relational queries over human-approved claims deterministically eliminate retrieval hallucinations (`SPEC.md` line 164). |
| **OpenAI as Secondary Fallback LLM Provider** | **Dropped / Postponed** | Tiered Google Gemini models exclusively (`gemini-3.5-flash-lite` for extraction, `gemini-3.5-flash` for judging) with in-provider retry. | Minimizes multi-vendor SDK maintenance overhead and avoids paid third-party dependencies while preserving distinct extraction and judge models (`DECISIONS.md` [2026-11-12]). |
| **Quote Matching with "No Fuzzy Matching"** | **Modified** | Exact normalized substring matching with fallback to token-level Levenshtein similarity with strict 0.85 threshold. | PDF text extractors frequently introduce irregular linebreaks, hyphens, and whitespace variations; 0.85 token similarity handles formatting quirks without masking semantic differences (`SPEC.md` V3.2). |
| **Semantic Judge 4 Outputs** | **Clarified** | Formalized to `SUPPORTS`, `NEUTRAL`, `CONTRADICTS`, `INSUFFICIENT_CONTEXT`. | Required to drive the deterministic 9-row first-match status table without ambiguity (`SPEC.md` V3.2). |
| **Reviewer "Downgrade" Action** | **Modified** | Replaced with strict separation between machine evidence status and human review state (`PENDING`, `ACCEPTED`, `EDITED`, `REJECTED`). Reviewers can override non-VERIFIED claims only with written rationale. | Prevents human reviewers from altering objective machine evidence status while preserving complete auditability for domain overrides (`SPEC.md` V3.2). |
| **Project Memory Canvas Graph View (P1)** | **Modified** | Implemented as interactive Entity Registry and tabular Bus Factor Dependency Map. Canvas node-link visualizer deferred to P2. | Entity registry with aliases, review flags, and merge workflows delivers higher utility for conflict resolution than an uncalibrated canvas visualizer (`SPEC.md` line 96). |
| **Role-Specific Handover Templates (P1)** | **Modified** | Unified canonical 14-section handover report exported to PDF. Multi-template picker postponed. | A single, comprehensive canonical handover containing all decisions, tasks, owners, and receipts ensures complete fidelity before introducing partial role-based exports. |
| **"Incoming Member" Role Name** | **Modified** | Mapped to `VIEWER` role in 3-role matrix (`OWNER`, `REVIEWER`, `VIEWER`). | Standardizes SaaS RBAC terminology while providing incoming members read-only access to approved handovers, receipts, and Q&A (`DECISIONS.md` [2026-11-12]). |
| **Single Evaluation Project (8-10 Docs)** | **Modified** | Split into TWO synthetic projects: DEV ("Smart Attendance", 4 docs) and held-out TEST ("Campus Drone", 4 docs), totaling 40 claims. | Mandatory held-out testing prevents prompt overfitting and verifies that extraction and conflict rules generalize (`SPEC.md` V3.2). |

---

## 5. Evaluation

The platform was evaluated against **N=40 manually labeled claims**, **N=10 planted conflicts**, **N=6 hallucination traps**, and **N=2 adversarial prompt injections** across DEV and held-out TEST datasets. Ground-truth fixtures were authored and frozen in `demo-data/dev/ground_truth.json` and `demo-data/test/ground_truth.json`.

### 5.1 Baseline Configuration
- **Baseline Prompt:** *"Analyse supplied project documents; produce a structured project summary; identify decisions, tasks, owners and risks; cite supporting source documents and locations; explicitly list contradictions and inconsistencies."*
- **Model:** `gemini-3.5-flash-lite` (DEV) / `gemini-2.0-flash` (TEST). Single-pass unconstrained generation.

### 5.2 Comparative Results: DEV vs TEST Breakdown

| Metric | Dataset Slice | ContinuityX (Proof-Carrying) | Naive Baseline (Single Prompt) | Delta / Analysis |
|---|---|---|---|---|
| **Evidence Attribution Accuracy** | DEV (N=15) | **100%** (15/15) | **67%** (10/15) | Verbatim character matching |
| | TEST (N=25) | **92%** (23/25) | **64%** (16/25) | ContinuityX missed 2 location offsets |
| | **Combined (N=40)** | **95%** (38/40) | **65%** (26/40) | **+30% accuracy advantage** |
| **Unsupported Claim Rate (Traps)** | DEV (N=3) | **0%** (0/3 verified) | **33%** (1/3 adopted) | Traps: AWS EKS, Redis, Fingerprint |
| | TEST (N=3) | **0%** (0/3 verified) | **33%** (1/3 adopted) | Traps: Hydrogen, Submersible, Starlink |
| | **Combined (N=6)** | **0%** (0/6 verified) | **33%** (2/6 adopted) | **Zero traps reached VERIFIED** |
| **Conflict Detection Recall** | DEV (N=5) | **100%** (5/5) | **60%** (3/5) | Entity alias normalization advantage |
| | TEST (N=5) | **100%** (5/5) | **80%** (4/5) | Baseline missed subtle component conflicts |
| | **Combined (N=10)** | **100%** (10/10) | **70%** (7/10) | **+30% recall gain** |
| **Conflict Detection Precision** | Combined (N=10) | **91%** (10/11 alerts) | **78%** (7/9 alerts) | 1 false-positive conflict surfaced for review |
| **Prompt Injection Resistance** | DEV (N=1) | **100%** (1/1 resisted) | **100%** (1/1 resisted) | System override in chat export ignored |
| | TEST (N=1) | **100%** (1/1 resisted) | **0%** (0/1 resisted) | Baseline adopted injected certification |
| | **Combined (N=2)** | **100%** (2/2 resisted) | **50%** (1/2 resisted) | **100% boundary tag containment** |

### 5.3 Observed Failures and Methodological Limitations
1. **ContinuityX Attribution Failures (2/40 claims in TEST):** On multi-page PDF documents, irregular column layouts caused character span offsets to be off by several lines, failing the 0.85 quote match threshold and downgrading valid claims to `UNVERIFIED`.
2. **Small Evaluation Sample Size:** Total benchmark comprises 40 claims, 10 conflicts, 6 traps, and 2 prompt injections. While rigorous, results on larger enterprise corpuses may vary.
3. **Synthetic Author-Designed Datasets:** Ground truth and test documents were created by the platform authors, which could inherently reflect the assumptions of the schema.
4. **Same-Vendor Model Evaluation:** Gemini models were utilized for both extraction and judging, introducing potential common reasoning blind spots.

---

## 6. Research and Validation Status

Interview findings: UNKNOWN: team to fill with real responses only

---

## 7. Known Limitations and Honest Status

1. **No Optical Character Recognition (OCR):** Scanned PDF pages and images cannot be parsed into text. Files with low text density are flagged as `LOW_TEXT` or `SCANNED_SUSPECTED`, requiring human re-upload in digital format.
2. **AI Judge Semantic Misinterpretations:** While isolated at temperature 0, LLM semantic judges can occasionally misjudge complex conditional statements (e.g. "we will use PostgreSQL unless sharding requires MongoDB" judged as definitive support for MongoDB).
3. **Same-Vendor AI Verification Dependency:** Extraction and judging both rely on Google Gemini models. True adversarial verification requires independent heterogeneous foundation models (e.g. Anthropic Claude or OpenAI GPT-4o).
4. **SHA-256 Receipt is Not a Digital Signature:** The snapshot receipt provides tamper detection. It does not provide cryptographic non-repudiation: an administrator with direct database write access could alter claims and recompute the hash.
5. **Heuristic Continuity Weights:** The Continuity Score's 5 dimension weights and Knowledge Radar's R1–R6 thresholds are engineering heuristics that have not yet undergone longitudinal validation against enterprise project post-mortems.
6. **File Type Scope Limits:** Only PDF, DOCX, and CSV files are currently supported. Plain text, Markdown, source code, and XLSX files cannot be uploaded.
7. **Free-Tier Terms and Privacy:** Under Google AI Studio Free Tier terms, prompt data may be reviewed by human annotators. Only synthetic benchmark data may be uploaded on unpaid keys.

---

## 8. Three Major Improvements for Round 3 (Proposals for Team Confirmation)

### Proposal 1: Live GitHub & Google Drive Webhook Integration with Stale-Handover Detection
- **Problem Solved:** Current knowledge ingestion is static and manual (file upload). Project repositories and documentation continuously evolve in GitHub and Google Docs, causing approved handovers to drift and become obsolete.
- **Proposed Feature:** Implement bi-directional webhooks for GitHub (tracking default branch commits and pull request merges) and Google Drive (tracking document modifications). When source documents change, the platform runs a differential extraction, automatically tags affected claims as `REQUIRES_REVERIFICATION`, and surfaces a visible `STALE_HANDOVER_WARNING` on the project dashboard.
- **Measurable Completion Test:** In a test repository, pushing a commit that alters a markdown architecture file triggers the webhook within 5 seconds, identifies the affected claim in the database, transitions the project handover status to `STALE`, and renders a diff comparison in the UI highlighting the drifted claims, passing automated end-to-end integration tests.

### Proposal 2: Departure Impact Analysis & Knowledge Risk Simulation over Knowledge Graph
- **Problem Solved:** Teams frequently do not realize the blast radius of a key engineer's departure until after they have left. Radar rule R1 identifies single-owner components, but cannot simulate cascading dependencies.
- **Proposed Feature:** Construct an in-memory directed knowledge graph linking team members, verified ownership claims, system components, and `depends_on` relationships. Provide a "Departure Simulation" tool where selecting a team member calculates their exact blast radius: orphaned tasks, unmaintained critical components, unshared architectural rationales, and generates a prioritized, step-by-step Knowledge Transfer Checklist for that individual.
- **Measurable Completion Test:** In an integration test with a 20-node synthetic project graph, simulating the departure of the primary backend engineer correctly identifies 100% of directly owned components and transitively blocked downstream services, generating a targeted transfer checklist within < 500 ms execution time.

### Proposal 3: Independent Second-Vendor LLM Judge & Asymmetric Ed25519 Cryptographic Signatures
- **Problem Solved:** Current verification relies on Google Gemini for both extraction and judging (same-vendor bias), and the SHA-256 receipt does not cryptographically bind the real-world identity of the approver (tamper detection without non-repudiation).
- **Proposed Feature:**
  1. Add an independent secondary judge provider (e.g. Anthropic Claude 3.5 Sonnet or OpenAI GPT-4o) behind the `LLMProvider` interface. A claim reaches `VERIFIED` only when both independent models agree; disagreements are routed to the human review queue.
  2. Implement asymmetric digital signatures: when an Owner approves a handover, the canonical snapshot hash is signed using an Ed25519 private key (or WebAuthn hardware key). The public key and signature are permanently stored in `HandoverReceipt`.
- **Measurable Completion Test:** (a) In an automated benchmark, planted subtle semantic discrepancies produce model disagreements that are 100% routed to human review. (b) The exported PDF and Verify Receipt API cryptographically verify the Ed25519 digital signature against the approver's registered public key, correctly failing verification if any byte of the snapshot or public key is tampered with.

---

## 9. Team Contributions

UNKNOWN: team to fill truthfully.
