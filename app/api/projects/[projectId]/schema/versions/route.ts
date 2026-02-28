import { NextRequest, NextResponse } from "next/server";
import { queryMany, queryOne } from "@/lib/db";
import { authenticateRequest } from "@/lib/utils/auth";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

// ─── GET /api/projects/[projectId]/schema/versions — list all versions ─────

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

    const versions = await queryMany<{
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
       ORDER BY version_number DESC`,
      [projectId],
    );

    return NextResponse.json({
      versions: versions.map((v) => ({
        id: v.id,
        projectId,
        versionNumber: v.version_number,
        name: v.name,
        description: v.description,
        tables: v.tables,
        relationships: v.relationships,
        indexes: v.indexes,
        healthScore: v.health_score,
        promptScore: v.prompt_score,
        promptText: v.prompt_text,
        createdAt: v.created_at,
      })),
    });
  } catch (error) {
    console.error("GET /api/projects/[id]/schema/versions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
