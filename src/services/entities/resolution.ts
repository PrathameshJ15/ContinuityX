import { EntityCreator, EntityType, Prisma, PrismaClient } from "@prisma/client";

export const ENTITY_MATCH_THRESHOLD = 0.86;
export const ENTITY_UNCERTAIN_THRESHOLD = 0.65;

export interface RegistryCandidate {
  id: string;
  canonicalName: string;
  normalizedId: string;
  type: EntityType;
  mergedIntoId: string | null;
  needsReview: boolean;
  aliases: Array<{ id: string; alias: string; normalizedAlias: string }>;
}

export interface ResolveEntityInput {
  projectId: string;
  proposedEntityId?: string | null;
  proposedName: string;
  proposedType: EntityType;
}

export interface ResolveEntityOutcome {
  entityId: string;
  canonicalName: string;
  createdNew: boolean;
  needsReview: boolean;
  resolutionMethod:
    | "PROPOSED_ID"
    | "EXACT_CANONICAL"
    | "EXACT_ALIAS"
    | "FUZZY_MATCH"
    | "UNCERTAIN_NEW"
    | "AMBIGUOUS_PERSON"
    | "NEW_ENTITY";
  similarityScore?: number;
}

type DbLike = PrismaClient | Prisma.TransactionClient;

/**
 * Produces a deterministic normalized key from an entity or alias string.
 * Splits CamelCase ("AuthService" -> "auth service"), strips punctuation, and collapses spaces.
 */
