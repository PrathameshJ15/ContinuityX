/**
 * Quote Matcher & Normalizer for Gate 2
 *
 * Verifies that the cited excerpt exists within the extracted document chunk text.
 * Uses exact match, whitespace/punctuation normalization, and constrained token containment.
 * Must NOT conceal materially different wording (hallucination trap defense).
 */

export interface QuoteMatchResult {
  passed: boolean;
  similarity: number;
  matchType: "EXACT" | "NORMALIZED_SUBSTRING" | "TOKEN_OVERLAP" | "NONE";
  reason: string;
}

/**
 * Normalizes text for robust comparison:
 * - Collapses repeated whitespace/newlines to single spaces
 * - Strips common enclosing quotes / smart quotes
 * - Lowercases for case-insensitive comparison
 * - Trims leading/trailing whitespace
 */
export function normalizeQuoteText(text: string): string {
  if (!text) return "";
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

/**
 * Strips punctuation except alphanumeric characters and spaces
 */
export function stripPunctuation(text: string): string {
  return text.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

/**
 * Evaluates whether cited excerpt is faithfully represented in the source chunk.
 */
export function verifyQuoteExistence(
  excerpt: string,
  chunkContent: string
): QuoteMatchResult {
  if (!excerpt || !chunkContent) {
    return {
      passed: false,
      similarity: 0,
      matchType: "NONE",
      reason: "Missing excerpt or chunk text content.",
    };
  }

  const trimmedExcerpt = excerpt.trim();
  const trimmedChunk = chunkContent.trim();

  // 1. Direct exact verbatim substring
  if (trimmedChunk.includes(trimmedExcerpt)) {
    return {
      passed: true,
      similarity: 1.0,
      matchType: "EXACT",
      reason: "Exact verbatim excerpt matched inside chunk text.",
    };
  }

  // 2. Normalized whitespace & casing substring
  const normExcerpt = normalizeQuoteText(trimmedExcerpt);
  const normChunk = normalizeQuoteText(trimmedChunk);

  if (normChunk.includes(normExcerpt)) {
    return {
      passed: true,
      similarity: 1.0,
      matchType: "NORMALIZED_SUBSTRING",
      reason: "Normalized excerpt matched inside chunk text.",
    };
  }

  // 3. Punctuation-stripped normalized substring
  const strippedExcerpt = stripPunctuation(normExcerpt);
  const strippedChunk = stripPunctuation(normChunk);

  if (strippedChunk.includes(strippedExcerpt)) {
    return {
      passed: true,
      similarity: 0.98,
      matchType: "NORMALIZED_SUBSTRING",
      reason: "Punctuation-normalized excerpt matched inside chunk text.",
    };
  }

  // 4. Token-level overlap check (for slight PDF line-wrap or OCR hyphenation artifacts)
  const excerptTokens = strippedExcerpt.split(" ").filter((t) => t.length > 2);
  if (excerptTokens.length === 0) {
    return {
      passed: false,
      similarity: 0,
      matchType: "NONE",
      reason: "Excerpt contains no meaningful tokens to evaluate.",
    };
  }

  const chunkTokenSet = new Set(strippedChunk.split(" "));
  let matchedTokens = 0;
  for (const token of excerptTokens) {
    if (chunkTokenSet.has(token)) {
      matchedTokens++;
    }
  }

  const tokenOverlap = matchedTokens / excerptTokens.length;

  // Strict threshold: At least 85% of meaningful tokens must exist in chunk,
  // AND the excerpt must be at least 4 tokens long to prevent false single-word matches.
  if (tokenOverlap >= 0.85 && excerptTokens.length >= 4) {
    return {
      passed: true,
      similarity: Math.round(tokenOverlap * 100) / 100,
      matchType: "TOKEN_OVERLAP",
      reason: `High token overlap (${Math.round(tokenOverlap * 100)}%) matched chunk text.`,
    };
  }

  return {
    passed: false,
    similarity: Math.round(tokenOverlap * 100) / 100,
    matchType: "NONE",
    reason: `Cited excerpt could not be verified in chunk text (similarity: ${Math.round(tokenOverlap * 100)}%).`,
  };
}

/**
 * Checks whether an entity name or any of its known aliases appears in the text.
 */
export function checkEntityInText(
  canonicalName: string,
  aliases: string[],
  text: string
): boolean {
  if (!text) return false;
  const normText = ` ${normalizeQuoteText(stripPunctuation(text))} `;

  const candidates = [canonicalName, ...aliases].map((c) =>
    normalizeQuoteText(stripPunctuation(c))
  ).filter(Boolean);

  for (const candidate of candidates) {
    // Whole-word or enclosed boundary match
    if (normText.includes(` ${candidate} `) || normText.includes(candidate)) {
      return true;
    }

    // Significant entity token match (e.g. "caching" in "caching layer", ignoring generic category nouns)
    const tokens = candidate.split(" ").filter((t) => t.length >= 4 && !["layer", "service", "module", "system", "component"].includes(t));
    for (const tok of tokens) {
      if (normText.includes(` ${tok} `)) {
        return true;
      }
    }
  }

  return false;
}
