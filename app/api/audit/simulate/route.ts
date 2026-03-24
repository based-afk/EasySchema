import { NextRequest, NextResponse } from "next/server";
import { computeSchemaHealth } from "@/lib/schema-health";
import { simulateAuditPerformance } from "@/lib/audit";
import type { Relationship, TableIndex, TableSchema } from "@/lib/schema-types";
import { authenticateRequest } from "@/lib/utils/auth";

export async function POST(req: NextRequest) {
  try {
    const auth = authenticateRequest(
      req.headers.get("authorization"),
      req.headers.get("cookie"),
    );
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      tables?: TableSchema[];
      relationships?: Relationship[];
      indexes?: Record<string, TableIndex[]>;
    };

    const tables = body.tables ?? [];
    const relationships = body.relationships ?? [];
    const indexes = body.indexes ?? {};

    const health = computeSchemaHealth(tables, relationships, indexes);
    const performanceSimulation = simulateAuditPerformance(
      tables,
      relationships,
      indexes,
    );

    return NextResponse.json({
      health,
      performanceSimulation,
    });
  } catch (error) {
    console.error("POST /api/audit/simulate error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
