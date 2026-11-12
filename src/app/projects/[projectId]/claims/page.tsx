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
  FileQuestion,
  FileText,
  Filter,
  HelpCircle,
  Loader2,
  Play,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";

interface VerificationItem {
  id: string;
  status: "VERIFIED" | "WEAK_SUPPORT" | "CONFLICTING" | "UNVERIFIED" | "UNKNOWN";
  sourceGate: "PASS" | "FAIL";
  sourceGateReason: string | null;
  quoteGate: "PASS" | "FAIL";
  quoteGateReason: string | null;
  quoteSimilarity: number | null;
  semanticGate: "SUPPORTS" | "NEUTRAL" | "CONTRADICTS" | "INSUFFICIENT_CONTEXT" | null;
  semanticReason: string | null;
  contradictionGate: "PASS" | "FAIL";
  contradictionCount: number;
  ruleSetVersion: string;
  judgeModel: string | null;
  judgePromptVersion: string | null;
  verifiedAt: string;
}

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
  verifications?: VerificationItem[];
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

const EVIDENCE_STATUSES = [
  "VERIFIED",
  "WEAK_SUPPORT",
  "CONFLICTING",
  "UNVERIFIED",
  "UNKNOWN",
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
  const [statusFilter, setStatusFilter] = useState("");
  const [injectionOnly, setInjectionOnly] = useState(false);
  const [needsNormOnly, setNeedsNormOnly] = useState(false);

  // Detail, Gate Breakdown & Edit state
  const [selectedDetail, setSelectedDetail] = useState<ClaimDetail | null>(null);
  const [inspectingVerification, setInspectingVerification] = useState<VerificationItem | null>(null);
  const [verifyingClaimId, setVerifyingClaimId] = useState<string | null>(null);
  const [batchVerifying, setBatchVerifying] = useState(false);

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
      if (statusFilter) qs.set("evidenceStatus", statusFilter);
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
  }, [projectId, page, categoryFilter, attributeFilter, entityFilter, statusFilter, injectionOnly, needsNormOnly]);

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

  async function handleVerifySingleClaim(claimId: string) {
    try {
      setVerifyingClaimId(claimId);
      setError(null);
      setSuccess(null);

      const res = await fetch(`/api/projects/${projectId}/claims/${claimId}/verify`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Verification failed");

      setSuccess(`Claim verified: ${json.data.status} (${json.data.ruleDescription})`);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifyingClaimId(null);
    }
  }

  async function handleVerifyAllClaims() {
    try {
      setBatchVerifying(true);
      setError(null);
      setSuccess(null);

      const res = await fetch(`/api/projects/${projectId}/verify`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Batch verification failed");

      const s = json.data.summary;
      setSuccess(
        `Batch Verification Complete: ${s.verified} Verified, ${s.weakSupport} Weak Support, ${s.conflicting} Conflicting, ${s.unverified} Unverified, ${s.unknown} Unknown (Total: ${s.total})`
      );
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Batch verification failed");
    } finally {
      setBatchVerifying(false);
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

      setSuccess("Claim edited successfully (new version created, review reset to PENDING).");
      setEditingClaim(null);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save claim edit");
    } finally {
      setSavingEdit(false);
    }
  }

  function renderStatusBadge(latestVerification?: VerificationItem) {
    if (!latestVerification) {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-muted text-muted-foreground px-2 py-0.5 text-xs font-medium">
          <HelpCircle className="h-3 w-3" /> Unchecked
        </span>
      );
    }

    switch (latestVerification.status) {
      case "VERIFIED":
        return (
          <button
            onClick={() => setInspectingVerification(latestVerification)}
            className="inline-flex items-center gap-1 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 text-xs font-semibold hover:opacity-85 transition-opacity"
            title="Click to inspect 4-gate verification breakdown"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            VERIFIED
          </button>
        );
      case "WEAK_SUPPORT":
        return (
          <button
            onClick={() => setInspectingVerification(latestVerification)}
            className="inline-flex items-center gap-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 px-2 py-0.5 text-xs font-semibold hover:opacity-85 transition-opacity"
            title="Click to inspect 4-gate verification breakdown"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            WEAK SUPPORT
          </button>
        );
      case "CONFLICTING":
        return (
          <button
            onClick={() => setInspectingVerification(latestVerification)}
            className="inline-flex items-center gap-1 rounded bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 px-2 py-0.5 text-xs font-semibold hover:opacity-85 transition-opacity"
            title="Click to inspect 4-gate verification breakdown"
          >
            <AlertCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
            CONFLICTING
          </button>
        );
      case "UNVERIFIED":
        return (
          <button
            onClick={() => setInspectingVerification(latestVerification)}
            className="inline-flex items-center gap-1 rounded bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 text-xs font-semibold hover:opacity-85 transition-opacity"
            title="Click to inspect 4-gate verification breakdown"
          >
            <FileQuestion className="h-3.5 w-3.5 text-slate-500" />
            UNVERIFIED
          </button>
        );
      case "UNKNOWN":
      default:
        return (
          <button
            onClick={() => setInspectingVerification(latestVerification)}
            className="inline-flex items-center gap-1 rounded bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 px-2 py-0.5 text-xs font-semibold hover:opacity-85 transition-opacity"
            title="Click to inspect 4-gate verification breakdown"
          >
            <HelpCircle className="h-3.5 w-3.5 text-purple-600" />
            UNKNOWN
          </button>
        );
    }
  }

  if (forbidden) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center text-destructive">
        <ShieldAlert className="h-10 w-10 mx-auto mb-3 opacity-80" />
        <h2 className="text-lg font-bold">Access Restricted</h2>
        <p className="text-sm mt-1">You must be an OWNER or REVIEWER to view unapproved project candidate claims.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Claim Registry & Verification</h1>
          <p className="text-sm text-muted-foreground">
            Structured candidate claims extracted from authorized documents, evaluated with 4-gate evidence proof.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50"
          >
            <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            onClick={handleVerifyAllClaims}
            disabled={batchVerifying || claims.length === 0}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {batchVerifying ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Verifying All Claims...
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                Verify All Claims
              </>
            )}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20 p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="rounded-xl border bg-card p-4 flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
          <Filter className="h-3.5 w-3.5" /> Filters:
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
            <option key={c} value={c}>{c}</option>
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
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value);
          }}
          className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs"
          aria-label="Filter by evidence status"
        >
          <option value="">All Evidence Statuses</option>
          {EVIDENCE_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
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
            const latestVerification = claim.verifications?.[0];
            const isVerifying = verifyingClaimId === claim.id;

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

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Machine Evidence Status */}
                    {renderStatusBadge(latestVerification)}

                    {/* Human Review State */}
                    <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded" title="Human Review Decision">
                      v{claim.version} · {claim.reviewState}
                    </span>

                    {/* Verify Single Claim Button */}
                    <button
                      onClick={() => handleVerifySingleClaim(claim.id)}
                      disabled={isVerifying}
                      className="inline-flex items-center gap-1 rounded border border-emerald-600/30 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 px-2.5 py-1 text-xs font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors disabled:opacity-50"
                    >
                      {isVerifying ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      )}
                      {latestVerification ? "Re-verify" : "Verify"}
                    </button>

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

      {/* Proof-Carrying Evidence Gate Breakdown Modal */}
      {inspectingVerification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-xl border bg-card p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-base">Proof-Carrying Verification Gates</h3>
              </div>
              <button
                onClick={() => setInspectingVerification(null)}
                className="rounded p-1 hover:bg-muted text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
                <span className="text-xs font-semibold">Final Evidence Status:</span>
                {renderStatusBadge(inspectingVerification)}
              </div>

              {/* Gate 1 */}
              <div className="rounded-lg border p-3 space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>Gate 1: Source Document Existence</span>
                  <span className={`px-2 py-0.5 rounded text-[11px] ${inspectingVerification.sourceGate === "PASS" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                    {inspectingVerification.sourceGate}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{inspectingVerification.sourceGateReason || "N/A"}</p>
              </div>

              {/* Gate 2 */}
              <div className="rounded-lg border p-3 space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>Gate 2: Verbatim / Normalized Quote Existence</span>
                  <span className={`px-2 py-0.5 rounded text-[11px] ${inspectingVerification.quoteGate === "PASS" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                    {inspectingVerification.quoteGate} {inspectingVerification.quoteSimilarity !== null ? `(${Math.round(inspectingVerification.quoteSimilarity * 100)}%)` : ""}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{inspectingVerification.quoteGateReason || "N/A"}</p>
              </div>

              {/* Gate 3 */}
              <div className="rounded-lg border p-3 space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>Gate 3: Independent Semantic Support Judge</span>
                  <span className="px-2 py-0.5 rounded text-[11px] bg-muted font-mono">
                    {inspectingVerification.semanticGate || "SKIPPED"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{inspectingVerification.semanticReason || "N/A"}</p>
                {inspectingVerification.judgeModel && (
                  <p className="text-[11px] text-muted-foreground/80 font-mono">
                    Model: {inspectingVerification.judgeModel} · Prompt: {inspectingVerification.judgePromptVersion}
                  </p>
                )}
              </div>

              {/* Gate 4 */}
              <div className="rounded-lg border p-3 space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>Gate 4: Contradiction / Conflict Scan</span>
                  <span className={`px-2 py-0.5 rounded text-[11px] ${inspectingVerification.contradictionGate === "PASS" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                    {inspectingVerification.contradictionGate === "PASS" ? "NO CONFLICTS" : "OPEN CONFLICT DETECTED"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Active pairwise conflicts detected: {inspectingVerification.contradictionCount}
                </p>
              </div>

              <div className="text-[11px] text-muted-foreground text-right pt-2 border-t">
                Rule set version: {inspectingVerification.ruleSetVersion} · Verified: {new Date(inspectingVerification.verifiedAt).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inspect Detail Modal */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl border bg-card p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base">Claim Inspection & Provenance</h3>
              <button
                onClick={() => setSelectedDetail(null)}
                className="rounded p-1 hover:bg-muted text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-muted/30 p-3 rounded-lg">
                <div><strong>Claim ID:</strong> <span className="font-mono">{selectedDetail.id}</span></div>
                <div><strong>Version:</strong> v{selectedDetail.version}</div>
                <div><strong>Subject:</strong> {selectedDetail.subjectEntity.canonicalName} ({selectedDetail.subjectEntity.type})</div>
                <div><strong>Attribute:</strong> {selectedDetail.attributeKey}</div>
                <div><strong>Value Raw:</strong> {selectedDetail.valueRaw}</div>
                <div><strong>Value Normalized:</strong> {selectedDetail.valueNormalized || "(none)"}</div>
                <div><strong>Category:</strong> {selectedDetail.category}</div>
                <div><strong>Review State:</strong> {selectedDetail.reviewState}</div>
              </div>

              {selectedDetail.extractionRun && (
                <div className="rounded-lg border p-3 space-y-1">
                  <div className="font-semibold text-foreground">Extraction Provenance</div>
                  <div className="text-muted-foreground">Model: {selectedDetail.extractionRun.model}</div>
                  <div className="text-muted-foreground">Prompt Version: {selectedDetail.extractionRun.promptVersion}</div>
                  <div className="text-muted-foreground">Run ID: <span className="font-mono">{selectedDetail.extractionRun.id}</span></div>
                </div>
              )}

              {selectedDetail.evidence.map((evItem) => (
                <div key={evItem.id} className="rounded-lg border p-3 space-y-1 bg-muted/20">
                  <div className="font-semibold text-foreground">Evidence Excerpt ({evItem.sourceLocation})</div>
                  <blockquote className="italic border-l-2 border-primary/40 pl-2">
                    &ldquo;{evItem.excerpt}&rdquo;
                  </blockquote>
                  <div className="text-muted-foreground pt-1">
                    Document: {evItem.document.fileName} · Date basis: {evItem.document.sourceDateBasis}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base">Edit Claim (Creates New Version)</h3>
              <button
                onClick={() => setEditingClaim(null)}
                className="rounded p-1 hover:bg-muted text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold">Subject Entity</label>
                <select
                  value={editSubjectId}
                  onChange={(e) => setEditSubjectId(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-xs"
                  required
                >
                  {entities.map((en) => (
                    <option key={en.id} value={en.id}>
                      {en.canonicalName} ({en.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold">Attribute Key</label>
                <select
                  value={editAttributeKey}
                  onChange={(e) => setEditAttributeKey(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-xs"
                  required
                >
                  {ATTRIBUTES.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold">Value (Raw)</label>
                <input
                  type="text"
                  value={editValueRaw}
                  onChange={(e) => setEditValueRaw(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold">Category</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-xs"
                  required
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setEditingClaim(null)}
                  className="rounded-md border px-4 py-2 hover:bg-muted font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="rounded-md bg-primary text-primary-foreground px-4 py-2 font-medium hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {savingEdit && <Loader2 className="h-3 w-3 animate-spin" />}
                  Save New Version
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
