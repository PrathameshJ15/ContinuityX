"use client";

import React, { useState, useEffect, use, useCallback } from "react";
import { formatDate } from "@/lib/date";
import {
  AlertCircle,
  AlertTriangle,
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileCheck,
  History,
  Lock,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";

interface HandoverSectionItem {
  id: string;
  title: string;
  subject: string;
  attribute: string;
  valueRaw: string;
  valueNormalized: string | null;
  evidenceStatus: string;
  reviewState: string;
  reviewerReason?: string | null;
  evidence: Array<{
    documentId: string;
    documentChecksum: string;
    fileName?: string;
    location: string;
    excerpt: string;
  }>;
}

interface HandoverSection {
  id: string;
  number: number;
  title: string;
  description: string;
  hasContent: boolean;
  emptyNotice?: string;
  items: HandoverSectionItem[];
}

interface AssembledHandover {
  title: string;
  projectId: string;
  version: number;
  generatedAt: string;
  sections: HandoverSection[];
  totalClaimsCount: number;
  verifiedClaimsCount: number;
  reviewerAcceptedCount: number;
  totalDocumentsCount: number;
}

interface HandoverRecord {
  id: string;
  projectId: string;
  version: number;
  status: string;
  title: string;
  summary: string | null;
  generatedAt: string;
  approvedAt: string | null;
  approvedBy?: { id: string; name: string; email: string } | null;
  receipt?: {
    id: string;
    version: number;
    snapshotHash: string;
    previousReceiptHash: string | null;
    approvedAt: string;
    approvedBy: { id: string; name: string; email: string };
  } | null;
}

interface ReceiptVerificationResult {
  valid: boolean;
  snapshotIntegrity: boolean;
  liveDataIntegrity: boolean;
  storedHash: string;
  computedSnapshotHash: string;
  liveDataHash: string;
  verifiedAt: string;
  explanation: string;
}

export default function HandoverPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);

  const [handoversList, setHandoversList] = useState<HandoverRecord[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<"DRAFT" | number>("DRAFT");
  const [draftData, setDraftData] = useState<{
    canApprove: boolean;
    blockingReasons: string[];
    unresolvedConflictCount: number;
    draft: AssembledHandover;
  } | null>(null);

  const [approvedData, setApprovedData] = useState<{
    handover: HandoverRecord;
    receipt: NonNullable<HandoverRecord["receipt"]>;
    assembled: AssembledHandover;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);

  // Approval modal state
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [approving, setApproving] = useState(false);

  // Verification modal state
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<ReceiptVerificationResult | null>(null);

  // Collapsible section state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    executive_summary: true,
    objectives: true,
    current_status: true,
    technical_architecture: true,
  });

  const loadHandovers = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/handovers`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to load handovers");

      const list: HandoverRecord[] = json.data.handovers || [];
      setHandoversList(list);

      // Default to latest approved handover if available, otherwise DRAFT
      if (list.length > 0) {
        setSelectedVersion(list[0].version);
      } else {
        setSelectedVersion("DRAFT");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load handovers");
    }
  }, [projectId]);

  const loadDraft = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/projects/${projectId}/handovers/draft`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to load draft preview");

      setDraftData(json.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load draft preview");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadApprovedHandover = useCallback(
    async (versionNum: number) => {
      try {
        setLoading(true);
        setError(null);

        const target = handoversList.find((h) => h.version === versionNum);
        if (!target) {
          await loadDraft();
          return;
        }

        const res = await fetch(`/api/projects/${projectId}/handovers/${target.id}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message || "Failed to load approved handover");

        setApprovedData(json.data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load approved handover");
      } finally {
        setLoading(false);
      }
    },
    [projectId, handoversList, loadDraft]
  );

  useEffect(() => {
    loadHandovers();
  }, [loadHandovers]);

  useEffect(() => {
    if (selectedVersion === "DRAFT") {
      loadDraft();
    } else {
      loadApprovedHandover(selectedVersion);
    }
  }, [selectedVersion, loadDraft, loadApprovedHandover]);

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleApproveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setApproving(true);
      setError(null);

      const res = await fetch(`/api/projects/${projectId}/handovers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: customTitle.trim() || undefined }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Approval failed");

      setSuccess("Handover approved successfully with cryptographic SHA-256 receipt.");
      setApprovalModalOpen(false);
      setCustomTitle("");

      await loadHandovers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setApproving(false);
    }
  };

  const handleVerifyReceipt = async () => {
    if (!approvedData?.handover?.id) return;
    try {
      setVerifying(true);
      setError(null);
      setVerifyModalOpen(true);

      const res = await fetch(
        `/api/projects/${projectId}/handovers/${approvedData.handover.id}/verify-receipt`,
        { method: "POST" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Receipt verification failed");

      setVerifyResult(json.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Receipt verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const currentDisplayHandover =
    selectedVersion === "DRAFT" ? draftData?.draft : approvedData?.assembled;

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 text-xs font-semibold">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            VERIFIED
          </span>
        );
      case "WEAK_SUPPORT":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 px-2 py-0.5 text-xs font-semibold">
            <AlertTriangle className="h-3 w-3 text-amber-600" />
            WEAK_SUPPORT
          </span>
        );
      case "CONFLICTING":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 px-2 py-0.5 text-xs font-semibold">
            <AlertCircle className="h-3 w-3 text-rose-600" />
            CONFLICTING
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded bg-muted text-muted-foreground px-2 py-0.5 text-xs font-semibold">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Version Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Proof-Carrying Handover
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              <Award className="h-3.5 w-3.5" />
              P0-A Checkpoint
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Cryptographically sealed, versioned project documentation backed by SHA-256 receipts.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Version Selector */}
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <select
              value={selectedVersion}
              onChange={(e) =>
                setSelectedVersion(
                  e.target.value === "DRAFT" ? "DRAFT" : parseInt(e.target.value, 10)
                )
              }
              className="rounded-lg border bg-background px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
            >
              <option value="DRAFT">Draft Preview (Latest Accepted)</option>
              {handoversList.map((h) => (
                <option key={h.id} value={h.version}>
                  Version {h.version} ({formatDate(h.approvedAt || h.generatedAt)})
                </option>
              ))}
            </select>
          </div>

          {/* Action: Export PDF */}
          {selectedVersion !== "DRAFT" && approvedData?.handover && (
            <a
              href={`/api/projects/${projectId}/handovers/${approvedData.handover.id}/export`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted shadow-sm transition-colors"
            >
              <Download className="h-3.5 w-3.5 text-primary" />
              Export PDF
            </a>
          )}

          {/* Action: Verify Receipt */}
          {selectedVersion !== "DRAFT" && approvedData?.receipt && (
            <button
              onClick={handleVerifyReceipt}
              disabled={verifying}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 shadow-sm transition-colors disabled:opacity-50"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Verify Receipt
            </button>
          )}

          {/* Action: Approve Handover Button */}
          {selectedVersion === "DRAFT" && (
            <button
              onClick={() => setApprovalModalOpen(true)}
              disabled={!draftData?.canApprove || loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-sm transition-colors disabled:opacity-50"
            >
              <Lock className="h-3.5 w-3.5" />
              Approve Handover
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Blocking Alert in Draft Mode */}
      {selectedVersion === "DRAFT" && draftData && !draftData.canApprove && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20 p-4 text-amber-900 dark:text-amber-200 text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Handover Approval Blocked by System Invariants
          </div>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-1">
            {draftData.blockingReasons.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Cryptographic Receipt Card (when approved handover selected) */}
      {selectedVersion !== "DRAFT" && approvedData?.receipt && (
        <div className="rounded-xl border border-primary/30 bg-card p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <h2 className="font-semibold text-base text-foreground">
                Cryptographic Approval Receipt
              </h2>
              <span className="rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 text-xs px-2 py-0.5 font-mono font-semibold">
                v{approvedData.receipt.version}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              Approved by{" "}
              <span className="font-semibold text-foreground">
                {approvedData.receipt.approvedBy.name}
              </span>{" "}
              on {new Date(approvedData.receipt.approvedAt).toUTCString()}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Snapshot SHA-256 Hash */}
            <div className="space-y-1 rounded-lg bg-muted/40 p-3 border">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-primary" />
                  Canonical Snapshot SHA-256 Hash
                </span>
                <button
                  onClick={() => handleCopyHash(approvedData.receipt.snapshotHash)}
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[11px]"
                  title="Copy Hash"
                >
                  <Copy className="h-3 w-3" />
                  {copiedHash ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="font-mono text-xs break-all text-primary font-medium">
                {approvedData.receipt.snapshotHash}
              </p>
            </div>

            {/* Previous Hash Chain */}
            <div className="space-y-1 rounded-lg bg-muted/40 p-3 border">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-primary" />
                Previous Version Receipt Hash
              </span>
              <p className="font-mono text-xs break-all text-muted-foreground">
                {approvedData.receipt.previousReceiptHash || "Genesis Version (No previous receipt)"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
            <FileCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span>
              <strong>Integrity fingerprint, not a digital signature:</strong> This hash permanently
              binds the exact set of approved claims and cited excerpts. Any modification to text,
              evidence, or relations produces a different hash.
            </span>
          </div>
        </div>
      )}

      {/* Main Content Loading State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
          <p className="text-sm">Assembling proof-carrying handover...</p>
        </div>
      ) : !currentDisplayHandover ? (
        <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
          <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">No handover data found for this selection.</p>
        </div>
      ) : (
        /* The 14 Handover Sections */
        <div className="space-y-4">
          {currentDisplayHandover.sections.map((section) => {
            const isExpanded = expandedSections[section.id] ?? false;

            return (
              <div
                key={section.id}
                className="rounded-xl border bg-card shadow-sm overflow-hidden"
              >
                {/* Section Header */}
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between p-4 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2.5">
                      <span className="font-semibold text-base text-foreground">
                        {section.title}
                      </span>
                      {section.hasContent ? (
                        <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-semibold">
                          {section.items.length} item{section.items.length !== 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[11px]">
                          Empty
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{section.description}</p>
                  </div>

                  <div className="text-muted-foreground">
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5" />
                    ) : (
                      <ChevronDown className="h-5 w-5" />
                    )}
                  </div>
                </button>

                {/* Section Content */}
                {isExpanded && (
                  <div className="p-4 border-t divide-y divide-border/60">
                    {!section.hasContent ? (
                      <div className="py-4 text-center text-xs italic text-muted-foreground">
                        [{section.emptyNotice || "No approved information"}]
                      </div>
                    ) : (
                      <div className="space-y-4 pt-1">
                        {section.items.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-lg border bg-background/50 p-3.5 space-y-2.5 text-xs shadow-none"
                          >
                            {/* Item Header */}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-foreground text-sm">
                                  {item.subject}
                                </span>
                                <span className="text-muted-foreground">→</span>
                                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">
                                  {item.attribute}
                                </code>
                              </div>
                              <div className="flex items-center gap-2">
                                {renderStatusBadge(item.evidenceStatus)}
                                <span className="rounded bg-muted text-foreground px-2 py-0.5 text-xs font-medium">
                                  {item.reviewState}
                                </span>
                              </div>
                            </div>

                            {/* Item Value */}
                            <div className="p-2.5 rounded bg-muted/30 border border-muted text-xs">
                              <span className="font-semibold text-foreground">Value: </span>
                              <span className="text-foreground">{item.valueRaw}</span>
                              {item.valueNormalized && item.valueNormalized !== item.valueRaw && (
                                <span className="text-muted-foreground ml-2">
                                  (Normalized: <code>{item.valueNormalized}</code>)
                                </span>
                              )}
                            </div>

                            {/* Reviewer Written Reason if accepted with weaker evidence */}
                            {item.reviewerReason && (
                              <div className="rounded bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-2 text-amber-900 dark:text-amber-200 text-xs">
                                <span className="font-semibold">Reviewer Justification: </span>
                                {item.reviewerReason}
                              </div>
                            )}

                            {/* Evidence Excerpts */}
                            {item.evidence.length > 0 && (
                              <div className="space-y-1.5 pt-1">
                                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                  Cited Evidence ({item.evidence.length})
                                </div>
                                {item.evidence.map((ev, i) => (
                                  <div
                                    key={i}
                                    className="rounded border bg-card p-2 text-xs space-y-1"
                                  >
                                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                      <span className="font-medium text-foreground">
                                        {ev.fileName || "Document"} ({ev.location})
                                      </span>
                                      <span className="font-mono text-[10px]">
                                        SHA-256: {ev.documentChecksum.slice(0, 10)}...
                                      </span>
                                    </div>
                                    <blockquote className="border-l-2 border-primary/40 pl-2 text-muted-foreground italic bg-muted/10 py-0.5">
                                      &ldquo;{ev.excerpt}&rdquo;
                                    </blockquote>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Approval Confirmation Modal */}
      {approvalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 font-bold text-foreground text-base">
                <Lock className="h-5 w-5 text-primary" />
                Approve Handover & Mint Receipt
              </div>
              <button
                onClick={() => setApprovalModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleApproveSubmit} className="space-y-4 text-xs">
              <p className="text-muted-foreground">
                This action will lock all currently accepted claims into an immutable canonical
                snapshot and calculate a cryptographic SHA-256 integrity receipt in one atomic transaction.
              </p>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Custom Handover Title (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Q4 Architectural Handover"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="rounded-lg bg-muted/40 p-3 space-y-1 border">
                <div className="font-semibold text-foreground">Handover Invariant Check:</div>
                <div className="text-muted-foreground">
                  • Total Claims to Seal:{" "}
                  <strong>{draftData?.draft?.totalClaimsCount ?? 0}</strong>
                </div>
                <div className="text-muted-foreground">
                  • Verified Claims:{" "}
                  <strong>{draftData?.draft?.verifiedClaimsCount ?? 0}</strong>
                </div>
                <div className="text-muted-foreground">
                  • Open Conflicts Remaining:{" "}
                  <strong>{draftData?.unresolvedConflictCount ?? 0}</strong>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setApprovalModalOpen(false)}
                  className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={approving}
                  className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {approving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    "Confirm & Approve"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Verify Receipt Result Modal */}
      {verifyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 font-bold text-foreground text-base">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Receipt Cryptographic Verification
              </div>
              <button
                onClick={() => setVerifyModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {verifying ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">
                  Recomputing SHA-256 hash across canonical snapshot and database claims...
                </p>
              </div>
            ) : verifyResult ? (
              <div className="space-y-4 text-xs">
                {verifyResult.valid ? (
                  <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 flex items-start gap-3 text-emerald-900 dark:text-emerald-200">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-sm">Receipt Cryptographically Verified</div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {verifyResult.explanation}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 flex items-start gap-3 text-rose-900 dark:text-rose-200">
                    <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-sm">Integrity Discrepancy Detected</div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {verifyResult.explanation}
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2 rounded-lg bg-muted/30 p-3 border">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Check 1: Stored Snapshot Integrity:</span>
                    <span
                      className={`font-semibold ${
                        verifyResult.snapshotIntegrity ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {verifyResult.snapshotIntegrity ? "PASS (Exact Match)" : "FAIL (Tampered)"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Check 2: Live Database Claims Integrity:</span>
                    <span
                      className={`font-semibold ${
                        verifyResult.liveDataIntegrity ? "text-emerald-600" : "text-amber-600"
                      }`}
                    >
                      {verifyResult.liveDataIntegrity ? "PASS (Synchronized)" : "DRIFT (Modified Post-Approval)"}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 font-mono text-[11px] bg-muted/40 p-3 rounded-lg border">
                  <div>
                    <span className="text-muted-foreground">Receipt Hash: </span>
                    <span className="text-foreground">{verifyResult.storedHash}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Computed Hash: </span>
                    <span className="text-primary">{verifyResult.computedSnapshotHash}</span>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setVerifyModalOpen(false)}
                    className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
