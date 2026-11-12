import { EvidenceStatus, SemanticSupportOutcome } from "@prisma/client";

export interface StatusAlgorithmInput {
  sourceGatePassed: boolean;
  quoteGatePassed: boolean;
  judgeResult: {
    outcome: SemanticSupportOutcome | "ERROR";
    reason?: string;
  };
  subjectFoundInExcerpt: boolean;
  hasOpenConflict: boolean;
}

export interface StatusAlgorithmResult {
  status: EvidenceStatus;
  ruleNumber: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  ruleDescription: string;
}

/**
 * Authoritative Evidence-Status Algorithm
 * Implements the V3.2 first-match decision table from SPEC.md.
 * Status is strictly rule-derived; model confidence is NEVER used to derive status.
 *
 * | # | Condition                                                              | Evidence status |
 * |---|------------------------------------------------------------------------|-----------------|
 * | 1 | Source gate FAIL                                                       | UNVERIFIED      |
 * | 2 | Quote gate FAIL                                                        | UNVERIFIED      |
 * | 3 | Judge call failed, or output invalid after one controlled retry        | UNKNOWN         |
 * | 4 | Judge CONTRADICTS                                                      | CONFLICTING     |
 * | 5 | Judge INSUFFICIENT_CONTEXT                                              | UNKNOWN         |
 * | 6 | Judge NEUTRAL and excerpt contains canonical subject or known alias   | WEAK_SUPPORT    |
 * | 7 | Judge NEUTRAL and subject not found in excerpt                         | UNKNOWN         |
 * | 8 | Judge SUPPORTS and claim is in an OPEN conflict                        | CONFLICTING     |
 * | 9 | Judge SUPPORTS and no OPEN conflict                                    | VERIFIED        |
 */
export function deriveEvidenceStatus(input: StatusAlgorithmInput): StatusAlgorithmResult {
  // Rule 1: Source gate FAIL
  if (!input.sourceGatePassed) {
    return {
      status: "UNVERIFIED",
      ruleNumber: 1,
      ruleDescription: "Source gate failed: referenced document or chunk missing, invalid, or deleted.",
    };
  }

  // Rule 2: Quote gate FAIL
  if (!input.quoteGatePassed) {
    return {
      status: "UNVERIFIED",
      ruleNumber: 2,
      ruleDescription: "Quote gate failed: cited excerpt could not be verified in the source chunk text.",
    };
  }

  // Rule 3: Judge call failed or invalid output
  if (input.judgeResult.outcome === "ERROR") {
    return {
      status: "UNKNOWN",
      ruleNumber: 3,
      ruleDescription: "Semantic judge failed: model call error or schema invalid after retry; flagged for retry.",
    };
  }

  // Rule 4: Judge CONTRADICTS
  if (input.judgeResult.outcome === "CONTRADICTS") {
    return {
      status: "CONFLICTING",
      ruleNumber: 4,
      ruleDescription: "Semantic judge concluded the cited excerpt directly contradicts the proposed claim.",
    };
  }

  // Rule 5: Judge INSUFFICIENT_CONTEXT
  if (input.judgeResult.outcome === "INSUFFICIENT_CONTEXT") {
    return {
      status: "UNKNOWN",
      ruleNumber: 5,
      ruleDescription: "Semantic judge found insufficient context in the excerpt to evaluate the claim.",
    };
  }

  // Rule 6: Judge NEUTRAL + subject or alias found in excerpt
  if (input.judgeResult.outcome === "NEUTRAL" && input.subjectFoundInExcerpt) {
    return {
      status: "WEAK_SUPPORT",
      ruleNumber: 6,
      ruleDescription: "Semantic judge was neutral, but excerpt mentions the subject entity or alias (weak support).",
    };
  }

  // Rule 7: Judge NEUTRAL + subject not found in excerpt
  if (input.judgeResult.outcome === "NEUTRAL" && !input.subjectFoundInExcerpt) {
    return {
      status: "UNKNOWN",
      ruleNumber: 7,
      ruleDescription: "Semantic judge was neutral and excerpt does not mention the subject entity or known alias.",
    };
  }

  // Rule 8: Judge SUPPORTS + OPEN conflict
  if (input.judgeResult.outcome === "SUPPORTS" && input.hasOpenConflict) {
    return {
      status: "CONFLICTING",
      ruleNumber: 8,
      ruleDescription: "Semantic judge supports the claim, but an unresolved OPEN conflict exists with another claim.",
    };
  }

  // Rule 9: Judge SUPPORTS + no OPEN conflict
  if (input.judgeResult.outcome === "SUPPORTS" && !input.hasOpenConflict) {
    return {
      status: "VERIFIED",
      ruleNumber: 9,
      ruleDescription: "All gates passed, semantic judge confirmed support, and no open conflicts exist.",
    };
  }

  // Fallback (defensive): should never be reached given complete coverage of inputs
  return {
    status: "UNKNOWN",
    ruleNumber: 3,
    ruleDescription: "Undefined state encountered in decision table; defaulting defensively to UNKNOWN.",
  };
}
