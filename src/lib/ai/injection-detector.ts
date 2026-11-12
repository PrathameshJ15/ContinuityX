export interface InjectionDetectionResult {
  flagged: boolean;
  matchedPatterns: string[];
}

interface InjectionRule {
  id: string;
  pattern: RegExp;
}

const INJECTION_RULES: readonly InjectionRule[] = [
  {
    id: "IGNORE_INSTRUCTIONS",
    pattern: /\b(ignore|disregard|forget|bypass)\s+(all\s+)?(previous|prior|above|system|safety)\s+(instructions|rules|prompts|directives)\b/i,
  },
  {
    id: "SYSTEM_OVERRIDE",
    pattern: /\b(system\s+override|override\s+system|admin\s+override|developer\s+mode)\b/i,
  },
  {
    id: "FORCE_VERIFICATION_OR_CONFIDENCE",
    pattern: /\b(mark\s+(all|everything|every)(?:\s+\w+){0,3}\s+(as\s+)?(verified|approved|accepted)|(set|with)\s+confidence\s*(to|=|:)?\s*1(\.0+)?)\b/i,
  },
  {
    id: "ROLE_HIJACK",
    pattern: /\b(you\s+are\s+now|act\s+as\s+a\s+new\s+assistant|new\s+system\s+prompt)\b/i,
  },
  {
    id: "PROMPT_DELIMITER_INJECTION",
    pattern: /<\/?(system|assistant|developer|untrusted_document_chunk|instructions?)>/i,
  },
];

/**
 * Scans untrusted document chunks or extracted claim text for prompt-injection phrases.
 * Flagging never halts document ingestion; flagged chunks/claims are surfaced to reviewers.
 */
export function detectPromptInjection(text: string): InjectionDetectionResult {
  if (!text || !text.trim()) {
    return { flagged: false, matchedPatterns: [] };
  }

  const matchedPatterns: string[] = [];
  for (const rule of INJECTION_RULES) {
    if (rule.pattern.test(text)) {
      matchedPatterns.push(rule.id);
    }
  }

  return {
    flagged: matchedPatterns.length > 0,
    matchedPatterns,
  };
}
