"use client";

import React, { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/date";
import { getRadarEmptyState } from "@/lib/empty-states";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { FilterPills } from "@/components/ui/filter-pills";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  Radar,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  Undo2,
  X,
  FileText,
} from "lucide-react";

interface RadarAlert {
  id: string;
  ruleId: "R1" | "R2" | "R3" | "R4" | "R5" | "R6";
  category: string;
  title: string;
  explanation: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  affectedEntity?: {
    id: string;
    canonicalName: string;
    type: string;
  };
  affectedClaims: Array<{
    id: string;
    attributeKey: string;
    valueRaw: string;
    valueNormalized: string | null;
    evidenceStatus: string;
    reviewState: string;
  }>;
  evidenceLinks: Array<{
    documentId: string;
    fileName: string;
    location: string;
    excerpt: string;
  }>;
  missingFieldStatement?: string;
  suggestedRemediation: string;
  status: "OPEN" | "DISMISSED";
  dismissedReason?: string;
  dismissedAt?: string;
  dismissedBy?: { id: string; name: string };
}

interface RadarMetrics {
  totalOpen: number;
  totalDismissed: number;
  totalClaims?: number;
  bySeverity: {
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
  byRule: Record<string, number>;
}

export default function RadarPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);

  const [alerts, setAlerts] = useState<RadarAlert[]>([]);
  const [metrics, setMetrics] = useState<RadarMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [ruleFilter, setRuleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "DISMISSED">("OPEN");

  // Dismiss modal state
  const [dismissingAlert, setDismissingAlert] = useState<RadarAlert | null>(null);
  const [dismissReason, setDismissReason] = useState("");
  const [submittingDismiss, setSubmittingDismiss] = useState(false);

  const loadRadar = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const qs = new URLSearchParams();
      if (ruleFilter !== "ALL") qs.set("ruleId", ruleFilter);
      qs.set("status", statusFilter);

      const res = await fetch(`/api/projects/${projectId}/radar?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to load Radar alerts");

      setAlerts(json.data.alerts || []);
      setMetrics(json.data.metrics || null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load Radar alerts");
    } finally {
      setLoading(false);
    }
  }, [projectId, ruleFilter, statusFilter]);

  useEffect(() => {
    loadRadar();
  }, [loadRadar]);

  const handleDismissSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dismissingAlert) return;
    if (!dismissReason.trim()) {
      setError("A written justification reason is mandatory to dismiss an alert.");
      return;
    }

    try {
      setSubmittingDismiss(true);
      setError(null);

      const res = await fetch(`/api/projects/${projectId}/radar/dismiss`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alertKey: dismissingAlert.id,
          ruleId: dismissingAlert.ruleId,
          reason: dismissReason.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to dismiss alert");

      setSuccess(`Alert '${dismissingAlert.title}' dismissed with recorded audit justification.`);
      setDismissingAlert(null);
      setDismissReason("");

      await loadRadar();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to dismiss alert");
    } finally {
      setSubmittingDismiss(false);
    }
  };

  const handleReactivate = async (alert: RadarAlert) => {
    try {
      setError(null);
      const res = await fetch(`/api/projects/${projectId}/radar/reactivate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertKey: alert.id }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to reactivate alert");

      setSuccess(`Alert '${alert.title}' reactivated.`);
      await loadRadar();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reactivate alert");
    }
  };

  const renderSeverityBadge = (severity: "HIGH" | "MEDIUM" | "LOW") => {
    switch (severity) {
      case "HIGH":
        return <Badge variant="critical">HIGH RISK</Badge>;
      case "MEDIUM":
        return <Badge variant="warning">MEDIUM RISK</Badge>;
      case "LOW":
        return <Badge variant="neutral">LOW RISK</Badge>;
    }
  };

  const renderEvidenceStatusBadge = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return <Badge variant="verified">VERIFIED</Badge>;
      case "WEAK_SUPPORT":
        return <Badge variant="weak">WEAK SUPPORT</Badge>;
      case "CONFLICTING":
        return <Badge variant="contradicted">CONFLICTING</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const emptyInfo = getRadarEmptyState(
    metrics?.totalClaims ?? 0,
    alerts.length,
    ruleFilter
  );

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
            <span className="text-foreground font-medium">Knowledge Radar</span>
          </div>
        }
        title="Knowledge Loss Radar"
        badge={
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            <Radar className="h-3.5 w-3.5" />
            Rule-Based Intelligence
          </span>
        }
        description="Deterministic, explainable indicators highlighting single points of failure, missing rationale, and unassigned work."
        actions={
          <button
            onClick={() => loadRadar()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Radar
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
          <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {success && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/20 bg-emerald-50/50 p-4 text-xs font-medium text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Metrics KPI Cards */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <MetricCard
            title="Active Alerts"
            value={metrics.totalOpen}
            subtitle="Open risk signals"
            icon={Radar}
          />
          <MetricCard
            title="High Risk (R1/R2/R6)"
            value={metrics.bySeverity.HIGH}
            subtitle="SPOF & undocumented"
            variant={metrics.bySeverity.HIGH > 0 ? "danger" : "default"}
            icon={ShieldAlert}
          />
          <MetricCard
            title="Medium (R3/R4)"
            value={metrics.bySeverity.MEDIUM}
            subtitle="Unassigned & no rationale"
            variant={metrics.bySeverity.MEDIUM > 0 ? "warning" : "default"}
            icon={AlertTriangle}
          />
          <MetricCard
            title="Low (R5 Questions)"
            value={metrics.bySeverity.LOW}
            subtitle="Open architectural questions"
            icon={Info}
          />
          <MetricCard
            title="Dismissed"
            value={metrics.totalDismissed}
            subtitle="Recorded justifications"
            icon={ShieldCheck}
          />
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <FilterPills
            options={[
              { id: "ALL", label: "All Rules" },
              { id: "R1", label: "R1: Bus Factor", count: metrics?.byRule?.R1 },
              { id: "R2", label: "R2: Missing Docs", count: metrics?.byRule?.R2 },
              { id: "R3", label: "R3: Unassigned Tasks", count: metrics?.byRule?.R3 },
              { id: "R4", label: "R4: Missing Rationale", count: metrics?.byRule?.R4 },
              { id: "R5", label: "R5: Open Questions", count: metrics?.byRule?.R5 },
              { id: "R6", label: "R6: Inconsistencies", count: metrics?.byRule?.R6 },
            ]}
            selectedId={ruleFilter}
            onSelect={setRuleFilter}
          />

          <div className="flex items-center gap-1.5 self-start lg:self-auto">
            <FilterPills
              options={[
                { id: "OPEN", label: "Open", count: metrics?.totalOpen },
                { id: "DISMISSED", label: "Dismissed", count: metrics?.totalDismissed },
                { id: "ALL", label: "All Statuses", count: (metrics?.totalOpen ?? 0) + (metrics?.totalDismissed ?? 0) },
              ]}
              selectedId={statusFilter}
              onSelect={(s) => setStatusFilter(s as "ALL" | "OPEN" | "DISMISSED")}
              size="sm"
            />
          </div>
        </div>
      </div>

      {/* Alerts Content */}
      {loading ? (
        <TableSkeleton rows={4} />
      ) : emptyInfo.state === "NO_DATA" ? (
        <EmptyState
          type="no-data"
          title={emptyInfo.title}
          description={emptyInfo.description}
          actionHref={`/projects/${projectId}/documents`}
          actionLabel={emptyInfo.linkLabel || "Go to Documents"}
        />
      ) : emptyInfo.state === "CHECKED_EMPTY" || alerts.length === 0 ? (
        <EmptyState
          type="checked-empty"
          title={emptyInfo.title || "Zero Active Knowledge Loss Indicators"}
          description={
            emptyInfo.description ||
            (ruleFilter !== "ALL"
              ? `No alerts detected matching Rule ${ruleFilter}.`
              : "All critical components have verified redundancy, documented rationale, and assigned owners.")
          }
        />
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-xl border border-border bg-card shadow-xs overflow-hidden p-5 space-y-4 transition-all ${
                alert.status === "DISMISSED" ? "opacity-75 bg-slate-50/50 dark:bg-slate-900/30" : ""
              }`}
            >
              {/* Alert Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-border/80 pb-3">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {renderSeverityBadge(alert.severity)}
                    <span className="rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-mono font-bold">
                      Rule {alert.ruleId}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {alert.category.replace(/_/g, " ")}
                    </span>
                    {alert.affectedEntity && (
                      <span className="text-xs font-semibold text-foreground">
                        • {alert.affectedEntity.canonicalName} ({alert.affectedEntity.type})
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-foreground">{alert.title}</h3>
                </div>

                {/* Dismiss / Reactivate Actions */}
                <div className="shrink-0">
                  {alert.status === "OPEN" ? (
                    <button
                      onClick={() => setDismissingAlert(alert)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer shadow-xs"
                    >
                      Dismiss Alert
                    </button>
                  ) : (
                    <button
                      onClick={() => handleReactivate(alert)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                    >
                      <Undo2 className="h-3 w-3" />
                      Reactivate Alert
                    </button>
                  )}
                </div>
              </div>

              {/* Diagnostic Finding */}
              <div className="text-xs text-foreground bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-lg border border-border leading-relaxed">
                <strong className="text-foreground">Diagnostic Finding: </strong>
                {alert.explanation}
              </div>

              {/* Dismissed Banner */}
              {alert.status === "DISMISSED" && alert.dismissedReason && (
                <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-3 text-xs space-y-1 border border-border">
                  <div className="font-semibold text-foreground">
                    Dismissed by {alert.dismissedBy?.name || "Reviewer"} on{" "}
                    {alert.dismissedAt ? formatDate(alert.dismissedAt) : ""}:
                  </div>
                  <p className="text-muted-foreground italic">&ldquo;{alert.dismissedReason}&rdquo;</p>
                </div>
              )}

              {/* Affected Claims */}
              {alert.affectedClaims.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Associated Project Claims ({alert.affectedClaims.length})
                  </div>
                  <div className="space-y-1.5">
                    {alert.affectedClaims.map((claim) => (
                      <div
                        key={claim.id}
                        className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg border border-border bg-card text-xs shadow-xs"
                      >
                        <div className="flex items-center gap-2">
                          <code className="font-mono font-semibold text-foreground">
                            {claim.attributeKey}:
                          </code>
                          <span className="text-foreground">{claim.valueRaw}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {renderEvidenceStatusBadge(claim.evidenceStatus)}
                          <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] text-muted-foreground font-medium">
                            {claim.reviewState}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing Field Statement OR Supporting Evidence */}
              {alert.missingFieldStatement ? (
                <div className="rounded-lg border border-dashed border-amber-300 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-xs text-amber-900 dark:text-amber-200">
                  <strong className="text-amber-900 dark:text-amber-100">Missing Knowledge Artifact: </strong>
                  {alert.missingFieldStatement}
                </div>
              ) : alert.evidenceLinks.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Source Document Citations
                  </div>
                  {alert.evidenceLinks.slice(0, 2).map((ev, i) => (
                    <div key={i} className="rounded-lg border border-border/80 bg-slate-50/50 dark:bg-slate-900/20 p-2.5 text-xs space-y-0.5">
                      <div className="text-[11px] font-medium text-foreground flex items-center gap-1">
                        <FileText className="h-3 w-3 text-primary" />
                        {ev.fileName} ({ev.location})
                      </div>
                      <blockquote className="border-l-2 border-primary/40 pl-2 text-muted-foreground italic py-0.5">
                        &ldquo;{ev.excerpt}&rdquo;
                      </blockquote>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Suggested Remediation */}
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs text-foreground space-y-1">
                <div className="font-semibold text-primary flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Suggested Remediation:
                </div>
                <p className="text-muted-foreground leading-relaxed">{alert.suggestedRemediation}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dismiss Alert Modal */}
      {dismissingAlert && (
        <Modal
          isOpen={!!dismissingAlert}
          onClose={() => setDismissingAlert(null)}
          title="Dismiss Radar Alert"
          description={`Dismissing alert "${dismissingAlert.title}" requires an explicit recorded reason in the audit log.`}
        >
          <form onSubmit={handleDismissSubmit} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">
                Justification Reason (Mandatory)
              </label>
              <textarea
                rows={3}
                placeholder="e.g., Co-ownership is documented in onboarding wiki; risk acknowledged by lead architect."
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value)}
                className="w-full rounded-lg border border-border bg-card p-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                required
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setDismissingAlert(null)}
                className="rounded-lg border border-border px-3.5 py-1.5 font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingDismiss || !dismissReason.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 font-semibold text-white shadow-xs hover:bg-primary/90 transition-colors disabled:opacity-40 cursor-pointer"
              >
                {submittingDismiss && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm Dismissal
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
