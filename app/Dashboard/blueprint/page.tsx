"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { PromptComparisonView } from "@/components/schema-designer/PromptComparisonView";
import { VoiceInputButton } from "@/components/voice/VoiceInputButton";
import {
  analyzePromptLocal,
  analyzePromptHybrid,
  createPromptVersion,
  refinePrompt,
} from "@/lib/prompt-intelligence";
import { useSchemaStore } from "@/lib/schema-store";
import {
  Sparkles,
  ArrowUp,
  Trash2,
  Brain,
  BarChart3,
  RefreshCw,
  Wand2,
  ArrowUpRight,
  Lightbulb,
  Check,
  X,
} from "lucide-react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

const generateId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const RECOMMENDATIONS = [
  "Coffee shop with products, orders, payments, and inventory",
  "SaaS app with organizations, users, roles, and billing",
  "E-commerce with carts, orders, shipments, and returns",
  "Hospital system with patients, doctors, visits, and prescriptions",
];

export default function BlueprintPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [activePrompt, setActivePrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [analysis, setAnalysis] = useState<ReturnType<
    typeof analyzePromptLocal
  > | null>(null);
  const addPromptVersion = useSchemaStore((s) => s.addPromptVersion);
  const setPromptAnalysis = useSchemaStore((s) => s.setPromptAnalysis);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [breakdownView, setBreakdownView] = useState<"rule" | "ai">("rule");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [refineOpen, setRefineOpen] = useState(false);
  const [refineResult, setRefineResult] = useState<{
    improved: string;
    changes: string[];
  } | null>(null);

  // Keep this in session memory only by default: no DB/localStorage persistence.
  const keepHistory = false;

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const getTargetPrompt = useCallback(() => {
    return prompt.trim() || activePrompt.trim();
  }, [prompt, activePrompt]);

  useEffect(() => {
    const target = getTargetPrompt();
    if (!target) {
      setAnalysis(null);
      return;
    }
    const result = analyzePromptLocal(target);
    setAnalysis(result);
    setPromptAnalysis(result);
  }, [getTargetPrompt, setPromptAnalysis]);

  const handleAIAnalysis = useCallback(async () => {
    const target = getTargetPrompt();
    if (!target) return;
    setIsAnalyzingAI(true);
    try {
      const result = await analyzePromptHybrid(target);
      setAnalysis(result);
      setPromptAnalysis(result);
      setActivePrompt(target);
      const version = createPromptVersion(
        target,
        result.ruleScore,
        result.aiScore,
        result.combinedScore,
        false,
      );
      addPromptVersion(version);
    } catch (err) {
      console.error("Blueprint AI analysis failed:", err);
    } finally {
      setIsAnalyzingAI(false);
    }
  }, [getTargetPrompt, addPromptVersion, setPromptAnalysis]);

  const handleRefinePrompt = useCallback(async () => {
    const target = getTargetPrompt();
    if (!target) return;
    setIsRefining(true);
    setRefineResult(null);
    try {
      const result = await refinePrompt(target);
      if (!result.error) {
        setRefineResult({ improved: result.improved, changes: result.changes });
      }
    } catch (err) {
      console.error("Blueprint refine failed:", err);
    } finally {
      setIsRefining(false);
    }
  }, [getTargetPrompt]);

  const openRefineModal = useCallback(() => {
    setRefineOpen(true);
    void handleRefinePrompt();
  }, [handleRefinePrompt]);

  const handleAcceptRefinement = useCallback(() => {
    if (!refineResult) return;
    setPrompt(refineResult.improved);
    setActivePrompt(refineResult.improved);
    setRefineResult(null);
    const result = analyzePromptLocal(refineResult.improved);
    setAnalysis(result);
    setPromptAnalysis(result);
    const version = createPromptVersion(
      refineResult.improved,
      result.ruleScore,
      result.aiScore,
      result.combinedScore,
      true,
    );
    addPromptVersion(version);
  }, [refineResult, addPromptVersion, setPromptAnalysis]);

  const submitPrompt = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setActivePrompt(trimmed);
    setRefineResult(null);
    const result = analyzePromptLocal(trimmed);
    setAnalysis(result);
    setPromptAnalysis(result);
    const version = createPromptVersion(
      trimmed,
      result.ruleScore,
      result.aiScore,
      result.combinedScore,
      false,
    );
    addPromptVersion(version);

    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content: trimmed,
      createdAt: Date.now(),
    };

    const assistantMessage: ChatMessage = {
      id: generateId(),
      role: "assistant",
      content:
        "Blueprint captured. Move to Studio to generate and analyze your schema.",
      createdAt: Date.now(),
    };

    if (keepHistory) {
      setMessages((prev) => [...prev, userMessage, assistantMessage]);
    } else {
      setMessages([userMessage, assistantMessage]);
    }

    const code =
      roomCode || Math.random().toString(36).slice(2, 8).toUpperCase();
    if (!roomCode) {
      setRoomCode(code);
    }
    if (typeof window !== "undefined") {
      const base = window.location.origin;
      const url = `${base}/Dashboard/canvas?room=${encodeURIComponent(code)}`;
      setShareUrl(url);
    }

    setPrompt("");
  };

  const continueToStudio = () => {
    // Optional handoff value for future Studio ingestion support.
    const latestPrompt =
      prompt.trim() ||
      activePrompt.trim() ||
      messages
        .filter((m) => m.role === "user")
        .at(-1)
        ?.content.trim();

    if (latestPrompt) {
      const roomParam = roomCode ? `&room=${encodeURIComponent(roomCode)}` : "";
      router.push(
        `/Dashboard/canvas?blueprintPrompt=${encodeURIComponent(latestPrompt)}${roomParam}`,
      );
      return;
    }

    router.push("/Dashboard/canvas");
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="layout flex w-full min-h-screen gap-6 px-6 pb-10 pt-28">
        <aside className="left-sidebar w-64 flex-shrink-0 overflow-y-auto">
          <PromptHistory />
        </aside>

        <main className="main-content flex-1 flex justify-center">
          <div className="content-wrapper w-full max-w-4xl">
            <section className="flex w-full flex-col items-center justify-center">
              <div className="mb-8 text-center">
                <p className="text-sm font-medium text-muted-foreground">
                  {greeting}
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-4xl">
                  Plan Your Database in Blueprint
                </h1>
                <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                  Enter requirements here. Studio will handle generation,
                  scoring, and analysis.
                </p>
              </div>

              <PromptInput
                prompt={prompt}
                setPrompt={setPrompt}
                submitPrompt={submitPrompt}
                openRefineModal={openRefineModal}
                setSuggestionsOpen={setSuggestionsOpen}
                messages={messages}
                setMessages={setMessages}
                continueToStudio={continueToStudio}
                roomCode={roomCode}
                shareUrl={shareUrl}
                copied={copied}
                setCopied={setCopied}
              />
            </section>
          </div>
        </main>

        <aside className="right-sidebar w-80 flex-shrink-0 space-y-4">
          <RuleScorePanel
            analysis={analysis}
            hasPrompt={Boolean(activePrompt.trim() || prompt.trim())}
          />
          <AIScorePanel
            analysis={analysis}
            handleAIAnalysis={handleAIAnalysis}
            isAnalyzingAI={isAnalyzingAI}
            hasPrompt={Boolean(activePrompt.trim() || prompt.trim())}
          />
          <ScoreBreakdown
            analysis={analysis}
            breakdownView={breakdownView}
            setBreakdownView={setBreakdownView}
          />
        </aside>
      </div>

      {analysis && suggestionsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSuggestionsOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-border bg-background shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                <h3 className="text-base font-semibold text-foreground">
                  Missing Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSuggestionsOpen(false)}
                className="rounded-md p-1 hover:bg-muted/60"
                aria-label="Close missing details"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4">
              {analysis.suggestions.length === 0 &&
              (!analysis.aiSuggestions ||
                analysis.aiSuggestions.length === 0) ? (
                <p className="text-sm text-muted-foreground/70">
                  No missing details detected yet.
                </p>
              ) : (
                <>
                  {analysis.suggestions.map((suggestion, i) => (
                    <div
                      key={`rule-${i}`}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <ArrowUpRight className="h-3 w-3 mt-0.5 flex-shrink-0 text-primary/70" />
                      <span>{suggestion}</span>
                    </div>
                  ))}
                  {analysis.aiSuggestions &&
                    analysis.aiSuggestions.length > 0 && (
                      <>
                        <Separator />
                        <div className="flex items-center gap-2">
                          <Brain className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs font-medium text-muted-foreground">
                            AI Suggestions
                          </span>
                        </div>
                        {analysis.aiSuggestions.map((suggestion, i) => (
                          <div
                            key={`ai-${i}`}
                            className="flex items-start gap-2 text-sm text-muted-foreground"
                          >
                            <ArrowUpRight className="h-3 w-3 mt-0.5 flex-shrink-0 text-primary" />
                            <span>{suggestion}</span>
                          </div>
                        ))}
                      </>
                    )}
                </>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border px-5 py-3">
              <p className="text-[10px] text-muted-foreground">
                Apply suggestions to enrich the prompt.
              </p>
              <Button
                size="sm"
                onClick={() => {
                  const target = getTargetPrompt();
                  const suggestions = [
                    ...analysis.suggestions,
                    ...(analysis.aiSuggestions ?? []),
                  ];
                  if (!target || suggestions.length === 0) {
                    setSuggestionsOpen(false);
                    return;
                  }
                  const additions = suggestions
                    .map((item) => `- ${item}`)
                    .join("\n");
                  const merged = `${target}\n\nMissing details to add:\n${additions}`;
                  setPrompt(merged);
                  setActivePrompt(merged);
                  setSuggestionsOpen(false);
                }}
              >
                Implement Suggestions
              </Button>
            </div>
          </div>
        </div>
      )}
      {refineOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setRefineOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-border bg-background shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  Improve My Prompt
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRefineOpen(false)}
                className="rounded-md p-1 hover:bg-muted/60"
                aria-label="Close improve prompt"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4">
              {isRefining && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Improving your prompt...
                </div>
              )}
              {!isRefining && !refineResult && (
                <p className="text-xs text-muted-foreground/70">
                  No improved prompt yet. Click Improve again after entering
                  your prompt.
                </p>
              )}
              {refineResult && (
                <>
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-foreground">
                    {refineResult.improved}
                  </div>
                  {refineResult.changes.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        What changed:
                      </span>
                      {refineResult.changes.map((change, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-1.5 text-xs text-muted-foreground"
                        >
                          <ArrowUpRight className="h-3 w-3 mt-0.5 flex-shrink-0 text-green-500" />
                          <span>{change}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border px-5 py-3">
              <p className="text-[10px] text-muted-foreground">
                Apply the improved prompt to continue.
              </p>
              <Button
                size="sm"
                onClick={() => {
                  if (!refineResult) {
                    setRefineOpen(false);
                    return;
                  }
                  handleAcceptRefinement();
                  setRefineOpen(false);
                }}
              >
                Use Improved Prompt
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function PromptInput({
  prompt,
  setPrompt,
  submitPrompt,
  openRefineModal,
  setSuggestionsOpen,
  messages,
  setMessages,
  continueToStudio,
  roomCode,
  shareUrl,
  copied,
  setCopied,
}: {
  prompt: string;
  setPrompt: React.Dispatch<React.SetStateAction<string>>;
  submitPrompt: (value: string) => void;
  openRefineModal: () => void;
  setSuggestionsOpen: (value: boolean) => void;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  continueToStudio: () => void;
  roomCode: string | null;
  shareUrl: string | null;
  copied: boolean;
  setCopied: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = shareUrl;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy share URL", err);
    }
  };

  return (
    <>
      <div className="w-full rounded-3xl border border-border/60 bg-card/70 p-3 shadow-sm backdrop-blur">
        <div className="flex items-center gap-2 rounded-2xl border bg-background p-2 sm:p-3">
          <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitPrompt(prompt);
              }
            }}
            placeholder="Describe entities, constraints, and relationships..."
            className="border-0 bg-transparent focus-visible:ring-0"
          />
          <Button
            size="icon"
            onClick={() => submitPrompt(prompt)}
            disabled={!prompt.trim()}
            aria-label="Submit blueprint prompt"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[10px] text-muted-foreground">
            Record a voice prompt and we will convert it to text.
          </p>
          <VoiceInputButton
            onTranscript={(text) =>
              setPrompt((prev) => (prev.trim() ? `${prev} ${text}` : text))
            }
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {RECOMMENDATIONS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setPrompt(item)}
              className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:text-sm"
            >
              {item}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground sm:text-sm">
            History mode: session only (resets on refresh). This is a safer
            default for now.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMessages([])}
            disabled={messages.length === 0}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>

      <div className="mt-4 w-full">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setSuggestionsOpen(true)}
            className="flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
          >
            <Lightbulb className="h-3.5 w-3.5 text-yellow-500" />
            Missing Details
          </button>
          <button
            type="button"
            onClick={openRefineModal}
            className="flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
          >
            <Wand2 className="h-3.5 w-3.5 text-primary" />
            Improve My Prompt
          </button>
        </div>
      </div>

      {messages.length > 0 && (
        <div className="mt-6 w-full space-y-3">
          {messages.map((message) => (
            <article
              key={message.id}
              className={
                message.role === "user"
                  ? "ml-auto max-w-[85%] rounded-2xl border bg-primary/10 px-4 py-3 text-sm"
                  : "mr-auto max-w-[85%] rounded-2xl border bg-muted px-4 py-3 text-sm"
              }
            >
              {message.content}
            </article>
          ))}
        </div>
      )}

      {roomCode && shareUrl && (
        <div className="mt-6 w-full rounded-2xl border border-border/60 bg-card/70 p-4 text-sm shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-foreground">
                Collaboration link ready
              </p>
              <p className="text-[11px] text-muted-foreground">
                Share this room code or URL to invite collaborators.
              </p>
            </div>
            <div className="rounded-full border border-primary/30 px-3 py-1 text-xs text-primary">
              Room {roomCode}
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              readOnly
              value={shareUrl}
              className="text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button size="sm" onClick={handleCopy}>
              {copied ? "Copied" : "Copy Link"}
            </Button>
          </div>
        </div>
      )}

      <div className="mt-6">
        <Button onClick={continueToStudio}>Continue in Studio</Button>
      </div>
    </>
  );
}

