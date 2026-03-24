import { NextRequest, NextResponse } from "next/server";
import { queryOne, query } from "@/lib/db";
import { authenticateRequest } from "@/lib/utils/auth";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

// ─── GET /api/projects/[projectId] — get project details ───────────────────

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = authenticateRequest(
      req.headers.get("authorization"),
      req.headers.get("cookie"),
    );
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await params;

    const project = await queryOne<{
      id: string;
      name: string;
      description: string | null;
      created_at: string;
      updated_at: string;
    }>(
      "SELECT id, name, description, created_at, updated_at FROM projects WHERE id = $1 AND user_id = $2",
      [projectId, auth.userId],
    );

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: project.id,
      name: project.name,
      description: project.description,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    });
  } catch (error) {
    console.error("GET /api/projects/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ─── PATCH /api/projects/[projectId] — update project ──────────────────────

export async function PATCH(req: NextRequest, { params }: RouteParams) {
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
    const { name, description } = body;

    // Build dynamic SET clause
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (name !== undefined) {
      sets.push(`name = $${idx++}`);
      values.push(name.trim());
    }
    if (description !== undefined) {
      sets.push(`description = $${idx++}`);
      values.push(description?.trim() ?? null);
    }

    if (sets.length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      );
    }

    values.push(projectId, auth.userId);

    const project = await queryOne<{
      id: string;
      name: string;
      description: string | null;
      updated_at: string;
    }>(
      `UPDATE projects SET ${sets.join(", ")}
       WHERE id = $${idx++} AND user_id = $${idx}
       RETURNING id, name, description, updated_at`,
      values,
    );

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: project.id,
      name: project.name,
      description: project.description,
      updatedAt: project.updated_at,
    });
  } catch (error) {
    console.error("PATCH /api/projects/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ─── DELETE /api/projects/[projectId] ──────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = authenticateRequest(
      req.headers.get("authorization"),
      req.headers.get("cookie"),
    );
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await params;

    const result = await query(
      "DELETE FROM projects WHERE id = $1 AND user_id = $2",
      [projectId, auth.userId],
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("DELETE /api/projects/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
