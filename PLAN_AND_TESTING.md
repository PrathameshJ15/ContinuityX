# ContinuityX — Phases, Testing & Acceptance

Contents:
- Development Phases
- Testing And Acceptance

---

## Development Phases

Ten sequential phases; each extends the same integrated repository.

### Phase 0 --- Repository Audit & Foundation

Inspect repository, branches, dependencies, scripts,
Next.js/TypeScript/Prisma/database, auth, routes, components and
environment. Identify reusable code and gaps.\
**Exit:** repository map, verified local setup and prioritised backlog.

### Phase 1 --- Authentication & Project Workspace

Login/register/session; project CRUD; membership/basic roles;
dashboard/workspace.\
**Exit:** users can access only permitted projects.

### Phase 2 --- Document Intelligence & Upload

PDF/DOCX/CSV upload; validation/private storage/metadata; text
extraction and source locations; processing status/errors.\
**Exit:** supported documents upload, extract and persist reliably.

### Phase 3 --- AI Claim Extraction & Entity Registry

Schema-constrained extraction of decisions, tasks, owners, dependencies,
risks and questions; claim triples; canonical entities and aliases;
reviewer correction/merge.\
**Exit:** structured, source-traceable, editable claims.

### Phase 4 --- Proof-Carrying Verification

Source check; quote check; independent semantic judge; contradiction
scan; deterministic status mapping.\
**Exit:** reproducible status and evidence trail for candidate claims.

### Phase 5 --- Conflict Detection & Human Review

Entity/attribute matching; temporal/no-date rules; split-pane evidence
review; approve/reject/edit/resolve; audit history.\
**Exit:** unresolved conflicts cannot silently become verified.

### Phase 6 --- Handover & Receipt

Approved handover; canonical snapshot; SHA-256;
approver/timestamp/version; PDF export.\
**Exit:** complete P0-A flow passes end to end.

### Phase 7 --- Knowledge Loss Radar

Single-person dependency; missing documentation; unassigned tasks;
missing decision rationale; unresolved questions; inconsistent
status/ownership.\
**Exit:** every alert is explainable and linked to evidence or a missing
field.

### Phase 8 --- Continuity Intelligence

Continuity Score with coverage handling; Bus Factor Map as explainable
dependency indicator; Q&A over approved claims.\
**Exit:** insights use authorised evidence and communicate uncertainty.

### Phase 9 --- Quality, Security, Benchmark & Release

Responsive UI; project isolation/permission tests; unit/integration/E2E
tests; prompt-injection and upload tests; baseline benchmark; production
deployment and demo.\
**Exit:** public demo works, critical flows tested and limitations
documented.

### Phase discipline

For each phase: inspect current code; define files/schema changes;
implement vertical slice; run tests/type/lint/build; fix regressions;
update docs and decisions; commit. Do not start Phase 7/8 until Phase 6
passes.

---

### V3.2 Additions: deliverables and exit tests

Phase names and order are unchanged. These make each exit testable.

| Phase | Added deliverable | Exit test |
|---|---|---|
| 0 | Phase 0 decisions recorded (auth, storage, PDF library, processing pattern, Gemini models); skeleton deployed to Vercel; `PROGRESS.md` started | Skeleton is live and connects to Neon |
| 1 | Permissions matrix enforced server-side; AuditLog table started | A non-member cannot read or call another project by guessing IDs |
| 2 | Document date capture; `textQuality` flag; DEV demo dataset and ground-truth file (see `DEMO_AND_BENCHMARK.md`); baseline run on DEV | Garbled file flagged, duplicate upload caught, dates stored with basis |
| 3 | Controlled attribute vocabulary; value normalisation; injection defences in prompts; ExtractionRun records | Every claim is schema-valid and source-traceable; planted injection has no effect |
| 4 | Status algorithm implemented exactly as the V3.2 table | Hallucination traps never reach `VERIFIED`; status tests pass |
| 5 | Conflict rule implemented; review state separate from evidence status | All planted conflicts appear; no `OPEN`-conflict claim can be accepted |
| 6 | Snapshot and receipt per `SPEC.md`; PDF export | **Checkpoint:** full P0-A flow works on the DEV dataset; tamper test fails as expected |
| 7 | Radar rule definitions finalised (see below) | Each alert shows its rule and evidence |
| 8 | Q&A hardening; score coverage display | Unanswerable question returns the refusal without a model call |
| 9 | TEST dataset run for both systems; survey; backup demo video; fresh-browser demo test | Real results recorded; public demo works |

