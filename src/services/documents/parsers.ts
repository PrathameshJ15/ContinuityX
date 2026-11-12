import { extractText } from "unpdf";
import mammoth from "mammoth";
import Papa from "papaparse";
import { TextQuality } from "@prisma/client";
import { AppError } from "@/lib/api-response";
import { decodeCsvText, MAX_PAGES_PROCESSED } from "./validation";

export interface ParsedSegment {
  content: string;
  pageNumber?: number;
  sectionTitle?: string;
  rowStart?: number;
  rowEnd?: number;
}

export interface ParseResult {
  pageCount: number;
  segments: ParsedSegment[];
  textQuality: TextQuality;
  rawTextLength: number;
}

export interface DocumentParser {
  readonly supportedMimeTypes: readonly string[];
  parse(buffer: Buffer): Promise<ParseResult>;
}

/**
 * Evaluates extracted text quality based on characters per page and printable text ratio.
 * Never runs OCR; flags low-text or suspected scanned documents for human review.
 */
export function evaluateTextQuality(
  totalLength: number,
  pageCount: number,
  rawText: string
): TextQuality {
  const trimmed = rawText.trim();
  if (totalLength === 0 || trimmed.length === 0) {
    return TextQuality.SCANNED_SUSPECTED;
  }

  // Count standard printable characters vs replacement/control/garbage chars
  const printableMatches = trimmed.match(/[\p{L}\p{N}\s\p{P}\p{S}]/gu);
  const replacementMatches = trimmed.match(/\uFFFD/g);
  const printableCount = (printableMatches ? printableMatches.length : 0) - (replacementMatches ? replacementMatches.length : 0);
  const printableRatio = printableCount / Math.max(1, trimmed.length);

  const avgCharsPerPage = trimmed.length / Math.max(1, pageCount);

  // If average characters per page is very low (< 60), likely a scanned image PDF
  if (avgCharsPerPage < 60) {
    return TextQuality.SCANNED_SUSPECTED;
  }

  // If printable character ratio is low or text is sparse (< 120 chars/page), flag LOW_TEXT
  if (printableRatio < 0.75 || avgCharsPerPage < 120) {
    return TextQuality.LOW_TEXT;
  }

  return TextQuality.OK;
}

export class PdfDocumentParser implements DocumentParser {
  readonly supportedMimeTypes = ["application/pdf"] as const;

  async parse(buffer: Buffer): Promise<ParseResult> {
    try {
      const { totalPages, text } = await extractText(new Uint8Array(buffer), {
        mergePages: false,
      });

      const resolvedTotalPages = totalPages || 1;
      if (resolvedTotalPages > MAX_PAGES_PROCESSED) {
        throw new AppError(
          "BAD_REQUEST",
          `PDF has ${resolvedTotalPages} pages, which exceeds the processing limit of ${MAX_PAGES_PROCESSED} pages.`,
          400
        );
      }

      const pages = Array.isArray(text) ? text : [text];
      const segments: ParsedSegment[] = [];
      let combinedText = "";

      pages.forEach((pageText, idx) => {
        const pageNumber = idx + 1;
        const cleanText = (pageText ?? "").trim();
        combinedText += cleanText + "\n";

        if (cleanText.length > 0) {
          segments.push({
            content: cleanText,
            pageNumber,
          });
        }
      });

      const textQuality = evaluateTextQuality(combinedText.trim().length, resolvedTotalPages, combinedText);

      return {
        pageCount: resolvedTotalPages,
        segments,
        textQuality,
        rawTextLength: combinedText.trim().length,
      };
    } catch (err: unknown) {
      if (err instanceof AppError) throw err;

      const errorStr = String(err).toLowerCase();
      const errorName = err instanceof Error ? err.name.toLowerCase() : "";
      const rawPrefix = buffer.subarray(0, Math.min(buffer.length, 65536)).toString("latin1");

      if (
        errorStr.includes("password") ||
        errorStr.includes("encrypted") ||
        errorName.includes("password") ||
        rawPrefix.includes("/Encrypt")
      ) {
        throw new AppError(
          "BAD_REQUEST",
          "Password-protected PDF files cannot be processed. Please provide an unencrypted version.",
          400
        );
      }

      throw new AppError(
        "BAD_REQUEST",
        "Failed to parse PDF document. The file may be corrupted or invalid.",
        400
      );
    }
  }
}

export class DocxDocumentParser implements DocumentParser {
  readonly supportedMimeTypes = [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ] as const;

