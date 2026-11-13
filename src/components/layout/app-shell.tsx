"use client";

import * as React from "react";
import { Sidebar, ProjectOption } from "./sidebar";
import { Topbar } from "./topbar";
import { SearchModal } from "./search-modal";

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
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:block shrink-0">
        <Sidebar
          currentProject={currentProject}
          projects={projects}
          user={user}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(!collapsed)}
          onOpenSearch={() => setSearchOpen(true)}
        />
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-72 bg-card h-full shadow-2xl flex flex-col">
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
            />
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
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

        <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <div className={fullWidth ? "w-full" : "max-w-7xl mx-auto space-y-6"}>
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
