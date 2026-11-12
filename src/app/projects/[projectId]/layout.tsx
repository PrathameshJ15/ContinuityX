"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ShieldCheck,
  ArrowLeft,
  Users,
  LayoutDashboard,
  FileText,
  ListChecks,
  Network,
  Loader2,
  AlertOctagon,
  AlertTriangle,
  CheckSquare,
} from "lucide-react";

interface ProjectDetails {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "ARCHIVED";
  currentUserRole: "OWNER" | "REVIEWER" | "VIEWER";
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
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProject() {
      try {
        setLoading(true);
        const res = await fetch(`/api/projects/${projectId}`);
        const data = await res.json();

        if (res.status === 401) {
          router.push("/login");
          return;
        }

        if (!res.ok) {
          setErrorStatus(res.status);
          setErrorMessage(data.error?.message || "Failed to load project workspace");
          return;
        }

        setProject(data.data);
      } catch (err: unknown) {
        setErrorStatus(500);
        setErrorMessage(err instanceof Error ? err.message : "Network error");
      } finally {
        setLoading(false);
      }
    }

    fetchProject();
  }, [projectId, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted/10 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        <p className="text-sm font-medium text-muted-foreground">Loading project workspace...</p>
      </div>
    );
  }

  if (errorStatus) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted/10 p-4">
        <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm space-y-4">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertOctagon className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">
            {errorStatus === 404 ? "Project Not Found" : errorStatus === 403 ? "Access Denied" : "Error"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {errorMessage || "You do not have permission to access this project workspace."}
          </p>
          <div className="pt-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!project) return null;

  const tabs = [
    {
      name: "Overview",
      href: `/projects/${projectId}`,
      icon: LayoutDashboard,
      active: pathname === `/projects/${projectId}`,
    },
    {
      name: "Documents",
      href: `/projects/${projectId}/documents`,
      icon: FileText,
      active: pathname.startsWith(`/projects/${projectId}/documents`),
    },
    {
      name: "Claims",
      href: `/projects/${projectId}/claims`,
      icon: ListChecks,
      active: pathname === `/projects/${projectId}/claims`,
    },
    {
      name: "Conflicts",
      href: `/projects/${projectId}/conflicts`,
      icon: AlertTriangle,
      active: pathname.startsWith(`/projects/${projectId}/conflicts`),
    },
    {
      name: "Evidence Review",
      href: `/projects/${projectId}/review`,
      icon: CheckSquare,
      active: pathname.startsWith(`/projects/${projectId}/review`),
    },
    {
      name: "Entities",
      href: `/projects/${projectId}/entities`,
      icon: Network,
      active: pathname.startsWith(`/projects/${projectId}/entities`),
    },
    {
      name: "Members & Settings",
      href: `/projects/${projectId}/members`,
      icon: Users,
      active: pathname === `/projects/${projectId}/members`,
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-muted/10">
      {/* Top Workspace Header */}
      <header className="border-b bg-card sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="rounded-md p-1.5 hover:bg-muted text-muted-foreground transition-colors"
              title="Return to Dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span className="font-bold tracking-tight truncate max-w-xs sm:max-w-md">
                {project.name}
              </span>
            </div>
            {project.status === "ARCHIVED" && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                Archived
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:inline">Your Role:</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                project.currentUserRole === "OWNER"
                  ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-300"
                  : project.currentUserRole === "REVIEWER"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300"
                  : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300"
              }`}
            >
              {project.currentUserRole}
            </span>
          </div>
        </div>

        {/* Phase 1 Workspace Navigation Tabs */}
        <div className="container mx-auto px-4 sm:px-6 flex gap-6 border-t overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`inline-flex items-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab.active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.name}</span>
              </Link>
            );
          })}
        </div>
      </header>

      {/* Workspace Content */}
      <main className="flex-1 container mx-auto px-4 py-8 sm:px-6 max-w-6xl">{children}</main>
    </div>
  );
}
