import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { authenticateRequest } from "@/lib/utils/auth";
import { runAndSaveAudit } from "@/lib/audit";

// ─── POST /api/audit/run — run health audit on a saved schema version ──────

export async function POST(req: NextRequest) {
  try {
    const auth = authenticateRequest(
      req.headers.get("authorization"),
      req.headers.get("cookie"),
    );
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { schemaVersionId } = body;

    if (!schemaVersionId) {
      return NextResponse.json(
        { error: "Missing 'schemaVersionId'" },
        { status: 400 },
      );
    }

    // Fetch the schema version + verify ownership
    const version = await queryOne<{
      id: string;
      tables: unknown;
      relationships: unknown;
      indexes: unknown;
    }>(
      `SELECT sv.id, sv.tables, sv.relationships, sv.indexes
       FROM schema_versions sv
       JOIN projects p ON p.id = sv.project_id
       WHERE sv.id = $1 AND p.user_id = $2`,
      [schemaVersionId, auth.userId],
    );

    if (!version) {
      return NextResponse.json(
        { error: "Schema version not found" },
        { status: 404 },
      );
    }

    // Run the audit engine + persist
    const auditResult = await runAndSaveAudit(
      version.id,
      version.tables as Parameters<typeof runAndSaveAudit>[1],
      version.relationships as Parameters<typeof runAndSaveAudit>[2],
      (version.indexes ?? {}) as Parameters<typeof runAndSaveAudit>[3],
    );

    // Also update the health_score on the schema version row
    await queryOne(
      "UPDATE schema_versions SET health_score = $1 WHERE id = $2",
      [auditResult.totalScore, version.id],
    );

    return NextResponse.json(auditResult, { status: 201 });
  } catch (error) {
    console.error("POST /api/audit/run error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
