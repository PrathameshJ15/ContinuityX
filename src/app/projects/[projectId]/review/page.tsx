"use client";

import React, { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileQuestion,
  FileText,
  HelpCircle,
  Keyboard,
  Loader2,
  RotateCw,
  X,
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
      setError("Cannot accept: this claim is in an OPEN conflict. Resolve the conflict first.");
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
      // Don't fire shortcuts when typing in inputs/textareas
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
        return (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 text-xs font-semibold">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            VERIFIED
          </span>
        );
      case "WEAK_SUPPORT":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 px-2 py-0.5 text-xs font-semibold">
            <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
            WEAK SUPPORT
          </span>
        );
      case "CONFLICTING":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 px-2 py-0.5 text-xs font-semibold">
            <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
            CONFLICTING
          </span>
        );
      case "UNVERIFIED":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 text-xs font-semibold">
            <FileQuestion className="h-3.5 w-3.5 text-slate-500" />
            UNVERIFIED
          </span>
        );
      case "UNKNOWN":
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 px-2 py-0.5 text-xs font-semibold">
            <HelpCircle className="h-3.5 w-3.5 text-purple-600" />
            UNKNOWN
          </span>
        );
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Bar with Queue Progress & Shortcuts Guide */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Split-Pane Evidence Review</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Evaluate candidate claims directly alongside cited document excerpts with keyboard shortcuts.
          </p>
        </div>

        {queueData && (
          <div className="flex items-center gap-3">
            {/* Keyboard shortcut badges */}
            <div className="hidden lg:flex items-center gap-1.5 text-[11px] bg-muted/50 border rounded-lg px-2.5 py-1 text-muted-foreground">
              <Keyboard className="h-3.5 w-3.5 text-primary" />
              <span>Shortcuts:</span>
              <kbd className="bg-background border rounded px-1 font-mono">A</kbd> Accept
              <kbd className="bg-background border rounded px-1 font-mono ml-1">R</kbd> Reject
              <kbd className="bg-background border rounded px-1 font-mono ml-1">N</kbd> Next
            </div>

            <button
              onClick={loadQueue}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
            >
              <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        )}
      </div>

      {/* Progress & Queue Counter */}
      {queueData && (
        <div className="rounded-xl border bg-card p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-foreground">
              Queue Position: {queueData.queue.length > 0 ? currentIndex + 1 : 0} of {queueData.queue.length}
            </span>
            <span className="text-muted-foreground">
              · {queueData.metrics.pendingCount} Pending
            </span>
            <span className="text-emerald-700 dark:text-emerald-400">
              · {queueData.metrics.acceptedCount} Accepted
            </span>
            <span className="text-rose-700 dark:text-rose-400">
              · {queueData.metrics.rejectedCount} Rejected
            </span>
            {queueData.metrics.openConflictsCount > 0 && (
              <span className="text-rose-600 font-semibold flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                {queueData.metrics.openConflictsCount} Open Conflicts
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={queueData.queue.length <= 1}
              className="rounded border p-1 hover:bg-muted disabled:opacity-40"
              title="Previous claim (P)"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleNext}
              disabled={queueData.queue.length <= 1}
              className="rounded border p-1 hover:bg-muted disabled:opacity-40"
              title="Next claim (N)"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Error / Success Notifications */}
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

      {/* Split-Pane Body */}
      {loading ? (
        <div className="rounded-xl border bg-card p-16 text-center text-muted-foreground">
          <Loader2 className="h-8 w-8 mx-auto animate-spin mb-3 text-primary" />
          <p className="text-sm">Loading review candidate queue...</p>
        </div>
      ) : queueData?.metrics.totalClaims === 0 ? (
        <div className="rounded-xl border bg-card p-16 text-center text-muted-foreground">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-bold text-foreground text-lg">No claims yet. Upload documents and run extraction first</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 mb-4">
            Upload project documentation and run automated claim extraction to populate the evidence review queue.
          </p>
          <Link
            href={`/projects/${projectId}/documents`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Go to Documents
          </Link>
        </div>
      ) : !currentClaim ? (
        <div className="rounded-xl border bg-card p-16 text-center text-muted-foreground">
          <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-3" />
          <h3 className="font-bold text-foreground text-lg">Review Queue Complete!</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
            All extracted candidate claims in this project have been reviewed or resolved. You are ready to inspect conflicts or generate the handover snapshot.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Pane: Claim Details, Gates & Actions (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-xl border bg-card p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    ID: {currentClaim.id.slice(0, 8)}... (v{currentClaim.version})
                  </span>
                  {currentClaim.injectionFlag && (
                    <span className="rounded bg-rose-100 text-rose-800 px-1.5 py-0.5 text-[10px] font-bold">
                      INJECTION FLAGGED
                    </span>
                  )}
                </div>
                {renderStatusBadge(currentClaim.latestVerification?.status)}
              </div>

              {/* Conflict warning if present */}
              {currentClaim.hasOpenConflict && (
                <div className="rounded-lg border border-rose-300 bg-rose-50 dark:bg-rose-950/20 p-3 text-xs text-rose-900 dark:text-rose-200 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                  <div>
                    <strong>Unresolved Conflict:</strong> This claim is involved in an active OPEN conflict. Per SPEC.md, it cannot be accepted until resolved in the Conflicts tab.
                  </div>
                </div>
              )}

              {/* Claim Triple */}
              <div className="space-y-3 bg-muted/30 p-3.5 rounded-lg text-xs">
                <div>
                  <span className="text-muted-foreground font-medium block">Subject Entity:</span>
                  <span className="font-bold text-sm text-foreground">
                    {currentClaim.subjectEntity.canonicalName}
                  </span>
                  <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                    ({currentClaim.subjectEntity.type})
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground font-medium block">Attribute:</span>
                  <span className="font-mono text-foreground font-semibold">
                    {currentClaim.attributeKey}
                  </span>
                  <span className="ml-2 text-muted-foreground font-mono text-[11px]">
                    [{currentClaim.category}]
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground font-medium block">Claim Value:</span>
                  <div className="font-semibold text-sm text-foreground bg-background p-2 rounded border mt-0.5">
                    {currentClaim.valueRaw}
                  </div>
                  {currentClaim.valueNormalized && (
                    <div className="text-[11px] text-muted-foreground mt-1">
                      Normalized: <span className="font-mono">{currentClaim.valueNormalized}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Verification Gates Summary */}
              {currentClaim.latestVerification && (
                <div className="space-y-2 border rounded-lg p-3 text-xs bg-card">
                  <div className="font-semibold text-foreground flex items-center justify-between">
                    <span>4-Gate Proof Breakdown</span>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {currentClaim.latestVerification.ruleSetVersion}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex items-center justify-between bg-muted/40 p-1.5 rounded">
                      <span>Gate 1 (Source):</span>
                      <span className={`font-bold ${currentClaim.latestVerification.sourceGate === "PASS" ? "text-emerald-600" : "text-rose-600"}`}>
                        {currentClaim.latestVerification.sourceGate}
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-muted/40 p-1.5 rounded">
                      <span>Gate 2 (Quote):</span>
                      <span className={`font-bold ${currentClaim.latestVerification.quoteGate === "PASS" ? "text-emerald-600" : "text-rose-600"}`}>
                        {currentClaim.latestVerification.quoteGate} {currentClaim.latestVerification.quoteSimilarity !== null ? `(${Math.round(currentClaim.latestVerification.quoteSimilarity * 100)}%)` : ""}
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-muted/40 p-1.5 rounded">
                      <span>Gate 3 (Judge):</span>
                      <span className="font-mono font-semibold">
                        {currentClaim.latestVerification.semanticGate || "SKIPPED"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-muted/40 p-1.5 rounded">
                      <span>Gate 4 (Conflict):</span>
                      <span className={`font-bold ${currentClaim.latestVerification.contradictionGate === "PASS" ? "text-emerald-600" : "text-rose-600"}`}>
                        {currentClaim.latestVerification.contradictionGate === "PASS" ? "NO CONFLICT" : "CONFLICT"}
                      </span>
                    </div>
                  </div>

                  {currentClaim.latestVerification.semanticReason && (
                    <p className="text-[11px] text-muted-foreground italic border-t pt-1.5">
                      Judge Reason: &ldquo;{currentClaim.latestVerification.semanticReason}&rdquo;
                    </p>
                  )}
                </div>
              )}

              {/* Review Action Buttons */}
              <div className="pt-2 flex flex-wrap gap-2">
                <button
                  onClick={handleAcceptClick}
                  disabled={submittingAction || currentClaim.hasOpenConflict}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 text-xs font-semibold shadow disabled:opacity-50"
                  title="Accept claim (Shortcut: A)"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Accept (A)
                </button>

                <button
                  onClick={handleRejectClick}
                  disabled={submittingAction}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 text-xs font-semibold shadow disabled:opacity-50"
                  title="Reject claim (Shortcut: R)"
                >
                  <X className="h-4 w-4" />
                  Reject (R)
                </button>

                <button
                  onClick={() => submitDecision("NEEDS_CLARIFICATION", { comments: "Clarification requested from project owner" })}
                  disabled={submittingAction}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border bg-background px-3 py-2 text-xs font-medium hover:bg-muted"
                  title="Request clarification"
                >
                  <HelpCircle className="h-4 w-4 text-purple-600" />
                  Clarify
                </button>

                <button
                  onClick={handleNext}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border bg-background px-3 py-2 text-xs font-medium hover:bg-muted"
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
            <div className="rounded-xl border bg-card p-5 space-y-4 shadow-sm min-h-[500px]">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="font-bold text-sm text-foreground">
                    Document Evidence & Source Verification
                  </span>
                </div>
                {currentClaim.evidence[0] && (
                  <span className="text-xs text-muted-foreground font-mono">
                    {currentClaim.evidence[0].sourceLocation}
                  </span>
                )}
              </div>

              {currentClaim.evidence.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-xs">
                  No evidence reference linked to this claim.
                </div>
              ) : (
                currentClaim.evidence.map((ev, idx) => {
                  const chunkText = ev.chunk?.content || "";
                  const excerpt = ev.excerpt.trim();

                  // Highlight excerpt inside chunk text if available
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
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/40 p-2.5 rounded-lg text-[11px] text-muted-foreground">
                        <div>
                          <strong>File:</strong> {ev.document.fileName}
                        </div>
                        <div>
                          <strong>Source Date:</strong> {ev.document.sourceDate ? new Date(ev.document.sourceDate).toLocaleDateString() : "(none)"} (basis: {ev.document.sourceDateBasis})
                        </div>
                        <div>
                          <strong>Location:</strong> {ev.sourceLocation}
                        </div>
                      </div>

                      {/* Cited Excerpt Highlight Box */}
                      <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3.5 space-y-1.5">
                        <span className="font-semibold text-primary text-[11px] uppercase tracking-wider block">
                          Cited Verbatim Excerpt:
                        </span>
                        <blockquote className="text-foreground text-sm font-medium italic">
                          &ldquo;{ev.excerpt}&rdquo;
                        </blockquote>
                      </div>

                      {/* Full Surrounding Chunk Context */}
                      <div className="space-y-1.5 pt-2">
                        <span className="font-semibold text-muted-foreground text-[11px] uppercase tracking-wider block">
                          Full Chunk Text Context:
                        </span>
                        <div className="rounded-lg border bg-muted/20 p-4 font-serif text-sm leading-relaxed whitespace-pre-wrap text-foreground max-h-96 overflow-y-auto">
                          {matchText ? (
                            <>
                              <span>{preText}</span>
                              <mark className="bg-amber-200 dark:bg-amber-900/50 text-foreground px-1 py-0.5 rounded font-medium">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base">Acceptance Reason Required</h3>
              <button
                onClick={() => setAcceptReasonModalOpen(false)}
                className="rounded p-1 hover:bg-muted text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="text-xs text-muted-foreground space-y-2">
              <p>
                This claim has evidence status <strong>{currentClaim?.latestVerification?.status || "UNVERIFIED"}</strong>. Per SPEC.md V3.2 rules, accepting any non-VERIFIED claim into the handover requires an explicit written reason.
              </p>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="font-semibold">Reviewer Reason / Justification</label>
              <textarea
                rows={3}
                required
                value={acceptReasonText}
                onChange={(e) => setAcceptReasonText(e.target.value)}
                placeholder="State why this claim is accepted despite weak/unverified status (e.g. verified out-of-band with lead)..."
                className="w-full rounded-md border bg-background px-3 py-2 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t text-xs">
              <button
                type="button"
                onClick={() => setAcceptReasonModalOpen(false)}
                className="rounded-md border px-4 py-2 hover:bg-muted font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingAction || !acceptReasonText.trim()}
                onClick={() => submitDecision("ACCEPTED", { reason: acceptReasonText.trim() })}
                className="rounded-md bg-emerald-600 text-white px-4 py-2 font-medium hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {submittingAction && <Loader2 className="h-3 w-3 animate-spin" />}
                Confirm Acceptance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base">Reject Claim</h3>
              <button
                onClick={() => setRejectModalOpen(false)}
                className="rounded p-1 hover:bg-muted text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="font-semibold">Rejection Notes / Comments</label>
              <textarea
                rows={3}
                value={rejectComments}
                onChange={(e) => setRejectComments(e.target.value)}
                placeholder="Reason for rejecting this claim from the handover..."
                className="w-full rounded-md border bg-background px-3 py-2 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t text-xs">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="rounded-md border px-4 py-2 hover:bg-muted font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingAction}
                onClick={() => submitDecision("REJECTED", { comments: rejectComments.trim() })}
                className="rounded-md bg-rose-600 text-white px-4 py-2 font-medium hover:bg-rose-700 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {submittingAction && <Loader2 className="h-3 w-3 animate-spin" />}
                Reject Claim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
