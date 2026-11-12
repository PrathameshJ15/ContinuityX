"use client";

import { useEffect, useState, use, useCallback } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  FileText,
  Filter,
  Loader2,
  ShieldAlert,
  X,
} from "lucide-react";

interface ClaimEvidenceItem {
  id: string;
  documentId: string;
  chunkId: string;
  sourceLocation: string;
  excerpt: string;
  evidenceType: string;
  document: {
    id: string;
    fileName: string;
    sourceDate: string | null;
    sourceDateBasis: string;
    deletedAt: string | null;
  };
}

interface ClaimItem {
  id: string;
  subjectEntityId: string;
  attributeKey: string;
  valueRaw: string;
  valueNormalized: string | null;
  category: string;
  reviewState: string;
  version: number;
  injectionFlag: boolean;
  confidence: number | null;
  createdAt: string;
  subjectEntity: {
    id: string;
    canonicalName: string;
    type: string;
    needsReview: boolean;
  };
  evidence: ClaimEvidenceItem[];
}

interface EntityOption {
  id: string;
  canonicalName: string;
  type: string;
}

interface ClaimDetail extends ClaimItem {
  extractionRun: {
    id: string;
    model: string;
    promptVersion: string;
    schemaVersion: string;
    status: string;
    startedAt: string;
  } | null;
  evidence: Array<
    ClaimEvidenceItem & {
      chunk: {
        id: string;
        chunkIndex: number;
        content: string;
        injectionFlag: boolean;
      };
    }
  >;
}

const CATEGORIES = [
  "DECISION",
  "TASK",
  "OWNERSHIP",
  "DEPENDENCY",
  "RISK",
  "OPEN_QUESTION",
  "FACT",
];

const ATTRIBUTES = [
  "status",
  "owner",
  "selected_technology",
  "due_date",
  "depends_on",
  "risk",
  "open_question",
  "rationale",
];

