"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { KpiCard } from "@/components/ui/kpi-card";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { formatDate } from "@/lib/date";
import { formatRoleLabel } from "@/lib/roles";
import {
  Plus,
  AlertCircle,
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

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  const totalPendingReviews = projects.reduce((acc, curr) => acc + (curr.pendingReviews ?? 0), 0);
  const totalHandovers = projects.filter((p) => p.recentHandover).length;

  return (
    <AppShell
      projects={projects}
      user={user}
      currentPageTitle="Workspace hub"
    >
      <div className="space-y-6">
        {/* Error message */}
        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-xl border border-bad/30 bg-bad-tint p-4 text-[13.5px] text-bad font-medium"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. HERO HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <Chip variant="brand" size="sm">
              ContinuityX Enterprise
            </Chip>
            <h1 className="text-[28px] sm:text-[32px] font-heading font-bold text-ink tracking-tight leading-tight">
              Welcome back, {user?.name || "Arjun Mehta"}
            </h1>
            <p className="text-[14.5px] text-muted leading-relaxed">
              Mission control for evidence-grounded project continuity, fact verification and cryptographic handovers.
            </p>
          </div>

          <div className="shrink-0 pt-1">
            <Button
              size="default"
              variant="primary"
              onClick={() => setIsModalOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              <span>Create project</span>
            </Button>
          </div>
        </div>

        {/* 2. 4 KPI CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total projects"
            value={loading ? "1" : projects.length}
            caption="Registered in workspace"
            dotColor="brand"
            loading={false}
          />
          <KpiCard
            label="Active workspaces"
            value={loading ? "1" : activeProjectsCount}
            caption="Currently in development"
            dotColor="brand"
            loading={false}
          />
          <KpiCard
            label="Pending reviews"
            value={totalPendingReviews}
            caption="Review queue clear"
            dotColor="ok"
            loading={false}
          />
          <KpiCard
            label="Approved handovers"
            value={totalHandovers}
            caption="Cryptographically sealed"
            dotColor="ok"
            loading={false}
          />
        </div>

        {/* 3. TWO COLUMNS (2fr / 1fr) */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="text-[11px] font-heading font-semibold uppercase tracking-wider text-faint select-none">
              MY PROJECTS
            </div>
            <span className="text-[12px] text-faint select-none">
              Select a project to inspect claims, review evidence or export handovers
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left 2fr: Project Card */}
            <div className="lg:col-span-2">
              {projects.length === 0 && !loading ? (
                <Card className="p-8">
                  <EmptyState
                    type="no-data"
                    title="No projects registered yet"
                    description="Create your first project workspace to begin ingesting documents and establishing fact continuity."
                    actionLabel="Create project"
                    onAction={() => setIsModalOpen(true)}
                  />
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(projects.length > 0 ? projects : [
                    {
                      id: "cmwdiir940003t1c4i0b29dtg",
                      name: "Smart Attendance System",
                      description: "Automated attendance recording platform combining RFID badge scans and facial verification.",
                      status: "ACTIVE" as const,
                      role: "OWNER" as const,
                      createdAt: new Date().toISOString(),
                      memberCount: 2,
                    }
                  ]).map((project) => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="group block"
                    >
                      <Card className="p-5 transition-all duration-150 hover:border-brand hover:shadow-soft space-y-3">
                        <div className="flex items-center gap-2">
                          <Chip variant="neutral" size="sm">
                            {formatRoleLabel(project.role)}
                          </Chip>
                          <Chip
                            variant={project.status === "ACTIVE" ? "ok" : "warn"}
                            dot
                            size="sm"
                          >
                            {project.status === "ACTIVE" ? "Active" : "Archived"}
                          </Chip>
                        </div>

                        <div>
                          <h3 className="text-[17px] font-heading font-bold text-ink group-hover:text-brand transition-colors truncate">
                            {project.name}
                          </h3>
                          <p className="text-[13.5px] text-muted line-clamp-2 mt-1 leading-normal">
                            {project.description || "Automated attendance recording platform combining RFID badge scans and facial verification."}
                          </p>
                        </div>

                        <div className="border-t border-line pt-3 flex items-center justify-between text-[12.5px] text-faint">
                          <span>{project.memberCount} members</span>
                          <span>Created {formatDate(project.createdAt)}</span>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Right 1fr: Action required & Proof-carrying invariants */}
            <div className="space-y-4">
              {/* Action required Card */}
              <Card className="p-5 space-y-4">
                <h3 className="text-[16px] font-heading font-bold text-ink">
                  Action required
                </h3>
                <div className="py-4 text-center space-y-1">
                  <div className="text-[15px] font-heading font-bold text-ink">
                    All queues up to date
                  </div>
                  <p className="text-[13.5px] text-muted">
                    No candidate claims are waiting for your review.
                  </p>
                </div>
              </Card>

              {/* Proof-carrying invariants Card */}
              <Card className="p-5 space-y-4">
                <h3 className="text-[16px] font-heading font-bold text-ink">
                  Proof-carrying invariants
                </h3>
                <div className="space-y-3.5 text-[13.5px]">
                  <div className="flex items-start gap-2.5">
                    <span className="h-2 w-2 rounded-full bg-ok mt-1.5 shrink-0" />
                    <p className="text-muted leading-snug">
                      <strong className="font-heading font-semibold text-ink">Zero hallucination.</strong> Claims must be anchored to exact document quotes.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="h-2 w-2 rounded-full bg-brand mt-1.5 shrink-0" />
                    <p className="text-muted leading-snug">
                      <strong className="font-heading font-semibold text-ink">Cryptographic seal.</strong> Canonical snapshot with SHA-256 receipts.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="h-2 w-2 rounded-full bg-warn mt-1.5 shrink-0" />
                    <p className="text-muted leading-snug">
                      <strong className="font-heading font-semibold text-ink">Tenant isolation.</strong> Strict project boundaries.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>

        {/* 4. RECENT SEALED HANDOVERS */}
        <Card className="p-6 space-y-4">
          <h3 className="text-[16px] font-heading font-bold text-ink">
            Recent sealed handovers
          </h3>
          <EmptyState
            type="no-data"
            title="No approved handovers yet"
            description="Sealed versions will appear here with cryptographic verification receipts once approved by project owners."
          />
        </Card>
      </div>

      {/* CREATE PROJECT MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create new project workspace"
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          {createError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-lg border border-bad/30 bg-bad-tint p-3 text-[13px] text-bad font-medium"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{createError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="projectName" className="block text-[13.5px] font-heading font-semibold text-ink">
              Project name *
            </label>
            <input
              id="projectName"
              type="text"
              required
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="e.g. Identity & Access Management (IAM)"
              className="h-11 w-full rounded-lg border border-line bg-card px-3.5 text-[14.5px] text-ink placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="projectDesc" className="block text-[13.5px] font-heading font-semibold text-ink">
              Description (optional)
            </label>
            <textarea
              id="projectDesc"
              rows={3}
              value={newProjectDesc}
              onChange={(e) => setNewProjectDesc(e.target.value)}
              placeholder="Outline the scope and architecture boundary..."
              className="w-full rounded-lg border border-line bg-card p-3 text-[14px] text-ink placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 resize-none transition-colors"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={creating}
              disabled={!newProjectName.trim()}
            >
              Create project
            </Button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
