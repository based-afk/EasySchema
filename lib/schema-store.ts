import { create } from "zustand";
import {
  TableSchema,
  Column,
  ColumnType,
  Relationship,
  SchemaSnapshot,
  SelectionState,
  OnDeleteAction,
} from "./schema-types";

// ─── History helpers ────────────────────────────────────────────────────────

const MAX_HISTORY = 50;

function takeSnapshot(state: {
  tables: Record<string, TableSchema>;
  relationships: Record<string, Relationship>;
}): SchemaSnapshot {
  return JSON.parse(
    JSON.stringify({ tables: state.tables, relationships: state.relationships }),
  );
}

// ─── Store interface ────────────────────────────────────────────────────────

export interface SchemaStore {
  // ── Data ──────────────────────────────────────────────────────────────
  tables: Record<string, TableSchema>;
  relationships: Record<string, Relationship>;
  schemaName: string;

  // ── Selection ─────────────────────────────────────────────────────────
  selection: SelectionState;

  // ── History (undo / redo) ─────────────────────────────────────────────
  past: SchemaSnapshot[];
  future: SchemaSnapshot[];

  // ── Table actions ─────────────────────────────────────────────────────
  addTable: (table: TableSchema) => void;
  deleteTable: (tableId: string) => void;
  updateTableName: (tableId: string, name: string) => void;
  updateTablePosition: (tableId: string, position: { x: number; y: number }) => void;
  setTables: (tables: TableSchema[]) => void;

  // ── Column actions ────────────────────────────────────────────────────
  addColumn: (tableId: string, column?: Partial<Column>) => void;
  deleteColumn: (tableId: string, columnId: string) => void;
  updateColumn: (tableId: string, columnId: string, patch: Partial<Column>) => void;

  // ── Relationship actions ──────────────────────────────────────────────
  addRelationship: (rel: Relationship) => void;
  deleteRelationship: (relId: string) => void;
  updateRelationship: (relId: string, patch: Partial<Relationship>) => void;

  // ── Selection actions ─────────────────────────────────────────────────
  selectTable: (tableId: string | null) => void;
  selectColumn: (tableId: string | null, columnId: string | null) => void;
  selectRelationship: (relId: string | null) => void;
  clearSelection: () => void;

  // ── Undo / Redo ───────────────────────────────────────────────────────
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // ── Schema name ───────────────────────────────────────────────────────
  setSchemaName: (name: string) => void;

  // ── Derived helpers ───────────────────────────────────────────────────
  getTablesArray: () => TableSchema[];
  getRelationshipsArray: () => Relationship[];
}

// ─── Store implementation ───────────────────────────────────────────────────

