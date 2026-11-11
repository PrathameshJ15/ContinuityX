# ContinuityX

**Intelligence That Keeps Projects Moving.**\
People may leave, but project knowledge should stay.

ContinuityX is an AI-powered Project Knowledge & Handover Intelligence
Platform. It reconstructs project knowledge from authorised documents,
links claims to evidence, detects contradictions and knowledge gaps, and
generates an approved handover.

## Core differentiator: Proof-Carrying Handover

Every important claim carries a structured triple
`(subject, attribute, value)`, source document/location, supporting
excerpt, verification status and reviewer decision. Approved handovers
produce a versioned snapshot and SHA-256 integrity hash.

## Locked stack

-   Next.js, React, TypeScript
-   Tailwind CSS and shadcn/ui
-   Next.js API routes/server actions
-   PostgreSQL on Neon, Prisma
-   Gemini API via modular server-side service
-   PDF, DOCX and CSV parsing
-   Auth.js or equivalent
-   Vercel

Do not replace the stack or recreate the repository before the
repository audit.

## Product workflow

1.  CONNECT --- create project and upload authorised documents.
2.  RECONSTRUCT --- extract decisions, tasks, people, ownership,
    dependencies, risks and questions.
3.  VERIFY --- link claims to evidence and classify support.
4.  REVIEW --- authorised reviewer edits, rejects, resolves or approves.
5.  HANDOVER --- generate approved continuation plan.

## Documents (8 files)

| File | What it holds |
|---|---|
| `AGENTS.md` | Rules for AI coding assistants. Read first every session |
| `SPEC.md` | Vision, locked scope, verification rules, snapshot and receipt |
| `TECH_DESIGN.md` | Architecture, database, API, security, deployment, UI |
| `PLAN_AND_TESTING.md` | The 10 phases, exit tests, test strategy |
| `DEMO_AND_BENCHMARK.md` | Demo dataset, benchmark method, pitch |
| `DECISIONS.md` | Dated change log. Append only |
| `PROGRESS.md` | Live status per phase |
| `README.md` | This overview |

## Engineering rules

-   Audit existing code before changing structure.
-   Build one integrated product.
-   Complete and test P0-A before P0-B.
-   Never mark claims VERIFIED from model confidence alone.
-   Never infer chronology when reliable source dates are missing.
-   Enforce project isolation server-side.
-   A feature is not complete until acceptance checks pass.
-   Record scope/architecture changes in `DECISIONS.md`.

Implementation status must be established by repository audit. Verify
hackathon deadlines against the latest official communication.
