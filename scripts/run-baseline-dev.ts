import fs from "node:fs/promises";
import path from "node:path";
import { getParserForMimeType } from "../src/services/documents/parsers";

const BASELINE_PROMPT =
  "Analyse supplied project documents; produce a structured project summary; identify decisions, tasks, owners and risks; cite supporting source documents and locations; explicitly list contradictions and inconsistencies.";

const DEV_FILES: Array<{ fileName: string; mimeType: string }> = [
  {
    fileName: "design_doc.pdf",
    mimeType: "application/pdf",
  },
  {
    fileName: "meeting_notes.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  {
    fileName: "task_tracker.csv",
    mimeType: "text/csv",
  },
  {
    fileName: "chat_export.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  {
    fileName: "scanned_notes.pdf",
    mimeType: "application/pdf",
  },
];

async function collectDevDocumentsText() {
  const devDir = path.resolve(process.cwd(), "demo-data", "dev");
  const sections: string[] = [];

  for (const item of DEV_FILES) {
    const filePath = path.join(devDir, item.fileName);
    const buffer = await fs.readFile(filePath);
    const parser = getParserForMimeType(item.mimeType);
    const parsed = await parser.parse(buffer);

    const formattedSegments = parsed.segments
      .map((seg) => {
        const locParts: string[] = [];
        if (seg.pageNumber !== undefined) locParts.push(`Page ${seg.pageNumber}`);
        if (seg.sectionTitle) locParts.push(`Section: ${seg.sectionTitle}`);
        if (seg.rowStart !== undefined && seg.rowEnd !== undefined) {
          locParts.push(`Rows ${seg.rowStart}-${seg.rowEnd}`);
        }
        const location = locParts.length > 0 ? locParts.join(" | ") : "Unspecified location";
        return `[${location}]\n${seg.content}`;
      })
      .join("\n\n");

    sections.push(
      `=== DOCUMENT: ${item.fileName} (textQuality=${parsed.textQuality}, pages=${parsed.pageCount}) ===\n${formattedSegments || "(No extractable text)"}`,
    );
  }

  return sections.join("\n\n");
}

async function main() {
  try {
    process.loadEnvFile?.();
  } catch {
    // .env may not exist in CI or when env vars are passed directly
  }

  const documentsText = await collectDevDocumentsText();
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    console.log("[Baseline] Skipped: GEMINI_API_KEY is not configured.");
    console.log(`[Baseline] Parsed ${DEV_FILES.length} DEV documents successfully.`);
    return;
  }

  const model = process.env.GEMINI_EXTRACTION_MODEL?.trim() || "gemini-3.5-flash-lite";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent`;

  const response = await fetch(endpoint, {
    method: "POST",
    signal: AbortSignal.timeout(60000),
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${BASELINE_PROMPT}\n\n---\nPROJECT DOCUMENTS\n---\n\n${documentsText}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
      },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Gemini API request failed (${response.status}): ${errBody}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const outputText =
    payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("\n") ?? "";

  const resultsDir = path.resolve(process.cwd(), "benchmark", "results");
  await fs.mkdir(resultsDir, { recursive: true });

  const runDate = new Date().toISOString();
  const record = {
    dataset: "DEV",
    runDate,
    model,
    prompt: BASELINE_PROMPT,
    documents: DEV_FILES.map((d) => d.fileName),
    rawOutput: outputText,
  };

  await fs.writeFile(
    path.join(resultsDir, "dev-baseline.json"),
    JSON.stringify(record, null, 2),
    "utf8",
  );
  await fs.writeFile(
    path.join(resultsDir, "dev-baseline.md"),
    `# DEV Baseline Run\n\n- **Date:** ${runDate}\n- **Model:** ${model}\n- **Prompt:** ${BASELINE_PROMPT}\n\n## Output\n\n${outputText}\n`,
    "utf8",
  );

  console.log(`[Baseline] Completed DEV baseline run using ${model} -> benchmark/results/dev-baseline.json`);
}

main().catch((err) => {
  console.error("[Baseline] Failed:", err);
  process.exit(1);
});
