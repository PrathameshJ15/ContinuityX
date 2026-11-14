"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, Command, ChevronRight } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LogoSymbol } from "@/components/ui/logo";

export interface TopbarProps {
  projectName?: string;
  projectId?: string;
  projectStatus?: "ACTIVE" | "ARCHIVED";
  userRole?: string;
  currentPageTitle?: string;
  onOpenSearch: () => void;
  onOpenMobileMenu: () => void;
}

export function Topbar({
  projectName,
  projectId,
  currentPageTitle,
  onOpenSearch,
  onOpenMobileMenu,
}: TopbarProps) {
  return (
    <header className="h-14 border-b border-line bg-card px-3 sm:px-6 flex items-center justify-between sticky top-0 z-20 select-none">
      {/* Left: Mobile Menu + Mobile Logo + Breadcrumbs */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-lg border border-line text-muted hover:text-ink hover:bg-bg transition-colors shrink-0"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Mobile Logo Mark */}
        <Link href="/dashboard" className="lg:hidden flex items-center shrink-0">
          <div className="h-8 w-8 rounded-lg bg-tint flex items-center justify-center border border-line/40">
            <LogoSymbol size={20} />
          </div>
        </Link>

        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] sm:text-[13.5px] truncate">
          <Link
            href="/dashboard"
            className="text-faint hover:text-ink transition-colors font-medium shrink-0 hidden sm:inline"
          >
            Workspace
          </Link>

          {projectName && projectId && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-faint shrink-0 hidden sm:inline" />
              <Link
                href={`/projects/${projectId}`}
                className="text-faint hover:text-ink transition-colors font-medium truncate max-w-[120px] sm:max-w-[200px]"
              >
                {projectName}
              </Link>
            </>
          )}

          {currentPageTitle && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-faint shrink-0" />
              <span className="font-heading font-semibold text-ink truncate max-w-[140px] sm:max-w-none">
                {currentPageTitle}
              </span>
            </>
          )}
        </nav>
      </div>

      {/* Right: Quick Jump + v3.2 Engine Chip + Theme Toggle */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        <button
          type="button"
          onClick={onOpenSearch}
          className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-bg text-[13px] font-heading font-medium text-muted hover:text-ink hover:border-muted transition-colors min-h-[36px]"
        >
          <Command className="h-3.5 w-3.5 text-faint" />
          <span>Quick jump</span>
        </button>

        <div className="hidden sm:inline-flex">
          <Chip variant="ok" dot size="sm">
            v3.2 engine
          </Chip>
        </div>

        <div className="min-h-[44px] min-w-[44px] flex items-center justify-center">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
