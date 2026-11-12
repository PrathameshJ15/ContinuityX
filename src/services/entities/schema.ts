import { z } from "zod";
import { EntityType } from "@prisma/client";

export const entityNameSchema = z
  .string({ required_error: "Entity name is required." })
  .trim()
  .min(2, "Entity name must be at least 2 characters.")
  .max(200, "Entity name cannot exceed 200 characters.")
  .regex(/[a-zA-Z]/, "Entity name must contain at least one letter.")
  .regex(/^[^<>]+$/, "Entity name must be plain text without HTML tags.");

export const entityAliasSchema = z
  .string({ required_error: "Entity alias is required." })
  .trim()
  .min(2, "Entity alias must be at least 2 characters.")
  .max(200, "Entity alias cannot exceed 200 characters.")
  .regex(/[a-zA-Z]/, "Entity alias must contain at least one letter.")
  .regex(/^[^<>]+$/, "Entity alias must be plain text without HTML tags.");

export const createEntitySchema = z.object({
  canonicalName: entityNameSchema,
  type: z.nativeEnum(EntityType, { errorMap: () => ({ message: "Invalid entity type." }) }),
  aliases: z.array(entityAliasSchema).max(25, "Cannot specify more than 25 aliases.").optional(),
});

export const updateEntitySchema = z.object({
  canonicalName: entityNameSchema.optional(),
  type: z.nativeEnum(EntityType).optional(),
  aliases: z.array(entityAliasSchema).max(25, "Cannot specify more than 25 aliases.").optional(),
  needsReview: z.boolean().optional(),
});
