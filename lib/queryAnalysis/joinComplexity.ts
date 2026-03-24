// ─── Join Complexity Detector ─────────────────────────────────────────────────
//
// Analyzes the edge graph to detect deep join chains that could cause
// performance problems. Uses BFS to find the longest paths.
// ─────────────────────────────────────────────────────────────────────────────

import type { SchemaNode, SchemaEdge } from "../ai/types";

const COMPLEXITY_THRESHOLD = 3; // Warn if any join chain is deeper than this

/**
 * Build an adjacency list from edges.
 */
function buildAdjacency(edges: SchemaEdge[]): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const edge of edges) {
    if (!adj.has(edge.source)) adj.set(edge.source, []);
    adj.get(edge.source)!.push(edge.target);
    // Add reverse direction too
    if (!adj.has(edge.target)) adj.set(edge.target, []);
    adj.get(edge.target)!.push(edge.source);
  }
  return adj;
}

/**
 * BFS to find the longest path from a starting node (unweighted).
 */
function bfsMaxDepth(
  start: string,
  adj: Map<string, string[]>,
): { depth: number; path: string[] } {
  const visited = new Set<string>();
  const queue: { node: string; path: string[] }[] = [
    { node: start, path: [start] },
  ];
  let maxDepth = 0;
  let maxPath: string[] = [start];

  visited.add(start);

  while (queue.length > 0) {
    const { node, path } = queue.shift()!;
    const neighbors = adj.get(node) ?? [];

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        const newPath = [...path, neighbor];
        if (newPath.length > maxDepth + 1) {
          maxDepth = newPath.length - 1;
          maxPath = newPath;
        }
        queue.push({ node: neighbor, path: newPath });
      }
    }
  }

  return { depth: maxDepth, path: maxPath };
}

/**
 * Detect join chains that exceed the complexity threshold.
 * Returns human-readable warnings.
 */
export function detectJoinComplexity(edges: SchemaEdge[]): string[] {
  if (edges.length === 0) return [];

  const adj = buildAdjacency(edges);
  const warnings: string[] = [];
  const checked = new Set<string>();

  for (const startNode of adj.keys()) {
    if (checked.has(startNode)) continue;

    const { depth, path } = bfsMaxDepth(startNode, adj);

    if (depth >= COMPLEXITY_THRESHOLD) {
      warnings.push(
        `Deep join chain detected (depth ${depth}): ${path.join(" → ")}. ` +
          `Consider denormalizing frequently accessed data or adding a materialized view.`,
      );
    }

    // Mark all nodes in this connected component as checked
    path.forEach((n) => checked.add(n));
  }

  return warnings;
}

/**
 * Calculate a join complexity score (0-100, lower is better).
 */
export function getJoinComplexityScore(edges: SchemaEdge[]): number {
  if (edges.length === 0) return 100;

  const adj = buildAdjacency(edges);
  let maxDepth = 0;

  for (const startNode of adj.keys()) {
    const { depth } = bfsMaxDepth(startNode, adj);
    if (depth > maxDepth) maxDepth = depth;
  }

  // Score degrades above depth 2
  if (maxDepth <= 2) return 100;
  if (maxDepth === 3) return 80;
  if (maxDepth === 4) return 60;
  if (maxDepth === 5) return 40;
  return 20;
}
