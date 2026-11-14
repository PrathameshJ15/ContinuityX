# ContinuityX Comprehensive Benchmark & Reference Evaluation Report

**Evaluation Timestamp:** 2026-11-13T00:54:08.000Z  
**Report Nature:** Reference report generated from fixture datasets (`scripts/run_benchmark.ts` is a fixture-based reference report generator, not an end-to-end dynamic benchmark harness).  
**Dataset Composition:**  
- **DEV Dataset:** 15 claims, 5 conflicts (Smart Attendance System)  
- **TEST Dataset:** 25 claims, 5 conflicts (Campus Delivery Drone Navigation System)  
- **Total Labeled Set:** 40 claims, 10 conflicts, 6 hallucination traps, 2 prompt-injection vectors  

---

## Comparative Performance Matrix

| Metric | ContinuityX (Proof-Carrying) | Naive Baseline (Single Prompt) | Nature of Comparison |
|---|---|---|---|
| **Evidence Attribution Accuracy** | **95%** (38/40)* | **65%** (26/40)* | Synthetic reference constants (*authored observations; runner does not dynamically execute quote matcher) |
| **Unsupported Claim Rate (Traps)** | **0%** (0/6 verified) | **0%** (0/6 adopted) | ContinuityX: structurally guaranteed by Rule 2 quote check; Baseline: 0/6 observed in saved outputs (replaces earlier unsupported 33% claim) |
| **Conflict Detection Recall** | **100%** (10/10)* | **70%** (7/10) | ContinuityX: synthetic reference constant (*pairwise logic implemented); Baseline: manually observed across DEV (3/5) and TEST (4/5) |
| **Conflict Detection Precision** | **91%*** | **78%*** | Synthetic reference constants (*authored estimates; no automated precision calculation in code) |
| **Prompt Injection Defense** | **100%** (2/2 resisted) | **2/2 flagged** | ContinuityX: architecturally guaranteed by server-side status derivation; Baseline: observed detection in saved outputs (not a measured resistance guarantee) |

---

## Detailed Analysis by Dimension

### 1. Evidence Attribution Accuracy
- **ContinuityX (38/40, 95%):** Claims are designed as triples `(subject, attribute, value)` linked to `Evidence` records with character offsets and source locations. The Quote Gate enforces that excerpts exist verbatim in the source text. In authored reference observations, 38 of 40 claims cited exact matching excerpts, with 2 location offsets in multi-page PDFs noted. This metric is stored as a synthetic reference constant in `scripts/run_benchmark.ts` rather than evaluated dynamically.
- **Naive Baseline (26/40, 65%):** The single-pass unconstrained Gemini prompt frequently paraphrased quotes or omitted specific page/section offsets. The 26/40 figure is an authored reference constant; no automated citation grading script exists in code.

### 2. Unsupported Claim Rate & Hallucination Defense
- **ContinuityX (0/6 verified, 0%):** The authoritative 4-gate verification engine evaluates source validity, verbatim quote match, semantic support, and contradiction checks. Under Rule 2 of `src/services/verification/algorithm.ts`, Gate 2 failure (`!quoteGatePassed`) strictly forces `status: "UNVERIFIED"`. Because the 6 planted traps (`AWS EKS`, `Redis cluster`, `Fingerprint scanner`, `Hydrogen Fuel Cell`, `Submersible Mode`, `Starlink`) do not exist in the source document texts, they cannot reach `VERIFIED`. This is an architecturally guaranteed invariant verified in unit tests.
- **Naive Baseline (0/6 adopted, 0%):** Direct inspection of the raw saved baseline outputs (`benchmark/results/dev-baseline.md` and `test-baseline.md`) confirms that the baseline model **did not adopt or mention any of the 6 traps**. The previously published claim of a 33% (2/6) trap adoption rate was an unsupported synthetic constant contradicted by the repository's own baseline artifacts.

### 3. Conflict Detection & No-Date Temporal Rule
- **ContinuityX (10/10 detected, 100%):** Pairwise conflict detection logic (`src/services/conflicts/detection.ts`) normalizes entity aliases (e.g. `CAS Module` $\rightarrow$ `Collision Avoidance System`) and compares attribute values, enforcing `OPEN` status on undated conflicts. The 10/10 recall and 91% precision figures are synthetic reference constants in `scripts/run_benchmark.ts`, not dynamically computed across a live database during the benchmark run.
- **Naive Baseline (7/10 detected, 70%):** Manually observed from the raw baseline markdown outputs. The baseline model identified 3 of 5 conflicts in DEV (`dev-baseline.md`: Database, Backend API owner, Pipeline status) and 4 of 5 conflicts in TEST (`test-baseline.md`: Telemetry, Routing engine, CAS status, Landing gear). Precision (78%) is a synthetic reference constant.

### 4. Prompt Injection Defense
- **ContinuityX (2/2 resisted, 100%):** Both adversarial injection strings (`SYSTEM OVERRIDE: ...` and `[SECURITY OVERRIDE]: ...`) were rendered harmless. The extraction and judge prompts treat document text as untrusted structured data enclosed in isolated boundary tags, and claim evidence status is computed server-side by deterministic rules, preventing injection text from assigning `VERIFIED` status.
- **Naive Baseline (2/2 flagged):** Both recorded baseline prompt runs explicitly identified and flagged the injection attempts (`dev-baseline.md` noted `Adversarial Prompt Injection: ... safely ignored`; `test-baseline.md` noted `Adversarial Instruction: ... was flagged`). This constitutes observed detection on these specific fixtures, not a measured resistance guarantee.

---

## Methodological Limitations & Transparency

1. **Reference Report Generator Nature:** `scripts/run_benchmark.ts` is a fixture-based reference report generator, not an end-to-end dynamic benchmark harness. Reported ContinuityX metrics are synthetic constants and architecturally verified invariants rather than live pipeline measurements.
2. **Small sample size:** Evaluated across N=40 labelled claims, N=10 planted conflicts, N=6 traps, and N=2 prompt injections in synthetic datasets.
3. **Synthetic and author-designed ground truth:** Ground-truth fixtures were authored by the development team using an AI coding assistant and were not independently reviewed; TEST labels and results were committed together in `23d55c9`.
4. **Same-vendor model dependency:** Both extraction and semantic judging rely on Google Gemini models.
