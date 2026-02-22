"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  calculateClarity,
  generateSchemaFromDescription,
} from "@/lib/schema-utils";
import { TableSchema } from "@/lib/schema-types";
import { useSchemaStore } from "@/lib/schema-store";
import {
  analyzePromptLocal,
  analyzePromptHybrid,
  refinePrompt,
  createPromptVersion,
} from "@/lib/prompt-intelligence";
import { SchemaHealthPanel } from "./SchemaHealthPanel";
import { VersionHistoryPanel } from "./VersionHistoryPanel";
import { PromptComparisonView } from "./PromptComparisonView";
import {
  Sparkles,
  ChevronRight,
  Lightbulb,
  Layers,
  Link2,
  Eye,
  Check,
  X,
  Plus,
  Activity,
  History,
  Wand2,
  Brain,
  BarChart3,
  RefreshCw,
  ArrowUpRight,
} from "lucide-react";

// ─── Tab types ──────────────────────────────────────────────────────────────

type SidebarTab = "prompt" | "health" | "history";

const exampleDescriptions = [
  "E-commerce store with users, products, orders, payments, and reviews",
  "Blog platform with users, posts, comments, and categories",
  "Project management tool with teams, projects, tasks, and users",
  "Online school with students, teachers, courses, assignments",
];

// ─── Main Component ─────────────────────────────────────────────────────────

