import { NextRequest, NextResponse } from "next/server";
import { queryOne, withTransaction } from "@/lib/db";
import { authenticateRequest } from "@/lib/utils/auth";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

// ─── POST /api/projects/[projectId]/schema — save a new schema version ─────

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = authenticateRequest(
      req.headers.get("authorization"),
      req.headers.get("cookie"),
    );
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await params;
    const body = await req.json();
    const {
      name,
      description,
      tables,
      relationships,
      indexes,
      healthScore,
      promptScore,
      promptText,
    } = body;

    // Verify ownership
    const project = await queryOne(
      "SELECT id FROM projects WHERE id = $1 AND user_id = $2",
      [projectId, auth.userId],
    );
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Transaction: get next version number + insert
    const version = await withTransaction(async (client) => {
      const lastVersion = await client.query<{ max_version: number | null }>(
        "SELECT MAX(version_number) AS max_version FROM schema_versions WHERE project_id = $1",
        [projectId],
      );
      const nextVersion = (lastVersion.rows[0]?.max_version ?? 0) + 1;

      const result = await client.query<{
        id: string;
        version_number: number;
        created_at: string;
      }>(
        `INSERT INTO schema_versions
           (project_id, version_number, name, description, tables, relationships, indexes, health_score, prompt_score, prompt_text)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, version_number, created_at`,
        [
          projectId,
          nextVersion,
          name?.trim() ?? `Version ${nextVersion}`,
          description?.trim() ?? null,
          JSON.stringify(tables ?? []),
          JSON.stringify(relationships ?? []),
          JSON.stringify(indexes ?? {}),
          healthScore ?? null,
          promptScore ?? null,
          promptText ?? null,
        ],
      );

      return result.rows[0];
    });

    return NextResponse.json(
      {
        id: version.id,
        projectId,
        versionNumber: version.version_number,
        createdAt: version.created_at,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/projects/[id]/schema error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
