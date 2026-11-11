# ContinuityX — Product Spec (locked V3.1 + V3.2 clarifications)

Contents:
- Product Vision
- Scope Lock V3.1
- Ai And Verification
- Snapshot And Receipt Spec

---

## Product Vision

### Problem

When a team member leaves or responsibility changes, knowledge is
scattered across documents, task boards, meeting notes and
conversations. Incoming members may not know decisions and rationale,
unfinished tasks, owners, dependencies, risks, contradictions or
unresolved questions.

### Product

ContinuityX reconstructs project knowledge from authorised source
documents, links claims to evidence, detects contradictions and
knowledge gaps, and creates an approved handover.

### Initial users

Student project teams, final-year engineering teams and small software
development teams. Later opportunities include startups, agencies and
product/engineering teams.

### Positioning

ContinuityX is not a generic chatbot, document summariser or project
management replacement. Its differentiator is evidence-backed project
continuity and human-approved handover.

"Notion stores knowledge. Jira tracks tasks. ContinuityX helps teams
verify what is supported by project evidence before handing it over."

This is positioning language, not an absolute competitor capability
claim.

### Product principles

1.  Evidence before confidence.
2.  Human approval for consequential handover decisions.
3.  Explainable results, not opaque scores.
4.  Unknown means unknown; do not invent missing facts.
5.  Secure project isolation.
6.  Useful output over feature count.
7.  Traceability from source to approved claim.

### Success criteria

A user can create a project, upload supported documents, inspect
extracted claims and evidence, understand statuses and conflicts,
review/approve claims, generate a handover snapshot/receipt and export a
usable PDF.

---

## Scope Lock --- V3.1

**Status: LOCKED.** This is the implementation authority. Do not reopen
product R&D or expand scope casually.

### P0-A --- Mandatory end-to-end flow

Create Project → Upload Documents → Extract Claims → Verify Evidence →
Detect Conflict → Review → Approve → Generate Receipt → Export PDF.

Includes: - Project creation and access control - PDF, DOCX, CSV upload
and validation - Text extraction and source metadata - Claim triple
extraction - Entity registry and normalisation - Four-gate
verification - Deterministic conflict detection - Split-pane evidence
review - Human approval - Approved handover snapshot - SHA-256 receipt -
Approved PDF export

P0-A is incomplete until this entire flow works end to end.

### P0-B --- Only after P0-A

-   Knowledge Loss Radar
-   Project Continuity Score
-   Evidence-Grounded Handover Q&A

### P1

Stale Handover Detection; Bus Factor Map; Verify Receipt button;
keyboard review; benchmark dashboard; processing UX.

### P2

Knowledge Graph; OCR; external integrations; advanced RBAC;
pgvector/RAG; predictive analytics.

### Entity registry

Maintain project-level canonical entities and aliases. Model proposes a
match; fuzzy matching is fallback; create a new entity when no reliable
match exists. Reviewers can merge duplicates, correct aliases and
resolve ambiguity. Incorrect entity mapping can cause missed or false
conflicts.

### Verification statuses

`VERIFIED`, `WEAK_SUPPORT`, `CONFLICTING`, `UNVERIFIED`, `UNKNOWN`.

Mapping: - Source existence FAIL → UNVERIFIED - Quote existence FAIL →
UNVERIFIED - Semantic SUPPORTS → continue - Semantic NEUTRAL →
WEAK_SUPPORT or UNKNOWN depending on evidence - Semantic CONTRADICTS →
CONFLICTING - Semantic INSUFFICIENT_CONTEXT → UNKNOWN - Contradiction
found → CONFLICTING - VERIFIED only when required checks pass and no
unresolved contradiction remains

Status comes from evidence outcomes and deterministic rules, never model
confidence.

### Prompt-injection controls

Treat uploaded text as untrusted data. Use schema-constrained
extraction, no tools/direct app permissions for extractor, an
independent judge limited to claim + excerpt + necessary context, flag
instruction-like text, and validate output server-side. These controls
reduce risk but do not guarantee immunity.

### Fair baseline

