// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  VOCABULARY_VERSION,
  STATUS_VALUES,
  ATTRIBUTE_VOCABULARY,
  CONTROLLED_ATTRIBUTE_KEYS,
  normalizeClaimValue,
  isControlledAttributeKey,
} from "@/lib/ai/vocabulary";

describe("Phase 3 Controlled Attribute Vocabulary & Value Normalization", () => {
  it("exports versioned attribute definitions matching SPEC V3.2", () => {
    expect(VOCABULARY_VERSION).toBe("1.0.0");
    expect(STATUS_VALUES).toEqual([
      "NOT_STARTED",
      "IN_PROGRESS",
      "BLOCKED",
      "COMPLETED",
      "CANCELLED",
    ]);
    expect(CONTROLLED_ATTRIBUTE_KEYS).toEqual([
      "status",
      "owner",
      "selected_technology",
      "due_date",
      "depends_on",
      "risk",
      "open_question",
      "rationale",
    ]);

    expect(ATTRIBUTE_VOCABULARY.status.cardinality).toBe("SINGLE");
    expect(ATTRIBUTE_VOCABULARY.status.triggersConflict).toBe(true);
    expect(ATTRIBUTE_VOCABULARY.owner.cardinality).toBe("SINGLE");
    expect(ATTRIBUTE_VOCABULARY.selected_technology.cardinality).toBe("SINGLE");
    expect(ATTRIBUTE_VOCABULARY.due_date.cardinality).toBe("SINGLE");

    expect(ATTRIBUTE_VOCABULARY.depends_on.cardinality).toBe("MULTI");
    expect(ATTRIBUTE_VOCABULARY.depends_on.triggersConflict).toBe(false);
    expect(ATTRIBUTE_VOCABULARY.rationale.cardinality).toBe("MULTI");
    expect(isControlledAttributeKey("status")).toBe(true);
    expect(isControlledAttributeKey("random_attr")).toBe(false);
  });

  it("normalizes exact STATUS_VALUES and known synonyms cleanly", () => {
    expect(normalizeClaimValue("status", "COMPLETED")).toBe("COMPLETED");
    expect(normalizeClaimValue("status", "done")).toBe("COMPLETED");
    expect(normalizeClaimValue("status", "finished")).toBe("COMPLETED");
    expect(normalizeClaimValue("status", "complete")).toBe("COMPLETED");

    expect(normalizeClaimValue("status", "WIP")).toBe("IN_PROGRESS");
    expect(normalizeClaimValue("status", "ongoing")).toBe("IN_PROGRESS");
    expect(normalizeClaimValue("status", "in progress")).toBe("IN_PROGRESS");

    expect(normalizeClaimValue("status", "stuck")).toBe("BLOCKED");
    expect(normalizeClaimValue("status", "todo")).toBe("NOT_STARTED");
    expect(normalizeClaimValue("status", "dropped")).toBe("CANCELLED");
  });

  it("returns null when status or date cannot be reliably normalized (never guesses)", () => {
    expect(normalizeClaimValue("status", "mostly ready maybe")).toBeNull();
    expect(normalizeClaimValue("status", "under negotiation")).toBeNull();

    expect(normalizeClaimValue("due_date", "2026-02-01")).toBe("2026-02-01");
    expect(normalizeClaimValue("due_date", "2026/2/5")).toBe("2026-02-05");
    expect(normalizeClaimValue("due_date", "2026-02-30")).toBeNull();
    expect(normalizeClaimValue("due_date", "next Tuesday")).toBeNull();
  });

  it("handles unassigned owner sentinels and canonicalizes selected_technology", () => {
    expect(normalizeClaimValue("owner", "Unassigned")).toBeNull();
    expect(normalizeClaimValue("owner", "TBD")).toBeNull();
    expect(normalizeClaimValue("owner", "Arjun Mehta")).toBe("Arjun Mehta");

    expect(normalizeClaimValue("selected_technology", "postgres")).toBe("PostgreSQL");
    expect(normalizeClaimValue("selected_technology", "mongodb")).toBe("MongoDB");
    expect(normalizeClaimValue("selected_technology", "JWT")).toBe("JWT");
  });
});
