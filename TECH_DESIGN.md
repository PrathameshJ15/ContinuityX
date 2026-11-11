# ContinuityX — Technical Design

Contents:
- System Architecture
- Database Design
- Api Contracts
- Security And Privacy
- Deployment And Environment
- Ui Ux Guidelines

---

## System Architecture

### High-level flow

``` text
Browser / Next.js UI
        |
Authentication + project permission checks
        |
Next.js server/API layer
        |
  +-----+-----------------------+
  |                             |
Neon PostgreSQL             Domain services
via Prisma                  - document ingestion
                            - AI extraction (Gemini)
                            - entity resolution
                            - evidence verification
                            - conflict detection
                            - human review
                            - handover generation
                            - receipt generation
                            - intelligence
                                  |
                            Private file storage
```

### Boundaries

**Frontend:** presentation and user interaction only; no secrets or
authoritative permission logic.\
**API/server:** session validation, project permission checks, input
validation, orchestration and typed responses.\
**Domain services:** business rules, kept outside React components and
route handlers.\
**Data layer:** Prisma/database access; every project-scoped query
enforces membership and role.\
**AI layer:** server-side Gemini abstraction; model output is untrusted
until schema-validated and checked by application rules.\
**Storage:** private uploaded files; no permanent public URLs for
private documents.

### Request lifecycle

1.  Browser sends request.
2.  Server validates session.
3.  Server checks project membership and role.
4.  Input is validated.
5.  Domain service executes.
6.  AI is called only when needed, server-side.
7.  AI output is schema-validated.
8.  Deterministic rules compute authoritative state.
9.  Valid results are persisted.
10. Only authorised data is returned.

### Data flow

Documents → extracted text/source locations → candidate claims → entity
normalisation → evidence verification → conflict scan → reviewer
decisions → approved claims → versioned handover snapshot → receipt and
PDF.

### Suggested source layout

``` text
src/
  app/ (marketing, auth, dashboard, projects/[projectId], api)
  components/ (ui, layout, dashboard, documents, claims, evidence,
               conflicts, handover, intelligence)
  lib/ (auth, db, storage, validation, permissions)
  services/ (ai, documents, entities, claims, verification,
             conflicts, reviews, handover, intelligence)
  types/
  constants/
prisma/
tests/
docs/
```

Adapt after repository audit; do not blindly move or recreate existing
code.

### Constraints

-   No direct database access from browser.
-   No Gemini key in client code.
-   No model confidence as verification status.
-   No cross-project retrieval.
-   No whole-document dump to independent judge.
-   No OCR in MVP; flag scanned/low-text files.
-   No pgvector requirement for MVP.
-   Prefer DB processing status and controlled async over complex queues
    unless required.

---

## Database Design --- Logical Model

This is a logical model, not a final Prisma schema. Finalise fields,
indexes, constraints and deletion behaviour after repository audit.

### Models

-   **User:** account and authentication relation.
-   **Project:** project workspace.
-   **ProjectMember:** User--Project join, role and membership state.
-   **Document:** file metadata, storage key, MIME type, size, uploader
    and processing status.
-   **DocumentChunk:** extracted text segment and page/section/row
    location.
-   **ProcessingJob:** ingestion status, attempts, errors and
    timestamps.
-   **Entity:** canonical project-level person/component/system.
-   **EntityAlias:** alternative name mapped to canonical Entity.
-   **Claim:** structured subject, attribute, value and extraction
    state.
-   **ClaimEvidence:** claim-to-document link, exact excerpt and source
    location.
-   **Verification:** gate outcomes, reasons, final status and run
    metadata.
-   **Conflict:** potentially incompatible claims and resolution state.
-   **Review:** reviewer decision, actor and timestamp.
-   **ReviewAction:** edits, approvals, rejections, merges and
    resolutions.
-   **AuditLog:** security/lifecycle events.
-   **Handover:** handover record and version.
-   **HandoverSnapshot:** canonical approved snapshot.
-   **HandoverReceipt:** SHA-256, approver, timestamp, snapshot version
    and canonicalisation version.

### Relationship outline