Baseline Gemini prompt: "Analyse supplied project docs; produce
structured project summary; identify decisions, tasks, owners and risks;
cite supporting source documents and locations; explicitly list
contradictions/inconsistencies."

Use same datasets and manually labelled ground truth. Measure Evidence
Attribution Accuracy, Unsupported Claim Rate, Conflict Detection
Precision/Recall, Prompt Injection Resistance and Extraction
Precision/Recall. Report actual results only and disclose dataset
size/limitations. Same-vendor judge bias and synthetic-data bias are
possible.

### Temporal no-date rule

If no reliable source date exists, do not infer supersession.
Conflicting claims with unknown chronology remain unresolved for human
review. `POSSIBLY_SUPERSEDED` only when reliable dates establish
plausible chronological order.

### Continuity Score heuristics

Documentation Coverage 25%; Decision Traceability 20%; Ownership
Coverage 20%; Dependency Clarity 15%; Handover Readiness 20%. Score only
metrics with sufficient evidence. If available weight is below 60%, show
**Insufficient Evidence**. Show score, coverage, metric scores and
missing metrics. Weights are initial heuristics, not validated.

### Handover Q&A

Use approved claims and authorised project data only. If evidence is
absent, respond: "No supporting evidence was found in the approved
project knowledge. This question requires clarification from the project
owner." Relational DB retrieval is sufficient for MVP; vector DB is not
required.

### Receipt

Canonicalise approved snapshot using deterministic serialisation. Hash
the snapshot, not a PDF containing its own hash. Store hash, approver,
timestamp and version. SHA-256 is an integrity fingerprint, not a
digital signature or proof of identity by itself.

### Change control

Record necessary changes in `DECISIONS.md` as:
`[YYYY-MM-DD] | Change | Reason | Impact`

Change locked scope only for technical impossibility or deadline-driven
cuts.

---

## AI Extraction & Evidence Verification

### AI boundary

Use Gemini server-side through a modular service interface.
Provider-specific code stays isolated. AI output is a candidate, not
authoritative state.

### Extraction

Extract decisions/rationale, tasks/status, owners, components,
dependencies, risks, unresolved questions and important project facts.
Represent key claims as `(subject, attribute, value)`. Include source
document and location where available; never invent missing locations.

### Entity normalisation

Load project registry; propose canonical ID; fuzzy-match as fallback;
create new entity when no reliable match exists; allow reviewer
correction, merge and ambiguity resolution. Do not silently merge
uncertain entities.

### Four gates

1.  **Source exists:** deterministically confirm referenced
    document/location.
2.  **Quote exists:** compare cited excerpt against extracted text with
    whitespace/punctuation normalisation; fuzzy matching must not
    conceal materially different wording.
3.  **Semantic support:** independent judge sees claim, cited excerpt
    and limited necessary context; returns `SUPPORTS`, `NEUTRAL`,
    `CONTRADICTS` or `INSUFFICIENT_CONTEXT` plus concise reason.
    Validate schema.
4.  **Contradiction scan:** compare same canonical subject and
    attribute, applying temporal rules.

### Final status

-   Source FAIL → `UNVERIFIED`
-   Quote FAIL → `UNVERIFIED`
-   `CONTRADICTS` → `CONFLICTING`
-   `INSUFFICIENT_CONTEXT` → `UNKNOWN`
-   `NEUTRAL` → `WEAK_SUPPORT` or `UNKNOWN`
-   unresolved contradiction → `CONFLICTING`
-   `VERIFIED` only when required checks pass and no unresolved
    contradiction remains

Never derive status from model confidence.

### Time

Without reliable source dates, chronology is unknown. Do not infer
supersession; keep conflict for human review.

### Prompt injection

Treat document text as untrusted data; delimit source content; constrain
extraction schema; provide no tools/app permissions; limit judge
context; flag instruction-like text; validate/sanitise output. No prompt
design guarantees complete immunity.

### Handover Q&A

Answer only from approved claims and authorised project data. If
unsupported, respond: "No supporting evidence was found in the approved
project knowledge. This question requires clarification from the project
owner." Relational retrieval is sufficient for MVP; vector search is not
required.

---

### V3.2 Clarifications (resolve open rules; no scope change)

