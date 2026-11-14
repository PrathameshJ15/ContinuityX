import { prisma } from "../src/lib/db";

async function inspectDoc() {
  const doc = await prisma.document.findFirst({
    where: { fileName: "ContinuityX_Sample_Project_Handover.docx" },
    include: {
      chunks: true,
      processingJobs: true,
      extractionRuns: true,
    }
  });

  if (!doc) {
    console.log("Document not found!");
    return;
  }

  console.log("Document ID:", doc.id);
  console.log("Processing Status:", doc.processingStatus);
  console.log("Text Quality:", doc.textQuality);
  console.log("Source Date:", doc.sourceDate, doc.sourceDateBasis);
  console.log("Chunks Count:", doc.chunks.length);
  for (const c of doc.chunks) {
    console.log(`- Chunk #${c.chunkIndex} (ID: ${c.id}, len: ${c.content.length}): "${c.content.slice(0, 100)}..."`);
  }
  console.log("Extraction Runs:", doc.runs.length);
  for (const r of doc.runs) {
    console.log(`- Run ${r.id}: status=${r.status}, model=${r.model}, error=${r.error}`);
  }
}

inspectDoc().catch(console.error).finally(() => prisma.$disconnect());
