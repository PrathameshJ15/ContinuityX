"use client";

import React, { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import { getBusFactorEmptyState } from "@/lib/empty-states";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { FilterPills } from "@/components/ui/filter-pills";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  BrainCircuit,
  Info,
  Loader2,
  RotateCw,
  Send,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react";

interface MetricBreakdown {
  name: string;
  weight: number;
  score: number;
  numerator: number;
  denominator: number;
  hasSufficientEvidence: boolean;
  explanation: string;
  formula: string;
}

interface ContinuityScoreResult {
  score: number | null;
  hasSufficientEvidence: boolean;
  availableCoveragePercentage: number;
  status: "GOOD" | "MODERATE" | "NEEDS_ATTENTION" | "INSUFFICIENT_EVIDENCE";
  explanation: string;
  metrics: MetricBreakdown[];
  disclaimer: string;
}

interface BusFactorItem {
  componentId: string;
  componentName: string;
  isCritical: boolean;
  owners: Array<{ name: string; claimId: string; evidenceStatus: string }>;
  busFactor: number;
  isSingleOwner: boolean;
}

interface BusFactorMapResult {
  components: BusFactorItem[];
  totalComponents: number;
  singleOwnerCount: number;
  totalClaims?: number;
  disclaimer: string;
}

interface QACitation {
  claimId: string;
  subject: string;
  attribute: string;
  value: string;
  evidenceStatus: string;
  documentName?: string;
  location?: string;
  excerpt?: string;
}

interface QAMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  supported?: boolean;
  citations?: QACitation[];
  error?: boolean;
  failedQuestion?: string;
  timestamp: string;
}

