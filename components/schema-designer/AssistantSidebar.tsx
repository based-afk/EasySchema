"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { generateSchemaFromDescription } from "@/lib/schema-utils";
import { TableSchema } from "@/lib/schema-types";
import { useSchemaStore } from "@/lib/schema-store";
import { generateSchemaAI } from "@/lib/prompt-intelligence";
import { SchemaHealthPanel } from "./SchemaHealthPanel";
import { VersionHistoryPanel } from "./VersionHistoryPanel";
import {
  Sparkles,
  Check,
  X,
  Plus,
  Activity,
  History,
  Brain,
} from "lucide-react";
import { VoiceInputButton } from "@/components/voice/VoiceInputButton";

// ─── Tab types ──────────────────────────────────────────────────────────────

type SidebarTab = "prompt" | "health" | "history";

type ProposedTable = {
  name: string;
  columns: { name: string }[];
};

type ProposalSummary = {
  addedTables: string[];
  removedTables: string[];
  updatedTables: Array<{
    table: string;
    addedColumns: string[];
    removedColumns: string[];
  }>;
};

const VALID_COLUMN_TYPES = new Set([
  "INT",
  "BIGINT",
  "SERIAL",
  "TEXT",
  "VARCHAR",
  "BOOLEAN",
  "DATE",
  "TIMESTAMP",
  "FLOAT",
  "DECIMAL",
  "JSON",
  "UUID",
]);

/** Convert AI-generated schema JSON into TableSchema[] the store expects */
function aiResultToTables(
  aiTables: {
    name: string;
    columns: {
      name: string;
      type: string;
      isPrimaryKey: boolean;
      isForeignKey: boolean;
      isNullable: boolean;
      isUnique: boolean;
      defaultValue?: string;
    }[];
  }[],
): TableSchema[] {
  return aiTables.map((t, i) => ({
    id: t.name,
    name: t.name,
    columns: t.columns.map((c, ci) => ({
      id: `col-${i}-${ci}-${Date.now()}`,
      name: c.name,
      type: (VALID_COLUMN_TYPES.has(c.type?.toUpperCase())
        ? c.type.toUpperCase()
        : "VARCHAR") as import("@/lib/schema-types").ColumnType,
      isPrimaryKey: !!c.isPrimaryKey,
      isForeignKey: !!c.isForeignKey,
      isNullable: !!c.isNullable,
      isUnique: !!c.isUnique,
      defaultValue: c.defaultValue,
      ...(c.isForeignKey
        ? {
            references: {
              table: findReferencedTable(
                c.name,
                aiTables.map((tt) => tt.name),
              ),
              column: "id",
            },
          }
        : {}),
    })),
    position: {
      x: 100 + (i % 3) * 350,
      y: 100 + Math.floor(i / 3) * 300,
    },
  }));
}

/** Infer referenced table from FK column name like "user_id" → "users" */
function findReferencedTable(colName: string, tableNames: string[]): string {
  const base = colName.replace(/_id$/, "");
  // Try exact match, then plural
  return (
    tableNames.find((n) => n === base) ??
    tableNames.find((n) => n === base + "s") ??
    tableNames.find((n) => n.startsWith(base)) ??
    base
  );
}

