// ─── Frontend Integration Guide: Displaying Completeness Information ──────────
//
// How to show schema completeness warnings and auto-correction status to users
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import type { GenerateResult } from "@/lib/ai/aiService";
import type { SchemaNode, SchemaEdge } from "@/lib/ai/types";

type CompletenessData = NonNullable<
  NonNullable<GenerateResult["meta"]>["completeness"]
>;

/**
 * EXAMPLE 1: Completeness Indicator Component
 *
 * Show a badge/alert warning if schema is incomplete
 */

interface CompletenessIndicatorProps {
  result: GenerateResult;
  onRefine?: () => void;
}

export function CompletenessIndicator({
  result,
  onRefine,
}: CompletenessIndicatorProps) {
  const completeness = result.meta?.completeness;

  if (!completeness) return null;

  if (completeness.isComplete) {
    return (
      <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
        <span>✅ Schema Complete</span>
        <span className="text-xs text-green-600">
          All {completeness.requestedEntities.length} requested entities
          generated
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
        <span>⚠️ Schema Incomplete</span>
        <span className="font-semibold">
          {completeness.matchPercentage.toFixed(0)}% (
          {completeness.generatedTables.length}/
          {completeness.requestedEntities.length} tables)
        </span>
        {(completeness.correctionAttempts ?? 0) > 0 && (
          <span className="text-xs text-yellow-600 ml-auto">
            ({completeness.correctionAttempts} auto-correction attempt)
          </span>
        )}
      </div>

      {completeness.missingTables.length > 0 && (
        <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
          <p className="font-semibold text-yellow-800 mb-1">Missing tables:</p>
          <ul className="list-disc list-inside space-y-1">
            {completeness.missingTables.map((table) => (
              <li key={table} className="text-yellow-700">
                {table}
              </li>
            ))}
          </ul>
          <p className="text-xs text-yellow-600 mt-2">
            💡 Refine your prompt to include these entities or add them
            manually.
          </p>
          {onRefine && (
            <button
              onClick={onRefine}
              className="mt-2 px-3 py-1 bg-yellow-600 text-white rounded text-xs hover:bg-yellow-700"
            >
              Refine Prompt
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * EXAMPLE 2: Hook for managing completeness check state
 */

export function useCompletenessCheck(generateResult: GenerateResult | null) {
  const [showCompletenessReport, setShowCompletenessReport] =
    React.useState(false);

  const handleGenerateComplete = (result: GenerateResult) => {
    const completeness = result.meta?.completeness;

    if (completeness && !completeness.isComplete) {
      setShowCompletenessReport(true);
      console.warn(
        `⚠️ Schema ${completeness.matchPercentage.toFixed(0)}% complete. Missing: ${completeness.missingTables.join(", ")}`,
      );
    }
  };

  return {
    showCompletenessReport,
    setShowCompletenessReport,
    handleGenerateComplete,
  };
}

/**
 * EXAMPLE 3: Show completeness notification
 */

export function showCompletenessNotification(completeness?: CompletenessData) {
  if (!completeness) return;

  if (completeness.isComplete) {
    console.log(
      `✅ Schema Complete - All ${completeness.requestedEntities.length} tables generated`,
    );
  } else {
    console.warn(
      `⚠️ Schema ${completeness.matchPercentage.toFixed(0)}% complete\n` +
        `Missing: ${completeness.missingTables.join(", ")}\n` +
        `(${completeness.generatedTables.length}/${completeness.requestedEntities.length} tables)`,
    );
  }
}

/**
 * EXAMPLE 4: Export schema with completeness report
 */

export function buildSchemaExportWithCompleteness(
  nodes: SchemaNode[],
  edges: SchemaEdge[],
  completeness?: CompletenessData,
): {
  schema: { nodes: SchemaNode[]; edges: SchemaEdge[] };
  completenessReport?: string;
} {
  let completenessReport: string | undefined = undefined;

  if (completeness) {
    completenessReport = `
# Schema Completeness Report

**Status**: ${completeness.isComplete ? "✅ COMPLETE" : "⚠️ INCOMPLETE"}
**Match Rate**: ${completeness.matchPercentage.toFixed(0)}% (${completeness.generatedTables.length}/${completeness.requestedEntities.length} tables)

## Requested Entities
${completeness.requestedEntities.map((e) => `- ${e}`).join("\n")}

## Generated Tables
${completeness.generatedTables.map((t) => `- ${t}`).join("\n")}

${
  completeness.missingTables.length > 0
    ? `## Missing Tables\n${completeness.missingTables.map((t) => `- ${t}`).join("\n")}`
    : ""
}

${
  (completeness.correctionAttempts ?? 0) > 0
    ? `## System Notes\n- Auto-correction attempts: ${completeness.correctionAttempts}\n- See AI logs for correction prompts`
    : ""
}
    `.trim();
  }

  return {
    schema: { nodes, edges },
    completenessReport,
  };
}

/**
 * EXAMPLE 5: Mock helper for testing
 */

export function mockGenerateResultWithCompleteness(
  tableNames: string[],
  requestedEntities: string[],
  isCorrected: boolean = false,
): GenerateResult {
  return {
    nodes: tableNames.map((name) => ({
      id: name,
      type: "tableNode" as const,
      position: { x: 0, y: 0 },
      data: {
        label: name.charAt(0).toUpperCase() + name.slice(1),
        columns: [],
      },
    })),
    edges: [],
    meta: {
      cacheHit: false,
      completeness: {
        isComplete: tableNames.length === requestedEntities.length,
        requestedEntities,
        generatedTables: tableNames,
        missingTables: requestedEntities.filter(
          (e) =>
            !tableNames.map((t) => t.toLowerCase()).includes(e.toLowerCase()),
        ),
        matchPercentage: (tableNames.length / requestedEntities.length) * 100,
        correctionAttempts: isCorrected ? 1 : 0,
      },
    },
  };
}

export default {
  CompletenessIndicator,
  useCompletenessCheck,
  showCompletenessNotification,
  buildSchemaExportWithCompleteness,
  mockGenerateResultWithCompleteness,
};
