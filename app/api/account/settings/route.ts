import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { authenticateRequest } from "@/lib/utils/auth";
import { validateDisplayName } from "@/lib/utils/validation";

export async function GET(req: NextRequest) {
  try {
    const auth = authenticateRequest(
      req.headers.get("authorization"),
      req.headers.get("cookie"),
    );
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await queryOne<{
      id: string;
      email: string;
      display_name: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, email, display_name, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [auth.userId],
    );

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    });
  } catch (error) {
    console.error("GET /api/account/settings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = authenticateRequest(
      req.headers.get("authorization"),
      req.headers.get("cookie"),
    );
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { displayName } = body as { displayName?: string };

    const nameErr = validateDisplayName(displayName);
    if (nameErr) {
      return NextResponse.json({ errors: [nameErr] }, { status: 400 });
    }

    const updated = await queryOne<{
      id: string;
      email: string;
      display_name: string;
      created_at: string;
      updated_at: string;
    }>(
      `UPDATE users
       SET display_name = $1
       WHERE id = $2
       RETURNING id, email, display_name, created_at, updated_at`,
      [displayName!.trim(), auth.userId],
    );

    if (!updated) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: updated.id,
      email: updated.email,
      displayName: updated.display_name,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    });
  } catch (error) {
    console.error("PATCH /api/account/settings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
