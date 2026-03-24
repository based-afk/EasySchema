// ─── ReactFlow-compatible type definitions for AI output ────────────────────

export interface ColumnDef {
  id: string;
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isNullable: boolean;
  isUnique: boolean;
  defaultValue?: string;
}

export interface NodeData {
  label: string;
  columns: ColumnDef[];
}

export interface SchemaNode {
  id: string;
  type: "tableNode";
  position: { x: number; y: number };
  data: NodeData;
}

export interface EdgeData {
  relationshipType: "one-to-one" | "one-to-many" | "many-to-many";
  onDelete: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
}

export interface SchemaEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type: "relationshipEdge";
  data?: EdgeData;
}

export interface ReactFlowSchema {
  nodes: SchemaNode[];
  edges: SchemaEdge[];
}