``` text
User --< ProjectMember >-- Project
Project --< Document --< DocumentChunk
Project --< Entity --< EntityAlias
Project --< Claim --< ClaimEvidence >-- Document
Claim --< Verification
Claim --< Review --< ReviewAction
Project --< Conflict
Project --< Handover --< HandoverSnapshot -- HandoverReceipt
Project --< AuditLog
```

### Integrity requirements

-   Every project-owned record must be scoped to a project directly or
    through a validated parent.
-   Enforce foreign keys and unique constraints.
-   Index project IDs and frequently queried relation keys.
-   Use transactions for approval and snapshot/receipt creation.
-   Preserve evidence source locations.
-   Define deletion/retention behaviour.
-   Never trust client-supplied project ID without membership checks.

---

### V3.2 Field and model additions

Added so existing P0-A rules (dates, versions, caching, reproducibility) can actually be stored.

- **Document:** `checksum` (SHA-256, unique per project), `pageCount`, `textQuality` (`OK`, `LOW_TEXT`, `SCANNED_SUSPECTED`), `sourceDate`, `sourceDateBasis` (`USER_PROVIDED`, `CONTENT_EXPLICIT`, `UNKNOWN`), `deletedAt` (soft delete).
- **ExtractionRun (new):** `projectId`, `documentId`, `model`, `promptVersion`, `schemaVersion`, `inputChecksum`, `status`, `startedAt`, `finishedAt`, `error`. Used for caching by checksum and for provenance.
- **Entity:** `type` (`PERSON`, `COMPONENT`, `SYSTEM`), `createdBy` (`MODEL`, `REVIEWER`), `mergedIntoId` (nullable; merges are soft and auditable).
- **Claim:** `subjectEntityId`, `attributeKey` (controlled vocabulary), `valueRaw`, `valueNormalized` (nullable), `category`, `reviewState`, `version`, `supersedesClaimId`, `extractionRunId`, `injectionFlag`, `confidence` (advisory only, never used for status).
- **Verification:** `gateResults` (JSON: source, quote, semantic, contradiction), `finalStatus`, `ruleSetVersion`, `judgeModel`, `judgePromptVersion`, `rawJudgeOutput`, `runAt`.
- **Conflict:** `type`, `resolutionState` (`OPEN`, `UNDER_REVIEW`, `RESOLVED`, `POSSIBLY_SUPERSEDED`, `REQUIRES_CLARIFICATION`), `resolvedBy`, `resolutionReason`.
- **HandoverReceipt:** also store `previousReceiptHash` (nullable) for the hash chain. See `SPEC.md`.

Suggested constraints: unique `(projectId, checksum)` on Document; index `(projectId, subjectEntityId, attributeKey)` on Claim; HandoverSnapshot and HandoverReceipt rows are never updated after creation.

---

## API Contracts --- Planning Baseline

Exact routes, methods and schemas must be finalised against the existing
repository during implementation.

### Rules

Authenticate protected requests; authorise project access server-side;
validate inputs/outputs; use consistent errors; paginate collections;
use transactions for approvals; make processing retry-safe where
practical.

### Logical endpoint groups

-   **Auth:** register/login/logout/session using selected Auth.js
    setup.
-   **Projects:** create/list/get/update/archive; manage members.
-   **Documents:** upload, list, metadata, processing status, delete,
    permitted preview/excerpt.
-   **Claims:** list/filter, get claim/evidence, trigger extraction,
    edit candidate, entity suggestions.
-   **Verification:** trigger verification, get result, re-run after
    relevant source/claim change.
-   **Conflicts:** list/get, resolve or keep unresolved with reviewer
    reason.
-   **Reviews:** approve/reject/edit claim, merge entities, reviewer
    comment.
-   **Handovers:** create draft, preview, approve, generate receipt,
    export approved PDF, retrieve receipt.
-   **Intelligence:** radar, continuity score/coverage, bus-factor map,
    evidence-grounded Q&A.

### Standard error

``` json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to access this project.",
    "requestId": "request-id"
  }
}
```

Do not expose stack traces or sensitive internal details.

For each endpoint document method/route, authentication, required role,
request/response schema, error codes, pagination/idempotency and tests.

---

## Security & Privacy

### Principles

