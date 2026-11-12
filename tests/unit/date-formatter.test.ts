// @vitest-environment node
import { describe, it, expect } from "vitest";
import { formatDate, formatDateTime } from "@/lib/date";

describe("Shared Date Formatter (Item 6)", () => {
  it("formats date strings into unambiguous '12 Nov 2026' format", () => {
    expect(formatDate("2026-11-12")).toBe("12 Nov 2026");
    expect(formatDate("2026-03-05")).toBe("5 Mar 2026");
  });

  it("formats Date objects into unambiguous format", () => {
    const d = new Date(2026, 10, 12); // Month 10 is November in 0-indexed JS Date
    expect(formatDate(d)).toBe("12 Nov 2026");
  });

  it("handles null, undefined and invalid inputs safely with fallback", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate(undefined, "(none)")).toBe("(none)");
    expect(formatDate("invalid-date-string", "N/A")).toBe("N/A");
  });

  it("formats date-time strings with date prefix", () => {
    const d = new Date(2026, 10, 12, 14, 30);
    const result = formatDateTime(d);
    expect(result).toContain("12 Nov 2026");
  });
});
