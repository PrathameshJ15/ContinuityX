// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  NO_CLAIMS_TITLE,
  getRadarEmptyState,
  getReviewQueueEmptyState,
  getBusFactorEmptyState,
  getConflictsEmptyState,
} from "@/lib/empty-states";

describe("Empty State Wording (Item 1)", () => {
  describe("Knowledge Radar", () => {
    it("returns 'No claims yet' when totalClaims is 0 (unpopulated project)", () => {
      const state = getRadarEmptyState(0, 0);
      expect(state.state).toBe("NO_DATA");
      expect(state.title).toBe(NO_CLAIMS_TITLE);
      expect(state.title).not.toContain("Clear");
      expect(state.title).not.toContain("Complete");
      expect(state.linkHref).toBe("documents");
    });

    it("returns checked and all-clear only when totalClaims > 0 and 0 alerts", () => {
      const state = getRadarEmptyState(15, 0);
      expect(state.state).toBe("CHECKED_EMPTY");
      expect(state.title).toBe("Zero Active Knowledge Loss Indicators");
      expect(state.description).toContain("All critical components have verified redundancy");
    });

    it("returns POPULATED when there are active alerts", () => {
      const state = getRadarEmptyState(15, 3);
      expect(state.state).toBe("POPULATED");
    });
  });

  describe("Evidence Review Queue", () => {
    it("distinguishes unpopulated state from completed queue", () => {
      const noData = getReviewQueueEmptyState(0, 0);
      expect(noData.state).toBe("NO_DATA");
      expect(noData.title).toBe(NO_CLAIMS_TITLE);
      expect(noData.linkHref).toBe("documents");

      const completed = getReviewQueueEmptyState(12, 0);
      expect(completed.state).toBe("CHECKED_EMPTY");
      expect(completed.title).toBe("Review Queue Complete!");
    });
  });

  describe("Bus Factor Map", () => {
    it("distinguishes unpopulated state from 0 components found", () => {
      const noData = getBusFactorEmptyState(0, 0);
      expect(noData.state).toBe("NO_DATA");
      expect(noData.title).toBe(NO_CLAIMS_TITLE);

      const noComponents = getBusFactorEmptyState(8, 0);
      expect(noComponents.state).toBe("CHECKED_EMPTY");
      expect(noComponents.title).toBe("No Component Entities Found");
    });
  });

  describe("Contradictions & Conflicts", () => {
    it("distinguishes unpopulated state from no conflicts found", () => {
      const noData = getConflictsEmptyState(0, 0);
      expect(noData.state).toBe("NO_DATA");
      expect(noData.title).toBe(NO_CLAIMS_TITLE);

      const clear = getConflictsEmptyState(20, 0);
      expect(clear.state).toBe("CHECKED_EMPTY");
      expect(clear.title).toBe("No Conflicts Found");
    });
  });
});
