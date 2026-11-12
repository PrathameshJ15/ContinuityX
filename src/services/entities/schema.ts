import { z } from "zod";
import { EntityType } from "@prisma/client";

export const entityNameSchema = z
  .string()
  .trim()
  .min(2, "Entity name must be at least 2 characters.")
  .max(200, "Entity name cannot exceed 200 characters.")
  .regex(/[a-zA-Z]/, "Entity name must contain at least one letter.");

export const createEntitySchema = z.object({
  canonicalName: entityNameSchema,
  type: z.nativeEnum(EntityType),
  aliases: z.array(z.string().trim().min(1).max(200)).max(25).optional(),
});
