"use client";

import React, { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import { formatDate, formatDateTime } from "@/lib/date";
import { getConflictsEmptyState } from "@/lib/empty-states";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { FilterPills } from "@/components/ui/filter-pills";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  HelpCircle,
  Loader2,
  RotateCw,
  ShieldAlert,
  X,
  GitCompare,
  FileText,
} from "lucide-react";

interface ConflictItem {
  id: string;
  projectId: string;
  subjectEntityId: string;
  attributeKey: string;
  claimAId: string;
  claimBId: string;
  conflictType: string;
  status:
    | "OPEN"
    | "POSSIBLY_SUPERSEDED"
    | "RESOLVED_MUTUAL_ACCEPT"
    | "RESOLVED_ONE_ACCEPTED"
    | "RESOLVED_BOTH_REJECTED"
    | "RESOLVED_EDITED"
    | "REQUIRES_CLARIFICATION";
  resolutionNotes: string | null;
  resolvedAt: string | null;
  resolvedByUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
  subjectEntity: {
    id: string;
    canonicalName: string;
    type: string;
  };
  claimA: {
    id: string;
    attributeKey: string;
    valueRaw: string;
    valueNormalized: string | null;
    reviewState: string;
    evidence: Array<{
      id: string;
      sourceLocation: string;
      excerpt: string;
      document: {
        id: string;
        fileName: string;
        sourceDate: string | null;
        sourceDateBasis: string;
      };
    }>;
  };
  claimB: {
    id: string;
    attributeKey: string;
    valueRaw: string;
    valueNormalized: string | null;
    reviewState: string;
    evidence: Array<{
      id: string;
      sourceLocation: string;
      excerpt: string;
      document: {
        id: string;
        fileName: string;
        sourceDate: string | null;
        sourceDateBasis: string;
      };
    }>;
  };
}

