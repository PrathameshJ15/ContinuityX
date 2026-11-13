"use client";

import React, { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/date";
import { getReviewQueueEmptyState } from "@/lib/empty-states";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  HelpCircle,
  Keyboard,
  Loader2,
  RotateCw,
  X,
  ShieldCheck,
  Check,
  Ban,
} from "lucide-react";

interface QueueItem {
  id: string;
  subjectEntity: {
    id: string;
    canonicalName: string;
    type: string;
  };
  attributeKey: string;
  valueRaw: string;
  valueNormalized: string | null;
  category: string;
  reviewState: string;
  version: number;
  injectionFlag: boolean;
  hasOpenConflict: boolean;
  latestVerification: {
    status: "VERIFIED" | "WEAK_SUPPORT" | "CONFLICTING" | "UNVERIFIED" | "UNKNOWN";
    sourceGate: "PASS" | "FAIL";
    sourceGateReason: string | null;
    quoteGate: "PASS" | "FAIL";
    quoteGateReason: string | null;
    quoteSimilarity: number | null;
    semanticGate: string | null;
    semanticReason: string | null;
    contradictionGate: "PASS" | "FAIL";
    contradictionCount: number;
    ruleSetVersion: string;
    judgeModel: string | null;
    judgePromptVersion: string | null;
  } | null;
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
    chunk?: {
      content: string;
      pageNumber: number | null;
      sectionTitle: string | null;
      rowStart: number | null;
      rowEnd: number | null;
    } | null;
  }>;
}

interface ReviewQueueData {
  metrics: {
    totalClaims: number;
    pendingCount: number;
    acceptedCount: number;
    rejectedCount: number;
    openConflictsCount: number;
  };
  queue: QueueItem[];
}

