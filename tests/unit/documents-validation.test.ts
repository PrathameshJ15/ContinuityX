// @vitest-environment node
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import {
  validateDocumentFile,
  decodeCsvText,
  computeSha256,
} from "@/services/documents/validation";
import { AppError } from "@/lib/api-response";

async function createMinimalDocxBuffer(includeDocumentXml: boolean = true): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<Types></Types>");
  if (includeDocumentXml) {
    zip.file("word/document.xml", "<w:document><w:body><w:p><w:r><w:t>Hello</w:t></w:r></w:p></w:body></w:document>");
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

describe("Phase 2 Document Validation & Signature Checks", () => {
  it("rejects empty file buffer", async () => {
    await expect(
      validateDocumentFile("notes.pdf", Buffer.alloc(0), "application/pdf")
    ).rejects.toThrow("Uploaded file is empty");
  });

  it("rejects unsupported file extension", async () => {
    await expect(
      validateDocumentFile("malware.exe", Buffer.from("MZ1234"), "application/octet-stream")
    ).rejects.toThrow("Unsupported file type '.exe'");
  });

  it("rejects spoofed MIME type that mismatches extension", async () => {
    await expect(
      validateDocumentFile("report.pdf", Buffer.from("%PDF-1.4\ntest"), "text/csv")
    ).rejects.toThrow("does not match extension '.pdf'");
  });

  it("rejects file exceeding configured size limit", async () => {
    const buf = Buffer.from("%PDF-1.4\n" + "A".repeat(2048));
    await expect(
      validateDocumentFile("huge.pdf", buf, "application/pdf", 1024)
    ).rejects.toThrow("exceeds the maximum limit");
  });

  it("rejects corrupted PDF lacking %PDF magic bytes", async () => {
    const fakePdf = Buffer.from("<html><body>Not a PDF</body></html>");
    await expect(
      validateDocumentFile("fake.pdf", fakePdf, "application/pdf")
    ).rejects.toThrow("does not match standard %PDF header");
  });

  it("accepts valid PDF header and returns SHA-256 checksum & sanitized name", async () => {
    const validPdf = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj");
    const res = await validateDocumentFile("../../secret?.pdf", validPdf, "application/pdf");
    expect(res.extension).toBe(".pdf");
    expect(res.mimeType).toBe("application/pdf");
    expect(res.size).toBe(validPdf.length);
    expect(res.checksum).toBe(computeSha256(validPdf));
    expect(res.fileName).not.toContain("..");
    expect(res.fileName).not.toContain("/");
  });

  it("rejects invalid DOCX lacking ZIP header", async () => {
    const badDocx = Buffer.from("NOT A ZIP FILE");
    await expect(
      validateDocumentFile(
        "bad.docx",
        badDocx,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
    ).rejects.toThrow("does not match ZIP/OfficeOpenXML header");
  });

  it("rejects ZIP disguised as DOCX without word/document.xml", async () => {
    const zipWithoutDoc = await createMinimalDocxBuffer(false);
    await expect(
      validateDocumentFile(
        "spoof.docx",
        zipWithoutDoc,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
    ).rejects.toThrow("does not contain 'word/document.xml'");
  });

  it("accepts valid DOCX archive with word/document.xml", async () => {
    const docx = await createMinimalDocxBuffer(true);
    const res = await validateDocumentFile(
      "notes.docx",
      docx,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(res.mimeType).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(res.extension).toBe(".docx");
  });

  it("rejects CSV with binary null bytes", async () => {
    const binaryCsv = Buffer.from([0x61, 0x2c, 0x62, 0x00, 0x63]);
    await expect(validateDocumentFile("binary.csv", binaryCsv, "text/csv")).rejects.toBeInstanceOf(
      AppError
    );
    expect(() => decodeCsvText(binaryCsv)).toThrow("binary null bytes");
  });

  it("rejects whitespace-only CSV", async () => {
    await expect(
      validateDocumentFile("blank.csv", Buffer.from("   \r\n  \t "), "text/csv")
    ).rejects.toThrow("contains no data");
  });

  it("decodes UTF-8 BOM, UTF-16 LE BOM, and UTF-16 BE BOM CSVs cleanly", () => {
    const utf8Bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("id,name\n1,Alice", "utf8")]);
    expect(decodeCsvText(utf8Bom)).toBe("id,name\n1,Alice");

    const utf16Le = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("id,name", "utf16le")]);
    expect(decodeCsvText(utf16Le)).toBe("id,name");

    const leBody = Buffer.from("id,name", "utf16le");
    leBody.swap16();
    const utf16Be = Buffer.concat([Buffer.from([0xfe, 0xff]), leBody]);
    expect(decodeCsvText(utf16Be)).toBe("id,name");
  });
});
