"use client";

import * as React from "react";
import Link from "next/link";
import { formatRoleLabel, getRoleBadgeClass } from "@/lib/roles";
import {
  ChevronRight,
  Search,
  Menu,
  FolderKanban,
} from "lucide-react";

export interface TopbarProps {
  projectName?: string;
  projectId?: string;
  projectStatus?: "ACTIVE" | "ARCHIVED";
  userRole?: string;
  currentPageTitle?: string;
  onOpenSearch: () => void;
  onOpenMobileMenu?: () => void;
}

export function Topbar({
  projectName,
  projectId,
  projectStatus,
  userRole,
  currentPageTitle,
  onOpenSearch,
  onOpenMobileMenu,
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-card/80 px-4 sm:px-6 backdrop-blur-md">
      {/* Left: Mobile Toggle & Breadcrumbs */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {onOpenMobileMenu && (
          <button
            onClick={onOpenMobileMenu}
            className="md:hidden rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}

        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0 truncate">
          <Link
            href="/dashboard"
            className="flex items-center gap-1 hover:text-foreground transition-colors font-medium shrink-0"
          >
            <FolderKanban className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">Workspace</span>
          </Link>

          {projectName && projectId && (
            <>
              <ChevronRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />
              <Link
                href={`/projects/${projectId}`}
                className="hover:text-foreground transition-colors font-medium truncate max-w-[140px] sm:max-w-[200px]"
              >
                {projectName}
              </Link>
            </>
          )}

          {currentPageTitle && (
            <>
              <ChevronRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />
              <span className="font-semibold text-foreground truncate">{currentPageTitle}</span>
            </>
          )}
        </nav>

        {projectStatus === "ARCHIVED" && (
          <span className="hidden sm:inline-flex items-center px-2 py-0.2 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Archived
          </span>
        )}
      </div>

      {/* Right: Search, Role Badge, Notifications */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <button
          onClick={onOpenSearch}
          className="hidden sm:flex items-center gap-2 rounded-lg border bg-muted/40 hover:bg-muted px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          title="Search (Cmd+K)"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="text-[11px]">Quick Jump</span>
          <kbd className="rounded border bg-background px-1 text-[9px] font-mono">⌘K</kbd>
        </button>

        {userRole && (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getRoleBadgeClass(
              userRole
            )}`}
          >
            {formatRoleLabel(userRole)}
          </span>
        )}

        <div className="h-4 w-px bg-border/80 hidden sm:block" />

        <div className="flex items-center gap-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 px-2 py-0.5 text-[10px] font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline">V3.2 Engine</span>
          </span>
        </div>
      </div>
    </header>
  );
}
