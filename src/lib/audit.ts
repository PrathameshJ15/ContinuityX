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

/**
 * Audit log helper that writes immutable records to the AuditLog table.
 * Never leaks or persists sensitive information (passwords, tokens, API keys).
 */
export async function writeAudit(params: WriteAuditParams): Promise<void> {
  try {
    // Sanitize metadata to ensure secrets are never stored
    let safeMetadata: Prisma.InputJsonValue | undefined;
    if (params.metadata) {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(params.metadata)) {
        if (/password|secret|token|key|credential/i.test(key)) {
          sanitized[key] = "[REDACTED]";
        } else {
          sanitized[key] = value;
        }
      }
      safeMetadata = sanitized as Prisma.InputJsonValue;
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