function summarizeProposal(
  currentTables: TableSchema[],
  proposedTables: ProposedTable[],
): ProposalSummary {
  const currentMap = new Map(
    currentTables.map((table) => [table.name.toLowerCase(), table]),
  );
  const proposedMap = new Map(
    proposedTables.map((table) => [table.name.toLowerCase(), table]),
  );

  const addedTables: string[] = [];
  const removedTables: string[] = [];
  const updatedTables: ProposalSummary["updatedTables"] = [];

  for (const [name, table] of proposedMap.entries()) {
    if (!currentMap.has(name)) {
      addedTables.push(table.name);
    }
  }

  for (const [name, table] of currentMap.entries()) {
    if (!proposedMap.has(name)) {
      removedTables.push(table.name);
    }
  }

  for (const [name, proposed] of proposedMap.entries()) {
    const current = currentMap.get(name);
    if (!current) continue;
    const currentCols = new Set(current.columns.map((col) => col.name));
    const proposedCols = new Set(proposed.columns.map((col) => col.name));
    const addedColumns = Array.from(proposedCols).filter(
      (col) => !currentCols.has(col),
    );
    const removedColumns = Array.from(currentCols).filter(
      (col) => !proposedCols.has(col),
    );
    if (addedColumns.length > 0 || removedColumns.length > 0) {
      updatedTables.push({
        table: proposed.name,
        addedColumns,
        removedColumns,
      });
    }
  }

  return {
    addedTables,
    removedTables,
    updatedTables,
  };
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function AssistantSidebar() {
  const searchParams = useSearchParams();
  const tables = useSchemaStore((s) => s.tables);
  const setTables = useSchemaStore((s) => s.setTables);
  const addTable = useSchemaStore((s) => s.addTable);
  const currentPromptAnalysis = useSchemaStore((s) => s.currentPromptAnalysis);

  const tablesArray = Object.values(tables);

  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SidebarTab>("prompt");
  const [description, setDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProposing, setIsProposing] = useState(false);
  const [proposal, setProposal] = useState<{
    tables: ProposedTable[];
  } | null>(null);
  const [proposalSummary, setProposalSummary] =
    useState<ProposalSummary | null>(null);
  const [proposalError, setProposalError] = useState<string | null>(null);
  const appliedBlueprintRef = useRef(false);

  // ── Schema Generation ─────────────────────────────────────────────

  const generateFromPrompt = useCallback(
    async (promptText: string) => {
      if (!promptText.trim()) return;
      setIsGenerating(true);
      try {
        // Try AI-powered generation first
        const aiResult = await generateSchemaAI(promptText);
        if (!aiResult.error && aiResult.tables.length > 0) {
          console.log(
            "Generate: using AI result",
            aiResult.tables.length,
            "tables",
          );
          const tables = aiResultToTables(aiResult.tables);
          setTables(tables);
        } else {
          // Fall back to local keyword matcher
          console.log("Generate: falling back to local generation");
          const generated = generateSchemaFromDescription(promptText);
          setTables(generated);
        }
      } catch (err) {
        console.error("handleGenerateDirect error:", err);
        // Last-resort fallback
        try {
          const generated = generateSchemaFromDescription(promptText);
          setTables(generated);
        } catch (fallbackErr) {
          console.error("Local generate also failed:", fallbackErr);
        }
      } finally {
        setIsGenerating(false);
      }
    },
    [setTables],
  );

  const handleGenerateDirect = useCallback(async () => {
    await generateFromPrompt(description);
  }, [description, generateFromPrompt]);

  const handleProposeChanges = useCallback(async () => {
    if (!description.trim()) return;
    setIsProposing(true);
    setProposal(null);
    setProposalSummary(null);
    setProposalError(null);
    try {
      const aiResult = await generateSchemaAI(description);
      if (!aiResult.error && aiResult.tables.length > 0) {
        setProposal({ tables: aiResult.tables });
        setProposalSummary(summarizeProposal(tablesArray, aiResult.tables));
      } else {
        setProposalError(
          "AI proposal unavailable. Check your API key or AI service config.",
        );
      }
    } catch (err) {
      console.error("handleProposeChanges error:", err);
      setProposalError(
        "AI proposal failed. Check your API key or retry in a moment.",
      );
    } finally {
      setIsProposing(false);
    }
  }, [description, tablesArray]);

  useEffect(() => {
    if (appliedBlueprintRef.current) return;
    const blueprintPrompt = searchParams.get("blueprintPrompt")?.trim();
    if (!blueprintPrompt) return;
    const room = searchParams.get("room")?.trim();
    if (room) {
      appliedBlueprintRef.current = true;
      const params = new URLSearchParams(searchParams.toString());
      params.delete("blueprintPrompt");
      router.replace(`/Dashboard/canvas?${params.toString()}`);
      return;
    }
    const hasTables = tablesArray.length > 0;
    appliedBlueprintRef.current = true;
    setDescription(blueprintPrompt);
    if (!hasTables) {
      void (async () => {
        await generateFromPrompt(blueprintPrompt);
        setDescription("");
      })();
      return;
    }
    setDescription("");
  }, [generateFromPrompt, searchParams, tablesArray.length]);

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
        {currentPromptAnalysis && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>Prompt score</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${getScorePillColor(currentPromptAnalysis.combinedScore)}`}
            >
              {currentPromptAnalysis.combinedScore}
            </span>
          </div>
        )}
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
                Modify your application
              </label>
              <p className="text-[10px] text-muted-foreground/70">
                Describe the changes you want. Use Propose to preview changes or
                Apply Now to apply immediately.
              </p>
              <VoiceInputButton
                onTranscript={(text) =>
                  setDescription((prev) =>
                    prev.trim() ? `${prev} ${text}` : text,
                  )
                }
              />
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                }}
                placeholder="Describe changes or new requirements for your schema..."
                className="w-full h-24 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 placeholder:text-muted-foreground/50"
              />

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={handleProposeChanges}
                  disabled={!description.trim() || isProposing}
                >
                  {isProposing ? (
                    <>
                      <Brain className="w-4 h-4 mr-1.5 animate-pulse" />
                      Proposing...
                    </>
                  ) : (
                    <>
                      <Brain className="w-4 h-4 mr-1.5" />
                      Propose
                    </>
                  )}
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
                      Applying...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-1.5" />
                      Apply Now
                    </>
                  )}
                </Button>
              </div>
            </div>

            {(proposalSummary || proposalError || isProposing) && (
              <>
                <Separator />
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Brain className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-medium">
                        AI Proposed Changes
                      </span>
                    </div>
                    {proposal && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            if (!proposal) return;
                            const tables = aiResultToTables(proposal.tables);
                            setTables(tables);
                            setProposal(null);
                            setProposalSummary(null);
                          }}
                          className="p-1 rounded hover:bg-green-500/20"
                          title="Apply changes"
                        >
                          <Check className="w-3.5 h-3.5 text-green-500" />
                        </button>
                        <button
                          onClick={() => {
                            setProposal(null);
                            setProposalSummary(null);
                          }}
                          className="p-1 rounded hover:bg-destructive/20"
                          title="Dismiss"
                        >
                          <X className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    )}
                  </div>

                  {proposalError && (
                    <p className="text-xs text-destructive/80">
                      {proposalError}
                    </p>
                  )}

                  {proposalSummary && proposal && (
                    <div className="space-y-3 text-xs text-muted-foreground">
                      {proposalSummary.addedTables.length === 0 &&
                        proposalSummary.removedTables.length === 0 &&
                        proposalSummary.updatedTables.length === 0 && (
                          <div>No table changes detected.</div>
                        )}

                      {proposalSummary.addedTables.length > 0 && (
                        <div className="space-y-1">
                          <span className="font-medium text-foreground">
                            Added tables
                          </span>
                          {proposal.tables
                            .filter((table) =>
                              proposalSummary.addedTables.includes(table.name),
                            )
                            .map((table) => (
                              <div
                                key={`add-${table.name}`}
                                className="rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-2"
                              >
                                <div className="font-medium text-foreground">
                                  {table.name}
                                </div>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {table.columns.map((column) => (
                                    <span
                                      key={`${table.name}-${column.name}`}
                                      className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] text-green-500"
                                    >
                                      + {column.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                        </div>
                      )}

                      {proposalSummary.removedTables.length > 0 && (
                        <div className="space-y-1">
                          <span className="font-medium text-foreground">
                            Removed tables
                          </span>
                          {tablesArray
                            .filter((table) =>
                              proposalSummary.removedTables.includes(
                                table.name,
                              ),
                            )
                            .map((table) => (
                              <div
                                key={`remove-${table.name}`}
                                className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2"
                              >
                                <div className="font-medium text-foreground">
                                  {table.name}
                                </div>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {table.columns.map((column) => (
                                    <span
                                      key={`${table.name}-${column.name}`}
                                      className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] text-red-400"
                                    >
                                      - {column.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                        </div>
                      )}

                      {proposalSummary.updatedTables.length > 0 && (
                        <div className="space-y-1">
                          <span className="font-medium text-foreground">
                            Updated tables
                          </span>
                          {proposalSummary.updatedTables.map((update) => {
                            const proposedTable = proposal.tables.find(
                              (table) => table.name === update.table,
                            );
                            const currentTable = tablesArray.find(
                              (table) => table.name === update.table,
                            );
                            if (!proposedTable || !currentTable) return null;
                            const added = new Set(update.addedColumns);
                            const removed = new Set(update.removedColumns);
                            return (
                              <div
                                key={`update-${update.table}`}
                                className="rounded-lg border border-border bg-muted/30 px-3 py-2"
                              >
                                <div className="font-medium text-foreground">
                                  {update.table}
                                </div>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {update.addedColumns.map((column) => (
                                    <span
                                      key={`${update.table}-${column}-add`}
                                      className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] text-green-500"
                                    >
                                      + {column}
                                    </span>
                                  ))}
                                  {update.removedColumns.map((column) => (
                                    <span
                                      key={`${update.table}-${column}-remove`}
                                      className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] text-red-400"
                                    >
                                      - {column}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {proposal && (
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        const tables = aiResultToTables(proposal.tables);
                        setTables(tables);
                        setProposal(null);
                        setProposalSummary(null);
                      }}
                    >
                      <Check className="w-3.5 h-3.5 mr-1.5" />
                      Apply Proposed Changes
                    </Button>
                  )}
                </div>
              </>
            )}

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

function getScorePillColor(score: number) {
  if (score >= 70) return "bg-green-500/10 text-green-500";
  if (score >= 40) return "bg-yellow-500/10 text-yellow-500";
  return "bg-red-500/10 text-red-500";
}
