"use client";

import React, { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import { formatDate, formatDateTime } from "@/lib/date";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
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
  Layers,
  FileText,
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
        return <Badge variant="verified">VERIFIED</Badge>;
      case "WEAK_SUPPORT":
        return <Badge variant="weak">WEAK SUPPORT</Badge>;
      case "CONFLICTING":
        return <Badge variant="contradicted">CONFLICTING</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

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
            <span className="text-foreground font-medium">Handover Workspace</span>
          </div>
        }
        title="Proof-Carrying Handover"
        badge={
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            <Award className="h-3.5 w-3.5" />
            P0-A Checkpoint
          </span>
        }
        description="Cryptographically sealed, versioned project documentation backed by verifiable SHA-256 receipts."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Version Selector */}
            <div className="flex items-center gap-1.5 bg-card border border-border rounded-lg px-2.5 py-1.5 shadow-xs">
              <History className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={selectedVersion}
                onChange={(e) =>
                  setSelectedVersion(
                    e.target.value === "DRAFT" ? "DRAFT" : parseInt(e.target.value, 10)
                  )
                }
                className="bg-transparent text-xs font-medium text-foreground focus:outline-none cursor-pointer"
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
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent shadow-xs transition-colors"
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
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
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
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-primary/90 transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                <Lock className="h-3.5 w-3.5" />
                Approve Handover
              </button>
            )}
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

      {/* Blocking Alert in Draft Mode */}
      {selectedVersion === "DRAFT" && draftData && !draftData.canApprove && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20 p-4 text-amber-900 dark:text-amber-200 text-xs space-y-2">
          <div className="flex items-center gap-2 font-semibold text-sm text-amber-900 dark:text-amber-100">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            Handover Approval Blocked by System Invariants
          </div>
          <ul className="list-disc list-inside space-y-1 text-amber-800 dark:text-amber-300 ml-1">
            {draftData.blockingReasons.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Metrics Strip */}
      {currentDisplayHandover && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Approved Facts"
            value={currentDisplayHandover.totalClaimsCount}
            subtitle="Sealed in current snapshot"
            icon={Layers}
          />
          <MetricCard
            title="Strictly Verified"
            value={currentDisplayHandover.verifiedClaimsCount}
            subtitle="Passes 4-gate verification"
            variant="success"
            icon={ShieldCheck}
          />
          <MetricCard
            title="Reviewer Accepted"
            value={currentDisplayHandover.reviewerAcceptedCount}
            subtitle="Human reviewed decisions"
            icon={FileCheck}
          />
          <MetricCard
            title="Source Documents"
            value={currentDisplayHandover.totalDocumentsCount}
            subtitle="Authoritative basis files"
            icon={FileText}
          />
        </div>
      )}

      {/* Cryptographic Receipt Card (when approved handover selected) */}
      {selectedVersion !== "DRAFT" && approvedData?.receipt && (
        <div className="rounded-xl border border-primary/30 bg-card p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <h2 className="font-semibold text-base text-foreground">
                Cryptographic Approval Receipt
              </h2>
              <span className="rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 text-xs px-2 py-0.5 font-mono font-semibold">
                v{approvedData.receipt.version}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              Approved by{" "}
              <strong className="text-foreground">
                {approvedData.receipt.approvedBy.name}
              </strong>{" "}
              on {formatDateTime(approvedData.receipt.approvedAt)}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Snapshot SHA-256 Hash */}
            <div className="space-y-1.5 rounded-lg bg-slate-50 dark:bg-slate-900/50 p-3.5 border border-border">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-primary" />
                  Canonical Snapshot SHA-256 Hash
                </span>
                <button
                  onClick={() => handleCopyHash(approvedData.receipt!.snapshotHash)}
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[11px] font-medium cursor-pointer"
                  title="Copy Hash"
                >
                  <Copy className="h-3 w-3" />
                  {copiedHash ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="font-mono text-xs break-all text-primary font-medium select-all">
                {approvedData.receipt.snapshotHash}
              </p>
            </div>

            {/* Previous Hash Chain */}
            <div className="space-y-1.5 rounded-lg bg-slate-50 dark:bg-slate-900/50 p-3.5 border border-border">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-primary" />
                Previous Version Receipt Hash
              </span>
              <p className="font-mono text-xs break-all text-muted-foreground select-all">
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
        <TableSkeleton rows={6} />
      ) : !currentDisplayHandover ? (
        <EmptyState
          type="no-data"
          title="No handover data available"
          description="Upload project documents, extract candidate claims, and approve evidence to construct a handover snapshot."
        />
      ) : (
        /* The 14 Handover Sections */
        <div className="space-y-4">
          {currentDisplayHandover.sections.map((section) => {
            const isExpanded = expandedSections[section.id] ?? false;

            return (
              <div
                key={section.id}
                className="rounded-xl border border-border bg-card shadow-xs overflow-hidden"
              >
                {/* Section Header */}
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between p-4 bg-slate-50/75 dark:bg-slate-900/50 hover:bg-slate-100/75 dark:hover:bg-slate-900/80 transition-colors text-left cursor-pointer"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2.5">
                      <span className="font-semibold text-sm text-foreground">
                        {section.title}
                      </span>
                      {section.hasContent ? (
                        <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-semibold">
                          {section.items.length} item{section.items.length !== 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 dark:bg-slate-800 text-muted-foreground px-2 py-0.5 text-[11px]">
                          Empty
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{section.description}</p>
                  </div>

                  <div className="text-muted-foreground">
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </button>

                {/* Section Content */}
                {isExpanded && (
                  <div className="p-4 border-t border-border divide-y divide-border/60">
                    {!section.hasContent ? (
                      <div className="py-4 text-center text-xs italic text-muted-foreground">
                        [{section.emptyNotice || "No approved information"}]
                      </div>
                    ) : (
                      <div className="space-y-4 pt-1">
                        {section.items.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-xl border border-border bg-slate-50/40 dark:bg-slate-900/30 p-4 space-y-3 text-xs"
                          >
                            {/* Item Header */}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-foreground text-sm">
                                  {item.subject}
                                </span>
                                <span className="text-muted-foreground">→</span>
                                <code className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-xs font-mono text-foreground">
                                  {item.attribute}
                                </code>
                              </div>
                              <div className="flex items-center gap-2">
                                {renderStatusBadge(item.evidenceStatus)}
                                <span className="rounded bg-slate-100 dark:bg-slate-800 text-foreground px-2 py-0.5 text-xs font-medium">
                                  {item.reviewState}
                                </span>
                              </div>
                            </div>

                            {/* Item Value */}
                            <div className="p-2.5 rounded-lg bg-card border border-border text-xs">
                              <span className="font-semibold text-foreground">Value: </span>
                              <span className="text-foreground">{item.valueRaw}</span>
                              {item.valueNormalized && item.valueNormalized !== item.valueRaw && (
                                <span className="text-muted-foreground ml-2">
                                  (Normalized: <code className="font-mono text-foreground">{item.valueNormalized}</code>)
                                </span>
                              )}
                            </div>

                            {/* Reviewer Written Reason if accepted with weaker evidence */}
                            {item.reviewerReason && (
                              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 p-2.5 text-amber-900 dark:text-amber-200 text-xs">
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
                                    className="rounded-lg border border-border/80 bg-card p-2.5 text-xs space-y-1 shadow-xs"
                                  >
                                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                      <span className="font-medium text-foreground flex items-center gap-1">
                                        <FileText className="h-3 w-3 text-primary" />
                                        {ev.fileName || "Document"} ({ev.location})
                                      </span>
                                      <span className="font-mono text-[10px]">
                                        SHA-256: {ev.documentChecksum.slice(0, 10)}...
                                      </span>
                                    </div>
                                    <blockquote className="border-l-2 border-primary/40 pl-2 text-muted-foreground italic bg-slate-50/50 dark:bg-slate-900/20 py-0.5">
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
        <Modal
          isOpen={approvalModalOpen}
          onClose={() => setApprovalModalOpen(false)}
          title="Approve Handover & Mint Receipt"
          description="Lock all accepted claims into an immutable canonical snapshot with a cryptographic SHA-256 receipt."
        >
          <form onSubmit={handleApproveSubmit} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">
                Custom Handover Title (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Q4 Architectural Handover"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
              />
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 p-3.5 space-y-1.5 border border-border">
              <div className="font-semibold text-foreground">Handover Invariant Check:</div>
              <div className="text-muted-foreground">
                • Total Claims to Seal:{" "}
                <strong className="text-foreground">{draftData?.draft?.totalClaimsCount ?? 0}</strong>
              </div>
              <div className="text-muted-foreground">
                • Verified Claims:{" "}
                <strong className="text-foreground">{draftData?.draft?.verifiedClaimsCount ?? 0}</strong>
              </div>
              <div className="text-muted-foreground">
                • Open Conflicts Remaining:{" "}
                <strong className="text-foreground">{draftData?.unresolvedConflictCount ?? 0}</strong>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setApprovalModalOpen(false)}
                className="rounded-lg border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={approving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-primary/90 transition-colors disabled:opacity-40 cursor-pointer"
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
        </Modal>
      )}

      {/* Verify Receipt Result Modal */}
      {verifyModalOpen && (
        <Modal
          isOpen={verifyModalOpen}
          onClose={() => setVerifyModalOpen(false)}
          title="Receipt Cryptographic Verification"
          description="Independent 2-way verification of snapshot integrity and live database claims."
        >
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
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 flex items-start gap-3 text-emerald-900 dark:text-emerald-200">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm">Receipt Cryptographically Verified</div>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                      {verifyResult.explanation}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20 p-4 flex items-start gap-3 text-rose-900 dark:text-rose-200">
                  <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm">Integrity Discrepancy Detected</div>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                      {verifyResult.explanation}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 p-3.5 border border-border">
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

              <div className="space-y-1.5 font-mono text-[11px] bg-slate-100 dark:bg-slate-800 p-3 rounded-lg border border-border">
                <div>
                  <span className="text-muted-foreground">Receipt Hash: </span>
                  <span className="text-foreground break-all">{verifyResult.storedHash}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Computed Hash: </span>
                  <span className="text-primary break-all font-semibold">{verifyResult.computedSnapshotHash}</span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setVerifyModalOpen(false)}
                  className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : null}
        </Modal>
      )}
    </div>
  );
}
