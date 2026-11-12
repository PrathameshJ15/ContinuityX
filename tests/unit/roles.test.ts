// @vitest-environment node
import { describe, it, expect } from "vitest";
import { formatRoleLabel, getRoleBadgeClass } from "@/lib/roles";

describe("Role Display & Label Source (Item 3)", () => {
  it("maps stored enum roles to consistent title-case display labels", () => {
    expect(formatRoleLabel("OWNER")).toBe("Owner");
    expect(formatRoleLabel("REVIEWER")).toBe("Reviewer");
    expect(formatRoleLabel("VIEWER")).toBe("Viewer");
  });

  it("handles case-insensitivity and whitespace cleanly", () => {
    expect(formatRoleLabel("  owner  ")).toBe("Owner");
    expect(formatRoleLabel("reviewer")).toBe("Reviewer");
    expect(formatRoleLabel("viewer")).toBe("Viewer");
  });

  it("defaults null or undefined role to Viewer", () => {
    expect(formatRoleLabel(null)).toBe("Viewer");
    expect(formatRoleLabel(undefined)).toBe("Viewer");
  });

  it("assigns distinct Tailwind color badges per role", () => {
    const ownerBadge = getRoleBadgeClass("OWNER");
    const reviewerBadge = getRoleBadgeClass("REVIEWER");
    const viewerBadge = getRoleBadgeClass("VIEWER");

    expect(ownerBadge).toContain("purple");
    expect(reviewerBadge).toContain("blue");
    expect(viewerBadge).toContain("slate");
  });
});
