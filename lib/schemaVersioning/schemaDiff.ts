// ─── Schema Diff Engine ───────────────────────────────────────────────────────
//
// Computes structural differences between two schema snapshots.
// ─────────────────────────────────────────────────────────────────────────────

import type { SchemaNode, SchemaEdge } from "../ai/types";
import type { SavedVersion } from "./saveVersion";

export interface ColumnChange {
  column: string;
  field: string;
  from: unknown;
  to: unknown;
}

export interface TableDiff {
  tableName: string;
  addedColumns: string[];
  removedColumns: string[];
  modifiedColumns: ColumnChange[];
}

export interface SchemaDiff {
  addedTables: string[];
  removedTables: string[];
  modifiedTables: TableDiff[];
  addedEdges: string[];
  removedEdges: string[];
  summary: string;
}

function edgeKey(edge: SchemaEdge): string {
  return `${edge.source}->${edge.target}(${edge.data?.relationshipType ?? "?"})`;
}

/**
 * Compute the diff between two schema versions.
 */
export function diffSchemas(
  older: { nodes: SchemaNode[]; edges: SchemaEdge[] },
  newer: { nodes: SchemaNode[]; edges: SchemaEdge[] },
): SchemaDiff {
  const oldTableMap = new Map(older.nodes.map((n) => [n.id, n]));
  const newTableMap = new Map(newer.nodes.map((n) => [n.id, n]));

  // Tables
  const addedTables = newer.nodes
    .filter((n) => !oldTableMap.has(n.id))
    .map((n) => n.data.label);

  const removedTables = older.nodes
    .filter((n) => !newTableMap.has(n.id))
    .map((n) => n.data.label);

  const modifiedTables: TableDiff[] = [];

  for (const [id, newNode] of newTableMap.entries()) {
    const oldNode = oldTableMap.get(id);
    if (!oldNode) continue;

    const oldCols = new Map(oldNode.data.columns.map((c) => [c.name, c]));
    const newCols = new Map(newNode.data.columns.map((c) => [c.name, c]));

    const addedColumns = newNode.data.columns
      .filter((c) => !oldCols.has(c.name))
      .map((c) => c.name);

    const removedColumns = oldNode.data.columns
      .filter((c) => !newCols.has(c.name))
      .map((c) => c.name);

    const modifiedColumns: ColumnChange[] = [];
    for (const [name, newCol] of newCols.entries()) {
      const oldCol = oldCols.get(name);
      if (!oldCol) continue;

      const fields: (keyof typeof newCol)[] = [
        "type",
        "isPrimaryKey",
        "isForeignKey",
        "isNullable",
        "isUnique",
        "defaultValue",
      ];

      for (const field of fields) {
        if (oldCol[field] !== newCol[field]) {
          modifiedColumns.push({
            column: name,
            field,
            from: oldCol[field],
            to: newCol[field],
          });
        }
      }
    }

    if (
      addedColumns.length > 0 ||
      removedColumns.length > 0 ||
      modifiedColumns.length > 0
    ) {
      modifiedTables.push({
        tableName: newNode.data.label,
        addedColumns,
        removedColumns,
        modifiedColumns,
      });
    }
  }

  // Edges
  const oldEdgeKeys = new Set(older.edges.map(edgeKey));
  const newEdgeKeys = new Set(newer.edges.map(edgeKey));

  const addedEdges = newer.edges
    .filter((e) => !oldEdgeKeys.has(edgeKey(e)))
    .map(edgeKey);

  const removedEdges = older.edges
    .filter((e) => !newEdgeKeys.has(edgeKey(e)))
    .map(edgeKey);

  // Build summary
  const parts: string[] = [];
  if (addedTables.length > 0) parts.push(`+${addedTables.length} table(s)`);
  if (removedTables.length > 0) parts.push(`-${removedTables.length} table(s)`);
  if (modifiedTables.length > 0)
    parts.push(`~${modifiedTables.length} modified`);
  if (addedEdges.length > 0) parts.push(`+${addedEdges.length} edge(s)`);
  if (removedEdges.length > 0) parts.push(`-${removedEdges.length} edge(s)`);

  const summary = parts.length > 0 ? parts.join(", ") : "No changes detected.";

  return {
    addedTables,
    removedTables,
    modifiedTables,
    addedEdges,
    removedEdges,
    summary,
  };
}

/**
 * Diff two SavedVersion objects.
 */
export function diffVersions(
  older: SavedVersion,
  newer: SavedVersion,
): SchemaDiff {
  return diffSchemas(
    { nodes: older.nodes, edges: older.edges },
    { nodes: newer.nodes, edges: newer.edges },
  );
}
