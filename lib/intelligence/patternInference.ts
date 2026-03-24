// ─── Pattern-based Relationship Inference ────────────────────────────────────
//
// Infers missing foreign-key relationships by analyzing FK column naming
// conventions in the schema nodes. Adds edges that weren't returned by AI.
// ─────────────────────────────────────────────────────────────────────────────

import type { SchemaNode, SchemaEdge } from "../ai/types";

/**
 * Scan all FK columns and infer edges for any relationships not already present.
 */
export function inferRelationships(
  nodes: SchemaNode[],
  existingEdges: SchemaEdge[],
): SchemaEdge[] {
  const tableIds = new Set(nodes.map((n) => n.id));
  const existingPairs = new Set(
    existingEdges.map((e) => `${e.source}->${e.target}`),
  );

  const inferred: SchemaEdge[] = [];

  for (const node of nodes) {
    for (const col of node.data.columns) {
      if (!col.isForeignKey) continue;

      // Derive target table from FK column name (e.g., user_id -> users, author_id -> users)
      const colLower = col.name.toLowerCase();
      const withoutId = colLower.replace(/_id$/, "");

      // Check common plural/singular variants
      const candidates = [
        withoutId,
        withoutId + "s", // user -> users
        withoutId.replace(/y$/, "ies"), // category -> categories
        withoutId.replace(/s$/, ""), // genres -> genre
      ];

      let targetTable: string | null = null;
      for (const cand of candidates) {
        if (tableIds.has(cand) && cand !== node.id) {
          targetTable = cand;
          break;
        }
      }

      if (!targetTable) continue;
      const pairKey = `${node.id}->${targetTable}`;
      if (existingPairs.has(pairKey)) continue;

      // Find target PK column
      const targetNode = nodes.find((n) => n.id === targetTable);
      const targetPk = targetNode?.data.columns.find((c) => c.isPrimaryKey);

      inferred.push({
        id: `inferred_${node.id}_${col.id}`,
        source: node.id,
        target: targetTable,
        sourceHandle: col.id,
        targetHandle: targetPk?.id,
        type: "relationshipEdge",
        data: {
          relationshipType: "one-to-many",
          onDelete: "CASCADE",
        },
      });

      existingPairs.add(pairKey); // Prevent duplicates from multiple FK cols
    }
  }

  return inferred;
}

/**
 * Known relationship patterns based on table name pairs.
 * Returns the expected relationship type for a source→target combo.
 */
export function getKnownRelationshipType(
  source: string,
  target: string,
): "one-to-one" | "one-to-many" | "many-to-many" {
  const MANY_TO_MANY_INDICATORS = [
    "tags",
    "categories",
    "roles",
    "permissions",
    "skills",
    "interests",
  ];

  if (
    MANY_TO_MANY_INDICATORS.some((kw) => target.includes(kw)) ||
    // Junction tables often have two FK columns
    (source.includes("_") && source.endsWith("s"))
  ) {
    return "many-to-many";
  }

  const ONE_TO_ONE = [
    ["users", "user_profiles"],
    ["users", "accounts"],
    ["orders", "shipments"],
  ];

  for (const [s, t] of ONE_TO_ONE) {
    if ((source === s && target === t) || (source === t && target === s)) {
      return "one-to-one";
    }
  }

  return "one-to-many";
}
