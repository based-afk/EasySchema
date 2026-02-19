import { TableSchema, Relationship } from "./schema-types";

// ─── Auto-layout algorithm ──────────────────────────────────────────────────
// Uses a dependency-aware grid layout.
// Tables with no FK dependencies are placed first, then their dependants below.

interface LayoutOptions {
  originX?: number;
  originY?: number;
  colGap?: number;
  rowGap?: number;
  maxCols?: number;
}

export function autoLayoutTables(
  tables: TableSchema[],
  relationships: Relationship[],
  options: LayoutOptions = {},
): TableSchema[] {
  const {
    originX = 80,
    originY = 80,
    colGap = 350,
    rowGap = 300,
    maxCols = 3,
  } = options;

  if (tables.length === 0) return tables;

  // Build dependency graph
  const dependsOn = new Map<string, Set<string>>();
  const dependedBy = new Map<string, Set<string>>();
  for (const t of tables) {
    dependsOn.set(t.id, new Set());
    dependedBy.set(t.id, new Set());
  }

  for (const rel of relationships) {
    dependsOn.get(rel.sourceTableId)?.add(rel.targetTableId);
    dependedBy.get(rel.targetTableId)?.add(rel.sourceTableId);
  }

  // Topological sort (Kahn's algorithm)
  const inDegree = new Map<string, number>();
  for (const t of tables) {
    inDegree.set(t.id, dependsOn.get(t.id)?.size ?? 0);
  }

  const layers: string[][] = [];
  const remaining = new Set(tables.map((t) => t.id));

  while (remaining.size > 0) {
    // Find all nodes with in-degree 0
    const layer: string[] = [];
    for (const id of remaining) {
      if ((inDegree.get(id) ?? 0) === 0) {
        layer.push(id);
      }
    }

    // If no zero in-degree nodes, break cycles by picking remaining
    if (layer.length === 0) {
      const fallback = Array.from(remaining);
      layers.push(fallback);
      break;
    }

    layers.push(layer);
    for (const id of layer) {
      remaining.delete(id);
      for (const dep of dependedBy.get(id) ?? []) {
        inDegree.set(dep, (inDegree.get(dep) ?? 1) - 1);
      }
    }
  }

  // Assign positions layer by layer
  const positions = new Map<string, { x: number; y: number }>();
  let currentY = originY;

  for (const layer of layers) {
    let col = 0;
    for (const id of layer) {
      positions.set(id, {
        x: originX + (col % maxCols) * colGap,
        y: currentY + Math.floor(col / maxCols) * rowGap,
      });
      col++;
    }
    const layerRows = Math.ceil(layer.length / maxCols);
    currentY += layerRows * rowGap;
  }

  return tables.map((t) => ({
    ...t,
    position: positions.get(t.id) ?? t.position,
  }));
}

/** Simple grid layout (no dependency awareness) */
export function gridLayout(
  tables: TableSchema[],
  cols = 3,
  gap = { x: 350, y: 300 },
  origin = { x: 80, y: 80 },
): TableSchema[] {
  return tables.map((t, i) => ({
    ...t,
    position: {
      x: origin.x + (i % cols) * gap.x,
      y: origin.y + Math.floor(i / cols) * gap.y,
    },
  }));
}
