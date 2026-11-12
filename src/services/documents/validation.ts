import crypto from "crypto";
import path from "path";
import JSZip from "jszip";
import { env } from "@/lib/env";
import { AppError } from "@/lib/api-response";

export const MAX_FILE_SIZE = env.MAX_DOCUMENT_SIZE_MB * 1024 * 1024;
export const MAX_PAGES_PROCESSED = env.MAX_DOCUMENT_PAGES;
export const MAX_FILES_PER_PROJECT = env.MAX_PROJECT_DOCUMENTS;

const ALLOWED_MIME_TYPES: Record<string, readonly string[]> = {
  ".pdf": ["application/pdf"],
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip",
    "application/octet-stream",
  ],
  ".csv": [
    "text/csv",
    "application/csv",
    "application/vnd.ms-excel",
    "text/plain",
  ],
};

export interface ValidatedFile {
  fileName: string;
  extension: string;
  mimeType: string;
  size: number;
  checksum: string;
}

export function computeSha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Decodes CSV bytes while stripping UTF-8 / UTF-16 BOMs and checking for binary data.
 */
export function decodeCsvText(buffer: Buffer): string {
  if (buffer.length === 0) {
    throw new AppError("BAD_REQUEST", "Uploaded CSV file is empty.", 400);
  }

  // UTF-8 BOM (EF BB BF)
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    const sliced = buffer.subarray(3);
    assertNoNullBytes(sliced);
    return sliced.toString("utf-8");
  }

  // UTF-16 LE BOM (FF FE)
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString("utf16le");
  }

  // UTF-16 BE BOM (FE FF) -> swap bytes then decode utf16le
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const body = Buffer.from(buffer.subarray(2));
    body.swap16();
    return body.toString("utf16le");
  }

  assertNoNullBytes(buffer);
  return buffer.toString("utf-8");
}

function assertNoNullBytes(buf: Buffer) {
  const sampleLen = Math.min(buf.length, 8192);
  for (let i = 0; i < sampleLen; i++) {
    if (buf[i] === 0x00) {
      throw new AppError(
        "BAD_REQUEST",
        "Invalid CSV file. File contains binary null bytes and cannot be parsed as text.",
        400
      );
    }
  }
}

export async function validateDocumentFile(
  originalName: string,
  buffer: Buffer,
  reportedMimeType?: string | null,
  maxFileSizeBytes: number = MAX_FILE_SIZE
): Promise<ValidatedFile> {
  if (!buffer || buffer.length === 0) {
    throw new AppError("BAD_REQUEST", "Uploaded file is empty.", 400);
  }

  if (buffer.length > maxFileSizeBytes) {
    const maxMb = (maxFileSizeBytes / (1024 * 1024)).toFixed(0);
    throw new AppError(
      "BAD_REQUEST",
      `File size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds the maximum limit of ${maxMb} MB.`,
      400
    );
  }

  const ext = path.extname(originalName).toLowerCase();
  const allowedExtensions = Object.keys(ALLOWED_MIME_TYPES);

  if (!allowedExtensions.includes(ext)) {
    throw new AppError(
      "BAD_REQUEST",
      `Unsupported file type '${ext || "(none)"}'. Only PDF (.pdf), Word (.docx), and CSV (.csv) documents are supported.`,
      400
    );
  }

  // Validate reported MIME type if supplied (ignore empty / generic octet-stream only if signature passes, except reject mismatched explicit types)
  if (reportedMimeType && reportedMimeType.trim() !== "") {
    const normalizedMime = reportedMimeType.split(";")[0].trim().toLowerCase();
    const allowedMimes = ALLOWED_MIME_TYPES[ext];
    if (
      normalizedMime !== "application/octet-stream" &&
      !allowedMimes.includes(normalizedMime)
    ) {
      throw new AppError(
        "BAD_REQUEST",
        `File MIME type '${normalizedMime}' does not match extension '${ext}'.`,
        400
      );
    }
  }

  let canonicalMimeType = "application/octet-stream";

  if (ext === ".pdf") {
    // PDF Magic Bytes: %PDF (0x25 0x50 0x44 0x46)
    if (
      buffer.length < 5 ||
      buffer[0] !== 0x25 ||
      buffer[1] !== 0x50 ||
      buffer[2] !== 0x44 ||
      buffer[3] !== 0x46
    ) {
      throw new AppError(
        "BAD_REQUEST",
        "Corrupted or invalid PDF file. File signature does not match standard %PDF header.",
        400
      );
    }
    canonicalMimeType = "application/pdf";
  } else if (ext === ".docx") {
    // DOCX is a zip archive starting with PK\x03\x04 and containing word/document.xml
    if (
      buffer.length < 4 ||
      buffer[0] !== 0x50 ||
      buffer[1] !== 0x4b ||
      buffer[2] !== 0x03 ||
      buffer[3] !== 0x04
    ) {
      throw new AppError(
        "BAD_REQUEST",
        "Corrupted or invalid DOCX file. File signature does not match ZIP/OfficeOpenXML header.",
        400
      );
    }

    try {
      const zip = await JSZip.loadAsync(buffer);
      if (!zip.file("word/document.xml")) {
        throw new AppError(
          "BAD_REQUEST",
          "Invalid DOCX archive. Archive does not contain 'word/document.xml'.",
          400
        );
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        "BAD_REQUEST",
        "Corrupted DOCX file. Unable to read Office Open XML archive.",
        400
      );
    }

    canonicalMimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  } else if (ext === ".csv") {
    const decoded = decodeCsvText(buffer);
    if (decoded.trim().length === 0) {
      throw new AppError("BAD_REQUEST", "Uploaded CSV file contains no data.", 400);
    }
    canonicalMimeType = "text/csv";
  }

  const sanitizedFileName = path.basename(originalName).replace(/[^\w\s.-]/gi, "_");
  const checksum = computeSha256(buffer);

  return {
    fileName: sanitizedFileName,
    extension: ext,
    mimeType: canonicalMimeType,
    size: buffer.length,
    checksum,
  };
}
