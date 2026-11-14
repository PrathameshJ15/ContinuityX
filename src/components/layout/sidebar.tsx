"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LogoSymbol } from "@/components/ui/logo";
import {
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
  LogOut,
  FolderKanban,
  Search,
  Check,
  ChevronDown,
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
  onCloseMobileDrawer?: () => void;
}

export function Sidebar({
  currentProject,
  projects = [],
  user,
  collapsed,
  onToggleCollapse,
  onOpenSearch,
  onCloseMobileDrawer,
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
          title: "OVERVIEW",
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
          title: "KNOWLEDGE",
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
          title: "VERIFICATION",
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
          title: "CONTINUITY",
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
          title: "HANDOVER",
          items: [
            {
              name: "Handover Workspace",
              href: `/projects/${projectId}/handover`,
              icon: Award,
            },
          ],
        },
        {
          title: "GOVERNANCE",
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
          title: "WORKSPACE",
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

  function isItemActive(item: NavItem) {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  }

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-line bg-card h-screen sticky top-0 z-30 transition-all duration-200 select-none",
        collapsed ? "w-16" : "w-[268px]"
      )}
    >
      {/* Workspace Tile Header */}
      <div className="border-b border-line p-3 relative" ref={switcherRef}>
        {!collapsed ? (
          <div className="flex items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={() => setProjectSwitcherOpen(!projectSwitcherOpen)}
              className="flex-1 flex items-center gap-2.5 p-1 rounded-lg hover:bg-bg transition-colors text-left group min-w-0"
            >
              <div className="h-[34px] w-[34px] rounded-lg bg-tint flex items-center justify-center shrink-0 overflow-hidden border border-line/40">
                <LogoSymbol size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-heading font-bold text-ink truncate leading-tight">
                  {currentProject ? currentProject.name : "ContinuityX Workspace"}
                </div>
                <div className="text-[12px] text-faint flex items-center gap-1 mt-0.5">
                  <span className="truncate">
                    {currentProject
                      ? `Active Project · ${currentProject.currentUserRole}`
                      : "Workspace Hub"}
                  </span>
                </div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-faint group-hover:text-ink shrink-0 transition-transform duration-150" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="h-[34px] w-[34px] mx-auto rounded-lg bg-tint flex items-center justify-center border border-line/40 hover:opacity-80"
            title="Expand sidebar"
          >
            <LogoSymbol size={22} />
          </button>
        )}

        {/* Project Switcher Dropdown */}
        {projectSwitcherOpen && !collapsed && (
          <div className="absolute left-2 right-2 top-[58px] z-50 rounded-xl border border-line bg-card shadow-modal py-1.5 max-h-72 overflow-y-auto">
            <div className="px-3 py-1.5 text-[11px] font-heading font-semibold uppercase tracking-wider text-faint">
              Switch Project
            </div>
            <Link
              href="/dashboard"
              onClick={() => {
                setProjectSwitcherOpen(false);
                onCloseMobileDrawer?.();
              }}
              className="flex items-center gap-2 px-3 py-2 text-[13.5px] hover:bg-bg transition-colors text-ink"
            >
              <FolderKanban className="h-4 w-4 text-muted" />
              <span>Workspace Overview</span>
            </Link>
            <div className="my-1 border-t border-line" />
            {projects.length === 0 ? (
              <div className="px-3 py-2 text-[12px] text-faint">No projects found</div>
            ) : (
              projects.map((p) => {
                const isSelected = p.id === projectId;
                return (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    onClick={() => {
                      setProjectSwitcherOpen(false);
                      onCloseMobileDrawer?.();
                    }}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 text-[13.5px] hover:bg-bg transition-colors",
                      isSelected ? "text-brand font-semibold bg-tint/50" : "text-ink"
                    )}
                  >
                    <div className="truncate mr-2">
                      <div className="truncate">{p.name}</div>
                      <div className="text-[11px] text-faint">
                        {p.role || "Member"}
                      </div>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-brand shrink-0" />}
                  </Link>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Quick Search Ctrl K */}
      {!collapsed && (
        <div className="px-3 pt-3 pb-1">
          <button
            type="button"
            onClick={onOpenSearch}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg border border-line bg-bg text-[13px] text-faint hover:text-ink hover:border-muted transition-colors"
          >
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5" />
              <span>Quick search...</span>
            </div>
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-card border border-line text-faint">
              Ctrl K
            </kbd>
          </button>
        </div>
      )}

      {/* Nav List */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        {navGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            {!collapsed && (
              <div className="px-2.5 pb-1 text-[11px] font-heading font-semibold uppercase tracking-wider text-faint select-none">
                {group.title}
              </div>
            )}
            {group.items.map((item) => {
              const active = isItemActive(item);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => onCloseMobileDrawer?.()}
                  title={collapsed ? item.name : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg transition-colors duration-150 select-none text-[14.5px]",
                    collapsed
                      ? "justify-center h-10 w-10 mx-auto"
                      : "px-3 py-2.5 min-h-[44px]",
                    active
                      ? "bg-brand text-white font-semibold shadow-sm"
                      : "text-muted hover:text-ink hover:bg-bg"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-[15px] w-[15px] shrink-0",
                      active ? "text-white" : "text-muted group-hover:text-ink"
                    )}
                  />
                  {!collapsed && <span className="truncate">{item.name}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User Block Pinned to Bottom */}
      <div className="border-t border-line p-3">
        {!collapsed ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-full bg-tint text-brand font-heading font-bold text-xs flex items-center justify-center shrink-0 border border-line">
                {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-heading font-semibold text-ink truncate leading-tight">
                  {user?.name || "Continuity User"}
                </div>
                <div className="text-[11.5px] text-faint truncate leading-tight mt-0.5">
                  {user?.email || "user@continuityx.demo"}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-lg text-faint hover:text-bad hover:bg-bad-tint/50 transition-colors"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleLogout}
            className="h-10 w-10 mx-auto rounded-lg flex items-center justify-center text-faint hover:text-bad hover:bg-bad-tint/50"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
