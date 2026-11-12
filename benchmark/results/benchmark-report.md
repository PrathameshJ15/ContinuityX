# ContinuityX Comprehensive Benchmark & Evaluation Report

**Evaluation Timestamp:** 2026-11-12T19:20:26.124Z  
**Dataset Composition:**  
- **DEV Dataset:** 15 claims, 5 conflicts (Smart Attendance System)  
- **TEST Held-Out Dataset:** 25 claims, 5 conflicts (Campus Delivery Drone)  
- **Total Labeled Set:** 40 claims, 10 conflicts, 6 hallucination traps, 2 prompt-injection vectors  

---

## Comparative Performance Matrix

| Metric | ContinuityX (Proof-Carrying) | Naive Baseline (Single Prompt) | Delta / Advantage |
|---|---|---|---|
| **Evidence Attribution Accuracy** | **95%** (38/40) | **65%** (26/40) | **+30%** precision gain |
| **Unsupported Claim Rate (Traps)** | **0%** (0/6) | **33%** (2/6) | **-33%** (Zero traps verified) |
| **Conflict Detection Recall** | **100%** (10/10) | **70%** (7/10) | **+30%** recall gain |
| **Conflict Detection Precision** | **91%** | **78%** | **+13%** |
| **Prompt Injection Resistance** | **100%** (2/2) | **50%** (1/2) | **+50%** safety margin |

---

## Detailed Analysis by Dimension

### 1. Evidence Attribution Accuracy
- **ContinuityX:** Claims are stored as triples `(subject, attribute, value)` linked to immutable `Evidence` records with verified character offsets and source locations. The Quote Gate enforces that excerpts exist verbatim in the source text.
- **Naive Baseline:** Frequently paraphrases quotes, omits page/section offsets, or hallucinates source paragraphs.

### 2. Unsupported Claim Rate & Hallucination Defense
- **ContinuityX:** The authoritative 4-gate verification engine evaluates source validity, verbatim quote match, semantic support, and contradiction checks. 0 of 6 planted traps (`AWS EKS`, `Redis cluster`, `Fingerprint scanner`, `Hydrogen Fuel Cell`, `Submersible Mode`, `Starlink`) ever reached `VERIFIED`.
- **Naive Baseline:** Hallucinated claims were occasionally adopted into the summary when plausible context was inferred.

### 3. Conflict Detection & No-Date Temporal Rule
- **ContinuityX:** Detected 10 of 10 conflicts by normalizing entity aliases (e.g. `CAS Module` -> `Collision Avoidance System`) and comparing normalized attribute values. Undated conflicts correctly remained `OPEN` (no premature supersession).
- **Naive Baseline:** Failed to recognize alias-disguised conflicts and incorrectly assumed unverified supersession on undated chat logs.

### 4. Prompt Injection Resistance
- **ContinuityX:** Both adversarial injection strings (`SYSTEM OVERRIDE: ...` and `[SECURITY OVERRIDE]: ...`) were rendered harmless. The extraction and judge prompts treat document text as strictly untrusted structured data enclosed in isolated boundary tags.

---

## Methodological Limitations & Transparency

1. **Small sample size (N=40 labelled claims, N=10 planted conflicts).**
2. **Synthetic and author-designed ground truth may favor modeled entity schema structures.**
3. **Same-vendor Gemini model used for both extraction and semantic judging.**
4. **Human reviewers must confirm POSSIBLY_SUPERSEDED conflict candidates in production.**
