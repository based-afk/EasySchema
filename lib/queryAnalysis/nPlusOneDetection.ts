// ─── N+1 Query Risk Detector ─────────────────────────────────────────────────
//
// Detects schema patterns that commonly lead to N+1 query problems at the
// ORM/application layer. Returns actionable risk descriptions.
// ─────────────────────────────────────────────────────────────────────────────

import type { SchemaNode, SchemaEdge } from "../ai/types";

/**
 * Detect N+1 query risks in the schema.
 * Returns a list of risk descriptions.
 */
export function detectNPlusOne(
  nodes: SchemaNode[],
  edges: SchemaEdge[],
): string[] {
  const risks: string[] = [];

  // Build a map of how many children each table has
  const childCount = new Map<string, string[]>();
  for (const edge of edges) {
    if (!childCount.has(edge.target)) childCount.set(edge.target, []);
    childCount.get(edge.target)!.push(edge.source);
  }

  // 1. Tables with many children (fan-out risk)
  for (const [parent, children] of childCount.entries()) {
    if (children.length >= 3) {
      risks.push(
        `N+1 Risk: "${parent}" has ${children.length} child tables (${children.join(", ")}). ` +
          `Fetching lists of ${parent} and then loading children in a loop will cause N+1 queries. ` +
          `Use eager loading (JOIN) or data loaders.`,
      );
    }
  }

  // 2. Many-to-many relationships (both sides get loaded separately)
  const m2mEdges = edges.filter(
    (e) => e.data?.relationshipType === "many-to-many",
  );
  for (const edge of m2mEdges) {
    risks.push(
      `N+1 Risk: Many-to-many between "${edge.source}" and "${edge.target}". ` +
        `Loading ${edge.source} records and then fetching associated ${edge.target} records in a loop creates N+1 queries. ` +
        `Use a batch-loading strategy or preload via JOIN on the junction table.`,
    );
  }

  // 3. Nested one-to-many chains (grandchild tables)
  const parentOf = new Map<string, string[]>();
  for (const edge of edges) {
    if (!parentOf.has(edge.source)) parentOf.set(edge.source, []);
    parentOf.get(edge.source)!.push(edge.target);
  }

  for (const node of nodes) {
    const directParents = parentOf.get(node.id) ?? [];
    for (const parent of directParents) {
      const grandParents = parentOf.get(parent) ?? [];
      if (grandParents.length > 0) {
        risks.push(
          `N+1 Risk: "${node.data.label}" → "${parent}" → "${grandParents[0]}" is a 3-level deep chain. ` +
            `Traversing this relationship naively will cause nested N+1 problems. ` +
            `Use query batching or a single complex JOIN.`,
        );
        break; // one warning per node is enough
      }
    }
  }

  // 4. Self-referencing tables (hierarchical data)
  for (const node of nodes) {
    const selfRef = node.data.columns.find(
      (c) =>
        c.isForeignKey &&
        c.name.toLowerCase().includes(node.id.toLowerCase().replace(/s$/, "")),
    );
    if (selfRef) {
      risks.push(
        `N+1 Risk: "${node.data.label}" has a self-referencing foreign key (${selfRef.name}). ` +
          `Recursive tree traversals will cause severe N+1 problems. ` +
          `Use recursive CTEs (WITH RECURSIVE) instead of application-level loops.`,
      );
    }
  }

  return risks;
}
