"use client";

import React, { useState, useEffect, use, useCallback } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Info,
  Loader2,
  Radar,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  Undo2,
  X,
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
      if (statusFilter !== "ALL") qs.set("status", statusFilter);

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
        return (
          <span className="inline-flex items-center gap-1 rounded bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 px-2 py-0.5 text-xs font-semibold">
            <ShieldAlert className="h-3 w-3 text-rose-600" />
            HIGH RISK
          </span>
        );
      case "MEDIUM":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 px-2 py-0.5 text-xs font-semibold">
            <AlertTriangle className="h-3 w-3 text-amber-600" />
            MEDIUM
          </span>
        );
      case "LOW":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 px-2 py-0.5 text-xs font-semibold">
            <Info className="h-3 w-3 text-blue-600" />
            LOW
          </span>
        );
    }
  };

  const renderEvidenceStatusBadge = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return (
          <span className="rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 px-1.5 py-0.5 text-[10px] font-semibold">
            VERIFIED
          </span>
        );
      case "WEAK_SUPPORT":
        return (
          <span className="rounded bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 px-1.5 py-0.5 text-[10px] font-semibold">
            WEAK_SUPPORT
          </span>
        );
      case "CONFLICTING":
        return (
          <span className="rounded bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 px-1.5 py-0.5 text-[10px] font-semibold">
            CONFLICTING
          </span>
        );
      default:
        return (
          <span className="rounded bg-muted text-muted-foreground px-1.5 py-0.5 text-[10px] font-semibold">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Knowledge Loss Radar
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              <Radar className="h-3.5 w-3.5" />
              Rule-Based Risk Intelligence
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Deterministic, explainable indicators highlighting single points of failure, missing rationale, and unassigned work.
          </p>
        </div>

        <button
          onClick={() => loadRadar()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted shadow-sm transition-colors self-start sm:self-auto"
        >
          <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Radar
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Metrics KPI Cards */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="rounded-xl border bg-card p-3 shadow-sm">
            <div className="text-[11px] font-medium text-muted-foreground">Active Alerts</div>
            <div className="text-xl font-bold text-foreground mt-1">{metrics.totalOpen}</div>
          </div>
          <div className="rounded-xl border bg-card p-3 shadow-sm">
            <div className="text-[11px] font-medium text-rose-600 dark:text-rose-400">High Risk (R1/R2/R6)</div>
            <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">
              {metrics.bySeverity.HIGH}
            </div>
          </div>
          <div className="rounded-xl border bg-card p-3 shadow-sm">
            <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400">Medium (R3/R4)</div>
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {metrics.bySeverity.MEDIUM}
            </div>
          </div>
          <div className="rounded-xl border bg-card p-3 shadow-sm">
            <div className="text-[11px] font-medium text-blue-600 dark:text-blue-400">Low (R5 Questions)</div>
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">
              {metrics.bySeverity.LOW}
            </div>
          </div>
          <div className="rounded-xl border bg-card p-3 shadow-sm col-span-2 sm:col-span-1">
            <div className="text-[11px] font-medium text-muted-foreground">Dismissed</div>
            <div className="text-xl font-bold text-muted-foreground mt-1">{metrics.totalDismissed}</div>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-sm text-xs">
        {/* Rule Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-foreground flex items-center gap-1 mr-1">
            <Filter className="h-3 w-3" /> Rule:
          </span>
          {[
            { id: "ALL", label: "All Rules" },
            { id: "R1", label: "R1: Bus Factor" },
            { id: "R2", label: "R2: Missing Docs" },
            { id: "R3", label: "R3: Unassigned Tasks" },
            { id: "R4", label: "R4: Missing Rationale" },
            { id: "R5", label: "R5: Open Questions" },
            { id: "R6", label: "R6: Inconsistencies" },
          ].map((r) => (
            <button
              key={r.id}
              onClick={() => setRuleFilter(r.id)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                ruleFilter === r.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              {r.label}
              {metrics && r.id !== "ALL" && metrics.byRule[r.id as keyof typeof metrics.byRule] > 0 && (
                <span className="ml-1 font-bold">
                  ({metrics.byRule[r.id as keyof typeof metrics.byRule]})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Status Toggle */}
        <div className="flex items-center gap-1 border-l pl-3">
          {(["OPEN", "DISMISSED", "ALL"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-foreground text-background font-semibold"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
          <p className="text-sm">Scanning project knowledge graph with Radar rules...</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
          <ShieldCheck className="h-10 w-10 text-emerald-600 mx-auto mb-3" />
          <p className="font-semibold text-foreground">Zero Active Knowledge Loss Indicators</p>
          <p className="text-xs text-muted-foreground mt-1">
            {ruleFilter !== "ALL"
              ? `No alerts detected matching Rule ${ruleFilter}.`
              : "All critical components have verified redundancy, documented rationale, and assigned owners."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-xl border bg-card shadow-sm overflow-hidden p-5 space-y-4 ${
                alert.status === "DISMISSED" ? "opacity-70 bg-muted/20" : ""
              }`}
            >
              {/* Alert Header */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {renderSeverityBadge(alert.severity)}
                    <span className="rounded bg-primary/10 text-primary px-2 py-0.5 text-xs font-mono font-bold">
                      Rule {alert.ruleId}
                    </span>
                    <span className="text-xs font-semibold text-foreground">
                      {alert.category.replace(/_/g, " ")}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-foreground">{alert.title}</h3>
                </div>

                {/* Dismiss / Reactivate Actions */}
                <div>
                  {alert.status === "OPEN" ? (
                    <button
                      onClick={() => setDismissingAlert(alert)}
                      className="rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      Dismiss Alert
                    </button>
                  ) : (
                    <button
                      onClick={() => handleReactivate(alert)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                    >
                      <Undo2 className="h-3 w-3" />
                      Reactivate Alert
                    </button>
                  )}
                </div>
              </div>

              {/* Plain-Language Explanation */}
              <div className="text-xs text-foreground bg-muted/20 p-3 rounded-lg border">
                <span className="font-semibold">Diagnostic Finding: </span>
                {alert.explanation}
              </div>

              {/* Dismissed Banner */}
              {alert.status === "DISMISSED" && alert.dismissedReason && (
                <div className="rounded-lg bg-muted p-3 text-xs space-y-1 border">
                  <div className="font-semibold text-foreground">
                    Dismissed by {alert.dismissedBy?.name || "Reviewer"} on{" "}
                    {alert.dismissedAt ? new Date(alert.dismissedAt).toLocaleDateString() : ""}:
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
                        className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg border bg-background text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <code className="font-mono font-semibold text-foreground">
                            {claim.attributeKey}:
                          </code>
                          <span className="text-foreground">{claim.valueRaw}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {renderEvidenceStatusBadge(claim.evidenceStatus)}
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
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
                  <span className="font-semibold">Missing Knowledge Artifact: </span>
                  {alert.missingFieldStatement}
                </div>
              ) : alert.evidenceLinks.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Source Document Citations
                  </div>
                  {alert.evidenceLinks.slice(0, 2).map((ev, i) => (
                    <div key={i} className="rounded border bg-background p-2 text-xs space-y-0.5">
                      <div className="text-[11px] font-medium text-foreground">
                        {ev.fileName} ({ev.location})
                      </div>
                      <blockquote className="border-l-2 border-primary/40 pl-2 text-muted-foreground italic">
                        &ldquo;{ev.excerpt}&rdquo;
                      </blockquote>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Suggested Remediation */}
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs text-foreground space-y-1">
                <div className="font-semibold text-primary flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Suggested Remediation:
                </div>
                <p className="text-muted-foreground">{alert.suggestedRemediation}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dismiss Alert Modal */}
      {dismissingAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 font-bold text-foreground text-base">
                <ShieldAlert className="h-5 w-5 text-amber-600" />
                Dismiss Radar Alert
              </div>
              <button
                onClick={() => setDismissingAlert(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleDismissSubmit} className="space-y-4">
              <p className="text-muted-foreground">
                Dismissing alert <strong>&ldquo;{dismissingAlert.title}&rdquo;</strong> requires an
                explicit written justification that will be recorded in the project immutable audit log.
              </p>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Justification Reason (Mandatory)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Co-ownership is documented in onboarding wiki; risk acknowledged by lead architect."
                  value={dismissReason}
                  onChange={(e) => setDismissReason(e.target.value)}
                  className="w-full rounded-lg border bg-background p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDismissingAlert(null)}
                  className="rounded-lg border px-3 py-1.5 font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDismiss || !dismissReason.trim()}
                  className="rounded-lg bg-primary px-4 py-1.5 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {submittingDismiss ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Confirm Dismissal"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