Deny by default; enforce project isolation server-side; minimise AI
data; keep files private; treat uploaded content and model output as
untrusted; log important actions without secrets.

### Authentication and authorisation

-   Validate sessions server-side.
-   Check project membership on every project-scoped request.
-   Enforce roles server-side, not only by hiding UI controls.
-   Prevent cross-project IDOR.
-   Re-check permissions before file, claim, receipt or export access.

### File security

-   MVP types: PDF, DOCX, CSV.
-   Validate extension, MIME type and file signature where feasible.
-   Enforce size and processing limits.
-   Generate storage keys; do not use user filename as path.
-   Use private storage and no permanent public URLs.
-   Handle malformed, encrypted, scanned and low-text files safely.
-   Never execute uploaded content.

### AI security

-   Keep keys server-side.
-   Treat documents as data, not instructions.
-   Constrain model output to schemas.
-   Give models no direct database/app tools.
-   Limit judge context to claim and cited excerpt.
-   Validate output before persistence.
-   Rate-limit expensive AI operations.
-   Avoid unnecessary personal/confidential data in prompts.

### Data protection and audit

Use secure environment variables, avoid secrets in source/logs, define
retention/deletion, use TLS and managed storage/database security, back
up production data and test restoration. Audit uploads/deletions, claim
edits, entity merges, review decisions, conflict resolution, handover
approvals, receipt creation and permission changes.

SHA-256 alone is not proof of identity or a legally binding signature.

### Release checklist

-   [ ] No committed secrets
-   [ ] Project isolation and role checks tested
-   [ ] Upload validation tested
-   [ ] Private storage confirmed
-   [ ] AI schema validation tested
-   [ ] Prompt-injection cases tested
-   [ ] Rate limits/error handling reviewed
-   [ ] Audit events verified
-   [ ] Production environment variables checked

---

### V3.2 Additions

#### Roles and permissions (MVP)

Three roles: `OWNER`, `REVIEWER`, `VIEWER`. All checks are server-side.

| Action | OWNER | REVIEWER | VIEWER |
|---|:---:|:---:|:---:|
| Create project (becomes OWNER) | any signed-in user | - | - |
| Manage members / delete project | Yes | No | No |
| Upload or delete documents | Yes | Yes | No |
| Run extraction / verification | Yes | Yes | No |
| Review claims, resolve conflicts, merge entities | Yes | Yes | No |
| Approve handover | Yes | Yes | No |
| View unapproved claims and evidence | Yes | Yes | No |
| View approved handover, receipt, PDF | Yes | Yes | Yes |
| Handover Q&A (approved claims only) | Yes | Yes | Yes |

#### Extra controls

- **Untrusted rendering.** Excerpts, claim text and entity names come from documents. Render as plain text, escape everything, never use `dangerouslySetInnerHTML`, and escape text before putting it into the PDF.
- **Second-order injection.** Q&A and handover generation read claim text that originated in documents. Treat it as data, not instructions.
- **Negative tests.** Every project-scoped route needs a test where a non-member and a lower-role member are refused.
- **Model-provider data terms.** Check the current Gemini API terms for how content is used on free or unpaid tiers. Use only synthetic or authorised documents until this is confirmed.
- **Rate limiting.** Limit extraction, verification and Q&A calls per user and per project, and cap file count and size per project.
- **Audit additions.** Log role changes, entity merges, soft deletes, receipt verification attempts and failed permission checks.

---

## Deployment & Environment

### Environments

Separate development and production configuration. Prefer separate
databases or clearly isolated databases.

### Environment variables

Use `.env.example` with names and safe placeholders only. Configuration
categories include database URL, auth secret/provider settings, Gemini
API key, private storage credentials and application base URL. Never
commit real `.env` files or secrets.

### Local development documentation

Record supported Node version, package manager/lockfile, install
command, environment setup, Prisma generate/migrate commands, dev
server, test, lint, type-check and build commands. Follow the
repository's existing package manager after audit.

### Database

Provision Neon PostgreSQL, configure Prisma, apply migrations in a
controlled process, verify pooling settings, back up production data and
document restore steps.

### File storage

Use private object storage in production. Configure access policies and
size limits. Do not assume local filesystem storage is durable on
serverless deployment.

