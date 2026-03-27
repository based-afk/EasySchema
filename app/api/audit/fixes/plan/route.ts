import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/utils/auth";
import { buildFixPlan } from "@/lib/audit/fixPlanner";
import type { CanvasSchemaSnapshot, AiFixInput } from "@/lib/audit/fix-types";
import type { SchemaHealthResult } from "@/lib/schema-types";
import type { PerformanceSimulationResult } from "@/lib/audit/performanceSimulation";

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
      schema?: CanvasSchemaSnapshot;
      audit?: SchemaHealthResult;
      performance?: PerformanceSimulationResult;
      aiFixes?: AiFixInput[];
    };

    const schema: CanvasSchemaSnapshot = body.schema ?? {
      tables: [],
      relationships: [],
      indexes: {},
    };

    const plan = buildFixPlan(
      schema,
      body.audit ? { health: body.audit.allIssues } : undefined,
      body.performance,
      body.aiFixes,
    );

    return NextResponse.json(plan);
  } catch (error) {
    console.error("POST /api/audit/fixes/plan error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
