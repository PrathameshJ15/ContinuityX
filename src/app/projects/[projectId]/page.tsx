"use client";

import { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import {
  Calendar,
  User,
  Users,
  Shield,
  Edit2,
  Archive,
  Save,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Radar,
  ArrowRight,
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
  const [radarCount, setRadarCount] = useState<{ open: number; high: number } | null>(null);

  const loadProject = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to load project details");
      }
      setProject(data.data);
      setEditName(data.data.name);
      setEditDesc(data.data.description || "");

      // Load radar counts
      try {
        const radarRes = await fetch(`/api/projects/${projectId}/radar?status=OPEN`);
        const radarJson = await radarRes.json();
        if (radarRes.ok && radarJson.data?.metrics) {
          setRadarCount({
            open: radarJson.data.metrics.totalOpen,
            high: radarJson.data.metrics.bySeverity.HIGH,
          });
        }
      } catch {
        // Radar metric load is best-effort
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading project");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          description: editDesc || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to update project");
      }

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
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to archive project");
      }
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
      <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
        <p className="text-sm font-medium">Loading project overview...</p>
      </div>
    );
  }

  if (!project) return null;

  const isOwner = project.currentUserRole === "OWNER";

  return (
    <div className="space-y-6">
      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Details Card */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{project.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Workspace ID: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{project.id}</code>
            </p>
          </div>

          {isOwner && !isEditing && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
              >
                <Edit2 className="h-3.5 w-3.5" /> Edit Details
              </button>
              {project.status === "ACTIVE" && (
                <button
                  onClick={handleArchive}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 px-3 py-1.5 text-xs font-medium hover:bg-amber-100 transition-colors"
                >
                  <Archive className="h-3.5 w-3.5" /> Archive
                </button>
              )}
            </div>
          )}
        </div>

        {isEditing ? (
          <form onSubmit={handleUpdate} className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="editName">
                Project Name
              </label>
              <input
                id="editName"
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="editDesc">
                Description
              </label>
              <textarea
                id="editDesc"
                rows={3}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                disabled={saving || !editName.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save Changes
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setEditName(project.name);
                  setEditDesc(project.description || "");
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="pt-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Project Description
            </h4>
            <p className="mt-1 text-sm text-foreground/90 whitespace-pre-wrap">
              {project.description || "No description provided for this project."}
            </p>
          </div>
        )}
      </div>

      {/* Metadata Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Workspace Status</div>
            <div className="font-semibold text-sm capitalize">{project.status.toLowerCase()}</div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
            <User className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Created By</div>
            <div className="font-semibold text-sm">{project.createdByUser.name}</div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Team Size</div>
            <div className="font-semibold text-sm">{project.members.length} Members</div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Created On</div>
            <div className="font-semibold text-sm">{new Date(project.createdAt).toLocaleDateString()}</div>
          </div>
        </div>
      </div>

      {/* Knowledge Loss Radar Indicator Banner */}
      {radarCount && (
        <div className="rounded-xl border bg-card p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-500/10 p-2.5 text-amber-600 dark:text-amber-400">
              <Radar className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                Knowledge Loss Radar: {radarCount.open} Open Risk Alert{radarCount.open !== 1 ? "s" : ""}
                {radarCount.high > 0 && (
                  <span className="rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 px-2 py-0.5 text-xs font-semibold">
                    {radarCount.high} High Risk
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Rule-based checks monitoring single-person dependencies, missing rationale, and unassigned work.
              </p>
            </div>
          </div>

          <Link
            href={`/projects/${projectId}/radar`}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted shadow-sm transition-colors shrink-0"
          >
            Open Radar <ArrowRight className="h-3.5 w-3.5 text-primary" />
          </Link>
        </div>
      )}
    </div>
  );
}
