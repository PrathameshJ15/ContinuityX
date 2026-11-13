"use client";

import React, { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import { formatDateTime } from "@/lib/date";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { Badge } from "@/components/ui/badge";
import { FilterPills } from "@/components/ui/filter-pills";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import {
  ShieldCheck,
  Search,
  RotateCw,
  FileText,
  AlertCircle,
  GitCommit,
  Lock,
  Activity,
} from "lucide-react";

interface AuditLogItem {
  id: string;
  projectId: string | null;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export default function AuditLogsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);

  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [actionFilter, setActionFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const qs = new URLSearchParams();
      if (actionFilter !== "ALL") qs.set("action", actionFilter);
      if (searchQuery) qs.set("search", searchQuery);

      const res = await fetch(`/api/projects/${projectId}/audit?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to load audit logs");

      setLogs(json.data.auditLogs || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load audit trail");
    } finally {
      setLoading(false);
    }
  }, [projectId, actionFilter, searchQuery]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handoverCount = logs.filter((l) => l.action.includes("HANDOVER")).length;
  const conflictCount = logs.filter((l) => l.action.includes("CONFLICT")).length;
  const claimCount = logs.filter((l) => l.action.includes("CLAIM") || l.action.includes("REVIEW")).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        breadcrumbs={
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link href="/dashboard" className="hover:text-foreground">Projects</Link>
            <span>/</span>
            <Link href={`/projects/${projectId}`} className="hover:text-foreground">Project</Link>
            <span>/</span>
            <span className="text-foreground font-medium">Audit Logs</span>
          </div>
        }
        title="Audit Trail & Governance Logs"
        badge={
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            Append-Only
          </span>
        }
        description="Immutable, tamper-evident security timeline recording all claim reviews, conflict resolutions, and cryptographic handover mints."
        actions={
          <button
            onClick={loadLogs}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Trail
          </button>
        }
      />

      {/* Notifications */}
      {error && (
        <div role="alert" className="flex items-center justify-between gap-2 rounded-lg border border-rose-500/20 bg-rose-50/50 p-4 text-xs font-medium text-rose-800 dark:bg-rose-950/20 dark:text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Events Logged"
          value={logs.length}
          subtitle="Recent governance events"
          icon={Activity}
        />
        <MetricCard
          title="Handover Approvals"
          value={handoverCount}
          subtitle="Sealed version checkpoints"
          variant={handoverCount > 0 ? "success" : "default"}
          icon={Lock}
        />
        <MetricCard
          title="Conflict Resolutions"
          value={conflictCount}
          subtitle="Contradictions reconciled"
          icon={GitCommit}
        />
        <MetricCard
          title="Claim & Review Actions"
          value={claimCount}
          subtitle="Evidence validations"
          icon={FileText}
        />
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <FilterPills
          options={[
            { id: "ALL", label: "All Events" },
            { id: "HANDOVER_APPROVED", label: "Handover Seals" },
            { id: "CONFLICT_RESOLVED", label: "Resolutions" },
            { id: "CLAIM_REVIEWED", label: "Reviews" },
            { id: "DOCUMENT_UPLOADED", label: "Uploads" },
          ]}
          selectedId={actionFilter}
          onSelect={setActionFilter}
        />

        <div className="relative min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search action or entity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
          />
        </div>
      </div>

      {/* Timeline / Table */}
      {loading ? (
        <TableSkeleton rows={6} />
      ) : logs.length === 0 ? (
        <EmptyState
          type="checked-empty"
          title="No audit events found"
          description="Actions taken across documents, claims, conflicts, and handovers are logged here immutably."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-slate-50/75 dark:bg-slate-900/50 text-[11px] font-semibold text-muted-foreground">
                  <th className="py-3 px-4 font-semibold">Timestamp (UTC)</th>
                  <th className="py-3 px-3 font-semibold">User / Actor</th>
                  <th className="py-3 px-3 font-semibold">Action</th>
                  <th className="py-3 px-3 font-semibold">Target Resource</th>
                  <th className="py-3 px-4 font-semibold text-right">Event Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {logs.map((log) => {
                  const isHandover = log.action.includes("HANDOVER");
                  const isConflict = log.action.includes("CONFLICT");
                  const isReview = log.action.includes("REVIEW");

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/25 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 text-muted-foreground flex items-center justify-center shrink-0 text-[10px] font-semibold">
                            {log.user ? log.user.name.slice(0, 1).toUpperCase() : "S"}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground text-xs">{log.user?.name || "System Actor"}</p>
                            <p className="text-[10px] text-muted-foreground">{log.user?.email || "internal daemon"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <Badge
                          variant={
                            isHandover ? "verified" : isConflict ? "warning" : isReview ? "weak" : "neutral"
                          }
                        >
                          {log.action}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="space-y-0.5">
                          <span className="font-semibold text-foreground">{log.entityType}</span>
                          <span className="block font-mono text-[10px] text-muted-foreground">
                            {log.entityId}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {log.metadata && Object.keys(log.metadata).length > 0 ? (
                          <pre className="inline-block text-[10px] font-mono bg-slate-50 dark:bg-slate-900/60 p-1.5 rounded border border-border text-left max-w-xs truncate">
                            {JSON.stringify(log.metadata)}
                          </pre>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