export function AssistantSidebar() {
  const tables = useSchemaStore((s) => s.tables);
  const setTables = useSchemaStore((s) => s.setTables);
  const addTable = useSchemaStore((s) => s.addTable);
  const addPromptVersion = useSchemaStore((s) => s.addPromptVersion);
  const setPromptAnalysis = useSchemaStore((s) => s.setPromptAnalysis);
  const currentPromptAnalysis = useSchemaStore(
    (s) => s.currentPromptAnalysis,
  );

  const tablesArray = Object.values(tables);

  const [activeTab, setActiveTab] = useState<SidebarTab>("prompt");
  const [description, setDescription] = useState("");
  const [_clarity, setClarity] = useState({
    score: 0,
    suggestions: ["Start by describing what your application does."],
    detectedEntities: [] as string[],
    detectedRelationships: [] as string[],
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [refineResult, setRefineResult] = useState<{
    improved: string;
    changes: string[];
  } | null>(null);

  // ── Preview mode ──────────────────────────────────────────────────
  const [previewTables, setPreviewTables] = useState<TableSchema[] | null>(
    null,
  );
  const isPreview = previewTables !== null;

  // ── Local clarity updates ─────────────────────────────────────────
  useEffect(() => {
    const result = calculateClarity(description);
    setClarity(result);

    // Also run local rule-based analysis
    if (description.trim()) {
      const analysis = analyzePromptLocal(description);
      setPromptAnalysis(analysis);
    }
  }, [description, setPromptAnalysis]);

  // ── Hybrid AI Analysis ────────────────────────────────────────────
  const handleAIAnalysis = useCallback(async () => {
    if (!description.trim()) return;
    setIsAnalyzingAI(true);
    try {
      const analysis = await analyzePromptHybrid(description);
      setPromptAnalysis(analysis);

      // Save prompt version
      const version = createPromptVersion(
        description,
        analysis.ruleScore,
        analysis.aiScore,
        analysis.combinedScore,
        false,
      );
      addPromptVersion(version);
    } catch {
      // Falls back to rule-only
    } finally {
      setIsAnalyzingAI(false);
    }
  }, [description, setPromptAnalysis, addPromptVersion]);

  // ── AI Prompt Refiner ─────────────────────────────────────────────
  const handleRefinePrompt = useCallback(async () => {
    if (!description.trim()) return;
    setIsRefining(true);
    setRefineResult(null);
    try {
      const result = await refinePrompt(description);
      if (!result.error) {
        setRefineResult({ improved: result.improved, changes: result.changes });
      }
    } catch {
      // silently fail
    } finally {
      setIsRefining(false);
    }
  }, [description]);

  const handleAcceptRefinement = useCallback(() => {
    if (refineResult) {
      setDescription(refineResult.improved);
      setRefineResult(null);

      // Analyze the refined prompt and save as version
      const analysis = analyzePromptLocal(refineResult.improved);
      setPromptAnalysis(analysis);
      const version = createPromptVersion(
        refineResult.improved,
        analysis.ruleScore,
        analysis.aiScore,
        analysis.combinedScore,
        true,
      );
      addPromptVersion(version);
    }
  }, [refineResult, setPromptAnalysis, addPromptVersion]);

  // ── Schema Generation ─────────────────────────────────────────────
  const handlePreview = useCallback(() => {
    if (!description.trim()) return;
    setIsGenerating(true);
    setTimeout(() => {
      const generated = generateSchemaFromDescription(description);
      setPreviewTables(generated);
      setIsGenerating(false);
    }, 400);
  }, [description]);

  const handleAcceptPreview = useCallback(() => {
    if (previewTables) {
      setTables(previewTables);
      setPreviewTables(null);
    }
  }, [previewTables, setTables]);

  const handleRejectPreview = useCallback(() => {
    setPreviewTables(null);
  }, []);

  const handleGenerateDirect = useCallback(() => {
    if (!description.trim()) return;
    setIsGenerating(true);
    setTimeout(() => {
      const generated = generateSchemaFromDescription(description);
      setTables(generated);
      setIsGenerating(false);
    }, 600);
  }, [description, setTables]);

  const handleExampleClick = (example: string) => {
    setDescription(example);
    setPreviewTables(null);
    setRefineResult(null);
  };

  const handleAddTable = useCallback(() => {
    const count = tablesArray.length;
    addTable({
      id: `table-${Date.now()}`,
      name: `new_table_${count + 1}`,
      columns: [
        {
          id: `col-${Date.now()}`,
          name: "id",
          type: "SERIAL",
          isPrimaryKey: true,
          isForeignKey: false,
          isNullable: false,
          isUnique: true,
        },
      ],
      position: {
        x: 100 + (count % 3) * 320,
        y: 100 + Math.floor(count / 3) * 280,
      },
    });
  }, [tablesArray.length, addTable]);

  // ── Score colors ──────────────────────────────────────────────────
  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-green-500";
    if (score >= 40) return "text-yellow-500";
    return "text-red-400";
  };

  const getScoreBarColor = (score: number) => {
    if (score >= 70) return "bg-green-500";
    if (score >= 40) return "bg-yellow-500";
    return "bg-red-400";
  };

  const analysis = currentPromptAnalysis;

  return (
    <aside className="w-[300px] h-full border-r border-border bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 space-y-1 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-medium">Schema Studio</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          AI-assisted database design
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border flex-shrink-0">
        <TabButton
          active={activeTab === "prompt"}
          onClick={() => setActiveTab("prompt")}
          icon={<Brain className="w-3.5 h-3.5" />}
          label="Prompt"
        />
        <TabButton
          active={activeTab === "health"}
          onClick={() => setActiveTab("health")}
          icon={<Activity className="w-3.5 h-3.5" />}
          label="Health"
        />
        <TabButton
          active={activeTab === "history"}
          onClick={() => setActiveTab("history")}
          icon={<History className="w-3.5 h-3.5" />}
          label="History"
        />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* ═══════════════════════════════════════════════════════════ */}
        {/* PROMPT TAB                                                 */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {activeTab === "prompt" && (
          <>
            {/* Description Input */}
            <div className="p-4 space-y-3">
              <label className="text-xs font-medium text-muted-foreground">
                Describe your application
              </label>
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setPreviewTables(null);
                  setRefineResult(null);
                }}
                placeholder="e.g., I'm building an e-commerce store with customers, products, orders, and reviews..."
                className="w-full h-24 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 placeholder:text-muted-foreground/50"
              />

              {/* ── Hybrid Score Display ──────────────────────────── */}
              {analysis && description.trim() && (
                <div className="space-y-2">
                  {/* Combined Score */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Combined Score
                    </span>
                    <span
                      className={`text-xs font-bold ${getScoreColor(analysis.combinedScore)}`}
                    >
                      {analysis.combinedScore}/100
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${getScoreBarColor(analysis.combinedScore)}`}
                      style={{ width: `${analysis.combinedScore}%` }}
                    />
                  </div>

                  {/* Rule vs AI scores side-by-side */}
                  <div className="grid grid-cols-2 gap-2">
                    <ScoreBadge
                      label="Rule Score"
                      score={analysis.ruleScore}
                      max={100}
                    />
                    {analysis.aiScore !== null ? (
                      <ScoreBadge
                        label="AI Score"
                        score={analysis.aiScore}
                        max={100}
                      />
                    ) : (
                      <button
                        onClick={handleAIAnalysis}
                        disabled={isAnalyzingAI}
                        className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-md border border-dashed border-primary/40 text-[10px] text-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
                      >
                        {isAnalyzingAI ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Brain className="w-3 h-3" />
                        )}
                        {isAnalyzingAI ? "Analyzing..." : "Get AI Score"}
                      </button>
                    )}
                  </div>

                  {/* Rule breakdown */}
                  <details className="group">
                    <summary className="text-[10px] text-muted-foreground/60 cursor-pointer hover:text-muted-foreground flex items-center gap-1">
                      <BarChart3 className="w-3 h-3" />
                      Score Breakdown
                      <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
                    </summary>
                    <div className="mt-1.5 space-y-1 pl-4">
                      <BreakdownRow
                        label="Length"
                        score={analysis.ruleBreakdown.length}
                        max={15}
                      />
                      <BreakdownRow
                        label="Entities"
                        score={analysis.ruleBreakdown.entities}
                        max={30}
                      />
                      <BreakdownRow
                        label="Relationships"
                        score={analysis.ruleBreakdown.relationships}
                        max={25}
                      />
                      <BreakdownRow
                        label="Constraints"
                        score={analysis.ruleBreakdown.constraints}
                        max={15}
                      />
                      <BreakdownRow
                        label="Scale"
                        score={analysis.ruleBreakdown.scale}
                        max={8}
                      />
                      <BreakdownRow
                        label="Roles"
                        score={analysis.ruleBreakdown.roles}
                        max={7}
                      />
                    </div>
                  </details>

                  {/* AI breakdown if available */}
                  {analysis.aiBreakdown && (
                    <details className="group">
                      <summary className="text-[10px] text-muted-foreground/60 cursor-pointer hover:text-muted-foreground flex items-center gap-1">
                        <Brain className="w-3 h-3" />
                        AI Breakdown
                        <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
                      </summary>
                      <div className="mt-1.5 space-y-1 pl-4">
                        <BreakdownRow
                          label="Specificity"
                          score={analysis.aiBreakdown.specificity}
                          max={25}
                        />
                        <BreakdownRow
                          label="Rel. Clarity"
                          score={analysis.aiBreakdown.relationshipClarity}
                          max={25}
                        />
                        <BreakdownRow
                          label="Constraints"
                          score={analysis.aiBreakdown.constraintsAndRules}
                          max={25}
                        />
                        <BreakdownRow
                          label="Completeness"
                          score={analysis.aiBreakdown.realWorldCompleteness}
                          max={25}
                        />
                      </div>
                    </details>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={handlePreview}
                  disabled={!description.trim() || isGenerating}
                >
                  <Eye className="w-4 h-4 mr-1.5" />
                  Preview
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={handleGenerateDirect}
                  disabled={!description.trim() || isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Sparkles className="w-4 h-4 mr-1.5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-1.5" />
                      Generate
                    </>
                  )}
                </Button>
              </div>

              {/* ── Improve My Prompt Button ──────────────────────── */}
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                onClick={handleRefinePrompt}
                disabled={!description.trim() || isRefining}
              >
                {isRefining ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Improving...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-3.5 h-3.5" />
                    Improve My Prompt
                  </>
                )}
              </Button>
            </div>

            {/* ── Refinement result ───────────────────────────────── */}
            {refineResult && (
              <>
                <Separator />
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Wand2 className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-medium">
                        Improved Version
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={handleAcceptRefinement}
                        className="p-1 rounded hover:bg-green-500/20"
                        title="Use improved prompt"
                      >
                        <Check className="w-3.5 h-3.5 text-green-500" />
                      </button>
                      <button
                        onClick={() => setRefineResult(null)}
                        className="p-1 rounded hover:bg-destructive/20"
                        title="Dismiss"
                      >
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-foreground">
                    {refineResult.improved}
                  </div>
                  {refineResult.changes.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground font-medium">
                        What changed:
                      </span>
                      {refineResult.changes.map((change, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-1.5 text-[10px] text-muted-foreground"
                        >
                          <ArrowUpRight className="w-3 h-3 mt-0.5 flex-shrink-0 text-green-500" />
                          <span>{change}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={handleAcceptRefinement}
                  >
                    <Check className="w-3.5 h-3.5 mr-1.5" />
                    Use Improved Prompt
                  </Button>
                </div>
              </>
            )}

            {/* ── Preview panel ───────────────────────────────────── */}
            {isPreview && (
              <>
                <Separator />
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-medium">
                        Preview ({previewTables.length} tables)
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={handleAcceptPreview}
                        className="p-1 rounded hover:bg-green-500/20"
                        title="Accept and apply"
                      >
                        <Check className="w-3.5 h-3.5 text-green-500" />
                      </button>
                      <button
                        onClick={handleRejectPreview}
                        className="p-1 rounded hover:bg-destructive/20"
                        title="Discard preview"
                      >
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {previewTables.map((table) => (
                      <div
                        key={table.id}
                        className="px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-xs"
                      >
                        <div className="font-medium text-foreground">
                          {table.name}
                        </div>
                        <div className="text-muted-foreground mt-0.5">
                          {table.columns.length} columns
                          {table.columns
                            .filter((c) => c.isForeignKey)
                            .map((c) => ` · FK→${c.references?.table}`)
                            .join("")}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={handleAcceptPreview}
                    >
                      <Check className="w-3.5 h-3.5 mr-1.5" />
                      Apply Schema
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRejectPreview}
                    >
                      <X className="w-3.5 h-3.5 mr-1.5" />
                      Discard
                    </Button>
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Suggestions (combined rule + AI) */}
            {analysis && analysis.suggestions.length > 0 && (
              <div className="p-4 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-yellow-500" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Suggestions
                  </span>
                </div>
                {analysis.suggestions.map((suggestion, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-xs text-muted-foreground"
                  >
                    <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0 text-primary/60" />
                    <span>{suggestion}</span>
                  </div>
                ))}
                {analysis.aiSuggestions &&
                  analysis.aiSuggestions.length > 0 && (
                    <>
                      <div className="flex items-center gap-1.5 mt-2">
                        <Brain className="w-3.5 h-3.5 text-primary" />
                        <span className="text-xs font-medium text-muted-foreground">
                          AI Suggestions
                        </span>
                      </div>
                      {analysis.aiSuggestions.map((suggestion, i) => (
                        <div
                          key={`ai-${i}`}
                          className="flex items-start gap-2 text-xs text-muted-foreground"
                        >
                          <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0 text-primary" />
                          <span>{suggestion}</span>
                        </div>
                      ))}
                    </>
                  )}
              </div>
            )}

            {/* Detected Entities */}
            {analysis && analysis.detectedEntities.length > 0 && (
              <>
                <Separator />
                <div className="p-4 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground">
                      Detected Entities ({analysis.detectedEntities.length})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.detectedEntities.map((entity) => (
                      <span
                        key={entity}
                        className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium"
                      >
                        {entity}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Detected Relationships */}
            {analysis && analysis.detectedRelationships.length > 0 && (
              <>
                <Separator />
                <div className="p-4 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-xs font-medium text-muted-foreground">
                      Detected Relationships (
                      {analysis.detectedRelationships.length})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.detectedRelationships.map((rel) => (
                      <span
                        key={rel}
                        className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-medium"
                      >
                        {rel}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Prompt Comparison View */}
            <PromptComparisonView />

            <Separator />

            {/* Example Descriptions */}
            <div className="p-4 space-y-2">
              <span className="text-xs font-medium text-muted-foreground">
                Try an example
              </span>
              {exampleDescriptions.map((example, i) => (
                <button
                  key={i}
                  onClick={() => handleExampleClick(example)}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors border border-transparent hover:border-border"
                >
                  {example}
                </button>
              ))}
            </div>

            <Separator />

            {/* Current Tables */}
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Tables ({tablesArray.length})
                </span>
                <button
                  onClick={handleAddTable}
                  className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" />
                  Add Table
                </button>
              </div>
              {tablesArray.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 italic">
                  No tables yet. Describe your app and generate.
                </p>
              ) : (
                tablesArray.map((table) => (
                  <div
                    key={table.id}
                    className="px-3 py-2 rounded-lg bg-muted/30 border border-border text-xs"
                  >
                    <div className="font-medium text-foreground">
                      {table.name}
                    </div>
                    <div className="text-muted-foreground mt-0.5">
                      {table.columns.length} columns
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* HEALTH TAB                                                 */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {activeTab === "health" && <SchemaHealthPanel />}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* HISTORY TAB                                                */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {activeTab === "history" && <VersionHistoryPanel />}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <p className="text-xs text-muted-foreground">Ready</p>
        </div>
      </div>
    </aside>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 ${
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ScoreBadge({
  label,
  score,
  max,
}: {
  label: string;
  score: number;
  max: number;
}) {
  const pct = Math.round((score / max) * 100);
  const color =
    pct >= 70 ? "text-green-500" : pct >= 40 ? "text-yellow-500" : "text-red-400";
  return (
    <div className="flex flex-col items-center justify-center px-2 py-1.5 rounded-md border border-border bg-muted/20">
      <span className={`text-sm font-bold ${color}`}>{score}</span>
      <span className="text-[9px] text-muted-foreground">{label}</span>
    </div>
  );
}

function BreakdownRow({
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
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-20 flex-shrink-0">
        {label}
      </span>
      <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary/60 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground/60 w-8 text-right">
        {score}/{max}
      </span>
    </div>
  );
}
