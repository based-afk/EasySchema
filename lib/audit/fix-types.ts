import type {
  SchemaHealthResult,
  SchemaIssue,
  TableSchema,
  Relationship,
  TableIndex,
} from "@/lib/schema-types";
import type { PerformanceSimulationResult } from "@/lib/audit/performanceSimulation";

export type RiskLevel = "low" | "medium" | "high" | "manual_review";

export interface CanvasSchemaSnapshot {
  tables: TableSchema[];
  relationships: Relationship[];
  indexes: Record<string, TableIndex[]>;
}

export interface AuditContextSnapshot {
  health: SchemaHealthResult;
  performance?: PerformanceSimulationResult;
}

export interface AiFixInput {
  issue: string;
  fix: string;
  sql: string;
  rollback_sql?: string;
  risk?: RiskLevel;
  dependencies?: string[];
  execution_order?: number;
  safe_to_auto_apply?: boolean;
}

export interface PlannedFix {
  id: string;
  issueId?: string;
  issueTitle: string;
  category?: SchemaIssue["category"];
  sql: string;
  rollbackSql: string;
  riskLevel: RiskLevel;
  safeToAutoApply: boolean;
  dependencies: string[];
  executionOrder: number;
  source: "audit" | "performance" | "ai" | "inferred";
  safetyReason?: string;
}

export interface FixPlan {
  fixes: PlannedFix[];
  unsafeFixes: PlannedFix[];
  generatedAt: string;
  schemaSnapshot: CanvasSchemaSnapshot;
  auditSnapshot: AuditContextSnapshot;
}

export interface FixExecutionResult {
  runId: string;
  applied: PlannedFix[];
  failed: Array<{ fix: PlannedFix; error: string }>;
  skipped: PlannedFix[];
}
