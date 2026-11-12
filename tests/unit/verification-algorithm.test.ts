import { describe, it, expect } from "vitest";
import { deriveEvidenceStatus } from "@/services/verification/algorithm";

describe("Phase 4 Evidence-Status Algorithm (SPEC.md V3.2 Decision Table)", () => {
  it("Rule 1: Source gate FAIL maps deterministically to UNVERIFIED", () => {
    const result = deriveEvidenceStatus({
      sourceGatePassed: false,
      quoteGatePassed: true,
      judgeResult: { outcome: "SUPPORTS" },
      subjectFoundInExcerpt: true,
      hasOpenConflict: false,
    });

    expect(result.status).toBe("UNVERIFIED");
    expect(result.ruleNumber).toBe(1);
  });

  it("Rule 2: Quote gate FAIL maps deterministically to UNVERIFIED", () => {
    const result = deriveEvidenceStatus({
      sourceGatePassed: true,
      quoteGatePassed: false,
      judgeResult: { outcome: "SUPPORTS" },
      subjectFoundInExcerpt: true,
      hasOpenConflict: false,
    });

    expect(result.status).toBe("UNVERIFIED");
    expect(result.ruleNumber).toBe(2);
  });

  it("Rule 3: Semantic judge error maps deterministically to UNKNOWN (never VERIFIED)", () => {
    const result = deriveEvidenceStatus({
      sourceGatePassed: true,
      quoteGatePassed: true,
      judgeResult: { outcome: "ERROR", reason: "API timeout" },
      subjectFoundInExcerpt: true,
      hasOpenConflict: false,
    });

    expect(result.status).toBe("UNKNOWN");
    expect(result.ruleNumber).toBe(3);
  });

  it("Rule 4: Semantic judge CONTRADICTS maps deterministically to CONFLICTING", () => {
    const result = deriveEvidenceStatus({
      sourceGatePassed: true,
      quoteGatePassed: true,
      judgeResult: { outcome: "CONTRADICTS", reason: "Source says blocked, claim says completed" },
      subjectFoundInExcerpt: true,
      hasOpenConflict: false,
    });

    expect(result.status).toBe("CONFLICTING");
    expect(result.ruleNumber).toBe(4);
  });

  it("Rule 5: Semantic judge INSUFFICIENT_CONTEXT maps deterministically to UNKNOWN", () => {
    const result = deriveEvidenceStatus({
      sourceGatePassed: true,
      quoteGatePassed: true,
      judgeResult: { outcome: "INSUFFICIENT_CONTEXT", reason: "Excerpt does not have sufficient context" },
      subjectFoundInExcerpt: true,
      hasOpenConflict: false,
    });

    expect(result.status).toBe("UNKNOWN");
    expect(result.ruleNumber).toBe(5);
  });

  it("Rule 6: Semantic judge NEUTRAL with subject/alias in excerpt maps to WEAK_SUPPORT", () => {
    const result = deriveEvidenceStatus({
      sourceGatePassed: true,
      quoteGatePassed: true,
      judgeResult: { outcome: "NEUTRAL", reason: "Mentions module but not status" },
      subjectFoundInExcerpt: true,
      hasOpenConflict: false,
    });

    expect(result.status).toBe("WEAK_SUPPORT");
    expect(result.ruleNumber).toBe(6);
  });

  it("Rule 7: Semantic judge NEUTRAL without subject/alias in excerpt maps to UNKNOWN", () => {
    const result = deriveEvidenceStatus({
      sourceGatePassed: true,
      quoteGatePassed: true,
      judgeResult: { outcome: "NEUTRAL", reason: "General discussion" },
      subjectFoundInExcerpt: false,
      hasOpenConflict: false,
    });

    expect(result.status).toBe("UNKNOWN");
    expect(result.ruleNumber).toBe(7);
  });

  it("Rule 8: Semantic judge SUPPORTS with an OPEN conflict maps to CONFLICTING", () => {
    const result = deriveEvidenceStatus({
      sourceGatePassed: true,
      quoteGatePassed: true,
      judgeResult: { outcome: "SUPPORTS", reason: "Excerpt clearly states status" },
      subjectFoundInExcerpt: true,
      hasOpenConflict: true, // OPEN conflict with another claim
    });

    expect(result.status).toBe("CONFLICTING");
    expect(result.ruleNumber).toBe(8);
  });

  it("Rule 9: Semantic judge SUPPORTS with no OPEN conflict maps to VERIFIED", () => {
    const result = deriveEvidenceStatus({
      sourceGatePassed: true,
      quoteGatePassed: true,
      judgeResult: { outcome: "SUPPORTS", reason: "Direct evidence confirms value" },
      subjectFoundInExcerpt: true,
      hasOpenConflict: false,
    });

    expect(result.status).toBe("VERIFIED");
    expect(result.ruleNumber).toBe(9);
  });

  describe("Hallucination Traps & Integrity Guardrails", () => {
    it("Hallucination trap: fabricated claim with fake quote never reaches VERIFIED", () => {
      // Even if judge was tricked into returning SUPPORTS, failing quote gate forces UNVERIFIED
      const result = deriveEvidenceStatus({
        sourceGatePassed: true,
        quoteGatePassed: false,
        judgeResult: { outcome: "SUPPORTS" },
        subjectFoundInExcerpt: true,
        hasOpenConflict: false,
      });

      expect(result.status).toBe("UNVERIFIED");
      expect(result.status).not.toBe("VERIFIED");
    });

    it("Hallucination trap: missing document source never reaches VERIFIED", () => {
      const result = deriveEvidenceStatus({
        sourceGatePassed: false,
        quoteGatePassed: false,
        judgeResult: { outcome: "SUPPORTS" },
        subjectFoundInExcerpt: true,
        hasOpenConflict: false,
      });

      expect(result.status).toBe("UNVERIFIED");
      expect(result.status).not.toBe("VERIFIED");
    });
  });
});
