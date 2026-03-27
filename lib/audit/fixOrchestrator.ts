import type {
  CanvasSchemaSnapshot,
  FixExecutionResult,
  PlannedFix,
} from "@/lib/audit/fix-types";
import { analyzeSqlSafety } from "@/lib/audit/sqlSafety";
import { withTransaction } from "@/lib/db";
import {
  createFixRun,
  finalizeFixRun,
  recordFixStep,
  hasFixBeenApplied,
} from "@/lib/audit/fixStore";

function splitStatements(sql: string): string[] {
  return sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function executeSqlStatements(
  statements: string[],
  client: { query: (text: string) => Promise<unknown> },
) {
  for (const stmt of statements) {
    await client.query(stmt);
  }
}

export async function applyFixes(
  fixes: PlannedFix[],
  schemaSnapshot: CanvasSchemaSnapshot,
  auditSnapshot: unknown,
): Promise<FixExecutionResult> {
  const runId = await createFixRun(schemaSnapshot, auditSnapshot);
  const applied: PlannedFix[] = [];
  const failed: Array<{ fix: PlannedFix; error: string }> = [];
  const skipped: PlannedFix[] = [];

  for (const fix of fixes) {
    if (await hasFixBeenApplied(fix.id)) {
      skipped.push(fix);
      await recordFixStep(runId, fix, "skipped", "Fix already applied");
      continue;
    }
    const safety = analyzeSqlSafety(fix.sql);
    if (!safety.safe || fix.riskLevel === "manual_review") {
      skipped.push(fix);
      await recordFixStep(runId, fix, "skipped", safety.reason);
      continue;
    }

    try {
      await withTransaction(async (client) => {
        await executeSqlStatements(splitStatements(fix.sql), client);
      });
      applied.push(fix);
      await recordFixStep(runId, fix, "applied");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      failed.push({ fix, error: message });
      await recordFixStep(runId, fix, "failed", message);
    }
  }

  const result = { runId, applied, failed, skipped };
  await finalizeFixRun(runId, result);
  return result;
}

export async function applySafeFixes(
  fixes: PlannedFix[],
  schemaSnapshot: CanvasSchemaSnapshot,
  auditSnapshot: unknown,
): Promise<FixExecutionResult> {
  const safe = fixes.filter(
    (fix) => fix.safeToAutoApply && fix.riskLevel === "low",
  );
  return applyFixes(safe, schemaSnapshot, auditSnapshot);
}

export async function rollbackFix(
  runId: string,
  fix: PlannedFix,
): Promise<{ success: boolean; error?: string }> {
  if (!fix.rollbackSql?.trim()) {
    return { success: false, error: "Rollback SQL not available" };
  }

  try {
    await withTransaction(async (client) => {
      await executeSqlStatements(splitStatements(fix.rollbackSql), client);
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