export function normalizeEntityKey(raw: string): string {
  return raw
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const DOMAIN_TOKEN_EQUIVALENCE: Readonly<Record<string, string>> = {
  auth: "authentication",
  authn: "authentication",
  authentication: "authentication",
  login: "authentication",
  signin: "authentication",
  svc: "service",
  service: "service",
  module: "service",
  component: "service",
  db: "database",
  database: "database",
  api: "api",
  gateway: "gateway",
};

function tokenizeForSimilarity(normalized: string): string[] {
  return normalized
    .split(" ")
    .filter((t) => t.length > 0 && t !== "the" && t !== "a" && t !== "an");
}

function canonicalToken(token: string): string {
  return DOMAIN_TOKEN_EQUIVALENCE[token] ?? token;
}

function levenshteinRatio(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;

  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  const dist = dp[a.length][b.length];
  return 1 - dist / Math.max(a.length, b.length);
}

/**
 * Pure deterministic entity name similarity in [0, 1].
 * Combines normalized Levenshtein ratio and domain-token equivalence/prefix overlap.
 */
export function computeEntitySimilarity(nameA: string, nameB: string): number {
  const normA = normalizeEntityKey(nameA);
  const normB = normalizeEntityKey(nameB);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;

  const lev = levenshteinRatio(normA, normB);

  const tokensA = tokenizeForSimilarity(normA).map(canonicalToken);
  const tokensB = tokenizeForSimilarity(normB).map(canonicalToken);
  if (tokensA.length === 0 || tokensB.length === 0) return lev;

  let matchedWeight = 0;
  for (const tA of tokensA) {
    let bestTokenScore = 0;
    for (const tB of tokensB) {
      if (tA === tB) {
        bestTokenScore = 1;
        break;
      }
      // Safe prefix match for abbreviations >= 4 chars (e.g. "auth" -> "authentication")
      const minLen = Math.min(tA.length, tB.length);
      if (minLen >= 4 && (tA.startsWith(tB) || tB.startsWith(tA))) {
        bestTokenScore = Math.max(bestTokenScore, 0.92);
      } else {
        const tokLev = levenshteinRatio(tA, tB);
        if (tokLev >= 0.8) {
          bestTokenScore = Math.max(bestTokenScore, tokLev);
        }
      }
    }
    matchedWeight += bestTokenScore;
  }

  const tokenScore =
    (2 * matchedWeight) / Math.max(1, tokensA.length + tokensB.length);

  return Math.max(lev, tokenScore);
}

/**
 * Detects ambiguous same-first-name PERSON mentions (e.g. "Arjun" when both "Arjun Mehta" and "Arjun Verma" exist).
 */
export function isAmbiguousPersonMention(
  proposedName: string,
  proposedType: EntityType,
  registry: RegistryCandidate[]
): boolean {
  if (proposedType !== EntityType.PERSON) return false;

  const tokens = normalizeEntityKey(proposedName).split(" ").filter(Boolean);
  if (tokens.length !== 1) return false; // Full multi-token name is specific
  const firstToken = tokens[0];

  const matchingFullNames = registry.filter((e) => {
    if (e.mergedIntoId !== null || e.type !== EntityType.PERSON) return false;
    const eTokens = normalizeEntityKey(e.canonicalName).split(" ").filter(Boolean);
    return eTokens.length >= 2 && eTokens[0] === firstToken;
  });

  return matchingFullNames.length >= 2;
}

/**
 * Follows mergedIntoId chain safely with cycle guard within the project.
 */
async function resolveMergeTarget(
  db: DbLike,
  projectId: string,
  entityId: string
): Promise<RegistryCandidate | null> {
  const visited = new Set<string>();
  let currentId: string | null = entityId;

  while (currentId) {
    if (visited.has(currentId)) return null;
    visited.add(currentId);

    const found: RegistryCandidate | null = await db.entity.findFirst({
      where: { id: currentId, projectId },
      include: { aliases: true },
    });

    if (!found) return null;
    if (!found.mergedIntoId) return found;
    currentId = found.mergedIntoId;
  }

  return null;
}

async function ensureAliasRecorded(
  db: DbLike,
  entityId: string,
  surfaceForm: string
): Promise<void> {
  const trimmed = surfaceForm.trim();
  const normalizedAlias = normalizeEntityKey(trimmed);
  if (!trimmed || !normalizedAlias) return;

  await db.entityAlias.upsert({
    where: {
      entityId_normalizedAlias: {
        entityId,
        normalizedAlias,
      },
    },
    update: {},
    create: {
      entityId,
      alias: trimmed,
      normalizedAlias,
    },
  });
}

/**
 * Resolves a proposed subject mention against the project's Entity registry.
 * - Rejects invalid or cross-project proposedEntityIds safely.
 * - Resolves exact canonical/alias matches automatically.
 * - Uses deterministic fuzzy fallback above threshold.
 * - Never auto-merges uncertain matches or ambiguous same-first-name PERSON mentions.
 */
export async function resolveSubjectEntity(
  db: DbLike,
  input: ResolveEntityInput
): Promise<ResolveEntityOutcome> {
  const cleanName = input.proposedName.replace(/\s+/g, " ").trim() || "Unknown Entity";
  const normalizedProposed = normalizeEntityKey(cleanName) || "unknown_entity";

  // 1. Load active (non-merged) entities for this project ONLY
  const activeEntities: RegistryCandidate[] = await db.entity.findMany({
    where: { projectId: input.projectId, mergedIntoId: null },
    include: { aliases: true },
    orderBy: { createdAt: "asc" },
  });

  // Check same-first-name PERSON ambiguity before letting any fuzzy heuristic or guess merge
  const ambiguousPerson = isAmbiguousPersonMention(
    cleanName,
    input.proposedType,
    activeEntities
  );

  // 2. Verify model-proposed existing entity ID strictly belongs to this project
  if (
    !ambiguousPerson &&
    input.proposedEntityId &&
    input.proposedEntityId !== "NEW"
  ) {
    const resolved = await resolveMergeTarget(
      db,
      input.projectId,
      input.proposedEntityId
    );
    if (resolved) {
      await ensureAliasRecorded(db, resolved.id, cleanName);
      return {
        entityId: resolved.id,
        canonicalName: resolved.canonicalName,
        createdNew: false,
        needsReview: resolved.needsReview,
        resolutionMethod: "PROPOSED_ID",
        similarityScore: 1,
      };
    }
  }

  // 3. Exact normalized canonicalName match
  const exactCanonical = activeEntities.find(
    (e) => e.normalizedId === normalizedProposed
  );
  if (exactCanonical) {
    return {
      entityId: exactCanonical.id,
      canonicalName: exactCanonical.canonicalName,
      createdNew: false,
      needsReview: exactCanonical.needsReview,
      resolutionMethod: "EXACT_CANONICAL",
      similarityScore: 1,
    };
  }

  // 4. Exact normalized alias match
  for (const entity of activeEntities) {
    if (entity.aliases.some((a) => a.normalizedAlias === normalizedProposed)) {
      return {
        entityId: entity.id,
        canonicalName: entity.canonicalName,
        createdNew: false,
        needsReview: entity.needsReview,
        resolutionMethod: "EXACT_ALIAS",
        similarityScore: 1,
      };
    }
  }

  // 5. Same-first-name PERSON ambiguity -> create flagged entity, NEVER auto-merge
  if (ambiguousPerson) {
    const created = await db.entity.create({
      data: {
        projectId: input.projectId,
        canonicalName: cleanName,
        normalizedId: normalizedProposed,
        type: EntityType.PERSON,
        createdBy: EntityCreator.MODEL,
        needsReview: true,
        aliases: {
          create: {
            alias: cleanName,
            normalizedAlias: normalizedProposed,
          },
        },
      },
    });
    return {
      entityId: created.id,
      canonicalName: created.canonicalName,
      createdNew: true,
      needsReview: true,
      resolutionMethod: "AMBIGUOUS_PERSON",
    };
  }

  // 6. Fuzzy similarity fallback against compatible types
  let bestCandidate: RegistryCandidate | null = null;
  let bestScore = 0;

  for (const candidate of activeEntities) {
    // Never fuzzy-merge a PERSON with a non-PERSON entity
    if (
      (input.proposedType === EntityType.PERSON) !==
      (candidate.type === EntityType.PERSON)
    ) {
      continue;
    }

    const surfaces = [
      candidate.canonicalName,
      ...candidate.aliases.map((a) => a.alias),
    ];

    for (const surface of surfaces) {
      const score = computeEntitySimilarity(cleanName, surface);
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = candidate;
      }
    }
  }

  if (bestCandidate && bestScore >= ENTITY_MATCH_THRESHOLD) {
    await ensureAliasRecorded(db, bestCandidate.id, cleanName);
    return {
      entityId: bestCandidate.id,
      canonicalName: bestCandidate.canonicalName,
      createdNew: false,
      needsReview: bestCandidate.needsReview,
      resolutionMethod: "FUZZY_MATCH",
      similarityScore: Number(bestScore.toFixed(3)),
    };
  }

  // Ensure unique normalizedId inside project (in case an uncertain or colliding record exists)
  let uniqueNormalizedId = normalizedProposed;
  let suffix = 2;
  const takenIds = new Set<string>(
    (
      await db.entity.findMany({
        where: { projectId: input.projectId },
        select: { normalizedId: true },
      })
    ).map((e) => e.normalizedId)
  );
  while (takenIds.has(uniqueNormalizedId)) {
    uniqueNormalizedId = `${normalizedProposed}_${suffix++}`;
  }

  const inUncertainBand =
    bestCandidate !== null && bestScore >= ENTITY_UNCERTAIN_THRESHOLD;

  const created = await db.entity.create({
    data: {
      projectId: input.projectId,
      canonicalName: cleanName,
      normalizedId: uniqueNormalizedId,
      type: input.proposedType,
      createdBy: EntityCreator.MODEL,
      needsReview: inUncertainBand,
      aliases: {
        create: {
          alias: cleanName,
          normalizedAlias: normalizedProposed,
        },
      },
    },
  });

  return {
    entityId: created.id,
    canonicalName: created.canonicalName,
    createdNew: true,
    needsReview: inUncertainBand,
    resolutionMethod: inUncertainBand ? "UNCERTAIN_NEW" : "NEW_ENTITY",
    similarityScore: bestCandidate ? Number(bestScore.toFixed(3)) : undefined,
  };
}