function PromptHistory() {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 shadow-sm">
      <PromptComparisonView />
    </div>
  );
}

function RuleScorePanel({
  analysis,
  hasPrompt,
}: {
  analysis: ReturnType<typeof analyzePromptLocal> | null;
  hasPrompt: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        <span className="text-xs font-medium">Rule Score</span>
      </div>
      <div className="mt-4">
        {analysis && hasPrompt ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Score</span>
              <span
                className={`text-sm font-semibold ${getScoreColor(analysis.ruleScore)}`}
              >
                {analysis.ruleScore}/100
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getScoreBarColor(analysis.ruleScore)}`}
                style={{ width: `${analysis.ruleScore}%` }}
              />
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground/70">
            Enter a prompt to compute the rule-based score.
          </p>
        )}
      </div>
    </div>
  );
}

function AIScorePanel({
  analysis,
  handleAIAnalysis,
  isAnalyzingAI,
  hasPrompt,
}: {
  analysis: ReturnType<typeof analyzePromptLocal> | null;
  handleAIAnalysis: () => void;
  isAnalyzingAI: boolean;
  hasPrompt: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium">AI Score</span>
        </div>
        {analysis && !analysis.aiBreakdown && hasPrompt && (
          <button
            type="button"
            onClick={handleAIAnalysis}
            disabled={isAnalyzingAI}
            className="rounded-full border border-primary/30 px-2 py-0.5 text-[10px] text-primary transition-colors hover:bg-primary/5 disabled:opacity-50"
          >
            {isAnalyzingAI ? "Analyzing..." : "Get AI Score"}
          </button>
        )}
      </div>
      <div className="mt-4">
        {analysis && analysis.aiScore !== null ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Score</span>
              <span
                className={`text-sm font-semibold ${getScoreColor(analysis.aiScore)}`}
              >
                {analysis.aiScore}/100
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getScoreBarColor(analysis.aiScore)}`}
                style={{ width: `${analysis.aiScore}%` }}
              />
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground/70">
            Run AI scoring to see insights here.
          </p>
        )}
      </div>
    </div>
  );
}

