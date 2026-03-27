import { query, queryOne } from "@/lib/db";
import type { FixExecutionResult, PlannedFix } from "@/lib/audit/fix-types";

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function ensureTables(): Promise<void> {
  await query(
    `CREATE TABLE IF NOT EXISTS audit_fix_runs (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status TEXT NOT NULL,
      schema_snapshot JSONB,
      audit_snapshot JSONB
    );`,
  );

  await query(
    `CREATE TABLE IF NOT EXISTS audit_fix_steps (
      id TEXT PRIMARY KEY,
      run_id TEXT REFERENCES audit_fix_runs(id),
      fix_id TEXT NOT NULL,
      issue_title TEXT NOT NULL,
      sql TEXT NOT NULL,
      rollback_sql TEXT,
      status TEXT NOT NULL,
      error TEXT,
      started_at TIMESTAMPTZ,
      finished_at TIMESTAMPTZ
    );`,
  );
}

export async function createFixRun(
  schemaSnapshot: unknown,
  auditSnapshot: unknown,
): Promise<string> {
  await ensureTables();
  const runId = makeId("run");
  await query(
    `INSERT INTO audit_fix_runs (id, status, schema_snapshot, audit_snapshot)
     VALUES ($1, $2, $3, $4)`,
    [
      runId,
      "running",
      JSON.stringify(schemaSnapshot),
      JSON.stringify(auditSnapshot),
    ],
  );
  return runId;
}

export async function recordFixStep(
  runId: string,
  fix: PlannedFix,
  status: "applied" | "failed" | "skipped",
  error?: string,
): Promise<void> {
  await ensureTables();
  const stepId = makeId("step");
  const now = new Date().toISOString();
  await query(
    `INSERT INTO audit_fix_steps (id, run_id, fix_id, issue_title, sql, rollback_sql, status, error, started_at, finished_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      stepId,
      runId,
      fix.id,
      fix.issueTitle,
      fix.sql,
      fix.rollbackSql,
      status,
      error ?? null,
      now,
      now,
    ],
  );
}

export async function finalizeFixRun(
  runId: string,
  result: FixExecutionResult,
): Promise<void> {
  await ensureTables();
  const status = result.failed.length > 0 ? "partial" : "success";
  await query(`UPDATE audit_fix_runs SET status = $1 WHERE id = $2`, [
    status,
    runId,
  ]);
}

export async function getFixStep(runId: string, fixId: string) {
  await ensureTables();
  return queryOne<{
    rollback_sql: string | null;
    status: string;
  }>(
    `SELECT rollback_sql, status FROM audit_fix_steps
     WHERE run_id = $1 AND fix_id = $2
     ORDER BY finished_at DESC LIMIT 1`,
    [runId, fixId],
  );
}

export async function hasFixBeenApplied(fixId: string): Promise<boolean> {
  await ensureTables();
  const row = await queryOne<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM audit_fix_steps
       WHERE fix_id = $1 AND status = 'applied'
     ) as exists`,
    [fixId],
  );
  return row?.exists ?? false;
}