### Vercel release

Connect verified repository; configure production environment variables;
run build checks; apply migrations safely; verify auth callback URLs and
private file access; smoke-test P0-A.

### Release checklist

-   [ ] Production build passes
-   [ ] Migrations applied
-   [ ] Environment configured
-   [ ] Authentication works
-   [ ] Project isolation verified
-   [ ] Upload and extraction work
-   [ ] AI calls are server-side
-   [ ] Review/approval works
-   [ ] Receipt and PDF export work
-   [ ] Public demo path tested
-   [ ] Limitations documented

---

### V3.2 Decisions to make in Phase 0 (record each in DECISIONS.md)

| Decision | Options to evaluate | Notes |
|---|---|---|
| Auth | Auth.js with credentials, OAuth, or equivalent | Pick one that also gives you a simple demo login. Check current docs for session-strategy limits of the provider you choose. |
| Private file storage | S3-compatible store (S3, R2), Supabase Storage, Vercel Blob if private access meets your needs | Local disk is not durable on serverless. Verify private access and signed URLs. |
| PDF export library | pdf-lib, pdfkit, or @react-pdf/renderer | Prefer pure-JS. Avoid headless Chromium on serverless unless proven to work in your plan. |
| Processing pattern | See below | Must fit function time limits. |
| Gemini models | Configure by env var | `GEMINI_EXTRACTION_MODEL`, `GEMINI_JUDGE_MODEL`. Use schema-constrained JSON output. Record the model in every ExtractionRun and Verification. |

#### Processing pattern for serverless

Long AI jobs can exceed serverless function time limits. Verify the current limits for your Vercel plan, then:

1. Upload stores the file and creates a `ProcessingJob` in `PENDING`.
2. A "process next step" endpoint handles ONE small step (parse, or one chunk, or one verification batch) per call and updates the job.
3. Steps are idempotent: safe to retry, keyed by document checksum and step number.
4. The UI polls job status and calls the next step, or a scheduled task does it.
5. Each job stores attempts, last error and a lease timestamp so two workers never run the same step.
6. Back off on Gemini rate-limit errors and mark the job `AI_PROCESSING_FAILED` after the retry cap, with a visible Retry button.

#### Phase 0 skeleton deploy

Deploy an empty but working app (login page plus database health check) to Vercel in Phase 0. Fix environment, callback URL and Neon pooling problems on day one, not on release day.

---

## UI/UX Guidelines

### Experience

Build a serious, premium productivity SaaS---not a generic AI template.
Prioritise clarity, evidence visibility, status hierarchy, fast review,
consistent typography/spacing, responsive behaviour and accessibility.

### Suggested project navigation

Overview; Documents; Claims; Evidence Review; Conflicts; Knowledge Loss;
Continuity; Handover; Settings. Show only implemented features available
to the user's role.

### Key screens

-   **Dashboard:** projects, status, recent activity and actionable
    alerts.
-   **Overview:** summary, processing state, key risks and handover
    readiness.
-   **Documents:** upload, processing, metadata, preview and errors.
-   **Claims:** decisions, tasks, owners, dependencies, risks and
    questions.
-   **Evidence Review:** claim/status beside source excerpt/location;
    approve/reject/edit based on permission.
-   **Conflicts:** competing claims, sources, reliable chronology and
    reviewer action.
-   **Knowledge Loss:** explain each alert and link to evidence or
    missing field.
-   **Continuity:** metrics, evidence coverage and missing metrics.
-   **Handover:** approved content, reviewer metadata, version, hash and
    PDF export.

### Status language

Use exact statuses: `VERIFIED`, `WEAK_SUPPORT`, `CONFLICTING`,
`UNVERIFIED`, `UNKNOWN`. Pair each with an explanation. Do not present
confidence as certainty.

### Required UI states

Loading, empty, partial data, processing, success, validation error,
permission denied, network/server error.

### Accessibility

Keyboard-operable review controls, visible focus, accessible labels,
status not colour-only, responsive evidence viewer.

### Content

Use plain language. Explain why a claim is weak/conflicting/unknown. Do
not use fake production data. Clearly label demo fixtures.
