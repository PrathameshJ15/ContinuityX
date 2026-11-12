"use client";

import React, { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import { formatDate, formatDateTime } from "@/lib/date";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  HelpCircle,
  Loader2,
  RotateCw,
  ShieldAlert,
  X,
} from "lucide-react";

interface ConflictItem {
  id: string;
  projectId: string;
  subjectEntityId: string;
  attributeKey: string;
  claimAId: string;
  claimBId: string;
  conflictType: string;
  status: "OPEN" | "POSSIBLY_SUPERSEDED" | "RESOLVED_MUTUAL_ACCEPT" | "RESOLVED_ONE_ACCEPTED" | "RESOLVED_BOTH_REJECTED" | "RESOLVED_EDITED" | "REQUIRES_CLARIFICATION";
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
        return (
          <span className="inline-flex items-center gap-1 rounded bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 px-2 py-0.5 text-xs font-semibold">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
            OPEN CONFLICT
          </span>
        );
      case "POSSIBLY_SUPERSEDED":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 px-2 py-0.5 text-xs font-semibold">
            <Clock className="h-3.5 w-3.5 text-amber-600" />
            POSSIBLY SUPERSEDED
          </span>
        );
      case "REQUIRES_CLARIFICATION":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 px-2 py-0.5 text-xs font-semibold">
            <HelpCircle className="h-3.5 w-3.5 text-purple-600" />
            CLARIFICATION NEEDED
          </span>
        );
      case "RESOLVED_MUTUAL_ACCEPT":
      case "RESOLVED_ONE_ACCEPTED":
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 text-xs font-semibold">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            {status}
          </span>
        );
    }
  }

  function renderChronologyNotice(conflict: ConflictItem) {
    const docA = conflict.claimA.evidence[0]?.document;
    const docB = conflict.claimB.evidence[0]?.document;

    const hasReliableDateA = docA?.sourceDate && docA.sourceDateBasis !== "UNKNOWN";
    const hasReliableDateB = docB?.sourceDate && docB.sourceDateBasis !== "UNKNOWN";

    if (!hasReliableDateA || !hasReliableDateB) {
      return (
        <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 p-2.5 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0 text-amber-600" />
          <span>
            <strong>Chronology unknown:</strong> At least one source document lacks a reliable date (source date basis is UNKNOWN). Per SPEC.md no-date rule, temporal order cannot be inferred automatically. Human resolution is required.
          </span>
        </div>
      );
    }

    const timeA = new Date(docA.sourceDate!).getTime();
    const timeB = new Date(docB.sourceDate!).getTime();

    if (timeA !== timeB) {
      const newerSide = timeA > timeB ? "Claim A" : "Claim B";
      const newerDoc = timeA > timeB ? docA.fileName : docB.fileName;
      return (
        <div className="rounded-md border border-blue-300/60 bg-blue-50 dark:bg-blue-950/20 p-2.5 text-xs text-blue-900 dark:text-blue-200 flex items-center gap-2">
          <Calendar className="h-4 w-4 shrink-0 text-blue-600" />
          <span>
            <strong>Dated discrepancy:</strong> Both documents have reliable dates. <strong>{newerSide}</strong> ({newerDoc}) is newer. Status initialized as <strong>POSSIBLY_SUPERSEDED</strong>; reviewer confirmation required.
          </span>
        </div>
      );
    }

    return (
      <div className="rounded-md border border-muted bg-muted/30 p-2.5 text-xs text-muted-foreground flex items-center gap-2">
        <Calendar className="h-4 w-4 shrink-0" />
        <span>Both source documents share the identical date. Conflict remains OPEN for human decision.</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Conflict Detection & Resolution</h1>
          <p className="text-sm text-muted-foreground">
            Deterministic pairwise contradictions between competing claims sharing the same subject and single-valued attribute.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadConflicts}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0" />
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

      {/* Filter Bar */}
      <div className="rounded-xl border bg-card p-4 flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
          <Filter className="h-3.5 w-3.5" /> Filter Status:
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border bg-background px-3 py-1.5 text-xs font-medium"
        >
          <option value="ALL">All Conflicts {counts ? `(${counts.ALL})` : ""}</option>
          <option value="OPEN">Open Conflicts {counts ? `(${counts.OPEN})` : ""}</option>
          <option value="POSSIBLY_SUPERSEDED">Possibly Superseded {counts ? `(${counts.POSSIBLY_SUPERSEDED})` : ""}</option>
          <option value="REQUIRES_CLARIFICATION">Requires Clarification {counts ? `(${counts.REQUIRES_CLARIFICATION})` : ""}</option>
          <option value="RESOLVED_ONE_ACCEPTED">Resolved (One Accepted)</option>
          <option value="RESOLVED_MUTUAL_ACCEPT">Resolved (Mutual Accept)</option>
        </select>
      </div>

      {/* Conflicts List */}
      {loading ? (
        <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
          <Loader2 className="h-8 w-8 mx-auto animate-spin mb-3 text-primary" />
          <p className="text-sm">Scanning and loading pairwise conflicts...</p>
        </div>
      ) : totalClaims === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
          <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold text-foreground text-base">No claims yet. Upload documents and run extraction first</h3>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Pairwise contradiction and conflict detection requires extracted claims to compare against each other.
          </p>
          <Link
            href={`/projects/${projectId}/documents`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Go to Documents
          </Link>
        </div>
      ) : conflicts.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
          <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500 mb-3" />
          <h3 className="font-semibold text-foreground text-base">No Conflicts Found</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {statusFilter === "ALL"
              ? "All candidate claims in this project are mutually consistent."
              : `No conflicts matching filter '${statusFilter}'.`}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {conflicts.map((conflict) => {
            const isResolved = conflict.status.startsWith("RESOLVED_");

            return (
              <div
                key={conflict.id}
                className="rounded-xl border bg-card shadow-sm overflow-hidden divide-y divide-border"
              >
                {/* Conflict Card Header */}
                <div className="bg-muted/30 p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    {renderStatusBadge(conflict.status)}
                    <span className="font-semibold text-foreground">
                      {conflict.subjectEntity.canonicalName}
                    </span>
                    <span className="text-muted-foreground font-mono">
                      · attribute: {conflict.attributeKey}
                    </span>
                    <span className="rounded bg-muted px-2 py-0.5 font-mono text-[11px]">
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
                      className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90"
                    >
                      Resolve Conflict
                    </button>
                  )}
                </div>

                {/* Chronology Notice */}
                <div className="p-4 bg-background">
                  {renderChronologyNotice(conflict)}
                </div>

                {/* Competing Claims Side-by-Side */}
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
                  {/* Claim A */}
                  <div className="p-4 space-y-3 bg-card">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-primary">Claim A (ID: {conflict.claimA.id.slice(0, 8)}...)</span>
                      <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-mono">
                        review: {conflict.claimA.reviewState}
                      </span>
                    </div>

                    <div className="text-xs space-y-1">
                      <div className="text-muted-foreground">Value Raw:</div>
                      <div className="font-semibold text-foreground text-sm bg-muted/40 p-2 rounded">
                        {conflict.claimA.valueRaw}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Normalized: <span className="font-mono">{conflict.claimA.valueNormalized || "(null)"}</span>
                      </div>
                    </div>

                    {conflict.claimA.evidence[0] && (
                      <div className="text-xs space-y-1 border-t pt-2">
                        <div className="text-muted-foreground flex items-center justify-between">
                          <span>Source: {conflict.claimA.evidence[0].document.fileName}</span>
                          <span>{conflict.claimA.evidence[0].sourceLocation}</span>
                        </div>
                        <blockquote className="italic border-l-2 border-primary/50 pl-2 text-muted-foreground">
                          &ldquo;{conflict.claimA.evidence[0].excerpt}&rdquo;
                        </blockquote>
                        <div className="text-[11px] text-muted-foreground">
                          Date: {conflict.claimA.evidence[0].document.sourceDate ? formatDate(conflict.claimA.evidence[0].document.sourceDate) : "(none)"} (basis: {conflict.claimA.evidence[0].document.sourceDateBasis})
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Claim B */}
                  <div className="p-4 space-y-3 bg-card">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-rose-600 dark:text-rose-400">Claim B (ID: {conflict.claimB.id.slice(0, 8)}...)</span>
                      <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-mono">
                        review: {conflict.claimB.reviewState}
                      </span>
                    </div>

                    <div className="text-xs space-y-1">
                      <div className="text-muted-foreground">Value Raw:</div>
                      <div className="font-semibold text-foreground text-sm bg-muted/40 p-2 rounded">
                        {conflict.claimB.valueRaw}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Normalized: <span className="font-mono">{conflict.claimB.valueNormalized || "(null)"}</span>
                      </div>
                    </div>

                    {conflict.claimB.evidence[0] && (
                      <div className="text-xs space-y-1 border-t pt-2">
                        <div className="text-muted-foreground flex items-center justify-between">
                          <span>Source: {conflict.claimB.evidence[0].document.fileName}</span>
                          <span>{conflict.claimB.evidence[0].sourceLocation}</span>
                        </div>
                        <blockquote className="italic border-l-2 border-rose-500/50 pl-2 text-muted-foreground">
                          &ldquo;{conflict.claimB.evidence[0].excerpt}&rdquo;
                        </blockquote>
                        <div className="text-[11px] text-muted-foreground">
                          Date: {conflict.claimB.evidence[0].document.sourceDate ? formatDate(conflict.claimB.evidence[0].document.sourceDate) : "(none)"} (basis: {conflict.claimB.evidence[0].document.sourceDateBasis})
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Resolution Notes if resolved */}
                {conflict.resolutionNotes && (
                  <div className="p-3 bg-muted/20 text-xs text-muted-foreground flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Resolution Record:</strong> {conflict.resolutionNotes}
                      {conflict.resolvedByUser && (
                        <span className="block text-[11px] text-muted-foreground/80 mt-0.5">
                          Resolved by {conflict.resolvedByUser.name} ({conflict.resolvedByUser.email}) on {formatDateTime(conflict.resolvedAt!)}
                        </span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base">Resolve Conflict</h3>
              <button
                onClick={() => setResolvingConflict(null)}
                className="rounded p-1 hover:bg-muted text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleResolveSubmit} className="space-y-4 text-xs">
              <div className="rounded-lg bg-muted/40 p-3 space-y-1">
                <div><strong>Subject:</strong> {resolvingConflict.subjectEntity.canonicalName}</div>
                <div><strong>Attribute:</strong> {resolvingConflict.attributeKey}</div>
                <div><strong>Claim A:</strong> &ldquo;{resolvingConflict.claimA.valueRaw}&rdquo;</div>
                <div><strong>Claim B:</strong> &ldquo;{resolvingConflict.claimB.valueRaw}&rdquo;</div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold">Select Resolution Action</label>
                <select
                  value={resolutionAction}
                  onChange={(e) => setResolutionAction(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-xs"
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
                <label className="font-semibold">Written Reason / Justification (Mandatory)</label>
                <textarea
                  required
                  rows={3}
                  value={resolutionReason}
                  onChange={(e) => setResolutionReason(e.target.value)}
                  placeholder="Explain why this resolution was chosen based on evidence..."
                  className="w-full rounded-md border bg-background px-3 py-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setResolvingConflict(null)}
                  className="rounded-md border px-4 py-2 hover:bg-muted font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingResolution}
                  className="rounded-md bg-primary text-primary-foreground px-4 py-2 font-medium hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {submittingResolution && <Loader2 className="h-3 w-3 animate-spin" />}
                  Submit Resolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
