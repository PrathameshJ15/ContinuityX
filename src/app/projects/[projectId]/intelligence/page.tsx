"use client";

import React, { useState, useEffect, use, useCallback } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Info,
  Loader2,
  RotateCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
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

    try {
      const res = await fetch(`/api/projects/${projectId}/qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: textToAsk }),
      });

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
      setError(err instanceof Error ? err.message : "Failed to answer question");
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
        return (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 px-2.5 py-0.5 text-xs font-semibold">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            GOOD CONTINUITY
          </span>
        );
      case "MODERATE":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 px-2.5 py-0.5 text-xs font-semibold">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            MODERATE CONTINUITY
          </span>
        );
      case "NEEDS_ATTENTION":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 px-2.5 py-0.5 text-xs font-semibold">
            <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
            NEEDS ATTENTION
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded bg-muted text-muted-foreground px-2.5 py-0.5 text-xs font-semibold">
            <Info className="h-3.5 w-3.5" />
            INSUFFICIENT EVIDENCE
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Continuity Intelligence
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              <BrainCircuit className="h-3.5 w-3.5" />
              Proof-Carrying Insights
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Transparent readiness scores, Bus Factor mapping, and hardened Q&A answering strictly from approved claims.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1 rounded-xl border bg-card p-1 shadow-sm text-xs">
          <button
            onClick={() => setActiveTab("SCORE")}
            className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
              activeTab === "SCORE"
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            Continuity Score
          </button>
          <button
            onClick={() => setActiveTab("BUS_FACTOR")}
            className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
              activeTab === "BUS_FACTOR"
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            Bus Factor Map
          </button>
          <button
            onClick={() => setActiveTab("QA")}
            className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
              activeTab === "QA"
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            Handover Q&A
          </button>
        </div>
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

      {/* Loading State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
          <p className="text-sm">Evaluating continuity intelligence & knowledge graph...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: CONTINUITY SCORE */}
          {activeTab === "SCORE" && scoreData && (
            <div className="space-y-6">
              {/* Score Hero Card */}
              <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
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
                      <p className="text-xs text-muted-foreground max-w-xl">
                        {scoreData.explanation}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={loadIntelligence}
                    className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted self-start md:self-auto shrink-0 shadow-sm"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    Recompute
                  </button>
                </div>

                <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground border">
                  <strong>Notice:</strong> {scoreData.disclaimer}
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
                      className={`rounded-xl border bg-card p-4 shadow-sm space-y-3 flex flex-col justify-between ${
                        !metric.hasSufficientEvidence ? "opacity-60 bg-muted/20" : ""
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

                        <p className="text-xs text-muted-foreground">{metric.explanation}</p>
                      </div>

                      <div className="rounded bg-muted/30 p-2 text-[10px] font-mono text-muted-foreground border">
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
              {/* Bus Factor Hero */}
              <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">
                      Ownership-Concentration & Bus Factor Map
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Highlights components where critical knowledge is concentrated in a single contributor.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl border bg-background p-3 text-center">
                      <div className="text-[11px] text-muted-foreground font-medium">
                        Total Modules
                      </div>
                      <div className="text-lg font-bold text-foreground">
                        {busFactorData.totalComponents}
                      </div>
                    </div>
                    <div className="rounded-xl border border-rose-300 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 p-3 text-center">
                      <div className="text-[11px] text-rose-700 dark:text-rose-300 font-medium">
                        Bus Factor = 1
                      </div>
                      <div className="text-lg font-bold text-rose-700 dark:text-rose-300">
                        {busFactorData.singleOwnerCount}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground border">
                  <strong>Definition:</strong> {busFactorData.disclaimer}
                </div>
              </div>

              {/* Component Cards */}
              {busFactorData.components.length === 0 ? (
                <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
                  <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="font-medium text-foreground">No Component Entities Found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Upload architecture documents to extract COMPONENT entities and owner claims.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {busFactorData.components.map((comp) => (
                    <div
                      key={comp.componentId}
                      className={`rounded-xl border bg-card p-4 shadow-sm space-y-3 flex flex-col justify-between ${
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
                            <span className="rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 px-2 py-0.5 text-[11px] font-bold shrink-0">
                              Bus Factor: 1
                            </span>
                          ) : comp.busFactor > 1 ? (
                            <span className="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 px-2 py-0.5 text-[11px] font-bold shrink-0">
                              Bus Factor: {comp.busFactor}
                            </span>
                          ) : (
                            <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[11px] shrink-0">
                              Unassigned
                            </span>
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
                                  className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-foreground font-medium"
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
                        <div className="rounded bg-rose-100/50 dark:bg-rose-950/40 p-2 text-[11px] text-rose-800 dark:text-rose-300 font-medium border border-rose-200 dark:border-rose-900/40">
                          Single-contributor risk. Cross-training recommended.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: HARDENED HANDOVER Q&A */}
          {activeTab === "QA" && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Left Column: Sample Prompts & Security Rules */}
              <div className="lg:col-span-1 space-y-4">
                <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
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

                <div className="rounded-xl border bg-card p-4 shadow-sm space-y-2">
                  <div className="font-bold text-foreground text-xs uppercase tracking-wider">
                    Suggested Questions
                  </div>
                  <div className="space-y-1.5">
                    {sampleQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleAskQuestion(q)}
                        className="w-full text-left rounded-lg bg-muted/40 hover:bg-muted p-2 text-xs text-muted-foreground hover:text-foreground transition-colors border"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Interactive Chat Thread */}
              <div className="lg:col-span-3 rounded-xl border bg-card shadow-sm flex flex-col h-[650px] overflow-hidden">
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
                            ? "bg-primary text-primary-foreground rounded-br-none"
                            : "bg-muted/40 border text-foreground rounded-bl-none"
                        }`}
                      >
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>

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
                                  className="rounded border bg-background p-2 text-xs space-y-1"
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
                                    <blockquote className="border-l-2 border-primary/40 pl-2 text-muted-foreground italic text-[11px]">
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
                              ? "text-primary-foreground/70"
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
                      <div className="rounded-2xl rounded-bl-none bg-muted/40 border p-4 text-xs text-muted-foreground flex items-center gap-2">
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
                  className="border-t p-3 bg-muted/20 flex items-center gap-2"
                >
                  <input
                    type="text"
                    placeholder="Ask a question about approved architecture, decisions, or owners..."
                    value={questionInput}
                    onChange={(e) => setQuestionInput(e.target.value)}
                    disabled={asking}
                    className="flex-1 rounded-xl border bg-background px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                  />
                  <button
                    type="submit"
                    disabled={asking || !questionInput.trim()}
                    className="rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-1.5 shadow-sm transition-colors"
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
