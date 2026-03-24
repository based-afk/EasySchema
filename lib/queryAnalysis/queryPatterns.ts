// ─── Query Pattern Analysis ───────────────────────────────────────────────────
//
// Analyzes the schema graph (nodes + edges) to detect potentially expensive
// query patterns and generate recommendations.
// ─────────────────────────────────────────────────────────────────────────────

import type { SchemaNode, SchemaEdge } from "../ai/types";

/**
 * Analyze the schema for commonly problematic query patterns.
 * Returns a list of human-readable warnings.
 */
export function analyzeQueryPatterns(
  nodes: SchemaNode[],
  edges: SchemaEdge[],
): string[] {
  const warnings: string[] = [];

  // 1. Tables with no indexes on FK columns
  const nodesWithFkNoIndex = nodes.filter((n) =>
    n.data.columns.some((c) => c.isForeignKey && !c.isUnique),
  );
  if (nodesWithFkNoIndex.length > 0) {
    warnings.push(
      `Tables ${nodesWithFkNoIndex.map((n) => `"${n.data.label}"`).join(", ")} have foreign key columns with no index — JOINs will be slow without indexes.`,
    );
  }

  // 2. Many-to-many without junction table
  for (const edge of edges) {
    if (edge.data?.relationshipType === "many-to-many") {
      // Check if a junction table exists
      const junctionExists = nodes.some(
        (n) =>
          n.id !== edge.source &&
          n.id !== edge.target &&
          n.data.columns.some(
            (c) =>
              c.name === `${edge.source}_id` || c.name === `${edge.target}_id`,
          ),
      );
      if (!junctionExists) {
        warnings.push(
          `Many-to-many relationship between "${edge.source}" and "${edge.target}" requires a junction table (e.g., ${edge.source}_${edge.target}).`,
        );
      }
    }
  }

  // 3. Very wide tables (>15 columns)
  for (const node of nodes) {
    if (node.data.columns.length > 15) {
      warnings.push(
        `Table "${node.data.label}" has ${node.data.columns.length} columns — consider vertical partitioning to improve read performance.`,
      );
    }
  }

  // 4. Tables with no relationships (isolated nodes)
  const connectedTables = new Set([
    ...edges.map((e) => e.source),
    ...edges.map((e) => e.target),
  ]);
  const isolated = nodes.filter(
    (n) => !connectedTables.has(n.id) && n.data.columns.length > 1,
  );
  if (isolated.length > 0) {
    warnings.push(
      `Tables ${isolated.map((n) => `"${n.data.label}"`).join(", ")} are isolated (no relationships) — verify if they should be connected to other tables.`,
    );
  }

  // 5. Missing pagination-friendly indexes
  for (const node of nodes) {
    const hasCreatedAt = node.data.columns.some((c) => c.name === "created_at");
    const isMainEntity = node.data.columns.length > 4;
    if (!hasCreatedAt && isMainEntity) {
      warnings.push(
        `Table "${node.data.label}" lacks a created_at timestamp — pagination queries (ORDER BY created_at) will not be supported.`,
      );
    }
  }

  return warnings;
}
