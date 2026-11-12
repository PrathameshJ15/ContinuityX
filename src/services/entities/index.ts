import { EntityCreator, EntityType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireProjectAccess } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { AppError } from "@/lib/api-response";
import { normalizeEntityKey } from "./resolution";

export async function listEntitiesService(
  projectId: string,
  includeMerged: boolean = false,
  explicitUserId?: string
) {
  await requireProjectAccess(projectId, "claims:view_unapproved", explicitUserId);

  const entities = await prisma.entity.findMany({
    where: {
      projectId,
      ...(includeMerged ? {} : { mergedIntoId: null }),
    },
    orderBy: [{ needsReview: "desc" }, { canonicalName: "asc" }],
    include: {
      aliases: { orderBy: { alias: "asc" } },
      _count: {
        select: { claims: true, mergedEntities: true },
      },
    },
  });

  return entities.map((e) => ({
    id: e.id,
    canonicalName: e.canonicalName,
    normalizedId: e.normalizedId,
    type: e.type,
    createdBy: e.createdBy,
    mergedIntoId: e.mergedIntoId,
    needsReview: e.needsReview,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    aliases: e.aliases,
    claimCount: e._count.claims,
    mergedCount: e._count.mergedEntities,
  }));
}

export async function updateEntityService(
  projectId: string,
  entityId: string,
  input: {
    canonicalName?: string;
    type?: EntityType;
    aliases?: string[];
    needsReview?: boolean;
  },
  explicitUserId?: string
) {
  const { user } = await requireProjectAccess(
    projectId,
    "review:claims_conflicts_entities",
    explicitUserId
  );

  const existing = await prisma.entity.findFirst({
    where: { id: entityId, projectId },
    include: { aliases: true },
  });

  if (!existing) {
    throw new AppError("NOT_FOUND", "Entity not found.", 404);
  }

  if (existing.mergedIntoId) {
    throw new AppError(
      "BAD_REQUEST",
      "Cannot edit an entity that has already been merged into another entity.",
      400
    );
  }

  const nextName = input.canonicalName?.replace(/\s+/g, " ").trim();
  const nextNormalizedId = nextName ? normalizeEntityKey(nextName) : undefined;

  if (nextNormalizedId && nextNormalizedId !== existing.normalizedId) {
    const collision = await prisma.entity.findFirst({
      where: {
        projectId,
        normalizedId: nextNormalizedId,
        NOT: { id: entityId },
      },
    });
    if (collision) {
      throw new AppError(
        "CONFLICT",
        `Another entity ('${collision.canonicalName}') already uses this normalized name. Merge them instead.`,
        409
      );
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const entityUpdateData: Prisma.EntityUpdateInput = {};
    if (nextName && nextNormalizedId) {
      entityUpdateData.canonicalName = nextName;
      entityUpdateData.normalizedId = nextNormalizedId;
    }
    if (input.type) {
      entityUpdateData.type = input.type;
    }
    if (typeof input.needsReview === "boolean") {
      entityUpdateData.needsReview = input.needsReview;
    }

    await tx.entity.update({
      where: { id: entityId },
      data: entityUpdateData,
    });

    if (Array.isArray(input.aliases)) {
      await tx.entityAlias.deleteMany({ where: { entityId } });
      const seen = new Set<string>();
      const aliasCreates: Array<{ entityId: string; alias: string; normalizedAlias: string }> = [];

      const desiredList = nextName ? [nextName, ...input.aliases] : [existing.canonicalName, ...input.aliases];
      for (const rawAlias of desiredList) {
        const clean = rawAlias.replace(/\s+/g, " ").trim();
        const norm = normalizeEntityKey(clean);
        if (!clean || !norm || seen.has(norm)) continue;
        seen.add(norm);
        aliasCreates.push({
          entityId,
          alias: clean,
          normalizedAlias: norm,
        });
      }

      if (aliasCreates.length > 0) {
        await tx.entityAlias.createMany({ data: aliasCreates });
      }
    }

    return tx.entity.findUniqueOrThrow({
      where: { id: entityId },
      include: { aliases: { orderBy: { alias: "asc" } } },
    });
  }, { maxWait: 30000, timeout: 60000 });

  await writeAudit({
    projectId,
    userId: user.id,
    action: "ENTITY_UPDATED",
    entityType: "ENTITY",
    entityId,
    metadata: {
      canonicalName: updated.canonicalName,
      needsReview: updated.needsReview,
      aliasCount: updated.aliases.length,
    },
  });

  return updated;
}

/**
 * Soft-merges sourceEntityId into targetEntityId inside the same project.
 * Claims are repointed atomically and source aliases are preserved under target.
 */
