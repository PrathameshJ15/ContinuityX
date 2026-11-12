"use client";

import { useEffect, useState, use, useCallback } from "react";
import { formatDate } from "@/lib/date";
import {
  Upload,
  FileText,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Loader2,
  Eye,
  Calendar,
  X,
  Layers,
  Info,
  Download,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface DocumentItem {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  checksum: string;
  pageCount: number;
  textQuality: "OK" | "LOW_TEXT" | "SCANNED_SUSPECTED";
  sourceDate: string | null;
  sourceDateBasis: "USER_PROVIDED" | "CONTENT_EXPLICIT" | "UNKNOWN";
  processingStatus:
    | "UPLOADED"
    | "VALIDATING"
    | "EXTRACTING"
    | "CHUNKING"
    | "READY_FOR_AI"
    | "AI_PROCESSING"
    | "AI_COMPLETED"
    | "AI_PROCESSING_FAILED"
    | "VALIDATION_FAILED"
    | "EXTRACTION_FAILED";
  uploadedAt: string;
  chunkCount: number;
  uploadedBy: { name: string; email: string };
  lastJob: { state: string; attempts: number; lastError: string | null } | null;
}

interface DocumentChunk {
  id: string;
  chunkIndex: number;
  content: string;
  pageNumber: number | null;
  sectionTitle: string | null;
  rowStart: number | null;
  rowEnd: number | null;
}

interface ProjectData {
  id: string;
  name: string;
  currentUserRole: "OWNER" | "REVIEWER" | "VIEWER";
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const PIPELINE_STEPS = [
  { key: "UPLOADED", label: "Uploaded" },
  { key: "VALIDATING", label: "Validating" },
  { key: "EXTRACTING", label: "Extracting" },
  { key: "CHUNKING", label: "Chunking" },
  { key: "READY_FOR_AI", label: "Ready" },
] as const;

function getStepIndex(status: DocumentItem["processingStatus"]): number {
  const idx = PIPELINE_STEPS.findIndex((s) => s.key === status);
  return idx;
}

export default function DocumentsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.projectId;

  const [project, setProject] = useState<ProjectData | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Upload Form & Drag-and-Drop state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [documentDate, setDocumentDate] = useState("");
  const [uploading, setUploading] = useState(false);

  // Document Detail / Inspection modal
  const [inspectDoc, setInspectDoc] = useState<{
    doc: DocumentItem;
    chunks: DocumentChunk[];
  } | null>(null);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [extractingDocId, setExtractingDocId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [projRes, docsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/projects/${projectId}/documents?page=${page}&limit=10`),
      ]);

      const projData = await projRes.json();
      const docsData = await docsRes.json();

      if (!projRes.ok) throw new Error(projData.error?.message || "Failed to load project");
      if (!docsRes.ok) throw new Error(docsData.error?.message || "Failed to load documents");

      setProject(projData.data);
      setDocuments(docsData.data.documents);
      if (docsData.data.pagination) {
        setPagination(docsData.data.pagination);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading documents");
    } finally {
      setLoading(false);
    }
  }, [projectId, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Serverless step processor poller: advances one step per call
  useEffect(() => {
    const pendingDoc = documents.find(
      (d) =>
        d.processingStatus === "UPLOADED" ||
        d.processingStatus === "VALIDATING" ||
        d.processingStatus === "EXTRACTING" ||
        d.processingStatus === "CHUNKING"
    );

    if (!pendingDoc) return;

    const timer = setTimeout(async () => {
      try {
        await fetch(`/api/projects/${projectId}/documents/${pendingDoc.id}/process`, {
          method: "POST",
        });
        await loadData();
      } catch (err) {
        console.error("Auto-process step error:", err);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [documents, projectId, loadData]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (documentDate) {
        formData.append("documentDate", documentDate);
      }

      const res = await fetch(`/api/projects/${projectId}/documents/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Upload failed");
      }

      setSelectedFile(null);
      setDocumentDate("");
      setSuccess(`Document '${data.data.fileName}' uploaded successfully. Processing started.`);
      setTimeout(() => setSuccess(null), 4000);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  }

  async function handleRetry(docId: string) {
    try {
      setError(null);
      const res = await fetch(`/api/projects/${projectId}/documents/${docId}/retry`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Retry failed");
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Retry failed");
    }
  }

  async function handleExtract(docId: string) {
    try {
      setError(null);
      setExtractingDocId(docId);
      const res = await fetch(`/api/projects/${projectId}/documents/${docId}/extract`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "AI extraction failed");

      const r = data.data as {
        cached: boolean;
        claimsCreated: number;
        flaggedChunks: number;
        model: string;
      };
      setSuccess(
        r.cached
          ? `Extraction cache hit (${r.model}): existing candidate claims are already up to date.`
          : `Extracted ${r.claimsCreated} claim${r.claimsCreated === 1 ? "" : "s"} using ${r.model}.${
              r.flaggedChunks > 0 ? ` (${r.flaggedChunks} chunk flagged for injection-like text)` : ""
            }`
      );
      setTimeout(() => setSuccess(null), 6000);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "AI extraction failed");
      await loadData();
    } finally {
      setExtractingDocId(null);
    }
  }

  async function handleDelete(docId: string, name: string) {
    if (!confirm(`Are you sure you want to remove '${name}'? This is a soft delete.`)) return;

    try {
      setError(null);
      const res = await fetch(`/api/projects/${projectId}/documents/${docId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Delete failed");
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function handleInspect(doc: DocumentItem) {
    setLoadingChunks(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/documents/${doc.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to load chunks");

      setInspectDoc({
        doc,
        chunks: data.data.document.chunks,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load chunks");
    } finally {
      setLoadingChunks(false);
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function renderStatusStepper(doc: DocumentItem) {
    const isFailed =
      doc.processingStatus === "VALIDATION_FAILED" ||
      doc.processingStatus === "EXTRACTION_FAILED" ||
      doc.processingStatus === "AI_PROCESSING_FAILED";
    const activeIdx =
      doc.processingStatus === "AI_COMPLETED" || doc.processingStatus === "AI_PROCESSING"
        ? PIPELINE_STEPS.length - 1
        : getStepIndex(doc.processingStatus);

    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          {doc.processingStatus === "AI_COMPLETED" ? (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
              <CheckCircle2 className="h-3 w-3" /> AI EXTRACTED
            </span>
          ) : doc.processingStatus === "READY_FOR_AI" ? (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
              <CheckCircle2 className="h-3 w-3" /> READY FOR AI
            </span>
          ) : isFailed ? (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-destructive/10 text-destructive">
              <AlertCircle className="h-3 w-3" /> {doc.processingStatus.replace(/_/g, " ")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
              <Loader2 className="h-3 w-3 animate-spin" /> {doc.processingStatus.replace(/_/g, " ")}
            </span>
          )}
        </div>

        {/* Stepper progress bar */}
        {!isFailed && (
          <div className="flex items-center gap-1" aria-label="Processing progress">
            {PIPELINE_STEPS.map((step, i) => (
              <div key={step.key} className="flex items-center gap-1" title={step.label}>
                <span
                  className={`h-1.5 w-5 rounded-full ${
                    activeIdx >= i ? "bg-primary" : "bg-muted"
                  }`}
                />
              </div>
            ))}
          </div>
        )}

        {doc.lastJob?.lastError && (
          <p className="text-[11px] text-destructive max-w-xs" title={doc.lastJob.lastError}>
            {doc.lastJob.lastError}
          </p>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
        <p className="text-sm font-medium">Loading documents...</p>
      </div>
    );
  }

  if (!project) return null;

  const canUpload = project.currentUserRole === "OWNER" || project.currentUserRole === "REVIEWER";
  const lowQualityDocs = documents.filter((d) => d.textQuality !== "OK");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Project Documents</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Upload authorized project documentation (PDF, DOCX, CSV) for automated knowledge extraction.
          </p>
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {lowQualityDocs.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Needs Human Attention</p>
            <p className="text-xs mt-0.5">
              {lowQualityDocs.length} {lowQualityDocs.length === 1 ? "document has" : "documents have"} low printable text or appear to be scanned images (OCR is disabled in MVP). Review or upload a text-searchable version.
            </p>
          </div>
        </div>
      )}

      {/* Upload Zone (OWNER and REVIEWER only) */}
      {canUpload ? (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="font-semibold text-base mb-1">Upload New Document</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Supported formats: PDF (.pdf), Word (.docx), CSV (.csv). Maximum 10 MB per file.
          </p>

          <form onSubmit={handleUpload} className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-input hover:border-primary/50"
              }`}
            >
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium">
                {selectedFile
                  ? `Selected: ${selectedFile.name} (${formatBytes(selectedFile.size)})`
                  : "Drag and drop a PDF, DOCX, or CSV file here, or browse"}
              </p>
              <label
                htmlFor="docFile"
                className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
              >
                Choose File
              </label>
              <input
                id="docFile"
                type="file"
                accept=".pdf,.docx,.csv"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="sr-only"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 items-end">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium" htmlFor="docDate">
                    Document Date (optional)
                  </label>
                  <span className="text-[10px] text-muted-foreground">Basis: USER_PROVIDED</span>
                </div>
                <input
                  id="docDate"
                  type="date"
                  value={documentDate}
                  onChange={(e) => setDocumentDate(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" /> Upload Document
                    </>
                  )}
                </button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground border-t pt-2">
              File modification metadata and upload time are never used as document chronology.
            </p>
          </form>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
          <Info className="h-4 w-4 shrink-0 text-primary" />
          <span>You have VIEWER access. Contact an Owner or Reviewer to upload project documents.</span>
        </div>
      )}

      {/* Document Roster Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-base">Uploaded Documents ({pagination.total})</h3>
          {loadingChunks && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        </div>

        {documents.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="font-medium text-sm">No documents uploaded yet.</p>
            <p className="text-xs mt-1">Upload meeting notes, design documents, or task spreadsheets to begin.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Document</th>
                    <th className="px-6 py-3 font-semibold">Source Date</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 font-semibold">Quality</th>
                    <th className="px-6 py-3 font-semibold">Chunks</th>
                    <th className="px-6 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {documents.map((doc) => {
                    const isPdf = doc.mimeType === "application/pdf";
                    const isCsv = doc.mimeType === "text/csv";

                    return (
                      <tr key={doc.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="rounded bg-muted p-2 text-primary shrink-0">
                              {isCsv ? (
                                <FileSpreadsheet className="h-5 w-5" />
                              ) : (
                                <FileText className="h-5 w-5" />
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-foreground truncate max-w-xs sm:max-w-md">
                                {doc.fileName}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                                <span>{formatBytes(doc.fileSize)}</span>
                                <span>•</span>
                                <span>
                                  {isPdf
                                    ? `${doc.pageCount} ${doc.pageCount === 1 ? "page" : "pages"}`
                                    : isCsv
                                    ? "CSV Table"
                                    : "Word DOCX"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-xs">
                          {doc.sourceDate ? (
                            <div className="space-y-0.5">
                              <div className="font-medium flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-primary" />
                                {formatDate(doc.sourceDate)}
                              </div>
                              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.2 rounded">
                                {doc.sourceDateBasis}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">Unknown (Undated)</span>
                          )}
                        </td>

                        <td className="px-6 py-4">{renderStatusStepper(doc)}</td>

                        <td className="px-6 py-4">
                          {doc.textQuality === "OK" ? (
                            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              OK
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 rounded px-2 py-0.5"
                              title="Needs human attention: low printable text or suspected scan."
                            >
                              <AlertTriangle className="h-3 w-3" />
                              {doc.textQuality === "SCANNED_SUSPECTED"
                                ? "Needs Attention (Scanned)"
                                : "Needs Attention (Low Text)"}
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-xs font-medium">
                          {doc.chunkCount > 0 ? (
                            <span className="inline-flex items-center gap-1">
                              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                              {doc.chunkCount} {doc.chunkCount === 1 ? "chunk" : "chunks"}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {doc.chunkCount > 0 && (
                              <button
                                onClick={() => handleInspect(doc)}
                                title="Inspect extracted chunks and source locations"
                                className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            )}

                            <a
                              href={`/api/projects/${projectId}/documents/${doc.id}/download`}
                              title="Download private file"
                              className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Download className="h-4 w-4" />
                            </a>

                            {(doc.processingStatus === "READY_FOR_AI" ||
                              doc.processingStatus === "AI_COMPLETED" ||
                              doc.processingStatus === "AI_PROCESSING_FAILED") &&
                              doc.chunkCount > 0 &&
                              canUpload && (
                                <button
                                  onClick={() => handleExtract(doc.id)}
                                  disabled={extractingDocId === doc.id}
                                  title="Run AI claim extraction on document chunks"
                                  className="inline-flex items-center gap-1 rounded px-2 py-1 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-xs font-medium transition-colors"
                                >
                                  {extractingDocId === doc.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Sparkles className="h-3.5 w-3.5" />
                                  )}
                                  {doc.processingStatus === "AI_PROCESSING_FAILED"
                                    ? "Retry AI"
                                    : doc.processingStatus === "AI_COMPLETED"
                                      ? "Re-run AI"
                                      : "Run Extraction"}
                                </button>
                              )}

                            {(doc.processingStatus === "VALIDATION_FAILED" ||
                              doc.processingStatus === "EXTRACTION_FAILED") &&
                              canUpload && (
                                <button
                                  onClick={() => handleRetry(doc.id)}
                                  title="Retry processing"
                                  className="inline-flex items-center gap-1 rounded px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" /> Retry
                                </button>
                              )}

                            {canUpload && (
                              <button
                                onClick={() => handleDelete(doc.id, doc.fileName)}
                                title="Remove document (Soft Delete)"
                                className="rounded p-1 hover:bg-muted text-destructive hover:text-destructive/80 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-6 py-3 text-xs text-muted-foreground">
                <span>
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="inline-flex items-center gap-1 rounded border px-2 py-1 hover:bg-muted disabled:opacity-40"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={page >= pagination.totalPages}
                    className="inline-flex items-center gap-1 rounded border px-2 py-1 hover:bg-muted disabled:opacity-40"
                  >
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Chunk Inspection Drawer Modal */}
      {inspectDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl rounded-xl border bg-card shadow-lg flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h3 className="font-semibold text-lg">{inspectDoc.doc.fileName}</h3>
                <p className="text-xs text-muted-foreground">
                  Extracted Chunks ({inspectDoc.chunks.length}) • Checksum:{" "}
                  <code className="text-[10px]">{inspectDoc.doc.checksum.slice(0, 16)}...</code>
                </p>
              </div>
              <button
                onClick={() => setInspectDoc(null)}
                className="rounded-md p-1 hover:bg-muted text-muted-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {inspectDoc.chunks.map((chunk) => (
                <div key={chunk.id} className="rounded-lg border bg-muted/20 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground border-b pb-2">
                    <span className="font-semibold text-foreground">
                      Chunk #{chunk.chunkIndex + 1}
                    </span>
                    <span className="bg-background border rounded px-2 py-0.5">
                      {chunk.pageNumber
                        ? `Page ${chunk.pageNumber}`
                        : chunk.sectionTitle
                        ? `Section: ${chunk.sectionTitle}`
                        : chunk.rowStart
                        ? `Rows ${chunk.rowStart}–${chunk.rowEnd}`
                        : "Location: Unknown"}
                    </span>
                  </div>
                  <pre className="text-xs whitespace-pre-wrap font-sans text-foreground/90 leading-relaxed">
                    {chunk.content}
                  </pre>
                </div>
              ))}
            </div>

            <div className="border-t px-6 py-3 flex justify-end">
              <button
                onClick={() => setInspectDoc(null)}
                className="rounded-md bg-muted px-4 py-2 text-sm font-medium hover:bg-muted/80 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
