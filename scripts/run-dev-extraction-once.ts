import fs from "node:fs/promises";
import path from "node:path";
import { DocumentProcessingStatus } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { uploadDocumentService, processDocumentNextStepService } from "../src/services/documents";
import { extractDocumentClaimsService } from "../src/services/extraction";
import { listClaimsService } from "../src/services/claims";
import { listEntitiesService } from "../src/services/entities";
import { getStorageProvider } from "../src/lib/storage";

if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(".env");
  } catch {
    // Ignore if already populated in environment
  }
}

const DEV_FILES = [
  { fileName: "design_doc.pdf", mimeType: "application/pdf", userProvidedDate: "2026-09-01" },
  {
    fileName: "meeting_notes.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    userProvidedDate: "2026-09-12",
  },
  { fileName: "task_tracker.csv", mimeType: "text/csv", userProvidedDate: "2026-09-18" },
  {
    fileName: "chat_export.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    userProvidedDate: "2026-09-25",
  },
  { fileName: "scanned_notes.pdf", mimeType: "application/pdf", userProvidedDate: "2026-09-20" },
];

async function main() {
  const lead = await prisma.user.findUnique({
    where: { email: "lead@continuityx.demo" },
  });
  if (!lead) {
    throw new Error("Seeded user lead@continuityx.demo not found. Run prisma db seed first.");
  }

  // Remove any leftover temp projects from an interrupted prior run
  await prisma.project.deleteMany({
    where: { name: "DEV Phase 3 Live Check (Temp)" },
  });

  const project = await prisma.project.create({
    data: {
      name: "DEV Phase 3 Live Check (Temp)",
      description: "Temporary project for manual one-time DEV live Gemini extraction check",
      createdByUser: {
        connect: { id: lead.id },
      },
      members: {
        create: {
          userId: lead.id,
          role: "OWNER",
        },
      },
    },
  });

  const storage = getStorageProvider();
  const uploadedPaths: string[] = [];

  try {
    const devDir = path.resolve(process.cwd(), "demo-data", "dev");
    const perDocStats: Array<{
      fileName: string;
      processingStatus: string;
      chunkCount: number;
      extraction?: unknown;
      note?: string;
    }> = [];

    for (const item of DEV_FILES) {
      const fileBuffer = await fs.readFile(path.join(devDir, item.fileName));
      const doc = await uploadDocumentService({
        projectId: project.id,
        originalFileName: item.fileName,
        fileBuffer,
        reportedMimeType: item.mimeType,
        userProvidedDate: item.userProvidedDate,
        explicitUserId: lead.id,
      });
      uploadedPaths.push(doc.storageKey);

      let status: DocumentProcessingStatus = doc.processingStatus;
      let stepNote: string | undefined;

      for (let step = 0; step < 5; step++) {
        const res = await processDocumentNextStepService(project.id, doc.id, lead.id);
        status = res.status;
        if (
          status === DocumentProcessingStatus.READY_FOR_AI ||
          status === DocumentProcessingStatus.VALIDATION_FAILED ||
          status === DocumentProcessingStatus.EXTRACTION_FAILED
        ) {
          if ("error" in res && typeof res.error === "string") {
            stepNote = res.error;
          }
          break;
        }
      }

      const chunkCount = await prisma.documentChunk.count({ where: { documentId: doc.id } });

      if (status === DocumentProcessingStatus.READY_FOR_AI && chunkCount > 0) {
        console.error(`[DEV-CHECK] Extracting ${item.fileName} (${chunkCount} chunks)...`);
        let extracted;
        try {
          extracted = await extractDocumentClaimsService(project.id, doc.id, {
            explicitUserId: lead.id,
            retryBaseDelayMs: 6000,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          const fallbackModel = process.env.GEMINI_JUDGE_MODEL || "gemini-3.5-flash";
          if (/high demand|503|unavailable/i.test(msg)) {
            console.error(
              `[DEV-CHECK] Primary model unavailable (${msg}); retrying ${item.fileName} with ${fallbackModel}...`
            );
            extracted = await extractDocumentClaimsService(project.id, doc.id, {
              model: fallbackModel,
              explicitUserId: lead.id,
              retryBaseDelayMs: 6000,
            });
          } else {
            throw err;
          }
        }
        console.error(
          `[DEV-CHECK] Done ${item.fileName} (model=${extracted.model}): claims=${extracted.claimsCreated}, flaggedChunks=${extracted.flaggedChunks}`
        );
        perDocStats.push({
          fileName: item.fileName,
          processingStatus: status,
          chunkCount,
          extraction: extracted,
        });
        // Pace between documents to stay cleanly under Free Tier RPM
        await new Promise((r) => setTimeout(r, 3000));
      } else {
        console.error(`[DEV-CHECK] Skipping ${item.fileName}: status=${status}, chunks=${chunkCount}`);
        perDocStats.push({
          fileName: item.fileName,
          processingStatus: status,
          chunkCount,
          note: stepNote ?? "Skipped extraction (non-ready or zero chunks)",
        });
      }
    }

    const firstPage = await listClaimsService(project.id, { page: 1, limit: 50 }, lead.id);
    const claims = [...firstPage.claims];
    for (let p = 2; p <= firstPage.pagination.totalPages; p++) {
      const next = await listClaimsService(project.id, { page: p, limit: 50 }, lead.id);
      claims.push(...next.claims);
    }

    const entities = await listEntitiesService(project.id, true, lead.id);

    const claimsWithValidSourceRefs = claims.filter(
      (c) =>
        c.evidence.length > 0 &&
        c.evidence.every(
          (ev) =>
            Boolean(ev.documentId) &&
            Boolean(ev.chunkId) &&
            Boolean(ev.sourceLocation) &&
            Boolean(ev.excerpt && ev.excerpt.trim().length > 0)
        )
    );

    const flaggedChunks = await prisma.documentChunk.findMany({
      where: {
        document: { projectId: project.id },
        injectionFlag: true,
      },
      include: { document: { select: { fileName: true } } },
    });

    const flaggedClaims = claims.filter((c) => c.injectionFlag);

    const report = {
      projectId: project.id,
      documents: perDocStats,
      summary: {
        totalClaims: claims.length,
        validSourceRefsCount: claimsWithValidSourceRefs.length,
        flaggedChunkCount: flaggedChunks.length,
        flaggedClaimCount: flaggedClaims.length,
        flaggedChunksDetail: flaggedChunks.map((fc) => ({
          document: fc.document.fileName,
          chunkIndex: fc.chunkIndex,
          sectionTitle: fc.sectionTitle,
        })),
        entityCount: entities.length,
        entities: entities.map((e) => ({
          canonicalName: e.canonicalName,
          type: e.type,
          needsReview: e.needsReview,
          mergedIntoId: e.mergedIntoId,
          aliases: e.aliases.map((a) => a.alias),
        })),
        sampleClaims: claims.slice(0, 10).map((c) => ({
          subject: c.subjectEntity.canonicalName,
          attribute: c.attributeKey,
          valueRaw: c.valueRaw,
          valueNormalized: c.valueNormalized,
          category: c.category,
          source: c.evidence[0]
            ? `${c.evidence[0].document.fileName} (${c.evidence[0].sourceLocation})`
            : null,
          excerpt: c.evidence[0]?.excerpt ?? null,
          injectionFlag: c.injectionFlag,
        })),
      },
    };

    console.log(JSON.stringify(report, null, 2));
  } finally {
    for (const key of uploadedPaths) {
      await storage.delete(key).catch(() => {});
    }
    await prisma.project.delete({ where: { id: project.id } }).catch(() => {});
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("DEV extraction check failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