  async parse(buffer: Buffer): Promise<ParseResult> {
    try {
      const result = await mammoth.convertToHtml({ buffer });
      const html = result.value;

      const segments: ParsedSegment[] = [];
      let combinedText = "";

      // Extract headings (h1-h6) and paragraphs/list items; never invent section titles
      const blockRegex = /<(h[1-6]|p|li)[^>]*>(.*?)<\/\1>/gis;
      let currentSection: string | undefined = undefined;
      let match: RegExpExecArray | null;
      let bufferParagraphs: string[] = [];

      while ((match = blockRegex.exec(html)) !== null) {
        const tag = match[1].toLowerCase();
        const content = decodeHtmlEntities(match[2].replace(/<[^>]+>/g, "")).trim();

        if (!content) continue;

        if (tag.startsWith("h")) {
          if (bufferParagraphs.length > 0) {
            const sectionContent = bufferParagraphs.join("\n\n");
            segments.push({
              content: sectionContent,
              ...(currentSection ? { sectionTitle: currentSection } : {}),
            });
            combinedText += sectionContent + "\n";
            bufferParagraphs = [];
          }
          currentSection = content;
        } else {
          bufferParagraphs.push(content);
        }
      }

      if (bufferParagraphs.length > 0) {
        const sectionContent = bufferParagraphs.join("\n\n");
        segments.push({
          content: sectionContent,
          ...(currentSection ? { sectionTitle: currentSection } : {}),
        });
        combinedText += sectionContent + "\n";
      }

      // Fallback if HTML produced no blocks
      if (segments.length === 0) {
        const raw = await mammoth.extractRawText({ buffer });
        const rawText = raw.value.trim();
        if (rawText) {
          segments.push({
            content: rawText,
          });
          combinedText = rawText;
        }
      }

      const textQuality = evaluateTextQuality(combinedText.trim().length, 1, combinedText);

      return {
        pageCount: 1,
        segments,
        textQuality,
        rawTextLength: combinedText.trim().length,
      };
    } catch (err: unknown) {
      throw new AppError(
        "BAD_REQUEST",
        `Failed to parse DOCX document: ${err instanceof Error ? err.message : "Invalid Word file"}`,
        400
      );
    }
  }
}

export class CsvDocumentParser implements DocumentParser {
  readonly supportedMimeTypes = ["text/csv"] as const;

  async parse(buffer: Buffer): Promise<ParseResult> {
    try {
      const csvString = decodeCsvText(buffer);
      const parsed = Papa.parse<string[]>(csvString, {
        skipEmptyLines: true,
      });

      if (parsed.errors.length > 0 && parsed.data.length === 0) {
        throw new AppError("BAD_REQUEST", `Failed to parse CSV: ${parsed.errors[0].message}`, 400);
      }

      const rows = parsed.data;
      if (rows.length === 0) {
        return {
          pageCount: 1,
          segments: [],
          textQuality: TextQuality.LOW_TEXT,
          rawTextLength: 0,
        };
      }

      const header = rows[0].map((cell) => cell.trim()).join(", ");
      const segments: ParsedSegment[] = [];
      const BATCH_SIZE = 20;

      // Data rows start at 1-based row 2 (row 1 is header)
      let currentIdx = 1;
      while (currentIdx < rows.length) {
        const endIdx = Math.min(currentIdx + BATCH_SIZE, rows.length);
        const rowSlice = rows.slice(currentIdx, endIdx);
        const rowStart = currentIdx + 1;
        const rowEnd = endIdx;

        const formattedLines = [
          `Columns: ${header}`,
          ...rowSlice.map((r, i) => `Row ${rowStart + i}: ${r.map((c) => c.trim()).join(" | ")}`),
        ];

        segments.push({
          content: formattedLines.join("\n"),
          rowStart,
          rowEnd,
        });

        currentIdx = endIdx;
      }

      const textQuality = evaluateTextQuality(csvString.trim().length, 1, csvString);

      return {
        pageCount: 1,
        segments,
        textQuality,
        rawTextLength: csvString.trim().length,
      };
    } catch (err: unknown) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        "BAD_REQUEST",
        `Failed to parse CSV file: ${err instanceof Error ? err.message : "Invalid formatting"}`,
        400
      );
    }
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

const pdfParser = new PdfDocumentParser();
const docxParser = new DocxDocumentParser();
const csvParser = new CsvDocumentParser();

export function getParserForMimeType(mimeType: string): DocumentParser {
  if (mimeType === "application/pdf") return pdfParser;
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return docxParser;
  }
  if (mimeType === "text/csv") return csvParser;
  throw new AppError("BAD_REQUEST", `Unsupported MIME type: ${mimeType}`, 400);
}

export async function parsePdfDocument(buffer: Buffer): Promise<ParseResult> {
  return pdfParser.parse(buffer);
}

export async function parseDocxDocument(buffer: Buffer): Promise<ParseResult> {
  return docxParser.parse(buffer);
}

export async function parseCsvDocument(buffer: Buffer): Promise<ParseResult> {
  return csvParser.parse(buffer);
}
