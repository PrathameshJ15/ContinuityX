import { describe, it, expect } from "vitest";
import {
  determineConflictType,
  evaluateConflictChronology,
} from "@/services/conflicts/detection";

describe("Phase 4 Conflict Detection Rules (SPEC.md V3.2)", () => {
  describe("determineConflictType", () => {
    it("maps attributeKey status to STATUS_CONFLICT", () => {
      expect(determineConflictType("status")).toBe("STATUS_CONFLICT");
    });

    it("maps attributeKey owner to OWNERSHIP_CONFLICT", () => {
      expect(determineConflictType("owner")).toBe("OWNERSHIP_CONFLICT");
    });

    it("maps attributeKey selected_technology to DECISION_CONFLICT", () => {
      expect(determineConflictType("selected_technology")).toBe("DECISION_CONFLICT");
    });

    it("maps attributeKey due_date to TIMELINE_CONFLICT", () => {
      expect(determineConflictType("due_date")).toBe("TIMELINE_CONFLICT");
    });

    it("maps any other attribute to VALUE_CONFLICT", () => {
      expect(determineConflictType("arbitrary_key")).toBe("VALUE_CONFLICT");
    });
  });

  describe("evaluateConflictChronology (Temporal No-Date Rule)", () => {
    it("sets POSSIBLY_SUPERSEDED when both source documents have reliable differing dates", () => {
      const docA = {
        sourceDate: new Date("2026-03-01T00:00:00.000Z"),
        sourceDateBasis: "USER_PROVIDED" as const,
      };
      const docB = {
        sourceDate: new Date("2026-03-15T00:00:00.000Z"),
        sourceDateBasis: "CONTENT_EXPLICIT" as const,
      };

      const result = evaluateConflictChronology(docA, docB);
      expect(result).toBe("POSSIBLY_SUPERSEDED");
    });

    it("sets OPEN when dates are identical", () => {
      const date = new Date("2026-03-01T00:00:00.000Z");
      const docA = { sourceDate: date, sourceDateBasis: "USER_PROVIDED" as const };
      const docB = { sourceDate: date, sourceDateBasis: "USER_PROVIDED" as const };

      expect(evaluateConflictChronology(docA, docB)).toBe("OPEN");
    });

    it("sets OPEN when one or both documents have UNKNOWN date basis", () => {
      const docA = {
        sourceDate: new Date("2026-03-01T00:00:00.000Z"),
        sourceDateBasis: "UNKNOWN" as const,
      };
      const docB = {
        sourceDate: new Date("2026-03-15T00:00:00.000Z"),
        sourceDateBasis: "USER_PROVIDED" as const,
      };

      expect(evaluateConflictChronology(docA, docB)).toBe("OPEN");
    });

    it("sets OPEN when sourceDate is null on either document", () => {
      const docA = { sourceDate: null, sourceDateBasis: "UNKNOWN" as const };
      const docB = {
        sourceDate: new Date("2026-03-15T00:00:00.000Z"),
        sourceDateBasis: "USER_PROVIDED" as const,
      };

      expect(evaluateConflictChronology(docA, docB)).toBe("OPEN");
    });
  });
});