export default function ClaimsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);

  const [claims, setClaims] = useState<ClaimItem[]>([]);
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState("");
  const [attributeFilter, setAttributeFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [injectionOnly, setInjectionOnly] = useState(false);
  const [needsNormOnly, setNeedsNormOnly] = useState(false);

  // Detail & Edit state
  const [selectedDetail, setSelectedDetail] = useState<ClaimDetail | null>(null);
  const [editingClaim, setEditingClaim] = useState<ClaimItem | null>(null);
  const [editSubjectId, setEditSubjectId] = useState("");
  const [editAttributeKey, setEditAttributeKey] = useState("");
  const [editValueRaw, setEditValueRaw] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const qs = new URLSearchParams({ page: String(page), limit: "20" });
      if (categoryFilter) qs.set("category", categoryFilter);
      if (attributeFilter) qs.set("attributeKey", attributeFilter);
      if (entityFilter) qs.set("entityId", entityFilter);
      if (injectionOnly) qs.set("injectionFlag", "true");
      if (needsNormOnly) qs.set("needsNormalization", "true");

      const [claimsRes, entitiesRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/claims?${qs.toString()}`),
        fetch(`/api/projects/${projectId}/entities`),
      ]);

      if (claimsRes.status === 403 || entitiesRes.status === 403) {
        setForbidden(true);
        return;
      }

      const claimsJson = await claimsRes.json();
      const entitiesJson = await entitiesRes.json();

      if (!claimsRes.ok) throw new Error(claimsJson.error?.message || "Failed to load claims");
      if (!entitiesRes.ok) throw new Error(entitiesJson.error?.message || "Failed to load entities");

      setClaims(claimsJson.data.claims || []);
      setTotal(claimsJson.data.pagination?.total ?? 0);
      setTotalPages(claimsJson.data.pagination?.totalPages ?? 1);
      setEntities(entitiesJson.data.entities || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load claims");
    } finally {
      setLoading(false);
    }
  }, [projectId, page, categoryFilter, attributeFilter, entityFilter, injectionOnly, needsNormOnly]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function openDetail(claimId: string) {
    try {
      setError(null);
      const res = await fetch(`/api/projects/${projectId}/claims/${claimId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to load claim detail");
      setSelectedDetail(json.data.claim);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load claim detail");
    }
  }

  function startEdit(claim: ClaimItem) {
    setEditingClaim(claim);
    setEditSubjectId(claim.subjectEntityId);
    setEditAttributeKey(claim.attributeKey);
    setEditValueRaw(claim.valueRaw);
    setEditCategory(claim.category);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingClaim) return;

    try {
      setSavingEdit(true);
      setError(null);
      const res = await fetch(`/api/projects/${projectId}/claims/${editingClaim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectEntityId: editSubjectId,
          attributeKey: editAttributeKey,
          valueRaw: editValueRaw,
          category: editCategory,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to save claim edit");

      setEditingClaim(null);
      setSuccess("Created updated claim version (review state reset to PENDING).");
      setTimeout(() => setSuccess(null), 5000);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update claim");
    } finally {
      setSavingEdit(false);
    }
  }

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
        <p className="text-sm font-medium">Loading extracted claims...</p>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center max-w-lg mx-auto my-8 space-y-3">
        <ShieldAlert className="h-10 w-10 text-amber-500 mx-auto" />
        <h3 className="text-lg font-bold">Reviewer Permission Required</h3>
        <p className="text-sm text-muted-foreground">
          Unapproved extracted candidate claims are restricted to OWNER and REVIEWER roles. VIEWER members can access approved handover snapshots once published.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Candidate Claims</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Schema-validated AI candidate triples extracted from processed project documents. All values remain PENDING verification and human review.
        </p>
      </div>

      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-sm text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="rounded-xl border bg-card p-4 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mr-2">
          <Filter className="h-3.5 w-3.5" /> Filters
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => {
            setPage(1);
            setCategoryFilter(e.target.value);
          }}
          className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs"
          aria-label="Filter by category"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={attributeFilter}
          onChange={(e) => {
            setPage(1);
            setAttributeFilter(e.target.value);
          }}
          className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs"
          aria-label="Filter by attribute"
        >
          <option value="">All Attributes</option>
          {ATTRIBUTES.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <select
          value={entityFilter}
          onChange={(e) => {
            setPage(1);
            setEntityFilter(e.target.value);
          }}
          className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs max-w-[200px]"
          aria-label="Filter by entity"
        >
          <option value="">All Entities</option>
          {entities.map((en) => (
            <option key={en.id} value={en.id}>
              {en.canonicalName} ({en.type})
            </option>
          ))}
        </select>

        <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer select-none px-2">
          <input
            type="checkbox"
            checked={injectionOnly}
            onChange={(e) => {
              setPage(1);
              setInjectionOnly(e.target.checked);
            }}
          />
          Injection Flagged Only
        </label>

        <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer select-none px-2">
          <input
            type="checkbox"
            checked={needsNormOnly}
            onChange={(e) => {
              setPage(1);
              setNeedsNormOnly(e.target.checked);
            }}
          />
          Needs Normalisation
        </label>
      </div>

      {/* Claims List */}
      {claims.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-12 text-center text-muted-foreground space-y-2">
          <FileText className="h-10 w-10 mx-auto opacity-40" />
          <p className="text-sm font-medium text-foreground">No candidate claims match these filters</p>
          <p className="text-xs">
            Upload and process a document under the Documents tab, then click &ldquo;Run Extraction&rdquo;.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {claims.map((claim) => {
            const ev = claim.evidence[0];
            return (
              <div
                key={claim.id}
                className="rounded-xl border bg-card p-5 shadow-sm space-y-3 hover:border-primary/40 transition-colors"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-semibold">
                        {claim.category}
                      </span>
                      <span className="font-semibold text-sm">
                        {claim.subjectEntity.canonicalName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        .{claim.attributeKey} =
                      </span>
                      {claim.valueNormalized ? (
                        <span className="rounded bg-muted px-2 py-0.5 text-xs font-mono font-semibold">
                          {claim.valueNormalized}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5 text-xs font-medium">
                          <AlertTriangle className="h-3 w-3" /> needs normalisation ({claim.valueRaw})
                        </span>
                      )}
                      {claim.subjectEntity.needsReview && (
                        <span className="rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5 text-[10px] font-semibold">
                          Entity Needs Review
                        </span>
                      )}
                      {claim.injectionFlag && (
                        <span className="inline-flex items-center gap-1 rounded bg-destructive/10 text-destructive px-2 py-0.5 text-[10px] font-semibold">
                          <ShieldAlert className="h-3 w-3" /> Injection Flagged
                        </span>
                      )}
                    </div>

                    {claim.valueNormalized && claim.valueNormalized !== claim.valueRaw && (
                      <p className="text-xs text-muted-foreground">Raw value: &ldquo;{claim.valueRaw}&rdquo;</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      v{claim.version} · {claim.reviewState}
                    </span>
                    <button
                      onClick={() => openDetail(claim.id)}
                      className="inline-flex items-center gap-1 rounded border px-2.5 py-1 text-xs font-medium hover:bg-muted transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" /> Inspect
                    </button>
                    <button
                      onClick={() => startEdit(claim)}
                      className="inline-flex items-center gap-1 rounded border px-2.5 py-1 text-xs font-medium hover:bg-muted transition-colors"
                    >
                      <Edit3 className="h-3.5 w-3.5" /> Edit
                    </button>
                  </div>
                </div>

                {ev && (
                  <div className="rounded-lg bg-muted/40 border p-3 text-xs space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground font-medium">
                      <span>
                        Source: <strong className="text-foreground">{ev.document.fileName}</strong> ({ev.sourceLocation})
                      </span>
                      <span>
                        Date basis: {ev.document.sourceDateBasis}
                        {ev.document.sourceDate ? ` (${new Date(ev.document.sourceDate).toLocaleDateString()})` : ""}
                      </span>
                    </div>
                    <blockquote className="italic text-foreground/90 border-l-2 border-primary/40 pl-2.5">
                      &ldquo;{ev.excerpt}&rdquo;
                    </blockquote>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
          <span>
            Page {page} of {totalPages} ({total} total claims)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded border p-1.5 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded border p-1.5 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Claim Detail Modal */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-xl border bg-card shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h3 className="font-bold text-base">Claim Evidence &amp; Provenance</h3>
                <p className="text-xs text-muted-foreground">
                  {selectedDetail.subjectEntity.canonicalName} · {selectedDetail.attributeKey}
                </p>
              </div>
              <button onClick={() => setSelectedDetail(null)} className="rounded p-1 hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 rounded-lg border p-3 bg-muted/20">
                <div>
                  <span className="text-muted-foreground block">Normalized Value</span>
                  <span className="font-semibold">{selectedDetail.valueNormalized ?? "None (needs normalisation)"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Advisory Extractor Confidence</span>
                  <span className="font-semibold">
                    {selectedDetail.confidence !== null ? selectedDetail.confidence.toFixed(2) : "N/A"} (advisory only)
                  </span>
                </div>
                {selectedDetail.extractionRun && (
                  <>
                    <div>
                      <span className="text-muted-foreground block">Extraction Model</span>
                      <span className="font-mono">{selectedDetail.extractionRun.model}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Prompt / Schema</span>
                      <span className="font-mono">
                        {selectedDetail.extractionRun.promptVersion} / {selectedDetail.extractionRun.schemaVersion}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {selectedDetail.evidence.map((ev) => (
                <div key={ev.id} className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between font-semibold">
                    <span>
                      {ev.document.fileName} — {ev.sourceLocation}
                    </span>
                    <span className="text-muted-foreground">Chunk #{ev.chunk.chunkIndex + 1}</span>
                  </div>
                  <p className="font-medium text-primary">Cited excerpt: &ldquo;{ev.excerpt}&rdquo;</p>
                  <pre className="whitespace-pre-wrap rounded bg-muted/50 p-3 font-mono text-[11px] max-h-60 overflow-y-auto">
                    {ev.chunk.content}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit Candidate Claim Modal */}
      {editingClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-md rounded-xl border bg-card shadow-xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">Edit Candidate Claim (New Version)</h3>
              <button
                type="button"
                onClick={() => setEditingClaim(null)}
                className="rounded p-1 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-medium mb-1">Subject Entity</label>
                <select
                  value={editSubjectId}
                  onChange={(e) => setEditSubjectId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                >
                  {entities.map((en) => (
                    <option key={en.id} value={en.id}>
                      {en.canonicalName} ({en.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Category</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Controlled Attribute Key</label>
                <select
                  value={editAttributeKey}
                  onChange={(e) => setEditAttributeKey(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                >
                  {ATTRIBUTES.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Value</label>
                <input
                  type="text"
                  required
                  value={editValueRaw}
                  onChange={(e) => setEditValueRaw(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingClaim(null)}
                className="rounded-md border px-3 py-1.5 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {savingEdit && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Version
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