#### 1. Evidence-status algorithm (first match wins)

| # | Condition | Evidence status |
|---|---|---|
| 1 | Source gate FAIL | `UNVERIFIED` |
| 2 | Quote gate FAIL | `UNVERIFIED` |
| 3 | Judge call failed, or output invalid after one controlled retry | `UNKNOWN` (flag for retry; never `VERIFIED`) |
| 4 | Judge `CONTRADICTS` | `CONFLICTING` |
| 5 | Judge `INSUFFICIENT_CONTEXT` | `UNKNOWN` |
| 6 | Judge `NEUTRAL` and excerpt contains the canonical subject or a known alias | `WEAK_SUPPORT` |
| 7 | Judge `NEUTRAL` and subject not found in excerpt | `UNKNOWN` |
| 8 | Judge `SUPPORTS` and claim is in an `OPEN` conflict | `CONFLICTING` |
| 9 | Judge `SUPPORTS` and no `OPEN` conflict | `VERIFIED` |

- Do not run the judge when gate 1 or gate 2 fails.
- A conflict only counts against claims whose review state is not `REJECTED`.
- When a conflict is resolved, re-evaluate the affected claims.
- "Reproducible" means: the same stored gate results plus the same `ruleSetVersion` always give the same status. LLM calls are not guaranteed identical, so store model name, prompt version and raw judge output for every run. Use temperature 0 for the judge.

#### 2. Evidence status is not review state

Two separate fields. Never merge them.

- **Evidence status** (machine, rule-derived): `VERIFIED`, `WEAK_SUPPORT`, `CONFLICTING`, `UNVERIFIED`, `UNKNOWN`.
- **Review state** (human): `PENDING`, `ACCEPTED`, `EDITED`, `REJECTED`.

Rules:
- Only `ACCEPTED` and `EDITED` claims enter a handover snapshot.
- Accepting a claim whose evidence status is not `VERIFIED` requires a written reason. The handover shows both values, for example "Reviewer-accepted | Evidence: WEAK_SUPPORT".
- A claim in an `OPEN` conflict cannot be accepted until the conflict is resolved.
- The UI and PDF must never show an unverified claim as if it were verified.

#### 3. Controlled attributes, values and cardinality

Without a controlled vocabulary, `(Auth, status, done)` and `(Auth, state, complete)` will never match, and conflict detection silently fails. The vocabulary lives in a versioned constants file. Adding an attribute is a `DECISIONS.md` entry.

| attributeKey | Cardinality | Value type | Different values = conflict? |
|---|---|---|---|
| `status` | single | enum: NOT_STARTED, IN_PROGRESS, BLOCKED, COMPLETED, CANCELLED | Yes |
| `owner` | single by default | entity reference (PERSON) | Yes (reviewer may resolve as "co-owners") |
| `selected_technology` | single per subject | normalised text | Yes |
| `due_date` | single | ISO date | Yes |
| `depends_on` | multi | entity reference | No |
| `risk` | multi | text | No |
| `open_question` | multi | text | No |
| `rationale` | multi | text | No (used by Radar rule R4) |

Value normalisation:
- The extractor must output the enum value directly for enum attributes.
- The server also maps known synonyms with a dictionary (done / complete / finished -> COMPLETED; WIP / ongoing -> IN_PROGRESS).
- If a value cannot be normalised, store `valueNormalized = null`, create no automatic conflict, and show "needs normalisation" to the reviewer.
- Conflict recall is bounded by entity and value normalisation quality. Measure it in the benchmark.

#### 4. Conflict rule

Create a `Conflict` when all of these hold:
1. Same project.
2. Same canonical subject Entity.
3. Same single-valued `attributeKey`.
4. Both claims have review state other than `REJECTED`.
5. Both `valueNormalized` are non-null and different.

Conflicts inside one document count. Conflict type comes from the attribute: status = `STATUS_CONFLICT`, owner = `OWNERSHIP_CONFLICT`, selected_technology = `DECISION_CONFLICT`, due_date = `TIMELINE_CONFLICT`, anything else = `VALUE_CONFLICT`.

