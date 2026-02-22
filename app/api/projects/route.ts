import { NextRequest, NextResponse } from "next/server";
import { queryOne, queryMany } from "@/lib/db";
import { authenticateRequest } from "@/lib/utils/auth";
import { validateProjectName } from "@/lib/utils/validation";

// ─── GET /api/projects — list user's projects ──────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const auth = authenticateRequest(req.headers.get("authorization"));
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projects = await queryMany<{
      id: string;
      name: string;
      description: string | null;
      created_at: string;
      updated_at: string;
      version_count: string;
    }>(
      `SELECT p.id, p.name, p.description, p.created_at, p.updated_at,
              COUNT(sv.id)::TEXT AS version_count
       FROM projects p
       LEFT JOIN schema_versions sv ON sv.project_id = p.id
       WHERE p.user_id = $1
       GROUP BY p.id
       ORDER BY p.updated_at DESC`,
      [auth.userId],
    );

    return NextResponse.json({
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        versionCount: parseInt(p.version_count, 10),
      })),
    });
  } catch (error) {
    console.error("GET /api/projects error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ─── POST /api/projects — create a new project ─────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const auth = authenticateRequest(req.headers.get("authorization"));
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, description } = body;

    const nameErr = validateProjectName(name);
    if (nameErr) {
      return NextResponse.json({ errors: [nameErr] }, { status: 400 });
    }

    const project = await queryOne<{
      id: string;
      name: string;
      description: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `INSERT INTO projects (user_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, created_at, updated_at`,
      [auth.userId, name.trim(), description?.trim() ?? null],
    );

    if (!project) {
      return NextResponse.json(
        { error: "Failed to create project" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        id: project.id,
        name: project.name,
        description: project.description,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
        versionCount: 0,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/projects error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
