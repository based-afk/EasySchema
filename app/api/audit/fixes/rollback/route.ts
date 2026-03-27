import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/utils/auth";
import { buildFixPlan } from "@/lib/audit/fixPlanner";
import { rollbackFix } from "@/lib/audit/fixOrchestrator";
import { getFixStep } from "@/lib/audit/fixStore";
import type {
  AiFixInput,
  CanvasSchemaSnapshot,
  PlannedFix,
} from "@/lib/audit/fix-types";
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
      runId?: string;
      fixId?: string;
    };

    if (!body.runId || !body.fixId) {
      return NextResponse.json(
        { error: "runId and fixId are required" },
        { status: 400 },
      );
    }

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

    const fix = plan.fixes.find((item) => item.id === body.fixId);
    if (!fix) {
      return NextResponse.json({ error: "Fix not found" }, { status: 404 });
    }

    const lastStep = await getFixStep(body.runId, body.fixId);
    if (!lastStep || lastStep.status !== "applied") {
      return NextResponse.json(
        { error: "Fix has not been applied" },
        { status: 409 },
      );
    }

    const result = await rollbackFix(body.runId, fix as PlannedFix);

    return NextResponse.json({
      fix,
      rollback: result,
    });
  } catch (error) {
    console.error("POST /api/audit/fixes/rollback error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
