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
  Sparkles,
  ChevronRight,
  Lightbulb,
  Layers,
  Link2,
  Eye,
  Check,
  X,
  Plus,
} from "lucide-react";

const exampleDescriptions = [
  "E-commerce store with users, products, orders, payments, and reviews",
  "Blog platform with users, posts, comments, and categories",
  "Project management tool with teams, projects, tasks, and users",
  "Online school with students, teachers, courses, assignments",
];

export function AssistantSidebar() {
  const tables = useSchemaStore((s) => s.tables);
  const setTables = useSchemaStore((s) => s.setTables);
  const addTable = useSchemaStore((s) => s.addTable);

  const tablesArray = Object.values(tables);

  const [description, setDescription] = useState("");
  const [clarity, setClarity] = useState({
    score: 0,
    suggestions: ["Start by describing what your application does."],
    detectedEntities: [] as string[],
    detectedRelationships: [] as string[],
  });
  const [isGenerating, setIsGenerating] = useState(false);

  // ── Preview mode ──────────────────────────────────────────────────
  const [previewTables, setPreviewTables] = useState<TableSchema[] | null>(
    null,
  );
  const isPreview = previewTables !== null;

  useEffect(() => {
    const result = calculateClarity(description);
    setClarity(result);
  }, [description]);

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

  const getScoreColor = () => {
    if (clarity.score >= 70) return "text-green-500";
    if (clarity.score >= 40) return "text-yellow-500";
    return "text-red-400";
  };

  const getScoreBarColor = () => {
    if (clarity.score >= 70) return "bg-green-500";
    if (clarity.score >= 40) return "bg-yellow-500";
    return "bg-red-400";
  };

  return (
    <aside className="w-[300px] h-full border-r border-border bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 space-y-1 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-medium">Schema Assistant</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Describe your app, preview & generate a schema
        </p>
      </div>

      <Separator />

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
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
            }}
            placeholder="e.g., I'm building an e-commerce store with customers, products, orders, and reviews..."
            className="w-full h-28 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 placeholder:text-muted-foreground/50"
          />

          {/* Clarity Score */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Clarity Score
              </span>
              <span className={`text-xs font-medium ${getScoreColor()}`}>
                {clarity.score}/100
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getScoreBarColor()}`}
                style={{ width: `${clarity.score}%` }}
              />
            </div>
          </div>

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
        </div>

        {/* ── Preview panel ──────────────────────────────────────────── */}
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

        {/* Suggestions */}
        {clarity.suggestions.length > 0 && (
          <div className="p-4 space-y-2">
            <div className="flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-yellow-500" />
              <span className="text-xs font-medium text-muted-foreground">
                Suggestions
              </span>
            </div>
            {clarity.suggestions.map((suggestion, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-xs text-muted-foreground"
              >
                <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0 text-primary/60" />
                <span>{suggestion}</span>
              </div>
            ))}
          </div>
        )}

        {/* Detected Entities */}
        {clarity.detectedEntities.length > 0 && (
          <>
            <Separator />
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">
                  Detected Entities ({clarity.detectedEntities.length})
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {clarity.detectedEntities.map((entity) => (
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
        {clarity.detectedRelationships.length > 0 && (
          <>
            <Separator />
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs font-medium text-muted-foreground">
                  Detected Relationships (
                  {clarity.detectedRelationships.length})
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {clarity.detectedRelationships.map((rel) => (
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
                <div className="font-medium text-foreground">{table.name}</div>
                <div className="text-muted-foreground mt-0.5">
                  {table.columns.length} columns
                </div>
              </div>
            ))
          )}
        </div>
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
