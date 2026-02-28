import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { authenticateRequest } from "@/lib/utils/auth";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

// ─── GET /api/projects/[projectId]/schema/latest — get latest version ──────

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = authenticateRequest(req.headers.get("authorization"));
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await params;

    // Verify ownership
    const project = await queryOne(
      "SELECT id FROM projects WHERE id = $1 AND user_id = $2",
      [projectId, auth.userId],
    );
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const version = await queryOne<{
      id: string;
      version_number: number;
      name: string | null;
      description: string | null;
      tables: unknown;
      relationships: unknown;
      indexes: unknown;
      health_score: number | null;
      prompt_score: number | null;
      prompt_text: string | null;
      created_at: string;
    }>(
      `SELECT id, version_number, name, description, tables, relationships, indexes,
              health_score, prompt_score, prompt_text, created_at
       FROM schema_versions
       WHERE project_id = $1
       ORDER BY version_number DESC
       LIMIT 1`,
      [projectId],
    );

    if (!version) {
      return NextResponse.json(
        { error: "No schema versions found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      id: version.id,
      projectId,
      versionNumber: version.version_number,
      name: version.name,
      description: version.description,
      tables: version.tables,
      relationships: version.relationships,
      indexes: version.indexes,
      healthScore: version.health_score,
      promptScore: version.prompt_score,
      promptText: version.prompt_text,
      createdAt: version.created_at,
    });
  } catch (error) {
    console.error("GET /api/projects/[id]/schema/latest error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
