import { performance } from "perf_hooks";
import fs from "fs/promises";
import path from "path";
import { parsePdfDocument, parseDocxDocument, parseCsvDocument } from "../src/services/documents/parsers";
import { createStructureAwareChunks } from "../src/services/documents/chunking";
import { prisma } from "../src/lib/db";
import { verifyAllProjectClaimsService } from "../src/services/verification";

async function main() {
  console.log("=== PHASE 7 PERFORMANCE BENCHMARK ===");

  // 1. Parsing performance
  const devDir = path.resolve(process.cwd(), "demo-data", "dev");
  const pdfBuf = await fs.readFile(path.join(devDir, "design_doc.pdf"));
  const docxBuf = await fs.readFile(path.join(devDir, "meeting_notes.docx"));
  const csvBuf = await fs.readFile(path.join(devDir, "task_tracker.csv"));

  const t0 = performance.now();
  const pdfParsed = await parsePdfDocument(pdfBuf);
  const tPdf = performance.now() - t0;

  const t1 = performance.now();
  const docxParsed = await parseDocxDocument(docxBuf);
  const tDocx = performance.now() - t1;

  const t2 = performance.now();
  const csvParsed = await parseCsvDocument(csvBuf);
  const tCsv = performance.now() - t2;

  console.log(`Document Parsing:`);
  console.log(`- PDF (design_doc.pdf): ${tPdf.toFixed(2)}ms (${pdfParsed.segments.length} segments, ${pdfParsed.rawTextLength} chars)`);
  console.log(`- DOCX (meeting_notes.docx): ${tDocx.toFixed(2)}ms (${docxParsed.segments.length} segments, ${docxParsed.rawTextLength} chars)`);
  console.log(`- CSV (task_tracker.csv): ${tCsv.toFixed(2)}ms (${csvParsed.segments.length} segments, ${csvParsed.rawTextLength} chars)`);

  // 2. Chunking performance
  const t3 = performance.now();
  const pdfChunks = createStructureAwareChunks(pdfParsed.segments);
  const docxChunks = createStructureAwareChunks(docxParsed.segments);
  const csvChunks = createStructureAwareChunks(csvParsed.segments);
  const tChunking = performance.now() - t3;

  console.log(`\nStructure-Aware Chunking:`);
  console.log(`- Total chunking time: ${tChunking.toFixed(2)}ms`);
  console.log(`- PDF chunks: ${pdfChunks.length}, DOCX chunks: ${docxChunks.length}, CSV chunks: ${csvChunks.length}`);

  // 3. Database query & persistence roundtrip
  let project = null;
  let tDb = 0;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const tDb0 = performance.now();
      project = await prisma.project.findFirst({
        where: { name: { contains: "Smart Attendance" } },
        include: { _count: { select: { claims: true, documents: true, entities: true } } },
      });
      tDb = performance.now() - tDb0;
      break;
    } catch (err: unknown) {
      console.log(`[Database] Connect attempt ${attempt} failed, retrying in 2s...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  console.log(`\nDatabase Connectivity & Persistence Read:`);
  console.log(`- Query project '${project?.name}': ${tDb.toFixed(2)}ms`);
  console.log(`- Counts: ${project?._count.documents} docs, ${project?._count.claims} claims, ${project?._count.entities} entities`);

  // 4. Batch verification with prefetching & deduplication
  if (project) {
    const tVer0 = performance.now();
    const verResult = await verifyAllProjectClaimsService(project.id, {
      concurrency: 2,
    });
    const tVer = performance.now() - tVer0;
    console.log(`\nVerification Batch Optimization:`);
    console.log(`- Claims verified: ${verResult.summary.total}`);
    console.log(`- Total duration: ${(tVer / 1000).toFixed(2)}s`);
    console.log(`- Average per claim: ${(tVer / Math.max(1, verResult.summary.total)).toFixed(2)}ms`);
    console.log(`- Breakdown: ${JSON.stringify(verResult.summary)}`);
  }

  await prisma.$disconnect();
  console.log("\nBenchmark complete.");
}

main().catch((e) => {
  console.error("Benchmark error:", e);
  process.exit(1);
});
