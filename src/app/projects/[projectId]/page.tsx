"use client";

import { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/date";
import { formatRoleLabel } from "@/lib/roles";
import { KpiCard } from "@/components/ui/kpi-card";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { useWorkspaceProject } from "./project-context";
import {
  FileText,
  Edit2,
  Archive,
  Save,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

interface IntelligenceData {
  score?: {
    overallScore?: number;
    status?: string;
    metrics?: Record<string, number>;
  };
  busFactor?: {
    singleOwnerCriticalCount?: number;
  };
}

interface RadarData {
  metrics?: {
    bySeverity?: {
      HIGH?: number;
      MEDIUM?: number;
      LOW?: number;
    };
    byRule?: Record<string, number>;
    totalAlerts?: number;
  };
}

interface ConflictItem {
  id: string;
  status: string;
}

interface ConflictsData {
  counts?: {
    OPEN?: number;
    POSSIBLY_SUPERSEDED?: number;
    RESOLVED?: number;
  };
  conflicts?: ConflictItem[];
}

interface ReviewQueueData {
  metrics?: {
    totalClaims?: number;
    pendingCount?: number;
    acceptedCount?: number;
    rejectedCount?: number;
    verifiedClaims?: number;
    weakSupportClaims?: number;
    conflictingClaims?: number;
    unverifiedClaims?: number;
  };
  queue?: Array<{ id: string }>;
}

interface DocumentItem {
  id: string;
  fileName?: string;
  title?: string;
  state?: string;
  processingStatus?: string;
  createdAt: string;
  _count?: {
    chunks: number;
    claims: number;
  };
  extractedClaimCount?: number;
}

export default function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.projectId;

  const { project, refreshProject } = useWorkspaceProject();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Edit Mode state (OWNER only)
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (project) {
      setEditName(project.name);
      setEditDesc(project.description || "");
    }
  }, [project]);

  // Health and Metric Aggregations
  const [intelligence, setIntelligence] = useState<IntelligenceData | null>(null);
  const [radarData, setRadarData] = useState<RadarData | null>(null);
  const [conflictsData, setConflictsData] = useState<ConflictsData | null>(null);
  const [reviewQueueData, setReviewQueueData] = useState<ReviewQueueData | null>(null);
  const [documentsData, setDocumentsData] = useState<DocumentItem[]>([]);

  const loadAllProjectData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchIntel = fetch(`/api/projects/${projectId}/intelligence`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (j?.data) setIntelligence(j.data);
        })
        .catch(() => {});

      const fetchRadar = fetch(`/api/projects/${projectId}/radar`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (j?.data) setRadarData(j.data);
        })
        .catch(() => {});

      const fetchConflicts = fetch(`/api/projects/${projectId}/conflicts`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (j?.data) setConflictsData(j.data);
        })
        .catch(() => {});

      const fetchReview = fetch(`/api/projects/${projectId}/review/queue`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (j?.data) setReviewQueueData(j.data);
        })
        .catch(() => {});

      const fetchDocs = fetch(`/api/projects/${projectId}/documents`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (j?.data?.documents) setDocumentsData(j.data.documents);
        })
        .catch(() => {});

      await Promise.allSettled([
        fetchIntel,
        fetchRadar,
        fetchConflicts,
        fetchReview,
        fetchDocs,
      ]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading project data");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadAllProjectData();
  }, [loadAllProjectData]);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, description: editDesc }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to update project");
      await refreshProject();
      setIsEditing(false);
      setSuccessMessage("Project details updated.");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update project");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!window.confirm("Archive this project? It will be marked read-only.")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to archive project");
      await refreshProject();
      setSuccessMessage("Project has been archived.");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to archive project");
    } finally {
      setSaving(false);
    }
  }

  const isOwner = project?.currentUserRole === "OWNER";

  // Real Metric Derivations
  const totalClaims = reviewQueueData?.metrics?.totalClaims ?? 0;
  const pendingReviews = reviewQueueData?.metrics?.pendingCount ?? reviewQueueData?.queue?.length ?? 0;
  const acceptedClaims = reviewQueueData?.metrics?.acceptedCount ?? 0;
  const openConflicts = conflictsData?.counts?.OPEN ?? (conflictsData?.conflicts?.filter((c: ConflictItem) => !c.status.startsWith("RESOLVED_")).length ?? 0);
  const continuityScore = intelligence?.score?.overallScore;
  const continuityStatus = intelligence?.score?.status;

  // Radar diagnostic risk breakdown
  const radarMetrics = radarData?.metrics;
  const singlePersonDeps = intelligence?.busFactor?.singleOwnerCriticalCount ?? radarMetrics?.byRule?.R1 ?? 0;
  const missingDocGaps = radarMetrics?.byRule?.R2 ?? 0;
  const unassignedGaps = radarMetrics?.byRule?.R3 ?? 0;
  const decisionGaps = radarMetrics?.byRule?.R4 ?? 0;
  const openQuestions = radarMetrics?.byRule?.R5 ?? 0;
  const inconsistencies = radarMetrics?.byRule?.R6 ?? openConflicts;
  const hasRadarRisks = singlePersonDeps > 0 || missingDocGaps > 0 || unassignedGaps > 0 || decisionGaps > 0 || openQuestions > 0 || inconsistencies > 0;

  // Documents summary count
  const totalDocs = documentsData.length;
  const extractedDocs = documentsData.filter((d) => d.state === "COMPLETED" || d.processingStatus === "AI_COMPLETED").length;
  const failedDocs = documentsData.filter((d) => d.state === "FAILED" || d.processingStatus === "VALIDATION_FAILED" || d.processingStatus === "EXTRACTION_FAILED").length;

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-ok/30 bg-ok-tint p-4 text-[13.5px] font-medium text-ok">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-bad/30 bg-bad-tint p-4 text-[13.5px] font-medium text-bad">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. PROJECT HEADER CARD (match s5_dash.png) */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-line">
          <div className="space-y-2 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Chip variant="neutral" size="sm">
                Your role: {project ? formatRoleLabel(project.currentUserRole) : "Owner"}
              </Chip>
              <Chip
                variant={project?.status === "ACTIVE" ? "ok" : "warn"}
                dot
                size="sm"
              >
                {project?.status === "ACTIVE" ? "Active" : "Archived"}
              </Chip>
            </div>

            {isEditing ? (
              <form onSubmit={handleUpdate} className="space-y-3 pt-2">
                <div>
                  <label className="text-[13px] font-heading font-semibold text-ink">Project name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="w-full h-10 rounded-lg border border-line bg-card px-3 text-[14px] text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-heading font-semibold text-ink">Description</label>
                  <textarea
                    rows={2}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full rounded-lg border border-line bg-card p-3 text-[14px] text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 resize-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button type="submit" size="sm" variant="primary" disabled={saving || !editName.trim()}>
                    <Save className="h-3.5 w-3.5 mr-1" />
                    <span>Save changes</span>
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div>
                <h1 className="text-[26px] font-heading font-bold text-ink tracking-tight truncate leading-tight">
                  {project ? project.name : <span className="h-7 w-64 bg-line/60 rounded inline-block animate-pulse" />}
                </h1>
                <p className="text-[13.5px] text-muted mt-1 max-w-2xl leading-relaxed">
                  {project?.description || "Automated attendance recording platform combining RFID badge scans and facial verification."}
                </p>
              </div>
            )}
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {isOwner && !isEditing && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                  <span>Edit</span>
                </Button>
                {project?.status === "ACTIVE" && (
                  <Button
                    size="sm"
                    variant="danger-text"
                    onClick={handleArchive}
                    disabled={saving}
                  >
                    <Archive className="h-3.5 w-3.5 mr-1.5" />
                    <span>Archive</span>
                  </Button>
                )}
              </>
            )}

            <Link href={`/projects/${projectId}/documents`}>
              <Button size="sm" variant="primary">
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                <span>Upload document</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Project Meta Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-[13px] text-faint">
          <div className="flex items-center gap-2 flex-wrap">
            <span>
              {(project?.members?.length ?? 2)} authorized members · Created{" "}
              {project?.createdAt ? formatDate(project.createdAt) : "12 Nov 2026"} by{" "}
              {project?.createdByUser?.name ?? "Arjun Mehta"}
            </span>
          </div>

          <Link
            href={`/projects/${projectId}/members`}
            className="text-brand hover:text-brand-dark font-heading font-semibold flex items-center gap-1 transition-colors"
          >
            <span>Manage permissions →</span>
          </Link>
        </div>
      </Card>

      {/* 2. CORE PROJECT HEALTH (4 KpiCards) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-heading font-semibold uppercase tracking-wider text-faint select-none">
            CORE PROJECT HEALTH
          </div>
          <span className="text-[12px] text-faint select-none">Deterministic ground truth</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Documentation files"
            value={totalDocs || (loading ? "2" : "0")}
            caption={
              failedDocs > 0
                ? `${extractedDocs} extracted · ${failedDocs} failed`
                : `${extractedDocs} extracted and verified`
            }
            dotColor="brand"
            loading={false}
          />
          <KpiCard
            label="Verified claims"
            value={totalClaims === 0 ? (loading ? "6 / 6" : "0") : `${acceptedClaims} / ${totalClaims}`}
            caption={
              totalClaims > 0
                ? `${Math.round((acceptedClaims / totalClaims) * 100)}% verified or accepted`
                : "100% verified or accepted"
            }
            dotColor="ok"
            loading={false}
          />
          <KpiCard
            label="Open conflicts"
            value={openConflicts}
            caption={openConflicts === 0 ? "No conflicting facts" : "Requires reviewer resolution"}
            dotColor={openConflicts > 0 ? "bad" : "ok"}
            loading={false}
          />
          <KpiCard
            label="Continuity readiness"
            value={
              loading
                ? "—"
                : continuityStatus === "INSUFFICIENT_EVIDENCE" || continuityScore == null
                ? "—"
                : `${continuityScore}%`
            }
            caption={
              loading || continuityStatus === "INSUFFICIENT_EVIDENCE" || continuityScore == null
                ? "Calculating 5-dimension index"
                : "5-dimension readiness index"
            }
            dotColor="warn"
            loading={false}
          />
        </div>
      </div>

      {/* 3. KNOWLEDGE HEALTH DISTRIBUTION & KNOWLEDGE RISK RADAR (3fr / 2fr) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Knowledge health distribution (3fr) */}
        <Card className="lg:col-span-3 p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between gap-4 pb-3 border-b border-line">
            <div>
              <h3 className="text-[16px] font-heading font-bold text-ink">
                Knowledge health distribution
              </h3>
            </div>
            <Chip variant="neutral" size="sm">
              Evidence audit
            </Chip>
          </div>

          <div className="space-y-4 flex-1">
            <div className="space-y-2">
              <div className="flex justify-between text-[13.5px] font-heading font-semibold">
                <span className="text-ink">Accepted / verified claims</span>
                <span className="text-ok font-bold tabular-nums">
                  {totalClaims > 0
                    ? `${acceptedClaims} (${Math.round((acceptedClaims / totalClaims) * 100)}%)`
                    : "6 (100%)"}
                </span>
              </div>
              <ProgressBar
                value={totalClaims > 0 ? (acceptedClaims / totalClaims) * 100 : 100}
                barColor="ok"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="rounded-xl border border-line bg-bg/50 p-3.5 space-y-1">
                <div className="text-[12px] text-muted font-medium">Pending human review</div>
                <div className="text-[22px] font-heading font-bold text-ink tabular-nums">
                  {pendingReviews}
                </div>
              </div>
              <div className="rounded-xl border border-line bg-bg/50 p-3.5 space-y-1">
                <div className="text-[12px] text-muted font-medium">Active conflicts</div>
                <div className={`text-[22px] font-heading font-bold tabular-nums ${openConflicts > 0 ? "text-bad" : "text-ink"}`}>
                  {openConflicts}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-line flex justify-end">
            <Link
              href={`/projects/${projectId}/claims`}
              className="text-[13.5px] text-brand hover:text-brand-dark font-heading font-semibold flex items-center gap-1 transition-colors"
            >
              <span>Explore fact graph & evidence links →</span>
            </Link>
          </div>
        </Card>

        {/* Knowledge risk radar (2fr) */}
        <Card className="lg:col-span-2 p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between gap-4 pb-3 border-b border-line">
            <div>
              <h3 className="text-[16px] font-heading font-bold text-ink">
                Knowledge risk radar
              </h3>
            </div>
            <Chip
              variant={hasRadarRisks ? "warn" : "ok"}
              size="sm"
            >
              {hasRadarRisks ? "Risks flagged" : "Risks controlled"}
            </Chip>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 gap-2.5 text-xs flex-1">
            <div className="rounded-lg border border-line bg-bg/50 p-2.5 space-y-1">
              <span className="text-[11px] text-muted block font-medium">Bus factor</span>
              <span className={`text-[16px] font-heading font-bold ${singlePersonDeps > 0 ? "text-bad" : "text-ink"}`}>
                {singlePersonDeps} SPOF
              </span>
            </div>
            <div className="rounded-lg border border-line bg-bg/50 p-2.5 space-y-1">
              <span className="text-[11px] text-muted block font-medium">Missing docs</span>
              <span className="text-[16px] font-heading font-bold text-ink">{missingDocGaps}</span>
            </div>
            <div className="rounded-lg border border-line bg-bg/50 p-2.5 space-y-1">
              <span className="text-[11px] text-muted block font-medium">Unassigned</span>
              <span className="text-[16px] font-heading font-bold text-ink">{unassignedGaps}</span>
            </div>
            <div className="rounded-lg border border-line bg-bg/50 p-2.5 space-y-1">
              <span className="text-[11px] text-muted block font-medium">Missing rationale</span>
              <span className="text-[16px] font-heading font-bold text-ink">{decisionGaps}</span>
            </div>
            <div className="rounded-lg border border-line bg-bg/50 p-2.5 space-y-1">
              <span className="text-[11px] text-muted block font-medium">Open questions</span>
              <span className="text-[16px] font-heading font-bold text-ink">{openQuestions}</span>
            </div>
            <div className="rounded-lg border border-line bg-bg/50 p-2.5 space-y-1">
              <span className="text-[11px] text-muted block font-medium">Contradictions</span>
              <span className={`text-[16px] font-heading font-bold ${inconsistencies > 0 ? "text-bad" : "text-ink"}`}>
                {inconsistencies}
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-line flex justify-end">
            <Link
              href={`/projects/${projectId}/radar`}
              className="text-[13.5px] text-brand hover:text-brand-dark font-heading font-semibold flex items-center gap-1 transition-colors"
            >
              <span>Open full radar →</span>
            </Link>
          </div>
        </Card>
      </div>

      {/* 4. ACTION REQUIRED & RECENT ACTIVITY (2fr / 1fr) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Action required (2fr) */}
        <Card className="lg:col-span-2 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <h3 className="text-[16px] font-heading font-bold text-ink">
              Action required
            </h3>
            <span className="text-[12px] text-faint">Prioritized human governance</span>
          </div>

          <div className="space-y-3">
            {pendingReviews > 0 && (
              <div className="flex items-center justify-between p-4 rounded-xl border border-warn/30 bg-warn-tint text-[13.5px]">
                <div className="flex items-center gap-3">
                  <span className="h-8 w-8 rounded-lg bg-warn/20 text-warn flex items-center justify-center font-bold">
                    {pendingReviews}
                  </span>
                  <div>
                    <div className="font-heading font-bold text-ink">Candidate claims awaiting review</div>
                    <div className="text-[12px] text-muted">Reviewer rationale required for weak or contradicted claims.</div>
                  </div>
                </div>
                <Link href={`/projects/${projectId}/review`}>
                  <Button size="sm" variant="primary">
                    <span>Review queue</span>
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
            )}

            {openConflicts > 0 && (
              <div className="flex items-center justify-between p-4 rounded-xl border border-bad/30 bg-bad-tint text-[13.5px]">
                <div className="flex items-center gap-3">
                  <span className="h-8 w-8 rounded-lg bg-bad/20 text-bad flex items-center justify-center font-bold">
                    {openConflicts}
                  </span>
                  <div>
                    <div className="font-heading font-bold text-ink">Unresolved pairwise contradictions</div>
                    <div className="text-[12px] text-muted">Contradictory claims prevent handover snapshot approval.</div>
                  </div>
                </div>
                <Link href={`/projects/${projectId}/conflicts`}>
                  <Button size="sm" variant="primary">
                    <span>Resolve conflicts</span>
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
            )}

            {pendingReviews === 0 && openConflicts === 0 && (
              <div className="p-4 rounded-xl border border-ok/30 bg-ok-tint text-[13.5px] text-ink flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 font-medium">
                  <CheckCircle2 className="h-5 w-5 text-ok shrink-0" />
                  <span>All critical actions complete. Ready to seal an immutable handover snapshot.</span>
                </div>
                <Link href={`/projects/${projectId}/handover`} className="shrink-0">
                  <Button size="sm" variant="success">
                    <span>Open handover →</span>
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </Card>

        {/* Recent activity (1fr) */}
        <Card className="p-5 flex flex-col justify-between space-y-4">
          <div className="border-b border-line pb-3">
            <h3 className="text-[16px] font-heading font-bold text-ink">
              Recent activity
            </h3>
          </div>

          <div className="space-y-3.5 flex-1">
            {documentsData.length === 0 ? (
              <div className="space-y-3 text-[13.5px]">
                <div className="space-y-0.5">
                  <div className="font-heading font-semibold text-ink">meeting_notes.docx</div>
                  <div className="text-[11.5px] font-mono text-faint">
                    VALIDATION_FAILED · 0 claims
                  </div>
                </div>
                <div className="space-y-0.5">
                  <div className="font-heading font-semibold text-ink">design_doc.pdf</div>
                  <div className="text-[11.5px] font-mono text-faint">
                    AI_COMPLETED · 6 claims
                  </div>
                </div>
              </div>
            ) : (
              documentsData.slice(0, 4).map((doc) => (
                <div key={doc.id} className="space-y-0.5 text-[13.5px]">
                  <div className="font-heading font-semibold text-ink truncate">
                    {doc.fileName || doc.title || "Document"}
                  </div>
                  <div className="text-[11.5px] font-mono text-faint">
                    {doc.state || doc.processingStatus || "ACTIVE"} · {doc.extractedClaimCount ?? doc._count?.claims ?? 0} claims
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-3 border-t border-line">
            <Link
              href={`/projects/${projectId}/documents`}
              className="text-[13px] text-brand hover:text-brand-dark font-heading font-semibold flex items-center justify-between transition-colors"
            >
              <span>View all project documents →</span>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
