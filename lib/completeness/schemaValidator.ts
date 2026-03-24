// ─── Completeness Validator — Ensure all requested tables are generated ──────
//
// Compares user-requested entities against AI-generated tables.
// Flags missing tables and optionally triggers regeneration with corrections.
// ─────────────────────────────────────────────────────────────────────────────

import { extractRequiredEntities, extractEntities } from "./entityExtractor";
import type { SchemaNode } from "@/lib/ai/types";

export interface CompletenessReport {
  isComplete: boolean;
  requestedEntities: string[];
  generatedTables: string[];
  missingTables: string[];
  unexpectedTables: string[];
  matchPercentage: number;
}

/**
 * Validate that generated schema includes all requested entities
 */
export function validateCompletenessOfSchema(
  originalPrompt: string,
  generatedNodes: SchemaNode[],
): CompletenessReport {
  // Extract what the user asked for
  const requestedEntities = extractRequiredEntities(originalPrompt);

  // Extract what was actually generated
  const generatedTables = extractTableNamesFromNodes(generatedNodes);

  // Find missing and extra tables
  const missingTables = findMissing(requestedEntities, generatedTables);
  const unexpectedTables = findExtra(requestedEntities, generatedTables);

  // Calculate match percentage
  const matchPercentage =
    requestedEntities.length > 0
      ? ((requestedEntities.length - missingTables.length) /
          requestedEntities.length) *
        100
      : 100;

  return {
    isComplete: missingTables.length === 0,
    requestedEntities,
    generatedTables,
    missingTables,
    unexpectedTables,
    matchPercentage,
  };
}

/**
 * Extract table names from ReactFlow nodes
 */
export function extractTableNamesFromNodes(nodes: SchemaNode[]): string[] {
  return nodes
    .filter((node) => node.type === "tableNode")
    .map((node) => normalizeTableName(node.id))
    .filter((name): name is string => name !== null);
}

/**
 * Normalize a table name for comparison
 */
function normalizeTableName(name: string | undefined): string | null {
  if (!name) return null;

  // Remove underscores, convert to lowercase, singularize
  const normalized = name.toLowerCase().replace(/_/g, "").replace(/s$/, ""); // Simple singularization

  return normalized.length > 0 ? normalized : null;
}

/**
 * Find entities requested but not generated
 */
function findMissing(requested: string[], generated: string[]): string[] {
  const normalizedGenerated = new Set(
    generated
      .map((t) => normalizeTableName(t))
      .filter((t): t is string => t !== null),
  );

  return requested.filter((entity) => {
    const normalized = normalizeTableName(entity);
    return normalized === null || !normalizedGenerated.has(normalized);
  });
}

/**
 * Find tables generated that weren't requested (may be auxiliary/support tables)
 */
function findExtra(requested: string[], generated: string[]): string[] {
  const normalizedRequested = new Set(
    requested
      .map((e) => normalizeTableName(e))
      .filter((e): e is string => e !== null),
  );

  return generated.filter((table) => {
    const normalized = normalizeTableName(table);
    return (
      normalized &&
      !normalizedRequested.has(normalized) &&
      !isAuxiliaryTable(table)
    );
  });
}

/**
 * Check if a table is an auxiliary/support table (not a user-requested entity)
 */
function isAuxiliaryTable(tableName: string): boolean {
  const auxiliary = [
    // Linking tables for many-to-many relationships
    "association",
    "junction",
    "mapping",
    "link",
    "relationship",
    "_",
    // Support tables
    "history",
    "audit",
    "log",
    "cache",
    "session",
    "token",
    "queue",
    "notification",
    "email",
    "preference",
    "setting",
  ];

  const normalized = normalizeTableName(tableName);
  return auxiliary.some((aux) => normalized?.includes(aux));
}

/**
 * Generate a detailed report for the user
 */
export function formatCompletenessReport(report: CompletenessReport): string {
  const lines: string[] = [];

  lines.push(`\n✅ **Schema Completeness Report**\n`);
  lines.push(`📊 Match Rate: **${report.matchPercentage.toFixed(0)}%**\n`);

  if (report.isComplete) {
    lines.push(`✓ **All requested entities found!**`);
  } else {
    lines.push(`⚠ **Missing ${report.missingTables.length} table(s):**`);
    report.missingTables.forEach((table) => {
      lines.push(`  - ${table}`);
    });
  }

  if (report.unexpectedTables.length > 0) {
    lines.push(`\n📝 Additional tables (automatically added):`);
    report.unexpectedTables.forEach((table) => {
      lines.push(`  - ${table}`);
    });
  }

  lines.push(`\n**Requested Entities (${report.requestedEntities.length}):**`);
  lines.push(report.requestedEntities.map((e) => `  - ${e}`).join("\n"));

  lines.push(`\n**Generated Tables (${report.generatedTables.length}):**`);
  lines.push(report.generatedTables.map((t) => `  - ${t}`).join("\n"));

  return lines.join("\n");
}

/**
 * Suggest a corrective prompt to fix missing tables
 */
export function generateCorrectivePrompt(
  originalPrompt: string,
  report: CompletenessReport,
): string {
  if (report.isComplete) {
    return originalPrompt; // No correction needed
  }

  const missing = report.missingTables;
  let corrective = originalPrompt;

  // Add explicit reminder about missing tables
  corrective += `\n\n🔴 **CRITICAL**: The previous schema was missing these required tables:`;
  missing.forEach((table) => {
    corrective += `\n- ${table}`;
  });

  corrective += `\n\nPlease MUST include these tables in your regenerated schema. Do not skip any of them.`;
  corrective += `\n\nHere are the tables that MUST be present in the final schema:`;
  report.requestedEntities.forEach((entity) => {
    corrective += `\n- ${entity}`;
  });

  return corrective;
}

/**
 * Create a side-by-side comparison for debugging
 */
export function createComparisonTable(report: CompletenessReport): string {
  const maxRows = Math.max(
    report.requestedEntities.length,
    report.generatedTables.length,
  );
  const lines: string[] = [];

  lines.push("| Requested Entity | Generated Table | Status |");
  lines.push("|---|---|---|");

  for (let i = 0; i < maxRows; i++) {
    const entity = report.requestedEntities[i] || "-";
    const table = report.generatedTables[i] || "-";
    const status =
      report.requestedEntities[i] && report.generatedTables[i]
        ? "✓"
        : report.requestedEntities[i] && !report.generatedTables[i]
          ? "✗ MISSING"
          : report.generatedTables[i]
            ? "✓ EXTRA"
            : "-";

    lines.push(`| ${entity} | ${table} | ${status} |`);
  }

  return lines.join("\n");
}
