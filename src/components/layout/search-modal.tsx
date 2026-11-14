"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Search,
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
  FolderKanban,
} from "lucide-react";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProjectId?: string;
  projects?: Array<{ id: string; name: string }>;
}

export function SearchModal({
  isOpen,
  onClose,
  currentProjectId,
  projects = [],
}: SearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentProjectNav = currentProjectId
    ? [
        { label: "Project Dashboard", href: `/projects/${currentProjectId}`, icon: LayoutDashboard, category: "Overview" },
        { label: "Documents & Extraction", href: `/projects/${currentProjectId}/documents`, icon: FileText, category: "Knowledge" },
        { label: "Claims & Fact Graph", href: `/projects/${currentProjectId}/claims`, icon: ListChecks, category: "Knowledge" },
        { label: "Entity Registry", href: `/projects/${currentProjectId}/entities`, icon: Network, category: "Knowledge" },
        { label: "Pairwise Conflicts", href: `/projects/${currentProjectId}/conflicts`, icon: AlertTriangle, category: "Verification" },
        { label: "Evidence Review Queue", href: `/projects/${currentProjectId}/review`, icon: CheckSquare, category: "Verification" },
        { label: "Knowledge Loss Radar", href: `/projects/${currentProjectId}/radar`, icon: Radar, category: "Continuity" },
        { label: "Continuity Intelligence", href: `/projects/${currentProjectId}/intelligence`, icon: BrainCircuit, category: "Continuity" },
        { label: "Handover Workspace", href: `/projects/${currentProjectId}/handover`, icon: Award, category: "Handover" },
        { label: "Team & Permissions", href: `/projects/${currentProjectId}/members`, icon: Users, category: "Governance" },
      ]
    : [];

  const workspaceNav = [
    { label: "Workspace Overview", href: "/dashboard", icon: FolderKanban, category: "Workspace" },
    ...projects.map((p) => ({
      label: p.name,
      href: `/projects/${p.id}`,
      icon: LayoutDashboard,
      category: "Projects",
    })),
  ];

  const allItems = [...currentProjectNav, ...workspaceNav];
  const filtered = query.trim()
    ? allItems.filter(
        (item) =>
          item.label.toLowerCase().includes(query.toLowerCase()) ||
          item.category.toLowerCase().includes(query.toLowerCase())
      )
    : allItems;

  function navigate(href: string) {
    onClose();
    router.push(href);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-ink/40 backdrop-blur-sm animate-in fade-in duration-100">
      <div className="w-full max-w-xl rounded-xl border border-line bg-card shadow-modal overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3 bg-bg">
          <Search className="h-4 w-4 text-faint shrink-0" />
          <input
            type="text"
            placeholder="Search pages, modules, or projects..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="flex-1 bg-transparent text-[14.5px] focus:outline-none placeholder:text-faint text-ink"
          />
          <kbd className="rounded border border-line bg-card px-1.5 py-0.5 text-[10px] font-mono text-faint">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-line/60 text-[13.5px]">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-faint">
              No matching pages or modules found.
            </div>
          ) : (
            filtered.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => navigate(item.href)}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-bg transition-colors text-left group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-7 w-7 rounded-md bg-tint border border-line/40 flex items-center justify-center text-brand shrink-0">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="truncate">
                      <span className="font-heading font-semibold text-ink">{item.label}</span>
                      <span className="text-[11px] text-faint ml-2 font-mono uppercase tracking-wider">
                        {item.category}
                      </span>
                    </div>
                  </div>
                  <span className="text-[12px] text-faint group-hover:text-brand transition-colors shrink-0">
                    Jump →
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
