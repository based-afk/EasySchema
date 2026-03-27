// ─── Audit Module ────────────────────────────────────────────────────────────
//
// Re-exports the existing rule engine + adds DB persistence for audit results.
// This is the single entry point routes use for "run audit" operations.
// ─────────────────────────────────────────────────────────────────────────────

import { query, queryOne } from "../db";
import {
  computeSchemaHealth,
  getTableIssues,
  healthScoreLabel,
  healthScoreColor,
  healthScoreBgColor,
} from "../schema-health";
import { buildFixPlan } from "@/lib/audit/fixPlanner";
import {
  applyFixes,
  applySafeFixes,
  rollbackFix,
} from "@/lib/audit/fixOrchestrator";
import {
  simulateAuditPerformance,
  type PerformanceSimulationResult,
} from "./performanceSimulation";

import type {
  TableSchema,
  Relationship,
  TableIndex,
  SchemaHealthResult,
} from "../schema-types";

// ─── Re-export rule engine for convenience ──────────────────────────────────
export {
  computeSchemaHealth,
  getTableIssues,
  healthScoreLabel,
  healthScoreColor,
  healthScoreBgColor,
  simulateAuditPerformance,
  buildFixPlan,
  applyFixes,
  applySafeFixes,
  rollbackFix,
};

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SavedAuditResult {
  id: string;
  schemaVersionId: string;
  totalScore: number;
  maxScore: number;
  breakdown: SchemaHealthResult["breakdown"];
  allIssues: SchemaHealthResult["allIssues"];
  performanceSimulation?: PerformanceSimulationResult;
  createdAt: string;
}

// ─── Run audit and persist ──────────────────────────────────────────────────

export async function runAndSaveAudit(
  schemaVersionId: string,
  tables: TableSchema[],
  relationships: Relationship[],
  indexes: Record<string, TableIndex[]> = {},
): Promise<SavedAuditResult> {
  // Compute health locally via rule engine
  const result = computeSchemaHealth(tables, relationships, indexes);
  const performanceSimulation = simulateAuditPerformance(
    tables,
    relationships,
    indexes,
  );

  // Persist to DB
  const row = await queryOne<{
    id: string;
    created_at: string;
  }>(
    `INSERT INTO audit_results (schema_version_id, total_score, max_score, breakdown, all_issues)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, created_at`,
    [
      schemaVersionId,
      result.totalScore,
      result.maxScore,
      JSON.stringify(result.breakdown),
      JSON.stringify(result.allIssues),
    ],
  );

  return {
    id: row!.id,
    schemaVersionId,
    totalScore: result.totalScore,
    maxScore: result.maxScore,
    breakdown: result.breakdown,
    allIssues: result.allIssues,
    performanceSimulation,
    createdAt: row!.created_at,
  };
}

// ─── Get latest audit for a schema version ──────────────────────────────────

export async function getLatestAudit(
  schemaVersionId: string,
): Promise<SavedAuditResult | null> {
  const row = await queryOne<{
    id: string;
    schema_version_id: string;
    total_score: number;
    max_score: number;
    breakdown: SchemaHealthResult["breakdown"];
    all_issues: SchemaHealthResult["allIssues"];
    created_at: string;
  }>(
    `SELECT id, schema_version_id, total_score, max_score, breakdown, all_issues, created_at
     FROM audit_results
     WHERE schema_version_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [schemaVersionId],
  );

  if (!row) return null;

  return {
    id: row.id,
    schemaVersionId: row.schema_version_id,
    totalScore: row.total_score,
    maxScore: row.max_score,
    breakdown: row.breakdown,
    allIssues: row.all_issues,
    createdAt: row.created_at,
  };
}

// ─── Get audit history for a project ────────────────────────────────────────

export async function getAuditHistory(
  projectId: string,
): Promise<SavedAuditResult[]> {
  const rows = await query<{
    id: string;
    schema_version_id: string;
    total_score: number;
    max_score: number;
    breakdown: SchemaHealthResult["breakdown"];
    all_issues: SchemaHealthResult["allIssues"];
    created_at: string;
  }>(
    `SELECT ar.id, ar.schema_version_id, ar.total_score, ar.max_score, ar.breakdown, ar.all_issues, ar.created_at
     FROM audit_results ar
     JOIN schema_versions sv ON sv.id = ar.schema_version_id
     WHERE sv.project_id = $1
     ORDER BY ar.created_at DESC`,
    [projectId],
  );

  return rows.rows.map((row) => ({
    id: row.id,
    schemaVersionId: row.schema_version_id,
    totalScore: row.total_score,
    maxScore: row.max_score,
    breakdown: row.breakdown,
    allIssues: row.all_issues,
    createdAt: row.created_at,
  }));
}
