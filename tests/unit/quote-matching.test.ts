import { describe, it, expect } from "vitest";
import {
  normalizeQuoteText,
  stripPunctuation,
  verifyQuoteExistence,
  checkEntityInText,
} from "@/services/verification/quote-matcher";

describe("Phase 4 Quote Matcher & Normalization (Gate 2)", () => {
  const sampleChunk = `
    The Camera Calibration subsystem requires manual recalibration after every lens swap.
    David K. is designated as the primary owner for camera testing and maintenance until Q3.
    Current status is marked as BLOCKED due to delayed hardware shipment from the vendor.
  `;

  it("matches exact verbatim excerpt", () => {
    const excerpt = "David K. is designated as the primary owner for camera testing";
    const res = verifyQuoteExistence(excerpt, sampleChunk);

    expect(res.passed).toBe(true);
    expect(res.matchType).toBe("EXACT");
    expect(res.similarity).toBe(1.0);
  });

  it("matches normalized whitespace, smart quotes, and newlines", () => {
    const excerpt = 'David K.   is  designated \n  as the "primary owner" for camera testing';
    const res = verifyQuoteExistence(excerpt, sampleChunk);

    expect(res.passed).toBe(true);
    expect(res.similarity).toBeGreaterThanOrEqual(0.95);
  });

  it("matches punctuation-normalized substrings", () => {
    const excerpt = "Camera Calibration subsystem requires manual recalibration after every lens swap";
    const res = verifyQuoteExistence(excerpt, sampleChunk);

    expect(res.passed).toBe(true);
    expect(res.similarity).toBeGreaterThanOrEqual(0.95);
  });

  it("matches high token overlap for minor line-wrap / hyphenation variations", () => {
    const excerpt = "Current status is marked as BLOCKED due to delayed hardware shipment from vendor";
    const res = verifyQuoteExistence(excerpt, sampleChunk);

    expect(res.passed).toBe(true);
    expect(res.similarity).toBeGreaterThanOrEqual(0.85);
  });

  it("rejects hallucinated or fabricated quotes not present in chunk", () => {
    const hallucinatedExcerpt = "The team decided to deploy Kubernetes on Google Cloud Platform with zero downtime";
    const res = verifyQuoteExistence(hallucinatedExcerpt, sampleChunk);

    expect(res.passed).toBe(false);
    expect(res.matchType).toBe("NONE");
    expect(res.similarity).toBeLessThan(0.3);
  });

  it("rejects materially altered quotes that invert or falsify meaning", () => {
    const alteredExcerpt = "Current status is marked as COMPLETED and fully shipped to all customers worldwide";
    const res = verifyQuoteExistence(alteredExcerpt, sampleChunk);

    expect(res.passed).toBe(false);
  });

  describe("checkEntityInText", () => {
    it("finds canonical name in excerpt", () => {
      expect(
        checkEntityInText("Camera Calibration", ["CamCal", "Calibration"], sampleChunk)
      ).toBe(true);
    });

    it("finds alias in excerpt when canonical name differs", () => {
      expect(
        checkEntityInText("David Kim", ["David K.", "DK"], sampleChunk)
      ).toBe(true);
    });

    it("returns false when neither canonical name nor any alias appears", () => {
      expect(
        checkEntityInText("Payment Gateway", ["Stripe", "Checkout"], sampleChunk)
      ).toBe(false);
    });
  });
});
