"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { MetricCard } from "@/components/ui/metric-card";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/date";
import { formatRoleLabel, getRoleBadgeClass } from "@/lib/roles";
import {
  FolderKanban,
  Plus,
  Users,
  Calendar,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Award,
  CheckSquare,
  ShieldCheck,
  Clock,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";

interface ProjectItem {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "ARCHIVED";
  role: "OWNER" | "REVIEWER" | "VIEWER";
  createdAt: string;
  memberCount: number;
  pendingReviews?: number;
  recentHandover?: { version: number; approvedAt: string } | null;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
}

interface ProjectSummaryWork {
  projectId: string;
  projectName: string;
  pendingReviews: number;
  recentHandover?: {
    version: number;
    approvedAt: string;
  } | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [projectWork, setProjectWork] = useState<Record<string, ProjectSummaryWork>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search filter inside projects
  const [projectSearch, setProjectSearch] = useState("");

  // Create Project Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [userRes, projectsRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/projects"),
      ]);

      if (userRes.status === 401) {
        router.push("/login");
        return;
      }

      const userData = await userRes.json();
      const projectsData = await projectsRes.json();

      if (!userRes.ok || !userData.data?.user) {
        throw new Error("Failed to load user profile");
      }
      if (!projectsRes.ok) {
        throw new Error(projectsData.error?.message || "Failed to load projects");
      }

      const loadedProjects: ProjectItem[] = projectsData.data.projects || [];
      setUser(userData.data.user);
      setProjects(loadedProjects);

      // Efficiently populate review counts and handovers from single API response (O(1) vs N+1 requests)
      const workMap: Record<string, ProjectSummaryWork> = {};
      for (const p of loadedProjects) {
        workMap[p.id] = {
          projectId: p.id,
          projectName: p.name,
          pendingReviews: p.pendingReviews ?? 0,
          recentHandover: p.recentHandover ?? null,
        };
      }
      setProjectWork(workMap);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProjectName.trim(),
          description: newProjectDesc.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to create project");
      }

      setIsModalOpen(false);
      setNewProjectName("");
      setNewProjectDesc("");
      router.push(`/projects/${data.data.id}`);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  const activeProjectsCount = projects.filter((p) => p.status === "ACTIVE").length;
  const totalPendingReviews = Object.values(projectWork).reduce((acc, curr) => acc + curr.pendingReviews, 0);
  const totalHandovers = Object.values(projectWork).filter((w) => w.recentHandover).length;

  const filteredProjects = projectSearch.trim()
    ? projects.filter(
        (p) =>
          p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
          p.description?.toLowerCase().includes(projectSearch.toLowerCase())
      )
    : projects;

  const pendingReviewProjects = Object.values(projectWork).filter((w) => w.pendingReviews > 0);

  return (
    <AppShell
      projects={projects}
      user={user}
      currentPageTitle="Workspace Hub"
    >
      <div className="space-y-8">
        {/* Workspace Hero Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 text-xs font-semibold flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                ContinuityX Enterprise
              </span>
              <span className="text-xs text-muted-foreground">· Workspace Hub</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Welcome back{user?.name ? `, ${user.name}` : ""}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl">
              Centralized mission control for evidence-grounded project continuity, fact verification, and cryptographic handovers.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              <span>Create Project</span>
            </button>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="underline hover:text-foreground">
              Dismiss
            </button>
          </div>
        )}

        {/* SECTION 4 METRIC CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Projects"
            value={loading ? "-" : projects.length}
            subtitle="Registered in workspace"
            icon={FolderKanban}
          />
          <MetricCard
            title="Active Workspaces"
            value={loading ? "-" : activeProjectsCount}
            subtitle="Currently in development"
            icon={ShieldCheck}
            variant="info"
          />
          <MetricCard
            title="Pending Reviews"
            value={loading ? "-" : totalPendingReviews}
            subtitle={totalPendingReviews > 0 ? "Awaiting reviewer judgment" : "Review queue clear"}
            icon={CheckSquare}
            variant={totalPendingReviews > 0 ? "warning" : "success"}
          />
          <MetricCard
            title="Approved Handovers"
            value={loading ? "-" : totalHandovers}
            subtitle="Cryptographically sealed"
            icon={Award}
            variant="success"
          />
        </div>

        {/* MAIN LAYOUT: LEFT MY PROJECTS / RIGHT PENDING REVIEWS & ACTIVITY */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* PRIMARY AREA (2 Cols): My Projects */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-foreground tracking-tight">My Projects</h2>
                <p className="text-xs text-muted-foreground">
                  Select a project workspace to inspect claims, review evidence, or export handovers.
                </p>
              </div>

              {projects.length > 3 && (
                <input
                  type="text"
                  placeholder="Filter projects..."
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  className="rounded-lg border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary w-48 shadow-sm"
                />
              )}
            </div>

            {loading ? (
              <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground space-y-2">
                <Loader2 className="h-7 w-7 animate-spin mx-auto text-primary" />
                <p className="text-xs">Loading authorized project workspaces...</p>
              </div>
            ) : filteredProjects.length === 0 ? (
              <EmptyState
                type="no-data"
                title="No project workspaces found"
                description="Get started by creating your first enterprise continuity project."
                actionLabel="Create Project"
                onAction={() => setIsModalOpen(true)}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredProjects.map((proj) => {
                  const work = projectWork[proj.id];
                  return (
                    <Link
                      key={proj.id}
                      href={`/projects/${proj.id}`}
                      className="group flex flex-col justify-between rounded-2xl border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-primary/40 transition-all duration-150"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getRoleBadgeClass(
                              proj.role
                            )}`}
                          >
                            {formatRoleLabel(proj.role)}
                          </span>

                          <span
                            className={
                              proj.status === "ACTIVE"
                                ? "inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"
                                : "text-[10px] text-amber-600 font-semibold"
                            }
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                proj.status === "ACTIVE" ? "bg-emerald-500" : "bg-amber-500"
                              }`}
                            />
                            {proj.status}
                          </span>
                        </div>

                        <div>
                          <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors flex items-center justify-between">
                            <span className="truncate">{proj.name}</span>
                            <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0 ml-1" />
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                            {proj.description || "No description provided for this project."}
                          </p>
                        </div>
                      </div>

                      <div className="pt-4 mt-4 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {proj.memberCount} member{proj.memberCount !== 1 ? "s" : ""}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(proj.createdAt)}
                          </span>
                        </div>

                        {work && work.pendingReviews > 0 ? (
                          <span className="font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-900/60 text-[10px]">
                            {work.pendingReviews} in review
                          </span>
                        ) : work?.recentHandover ? (
                          <span className="font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-900/60 text-[10px]">
                            v{work.recentHandover.version} sealed
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECONDARY AREA (1 Col): Pending Reviews & Activity */}
          <div className="space-y-6">
            {/* Pending Reviews Card */}
            <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-primary" />
                  <h3 className="font-bold text-sm text-foreground">Action Required</h3>
                </div>
                {totalPendingReviews > 0 && (
                  <span className="rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 px-2 py-0.2 text-[10px] font-bold">
                    {totalPendingReviews} Pending
                  </span>
                )}
              </div>

              {pendingReviewProjects.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground text-xs space-y-1">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1.5" />
                  <p className="font-semibold text-foreground">All queues up to date</p>
                  <p className="text-[11px]">No candidate claims waiting for your review.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {pendingReviewProjects.map((item) => (
                    <Link
                      key={item.projectId}
                      href={`/projects/${item.projectId}/review`}
                      className="flex items-center justify-between p-3 rounded-xl border bg-muted/20 hover:bg-muted/60 transition-colors text-xs group"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                          {item.projectName}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          <span>Requires human verification</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 px-2 py-0.5 font-bold text-[10px]">
                          {item.pendingReviews}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Workspace Security & Verification Architecture */}
            <div className="rounded-2xl border bg-gradient-to-br from-card to-muted/20 p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-foreground font-bold text-xs uppercase tracking-wider">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Proof-Carrying Invariants
              </div>
              <ul className="text-xs text-muted-foreground space-y-2.5">
                <li className="flex items-start gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                  <span><strong>Zero Hallucination Tolerance:</strong> Claims must be anchored to exact stored document chunk quotes.</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                  <span><strong>Cryptographic Handover Seal:</strong> Canonical JSON snapshot with SHA-256 tamper-evident receipts.</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                  <span><strong>Multi-Tenant Isolation:</strong> Strict project boundary enforcement with zero enumeration defense.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* BOTTOM: RECENT HANDOVERS & SEALED RECEIPTS */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-emerald-600" />
                <h3 className="font-bold text-base text-foreground">Recent Sealed Handovers</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Immutable, cryptographic project snapshots ready for succession, due diligence, and offboarding.
              </p>
            </div>
          </div>

          {projects.filter((p) => projectWork[p.id]?.recentHandover).length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-xs space-y-1">
              <Award className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="font-semibold text-foreground">No approved handovers generated yet</p>
              <p className="text-[11px] max-w-md mx-auto">
                Once claims are reviewed and conflicts resolved, approve a handover snapshot to generate an immutable SHA-256 seal.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {projects
                .filter((p) => projectWork[p.id]?.recentHandover)
                .map((p) => {
                  const h = projectWork[p.id]?.recentHandover;
                  if (!h) return null;
                  return (
                    <div key={p.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center shrink-0">
                          <Award className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-bold text-foreground text-sm">{p.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            Sealed Snapshot Version {h.version} · Approved {formatDate(h.approvedAt)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          href={`/projects/${p.id}/handover`}
                          className="inline-flex items-center gap-1.5 rounded-lg border bg-muted/40 hover:bg-muted px-3 py-1.5 text-xs font-semibold text-foreground transition-colors"
                        >
                          <span>Inspect Receipt</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Create Project Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Enterprise Project Workspace"
        description="Initialize a dedicated continuity environment with role-based governance and evidence tracking."
        maxWidth="md"
        footer={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-project-form"
              disabled={creating || !newProjectName.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
            >
              {creating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating...
                </>
              ) : (
                <>Create Project</>
              )}
            </button>
          </div>
        }
      >
        <form id="create-project-form" onSubmit={handleCreateProject} className="space-y-4">
          {createError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{createError}</span>
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="newProjectName" className="font-semibold text-foreground text-xs">
              Project Name <span className="text-destructive">*</span>
            </label>
            <input
              id="newProjectName"
              type="text"
              required
              placeholder="e.g. Core Banking Migration, Biometric Auth Engine"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="w-full rounded-xl border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="newProjectDesc" className="font-semibold text-foreground text-xs">
              Description (optional)
            </label>
            <textarea
              id="newProjectDesc"
              rows={3}
              placeholder="High-level architecture goals, critical dependencies, or key handover objectives..."
              value={newProjectDesc}
              onChange={(e) => setNewProjectDesc(e.target.value)}
              className="w-full rounded-xl border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary shadow-sm resize-none"
            />
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
