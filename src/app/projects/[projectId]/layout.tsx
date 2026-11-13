"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectOption } from "@/components/layout/sidebar";
import { Loader2, AlertOctagon, ArrowLeft } from "lucide-react";

interface ProjectDetails {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "ARCHIVED";
  currentUserRole: "OWNER" | "REVIEWER" | "VIEWER";
}

interface UserProfile {
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
  const router = useRouter();
  const pathname = usePathname();
  const resolvedParams = use(params);
  const projectId = resolvedParams.projectId;

  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [allProjects, setAllProjects] = useState<ProjectOption[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    async function loadWorkspaceData() {
      try {
        setLoading(true);
        const [projRes, projectsRes, meRes] = await Promise.all([
          fetch(`/api/projects/${projectId}`, { signal: controller.signal }),
          fetch("/api/projects", { signal: controller.signal }),
          fetch("/api/auth/me", { signal: controller.signal }),
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

        if (projectsRes.ok) {
          const listJson = await projectsRes.json();
          if (Array.isArray(listJson.data?.projects) && isMounted) {
            setAllProjects(listJson.data.projects);
          }
        }

        if (meRes.ok) {
          const meJson = await meRes.json();
          if (meJson.data?.user && isMounted) {
            setUser(meJson.data.user);
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
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
      controller.abort();
    };
  }, [projectId, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        <p className="text-xs font-medium text-muted-foreground">Loading enterprise project workspace...</p>
      </div>
    );
  }

  if (errorStatus) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-lg space-y-4">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive border border-destructive/20">
            <AlertOctagon className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">
            {errorStatus === 404 ? "Project Not Found" : errorStatus === 403 ? "Access Denied" : "Error"}
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {errorMessage || "You do not have permission to access this project workspace."}
          </p>
          <div className="pt-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Return to Workspace Hub
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!project) return null;

  function getCurrentPageTitle(path: string): string {
    if (path.endsWith("/documents")) return "Documents & Extraction";
    if (path.endsWith("/claims")) return "Claims & Fact Graph";
    if (path.endsWith("/entities")) return "Entity Registry";
    if (path.endsWith("/conflicts")) return "Pairwise Conflicts";
    if (path.endsWith("/review")) return "Evidence Review Queue";
    if (path.endsWith("/radar")) return "Knowledge Loss Radar";
    if (path.endsWith("/intelligence")) return "Continuity Intelligence";
    if (path.endsWith("/handover")) return "Handover Workspace";
    if (path.endsWith("/members")) return "Team & Permissions";
    return "Project Dashboard";
  }

  return (
    <AppShell
      currentProject={project}
      projects={allProjects}
      user={user}
      currentPageTitle={getCurrentPageTitle(pathname)}
    >
      {children}
    </AppShell>
  );
}
