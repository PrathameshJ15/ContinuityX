"use client";

import { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/date";
import { formatRoleLabel, getRoleBadgeClass } from "@/lib/roles";
import { MetricCard } from "@/components/ui/metric-card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  AlertTriangle,
  CheckSquare,
  Radar,
  BrainCircuit,
  Users,
  Calendar,
  Edit2,
  Archive,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Activity,
  Layers,
} from "lucide-react";

interface ProjectData {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "ARCHIVED";
  currentUserRole: "OWNER" | "REVIEWER" | "VIEWER";
  createdAt: string;
  createdByUser: {
    name: string;
    email: string;
  };
  members: Array<{
    id: string;
    role: "OWNER" | "REVIEWER" | "VIEWER";
    user: {
      name: string;
      email: string;
    };
  }>;
}

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

  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Edit Mode state (OWNER only)
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);

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
      const [
        projRes,
        intelRes,
        radarRes,
        conflictsRes,
        reviewRes,
        docsRes,
      ] = await Promise.allSettled([
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/projects/${projectId}/intelligence`),
        fetch(`/api/projects/${projectId}/radar`),
        fetch(`/api/projects/${projectId}/conflicts`),
        fetch(`/api/projects/${projectId}/review/queue`),
        fetch(`/api/projects/${projectId}/documents`),
      ]);

      if (projRes.status === "fulfilled" && projRes.value.ok) {
        const pJson = await projRes.value.json();
        setProject(pJson.data);
        setEditName(pJson.data.name);
        setEditDesc(pJson.data.description || "");
      } else {
        throw new Error("Failed to load project details");
      }

      if (intelRes.status === "fulfilled" && intelRes.value.ok) {
        const intelJson = await intelRes.value.json();
        setIntelligence(intelJson.data);
      }

      if (radarRes.status === "fulfilled" && radarRes.value.ok) {
        const rJson = await radarRes.value.json();
        setRadarData(rJson.data);
      }

      if (conflictsRes.status === "fulfilled" && conflictsRes.value.ok) {
        const cJson = await conflictsRes.value.json();
        setConflictsData(cJson.data);
      }

      if (reviewRes.status === "fulfilled" && reviewRes.value.ok) {
        const revJson = await reviewRes.value.json();
        setReviewQueueData(revJson.data);
      }

      if (docsRes.status === "fulfilled" && docsRes.value.ok) {
        const dJson = await docsRes.value.json();
        setDocumentsData(dJson.data?.documents || []);
      }
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
        body: JSON.stringify({
          name: editName.trim(),
          description: editDesc.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to update project");

      setProject((prev) => (prev ? { ...prev, name: data.data.name, description: data.data.description } : null));
      setIsEditing(false);
      setSuccessMessage("Project details updated successfully.");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update project");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!confirm("Are you sure you want to archive this project?")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to archive project");
      setProject((prev) => (prev ? { ...prev, status: "ARCHIVED" } : null));
      setSuccessMessage("Project has been archived.");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to archive project");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-muted-foreground space-y-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs font-medium">Assembling live project health metrics...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-muted-foreground space-y-3">
        <p className="text-sm font-medium">Unable to load project workspace.</p>
        <button
          onClick={() => loadAllProjectData()}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const isOwner = project.currentUserRole === "OWNER";

  // Real Metric Derivations
  const totalClaims = reviewQueueData?.metrics?.totalClaims ?? 0;
  const pendingReviews = reviewQueueData?.metrics?.pendingCount ?? reviewQueueData?.queue?.length ?? 0;
  const acceptedClaims = reviewQueueData?.metrics?.acceptedCount ?? 0;
  const openConflicts = conflictsData?.counts?.OPEN ?? (conflictsData?.conflicts?.filter((c: ConflictItem) => !c.status.startsWith("RESOLVED_")).length ?? 0);
  const continuityScore = intelligence?.score?.overallScore;
  const continuityStatus = intelligence?.score?.status;

  // Radar diagnostic risk breakdown
  const radarMetrics = radarData?.metrics;
  const highRiskRadar = radarMetrics?.bySeverity?.HIGH ?? 0;
  const singlePersonDeps = intelligence?.busFactor?.singleOwnerCriticalCount ?? radarMetrics?.byRule?.R1 ?? 0;
  const missingDocGaps = radarMetrics?.byRule?.R2 ?? 0;
  const unassignedGaps = radarMetrics?.byRule?.R3 ?? 0;
  const decisionGaps = radarMetrics?.byRule?.R4 ?? 0;
  const openQuestions = radarMetrics?.byRule?.R5 ?? 0;
  const inconsistencies = radarMetrics?.byRule?.R6 ?? openConflicts;

  return (
    <div className="space-y-8">
      {/* Toast Feedback */}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-medium text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs font-medium text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* PROJECT HEADER CARD */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getRoleBadgeClass(
                  project.currentUserRole
                )}`}
              >
                Your Role: {formatRoleLabel(project.currentUserRole)}
              </span>

              <span
                className={
                  project.status === "ACTIVE"
                    ? "inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 px-2 py-0.5 rounded-full"
                    : "inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 px-2 py-0.5 rounded-full"
                }
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    project.status === "ACTIVE" ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
                {project.status}
              </span>
            </div>

            {isEditing ? (
              <form onSubmit={handleUpdate} className="space-y-3 pt-2">
                <div>
                  <label className="text-xs font-semibold text-foreground">Project Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="w-full rounded-xl border bg-background px-3 py-1.5 text-xs focus:ring-2 focus:ring-primary shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Description</label>
                  <textarea
                    rows={2}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full rounded-xl border bg-background px-3 py-1.5 text-xs focus:ring-2 focus:ring-primary shadow-sm resize-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={saving || !editName.trim()}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    <Save className="h-3 w-3" /> Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="rounded-lg border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground truncate">
                  {project.name}
                </h1>
                <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                  {project.description || "No architecture description provided."}
                </p>
              </div>
            )}
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {isOwner && !isEditing && (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border bg-muted/40 hover:bg-muted px-3 py-1.5 text-xs font-medium text-foreground transition-colors"
                >
                  <Edit2 className="h-3.5 w-3.5" /> Edit
                </button>
                {project.status === "ACTIVE" && (
                  <button
                    onClick={handleArchive}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200/60 bg-rose-50/30 hover:bg-rose-50 text-rose-700 px-3 py-1.5 text-xs font-medium transition-colors"
                  >
                    <Archive className="h-3.5 w-3.5" /> Archive
                  </button>
                )}
              </>
            )}

            <Link
              href={`/projects/${projectId}/documents`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-sm transition-all active:scale-[0.98]"
            >
              <FileText className="h-3.5 w-3.5" /> Upload Document
            </Link>
          </div>
        </div>

        {/* Project Meta Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground pt-1">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-primary" />
              <span>{project.members.length} Authorized Team Member{project.members.length !== 1 ? "s" : ""}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <span>Created {formatDate(project.createdAt)} by {project.createdByUser.name}</span>
            </span>
          </div>

          <Link
            href={`/projects/${projectId}/members`}
            className="text-primary hover:underline font-semibold flex items-center gap-1"
          >
            Manage Permissions & Access Control →
          </Link>
        </div>
      </div>

      {/* SECTION A: PROJECT HEALTH METRICS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Section A: Core Project Health
            </h2>
          </div>
          <span className="text-[11px] text-muted-foreground">Deterministic Ground Truth</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Documentation Files"
            value={documentsData.length}
            subtitle={
              documentsData.length === 0
                ? "No docs uploaded yet"
                : `${documentsData.filter((d) => d.state === "COMPLETED").length} extracted & indexed`
            }
            icon={FileText}
          />
          <MetricCard
            title="Verified Claims"
            value={totalClaims === 0 ? "0" : `${acceptedClaims} / ${totalClaims}`}
            subtitle={
              totalClaims === 0
                ? "Upload docs to extract claims"
                : `${Math.round((acceptedClaims / totalClaims) * 100)}% verified or accepted`
            }
            icon={CheckSquare}
            variant={acceptedClaims > 0 ? "success" : "default"}
          />
          <MetricCard
            title="Open Conflicts"
            value={openConflicts}
            subtitle={openConflicts === 0 ? "Zero conflicting facts" : "Requires reviewer resolution"}
            icon={AlertTriangle}
            variant={openConflicts > 0 ? "danger" : "success"}
          />
          <MetricCard
            title="Continuity Readiness"
            value={
              continuityStatus === "INSUFFICIENT_EVIDENCE" || continuityScore === null
                ? "Need Evidence"
                : `${continuityScore}%`
            }
            subtitle={
              continuityStatus === "INSUFFICIENT_EVIDENCE"
                ? "<60% weight coverage available"
                : "5-dimension readiness index"
            }
            icon={BrainCircuit}
            variant={
              continuityScore && continuityScore >= 80
                ? "success"
                : continuityScore && continuityScore >= 50
                ? "warning"
                : "default"
            }
          />
        </div>
      </div>

      {/* SECTION B & C: KNOWLEDGE HEALTH & KNOWLEDGE RISKS (2 COLS) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SECTION B: KNOWLEDGE HEALTH */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-1 border-b pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-sm text-foreground">Section B: Knowledge Health Distribution</h3>
              </div>
              <Badge variant="outline" size="sm">Evidence Audit</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Proof-carrying verification breakdown across extracted triples.
            </p>
          </div>

          {totalClaims === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-xs space-y-1">
              <p className="font-semibold text-foreground">No claims extracted yet</p>
              <p className="text-[11px]">Upload architecture documents to populate evidence gates.</p>
              <Link
                href={`/projects/${projectId}/documents`}
                className="inline-block mt-3 px-3 py-1 bg-primary text-primary-foreground font-semibold rounded-lg text-xs"
              >
                Go to Documents
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span>Accepted / Verified Claims</span>
                  <span className="text-emerald-600">{acceptedClaims} ({Math.round((acceptedClaims / totalClaims) * 100)}%)</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
                  <div
                    style={{ width: `${(acceptedClaims / totalClaims) * 100}%` }}
                    className="bg-emerald-500 h-full"
                  />
                  <div
                    style={{ width: `${(pendingReviews / totalClaims) * 100}%` }}
                    className="bg-amber-400 h-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs pt-2">
                <div className="rounded-xl border bg-muted/20 p-3 space-y-1">
                  <div className="text-[11px] text-muted-foreground font-medium">Pending Human Review</div>
                  <div className="text-lg font-bold text-foreground">{pendingReviews}</div>
                </div>
                <div className="rounded-xl border bg-muted/20 p-3 space-y-1">
                  <div className="text-[11px] text-muted-foreground font-medium">Active Conflicts</div>
                  <div className="text-lg font-bold text-rose-600">{openConflicts}</div>
                </div>
              </div>
            </div>
          )}

          <div className="pt-2 border-t flex justify-end">
            <Link
              href={`/projects/${projectId}/claims`}
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
            >
              Explore Fact Graph & Evidence Links →
            </Link>
          </div>
        </div>

        {/* SECTION C: KNOWLEDGE RISKS (RADAR DIAGNOSTIC) */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-1 border-b pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radar className="h-4 w-4 text-rose-600" />
                <h3 className="font-bold text-sm text-foreground">Section C: Knowledge Risk Radar</h3>
              </div>
              {highRiskRadar > 0 ? (
                <Badge variant="destructive" size="sm">{highRiskRadar} High Severity</Badge>
              ) : (
                <Badge variant="success" size="sm">Risks Controlled</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Rule-based indicators scanning for SPOF, missing rationale, and unassigned work.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="rounded-xl border bg-muted/20 p-2.5 space-y-1">
              <span className="text-[10px] text-muted-foreground block font-medium">R1: Bus Factor</span>
              <span className={`text-base font-bold ${singlePersonDeps > 0 ? "text-rose-600" : "text-foreground"}`}>
                {singlePersonDeps} SPOF
              </span>
            </div>
            <div className="rounded-xl border bg-muted/20 p-2.5 space-y-1">
              <span className="text-[10px] text-muted-foreground block font-medium">R2: Missing Docs</span>
              <span className="text-base font-bold text-foreground">{missingDocGaps}</span>
            </div>
            <div className="rounded-xl border bg-muted/20 p-2.5 space-y-1">
              <span className="text-[10px] text-muted-foreground block font-medium">R3: Unassigned</span>
              <span className="text-base font-bold text-foreground">{unassignedGaps}</span>
            </div>
            <div className="rounded-xl border bg-muted/20 p-2.5 space-y-1">
              <span className="text-[10px] text-muted-foreground block font-medium">R4: Missing Rationale</span>
              <span className="text-base font-bold text-foreground">{decisionGaps}</span>
            </div>
            <div className="rounded-xl border bg-muted/20 p-2.5 space-y-1">
              <span className="text-[10px] text-muted-foreground block font-medium">R5: Open Questions</span>
              <span className="text-base font-bold text-foreground">{openQuestions}</span>
            </div>
            <div className="rounded-xl border bg-muted/20 p-2.5 space-y-1">
              <span className="text-[10px] text-muted-foreground block font-medium">R6: Contradictions</span>
              <span className={`text-base font-bold ${inconsistencies > 0 ? "text-rose-600" : "text-foreground"}`}>
                {inconsistencies}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t flex justify-end">
            <Link
              href={`/projects/${projectId}/radar`}
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
            >
              Open Full Knowledge Loss Radar →
            </Link>
          </div>
        </div>
      </div>

      {/* SECTION D & E: ACTION REQUIRED & RECENT ACTIVITY (2 COLS) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SECTION D: ACTION REQUIRED (2 Cols) */}
        <div className="lg:col-span-2 rounded-2xl border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-amber-600" />
              <h3 className="font-bold text-sm text-foreground">Section D: Action Required</h3>
            </div>
            <span className="text-[11px] text-muted-foreground">Prioritized Human Governance</span>
          </div>

          {totalClaims === 0 ? (
            <div className="py-6 text-center text-muted-foreground text-xs space-y-1">
              <p className="font-semibold text-foreground">Upload project documents to start</p>
              <p className="text-[11px]">Upload system architecture, RFCs, and meeting notes to begin claim extraction.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingReviews > 0 && (
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-amber-200/80 bg-amber-50/30 dark:bg-amber-950/20 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="h-8 w-8 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 flex items-center justify-center font-bold">
                      {pendingReviews}
                    </span>
                    <div>
                      <div className="font-bold text-foreground">Candidate Claims Awaiting Human Review</div>
                      <div className="text-[11px] text-muted-foreground">Reviewer rationale required for weak or contradicted claims.</div>
                    </div>
                  </div>
                  <Link
                    href={`/projects/${projectId}/review`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
                  >
                    <span>Review Queue</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              )}

              {openConflicts > 0 && (
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-rose-200/80 bg-rose-50/30 dark:bg-rose-950/20 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="h-8 w-8 rounded-lg bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 flex items-center justify-center font-bold">
                      {openConflicts}
                    </span>
                    <div>
                      <div className="font-bold text-foreground">Unresolved Pairwise Contradictions</div>
                      <div className="text-[11px] text-muted-foreground">Contradictory claims prevent handover snapshot approval.</div>
                    </div>
                  </div>
                  <Link
                    href={`/projects/${projectId}/conflicts`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700 transition-colors"
                  >
                    <span>Resolve Conflicts</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              )}

              {singlePersonDeps > 0 && (
                <div className="flex items-center justify-between p-3.5 rounded-xl border bg-muted/20 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="h-8 w-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center font-bold">
                      {singlePersonDeps}
                    </span>
                    <div>
                      <div className="font-bold text-foreground">Single Point of Failure (SPOF) Components</div>
                      <div className="text-[11px] text-muted-foreground">Components with only 1 verified owner claim. Cross-training advised.</div>
                    </div>
                  </div>
                  <Link
                    href={`/projects/${projectId}/intelligence`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border bg-card hover:bg-muted font-semibold text-foreground transition-colors"
                  >
                    <span>Bus Factor Map</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              )}

              {pendingReviews === 0 && openConflicts === 0 && (
                <div className="p-4 rounded-xl border border-emerald-200/80 bg-emerald-50/30 dark:bg-emerald-950/20 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>All critical actions complete. Ready to seal immutable handover snapshot.</span>
                  </div>
                  <Link
                    href={`/projects/${projectId}/handover`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
                  >
                    <span>Open Handover</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECTION E: RECENT ACTIVITY (1 Col) */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-1 border-b pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="font-bold text-sm text-foreground">Section E: Recent Activity</h3>
            </div>
            <p className="text-xs text-muted-foreground">Latest document indexing and claims operations.</p>
          </div>

          <div className="space-y-3 flex-1">
            {documentsData.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-4">No recent activity recorded.</p>
            ) : (
              documentsData.slice(0, 4).map((doc) => (
                <div key={doc.id} className="flex items-start gap-2.5 text-xs">
                  <FileText className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-foreground truncate">{doc.fileName || doc.title || "Document"}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {doc.state || doc.processingStatus || "ACTIVE"} · {doc.extractedClaimCount ?? doc._count?.claims ?? 0} claims extracted
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-2 border-t">
            <Link
              href={`/projects/${projectId}/documents`}
              className="text-xs text-primary font-semibold hover:underline flex items-center justify-between"
            >
              <span>View all project documents</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
