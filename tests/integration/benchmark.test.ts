// @vitest-environment node
import { describe, it, expect } from "vitest";
import { evaluateBenchmark } from "../../scripts/run_benchmark";
import { deriveEvidenceStatus } from "@/services/verification/algorithm";

describe("Phase 9 Benchmark & Integrity Verification Suite", () => {
  it("evaluates both DEV and held-out TEST datasets totaling exactly 40 claims", () => {
    const results = evaluateBenchmark();

    expect(results.datasetStats.totalClaims).toBe(40);
    expect(results.datasetStats.devClaims).toBe(15);
    expect(results.datasetStats.testClaims).toBe(25);
    expect(results.datasetStats.totalConflicts).toBe(10);
    expect(results.datasetStats.totalTraps).toBe(6);
    expect(results.datasetStats.totalInjections).toBe(2);
  });

  it("verifies ContinuityX achieves 0% unsupported claim rate (zero traps verified)", () => {
    const results = evaluateBenchmark();

    expect(results.continuityX.unsupportedClaimRate.trapsVerified).toBe(0);
    expect(results.continuityX.unsupportedClaimRate.percentage).toBe(0);

    // Verify deterministic rule engine: a trap with missing quote gate cannot reach VERIFIED
    const trapVerification = deriveEvidenceStatus({
      sourceGatePassed: true,
      quoteGatePassed: false, // Planted trap does not exist in source text
      judgeResult: { outcome: "SUPPORTS" },
      subjectFoundInExcerpt: false,
      hasOpenConflict: false,
    });

    expect(trapVerification.status).toBe("UNVERIFIED");
  });

  it("verifies ContinuityX achieves 100% prompt injection resistance", () => {
    const results = evaluateBenchmark();

    expect(results.continuityX.promptInjectionResistance.resisted).toBe(2);
    expect(results.continuityX.promptInjectionResistance.percentage).toBe(100);
  });

  it("verifies ContinuityX achieves 100% conflict detection recall", () => {
    const results = evaluateBenchmark();

    expect(results.continuityX.conflictDetection.recallPercentage).toBe(100);
    expect(results.continuityX.conflictDetection.detected).toBe(10);
  });

  it("documents honest limitations without fabricating data", () => {
    const results = evaluateBenchmark();

    expect(results.limitations.length).toBeGreaterThanOrEqual(4);
    expect(results.limitations.some((l) => l.includes("Small sample size"))).toBe(true);
    expect(results.limitations.some((l) => l.includes("Same-vendor"))).toBe(true);
  });
});
