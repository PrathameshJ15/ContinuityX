"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatRoleLabel } from "@/lib/roles";
import {
  ShieldCheck,
  ChevronDown,
  LayoutDashboard,
  FileText,
  ListChecks,
  AlertTriangle,
  CheckSquare,
  Award,
  Radar,
  BrainCircuit,
  Network,
  Users,
  PanelLeftClose,
  PanelLeft,
  LogOut,
  FolderKanban,
  Check,
  Search,
} from "lucide-react";

export interface ProjectOption {
  id: string;
  name: string;
  status: "ACTIVE" | "ARCHIVED";
  role?: string;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export interface SidebarProps {
  currentProject?: {
    id: string;
    name: string;
    status: "ACTIVE" | "ARCHIVED";
    currentUserRole: string;
  } | null;
  projects?: ProjectOption[];
  user?: {
    name: string;
    email: string;
  } | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenSearch: () => void;
}

export function Sidebar({
  currentProject,
  projects = [],
  user,
  collapsed,
  onToggleCollapse,
  onOpenSearch,
}: SidebarProps) {
  const pathname = usePathname();
  const [projectSwitcherOpen, setProjectSwitcherOpen] = React.useState(false);
  const switcherRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setProjectSwitcherOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const projectId = currentProject?.id;

  const navGroups: NavGroup[] = projectId
    ? [
        {
          title: "Overview",
          items: [
            {
              name: "Project Dashboard",
              href: `/projects/${projectId}`,
              icon: LayoutDashboard,
              exact: true,
            },
          ],
        },
        {
          title: "Knowledge",
          items: [
            {
              name: "Documents & Extraction",
              href: `/projects/${projectId}/documents`,
              icon: FileText,
            },
            {
              name: "Claims & Fact Graph",
              href: `/projects/${projectId}/claims`,
              icon: ListChecks,
            },
            {
              name: "Entity Registry",
              href: `/projects/${projectId}/entities`,
              icon: Network,
            },
          ],
        },
        {
          title: "Verification",
          items: [
            {
              name: "Pairwise Conflicts",
              href: `/projects/${projectId}/conflicts`,
              icon: AlertTriangle,
            },
            {
              name: "Evidence Review Queue",
              href: `/projects/${projectId}/review`,
              icon: CheckSquare,
            },
          ],
        },
        {
          title: "Continuity",
          items: [
            {
              name: "Knowledge Loss Radar",
              href: `/projects/${projectId}/radar`,
              icon: Radar,
            },
            {
              name: "Continuity Intelligence",
              href: `/projects/${projectId}/intelligence`,
              icon: BrainCircuit,
            },
          ],
        },
        {
          title: "Handover",
          items: [
            {
              name: "Handover Workspace",
              href: `/projects/${projectId}/handover`,
              icon: Award,
            },
          ],
        },
        {
          title: "Governance",
          items: [
            {
              name: "Team & Permissions",
              href: `/projects/${projectId}/members`,
              icon: Users,
            },
          ],
        },
      ]
    : [
        {
          title: "Workspace",
          items: [
            {
              name: "Workspace Overview",
              href: "/dashboard",
              icon: FolderKanban,
              exact: true,
            },
          ],
        },
      ];

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch {
      window.location.href = "/login";
    }
  }

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-card h-screen sticky top-0 z-30 transition-all duration-200 select-none",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Top Header / Project Switcher */}
      <div className="border-b px-3 py-3 relative" ref={switcherRef}>
        <div className="flex items-center justify-between gap-1.5">
          {!collapsed ? (
            <button
              onClick={() => setProjectSwitcherOpen(!projectSwitcherOpen)}
              className="flex-1 flex items-center justify-between p-1.5 rounded-xl hover:bg-muted/60 transition-colors text-left group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-foreground truncate leading-tight">
                    {currentProject ? currentProject.name : "ContinuityX Workspace"}
                  </div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <span>{currentProject ? "Active Project" : "Workspace Hub"}</span>
                    {currentProject && (
                      <span className="font-semibold text-primary uppercase">
                        · {formatRoleLabel(currentProject.currentUserRole)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground shrink-0 transition-transform" />
            </button>
          ) : (
            <button
              onClick={() => setProjectSwitcherOpen(!projectSwitcherOpen)}
              className="mx-auto h-9 w-9 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center hover:bg-primary/20 transition-colors"
              title={currentProject ? currentProject.name : "ContinuityX Workspace"}
            >
              <ShieldCheck className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={onToggleCollapse}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        {/* Project Switcher Dropdown */}
        {projectSwitcherOpen && (
          <div className="absolute top-full left-2 right-2 mt-1 z-50 rounded-xl border bg-card shadow-2xl p-1.5 text-xs animate-in fade-in zoom-in-95 duration-100 max-h-72 overflow-y-auto">
            <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Switch Project
            </div>
            <Link
              href="/dashboard"
              onClick={() => setProjectSwitcherOpen(false)}
              className={cn(
                "flex items-center justify-between p-2 rounded-lg hover:bg-muted/70 transition-colors",
                !currentProject && "bg-muted font-semibold text-primary"
              )}
            >
              <div className="flex items-center gap-2">
                <FolderKanban className="h-3.5 w-3.5 text-primary" />
                <span>Workspace Dashboard</span>
              </div>
              {!currentProject && <Check className="h-3.5 w-3.5 text-primary" />}
            </Link>

            {projects.map((proj) => (
              <Link
                key={proj.id}
                href={`/projects/${proj.id}`}
                onClick={() => setProjectSwitcherOpen(false)}
                className={cn(
                  "flex items-center justify-between p-2 rounded-lg hover:bg-muted/70 transition-colors",
                  currentProject?.id === proj.id && "bg-muted font-semibold text-primary"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{proj.name}</span>
                </div>
                {currentProject?.id === proj.id && (
                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick Search Button */}
      <div className="px-3 pt-2.5">
        <button
          onClick={onOpenSearch}
          className={cn(
            "w-full flex items-center gap-2 rounded-xl border bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors",
            collapsed && "justify-center px-0"
          )}
          title="Search (Cmd+K)"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left text-xs">Quick Search...</span>
              <kbd className="rounded border bg-background px-1.5 py-0.2 text-[10px] font-mono text-muted-foreground">
                ⌘K
              </kbd>
            </>
          )}
        </button>
      </div>

      {/* Navigation Group Items */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
        {navGroups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-0.5">
            {!collapsed && (
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                {group.title}
              </div>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium transition-all group",
                    collapsed && "justify-center px-0 py-2.5",
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold shadow-[0_1px_2px_rgba(79,70,229,0.25)]"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  )}
                  title={collapsed ? item.name : undefined}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform group-hover:scale-105",
                      isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  {!collapsed && <span className="truncate">{item.name}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer / User Profile */}
      <div className="border-t p-2.5 bg-muted/10">
        {!collapsed ? (
          <div className="flex items-center justify-between gap-2 p-1.5 rounded-xl hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs shrink-0">
                {user?.name ? user.name[0]?.toUpperCase() : "U"}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-foreground truncate">
                  {user?.name || "User"}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {user?.email || ""}
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-rose-600 transition-colors shrink-0"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-rose-600 transition-colors"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