export const useSchemaStore = create<SchemaStore>((set, get) => {
  /** Push current state onto the undo stack before mutating */
  function pushHistory() {
    const { tables, relationships, past } = get();
    const snapshot = takeSnapshot({ tables, relationships });
    set({
      past: [...past.slice(-(MAX_HISTORY - 1)), snapshot],
      future: [],
    });
  }

  return {
    // ── Initial state ─────────────────────────────────────────────────
    tables: {},
    relationships: {},
    schemaName: "Untitled Schema",
    selection: { tableId: null, columnId: null, relationshipId: null },
    past: [],
    future: [],

    // ── Table actions ─────────────────────────────────────────────────
    addTable: (table) => {
      pushHistory();
      set((s) => ({
        tables: { ...s.tables, [table.id]: table },
      }));
    },

    deleteTable: (tableId) => {
      pushHistory();
      set((s) => {
        const { [tableId]: _, ...rest } = s.tables;
        // Also remove relationships connected to this table
        const rels = { ...s.relationships };
        for (const [id, rel] of Object.entries(rels)) {
          if (rel.sourceTableId === tableId || rel.targetTableId === tableId) {
            delete rels[id];
          }
        }
        return {
          tables: rest,
          relationships: rels,
          selection:
            s.selection.tableId === tableId
              ? { tableId: null, columnId: null, relationshipId: null }
              : s.selection,
        };
      });
    },

    updateTableName: (tableId, name) => {
      pushHistory();
      set((s) => {
        const table = s.tables[tableId];
        if (!table) return s;
        return {
          tables: { ...s.tables, [tableId]: { ...table, name } },
        };
      });
    },

    updateTablePosition: (tableId, position) => {
      // Position changes are NOT pushed to undo (too frequent during drag)
      set((s) => {
        const table = s.tables[tableId];
        if (!table) return s;
        return {
          tables: { ...s.tables, [tableId]: { ...table, position } },
        };
      });
    },

    setTables: (tablesArr) => {
      pushHistory();
      const tablesMap: Record<string, TableSchema> = {};
      for (const t of tablesArr) {
        tablesMap[t.id] = t;
      }
      // Derive relationships from FK references
      const rels: Record<string, Relationship> = {};
      for (const t of tablesArr) {
        for (const col of t.columns) {
          if (col.isForeignKey && col.references) {
            const targetTable = tablesArr.find(
              (tt) => tt.id === col.references!.table,
            );
            const targetCol = targetTable?.columns.find(
              (c) => c.name === col.references!.column,
            );
            if (targetTable && targetCol) {
              const relId = `rel-${t.id}-${col.id}`;
              rels[relId] = {
                id: relId,
                sourceTableId: t.id,
                sourceColumnId: col.id,
                targetTableId: targetTable.id,
                targetColumnId: targetCol.id,
                type: "one-to-many",
                onDelete: "CASCADE",
              };
            }
          }
        }
      }
      set({ tables: tablesMap, relationships: rels });
    },

    // ── Column actions ────────────────────────────────────────────────
    addColumn: (tableId, partial) => {
      pushHistory();
      set((s) => {
        const table = s.tables[tableId];
        if (!table) return s;
        const newCol: Column = {
          id: `col-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: "new_column",
          type: "VARCHAR",
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: true,
          isUnique: false,
          ...partial,
        };
        return {
          tables: {
            ...s.tables,
            [tableId]: { ...table, columns: [...table.columns, newCol] },
          },
        };
      });
    },

    deleteColumn: (tableId, columnId) => {
      pushHistory();
      set((s) => {
        const table = s.tables[tableId];
        if (!table) return s;
        // Remove associated relationships
        const rels = { ...s.relationships };
        for (const [id, rel] of Object.entries(rels)) {
          if (
            (rel.sourceTableId === tableId && rel.sourceColumnId === columnId) ||
            (rel.targetTableId === tableId && rel.targetColumnId === columnId)
          ) {
            delete rels[id];
          }
        }
        return {
          tables: {
            ...s.tables,
            [tableId]: {
              ...table,
              columns: table.columns.filter((c) => c.id !== columnId),
            },
          },
          relationships: rels,
        };
      });
    },

    updateColumn: (tableId, columnId, patch) => {
      pushHistory();
      set((s) => {
        const table = s.tables[tableId];
        if (!table) return s;
        return {
          tables: {
            ...s.tables,
            [tableId]: {
              ...table,
              columns: table.columns.map((c) =>
                c.id === columnId ? { ...c, ...patch } : c,
              ),
            },
          },
        };
      });
    },

    // ── Relationship actions ──────────────────────────────────────────
    addRelationship: (rel) => {
      pushHistory();
      set((s) => {
        // Also mark source column as FK
        const sourceTable = s.tables[rel.sourceTableId];
        const targetTable = s.tables[rel.targetTableId];
        const targetCol = targetTable?.columns.find(
          (c) => c.id === rel.targetColumnId,
        );
        let newTables = s.tables;
        if (sourceTable && targetCol) {
          newTables = {
            ...newTables,
            [rel.sourceTableId]: {
              ...sourceTable,
              columns: sourceTable.columns.map((c) =>
                c.id === rel.sourceColumnId
                  ? {
                      ...c,
                      isForeignKey: true,
                      references: {
                        table: rel.targetTableId,
                        column: targetCol.name,
                      },
                      foreignKey: {
                        targetTableId: rel.targetTableId,
                        targetColumnId: rel.targetColumnId,
                        onDelete: rel.onDelete,
                      },
                    }
                  : c,
              ),
            },
          };
        }
        return {
          tables: newTables,
          relationships: { ...s.relationships, [rel.id]: rel },
        };
      });
    },

    deleteRelationship: (relId) => {
      pushHistory();
      set((s) => {
        const rel = s.relationships[relId];
        if (!rel) return s;
        const { [relId]: _, ...restRels } = s.relationships;
        // Unset FK on source column
        const sourceTable = s.tables[rel.sourceTableId];
        let newTables = s.tables;
        if (sourceTable) {
          newTables = {
            ...newTables,
            [rel.sourceTableId]: {
              ...sourceTable,
              columns: sourceTable.columns.map((c) =>
                c.id === rel.sourceColumnId
                  ? {
                      ...c,
                      isForeignKey: false,
                      references: undefined,
                      foreignKey: undefined,
                    }
                  : c,
              ),
            },
          };
        }
        return {
          tables: newTables,
          relationships: restRels,
          selection:
            s.selection.relationshipId === relId
              ? { ...s.selection, relationshipId: null }
              : s.selection,
        };
      });
    },

    updateRelationship: (relId, patch) => {
      pushHistory();
      set((s) => {
        const rel = s.relationships[relId];
        if (!rel) return s;
        return {
          relationships: {
            ...s.relationships,
            [relId]: { ...rel, ...patch },
          },
        };
      });
    },

    // ── Selection ─────────────────────────────────────────────────────
    selectTable: (tableId) =>
      set({
        selection: { tableId, columnId: null, relationshipId: null },
      }),

    selectColumn: (tableId, columnId) =>
      set({
        selection: { tableId, columnId, relationshipId: null },
      }),

    selectRelationship: (relId) =>
      set({
        selection: { tableId: null, columnId: null, relationshipId: relId },
      }),

    clearSelection: () =>
      set({
        selection: { tableId: null, columnId: null, relationshipId: null },
      }),

    // ── Undo / Redo ───────────────────────────────────────────────────
    undo: () => {
      const { past, tables, relationships } = get();
      if (past.length === 0) return;
      const previous = past[past.length - 1];
      const currentSnapshot = takeSnapshot({ tables, relationships });
      set({
        tables: previous.tables,
        relationships: previous.relationships,
        past: past.slice(0, -1),
        future: [currentSnapshot, ...get().future].slice(0, MAX_HISTORY),
      });
    },

    redo: () => {
      const { future, tables, relationships } = get();
      if (future.length === 0) return;
      const next = future[0];
      const currentSnapshot = takeSnapshot({ tables, relationships });
      set({
        tables: next.tables,
        relationships: next.relationships,
        future: future.slice(1),
        past: [...get().past, currentSnapshot].slice(-MAX_HISTORY),
      });
    },

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,

    // ── Schema name ───────────────────────────────────────────────────
    setSchemaName: (name) => set({ schemaName: name }),

    // ── Derived helpers ───────────────────────────────────────────────
    getTablesArray: () => Object.values(get().tables),
    getRelationshipsArray: () => Object.values(get().relationships),
  };
});