Chronology: if both source documents have a reliable date (basis is not `UNKNOWN`) and the dates differ, set resolution state `POSSIBLY_SUPERSEDED`. Otherwise set `OPEN`. A human always confirms. Never auto-resolve.

#### 5. Source dates

Capture an optional "document date" at upload.
- `Document.sourceDate` (nullable) and `Document.sourceDateBasis`: `USER_PROVIDED`, `CONTENT_EXPLICIT` (a date written in the text), or `UNKNOWN`.
- File metadata dates and upload time are NOT reliable source dates.

#### 6. Edits, deletions and re-verification

- Editing a claim's subject, attribute, value or evidence creates a new claim version (`supersedesClaimId`), resets review state to `PENDING`, and re-runs the gates and the conflict scan.
- Deleting a document is a soft delete. Claims whose only evidence is that document become `UNVERIFIED`. Existing approved handovers stay immutable but show a "source later removed" warning.

#### 7. Handover Q&A hardening

1. Retrieve approved claims from the database (entity, attribute, keyword match), project-scoped.
2. If nothing is retrieved, return the fixed refusal message WITHOUT calling the model.
3. Otherwise give the model only the retrieved claims, as data, and require schema output: `{ answer, citedClaimIds[], supported }`.
4. Validate server-side that every `citedClaimId` is in the retrieved set. If not, return the refusal.
5. Claim text originally came from documents, so treat it as untrusted (second-order injection).

---

## Snapshot & Receipt Specification

Defines exactly what is hashed, so the SHA-256 receipt is reproducible and testable.

### Snapshot content (schemaVersion 1)

```json
{
  "schemaVersion": 1,
  "canonicalisationVersion": 1,
  "projectId": "...",
  "handoverVersion": 3,
  "previousReceiptHash": "hex-or-null",
  "claims": [
    {
      "claimId": "...",
      "claimVersion": 2,
      "subject": { "entityId": "...", "canonicalName": "..." },
      "attributeKey": "status",
      "valueRaw": "...",
      "valueNormalized": "COMPLETED",
      "evidenceStatus": "VERIFIED",
      "reviewState": "ACCEPTED",
      "reviewerReason": null,
      "evidence": [
        { "documentId": "...", "documentChecksum": "...", "location": "page 4", "excerpt": "..." }
      ]
    }
  ],
  "resolvedConflicts": [
    { "conflictId": "...", "type": "STATUS_CONFLICT", "resolution": "...", "reason": "..." }
  ]
}
```

Excluded from the hash: the hash itself, the PDF, generation timestamps, UI-only fields. Approver and approval time are stored beside the hash in the receipt row, not inside the hashed content.

### Canonicalisation

- Serialise as JSON, UTF-8, no extra whitespace.
- Sort object keys lexicographically.
- Sort arrays by a stable key (`claimId`, then `claimVersion`; evidence by `documentId`, then `location`).
- Normalise all strings to Unicode NFC.
- Consider RFC 8785 (JSON Canonicalization Scheme) or document an equivalent. Store `canonicalisationVersion` so future changes never break old receipts.

### Receipt fields

`handoverId`, `version`, `snapshotHash` (SHA-256 hex), `previousReceiptHash`, `approvedBy`, `approvedAt`, `canonicalisationVersion`.

### Rules

1. Create snapshot, hash and receipt in ONE database transaction.
2. Snapshot and receipt rows are never updated. A new approval creates a new version.
3. Only `ACCEPTED` and `EDITED` claims are included. Claims in an `OPEN` conflict cannot be included.
4. The PDF prints the hash, version, approver and time, so it can be compared with the stored receipt.

### Verify Receipt (P1, design now)

Two checks:
1. Recompute the hash from the stored snapshot JSON and compare with the stored hash.
2. Rebuild a snapshot from the live approved claims and evidence tables and compare with the stored hash. A mismatch means the underlying data changed after approval.

### Honest limits

- SHA-256 is an integrity fingerprint, not a digital signature and not proof of identity.
- `previousReceiptHash` links versions into a chain, which makes silent removal of an older version detectable.
- Someone with full database write access could still change both the snapshot and the hash. Stronger options (digital signatures, external anchoring) are roadmap items. Say this plainly in the demo.
