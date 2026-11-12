import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export interface WriteAuditParams {
  projectId?: string | null;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown> | null;
}

export function sanitizeAuditMetadata(
  meta: Record<string, unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (/password|secret|token|key|credential|databaseurl/i.test(key)) {
      sanitized[key] = "[REDACTED]";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      sanitized[key] = sanitizeAuditMetadata(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Audit log helper that writes immutable records to the AuditLog table.
 * Never leaks or persists sensitive information (passwords, tokens, API keys).
 */
export async function writeAudit(params: WriteAuditParams): Promise<void> {
  try {
    // Sanitize metadata to ensure secrets are never stored
    let safeMetadata: Prisma.InputJsonValue | undefined;
    if (params.metadata) {
      safeMetadata = sanitizeAuditMetadata(params.metadata) as Prisma.InputJsonValue;
    }

    await prisma.auditLog.create({
      data: {
        projectId: params.projectId ?? null,
        userId: params.userId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: safeMetadata,
      },
    });
  } catch (error) {
    // Audit logging should never bring down the primary transaction or throw unhandled exceptions
    console.error("[AuditLog] Failed to record audit event:", error instanceof Error ? error.message : error);
  }
}