export default function ContinuityIntelligencePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);

  const [activeTab, setActiveTab] = useState<"SCORE" | "BUS_FACTOR" | "QA">("SCORE");

  // Intelligence Data
  const [scoreData, setScoreData] = useState<ContinuityScoreResult | null>(null);
  const [busFactorData, setBusFactorData] = useState<BusFactorMapResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Q&A State
  const [questionInput, setQuestionInput] = useState("");
  const [asking, setAsking] = useState(false);
  const [chatHistory, setChatHistory] = useState<QAMessage[]>([
    {
      id: "intro-msg",
      sender: "assistant",
      text: "Welcome to Handover Q&A. I answer questions strictly from approved project claims and cited evidence. If no supporting evidence exists in approved knowledge, I will honestly refuse to guess.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const loadIntelligence = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/projects/${projectId}/intelligence`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to load continuity intelligence");

      setScoreData(json.data.score);
      setBusFactorData(json.data.busFactor);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load intelligence data");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadIntelligence();
  }, [loadIntelligence]);

  const handleAskQuestion = async (qText?: string) => {
    const textToAsk = (qText || questionInput).trim();
    if (!textToAsk || asking) return;

    const userMsg: QAMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: textToAsk,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setChatHistory((prev) => [...prev, userMsg]);
    setQuestionInput("");
    setAsking(true);
    setError(null);

    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), 30000);

    try {
      const res = await fetch(`/api/projects/${projectId}/qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: textToAsk }),
        signal: timeoutController.signal,
      });
      clearTimeout(timeoutId);

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Q&A query failed");

      const reply: QAMessage = {
        id: `assistant-${Date.now()}`,
        sender: "assistant",
        text: json.data.answer,
        supported: json.data.supported,
        citations: json.data.citations || [],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setChatHistory((prev) => [...prev, reply]);
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const isAbort =
        err instanceof Error &&
        (err.name === "AbortError" || err.message.toLowerCase().includes("aborted"));
      const errorMessage = isAbort
        ? "Request timed out after 30 seconds. The server took too long to retrieve or generate an answer."
        : err instanceof Error
        ? err.message
        : "Failed to answer question";

      const errorReply: QAMessage = {
        id: `assistant-error-${Date.now()}`,
        sender: "assistant",
        text: errorMessage,
        supported: false,
        error: true,
        failedQuestion: textToAsk,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setChatHistory((prev) => [...prev, errorReply]);
    } finally {
      setAsking(false);
    }
  };

  const sampleQuestions = [
    "Who owns the core components in this project?",
    "What selected technology choices have documented rationale?",
    "What tasks are currently in progress or completed?",
    "What are the unapproved future roadmap targets for next year?",
  ];

  const renderStatusBadge = (status?: string) => {
    switch (status) {
      case "GOOD":
        return <Badge variant="verified">GOOD CONTINUITY</Badge>;
      case "MODERATE":
        return <Badge variant="warning">MODERATE CONTINUITY</Badge>;
      case "NEEDS_ATTENTION":
        return <Badge variant="critical">NEEDS ATTENTION</Badge>;
      default:
        return <Badge variant="neutral">INSUFFICIENT EVIDENCE</Badge>;
    }
  };

  const busFactorEmpty = getBusFactorEmptyState(
    busFactorData?.totalClaims ?? 0,
    busFactorData?.components?.length ?? 0
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
            <span className="text-foreground font-medium">Continuity Intelligence</span>
          </div>
        }
        title="Continuity Intelligence"
        badge={
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            <BrainCircuit className="h-3.5 w-3.5" />
            AI & Analytics
          </span>
        }
        description="Transparent readiness scores, Bus Factor SPOF analysis, and hardened Q&A answering strictly from approved claims."
        actions={
          <FilterPills
            options={[
              { id: "SCORE", label: "Continuity Score" },
              { id: "BUS_FACTOR", label: "Bus Factor Map" },
              { id: "QA", label: "Handover Q&A" },
            ]}
            selectedId={activeTab}
            onSelect={(t) => setActiveTab(t as "SCORE" | "BUS_FACTOR" | "QA")}
          />
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

      {/* Main Content Area */}
      {loading ? (
        <TableSkeleton rows={5} />
      ) : (
        <>
          {/* TAB 1: CONTINUITY SCORE */}
          {activeTab === "SCORE" && scoreData && (
            <div className="space-y-6">
              {/* Score Hero Card */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-center justify-center h-28 w-28 rounded-2xl border-2 border-primary/20 bg-primary/5 p-4 shrink-0 shadow-inner">
                      {scoreData.hasSufficientEvidence && scoreData.score !== null ? (
                        <>
                          <div className="text-3xl font-extrabold text-foreground">
                            {scoreData.score}
                          </div>
                          <div className="text-[11px] font-semibold text-muted-foreground mt-0.5">
                            OUT OF 100
                          </div>
                        </>
                      ) : (
                        <div className="text-center">
                          <Info className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
                          <div className="text-[10px] font-bold text-muted-foreground uppercase leading-tight">
                            Insufficient Evidence
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {renderStatusBadge(scoreData.status)}
                        <span className="text-xs font-semibold text-muted-foreground">
                          Available Coverage: {scoreData.availableCoveragePercentage}% / 60% Required
                        </span>
                      </div>
                      <h2 className="text-lg font-bold text-foreground">
                        Project Knowledge Continuity Score
                      </h2>
                      <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
                        {scoreData.explanation}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => loadIntelligence()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent self-start md:self-auto shrink-0 shadow-xs cursor-pointer transition-colors"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    Recompute
                  </button>
                </div>

                <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 p-3 text-xs text-muted-foreground border border-border">
                  <strong className="text-foreground">Governance Notice:</strong> {scoreData.disclaimer}
                </div>
              </div>

              {/* Metric Breakdown Grid */}
              <div className="space-y-3">
                <h3 className="font-bold text-base text-foreground">
                  Metric Inputs & Transparent Formulas
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {scoreData.metrics.map((metric) => (
                    <div
                      key={metric.name}
                      className={`rounded-xl border border-border bg-card p-4 shadow-xs space-y-3 flex flex-col justify-between ${
                        !metric.hasSufficientEvidence ? "opacity-60 bg-slate-50/40 dark:bg-slate-900/20" : ""
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm text-foreground">
                            {metric.name}
                          </span>
                          <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-bold">
                            Weight: {metric.weight}%
                          </span>
                        </div>

                        <div className="flex items-baseline gap-2">
                          {metric.hasSufficientEvidence ? (
                            <>
                              <span className="text-2xl font-bold text-foreground">
                                {metric.score}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                ({metric.numerator} / {metric.denominator})
                              </span>
                            </>
                          ) : (
                            <span className="text-xs font-semibold text-muted-foreground italic">
                              Excluded (Denominator 0)
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground leading-relaxed">{metric.explanation}</p>
                      </div>

                      <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 p-2 text-[10px] font-mono text-muted-foreground border border-border">
                        {metric.formula}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BUS FACTOR MAP */}
          {activeTab === "BUS_FACTOR" && busFactorData && (
            <div className="space-y-6">
              {busFactorEmpty.state === "NO_DATA" ? (
                <EmptyState
                  type="no-data"
                  title={busFactorEmpty.title}
                  description={busFactorEmpty.description}
                  actionHref={`/projects/${projectId}/documents`}
                  actionLabel={busFactorEmpty.linkLabel || "Go to Documents"}
                />
              ) : busFactorEmpty.state === "CHECKED_EMPTY" || busFactorData.components.length === 0 ? (
                <EmptyState
                  type="checked-empty"
                  title={busFactorEmpty.title || "No Component Entities Found"}
                  description={busFactorEmpty.description}
                  actionHref={`/projects/${projectId}/documents`}
                  actionLabel={busFactorEmpty.linkLabel || "Go to Documents"}
                />
              ) : (
                <>
                  {/* Bus Factor Hero */}
                  <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-bold text-foreground">
                          Ownership Concentration & Bus Factor Map
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Highlights components where critical knowledge is concentrated in a single contributor.
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl border border-border bg-card p-3 text-center shadow-xs">
                          <div className="text-[11px] text-muted-foreground font-medium">
                            Total Modules
                          </div>
                          <div className="text-lg font-bold text-foreground">
                            {busFactorData.totalComponents}
                          </div>
                        </div>
                        <div className="rounded-xl border border-rose-300 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 p-3 text-center shadow-xs">
                          <div className="text-[11px] text-rose-700 dark:text-rose-300 font-medium">
                            Bus Factor = 1
                          </div>
                          <div className="text-lg font-bold text-rose-700 dark:text-rose-300">
                            {busFactorData.singleOwnerCount}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 p-3 text-xs text-muted-foreground border border-border">
                      <strong className="text-foreground">Calculation Rule:</strong> {busFactorData.disclaimer}
                    </div>
                  </div>

                  {/* Component Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {busFactorData.components.map((comp) => (
                      <div
                        key={comp.componentId}
                        className={`rounded-xl border border-border bg-card p-4 shadow-xs space-y-3 flex flex-col justify-between ${
                          comp.isSingleOwner && comp.isCritical
                            ? "border-rose-300 dark:border-rose-900/60 bg-rose-50/20"
                            : ""
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-bold text-foreground text-sm">
                                {comp.componentName}
                              </span>
                              {comp.isCritical && (
                                <span className="block text-[10px] font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
                                  Critical Component
                                </span>
                              )}
                            </div>

                            {comp.isSingleOwner ? (
                              <Badge variant="critical">Bus Factor: 1</Badge>
                            ) : comp.busFactor > 1 ? (
                              <Badge variant="verified">Bus Factor: {comp.busFactor}</Badge>
                            ) : (
                              <Badge variant="neutral">Unassigned</Badge>
                            )}
                          </div>

                          {/* Verified Owners */}
                          <div className="space-y-1 pt-1">
                            <div className="text-[11px] font-semibold text-muted-foreground">
                              Verified Owners:
                            </div>
                            {comp.owners.length === 0 ? (
                              <div className="text-xs italic text-muted-foreground">
                                No owner claim recorded
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {comp.owners.map((owner, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-foreground font-medium"
                                  >
                                    <UserCheck className="h-3 w-3 text-primary" />
                                    {owner.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {comp.isSingleOwner && comp.isCritical && (
                          <div className="rounded-lg bg-rose-100/50 dark:bg-rose-950/40 p-2 text-[11px] text-rose-800 dark:text-rose-300 font-medium border border-rose-200 dark:border-rose-900/40">
                            Single-contributor risk. Cross-training recommended.
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 3: HARDENED HANDOVER Q&A */}
          {activeTab === "QA" && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
              {/* Left Column: Sample Prompts & Security Rules */}
              <div className="lg:col-span-1 space-y-4">
                <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
                  <div className="flex items-center gap-1.5 font-bold text-foreground text-xs uppercase tracking-wider">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    Q&A Hardening Guarantees
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-2">
                    <li className="flex items-start gap-1.5">
                      <span className="text-emerald-600 font-bold">•</span>
                      <span>Answers strictly from <strong>approved claims</strong>.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-emerald-600 font-bold">•</span>
                      <span>Unanswerable questions return honest refusal without calling the model.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-emerald-600 font-bold">•</span>
                      <span>Every answer citations are validated server-side.</span>
                    </li>
                  </ul>
                </div>

                <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-2">
                  <div className="font-bold text-foreground text-xs uppercase tracking-wider">
                    Suggested Questions
                  </div>
                  <div className="space-y-1.5">
                    {sampleQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleAskQuestion(q)}
                        className="w-full text-left rounded-lg bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 p-2 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border cursor-pointer shadow-xs"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Interactive Chat Thread */}
              <div className="lg:col-span-3 rounded-xl border border-border bg-card shadow-xs flex flex-col h-[650px] overflow-hidden">
                {/* Chat Scroll Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {chatHistory.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${
                        msg.sender === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      {msg.sender === "assistant" && (
                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                          <Bot className="h-4 w-4" />
                        </div>
                      )}

                      <div
                        className={`max-w-2xl rounded-2xl p-4 text-xs space-y-3 ${
                          msg.sender === "user"
                            ? "bg-primary text-white rounded-br-none"
                            : msg.error
                            ? "bg-rose-50 dark:bg-rose-950/20 border border-rose-300 dark:border-rose-900 text-rose-900 dark:text-rose-200 rounded-bl-none"
                            : "bg-slate-50 dark:bg-slate-900/50 border border-border text-foreground rounded-bl-none"
                        }`}
                      >
                        {msg.error ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5 font-semibold text-rose-700 dark:text-rose-400">
                              <AlertCircle className="h-4 w-4 shrink-0" />
                              <span>Q&A Query Error</span>
                            </div>
                            <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                            {msg.failedQuestion && (
                              <button
                                onClick={() => handleAskQuestion(msg.failedQuestion)}
                                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md bg-rose-600 hover:bg-rose-700 text-white transition-colors mt-2 cursor-pointer"
                              >
                                <RotateCw className="h-3 w-3" />
                                Retry Question
                              </button>
                            )}
                          </div>
                        ) : (
                          <>
                            {msg.sender === "assistant" && msg.supported === false && (
                              <div className="inline-flex items-center gap-1.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 px-2 py-0.5 text-[11px] font-semibold mb-1">
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                                Refusal: Unverified in Approved Evidence
                              </div>
                            )}
                            <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                          </>
                        )}

                        {/* Citations Box */}
                        {msg.citations && msg.citations.length > 0 && (
                          <div className="pt-2 border-t border-border/40 space-y-1.5">
                            <div className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
                              Cited Grounded Evidence ({msg.citations.length})
                            </div>
                            <div className="space-y-1.5">
                              {msg.citations.map((cite, i) => (
                                <div
                                  key={i}
                                  className="rounded-lg border border-border bg-card p-2 text-xs space-y-1"
                                >
                                  <div className="flex items-center justify-between font-semibold text-foreground">
                                    <span>
                                      {cite.subject} → {cite.attribute}: {cite.value}
                                    </span>
                                    <span className="rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 px-1.5 py-0.5 text-[10px]">
                                      {cite.evidenceStatus}
                                    </span>
                                  </div>
                                  {cite.excerpt && (
                                    <blockquote className="border-l-2 border-primary/40 pl-2 text-muted-foreground italic text-[11px] py-0.5">
                                      &ldquo;{cite.excerpt}&rdquo; ({cite.documentName || "Doc"},{" "}
                                      {cite.location})
                                    </blockquote>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div
                          className={`text-[10px] text-right ${
                            msg.sender === "user"
                              ? "text-white/80"
                              : "text-muted-foreground"
                          }`}
                        >
                          {msg.timestamp}
                        </div>
                      </div>
                    </div>
                  ))}

                  {asking && (
                    <div className="flex gap-3 justify-start">
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="rounded-2xl rounded-bl-none bg-slate-50 dark:bg-slate-900/50 border border-border p-4 text-xs text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        Retrieving approved claims & evaluating evidence...
                      </div>
                    </div>
                  )}
                </div>

                {/* Question Input Footer */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAskQuestion();
                  }}
                  className="border-t border-border p-3 bg-slate-50/75 dark:bg-slate-900/50 flex items-center gap-2"
                >
                  <input
                    type="text"
                    placeholder="Ask a question about approved architecture, decisions, or owners..."
                    value={questionInput}
                    onChange={(e) => setQuestionInput(e.target.value)}
                    disabled={asking}
                    className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                  />
                  <button
                    type="submit"
                    disabled={asking || !questionInput.trim()}
                    className="rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-40 inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Ask
                  </button>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
