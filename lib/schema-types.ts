// ─── Core schema types used across the studio ──────────────────────────────

export type ColumnType =
  | "INT"
  | "BIGINT"
  | "SERIAL"
  | "TEXT"
  | "VARCHAR"
  | "BOOLEAN"
  | "DATE"
  | "TIMESTAMP"
  | "FLOAT"
  | "DECIMAL"
  | "JSON"
  | "UUID";

export type OnDeleteAction = "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";

export interface ForeignKeyConfig {
  targetTableId: string;
  targetColumnId: string;
  onDelete: OnDeleteAction;
}

export interface Column {
  id: string;
  name: string;
  type: ColumnType;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isNullable: boolean;
  isUnique: boolean;
  defaultValue?: string;
  /** Legacy reference format — kept for generator compatibility */
  references?: { table: string; column: string };
  /** Rich FK config for store-driven relationships */
  foreignKey?: ForeignKeyConfig;
}

export interface TableSchema {
  id: string;
  name: string;
  columns: Column[];
  position: { x: number; y: number };
}

// ─── Relationship (first-class edge) ────────────────────────────────────────

export type RelationshipType = "one-to-one" | "one-to-many" | "many-to-many";

export interface Relationship {
  id: string;
  sourceTableId: string;
  sourceColumnId: string;
  targetTableId: string;
  targetColumnId: string;
  type: RelationshipType;
  onDelete: OnDeleteAction;
}

// ─── Undo / Redo snapshot ───────────────────────────────────────────────────

export interface SchemaSnapshot {
  tables: Record<string, TableSchema>;
  relationships: Record<string, Relationship>;
}

// ─── Selection ──────────────────────────────────────────────────────────────

export interface SelectionState {
  tableId: string | null;
  columnId: string | null;
  relationshipId: string | null;
}

// ─── Misc ───────────────────────────────────────────────────────────────────

export interface SchemaState {
  tables: TableSchema[];
  description: string;
  clarityScore: number;
}

export type ExportFormat = "postgresql" | "mysql" | "sqlite";

// ─── Save / Load ────────────────────────────────────────────────────────────

export interface SavedSchema {
  version: number;
  name: string;
  tables: TableSchema[];
  relationships: Relationship[];
  savedAt: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const ALL_COLUMN_TYPES: ColumnType[] = [
  "INT", "BIGINT", "SERIAL", "TEXT", "VARCHAR", "BOOLEAN",
  "DATE", "TIMESTAMP", "FLOAT", "DECIMAL", "JSON", "UUID",
];

export const ON_DELETE_ACTIONS: OnDeleteAction[] = [
  "CASCADE", "SET NULL", "RESTRICT", "NO ACTION",
];

// ─── Sample schema for demo ─────────────────────────────────────────────────

export const SAMPLE_TABLES: TableSchema[] = [
  {
    id: "users",
    name: "users",
    columns: [
      { id: "u1", name: "id", type: "SERIAL", isPrimaryKey: true, isForeignKey: false, isNullable: false, isUnique: true },
      { id: "u2", name: "name", type: "VARCHAR", isPrimaryKey: false, isForeignKey: false, isNullable: false, isUnique: false },
      { id: "u3", name: "email", type: "VARCHAR", isPrimaryKey: false, isForeignKey: false, isNullable: false, isUnique: true },
      { id: "u4", name: "created_at", type: "TIMESTAMP", isPrimaryKey: false, isForeignKey: false, isNullable: false, isUnique: false, defaultValue: "NOW()" },
    ],
    position: { x: 100, y: 100 },
  },
  {
    id: "posts",
    name: "posts",
    columns: [
      { id: "p1", name: "id", type: "SERIAL", isPrimaryKey: true, isForeignKey: false, isNullable: false, isUnique: true },
      { id: "p2", name: "title", type: "VARCHAR", isPrimaryKey: false, isForeignKey: false, isNullable: false, isUnique: false },
      { id: "p3", name: "content", type: "TEXT", isPrimaryKey: false, isForeignKey: false, isNullable: true, isUnique: false },
      { id: "p4", name: "user_id", type: "INT", isPrimaryKey: false, isForeignKey: true, isNullable: false, isUnique: false, references: { table: "users", column: "id" } },
      { id: "p5", name: "created_at", type: "TIMESTAMP", isPrimaryKey: false, isForeignKey: false, isNullable: false, isUnique: false, defaultValue: "NOW()" },
    ],
    position: { x: 450, y: 100 },
  },
  {
    id: "comments",
    name: "comments",
    columns: [
      { id: "c1", name: "id", type: "SERIAL", isPrimaryKey: true, isForeignKey: false, isNullable: false, isUnique: true },
      { id: "c2", name: "body", type: "TEXT", isPrimaryKey: false, isForeignKey: false, isNullable: false, isUnique: false },
      { id: "c3", name: "post_id", type: "INT", isPrimaryKey: false, isForeignKey: true, isNullable: false, isUnique: false, references: { table: "posts", column: "id" } },
      { id: "c4", name: "user_id", type: "INT", isPrimaryKey: false, isForeignKey: true, isNullable: false, isUnique: false, references: { table: "users", column: "id" } },
      { id: "c5", name: "created_at", type: "TIMESTAMP", isPrimaryKey: false, isForeignKey: false, isNullable: false, isUnique: false, defaultValue: "NOW()" },
    ],
    position: { x: 250, y: 350 },
  },
];