export async function mergeEntitiesService(
  projectId: string,
  sourceEntityId: string,
  targetEntityId: string,
  explicitUserId?: string
) {
  const { user } = await requireProjectAccess(
    projectId,
    "review:claims_conflicts_entities",
    explicitUserId
  );

  if (sourceEntityId === targetEntityId) {
    throw new AppError("BAD_REQUEST", "Cannot merge an entity into itself.", 400);
  }

  const [source, target] = await Promise.all([
    prisma.entity.findFirst({
      where: { id: sourceEntityId, projectId },
      include: { aliases: true },
    }),
    prisma.entity.findFirst({
      where: { id: targetEntityId, projectId },
      include: { aliases: true },
    }),
  ]);

  if (!source || !target) {
    throw new AppError("NOT_FOUND", "Source or target entity not found in this project.", 404);
  }

  if (target.mergedIntoId) {
    throw new AppError(
      "BAD_REQUEST",
      "Target entity has itself been merged. Select the canonical active entity instead.",
      400
    );
  }

  if (source.mergedIntoId) {
    throw new AppError("BAD_REQUEST", "Source entity has already been merged.", 400);
  }

  await prisma.$transaction(async (tx) => {
    // Move all claims from source -> target
    await tx.claim.updateMany({
      where: { projectId, subjectEntityId: source.id },
      data: { subjectEntityId: target.id },
    });

    // Preserve source canonical name and aliases on target
    const existingTargetNorms = new Set(target.aliases.map((a) => a.normalizedAlias));
    const candidates = [
      { alias: source.canonicalName, norm: normalizeEntityKey(source.canonicalName) },
      ...source.aliases.map((a) => ({ alias: a.alias, norm: a.normalizedAlias })),
    ];

    for (const item of candidates) {
      if (!item.norm || existingTargetNorms.has(item.norm)) continue;
      existingTargetNorms.add(item.norm);
      await tx.entityAlias.create({
        data: {
          entityId: target.id,
          alias: item.alias,
          normalizedAlias: item.norm,
        },
      });
    }

    await tx.entity.update({
      where: { id: source.id },
      data: {
        mergedIntoId: target.id,
        needsReview: false,
      },
    });

    await tx.entity.update({
      where: { id: target.id },
      data: {
        needsReview: false,
        createdBy: target.createdBy === EntityCreator.MODEL ? EntityCreator.REVIEWER : target.createdBy,
      },
    });
  }, { maxWait: 30000, timeout: 60000 });

  await writeAudit({
    projectId,
    userId: user.id,
    action: "ENTITIES_MERGED",
    entityType: "ENTITY",
    entityId: target.id,
    metadata: {
      sourceEntityId: source.id,
      sourceName: source.canonicalName,
      targetEntityId: target.id,
      targetName: target.canonicalName,
    },
  });

  return { merged: true, sourceEntityId: source.id, targetEntityId: target.id };
}

export async function createManualEntityService(
  projectId: string,
  input: { canonicalName: string; type: EntityType; aliases?: string[] },
  explicitUserId?: string
) {
  const { user } = await requireProjectAccess(
    projectId,
    "review:claims_conflicts_entities",
    explicitUserId
  );

  const cleanName = input.canonicalName.replace(/\s+/g, " ").trim();
  const normalizedId = normalizeEntityKey(cleanName);
  if (!cleanName || !normalizedId) {
    throw new AppError("VALIDATION_ERROR", "Entity name cannot be empty.", 400);
  }

  const collision = await prisma.entity.findFirst({
    where: { projectId, normalizedId },
  });
  if (collision) {
    throw new AppError(
      "CONFLICT",
      `Entity '${collision.canonicalName}' already exists in this project.`,
      409
    );
  }

  const seen = new Set<string>([normalizedId]);
  const aliasData: Array<{ alias: string; normalizedAlias: string }> = [
    { alias: cleanName, normalizedAlias: normalizedId },
  ];
  for (const raw of input.aliases ?? []) {
    const clean = raw.replace(/\s+/g, " ").trim();
    const norm = normalizeEntityKey(clean);
    if (clean && norm && !seen.has(norm)) {
      seen.add(norm);
      aliasData.push({ alias: clean, normalizedAlias: norm });
    }
  }

  const entity = await prisma.entity.create({
    data: {
      projectId,
      canonicalName: cleanName,
      normalizedId,
      type: input.type,
      createdBy: EntityCreator.REVIEWER,
      needsReview: false,
      aliases: { create: aliasData },
    },
    include: { aliases: true },
  });

  await writeAudit({
    projectId,
    userId: user.id,
    action: "ENTITY_CREATED",
    entityType: "ENTITY",
    entityId: entity.id,
    metadata: { canonicalName: entity.canonicalName, type: entity.type },
  });

  return entity;
}
