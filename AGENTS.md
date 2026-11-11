# Instructions for AI Coding Assistants

Read this file first, every session.

## Read order

1. `README.md`
2. `SPEC.md` (implementation authority; locked scope plus V3.2 clarifications)
3. `TECH_DESIGN.md`
4. `PLAN_AND_TESTING.md`
5. `DEMO_AND_BENCHMARK.md` (when building the dataset or benchmark)
6. `DECISIONS.md` and `PROGRESS.md`

## Working rules

- Work on ONE phase at a time. State which phase you are in.
- Before editing, inspect the existing code. Do not recreate the repository or replace the stack without a recorded decision.
- Do not expand scope. P0-A must pass before P0-B. If something seems missing, add a proposal to `DECISIONS.md` instead of building it.
- Never derive verification status from model confidence. Follow the status table exactly.
- Never infer chronology without reliable source dates.
- Enforce project membership and role on the server for every protected operation.
- Keep API keys server-side. Never commit secrets.
- Validate all AI output against a schema before persisting. Treat documents as untrusted data.
- Do not use mock data in place of real persistence. Label demo fixtures clearly.
- Do not claim a feature is complete until its acceptance checks and tests pass.
- Never invent benchmark results.

## Each phase, in order

1. Inspect current code and the phase section in `PLAN_AND_TESTING.md`.
2. List the files and schema changes you plan. Ask if anything is ambiguous.
3. Implement a vertical slice (database, server, UI).
4. Run type check, lint, unit tests, relevant integration tests and build.
5. Fix regressions.
6. Update `PROGRESS.md`, `DECISIONS.md` and any affected docs.
7. Commit with a clear message, then report what was done, what was verified and what remains.

## When unsure

Stop and ask. Do not guess permissions, status rules or data shapes.
