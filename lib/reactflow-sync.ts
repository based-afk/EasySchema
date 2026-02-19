import { Node, Edge, MarkerType } from "reactflow";
import { TableSchema, Relationship } from "./schema-types";

// ─── Schema → ReactFlow nodes ───────────────────────────────────────────────

export function schemaToNodes(
  tables: Record<string, TableSchema>,
  nodeData: (tableId: string, table: TableSchema) => Record<string, unknown>,
): Node[] {
  return Object.values(tables).map((table) => ({
    id: table.id,
    type: "tableNode",
    position: table.position,
    data: nodeData(table.id, table),
  }));
}

// ─── Schema → ReactFlow edges ───────────────────────────────────────────────

export function schemaToEdges(
  tables: Record<string, TableSchema>,
  relationships: Record<string, Relationship>,
): Edge[] {
  const edges: Edge[] = [];

  for (const rel of Object.values(relationships)) {
    const sourceTable = tables[rel.sourceTableId];
    const targetTable = tables[rel.targetTableId];
    if (!sourceTable || !targetTable) continue;

    const sourceCol = sourceTable.columns.find(
      (c) => c.id === rel.sourceColumnId,
    );
    const targetCol = targetTable.columns.find(
      (c) => c.id === rel.targetColumnId,
    );

    edges.push({
      id: rel.id,
      source: rel.sourceTableId,
      target: rel.targetTableId,
      sourceHandle: `${rel.sourceTableId}-${rel.sourceColumnId}-source`,
      targetHandle: `${rel.targetTableId}-${rel.targetColumnId}-target`,
      type: "relationshipEdge",
      data: {
        label: `${sourceCol?.name ?? "?"} → ${targetCol?.name ?? "?"}`,
        relationshipType: rel.type,
        onDelete: rel.onDelete,
        relationshipId: rel.id,
      },
      animated: true,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "hsl(var(--primary))",
      },
    });
  }

  return edges;
}

// ─── Parse handle id "tableId-colId-source/target" ──────────────────────────

export function parseHandleId(
  handleId: string | null | undefined,
): { tableId: string; colId: string } | null {
  if (!handleId) return null;
  const parts = handleId.split("-");
  if (parts.length < 3) return null;
  const suffix = parts[parts.length - 1];
  if (suffix !== "source" && suffix !== "target") return null;
  const tableId = parts[0];
  const colId = parts.slice(1, -1).join("-");
  return { tableId, colId };
}