export default function ReviewSplitPanePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.projectId;

  const [queueData, setQueueData] = useState<ReviewQueueData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modals
  const [acceptReasonModalOpen, setAcceptReasonModalOpen] = useState(false);
  const [acceptReasonText, setAcceptReasonText] = useState("");
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectComments, setRejectComments] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  const loadQueue = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/projects/${projectId}/review/queue`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to load review queue");

      setQueueData(json.data);
      if (json.data.queue.length === 0) {
        setCurrentIndex(0);
      } else if (currentIndex >= json.data.queue.length) {
        setCurrentIndex(Math.max(0, json.data.queue.length - 1));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load review queue");
    } finally {
      setLoading(false);
    }
  }, [projectId, currentIndex]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const currentClaim = queueData?.queue[currentIndex] || null;

  const handleNext = useCallback(() => {
    if (!queueData?.queue.length) return;
    setCurrentIndex((prev) => (prev + 1 < queueData.queue.length ? prev + 1 : 0));
  }, [queueData]);

  const handlePrev = useCallback(() => {
    if (!queueData?.queue.length) return;
    setCurrentIndex((prev) => (prev - 1 >= 0 ? prev - 1 : queueData.queue.length - 1));
  }, [queueData]);

  // Execute review decision API
  const submitDecision = useCallback(
    async (
      decision: "ACCEPTED" | "REJECTED" | "NEEDS_CLARIFICATION",
      opts?: { reason?: string; comments?: string }
    ) => {
      if (!currentClaim) return;

      try {
        setSubmittingAction(true);
        setError(null);

        const res = await fetch(`/api/projects/${projectId}/claims/${currentClaim.id}/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedVersion: currentClaim.version,
            decision,
            reason: opts?.reason,
            comments: opts?.comments,
          }),
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message || "Review action failed");

        setSuccess(`Claim ${decision.toLowerCase()} successfully.`);
        setAcceptReasonModalOpen(false);
        setAcceptReasonText("");
        setRejectModalOpen(false);
        setRejectComments("");

        await loadQueue();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Review action failed");
      } finally {
        setSubmittingAction(false);
      }
    },
    [currentClaim, projectId, loadQueue]
  );

  const handleAcceptClick = useCallback(() => {
    if (!currentClaim) return;
    if (currentClaim.hasOpenConflict) {
      setError("Cannot accept: this claim is in an OPEN conflict. Resolve the conflict first in the Conflicts tab.");
      return;
    }

    const status = currentClaim.latestVerification?.status || "UNVERIFIED";
    if (status !== "VERIFIED") {
      setAcceptReasonText("");
      setAcceptReasonModalOpen(true);
    } else {
      submitDecision("ACCEPTED");
    }
  }, [currentClaim, submitDecision]);

  const handleRejectClick = useCallback(() => {
    if (!currentClaim) return;
    setRejectComments("");
    setRejectModalOpen(true);
  }, [currentClaim]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        handleAcceptClick();
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        handleRejectClick();
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        handlePrev();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleAcceptClick, handleRejectClick, handleNext, handlePrev]);

  function renderStatusBadge(status?: string) {
    switch (status) {
      case "VERIFIED":
        return <Badge variant="verified">VERIFIED</Badge>;
      case "WEAK_SUPPORT":
        return <Badge variant="weak">WEAK SUPPORT</Badge>;
      case "CONFLICTING":
        return <Badge variant="contradicted">CONFLICTING</Badge>;
      case "UNVERIFIED":
        return <Badge variant="unverified">UNVERIFIED</Badge>;
      case "UNKNOWN":
      default:
        return <Badge variant="neutral">UNKNOWN</Badge>;
    }
  }

  const emptyInfo = getReviewQueueEmptyState(
    queueData?.metrics.totalClaims ?? 0,
    queueData?.queue.length ?? 0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        breadcrumbs={
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link href="/dashboard" className="hover:text-foreground">Projects</Link>
            <span>/</span>
            <Link href={`/projects/${projectId}`} className="hover:text-foreground">Project</Link>
            <span>/</span>
            <span className="text-foreground font-medium">Evidence Review</span>
          </div>
        }
        title="Evidence Review Queue"
        description="Inspect candidate claims directly alongside cited document excerpts with keyboard shortcuts."
        actions={
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-1.5 text-xs bg-slate-100 dark:bg-slate-800/80 border border-border rounded-lg px-3 py-1.5 text-muted-foreground">
              <Keyboard className="h-3.5 w-3.5 text-primary mr-0.5" />
              <span>Keys:</span>
              <kbd className="bg-card border border-border rounded px-1.5 py-0.5 font-mono text-[11px] text-foreground font-semibold">A</kbd> Accept
              <kbd className="bg-card border border-border rounded px-1.5 py-0.5 font-mono text-[11px] text-foreground font-semibold ml-1">R</kbd> Reject
              <kbd className="bg-card border border-border rounded px-1.5 py-0.5 font-mono text-[11px] text-foreground font-semibold ml-1">N</kbd> Next
            </div>

            <button
              onClick={loadQueue}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
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

      {/* Metrics & Queue Position Ribbon */}
      {queueData && (
        <div className="rounded-xl border border-border bg-card p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Queue Position: <strong className="text-primary">{queueData.queue.length > 0 ? currentIndex + 1 : 0}</strong> of {queueData.queue.length}
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">
              {queueData.metrics.pendingCount} Pending Review
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-medium">
              {queueData.metrics.acceptedCount} Accepted
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="text-rose-700 dark:text-rose-400 font-medium">
              {queueData.metrics.rejectedCount} Rejected
            </span>
            {queueData.metrics.openConflictsCount > 0 && (
              <span className="text-rose-600 font-semibold flex items-center gap-1 bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded-md border border-rose-200">
                <AlertTriangle className="h-3.5 w-3.5" />
                {queueData.metrics.openConflictsCount} Open Conflicts
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrev}
              disabled={queueData.queue.length <= 1}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              title="Previous claim (P)"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev (P)
            </button>
            <button
              onClick={handleNext}
              disabled={queueData.queue.length <= 1}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              title="Next claim (N)"
            >
              Next (N) <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Review Workspace */}
      {loading ? (
        <TableSkeleton rows={5} />
      ) : emptyInfo.state === "NO_DATA" ? (
        <EmptyState
          type="no-data"
          title={emptyInfo.title}
          description={emptyInfo.description}
          actionHref={`/projects/${projectId}/documents`}
          actionLabel={emptyInfo.linkLabel || "Go to Documents"}
        />
      ) : emptyInfo.state === "CHECKED_EMPTY" || !currentClaim ? (
        <EmptyState
          type="completed"
          title={emptyInfo.title || "Review Queue Complete!"}
          description={
            emptyInfo.description ||
            "All extracted candidate claims in this project have been reviewed or resolved. You are ready to inspect conflicts or generate the handover snapshot."
          }
          actionHref={`/projects/${projectId}/handover`}
          actionLabel="Go to Handover Workspace"
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Pane: Claim Details, Gates & Actions (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-border/80 pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground font-semibold">
                    Fact #{currentClaim.id.slice(0, 8)} (v{currentClaim.version})
                  </span>
                  {currentClaim.injectionFlag && (
                    <Badge variant="destructive">INJECTION FLAGGED</Badge>
                  )}
                </div>
                {renderStatusBadge(currentClaim.latestVerification?.status)}
              </div>

              {/* Conflict warning if present */}
              {currentClaim.hasOpenConflict && (
                <div className="rounded-lg border border-rose-500/20 bg-rose-50/60 dark:bg-rose-950/20 p-3 text-xs text-rose-900 dark:text-rose-200 flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                  <div>
                    <p className="font-semibold">Unresolved Conflict Blocker</p>
                    <p className="text-[11px] text-rose-800 dark:text-rose-300 mt-0.5 leading-relaxed">
                      This claim is involved in an active OPEN conflict. Per SPEC.md invariants, it cannot be accepted into the handover snapshot until resolved in the Conflicts workspace.
                    </p>
                  </div>
                </div>
              )}

              {/* Claim Triple */}
              <div className="space-y-3 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-border text-xs">
                <div>
                  <span className="text-[11px] text-muted-foreground font-semibold block uppercase tracking-wider">
                    Subject Entity:
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-bold text-base text-foreground">
                      {currentClaim.subjectEntity.canonicalName}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      {currentClaim.subjectEntity.type}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-muted-foreground font-semibold block uppercase tracking-wider">
                    Attribute & Dimension:
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-foreground font-bold text-sm">
                      .{currentClaim.attributeKey}
                    </span>
                    <span className="rounded-md bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-semibold">
                      {currentClaim.category}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-muted-foreground font-semibold block uppercase tracking-wider">
                    Extracted Value:
                  </span>
                  <div className="font-semibold text-sm text-foreground bg-card p-2.5 rounded-lg border border-border mt-1 shadow-xs">
                    {currentClaim.valueRaw}
                  </div>
                  {currentClaim.valueNormalized && (
                    <div className="text-[11px] text-muted-foreground mt-1.5">
                      Normalized canonical form: <span className="font-mono text-foreground font-semibold">{currentClaim.valueNormalized}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Verification Gates Summary */}
              {currentClaim.latestVerification && (
                <div className="space-y-2.5 border border-border rounded-xl p-3.5 text-xs bg-card">
                  <div className="font-semibold text-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      4-Gate Evidence Proof
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {currentClaim.latestVerification.ruleSetVersion}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-border/60">
                      <span className="text-muted-foreground">Gate 1 (Source):</span>
                      <span className={`font-bold ${currentClaim.latestVerification.sourceGate === "PASS" ? "text-emerald-600" : "text-rose-600"}`}>
                        {currentClaim.latestVerification.sourceGate}
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-border/60">
                      <span className="text-muted-foreground">Gate 2 (Quote):</span>
                      <span className={`font-bold ${currentClaim.latestVerification.quoteGate === "PASS" ? "text-emerald-600" : "text-rose-600"}`}>
                        {currentClaim.latestVerification.quoteGate} {currentClaim.latestVerification.quoteSimilarity !== null ? `(${Math.round(currentClaim.latestVerification.quoteSimilarity * 100)}%)` : ""}
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-border/60">
                      <span className="text-muted-foreground">Gate 3 (Judge):</span>
                      <span className="font-mono font-semibold text-foreground">
                        {currentClaim.latestVerification.semanticGate || "SKIPPED"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-border/60">
                      <span className="text-muted-foreground">Gate 4 (Conflict):</span>
                      <span className={`font-bold ${currentClaim.latestVerification.contradictionGate === "PASS" ? "text-emerald-600" : "text-rose-600"}`}>
                        {currentClaim.latestVerification.contradictionGate === "PASS" ? "PASS" : "FAIL"}
                      </span>
                    </div>
                  </div>

                  {currentClaim.latestVerification.semanticReason && (
                    <p className="text-[11px] text-muted-foreground italic border-t border-border/60 pt-2 leading-relaxed">
                      Judge Reason: &ldquo;{currentClaim.latestVerification.semanticReason}&rdquo;
                    </p>
                  )}
                </div>
              )}

              {/* Review Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleAcceptClick}
                  disabled={submittingAction || currentClaim.hasOpenConflict}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
                  title="Accept claim into handover (Shortcut: A)"
                >
                  <Check className="h-4 w-4" />
                  Accept (A)
                </button>

                <button
                  onClick={handleRejectClick}
                  disabled={submittingAction}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
                  title="Reject claim (Shortcut: R)"
                >
                  <Ban className="h-4 w-4" />
                  Reject (R)
                </button>

                <button
                  onClick={() => submitDecision("NEEDS_CLARIFICATION", { comments: "Clarification requested from project owner" })}
                  disabled={submittingAction}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors shadow-xs cursor-pointer"
                  title="Request clarification from project owner"
                >
                  <HelpCircle className="h-4 w-4 text-purple-600" />
                  Clarify
                </button>

                <button
                  onClick={handleNext}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors shadow-xs cursor-pointer"
                  title="Next claim (Shortcut: N)"
                >
                  <ArrowRight className="h-4 w-4" />
                  Next (N)
                </button>
              </div>
            </div>
          </div>

          {/* Right Pane: Source Document & Highlighted Excerpt (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-xs min-h-[500px]">
              <div className="flex items-center justify-between border-b border-border/80 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="font-bold text-sm text-foreground">
                    Document Evidence & Source Verification
                  </span>
                </div>
                {currentClaim.evidence[0] && (
                  <span className="text-xs text-muted-foreground font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                    {currentClaim.evidence[0].sourceLocation}
                  </span>
                )}
              </div>

              {currentClaim.evidence.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-xs">
                  No evidence reference linked to this candidate claim.
                </div>
              ) : (
                currentClaim.evidence.map((ev, idx) => {
                  const chunkText = ev.chunk?.content || "";
                  const excerpt = ev.excerpt.trim();

                  let preText = chunkText;
                  let matchText = "";
                  let postText = "";

                  if (chunkText && excerpt && chunkText.includes(excerpt)) {
                    const startIdx = chunkText.indexOf(excerpt);
                    preText = chunkText.slice(0, startIdx);
                    matchText = excerpt;
                    postText = chunkText.slice(startIdx + excerpt.length);
                  }

                  return (
                    <div key={ev.id || idx} className="space-y-4 text-xs">
                      {/* Document Metadata Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-border text-[11px] text-muted-foreground">
                        <div>
                          <strong className="text-foreground">File:</strong> {ev.document.fileName}
                        </div>
                        <div>
                          <strong className="text-foreground">Source Date:</strong> {ev.document.sourceDate ? formatDate(ev.document.sourceDate) : "(none)"} (basis: <span className="font-mono">{ev.document.sourceDateBasis}</span>)
                        </div>
                        <div>
                          <strong className="text-foreground">Location:</strong> {ev.sourceLocation}
                        </div>
                      </div>

                      {/* Cited Excerpt Highlight Box */}
                      <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-4 space-y-1.5 shadow-xs">
                        <span className="font-semibold text-primary text-[11px] uppercase tracking-wider block">
                          Cited Verbatim Excerpt:
                        </span>
                        <blockquote className="text-foreground text-sm font-medium italic leading-relaxed">
                          &ldquo;{ev.excerpt}&rdquo;
                        </blockquote>
                      </div>

                      {/* Full Surrounding Chunk Context */}
                      <div className="space-y-2 pt-2">
                        <span className="font-semibold text-muted-foreground text-[11px] uppercase tracking-wider block">
                          Full Chunk Text Context:
                        </span>
                        <div className="rounded-xl border border-border bg-slate-50/50 dark:bg-slate-900/30 p-4 font-serif text-sm leading-relaxed whitespace-pre-wrap text-foreground max-h-96 overflow-y-auto">
                          {matchText ? (
                            <>
                              <span>{preText}</span>
                              <mark className="bg-amber-200 dark:bg-amber-900/60 text-foreground px-1 py-0.5 rounded font-medium">
                                {matchText}
                              </mark>
                              <span>{postText}</span>
                            </>
                          ) : (
                            <span>{chunkText || ev.excerpt}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Accept Non-VERIFIED Reason Modal */}
      {acceptReasonModalOpen && (
        <Modal
          isOpen={acceptReasonModalOpen}
          onClose={() => setAcceptReasonModalOpen(false)}
          title="Acceptance Rationale Required"
          description="Per SPEC.md rules, accepting any claim without strict VERIFIED status requires an explicit recorded reason."
        >
          <div className="space-y-4 text-xs">
            <p className="text-muted-foreground">
              This claim currently holds evidence status <strong className="text-foreground">{currentClaim?.latestVerification?.status || "UNVERIFIED"}</strong>. Provide the rationale for overriding verification.
            </p>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Reviewer Justification</label>
              <textarea
                rows={3}
                required
                value={acceptReasonText}
                onChange={(e) => setAcceptReasonText(e.target.value)}
                placeholder="State why this claim is accepted despite weak/unverified status (e.g., confirmed out-of-band with engineering lead)..."
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setAcceptReasonModalOpen(false)}
                className="rounded-lg border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingAction || !acceptReasonText.trim()}
                onClick={() => submitDecision("ACCEPTED", { reason: acceptReasonText.trim() })}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 text-white px-4 py-1.5 text-xs font-semibold shadow-xs hover:bg-emerald-700 transition-colors disabled:opacity-40 cursor-pointer"
              >
                {submittingAction && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm Acceptance
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reject Modal */}
      {rejectModalOpen && (
        <Modal
          isOpen={rejectModalOpen}
          onClose={() => setRejectModalOpen(false)}
          title="Reject Candidate Claim"
          description="Rejecting prevents this claim from entering the project handover snapshot."
        >
          <div className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Rejection Notes / Comments (Optional)</label>
              <textarea
                rows={3}
                value={rejectComments}
                onChange={(e) => setRejectComments(e.target.value)}
                placeholder="Explain why this claim is invalid or rejected from the project corpus..."
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="rounded-lg border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingAction}
                onClick={() => submitDecision("REJECTED", { comments: rejectComments.trim() })}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 text-white px-4 py-1.5 text-xs font-semibold shadow-xs hover:bg-rose-700 transition-colors disabled:opacity-40 cursor-pointer"
              >
                {submittingAction && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Reject Claim
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