function ScoreBreakdown({
  analysis,
  breakdownView,
  setBreakdownView,
}: {
  analysis: ReturnType<typeof analyzePromptLocal> | null;
  breakdownView: "rule" | "ai";
  setBreakdownView: (value: "rule" | "ai") => void;
}) {
  if (!analysis) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium">Score Breakdown</span>
        </div>
        <p className="mt-3 text-xs text-muted-foreground/70">
          Submit a prompt to view breakdown details.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium">Score Breakdown</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setBreakdownView("rule")}
            className={`rounded-full px-2 py-0.5 text-[10px] ${
              breakdownView === "rule"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground"
            }`}
          >
            Rule
          </button>
          <button
            type="button"
            onClick={() => setBreakdownView("ai")}
            disabled={!analysis.aiBreakdown}
            className={`rounded-full px-2 py-0.5 text-[10px] ${
              breakdownView === "ai" && analysis.aiBreakdown
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground"
            } ${analysis.aiBreakdown ? "" : "opacity-50"}`}
          >
            AI
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {breakdownView === "rule" && (
          <>
            <LargeBreakdownRow
              label="Length"
              score={analysis.ruleBreakdown.length}
              max={15}
            />
            <LargeBreakdownRow
              label="Entities"
              score={analysis.ruleBreakdown.entities}
              max={30}
            />
            <LargeBreakdownRow
              label="Relationships"
              score={analysis.ruleBreakdown.relationships}
              max={25}
            />
            <LargeBreakdownRow
              label="Constraints"
              score={analysis.ruleBreakdown.constraints}
              max={15}
            />
            <LargeBreakdownRow
              label="Scale"
              score={analysis.ruleBreakdown.scale}
              max={8}
            />
            <LargeBreakdownRow
              label="Roles"
              score={analysis.ruleBreakdown.roles}
              max={7}
            />
          </>
        )}

        {breakdownView === "ai" && analysis.aiBreakdown && (
          <>
            <LargeBreakdownRow
              label="Specificity"
              score={analysis.aiBreakdown.specificity}
              max={25}
            />
            <LargeBreakdownRow
              label="Rel. Clarity"
              score={analysis.aiBreakdown.relationshipClarity}
              max={25}
            />
            <LargeBreakdownRow
              label="Constraints"
              score={analysis.aiBreakdown.constraintsAndRules}
              max={25}
            />
            <LargeBreakdownRow
              label="Completeness"
              score={analysis.aiBreakdown.realWorldCompleteness}
              max={25}
            />
          </>
        )}
      </div>
    </div>
  );
}

function LargeBreakdownRow({
  label,
  score,
  max,
}: {
  label: string;
  score: number;
  max: number;
}) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 flex-shrink-0 text-sm text-foreground">
        {label}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary/70 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-14 text-right text-sm tabular-nums text-muted-foreground">
        {score}/{max}
      </span>
    </div>
  );
}

function getScorePillColor(score: number) {
  if (score >= 70) return "bg-green-500/10 text-green-500";
  if (score >= 40) return "bg-yellow-500/10 text-yellow-500";
  return "bg-red-500/10 text-red-500";
}

function getScoreColor(score: number) {
  if (score >= 70) return "text-green-500";
  if (score >= 40) return "text-yellow-500";
  return "text-red-400";
}

function getScoreBarColor(score: number) {
  if (score >= 70) return "bg-green-500";
  if (score >= 40) return "bg-yellow-500";
  return "bg-red-400";
}