#### Radar rule definitions (so Phase 7 is not guesswork)

- **Component:** an Entity of type `COMPONENT`.
- **Critical component:** has at least 3 claims, OR is the target of a `depends_on` claim, OR was marked critical by a reviewer.
- **R1** single-person dependency: critical component with exactly one distinct owner.
- **R2** missing documentation: critical component with no claim of category `DECISION` or `rationale` and no document mentioning it.
- **R3** unassigned task: task claim with no `owner` claim.
- **R4** missing rationale: `selected_technology` claim with no `rationale` claim.
- **R5** unresolved question: `open_question` claim not marked resolved.
- **R6** inconsistency: component or task in an `OPEN` conflict.

Minimum for the demo: R1, R3, R5 (R6 comes almost free from the conflict engine).

---

## Testing & Acceptance

### Definition of Done

A feature is complete only when its workflow works, data persists,
server permissions are enforced, input/errors are handled, relevant
tests pass, loading/empty/failure states exist and docs are updated. A
finished UI alone is not completion.

### Test layers

**Unit:** status mapping, quote matching, entity matching, conflict
comparison, no-date rules, score coverage, snapshot
canonicalisation/hash.\
**Integration:** project-scoped queries, document persistence,
claim/evidence relations, approval transactions, receipt creation,
permissions.\
**E2E:** login → create project → upload → extract → verify →
review/approve → receipt → PDF.\
**Security:** cross-project access, role escalation, malformed uploads,
prompt-injection documents, invalid model output, missing/expired
sessions.

### P0-A acceptance flow

1.  Authorised user creates project.
2.  Uploads PDF, DOCX or CSV.
3.  System validates and extracts text.
4.  Metadata and source locations persist.
5.  Extractor proposes structured claims.
6.  Entities are resolved or ambiguity flagged.
7.  Verification gates run.
8.  Conflicts are detected.
9.  Reviewer inspects evidence and decides.
10. Approved claims form canonical snapshot.
11. SHA-256 is stored with approver, timestamp and version.
12. Approved PDF exports.

Test supporting claims, missing evidence, contradictory claims,
ambiguous entities, undated sources and malformed files.

### Quality gates

Before merge: TypeScript check, lint, unit tests, relevant integration
tests, build and manual smoke test. Before release: critical E2E,
permission/isolation tests, production config check and demo rehearsal.

Use controlled synthetic or authorised documents. Maintain manually
labelled expected claims/evidence/conflicts. Never put confidential
project data into public demo fixtures.

---

### V3.2 Additions

- **AI test doubles.** Unit and CI tests must not call Gemini. Use recorded or hand-written model responses. Run a small separate set of live-model smoke tests manually.
- **Invalid-output tests.** Feed malformed JSON, wrong enum values, missing fields and fabricated locations to the extractor and judge handlers. Expect rejection or controlled retry, never persistence.
- **Status algorithm table tests.** One test per row of the V3.2 status table in `SPEC.md`, plus "judge not run when gate 1 or 2 fails".
- **Golden hash tests.** A fixed snapshot must always produce the same canonical string and SHA-256. Reordering keys or claims must not change the hash. Changing one excerpt character must change it.
- **Conflict tests.** Same-document conflict, single vs multi-valued attribute, null normalised value (no conflict), rejected claim (no conflict), dated vs undated sources.
- **Receipt tamper test.** Modify an approved claim in the database, run Verify Receipt, expect failure.
- **Demo dataset as fixture.** The planted cases in `DEMO_AND_BENCHMARK.md` double as regression tests.
- **Authorisation matrix tests.** Generate tests from the permissions table in `TECH_DESIGN.md`.
