// @vitest-environment node
import fs from "node:fs/promises";
import path from "node:path";
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { TextQuality } from "@prisma/client";
import {
  parsePdfDocument,
  parseDocxDocument,
  parseCsvDocument,
  evaluateTextQuality,
} from "@/services/documents/parsers";
import { validateDocumentFile } from "@/services/documents/validation";
import { createStructureAwareChunks } from "@/services/documents/chunking";

const DEV_DIR = path.resolve(process.cwd(), "demo-data", "dev");
const MALFORMED_DIR = path.resolve(process.cwd(), "demo-data", "dev-malformed");

async function buildDocxWithXml(documentXml: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
    </Types>`
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
    </Relationships>`
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>${documentXml}</w:body>
    </w:document>`
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

describe("Phase 2 Parsers, Structure-Aware Chunking & DEV Fixtures", () => {
  describe("DEV Dataset Parsing & Fidelity", () => {
    it("parses design_doc.pdf with true page numbers and OK text quality", async () => {
      const buf = await fs.readFile(path.join(DEV_DIR, "design_doc.pdf"));
      const parsed = await parsePdfDocument(buf);

      expect(parsed.pageCount).toBeGreaterThanOrEqual(1);
      expect(parsed.textQuality).toBe(TextQuality.OK);
      expect(parsed.segments.length).toBeGreaterThanOrEqual(1);
      expect(parsed.segments[0].pageNumber).toBe(1);

      const allText = parsed.segments.map((s) => s.content).join("\n");
      expect(allText.length).toBeGreaterThan(100);
    });

    it("parses meeting_notes.docx preserving section headings cleanly", async () => {
      const buf = await fs.readFile(path.join(DEV_DIR, "meeting_notes.docx"));
      const parsed = await parseDocxDocument(buf);

      expect(parsed.textQuality).toBe(TextQuality.OK);
      expect(parsed.segments.length).toBeGreaterThanOrEqual(1);
      expect(parsed.segments.some((s) => typeof s.sectionTitle === "string" && s.sectionTitle.length > 0)).toBe(true);
    });

    it("parses chat_export.docx preserving raw untrusted text verbatim", async () => {
      const buf = await fs.readFile(path.join(DEV_DIR, "chat_export.docx"));
      const parsed = await parseDocxDocument(buf);

      expect(parsed.segments.length).toBeGreaterThanOrEqual(1);
      expect(parsed.rawTextLength).toBeGreaterThan(50);
    });

    it("parses task_tracker.csv with exact column headers and row ranges", async () => {
      const buf = await fs.readFile(path.join(DEV_DIR, "task_tracker.csv"));
      const parsed = await parseCsvDocument(buf);

      expect(parsed.textQuality).toBe(TextQuality.OK);
      expect(parsed.segments.length).toBeGreaterThanOrEqual(1);
      expect(parsed.segments[0].rowStart).toBe(2);
      expect(parsed.segments[0].rowEnd).toBeGreaterThanOrEqual(2);
      expect(parsed.segments[0].content).toContain("Columns:");
      expect(parsed.segments[0].content).toContain("Row 2:");
    });

    it("flags scanned_notes.pdf as SCANNED_SUSPECTED without fabricating OCR text", async () => {
      const buf = await fs.readFile(path.join(DEV_DIR, "scanned_notes.pdf"));
      const parsed = await parsePdfDocument(buf);

      expect(parsed.pageCount).toBeGreaterThanOrEqual(1);
      expect(parsed.textQuality).toBe(TextQuality.SCANNED_SUSPECTED);
    });

    it("has valid DEV ground_truth.json containing all required case IDs", async () => {
      const raw = await fs.readFile(path.join(DEV_DIR, "ground_truth.json"), "utf8");
      const gt = JSON.parse(raw) as {
        dataset?: string;
        cases?: Array<{ id: string }>;
        claims?: Array<{ id?: string; caseId?: string }>;
      };

      expect(gt).toBeDefined();
      const idsRaw = JSON.stringify(gt);
      for (const requiredCode of ["C1", "C2", "C3", "C4", "C5", "H1", "H2", "H3", "W1", "A1", "A2", "I1", "S1", "M1"]) {
        expect(idsRaw).toContain(requiredCode);
      }
    });
  });

  describe("DEV Malformed Fixtures Failure Modes", () => {
    it("rejects corrupted.pdf with a clear validation/parse error", async () => {
      const buf = await fs.readFile(path.join(MALFORMED_DIR, "corrupted.pdf"));
      await expect(validateDocumentFile("corrupted.pdf", buf, "application/pdf")).rejects.toThrow();
    });

    it("rejects password_protected.pdf with explicit password-protected error", async () => {
      const buf = await fs.readFile(path.join(MALFORMED_DIR, "password_protected.pdf"));
      await expect(parsePdfDocument(buf)).rejects.toThrow(
        "Password-protected PDF files cannot be processed"
      );
    });

    it("rejects empty.csv with explicit empty-file error", async () => {
      const buf = await fs.readFile(path.join(MALFORMED_DIR, "empty.csv"));
      await expect(validateDocumentFile("empty.csv", buf, "text/csv")).rejects.toThrow();
    });
  });

  describe("No Invented Locations & Quality Thresholds", () => {
    it("never invents sectionTitle for DOCX paragraphs appearing before any heading", async () => {
      const docxBuf = await buildDocxWithXml(
        `<w:p><w:r><w:t>Unheaded intro paragraph before any section.</w:t></w:r></w:p>`
      );
      const parsed = await parseDocxDocument(docxBuf);
      expect(parsed.segments).toHaveLength(1);
      expect(parsed.segments[0].sectionTitle).toBeUndefined();
      expect(parsed.segments[0].content).toContain("Unheaded intro paragraph");
    });

    it("evaluates OK, LOW_TEXT, and SCANNED_SUSPECTED deterministically", () => {
      expect(evaluateTextQuality(0, 1, "")).toBe(TextQuality.SCANNED_SUSPECTED);
      expect(evaluateTextQuality(30, 1, "Short sparse snippet.")).toBe(TextQuality.SCANNED_SUSPECTED);
      expect(evaluateTextQuality(90, 1, "A".repeat(90))).toBe(TextQuality.LOW_TEXT);
      expect(evaluateTextQuality(300, 1, "Normal document text. ".repeat(15))).toBe(TextQuality.OK);
    });
  });

  describe("Structure-Aware Chunking", () => {
    it("never crosses page boundaries or heading sections and preserves exact text", () => {
      const chunks = createStructureAwareChunks(
        [
          { content: "Page one fact A.", pageNumber: 1 },
          { content: "Page two fact B.", pageNumber: 2 },
          { content: "Auth uses JWT.", sectionTitle: "Architecture" },
          { content: "Latency budget 200ms.", sectionTitle: "SLO" },
          { content: "Columns: Task, Owner\nRow 2: Setup | Priya", rowStart: 2, rowEnd: 2 },
        ],
        2000
      );

      expect(chunks).toHaveLength(5);
      expect(chunks[0]).toMatchObject({ chunkIndex: 0, pageNumber: 1, content: "Page one fact A." });
      expect(chunks[1]).toMatchObject({ chunkIndex: 1, pageNumber: 2, content: "Page two fact B." });
      expect(chunks[2]).toMatchObject({ chunkIndex: 2, sectionTitle: "Architecture", content: "Auth uses JWT." });
      expect(chunks[3]).toMatchObject({ chunkIndex: 3, sectionTitle: "SLO", content: "Latency budget 200ms." });
      expect(chunks[4]).toMatchObject({ chunkIndex: 4, rowStart: 2, rowEnd: 2 });
    });

    it("splits oversized single segments while keeping exact words and location metadata", () => {
      const p1 = "Alpha paragraph sentence. ".repeat(60).trim();
      const p2 = "Beta paragraph sentence. ".repeat(60).trim();
      const p3 = "Gamma paragraph sentence. ".repeat(60).trim();

      const chunks = createStructureAwareChunks(
        [{ content: `${p1}\n\n${p2}\n\n${p3}`, pageNumber: 4 }],
        1800
      );

      expect(chunks.length).toBeGreaterThanOrEqual(2);
      for (const c of chunks) {
        expect(c.pageNumber).toBe(4);
      }
      const reconstructed = chunks.map((c) => c.content).join("\n\n");
      expect(reconstructed).toContain("Alpha paragraph sentence.");
      expect(reconstructed).toContain("Beta paragraph sentence.");
      expect(reconstructed).toContain("Gamma paragraph sentence.");
    });
  });
});
