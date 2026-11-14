"use client";

import React, { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertOctagon, RotateCw } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectOption } from "@/components/layout/sidebar";
import { WorkspaceProjectProvider, WorkspaceProject } from "./project-context";
import { Button } from "@/components/ui/button";

interface UserProfile {
  id: string;
  name: string;
  email: string;
}

export default function ProjectWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const router = useRouter();

  const [project, setProject] = useState<WorkspaceProject | null>(null);
  const [allProjects, setAllProjects] = useState<ProjectOption[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) {
        const json = await res.json();
        setProject(json.data);
      }
    } catch {
      // non-blocking
    }
  }, [projectId]);

  useEffect(() => {
    let isMounted = true;

    async function loadWorkspaceData() {
      try {
        setLoading(true);
        setErrorStatus(null);
        setErrorMessage(null);

        // Fetch project and user in parallel - do NOT block on full project list
        const [projRes, meRes] = await Promise.all([
          fetch(`/api/projects/${projectId}`),
          fetch("/api/auth/me"),
        ]);

        if (projRes.status === 401) {
          router.push("/login");
          return;
        }

        const projData = await projRes.json();
        if (!projRes.ok) {
          if (isMounted) {
            setErrorStatus(projRes.status);
            setErrorMessage(projData.error?.message || "Failed to load project workspace");
          }
          return;
        }

        if (isMounted) {
          setProject(projData.data);
        }

        if (meRes.ok) {
          const meJson = await meRes.json();
          if (meJson.data?.user && isMounted) {
            setUser(meJson.data.user);
          }
        }

        // Load project switcher list in background (non-blocking)
        fetch("/api/projects")
          .then((res) => res.json())
          .then((listJson) => {
            if (Array.isArray(listJson.data?.projects) && isMounted) {
              setAllProjects(listJson.data.projects);
            }
          })
          .catch(() => {});
      } catch (err: unknown) {
        if (isMounted) {
          setErrorStatus(500);
          setErrorMessage(err instanceof Error ? err.message : "Network error");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadWorkspaceData();

    return () => {
      isMounted = false;
    };
  }, [projectId, router]);

  if (errorStatus) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-bg p-4">
        <div className="w-full max-w-md rounded-xl border border-line bg-card p-8 text-center shadow-sm space-y-4">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-bad-tint text-bad border border-bad/20">
            <AlertOctagon className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-heading font-bold text-ink">
            {errorStatus === 404 ? "Project Not Found" : errorStatus === 403 ? "Access Denied" : "Error"}
          </h2>
          <p className="text-[13.5px] text-muted leading-relaxed">
            {errorMessage || "You do not have permission to access this project workspace."}
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <Link href="/dashboard">
              <Button variant="secondary" size="sm">
                Return to Hub
              </Button>
            </Link>
            <Button
              variant="primary"
              size="sm"
              onClick={() => window.location.reload()}
            >
              <RotateCw className="h-3.5 w-3.5 mr-1.5" />
              <span>Retry</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const currentProjectOption = project
    ? {
        id: project.id,
        name: project.name,
        status: project.status,
        currentUserRole: project.currentUserRole,
      }
    : null;

  return (
    <WorkspaceProjectProvider
      value={{
        project,
        setProject,
        loading,
        refreshProject,
      }}
    >
      <AppShell
        currentProject={currentProjectOption}
        projects={allProjects}
        user={user}
      >
        {children}
      </AppShell>
    </WorkspaceProjectProvider>
  );
}
