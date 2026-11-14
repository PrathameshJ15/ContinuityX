"use client";

import * as React from "react";
import { Sidebar, ProjectOption } from "./sidebar";
import { Topbar } from "./topbar";
import { SearchModal } from "./search-modal";
import { LogoSymbol } from "@/components/ui/logo";

export interface AppShellProps {
  children: React.ReactNode;
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
  currentPageTitle?: string;
  fullWidth?: boolean;
}

export function AppShell({
  children,
  currentProject,
  projects = [],
  user,
  currentPageTitle,
  fullWidth = false,
}: AppShellProps) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen bg-bg text-ink">
      {/* Desktop Sidebar (visible at >= 1020px) */}
      <div className="hidden lg:block shrink-0">
        <Sidebar
          currentProject={currentProject}
          projects={projects}
          user={user}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(!collapsed)}
          onOpenSearch={() => setSearchOpen(true)}
        />
      </div>

      {/* Mobile Drawer (visible at < 1020px) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden bg-ink/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-[280px] max-w-[85vw] bg-card h-full shadow-modal flex flex-col animate-in slide-in-from-left duration-200">
            {/* Mobile Drawer Header */}
            <div className="flex items-center justify-between p-3.5 border-b border-line bg-card">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-tint flex items-center justify-center border border-line/40 shrink-0">
                  <LogoSymbol size={20} />
                </div>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-heading font-bold text-ink truncate leading-tight">
                    {currentProject ? currentProject.name : "ContinuityX"}
                  </div>
                  <div className="text-[11px] text-faint truncate leading-tight mt-0.5">
                    {currentProject ? `Role: ${currentProject.currentUserRole}` : "Workspace Hub"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-bg transition-colors"
                aria-label="Close navigation drawer"
              >
                <span className="text-xl font-bold leading-none">✕</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <Sidebar
                currentProject={currentProject}
                projects={projects}
                user={user}
                collapsed={false}
                onToggleCollapse={() => setMobileMenuOpen(false)}
                onOpenSearch={() => {
                  setMobileMenuOpen(false);
                  setSearchOpen(true);
                }}
                onCloseMobileDrawer={() => setMobileMenuOpen(false)}
              />
            </div>
          </div>
          <div
            className="flex-1"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation"
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          projectName={currentProject?.name}
          projectId={currentProject?.id}
          projectStatus={currentProject?.status}
          userRole={currentProject?.currentUserRole}
          currentPageTitle={currentPageTitle}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <main className="flex-1 overflow-x-hidden p-3.5 sm:p-6 lg:p-8">
          <div className={fullWidth ? "w-full" : "max-w-[1240px] mx-auto space-y-6"}>
            {children}
          </div>
        </main>
      </div>

      {/* Global Search / Command Palette */}
      <SearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        currentProjectId={currentProject?.id}
        projects={projects}
      />
    </div>
  );
}
