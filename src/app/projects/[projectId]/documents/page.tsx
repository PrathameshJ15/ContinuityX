"use client";

import { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/date";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { FilterPills } from "@/components/ui/filter-pills";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useWorkspaceProject } from "../project-context";
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
  Layers,
  Sparkles,
  Search,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  FileCheck,
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
  return PIPELINE_STEPS.findIndex((s) => s.key === status);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function DocumentsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.projectId;
  const { project } = useWorkspaceProject();

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

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Upload Form & Drag-and-Drop state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
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
      const docsRes = await fetch(`/api/projects/${projectId}/documents?page=${page}&limit=10`);
      const docsData = await docsRes.json();

      if (!docsRes.ok) throw new Error(docsData.error?.message || "Failed to load documents");

      setDocuments(docsData.data?.documents || []);
      if (docsData.data?.pagination) {
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
    }, 3500);

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
      setUploadModalOpen(false);
      setSuccess(`Document '${data.data.fileName}' uploaded successfully. Processing pipeline started.`);
      setTimeout(() => setSuccess(null), 5000);
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
        chunks: data.data.document.chunks || [],
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load chunks");
    } finally {
      setLoadingChunks(false);
    }
  }

  // Filtered documents
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.uploadedBy.name.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === "READY") {
      return doc.processingStatus === "READY_FOR_AI" || doc.processingStatus === "AI_COMPLETED";
    }
    if (statusFilter === "PROCESSING") {
      return (
        doc.processingStatus === "UPLOADED" ||
        doc.processingStatus === "VALIDATING" ||
        doc.processingStatus === "EXTRACTING" ||
        doc.processingStatus === "CHUNKING" ||
        doc.processingStatus === "AI_PROCESSING"
      );
    }
    if (statusFilter === "FAILED") {
      return (
        doc.processingStatus === "VALIDATION_FAILED" ||
        doc.processingStatus === "EXTRACTION_FAILED" ||
        doc.processingStatus === "AI_PROCESSING_FAILED"
      );
    }
    if (statusFilter === "WARNINGS") {
      return doc.textQuality !== "OK";
    }

    return true;
  });

  const canUpload = project?.currentUserRole === "OWNER" || project?.currentUserRole === "REVIEWER";
  const lowQualityDocs = documents.filter((d) => d.textQuality !== "OK");
  const readyDocs = documents.filter(
    (d) => d.processingStatus === "READY_FOR_AI" || d.processingStatus === "AI_COMPLETED"
  );
  const totalChunks = documents.reduce((sum, d) => sum + (d.chunkCount || 0), 0);

  if (loading && !documents.length) {
    return (
      <div className="space-y-6">
        <PageHeader
          breadcrumbs={
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Link href="/dashboard" className="hover:text-foreground">Projects</Link>
              <span>/</span>
              <span>Documents</span>
            </div>
          }
          title="Documents"
          description="Loading project documentation workspace..."
        />
        <TableSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        breadcrumbs={
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link href="/dashboard" className="hover:text-foreground">Projects</Link>
            <span>/</span>
            <Link href={`/projects/${projectId}`} className="hover:text-foreground">{project?.name || "Project"}</Link>
            <span>/</span>
            <span className="text-foreground font-medium">Documents</span>
          </div>
        }
        title="Project Documents"
        description="Upload and manage authoritative project documentation (PDF, DOCX, CSV) for automated knowledge extraction."
        actions={
          canUpload ? (
            <button
              onClick={() => setUploadModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-primary/90 transition-all cursor-pointer"
            >
              <Upload className="h-4 w-4" />
              Upload Document
            </button>
          ) : undefined
        }
      />

      {/* Notifications */}
      {success && (
        <div className="flex items-center gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-50/50 p-4 text-xs font-medium text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-center gap-2.5 rounded-lg border border-rose-500/20 bg-rose-50/50 p-4 text-xs font-medium text-rose-800 dark:bg-rose-950/20 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {lowQualityDocs.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-50/60 p-4 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="font-semibold">Review Alert: Low Text Quality Detected</p>
            <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
              {lowQualityDocs.length} {lowQualityDocs.length === 1 ? "document has" : "documents have"} low printable text or appear to be scanned images. Verify content or upload a native digital version.
            </p>
          </div>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Documents"
          value={pagination.total}
          subtitle="Indexed in project corpus"
          icon={HardDrive}
        />
        <MetricCard
          title="Ready / Extracted"
          value={readyDocs.length}
          subtitle="Available for verification & Q&A"
          icon={FileCheck}
        />
        <MetricCard
          title="Total Text Chunks"
          value={totalChunks}
          subtitle="Indexed for retrieval"
          icon={Layers}
        />
        <MetricCard
          title="Quality Warnings"
          value={lowQualityDocs.length}
          subtitle={lowQualityDocs.length === 0 ? "All documents verified OK" : "Scanned or low-text files"}
          trend={lowQualityDocs.length > 0 ? { direction: "neutral", label: "Needs attention" } : undefined}
          icon={AlertTriangle}
        />
      </div>

      {/* Filters & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          <FilterPills
            options={[
              { id: "ALL", label: "All Documents", count: documents.length },
              { id: "READY", label: "Ready / Extracted", count: readyDocs.length },
              {
                id: "PROCESSING",
                label: "In Pipeline",
                count: documents.filter((d) =>
                  ["UPLOADED", "VALIDATING", "EXTRACTING", "CHUNKING", "AI_PROCESSING"].includes(d.processingStatus)
                ).length,
              },
              { id: "WARNINGS", label: "Warnings", count: lowQualityDocs.length },
            ]}
            selectedId={statusFilter}
            onSelect={setStatusFilter}
          />
        </div>

        <div className="relative min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by file name or uploader..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
          />
        </div>
      </div>

      {/* Document Table */}
      {filteredDocuments.length === 0 ? (
        <EmptyState
          type={documents.length === 0 ? "no-data" : "checked-empty"}
          title={documents.length === 0 ? "No documents uploaded yet" : "No matching documents found"}
          description={
            documents.length === 0
              ? "Upload authorized architecture, decisions, or meeting notes to extract canonical claims."
              : "Try adjusting your search query or filter pills to view available documents."
          }
          actionLabel={documents.length === 0 && canUpload ? "Upload First Document" : undefined}
          onAction={documents.length === 0 && canUpload ? () => setUploadModalOpen(true) : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-slate-50/75 dark:bg-slate-900/50 text-[11px] font-semibold text-muted-foreground">
                  <th className="py-3 px-4 font-semibold">Document</th>
                  <th className="py-3 px-3 font-semibold">Pipeline Status</th>
                  <th className="py-3 px-3 font-semibold">Quality</th>
                  <th className="py-3 px-3 font-semibold">Source Date</th>
                  <th className="py-3 px-3 font-semibold text-center">Chunks</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredDocuments.map((doc) => {
                  const isFailed = [
                    "VALIDATION_FAILED",
                    "EXTRACTION_FAILED",
                    "AI_PROCESSING_FAILED",
                  ].includes(doc.processingStatus);

                  const activeIdx =
                    doc.processingStatus === "AI_COMPLETED" || doc.processingStatus === "AI_PROCESSING"
                      ? PIPELINE_STEPS.length - 1
                      : getStepIndex(doc.processingStatus);

                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/25 transition-colors">
                      {/* Document Name & Meta */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-muted-foreground shrink-0 mt-0.5">
                            {doc.mimeType === "text/csv" ? (
                              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <FileText className="h-4 w-4 text-indigo-600" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate max-w-[280px]" title={doc.fileName}>
                              {doc.fileName}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {formatBytes(doc.fileSize)} • Uploaded {formatDate(doc.uploadedAt)} by {doc.uploadedBy.name}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Pipeline Status */}
                      <td className="py-3.5 px-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            {doc.processingStatus === "AI_COMPLETED" ? (
                              <Badge variant="verified">AI EXTRACTED</Badge>
                            ) : doc.processingStatus === "READY_FOR_AI" ? (
                              <Badge variant="success">READY FOR AI</Badge>
                            ) : isFailed ? (
                              <Badge variant="destructive">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                {doc.processingStatus.replace(/_/g, " ")}
                              </Badge>
                            ) : (
                              <Badge variant="neutral">
                                <Loader2 className="h-3 w-3 mr-1 animate-spin text-primary" />
                                {doc.processingStatus.replace(/_/g, " ")}
                              </Badge>
                            )}
                          </div>

                          {!isFailed && (
                            <div className="flex items-center gap-1" aria-label="Processing progress">
                              {PIPELINE_STEPS.map((step, i) => (
                                <div
                                  key={step.key}
                                  className={`h-1 w-4 rounded-full ${
                                    activeIdx >= i ? "bg-primary" : "bg-slate-200 dark:bg-slate-800"
                                  }`}
                                  title={step.label}
                                />
                              ))}
                            </div>
                          )}

                          {doc.lastJob?.lastError && (
                            <p className="text-[10px] text-rose-600 truncate max-w-[180px]" title={doc.lastJob.lastError}>
                              {doc.lastJob.lastError}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Quality */}
                      <td className="py-3.5 px-3">
                        {doc.textQuality === "OK" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Text OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400" title="Scanned or low readable text">
                            <AlertTriangle className="h-3.5 w-3.5" /> {doc.textQuality}
                          </span>
                        )}
                      </td>

                      {/* Source Date */}
                      <td className="py-3.5 px-3">
                        <div className="space-y-0.5">
                          <p className="font-medium text-foreground">
                            {doc.sourceDate ? formatDate(doc.sourceDate) : "—"}
                          </p>
                          <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-tight">
                            {doc.sourceDateBasis.replace(/_/g, " ")}
                          </span>
                        </div>
                      </td>

                      {/* Chunks */}
                      <td className="py-3.5 px-3 text-center">
                        <button
                          onClick={() => handleInspect(doc)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                        >
                          <Layers className="h-3 w-3" />
                          {doc.chunkCount || 0}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* AI Extraction Button */}
                          {(doc.processingStatus === "READY_FOR_AI" || doc.processingStatus === "AI_COMPLETED") && canUpload && (
                            <button
                              onClick={() => handleExtract(doc.id)}
                              disabled={extractingDocId === doc.id}
                              className="inline-flex items-center gap-1 rounded-md bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition-colors cursor-pointer disabled:opacity-50"
                              title="Run automated claim extraction using Gemini LLM"
                            >
                              {extractingDocId === doc.id ? (
                                <Loader2 className="h-3 w-3 animate-spin text-indigo-600" />
                              ) : (
                                <Sparkles className="h-3 w-3 text-indigo-600" />
                              )}
                              <span>Extract</span>
                            </button>
                          )}

                          {/* Inspect Chunks */}
                          <button
                            onClick={() => handleInspect(doc)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Inspect parsed text chunks"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          {/* Retry */}
                          {isFailed && canUpload && (
                            <button
                              onClick={() => handleRetry(doc.id)}
                              className="p-1.5 rounded-md text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                              title="Retry pipeline execution"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Delete */}
                          {canUpload && (
                            <button
                              onClick={() => handleDelete(doc.id, doc.fileName)}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                              title="Soft delete document"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3 bg-slate-50/50 dark:bg-slate-900/30 text-xs text-muted-foreground">
              <span>
                Showing page <strong className="text-foreground">{pagination.page}</strong> of{" "}
                <strong className="text-foreground">{pagination.totalPages}</strong> ({pagination.total} documents)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page >= pagination.totalPages}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload Modal */}
      <Modal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        title="Upload Document"
        description="Select a file to parse and index into the project knowledge corpus."
      >
        <form onSubmit={handleUpload} className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`rounded-xl border-2 border-dashed p-6 text-center transition-all ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 bg-slate-50/50 dark:bg-slate-900/30"
            }`}
          >
            <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-xs font-medium text-foreground">
              {selectedFile
                ? `Selected: ${selectedFile.name} (${formatBytes(selectedFile.size)})`
                : "Drag & drop your document here, or choose from files"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Supports PDF (.pdf), Word (.docx), CSV (.csv) up to 10 MB
            </p>

            <label
              htmlFor="modalFileInput"
              className="mt-3.5 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-xs hover:bg-accent transition-colors"
            >
              Browse Files
            </label>
            <input
              id="modalFileInput"
              type="file"
              accept=".pdf,.docx,.csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setSelectedFile(file);
              }}
              className="hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Source Document Date (Optional)
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="date"
                value={documentDate}
                onChange={(e) => setDocumentDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Provides deterministic chronological priority during conflict resolution if explicit in the document.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setUploadModalOpen(false)}
              className="rounded-lg border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedFile || uploading}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-primary/90 transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Start Processing"
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Inspect Document Modal */}
      {inspectDoc && (
        <Modal
          isOpen={!!inspectDoc}
          onClose={() => setInspectDoc(null)}
          title={`Document Inspector: ${inspectDoc.doc.fileName}`}
          description={`${inspectDoc.chunks.length} chunks indexed • ${inspectDoc.doc.mimeType} • ${formatBytes(inspectDoc.doc.fileSize)}`}
          maxWidth="3xl"
        >
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {loadingChunks ? (
              <div className="py-12 flex justify-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : inspectDoc.chunks.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                No chunks have been generated for this document yet.
              </p>
            ) : (
              <div className="space-y-3">
                {inspectDoc.chunks.map((chunk) => (
                  <div
                    key={chunk.id}
                    className="rounded-lg border border-border bg-slate-50/50 dark:bg-slate-900/40 p-3.5 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="font-mono font-semibold text-primary">Chunk #{chunk.chunkIndex + 1}</span>
                      <span className="font-mono">
                        {chunk.pageNumber ? `Page ${chunk.pageNumber}` : ""}
                        {chunk.sectionTitle ? ` • ${chunk.sectionTitle}` : ""}
                        {chunk.rowStart !== null && chunk.rowEnd !== null ? ` • Rows ${chunk.rowStart}–${chunk.rowEnd}` : ""}
                      </span>
                    </div>
                    <pre className="text-foreground whitespace-pre-wrap font-sans text-xs bg-card p-2.5 rounded border border-border/60 max-h-40 overflow-y-auto">
                      {chunk.content}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