export default function ConflictsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.projectId;

  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [totalClaims, setTotalClaims] = useState<number | null>(null);
  const [counts, setCounts] = useState<{
    ALL: number;
    OPEN: number;
    POSSIBLY_SUPERSEDED: number;
    REQUIRES_CLARIFICATION: number;
    RESOLVED: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Resolution modal state
  const [resolvingConflict, setResolvingConflict] = useState<ConflictItem | null>(null);
  const [resolutionAction, setResolutionAction] = useState<string>("CHOOSE_A");
  const [resolutionReason, setResolutionReason] = useState<string>("");
  const [submittingResolution, setSubmittingResolution] = useState(false);

  const loadConflicts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const qs = new URLSearchParams();
      if (statusFilter && statusFilter !== "ALL") {
        qs.set("status", statusFilter);
      }

      const res = await fetch(`/api/projects/${projectId}/conflicts?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to load conflicts");

      setConflicts(json.data.conflicts || []);
      setTotalClaims(typeof json.data.totalProjectClaims === "number" ? json.data.totalProjectClaims : null);
      if (json.data.counts) setCounts(json.data.counts);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load conflicts");
    } finally {
      setLoading(false);
    }
  }, [projectId, statusFilter]);

  useEffect(() => {
    loadConflicts();
  }, [loadConflicts]);

  async function handleResolveSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!resolvingConflict) return;
    if (!resolutionReason.trim()) {
      setError("A written resolution reason is required.");
      return;
    }

    try {
      setSubmittingResolution(true);
      setError(null);

      const res = await fetch(`/api/projects/${projectId}/conflicts/${resolvingConflict.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: resolutionAction,
          reason: resolutionReason.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to resolve conflict");

      setSuccess("Conflict resolved successfully. Affected claims re-verified.");
      setResolvingConflict(null);
      setResolutionReason("");
      await loadConflicts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Resolution failed");
    } finally {
      setSubmittingResolution(false);
    }
  }

  function renderStatusBadge(status: string) {
    switch (status) {
      case "OPEN":
        return <Badge variant="critical">OPEN CONFLICT</Badge>;
      case "POSSIBLY_SUPERSEDED":
        return <Badge variant="warning">POSSIBLY SUPERSEDED</Badge>;
      case "REQUIRES_CLARIFICATION":
        return <Badge variant="neutral">CLARIFICATION NEEDED</Badge>;
      case "RESOLVED_MUTUAL_ACCEPT":
      case "RESOLVED_ONE_ACCEPTED":
      case "RESOLVED_BOTH_REJECTED":
      case "RESOLVED_EDITED":
      default:
        return <Badge variant="verified">{status.replace(/_/g, " ")}</Badge>;
    }
  }

  function renderChronologyNotice(conflict: ConflictItem) {
    const docA = conflict.claimA.evidence[0]?.document;
    const docB = conflict.claimB.evidence[0]?.document;

    const hasReliableDateA = docA?.sourceDate && docA.sourceDateBasis !== "UNKNOWN";
    const hasReliableDateB = docB?.sourceDate && docB.sourceDateBasis !== "UNKNOWN";

    if (!hasReliableDateA || !hasReliableDateB) {
      return (
        <div className="rounded-lg border border-amber-500/20 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
          <Clock className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="font-semibold">Chronology Unknown (SPEC.md Safe Rule)</p>
            <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed">
              At least one source document lacks a reliable date (source date basis is UNKNOWN). Per strict safety rules, temporal order cannot be inferred automatically. Human reviewer resolution is mandatory.
            </p>
          </div>
        </div>
      );
    }

    const timeA = new Date(docA.sourceDate!).getTime();
    const timeB = new Date(docB.sourceDate!).getTime();

    if (timeA !== timeB) {
      const newerSide = timeA > timeB ? "Claim A" : "Claim B";
      const newerDoc = timeA > timeB ? docA.fileName : docB.fileName;
      return (
        <div className="rounded-lg border border-blue-500/20 bg-blue-50/60 dark:bg-blue-950/20 p-3 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
          <Calendar className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
          <div>
            <p className="font-semibold">Dated Discrepancy Detected</p>
            <p className="text-[11px] text-blue-800 dark:text-blue-300 mt-0.5 leading-relaxed">
              Both documents have reliable dates. <strong>{newerSide}</strong> ({newerDoc}) is chronologically newer. Initialized as <strong>POSSIBLY_SUPERSEDED</strong>; reviewer confirmation required.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-border bg-slate-50 dark:bg-slate-900/40 p-3 text-xs text-muted-foreground flex items-center gap-2.5">
        <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span>Both source documents share the identical date. Conflict remains OPEN for human decision.</span>
      </div>
    );
  }

  const emptyInfo = getConflictsEmptyState(totalClaims ?? (conflicts.length > 0 ? 1 : 0), conflicts.length, statusFilter);

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
            <span className="text-foreground font-medium">Conflicts</span>
          </div>
        }
        title="Conflict Detection & Resolution"
        description="Deterministic pairwise contradictions between competing claims sharing the same entity and single-valued attribute."
        actions={
          <button
            onClick={loadConflicts}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />

      {/* Notifications */}
      {error && (
        <div role="alert" className="flex items-center justify-between gap-2 rounded-lg border border-rose-500/20 bg-rose-50/50 p-4 text-xs font-medium text-rose-800 dark:bg-rose-950/20 dark:text-rose-300">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600" />
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

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Contradictions"
          value={counts?.ALL ?? conflicts.length}
          subtitle="Pairwise discrepancies detected"
          icon={GitCompare}
        />
        <MetricCard
          title="Open Conflicts"
          value={counts?.OPEN ?? 0}
          subtitle="Unresolved blockers"
          variant={(counts?.OPEN ?? 0) > 0 ? "danger" : "default"}
          icon={AlertTriangle}
        />
        <MetricCard
          title="Possibly Superseded"
          value={counts?.POSSIBLY_SUPERSEDED ?? 0}
          subtitle="Dated chronological updates"
          variant={(counts?.POSSIBLY_SUPERSEDED ?? 0) > 0 ? "warning" : "default"}
          icon={Clock}
        />
        <MetricCard
          title="Clarification Needed"
          value={counts?.REQUIRES_CLARIFICATION ?? 0}
          subtitle="Awaiting domain expert input"
          icon={HelpCircle}
        />
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <FilterPills
          options={[
            { id: "ALL", label: "All Conflicts", count: counts?.ALL },
            { id: "OPEN", label: "Open", count: counts?.OPEN },
            { id: "POSSIBLY_SUPERSEDED", label: "Possibly Superseded", count: counts?.POSSIBLY_SUPERSEDED },
            { id: "REQUIRES_CLARIFICATION", label: "Requires Clarification", count: counts?.REQUIRES_CLARIFICATION },
            { id: "RESOLVED", label: "Resolved", count: counts?.RESOLVED },
          ]}
          selectedId={statusFilter}
          onSelect={setStatusFilter}
        />
      </div>

      {/* Conflicts Content */}
      {loading ? (
        <TableSkeleton rows={4} />
      ) : emptyInfo.state === "NO_DATA" ? (
        <EmptyState
          type="no-data"
          title={emptyInfo.title}
          description={emptyInfo.description}
          actionHref={`/projects/${projectId}/documents`}
          actionLabel={emptyInfo.linkLabel || "Go to Documents"}
        />
      ) : emptyInfo.state === "CHECKED_EMPTY" || conflicts.length === 0 ? (
        <EmptyState
          type="checked-empty"
          title={emptyInfo.title || "No Conflicts Found"}
          description={
            emptyInfo.description ||
            (statusFilter === "ALL"
              ? "All candidate claims in this project are mutually consistent."
              : `No conflicts found matching filter '${statusFilter}'.`)
          }
        />
      ) : (
        <div className="space-y-6">
          {conflicts.map((conflict) => {
            const isResolved = conflict.status.startsWith("RESOLVED_");

            return (
              <div
                key={conflict.id}
                className="rounded-xl border border-border bg-card shadow-xs overflow-hidden divide-y divide-border/70"
              >
                {/* Conflict Card Header */}
                <div className="bg-slate-50/75 dark:bg-slate-900/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    {renderStatusBadge(conflict.status)}
                    <span className="font-semibold text-foreground text-sm">
                      {conflict.subjectEntity.canonicalName}
                    </span>
                    <span className="text-muted-foreground font-mono">
                      • {conflict.attributeKey}
                    </span>
                    <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                      {conflict.conflictType}
                    </span>
                  </div>

                  {!isResolved && (
                    <button
                      onClick={() => {
                        setResolvingConflict(conflict);
                        setResolutionAction("CHOOSE_A");
                        setResolutionReason("");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-white px-3.5 py-1.5 text-xs font-semibold shadow-xs hover:bg-primary/90 transition-all cursor-pointer shrink-0"
                    >
                      <GitCompare className="h-3.5 w-3.5" />
                      Resolve Conflict
                    </button>
                  )}
                </div>

                {/* Chronology Notice */}
                <div className="p-4 bg-card">
                  {renderChronologyNotice(conflict)}
                </div>

                {/* Competing Claims Side-by-Side */}
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/70">
                  {/* Claim A */}
                  <div className="p-5 space-y-3 bg-card">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-primary flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-primary" />
                        Claim A (ID: {conflict.claimA.id.slice(0, 8)})
                      </span>
                      <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
                        review: {conflict.claimA.reviewState}
                      </span>
                    </div>

                    <div className="text-xs space-y-1.5">
                      <p className="text-[11px] text-muted-foreground font-medium">Extracted Value</p>
                      <div className="font-semibold text-foreground text-sm bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-border">
                        {conflict.claimA.valueRaw}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Normalized: <span className="font-mono text-foreground font-semibold">{conflict.claimA.valueNormalized || "(null)"}</span>
                      </p>
                    </div>

                    {conflict.claimA.evidence[0] && (
                      <div className="text-xs space-y-2 border-t border-border/60 pt-3">
                        <div className="text-muted-foreground flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-foreground flex items-center gap-1">
                            <FileText className="h-3 w-3 text-primary" />
                            {conflict.claimA.evidence[0].document.fileName}
                          </span>
                          <span className="font-mono">{conflict.claimA.evidence[0].sourceLocation}</span>
                        </div>
                        <blockquote className="italic border-l-2 border-primary/50 pl-2.5 py-0.5 text-xs text-foreground bg-slate-50/50 dark:bg-slate-900/20 rounded-r">
                          &ldquo;{conflict.claimA.evidence[0].excerpt}&rdquo;
                        </blockquote>
                        <p className="text-[11px] text-muted-foreground">
                          Date: <strong className="text-foreground">{conflict.claimA.evidence[0].document.sourceDate ? formatDate(conflict.claimA.evidence[0].document.sourceDate) : "(none)"}</strong>{" "}
                          (basis: <span className="font-mono">{conflict.claimA.evidence[0].document.sourceDateBasis}</span>)
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Claim B */}
                  <div className="p-5 space-y-3 bg-card">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-rose-600 dark:bg-rose-400" />
                        Claim B (ID: {conflict.claimB.id.slice(0, 8)})
                      </span>
                      <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
                        review: {conflict.claimB.reviewState}
                      </span>
                    </div>

                    <div className="text-xs space-y-1.5">
                      <p className="text-[11px] text-muted-foreground font-medium">Extracted Value</p>
                      <div className="font-semibold text-foreground text-sm bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-border">
                        {conflict.claimB.valueRaw}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Normalized: <span className="font-mono text-foreground font-semibold">{conflict.claimB.valueNormalized || "(null)"}</span>
                      </p>
                    </div>

                    {conflict.claimB.evidence[0] && (
                      <div className="text-xs space-y-2 border-t border-border/60 pt-3">
                        <div className="text-muted-foreground flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-foreground flex items-center gap-1">
                            <FileText className="h-3 w-3 text-rose-600" />
                            {conflict.claimB.evidence[0].document.fileName}
                          </span>
                          <span className="font-mono">{conflict.claimB.evidence[0].sourceLocation}</span>
                        </div>
                        <blockquote className="italic border-l-2 border-rose-500/50 pl-2.5 py-0.5 text-xs text-foreground bg-slate-50/50 dark:bg-slate-900/20 rounded-r">
                          &ldquo;{conflict.claimB.evidence[0].excerpt}&rdquo;
                        </blockquote>
                        <p className="text-[11px] text-muted-foreground">
                          Date: <strong className="text-foreground">{conflict.claimB.evidence[0].document.sourceDate ? formatDate(conflict.claimB.evidence[0].document.sourceDate) : "(none)"}</strong>{" "}
                          (basis: <span className="font-mono">{conflict.claimB.evidence[0].document.sourceDateBasis}</span>)
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Resolution Notes if resolved */}
                {conflict.resolutionNotes && (
                  <div className="p-3.5 bg-slate-50/75 dark:bg-slate-900/40 text-xs text-muted-foreground flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground">Resolution Record</p>
                      <p className="text-foreground mt-0.5 leading-relaxed">{conflict.resolutionNotes}</p>
                      {conflict.resolvedByUser && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Decided by {conflict.resolvedByUser.name} ({conflict.resolvedByUser.email}) on {formatDateTime(conflict.resolvedAt!)}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Conflict Resolution Modal */}
      {resolvingConflict && (
        <Modal
          isOpen={!!resolvingConflict}
          onClose={() => setResolvingConflict(null)}
          title="Resolve Knowledge Conflict"
          description={`Choose the authoritative fact for ${resolvingConflict.subjectEntity.canonicalName}.${resolvingConflict.attributeKey}`}
        >
          <form onSubmit={handleResolveSubmit} className="space-y-4 text-xs">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 p-3.5 border border-border space-y-1.5">
              <div><strong className="text-foreground">Subject:</strong> {resolvingConflict.subjectEntity.canonicalName}</div>
              <div><strong className="text-foreground">Attribute:</strong> {resolvingConflict.attributeKey}</div>
              <div><strong className="text-foreground">Claim A:</strong> &ldquo;{resolvingConflict.claimA.valueRaw}&rdquo;</div>
              <div><strong className="text-foreground">Claim B:</strong> &ldquo;{resolvingConflict.claimB.valueRaw}&rdquo;</div>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Select Resolution Action</label>
              <select
                value={resolutionAction}
                onChange={(e) => setResolutionAction(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
              >
                <option value="CHOOSE_A">Choose Claim A (Reject Claim B)</option>
                <option value="CHOOSE_B">Choose Claim B (Reject Claim A)</option>
                {resolvingConflict.attributeKey === "owner" && (
                  <option value="KEEP_BOTH">Keep Both as Co-owners (Permitted for owner attribute)</option>
                )}
                <option value="CONFIRM_SUPERSEDED">Confirm Superseded (Based on verified document dates)</option>
                <option value="REQUIRES_CLARIFICATION">Mark Requires Clarification from Owner</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Written Rationale / Justification (Mandatory)</label>
              <textarea
                required
                rows={3}
                value={resolutionReason}
                onChange={(e) => setResolutionReason(e.target.value)}
                placeholder="Explain why this resolution was chosen based on authoritative source evidence..."
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setResolvingConflict(null)}
                className="rounded-lg border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingResolution}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-primary/90 transition-colors disabled:opacity-40 cursor-pointer"
              >
                {submittingResolution && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Submit Resolution
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
