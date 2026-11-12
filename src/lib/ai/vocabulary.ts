export const VOCABULARY_VERSION = "1.0.0" as const;

export const STATUS_VALUES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "BLOCKED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type StatusValue = (typeof STATUS_VALUES)[number];

export type AttributeCardinality = "SINGLE" | "MULTI";

export type AttributeValueType =
  | "STATUS_ENUM"
  | "PERSON_ENTITY_REF"
  | "ENTITY_REF"
  | "NORMALIZED_TEXT"
  | "ISO_DATE"
  | "TEXT";

export type ControlledClaimCategory =
  | "DECISION"
  | "TASK"
  | "OWNERSHIP"
  | "DEPENDENCY"
  | "RISK"
  | "OPEN_QUESTION"
  | "FACT";

export interface AttributeDefinition {
  attributeKey: string;
  cardinality: AttributeCardinality;
  valueType: AttributeValueType;
  triggersConflict: boolean;
  defaultCategory: ControlledClaimCategory;
  description: string;
}

/**
 * Authoritative controlled attribute vocabulary per SPEC.md V3.2 Section 3.
 * Never add attributes without recording a change in DECISIONS.md.
 */
export const ATTRIBUTE_VOCABULARY = {
  status: {
    attributeKey: "status",
    cardinality: "SINGLE",
    valueType: "STATUS_ENUM",
    triggersConflict: true,
    defaultCategory: "TASK",
    description: "Current execution state of a task, module, component, or pipeline.",
  },
  owner: {
    attributeKey: "owner",
    cardinality: "SINGLE",
    valueType: "PERSON_ENTITY_REF",
    triggersConflict: true,
    defaultCategory: "OWNERSHIP",
    description: "Assigned primary person responsible for a component, task, or system.",
  },
  selected_technology: {
    attributeKey: "selected_technology",
    cardinality: "SINGLE",
    valueType: "NORMALIZED_TEXT",
    triggersConflict: true,
    defaultCategory: "DECISION",
    description: "Chosen technology, framework, database, or infrastructure tool for a subject.",
  },
  due_date: {
    attributeKey: "due_date",
    cardinality: "SINGLE",
    valueType: "ISO_DATE",
    triggersConflict: true,
    defaultCategory: "TASK",
    description: "Target deadline or milestone date formatted strictly as YYYY-MM-DD.",
  },
  depends_on: {
    attributeKey: "depends_on",
    cardinality: "MULTI",
    valueType: "ENTITY_REF",
    triggersConflict: false,
    defaultCategory: "DEPENDENCY",
    description: "Upstream component, task, or system dependency.",
  },
  risk: {
    attributeKey: "risk",
    cardinality: "MULTI",
    valueType: "TEXT",
    triggersConflict: false,
    defaultCategory: "RISK",
    description: "Identified delivery, security, or technical risk.",
  },
  open_question: {
    attributeKey: "open_question",
    cardinality: "MULTI",
    valueType: "TEXT",
    triggersConflict: false,
    defaultCategory: "OPEN_QUESTION",
    description: "Unresolved question requiring stakeholder clarification or decision.",
  },
  rationale: {
    attributeKey: "rationale",
    cardinality: "MULTI",
    valueType: "TEXT",
    triggersConflict: false,
    defaultCategory: "DECISION",
    description: "Reasoning or justification supporting a technical or project decision.",
  },
} as const satisfies Record<string, AttributeDefinition>;

export type ControlledAttributeKey = keyof typeof ATTRIBUTE_VOCABULARY;

export const CONTROLLED_ATTRIBUTE_KEYS = Object.keys(
  ATTRIBUTE_VOCABULARY
) as ControlledAttributeKey[];

/**
 * Maps common informal status expressions to controlled STATUS_VALUES.
 * Keys must be lowercase trimmed with collapsed spaces.
 */
