import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/utils/auth";
import { buildFixPlan } from "@/lib/audit/fixPlanner";
import { applySafeFixes } from "@/lib/audit/fixOrchestrator";
import type { AiFixInput, CanvasSchemaSnapshot } from "@/lib/audit/fix-types";
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

    const result = await applySafeFixes(plan.fixes, schema, plan.auditSnapshot);

    return NextResponse.json({
      plan,
      result,
    });
  } catch (error) {
    console.error("POST /api/audit/fixes/apply-safe error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
