import { z } from "zod";
import { CONTROLLED_ATTRIBUTE_KEYS, ControlledAttributeKey } from "./vocabulary";

export const EXTRACTOR_SCHEMA_VERSION = "v1.0.0" as const;

export const EntityTypeSchema = z.enum(["PERSON", "COMPONENT", "SYSTEM"]);
export const ClaimCategorySchema = z.enum([
  "DECISION",
  "TASK",
  "OWNERSHIP",
  "DEPENDENCY",
  "RISK",
  "OPEN_QUESTION",
  "FACT",
]);
export const EvidenceTypeSchema = z.enum(["DIRECT_QUOTE", "TABLE_ROW", "SECTION_EXCERPT"]);

export const ExtractedClaimCandidateSchema = z.object({
  proposedSubjectEntityId: z.string().min(1).max(128),
  proposedSubjectName: z.string().min(1).max(200),
  proposedSubjectType: EntityTypeSchema,
  attributeKey: z.enum(
    CONTROLLED_ATTRIBUTE_KEYS as [ControlledAttributeKey, ...ControlledAttributeKey[]]
  ),
  valueRaw: z.string().min(1).max(2000),
  category: ClaimCategorySchema,
  chunkId: z.string().min(1).max(128),
  sourceLocation: z.string().min(1).max(300),
  excerpt: z.string().min(3).max(2000),
  evidenceType: EvidenceTypeSchema.default("DIRECT_QUOTE"),
  confidence: z.number().min(0).max(1).nullable().optional(),
});

export const ExtractionResponseSchema = z.object({
  claims: z.array(ExtractedClaimCandidateSchema).max(50),
});

export type ExtractedClaimCandidate = z.infer<typeof ExtractedClaimCandidateSchema>;
export type ExtractionResponsePayload = z.infer<typeof ExtractionResponseSchema>;

export interface ValidationFailureDetail {
  reason: string;
}

/**
 * Strips markdown code fences if a model accidentally wraps JSON output.
 */
function extractJsonString(rawText: string): string {
  const trimmed = rawText.trim();
  const fenceMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

function normalizeForContainment(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Verifies verbatim / normalized excerpt grounding inside the supplied chunk.
 * Never trusts fabricated excerpts or references to other chunks.
 */
export function isExcerptGroundedInChunk(excerpt: string, chunkContent: string): boolean {
  const normExcerpt = normalizeForContainment(excerpt);
  const normChunk = normalizeForContainment(chunkContent);

  if (!normExcerpt || normExcerpt.length < 3) return false;
  if (normChunk.includes(normExcerpt)) return true;

  // Fallback for CSV formatted rows ("Row 2: A | B | C") vs raw pipe-joined excerpts
  const strippedPipeExcerpt = normExcerpt.replace(/\s*\|\s*/g, " ");
  const strippedPipeChunk = normChunk.replace(/\s*\|\s*/g, " ");
  if (strippedPipeChunk.includes(strippedPipeExcerpt)) return true;

  return false;
}

export type ValidationOutcome =
  | { ok: true; data: ExtractionResponsePayload }
  | { ok: false; errorSummary: string };

/**
 * Strictly validates candidate claims returned by the LLM before any database write.
 */
export function parseAndValidateExtractionResponse(
  rawText: string,
  expectedChunkId: string,
  chunkContent: string
): ValidationOutcome {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(extractJsonString(rawText));
  } catch (err: unknown) {
    return {
      ok: false,
      errorSummary: `Invalid JSON output: ${err instanceof Error ? err.message : "parse error"}`,
    };
  }

  const parsed = ExtractionResponseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
      .join("; ");
    return {
      ok: false,
      errorSummary: `Schema validation failed: ${issues}`,
    };
  }

  // Enforce deterministic grounding constraints on every claim
  for (let idx = 0; idx < parsed.data.claims.length; idx++) {
    const claim = parsed.data.claims[idx];
    if (claim.chunkId !== expectedChunkId) {
      return {
        ok: false,
        errorSummary: `Claim[${idx}] referenced invalid or fabricated chunkId '${claim.chunkId}' (expected '${expectedChunkId}').`,
      };
    }

    if (!isExcerptGroundedInChunk(claim.excerpt, chunkContent)) {
      return {
        ok: false,
        errorSummary: `Claim[${idx}] excerpt was not found verbatim in chunk '${expectedChunkId}'.`,
      };
    }
  }

  return { ok: true, data: parsed.data };
}

/**
 * JSON Schema representation passed to Gemini structured JSON generation.
 */
export const EXTRACTION_RESPONSE_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    claims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          proposedSubjectEntityId: { type: "string" },
          proposedSubjectName: { type: "string" },
          proposedSubjectType: { type: "string", enum: ["PERSON", "COMPONENT", "SYSTEM"] },
          attributeKey: { type: "string", enum: [...CONTROLLED_ATTRIBUTE_KEYS] },
          valueRaw: { type: "string" },
          category: {
            type: "string",
            enum: ["DECISION", "TASK", "OWNERSHIP", "DEPENDENCY", "RISK", "OPEN_QUESTION", "FACT"],
          },
          chunkId: { type: "string" },
          sourceLocation: { type: "string" },
          excerpt: { type: "string" },
          evidenceType: { type: "string", enum: ["DIRECT_QUOTE", "TABLE_ROW", "SECTION_EXCERPT"] },
          confidence: { type: "number" },
        },
        required: [
          "proposedSubjectEntityId",
          "proposedSubjectName",
          "proposedSubjectType",
          "attributeKey",
          "valueRaw",
          "category",
          "chunkId",
          "sourceLocation",
          "excerpt",
          "evidenceType",
        ],
      },
    },
  },
  required: ["claims"],
};