export const STATUS_SYNONYM_DICTIONARY: Readonly<Record<string, StatusValue>> = {
  // COMPLETED
  completed: "COMPLETED",
  complete: "COMPLETED",
  done: "COMPLETED",
  finished: "COMPLETED",
  shipped: "COMPLETED",
  deployed: "COMPLETED",
  closed: "COMPLETED",
  resolved: "COMPLETED",
  live: "COMPLETED",
  // IN_PROGRESS
  in_progress: "IN_PROGRESS",
  "in progress": "IN_PROGRESS",
  "in-progress": "IN_PROGRESS",
  wip: "IN_PROGRESS",
  "work in progress": "IN_PROGRESS",
  ongoing: "IN_PROGRESS",
  active: "IN_PROGRESS",
  working: "IN_PROGRESS",
  started: "IN_PROGRESS",
  underway: "IN_PROGRESS",
  // BLOCKED
  blocked: "BLOCKED",
  stuck: "BLOCKED",
  halted: "BLOCKED",
  stalled: "BLOCKED",
  waiting: "BLOCKED",
  "on hold": "BLOCKED",
  on_hold: "BLOCKED",
  // NOT_STARTED
  not_started: "NOT_STARTED",
  "not started": "NOT_STARTED",
  "not-started": "NOT_STARTED",
  todo: "NOT_STARTED",
  "to do": "NOT_STARTED",
  "to-do": "NOT_STARTED",
  planned: "NOT_STARTED",
  queued: "NOT_STARTED",
  backlog: "NOT_STARTED",
  pending: "NOT_STARTED",
  unstarted: "NOT_STARTED",
  // CANCELLED
  cancelled: "CANCELLED",
  canceled: "CANCELLED",
  dropped: "CANCELLED",
  abandoned: "CANCELLED",
  scrapped: "CANCELLED",
  deprecated: "CANCELLED",
};

const UNASSIGNED_SENTINELS = new Set([
  "",
  "none",
  "n/a",
  "na",
  "tbd",
  "unknown",
  "unassigned",
  "null",
  "-",
  "—",
]);

export function isControlledAttributeKey(key: string): key is ControlledAttributeKey {
  return Object.prototype.hasOwnProperty.call(ATTRIBUTE_VOCABULARY, key);
}

/**
 * Normalizes a raw claim value strictly according to the controlled attribute's value type.
 * Returns null if the value cannot be reliably normalized (never guesses; UI flags "needs normalisation").
 */
export function normalizeClaimValue(
  attributeKey: ControlledAttributeKey,
  valueRaw: string
): string | null {
  const trimmed = valueRaw.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;

  const def = ATTRIBUTE_VOCABULARY[attributeKey];

  switch (def.valueType) {
    case "STATUS_ENUM": {
      const upper = trimmed.toUpperCase().replace(/[\s-]+/g, "_");
      if ((STATUS_VALUES as readonly string[]).includes(upper)) {
        return upper;
      }
      const lower = trimmed.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
      const mapped = STATUS_SYNONYM_DICTIONARY[lower] ?? STATUS_SYNONYM_DICTIONARY[trimmed.toLowerCase()];
      return mapped ?? null;
    }

    case "ISO_DATE": {
      // Exact YYYY-MM-DD check with real calendar validation
      const isoMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(trimmed);
      if (isoMatch) {
        const year = Number(isoMatch[1]);
        const month = Number(isoMatch[2]);
        const day = Number(isoMatch[3]);
        const dt = new Date(Date.UTC(year, month - 1, day));
        if (
          dt.getUTCFullYear() === year &&
          dt.getUTCMonth() === month - 1 &&
          dt.getUTCDate() === day
        ) {
          return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        }
        return null;
      }
      return null;
    }

    case "PERSON_ENTITY_REF":
    case "ENTITY_REF": {
      if (UNASSIGNED_SENTINELS.has(trimmed.toLowerCase())) {
        return null;
      }
      return trimmed;
    }

    case "NORMALIZED_TEXT": {
      if (UNASSIGNED_SENTINELS.has(trimmed.toLowerCase())) {
        return null;
      }
      return canonicalizeTechnologyOrText(trimmed);
    }

    case "TEXT": {
      return trimmed;
    }
  }
}

const KNOWN_TEXT_CANONICALS: Readonly<Record<string, string>> = {
  postgres: "PostgreSQL",
  postgresql: "PostgreSQL",
  mongo: "MongoDB",
  mongodb: "MongoDB",
  jwt: "JWT",
  nextjs: "Next.js",
  "next.js": "Next.js",
  prisma: "Prisma",
  redis: "Redis",
};

function canonicalizeTechnologyOrText(raw: string): string {
  const mapped = KNOWN_TEXT_CANONICALS[raw.toLowerCase()];
  if (mapped) return mapped;
  return raw;
}
