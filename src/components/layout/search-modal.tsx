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
  ShieldCheck,
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
        { label: "Project Overview", href: `/projects/${currentProjectId}`, icon: LayoutDashboard, category: "Project Modules" },
        { label: "Documents & Evidence Extraction", href: `/projects/${currentProjectId}/documents`, icon: FileText, category: "Knowledge" },
        { label: "Claims & Fact Graph", href: `/projects/${currentProjectId}/claims`, icon: ListChecks, category: "Knowledge" },
        { label: "Entity Registry & Aliases", href: `/projects/${currentProjectId}/entities`, icon: Network, category: "Knowledge" },
        { label: "Pairwise Conflicts & Contradictions", href: `/projects/${currentProjectId}/conflicts`, icon: AlertTriangle, category: "Verification" },
        { label: "Human Evidence Review Queue", href: `/projects/${currentProjectId}/review`, icon: CheckSquare, category: "Verification" },
        { label: "Knowledge Loss Radar", href: `/projects/${currentProjectId}/radar`, icon: Radar, category: "Continuity" },
        { label: "Continuity Intelligence & Bus Factor", href: `/projects/${currentProjectId}/intelligence`, icon: BrainCircuit, category: "Continuity" },
        { label: "Proof-Carrying Handover & SHA-256 Receipt", href: `/projects/${currentProjectId}/handover`, icon: Award, category: "Handover" },
        { label: "Team Members & Permissions", href: `/projects/${currentProjectId}/members`, icon: Users, category: "Governance" },
      ]
    : [];

  const workspaceNav = [
    { label: "Workspace Dashboard", href: "/dashboard", icon: ShieldCheck, category: "Workspace" },
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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-100">
      <div className="w-full max-w-xl rounded-2xl border bg-card shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 border-b px-4 py-3 bg-muted/20">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Type a command, page, or search query..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground text-foreground"
          />
          <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-border/40 text-xs">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No matching pages or modules found.
            </div>
          ) : (
            filtered.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={index}
                  onClick={() => navigate(item.href)}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/60 transition-colors text-left group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-md bg-muted/50 border flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:border-primary/30 transition-colors">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">{item.label}</span>
                      <span className="text-[11px] text-muted-foreground ml-2 font-mono">
                        {item.category}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground group-hover:text-primary transition-colors">
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
