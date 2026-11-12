import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from "pdf-lib";
import { AssembledHandover } from "./sections";

/**
 * Sanitizes strings for safe PDF rendering with StandardFonts (ASCII + WinAnsi)
 * Strips non-printable control characters and unsupported Unicode glyphs
 */
function sanitizePdfText(input?: string | null): string {
  if (!input) return "";
  return input
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\x20-\x7E]/g, "?")
    .trim();
}

/**
 * Wraps text to fit within a given pixel width
 */
function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, fontSize);

    if (width <= maxWidth) {
      currentLine = candidate;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [""];
}

export interface PdfExportOptions {
  handover: AssembledHandover;
  receipt?: {
    snapshotHash: string;
    previousReceiptHash: string | null;
    approvedBy: string;
    approvedAt: string;
    canonicalisationVersion: number;
  };
}

/**
 * Deterministically generates a Proof-Carrying Handover PDF from the stored snapshot.
 * pure JS via pdf-lib, runs in all serverless environments without native dependencies.
 */
export async function generateHandoverPdf(options: PdfExportOptions): Promise<Uint8Array> {
  const { handover, receipt } = options;

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const PAGE_WIDTH = 595.28; // A4 standard width in points
  const PAGE_HEIGHT = 841.89; // A4 standard height in points
  const MARGIN_LEFT = 40;
  const MARGIN_RIGHT = 40;
  const MARGIN_TOP = 50;
  const MARGIN_BOTTOM = 50;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

  let currentPage: PDFPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursorY = PAGE_HEIGHT - MARGIN_TOP;

  function checkPageBreak(requiredHeight: number) {
    if (cursorY - requiredHeight < MARGIN_BOTTOM) {
      currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      cursorY = PAGE_HEIGHT - MARGIN_TOP;
      drawPageHeader();
    }
  }

  function drawPageHeader() {
    currentPage.drawText(sanitizePdfText(`ContinuityX | Project Handover: ${handover.title}`), {
      x: MARGIN_LEFT,
      y: PAGE_HEIGHT - 30,
      size: 8,
      font: fontRegular,
      color: rgb(0.4, 0.4, 0.4),
    });

    currentPage.drawLine({
      start: { x: MARGIN_LEFT, y: PAGE_HEIGHT - 35 },
      end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: PAGE_HEIGHT - 35 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
  }

  // Draw Document Cover Header
  drawPageHeader();

  currentPage.drawText(sanitizePdfText(handover.title || "Project Handover"), {
    x: MARGIN_LEFT,
    y: cursorY,
    size: 20,
    font: fontBold,
    color: rgb(0.08, 0.12, 0.2),
  });
  cursorY -= 24;

  currentPage.drawText(
    sanitizePdfText(
      `Version ${handover.version} | Generated: ${new Date(handover.generatedAt).toUTCString()} | Project: ${handover.projectId}`
    ),
    {
      x: MARGIN_LEFT,
      y: cursorY,
      size: 9,
      font: fontRegular,
      color: rgb(0.4, 0.4, 0.4),
    }
  );
  cursorY -= 20;

  // Draw Cryptographic Receipt Box
  if (receipt) {
    const boxHeight = 70;
    checkPageBreak(boxHeight + 15);

    currentPage.drawRectangle({
      x: MARGIN_LEFT,
      y: cursorY - boxHeight,
      width: CONTENT_WIDTH,
      height: boxHeight,
      color: rgb(0.96, 0.98, 1.0),
      borderColor: rgb(0.7, 0.8, 0.95),
      borderWidth: 1,
    });

    currentPage.drawText("CRYPTOGRAPHIC APPROVAL RECEIPT (SHA-256)", {
      x: MARGIN_LEFT + 10,
      y: cursorY - 14,
      size: 9,
      font: fontBold,
      color: rgb(0.1, 0.3, 0.6),
    });

    currentPage.drawText(`Snapshot Hash: ${sanitizePdfText(receipt.snapshotHash)}`, {
      x: MARGIN_LEFT + 10,
      y: cursorY - 28,
      size: 8,
      font: fontRegular,
      color: rgb(0.1, 0.1, 0.1),
    });

    currentPage.drawText(
      `Approved By: ${sanitizePdfText(receipt.approvedBy)}  |  Approved At: ${new Date(receipt.approvedAt).toUTCString()}  |  Prev: ${receipt.previousReceiptHash ? receipt.previousReceiptHash.slice(0, 16) + "..." : "Genesis (v1)"}`,
      {
        x: MARGIN_LEFT + 10,
        y: cursorY - 42,
        size: 8,
        font: fontRegular,
        color: rgb(0.3, 0.3, 0.3),
      }
    );

    currentPage.drawText(
      "Notice: SHA-256 snapshot hash represents an integrity fingerprint, not a digital identity signature.",
      {
        x: MARGIN_LEFT + 10,
        y: cursorY - 56,
        size: 7,
        font: fontItalic,
        color: rgb(0.5, 0.5, 0.5),
      }
    );

    cursorY -= boxHeight + 25;
  }

  // Draw All 14 Sections
  for (const section of handover.sections) {
    checkPageBreak(40);

    // Section Header
    currentPage.drawText(sanitizePdfText(section.title), {
      x: MARGIN_LEFT,
      y: cursorY,
      size: 13,
      font: fontBold,
      color: rgb(0.12, 0.18, 0.3),
    });
    cursorY -= 14;

    currentPage.drawText(sanitizePdfText(section.description), {
      x: MARGIN_LEFT,
      y: cursorY,
      size: 8.5,
      font: fontItalic,
      color: rgb(0.45, 0.45, 0.45),
    });
    cursorY -= 16;

    if (!section.hasContent || section.items.length === 0) {
      checkPageBreak(18);
      currentPage.drawText(`[ ${section.emptyNotice || "No approved information"} ]`, {
        x: MARGIN_LEFT + 10,
        y: cursorY,
        size: 9,
        font: fontItalic,
        color: rgb(0.6, 0.6, 0.6),
      });
      cursorY -= 20;
      continue;
    }

    // Section Items
    for (const item of section.items) {
      const itemHeader = `${item.subject} -> ${item.attribute}: ${item.valueRaw}`;
      const headerLines = wrapText(sanitizePdfText(itemHeader), fontBold, 9.5, CONTENT_WIDTH - 15);
      const statusText = `[Status: ${item.evidenceStatus}] [Review: ${item.reviewState}]${item.reviewerReason ? ` (Reason: ${item.reviewerReason})` : ""}`;
      const statusLines = wrapText(sanitizePdfText(statusText), fontRegular, 8, CONTENT_WIDTH - 20);

      let evidenceHeight = 0;
      const evLineGroups: string[][] = [];
      for (const ev of item.evidence) {
        const evText = `Excerpt (${ev.fileName || "Doc"}, ${ev.location}): "${ev.excerpt}"`;
        const evLines = wrapText(sanitizePdfText(evText), fontItalic, 7.5, CONTENT_WIDTH - 30);
        evLineGroups.push(evLines);
        evidenceHeight += evLines.length * 10 + 4;
      }

      const totalItemHeight =
        headerLines.length * 12 + statusLines.length * 10 + evidenceHeight + 14;

      checkPageBreak(totalItemHeight);

      // Draw item card border & background
      currentPage.drawRectangle({
        x: MARGIN_LEFT + 5,
        y: cursorY - totalItemHeight + 6,
        width: CONTENT_WIDTH - 10,
        height: totalItemHeight,
        color: rgb(0.99, 0.99, 0.99),
        borderColor: rgb(0.88, 0.88, 0.88),
        borderWidth: 0.5,
      });

      let itemY = cursorY - 10;

      // Draw header lines
      for (const hl of headerLines) {
        currentPage.drawText(hl, {
          x: MARGIN_LEFT + 12,
          y: itemY,
          size: 9.5,
          font: fontBold,
          color: rgb(0.1, 0.1, 0.15),
        });
        itemY -= 12;
      }

      // Draw status lines
      for (const sl of statusLines) {
        currentPage.drawText(sl, {
          x: MARGIN_LEFT + 15,
          y: itemY,
          size: 8,
          font: fontRegular,
          color: rgb(0.2, 0.4, 0.2),
        });
        itemY -= 10;
      }

      // Draw evidence excerpts
      for (const evLines of evLineGroups) {
        itemY -= 2;
        for (const el of evLines) {
          currentPage.drawText(el, {
            x: MARGIN_LEFT + 22,
            y: itemY,
            size: 7.5,
            font: fontItalic,
            color: rgb(0.35, 0.35, 0.35),
          });
          itemY -= 10;
        }
      }

      cursorY -= totalItemHeight + 6;
    }

    cursorY -= 10;
  }

  // Draw Page Footers (Page X of Y)
  const totalPages = pdfDoc.getPageCount();
  for (let i = 0; i < totalPages; i++) {
    const page = pdfDoc.getPage(i);
    const footerText = sanitizePdfText(
      `ContinuityX Proof-Carrying Handover  |  Page ${i + 1} of ${totalPages}`
    );
    const textWidth = fontRegular.widthOfTextAtSize(footerText, 8);

    page.drawText(footerText, {
      x: (PAGE_WIDTH - textWidth) / 2,
      y: 20,
      size: 8,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  return await pdfDoc.save();
}
