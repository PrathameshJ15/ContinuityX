"use client";

import { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import { formatDate, formatDateTime } from "@/lib/date";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { FilterPills } from "@/components/ui/filter-pills";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
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
  HelpCircle,
  Loader2,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  X,
  Search,
  Layers,
  GitCompare,
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
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [attributeFilter, setAttributeFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
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
      if (statusFilter && statusFilter !== "ALL") qs.set("evidenceStatus", statusFilter);
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
        <span className="inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-800 text-muted-foreground px-2 py-0.5 text-xs font-medium">
          <HelpCircle className="h-3 w-3" /> Unchecked
        </span>
      );
    }

    switch (latestVerification.status) {
      case "VERIFIED":
        return (
          <button
            onClick={() => setInspectingVerification(latestVerification)}
            className="cursor-pointer"
            title="Inspect 4-gate verification proof"
          >
            <Badge variant="verified">VERIFIED</Badge>
          </button>
        );
      case "WEAK_SUPPORT":
        return (
          <button
            onClick={() => setInspectingVerification(latestVerification)}
            className="cursor-pointer"
            title="Inspect 4-gate verification proof"
          >
            <Badge variant="weak">WEAK SUPPORT</Badge>
          </button>
        );
      case "CONFLICTING":
        return (
          <button
            onClick={() => setInspectingVerification(latestVerification)}
            className="cursor-pointer"
            title="Inspect 4-gate verification proof"
          >
            <Badge variant="contradicted">CONFLICTING</Badge>
          </button>
        );
      case "UNVERIFIED":
        return (
          <button
            onClick={() => setInspectingVerification(latestVerification)}
            className="cursor-pointer"
            title="Inspect 4-gate verification proof"
          >
            <Badge variant="unverified">UNVERIFIED</Badge>
          </button>
        );
      case "UNKNOWN":
      default:
        return (
          <button
            onClick={() => setInspectingVerification(latestVerification)}
            className="cursor-pointer"
            title="Inspect 4-gate verification proof"
          >
            <Badge variant="neutral">UNKNOWN</Badge>
          </button>
        );
    }
  }

  // Filtered by local search query if typed
  const displayedClaims = claims.filter((claim) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      claim.subjectEntity.canonicalName.toLowerCase().includes(q) ||
      claim.attributeKey.toLowerCase().includes(q) ||
      claim.valueRaw.toLowerCase().includes(q) ||
      (claim.valueNormalized && claim.valueNormalized.toLowerCase().includes(q))
    );
  });

  const verifiedCount = claims.filter((c) => c.verifications?.[0]?.status === "VERIFIED").length;
  const conflictingCount = claims.filter((c) => c.verifications?.[0]?.status === "CONFLICTING").length;
  const needsNormCount = claims.filter((c) => !c.valueNormalized).length;

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
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        breadcrumbs={
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link href="/dashboard" className="hover:text-foreground">Projects</Link>
            <span>/</span>
            <Link href={`/projects/${projectId}`} className="hover:text-foreground">Project</Link>
            <span>/</span>
            <span className="text-foreground font-medium">Claims & Evidence</span>
          </div>
        }
        title="Claim Registry & Evidence"
        description="Structured candidate claims extracted from authoritative documents, evaluated through 4-gate deterministic evidence proof."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={handleVerifyAllClaims}
              disabled={batchVerifying || claims.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {batchVerifying ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Verifying All Claims...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  Verify All Claims
                </>
              )}
            </button>
          </div>
        }
      />

      {/* Notifications */}
      {error && (
        <div role="alert" className="flex items-center justify-between gap-2 rounded-lg border border-rose-500/20 bg-rose-50/50 p-4 text-xs font-medium text-rose-800 dark:bg-rose-950/20 dark:text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {success && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/20 bg-emerald-50/50 p-4 text-xs font-medium text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Metric Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Claims"
          value={total}
          subtitle="Candidate facts extracted"
          icon={Layers}
        />
        <MetricCard
          title="Verified Claims"
          value={verifiedCount}
          subtitle="Passes 4-gate evidence proof"
          variant={verifiedCount > 0 ? "success" : "default"}
          icon={ShieldCheck}
        />
        <MetricCard
          title="Conflicting Claims"
          value={conflictingCount}
          subtitle="Contradictions found in corpus"
          variant={conflictingCount > 0 ? "danger" : "default"}
          icon={GitCompare}
        />
        <MetricCard
          title="Needs Normalization"
          value={needsNormCount}
          subtitle={needsNormCount === 0 ? "All values normalized" : "Unmapped raw terms"}
          variant={needsNormCount > 0 ? "warning" : "default"}
          icon={AlertTriangle}
        />
      </div>

      {/* Filter Pills Toolbar */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <FilterPills
            options={[
              { id: "ALL", label: "All Statuses", count: total },
              { id: "VERIFIED", label: "Verified", count: verifiedCount },
              { id: "WEAK_SUPPORT", label: "Weak Support" },
              { id: "CONFLICTING", label: "Conflicting", count: conflictingCount },
              { id: "UNVERIFIED", label: "Unverified" },
            ]}
            selectedId={statusFilter}
            onSelect={(id) => {
              setPage(1);
              setStatusFilter(id);
            }}
          />

          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search entity, attribute, value..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
            />
          </div>
        </div>

        {/* Secondary filters */}
        <div className="rounded-xl border border-border/80 bg-card p-3 flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
            <Filter className="h-3.5 w-3.5" /> Dimensions:
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => {
              setPage(1);
              setCategoryFilter(e.target.value);
            }}
            className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground shadow-xs"
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
            className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground shadow-xs"
            aria-label="Filter by attribute"
          >
            <option value="">All Attributes</option>
            {ATTRIBUTES.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          <select
            value={entityFilter}
            onChange={(e) => {
              setPage(1);
              setEntityFilter(e.target.value);
            }}
            className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground max-w-[200px] shadow-xs"
            aria-label="Filter by entity"
          >
            <option value="">All Entities</option>
            {entities.map((en) => (
              <option key={en.id} value={en.id}>
                {en.canonicalName} ({en.type})
              </option>
            ))}
          </select>

          <div className="h-4 w-px bg-border mx-1" />

          <label className="inline-flex items-center gap-1.5 text-xs text-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={injectionOnly}
              onChange={(e) => {
                setPage(1);
                setInjectionOnly(e.target.checked);
              }}
              className="rounded border-border text-primary"
            />
            <span>Injection Flagged</span>
          </label>

          <label className="inline-flex items-center gap-1.5 text-xs text-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={needsNormOnly}
              onChange={(e) => {
                setPage(1);
                setNeedsNormOnly(e.target.checked);
              }}
              className="rounded border-border text-primary"
            />
            <span>Needs Normalization</span>
          </label>
        </div>
      </div>

      {/* Claims List */}
      {loading && !claims.length ? (
        <TableSkeleton rows={6} />
      ) : displayedClaims.length === 0 ? (
        <EmptyState
          type={total === 0 ? "no-data" : "checked-empty"}
          title={total === 0 ? "No claims extracted yet" : "No claims match current filters"}
          description={
            total === 0
              ? "Upload documentation in the Documents workspace and click 'Extract' to generate candidate claims."
              : "Try relaxing your category, attribute, or evidence status filters to view claims."
          }
          actionHref={`/projects/${projectId}/documents`}
          actionLabel={total === 0 ? "Go to Documents" : undefined}
        />
      ) : (
        <div className="space-y-3">
          {displayedClaims.map((claim) => {
            const ev = claim.evidence[0];
            const latestVerification = claim.verifications?.[0];
            const isVerifying = verifyingClaimId === claim.id;

            return (
              <div
                key={claim.id}
                className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3 hover:border-primary/40 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                        {claim.category}
                      </span>
                      <span className="font-semibold text-sm text-foreground">
                        {claim.subjectEntity.canonicalName}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        .{claim.attributeKey} =
                      </span>
                      {claim.valueNormalized ? (
                        <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-mono font-semibold text-foreground">
                          {claim.valueNormalized}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 px-2 py-0.5 text-xs font-medium border border-amber-200/60">
                          <AlertTriangle className="h-3 w-3 text-amber-600" />
                          needs normalization ({claim.valueRaw})
                        </span>
                      )}
                      {claim.subjectEntity.needsReview && (
                        <Badge variant="warning">Entity Needs Review</Badge>
                      )}
                      {claim.injectionFlag && (
                        <Badge variant="destructive">
                          <ShieldAlert className="h-3 w-3 mr-1" />
                          Injection Flagged
                        </Badge>
                      )}
                    </div>

                    {claim.valueNormalized && claim.valueNormalized !== claim.valueRaw && (
                      <p className="text-xs text-muted-foreground">
                        Raw extract: <span className="italic text-foreground">&ldquo;{claim.valueRaw}&rdquo;</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Machine Evidence Status */}
                    {renderStatusBadge(latestVerification)}

                    {/* Human Review State */}
                    <span className="text-[11px] font-medium text-muted-foreground bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md" title="Human Review Decision">
                      v{claim.version} • {claim.reviewState}
                    </span>

                    {/* Verify Single Claim Button */}
                    <button
                      onClick={() => handleVerifySingleClaim(claim.id)}
                      disabled={isVerifying}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-600/30 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 px-2.5 py-1 text-xs font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors disabled:opacity-50 cursor-pointer"
                      title="Run 4-gate verification on this single claim"
                    >
                      {isVerifying ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                      ) : (
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                      )}
                      <span>{latestVerification ? "Re-verify" : "Verify"}</span>
                    </button>

                    <button
                      onClick={() => openDetail(claim.id)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Inspect full claim details and chunk context"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => startEdit(claim)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Edit claim and create new version"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {ev && (
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-border/80 p-3 text-xs space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <FileText className="h-3 w-3 text-primary" />
                        Source: <strong className="text-foreground">{ev.document.fileName}</strong> ({ev.sourceLocation})
                      </span>
                      <span>
                        Date basis: <strong className="text-foreground font-mono">{ev.document.sourceDateBasis}</strong>
                        {ev.document.sourceDate ? ` (${formatDate(ev.document.sourceDate)})` : ""}
                      </span>
                    </div>
                    <blockquote className="italic text-foreground border-l-2 border-primary/50 pl-2.5 py-0.5 text-xs">
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
        <div className="flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
          <span>
            Page <strong className="text-foreground">{page}</strong> of{" "}
            <strong className="text-foreground">{totalPages}</strong> ({total} total claims)
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
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 4-Gate Verification Proof Modal */}
      {inspectingVerification && (
        <Modal
          isOpen={!!inspectingVerification}
          onClose={() => setInspectingVerification(null)}
          title="Proof-Carrying Verification Gates"
          description="Detailed deterministic verification results across all 4 evidence gates."
          maxWidth="2xl"
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-900/60 p-3.5 border border-border">
              <span className="text-xs font-semibold text-foreground">Synthesis Evidence Status:</span>
              {renderStatusBadge(inspectingVerification)}
            </div>

            {/* Gate 1 */}
            <div className="rounded-xl border border-border p-3.5 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-foreground">Gate 1: Source Document Existence</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                  inspectingVerification.sourceGate === "PASS"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                }`}>
                  {inspectingVerification.sourceGate}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{inspectingVerification.sourceGateReason || "Verified present in active corpus."}</p>
            </div>

            {/* Gate 2 */}
            <div className="rounded-xl border border-border p-3.5 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-foreground">Gate 2: Verbatim / Normalized Quote Match</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                  inspectingVerification.quoteGate === "PASS"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                }`}>
                  {inspectingVerification.quoteGate}{" "}
                  {inspectingVerification.quoteSimilarity !== null ? `(${Math.round(inspectingVerification.quoteSimilarity * 100)}% match)` : ""}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{inspectingVerification.quoteGateReason || "Direct citation matched in chunk."}</p>
            </div>

            {/* Gate 3 */}
            <div className="rounded-xl border border-border p-3.5 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-foreground">Gate 3: Independent Semantic Support Judge</span>
                <span className="px-2 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-slate-800 font-mono font-semibold text-foreground">
                  {inspectingVerification.semanticGate || "SKIPPED"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{inspectingVerification.semanticReason || "Deterministic rules satisfied."}</p>
              {inspectingVerification.judgeModel && (
                <p className="text-[11px] text-muted-foreground/80 font-mono">
                  Judge Model: {inspectingVerification.judgeModel} • Prompt v{inspectingVerification.judgePromptVersion}
                </p>
              )}
            </div>

            {/* Gate 4 */}
            <div className="rounded-xl border border-border p-3.5 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-foreground">Gate 4: Contradiction Check</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                  inspectingVerification.contradictionGate === "PASS"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                }`}>
                  {inspectingVerification.contradictionGate} ({inspectingVerification.contradictionCount} open contradictions)
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {inspectingVerification.contradictionCount === 0
                  ? "No open pairwise conflicts detected with other accepted or verified claims."
                  : "Has open conflict with other claim in project corpus."}
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* Detail Inspection Modal */}
      {selectedDetail && (
        <Modal
          isOpen={!!selectedDetail}
          onClose={() => setSelectedDetail(null)}
          title={`Claim Detail: ${selectedDetail.subjectEntity.canonicalName}.${selectedDetail.attributeKey}`}
          description={`Extracted Fact ID: ${selectedDetail.id}`}
          maxWidth="3xl"
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 text-xs">
            {/* Meta */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-border">
              <div>
                <p className="text-[11px] text-muted-foreground">Subject Entity</p>
                <p className="font-semibold text-foreground mt-0.5">
                  {selectedDetail.subjectEntity.canonicalName} ({selectedDetail.subjectEntity.type})
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Attribute & Category</p>
                <p className="font-semibold text-foreground mt-0.5 font-mono">
                  {selectedDetail.attributeKey} • {selectedDetail.category}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Raw Value</p>
                <p className="font-semibold text-foreground mt-0.5">{selectedDetail.valueRaw}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Normalized Value</p>
                <p className="font-semibold text-foreground mt-0.5 font-mono">
                  {selectedDetail.valueNormalized || "(None)"}
                </p>
              </div>
            </div>

            {/* Evidence & Full Chunk */}
            <div className="space-y-3">
              <h4 className="font-semibold text-foreground">Source Citations & Underlying Chunks</h4>
              {selectedDetail.evidence.map((ev) => (
                <div key={ev.id} className="rounded-xl border border-border p-3.5 space-y-2 bg-card">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground">{ev.document.fileName}</span>
                    <span className="font-mono">{ev.sourceLocation}</span>
                  </div>
                  <blockquote className="border-l-2 border-primary pl-3 italic text-foreground py-0.5">
                    &ldquo;{ev.excerpt}&rdquo;
                  </blockquote>
                  {ev.chunk && (
                    <div className="mt-2 pt-2 border-t border-border/60">
                      <p className="text-[11px] text-muted-foreground mb-1">
                        Full Context (Chunk #{ev.chunk.chunkIndex + 1}):
                      </p>
                      <pre className="font-sans text-xs bg-slate-50 dark:bg-slate-900 p-2.5 rounded border border-border whitespace-pre-wrap max-h-36 overflow-y-auto">
                        {ev.chunk.content}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Extraction Run Meta */}
            {selectedDetail.extractionRun && (
              <div className="p-3 rounded-xl border border-border text-[11px] text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">Extraction Run Information</p>
                <p>Model: <span className="font-mono text-foreground">{selectedDetail.extractionRun.model}</span></p>
                <p>Prompt Version: <span className="font-mono text-foreground">{selectedDetail.extractionRun.promptVersion}</span></p>
                <p>Extracted At: {formatDateTime(selectedDetail.extractionRun.startedAt)}</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Edit Claim Modal */}
      {editingClaim && (
        <Modal
          isOpen={!!editingClaim}
          onClose={() => setEditingClaim(null)}
          title="Edit Claim"
          description="Editing creates a new claim version and sets review status back to PENDING."
        >
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Subject Entity</label>
              <select
                value={editSubjectId}
                onChange={(e) => setEditSubjectId(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
              >
                {entities.map((en) => (
                  <option key={en.id} value={en.id}>
                    {en.canonicalName} ({en.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Attribute Key</label>
              <input
                type="text"
                value={editAttributeKey}
                onChange={(e) => setEditAttributeKey(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Raw Value</label>
              <textarea
                value={editValueRaw}
                onChange={(e) => setEditValueRaw(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Category</label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setEditingClaim(null)}
                className="rounded-lg border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-primary/90 transition-colors disabled:opacity-40 cursor-pointer"
              >
                {savingEdit ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save New Version"
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
