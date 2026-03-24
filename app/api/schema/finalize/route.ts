// POST /api/schema/finalize
//
// Accepts a ReactFlow schema (nodes + edges) and a projectId, then:
//   1. Validates the schema structure
//   2. Saves a new version to schema_versions
//   3. Returns the saved version with a version number
// ──────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { saveSchemaVersion } from "@/lib/schemaVersioning/saveVersion";
import { hasKeys } from "@/lib/utils/jsonValidator";
import type { SchemaNode, SchemaEdge } from "@/lib/ai/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      projectId,
      nodes,
      edges,
      name,
      description,
      promptText,
      healthScore,
      promptScore,
    } = body;

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'projectId'" },
        { status: 400 },
      );
    }

    if (!Array.isArray(nodes) || nodes.length === 0) {
      return NextResponse.json(
        { error: "'nodes' must be a non-empty array" },
        { status: 400 },
      );
    }

    // Validate at least one node has the expected shape
    if (!hasKeys(nodes[0], ["id", "data"])) {
      return NextResponse.json(
        {
          error:
            "Nodes appear malformed. Expected ReactFlow node shape with 'id' and 'data'.",
        },
        { status: 400 },
      );
    }

    const savedVersion = await saveSchemaVersion({
      projectId,
      name,
      description,
      nodes: nodes as SchemaNode[],
      edges: (edges ?? []) as SchemaEdge[],
      healthScore: typeof healthScore === "number" ? healthScore : undefined,
      promptScore: typeof promptScore === "number" ? promptScore : undefined,
      promptText: typeof promptText === "string" ? promptText : undefined,
    });

    return NextResponse.json({
      success: true,
      version: savedVersion,
    });
  } catch (error) {
    console.error("[/api/schema/finalize] Error:", error);
    return NextResponse.json(
      { error: "Failed to finalize schema. " + String(error) },
      { status: 500 },
    );
  }
}
