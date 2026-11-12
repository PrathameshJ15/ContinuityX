import { ParsedSegment } from "./parsers";

export interface StructureChunk {
  chunkIndex: number;
  content: string;
  pageNumber?: number;
  sectionTitle?: string;
  rowStart?: number;
  rowEnd?: number;
  metadata?: Record<string, unknown>;
}

export const DEFAULT_CHUNK_SIZE = 2000; // Target ~1500-2500 characters

/**
 * Structure-aware chunking algorithm:
 * - PDF: Groups paragraphs within a page; never crosses page boundaries.
 * - DOCX: Groups paragraphs within the same heading section; never crosses section boundaries.
 * - CSV: Preserves row ranges and column headers.
 * - Original text is preserved verbatim without rewriting or summarization.
 */
export function createStructureAwareChunks(
  segments: ParsedSegment[],
  targetChunkSize: number = DEFAULT_CHUNK_SIZE
): StructureChunk[] {
  const chunks: StructureChunk[] = [];
  let chunkIndex = 0;

  for (const segment of segments) {
    const text = segment.content.trim();
    if (!text) continue;

    // Keep within target size + small buffer (2500 max when target is 2000)
    const maxAllowed = Math.max(targetChunkSize, Math.floor(targetChunkSize * 1.25));
    if (text.length <= maxAllowed) {
      chunks.push({
        chunkIndex: chunkIndex++,
        content: text,
        pageNumber: segment.pageNumber,
        sectionTitle: segment.sectionTitle,
        rowStart: segment.rowStart,
        rowEnd: segment.rowEnd,
      });
      continue;
    }

    // Split large segments by paragraph while preserving exact text and location tag
    const paragraphs = text.split(/\n\s*\n/);
    let currentBuffer: string[] = [];
    let currentLength = 0;

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;

      if (currentLength + trimmed.length > targetChunkSize && currentBuffer.length > 0) {
        chunks.push({
          chunkIndex: chunkIndex++,
          content: currentBuffer.join("\n\n"),
          pageNumber: segment.pageNumber,
          sectionTitle: segment.sectionTitle,
          rowStart: segment.rowStart,
          rowEnd: segment.rowEnd,
        });
        currentBuffer = [];
        currentLength = 0;
      }

      // If a single paragraph itself exceeds maxAllowed, split by lines without losing text
      if (trimmed.length > maxAllowed) {
        if (currentBuffer.length > 0) {
          chunks.push({
            chunkIndex: chunkIndex++,
            content: currentBuffer.join("\n\n"),
            pageNumber: segment.pageNumber,
            sectionTitle: segment.sectionTitle,
            rowStart: segment.rowStart,
            rowEnd: segment.rowEnd,
          });
          currentBuffer = [];
          currentLength = 0;
        }
        const lines = trimmed.split("\n");
        let lineBuf: string[] = [];
        let lineLen = 0;
        for (const line of lines) {
          if (lineLen + line.length > targetChunkSize && lineBuf.length > 0) {
            chunks.push({
              chunkIndex: chunkIndex++,
              content: lineBuf.join("\n"),
              pageNumber: segment.pageNumber,
              sectionTitle: segment.sectionTitle,
              rowStart: segment.rowStart,
              rowEnd: segment.rowEnd,
            });
            lineBuf = [];
            lineLen = 0;
          }
          lineBuf.push(line);
          lineLen += line.length + 1;
        }
        if (lineBuf.length > 0) {
          chunks.push({
            chunkIndex: chunkIndex++,
            content: lineBuf.join("\n"),
            pageNumber: segment.pageNumber,
            sectionTitle: segment.sectionTitle,
            rowStart: segment.rowStart,
            rowEnd: segment.rowEnd,
          });
        }
        continue;
      }

      currentBuffer.push(trimmed);
      currentLength += trimmed.length + 2;
    }

    if (currentBuffer.length > 0) {
      chunks.push({
        chunkIndex: chunkIndex++,
        content: currentBuffer.join("\n\n"),
        pageNumber: segment.pageNumber,
        sectionTitle: segment.sectionTitle,
        rowStart: segment.rowStart,
        rowEnd: segment.rowEnd,
      });
    }
  }

  return chunks;
}
