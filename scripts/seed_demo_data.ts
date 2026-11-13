import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import {
  DocumentProcessingStatus,
  EvidenceStatus,
  GateOutcome,
  ClaimCategory,
  ConflictType,
  ConflictResolutionState,
  EntityType,
} from "@prisma/client";
import { prisma } from "../src/lib/db";
import { uploadDocumentService, processDocumentNextStepService } from "../src/services/documents";

const DEV_FILES = [
  { fileName: "design_doc.pdf", mimeType: "application/pdf", userProvidedDate: "2026-01-10" },
  {
    fileName: "meeting_notes.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    userProvidedDate: "2026-01-15",
  },
  { fileName: "task_tracker.csv", mimeType: "text/csv", userProvidedDate: "2026-01-20" },
  {
    fileName: "chat_export.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    userProvidedDate: null,
  },
  { fileName: "scanned_notes.pdf", mimeType: "application/pdf", userProvidedDate: null },
];

function sha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function seedDemoWorkspace() {
  console.log("=== SEEDING DEMO WORKSPACE WITH DEV FIXTURES ===");

  const lead = await prisma.user.findUnique({
    where: { email: "lead@continuityx.demo" },
  });
  if (!lead) throw new Error("Seeded user lead@continuityx.demo not found.");

  const project = await prisma.project.findFirst({
    where: { name: "Smart Attendance System (Synthetic Demo)" },
  });
  if (!project) throw new Error("Synthetic demo project not found.");

  console.log(`Target project: "${project.name}" (${project.id})`);

  const devDir = path.resolve(process.cwd(), "demo-data", "dev");
  const docMap = new Map<string, string>(); // fileName -> docId

  for (const item of DEV_FILES) {
    const fileBuffer = await fs.readFile(path.join(devDir, item.fileName));
    const checksum = sha256(fileBuffer);

    let doc = await prisma.document.findFirst({
      where: { projectId: project.id, checksum, deletedAt: null },
    });

    if (!doc) {
      console.log(`- Uploading ${item.fileName}...`);
      doc = await uploadDocumentService({
        projectId: project.id,
        originalFileName: item.fileName,
        fileBuffer,
        reportedMimeType: item.mimeType,
        userProvidedDate: item.userProvidedDate ?? undefined,
        explicitUserId: lead.id,
      });
    } else {
      console.log(`- Found existing ${item.fileName} (${doc.id}, status: ${doc.processingStatus})`);
    }

    docMap.set(item.fileName, doc.id);

    // Advance through processing steps until terminal state
    let safetyCounter = 0;
    while (
      doc.processingStatus !== DocumentProcessingStatus.READY_FOR_AI &&
      doc.processingStatus !== DocumentProcessingStatus.VALIDATION_FAILED &&
      doc.processingStatus !== DocumentProcessingStatus.EXTRACTION_FAILED &&
      safetyCounter < 8
    ) {
      safetyCounter++;
      console.log(`  Advancing ${item.fileName} from ${doc.processingStatus}...`);
      await processDocumentNextStepService(project.id, doc.id, lead.id);
      doc = await prisma.document.findUniqueOrThrow({ where: { id: doc.id } });
    }
    console.log(`  ${item.fileName} status: ${doc.processingStatus}`);
  }

  // Check if claims already seeded
  const existingClaims = await prisma.claim.count({ where: { projectId: project.id } });
  if (existingClaims > 0) {
    console.log(`Claims already seeded (${existingClaims} claims).`);
  } else {
    console.log("\nSeeding canonical entities and ground truth claims...");
    const gtPath = path.join(devDir, "ground_truth.json");
    const gt = JSON.parse(await fs.readFile(gtPath, "utf-8"));

    const entityMap = new Map<string, string>(); // canonicalName -> entityId
    const claimIdMap = new Map<string, string>(); // gtId -> dbClaimId

    for (const ec of gt.expectedClaims) {
      let entityId = entityMap.get(ec.subject);
      if (!entityId) {
        let entity = await prisma.entity.findFirst({
          where: { projectId: project.id, canonicalName: ec.subject },
        });
        if (!entity) {
          entity = await prisma.entity.create({
            data: {
              projectId: project.id,
              canonicalName: ec.subject,
              normalizedId: ec.subject.toLowerCase().replace(/[^a-z0-9]/g, "_"),
              type: EntityType.COMPONENT,
            },
          });
        }
        entityId = entity.id;
        entityMap.set(ec.subject, entityId);
      }

      const docId = docMap.get(ec.document);
      const chunk = docId
        ? await prisma.documentChunk.findFirst({
            where: { documentId: docId },
            orderBy: { chunkIndex: "asc" },
          })
        : null;

      const category = ec.attributeKey === "owner" ? ClaimCategory.OWNERSHIP : ec.attributeKey === "selected_technology" ? ClaimCategory.DECISION : ec.attributeKey === "status" ? ClaimCategory.TASK : ClaimCategory.FACT;

      const claim = await prisma.claim.create({
        data: {
          projectId: project.id,
          subjectEntityId: entityId,
          attributeKey: ec.attributeKey,
          valueRaw: ec.valueNormalized || ec.excerpt,
          valueNormalized: ec.valueNormalized,
          category,
          reviewState: "PENDING",
          confidence: 0.95,
          evidence: docId && chunk
            ? {
                create: {
                  documentId: docId,
                  chunkId: chunk.id,
                  excerpt: ec.excerpt,
                  sourceLocation: ec.location,
                },
              }
            : undefined,
          verifications: {
            create: {
              status: (ec.expectedEvidenceStatus as EvidenceStatus) || EvidenceStatus.VERIFIED,
              sourceGate: GateOutcome.PASS,
              quoteGate: GateOutcome.PASS,
              contradictionGate: GateOutcome.PASS,
            },
          },
        },
      });

      claimIdMap.set(ec.id, claim.id);
    }

    // Seed conflicts
    console.log("Seeding pairwise conflicts...");
    for (const c of gt.expectedConflicts) {
      const claimAId = claimIdMap.get(c.claimIds[0]);
      const claimBId = claimIdMap.get(c.claimIds[1]);
      if (claimAId && claimBId) {
        const claimA = await prisma.claim.findUnique({ where: { id: claimAId } });
        if (claimA) {
          await prisma.conflict.create({
            data: {
              projectId: project.id,
              subjectEntityId: claimA.subjectEntityId,
              attributeKey: claimA.attributeKey,
              claimAId,
              claimBId,
              conflictType: (c.type as ConflictType) || ConflictType.STATUS_CONFLICT,
              status: c.expectedResolutionState === "POSSIBLY_SUPERSEDED" ? ConflictResolutionState.POSSIBLY_SUPERSEDED : ConflictResolutionState.OPEN,
            },
          });
        }
      }
    }
  }

  // Summary counts
  const [dCount, cCount, confCount, eCount] = await Promise.all([
    prisma.document.count({ where: { projectId: project.id } }),
    prisma.claim.count({ where: { projectId: project.id } }),
    prisma.conflict.count({ where: { projectId: project.id } }),
    prisma.entity.count({ where: { projectId: project.id } }),
  ]);

  console.log(`\n=== FINAL SEED STATUS for "${project.name}" ===`);
  console.log(`- Documents: ${dCount}`);
  console.log(`- Entities: ${eCount}`);
  console.log(`- Claims: ${cCount}`);
  console.log(`- Conflicts: ${confCount}`);
}

seedDemoWorkspace()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
