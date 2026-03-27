import { create } from "zustand";
import {
  TableSchema,
  Column,
  Relationship,
  SchemaSnapshot,
  SelectionState,
  TableIndex,
  SchemaHealthResult,
  SchemaVersion,
  PromptVersion,
  PromptAnalysis,
} from "./schema-types";
import { computeSchemaHealth } from "./schema-health";
import { createSchemaVersion, addVersion } from "./version-history";
import { emitRtcEvent } from "@/lib/rtc/emitter";
import { getRtcDisplayName } from "@/lib/rtc/client";

// ─── History helpers ────────────────────────────────────────────────────────

const MAX_HISTORY = 50;

function takeSnapshot(state: {
  tables: Record<string, TableSchema>;
  relationships: Record<string, Relationship>;
}): SchemaSnapshot {
  return JSON.parse(
    JSON.stringify({
      tables: state.tables,
      relationships: state.relationships,
    }),
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

  // ── Indexes ───────────────────────────────────────────────────────────
  indexes: Record<string, TableIndex[]>;

  // ── Schema Health ─────────────────────────────────────────────────────
  healthResult: SchemaHealthResult | null;

  // ── RTC ───────────────────────────────────────────────────────────────
  rtcMuted: boolean;
  setRtcMuted: (value: boolean) => void;

  // ── Version History ───────────────────────────────────────────────────
  schemaVersions: SchemaVersion[];

  // ── Prompt Intelligence ───────────────────────────────────────────────
  promptHistory: PromptVersion[];
  currentPromptAnalysis: PromptAnalysis | null;

  // ── Table actions ─────────────────────────────────────────────────────
  addTable: (table: TableSchema, options?: { remote?: boolean }) => void;
  deleteTable: (tableId: string, options?: { remote?: boolean }) => void;
  updateTableName: (
    tableId: string,
    name: string,
    options?: { remote?: boolean },
  ) => void;
  updateTablePosition: (
    tableId: string,
    position: { x: number; y: number },
  ) => void;
  setTables: (tables: TableSchema[], options?: { remote?: boolean }) => void;
  setSchemaSnapshot: (
    snapshot: {
      tables: TableSchema[];
      relationships: Relationship[];
      indexes: Record<string, TableIndex[]>;
    },
    options?: { remote?: boolean },
  ) => void;

  // ── Column actions ────────────────────────────────────────────────────
  addColumn: (
    tableId: string,
    column?: Partial<Column>,
    options?: { remote?: boolean },
  ) => void;
  deleteColumn: (
    tableId: string,
    columnId: string,
    options?: { remote?: boolean },
  ) => void;
  updateColumn: (
    tableId: string,
    columnId: string,
    patch: Partial<Column>,
    options?: { remote?: boolean },
  ) => void;

  // ── Relationship actions ──────────────────────────────────────────────
  addRelationship: (rel: Relationship, options?: { remote?: boolean }) => void;
  deleteRelationship: (relId: string, options?: { remote?: boolean }) => void;
  updateRelationship: (
    relId: string,
    patch: Partial<Relationship>,
    options?: { remote?: boolean },
  ) => void;

  // ── Index actions ─────────────────────────────────────────────────────
  addIndex: (tableId: string, index: TableIndex) => void;
  deleteIndex: (tableId: string, indexId: string) => void;
  updateIndex: (
    tableId: string,
    indexId: string,
    patch: Partial<TableIndex>,
  ) => void;
  getTableIndexes: (tableId: string) => TableIndex[];

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

  // ── Schema Health ─────────────────────────────────────────────────────
  recomputeHealth: () => void;

  // ── Version History ───────────────────────────────────────────────────
  saveVersion: (description?: string) => void;
  getVersions: () => SchemaVersion[];

  // ── Prompt Intelligence ───────────────────────────────────────────────
  addPromptVersion: (version: PromptVersion) => void;
  setPromptAnalysis: (analysis: PromptAnalysis) => void;
  getPromptHistory: () => PromptVersion[];

  // ── Derived helpers ───────────────────────────────────────────────────
  getTablesArray: () => TableSchema[];
  getRelationshipsArray: () => Relationship[];
}

// ─── Store implementation ───────────────────────────────────────────────────

export const useSchemaStore = create<SchemaStore>((set, get) => {
  let lastEditSignal = 0;
  let editTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Push current state onto the undo stack before mutating */
  function pushHistory() {
    const { tables, relationships, past } = get();
    const snapshot = takeSnapshot({ tables, relationships });
    set({
      past: [...past.slice(-(MAX_HISTORY - 1)), snapshot],
      future: [],
    });
  }

  function shouldEmit(options?: { remote?: boolean }) {
    return !options?.remote && !get().rtcMuted;
  }

  function signalEditing() {
    if (typeof window === "undefined") return;
    const now = Date.now();
    if (now - lastEditSignal > 1000) {
      emitRtcEvent("EDITOR_STATUS", {
        scope: "schema",
        isEditing: true,
        name: getRtcDisplayName(),
      });
      lastEditSignal = now;
    }
    if (editTimeout) {
      clearTimeout(editTimeout);
    }
    editTimeout = setTimeout(() => {
      emitRtcEvent("EDITOR_STATUS", {
        scope: "schema",
        isEditing: false,
        name: getRtcDisplayName(),
      });
    }, 2000);
  }

  return {
    // ── Initial state ─────────────────────────────────────────────────
    tables: {},
    relationships: {},
    schemaName: "Untitled Schema",
    selection: { tableId: null, columnId: null, relationshipId: null },
    past: [],
    future: [],
    indexes: {},
    healthResult: null,
    rtcMuted: false,
    schemaVersions: [],
    promptHistory: [],
    currentPromptAnalysis: null,
    setRtcMuted: (value) => set({ rtcMuted: value }),

    // ── Table actions ─────────────────────────────────────────────────
    addTable: (table, options) => {
      if (!options?.remote) pushHistory();
      set((s) => ({
        tables: { ...s.tables, [table.id]: table },
      }));
      if (shouldEmit(options)) {
        signalEditing();
        emitRtcEvent("ADD_TABLE", { table });
      }
    },

    deleteTable: (tableId, options) => {
      if (!options?.remote) pushHistory();
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
      if (shouldEmit(options)) {
        signalEditing();
        emitRtcEvent("DELETE_TABLE", { tableId });
      }
    },

    updateTableName: (tableId, name, options) => {
      if (!options?.remote) pushHistory();
      set((s) => {
        const table = s.tables[tableId];
        if (!table) return s;
        return {
          tables: { ...s.tables, [tableId]: { ...table, name } },
        };
      });
      if (shouldEmit(options)) {
        signalEditing();
        emitRtcEvent("UPDATE_TABLE_NAME", { tableId, name });
      }
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

    setTables: (tablesArr, options) => {
      if (!options?.remote) pushHistory();
      const previousTables = get().tables;
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
      if (shouldEmit(options)) {
        signalEditing();
        const previousIds = new Set(Object.keys(previousTables));
        const nextIds = new Set(tablesArr.map((t) => t.id));

        for (const id of previousIds) {
          if (!nextIds.has(id)) {
            emitRtcEvent("DELETE_TABLE", { tableId: id });
          }
        }

        for (const table of tablesArr) {
          emitRtcEvent("ADD_TABLE", { table });
        }

        for (const rel of Object.values(rels)) {
          emitRtcEvent("CREATE_RELATIONSHIP", { relationship: rel });
        }
      }
    },

    setSchemaSnapshot: (snapshot, options) => {
      if (!options?.remote) pushHistory();
      const tablesMap: Record<string, TableSchema> = {};
      for (const t of snapshot.tables) {
        tablesMap[t.id] = t;
      }
      const rels: Record<string, Relationship> = {};
      for (const rel of snapshot.relationships) {
        rels[rel.id] = rel;
      }
      set({
        tables: tablesMap,
        relationships: rels,
        indexes: snapshot.indexes ?? {},
      });
    },

    // ── Column actions ────────────────────────────────────────────────
    addColumn: (tableId, partial, options) => {
      if (!options?.remote) pushHistory();
      let created: Column | null = null;
      set((s) => {
        const table = s.tables[tableId];
        if (!table) return s;
        const newCol: Column = {
          id:
            partial?.id ??
            `col-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: "new_column",
          type: "VARCHAR",
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: true,
          isUnique: false,
          ...partial,
        };
        created = newCol;
        return {
          tables: {
            ...s.tables,
            [tableId]: { ...table, columns: [...table.columns, newCol] },
          },
        };
      });
      if (shouldEmit(options) && created) {
        signalEditing();
        emitRtcEvent("ADD_COLUMN", { tableId, column: created });
      }
    },

    deleteColumn: (tableId, columnId, options) => {
      if (!options?.remote) pushHistory();
      set((s) => {
        const table = s.tables[tableId];
        if (!table) return s;
        // Remove associated relationships
        const rels = { ...s.relationships };
        for (const [id, rel] of Object.entries(rels)) {
          if (
            (rel.sourceTableId === tableId &&
              rel.sourceColumnId === columnId) ||
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
      if (shouldEmit(options)) {
        signalEditing();
        emitRtcEvent("DELETE_COLUMN", { tableId, columnId });
      }
    },

    updateColumn: (tableId, columnId, patch, options) => {
      if (!options?.remote) pushHistory();
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
      if (shouldEmit(options)) {
        signalEditing();
        emitRtcEvent("UPDATE_COLUMN", { tableId, columnId, patch });
      }
    },

    // ── Relationship actions ──────────────────────────────────────────
    addRelationship: (rel, options) => {
      if (!options?.remote) pushHistory();
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
      if (shouldEmit(options)) {
        signalEditing();
        emitRtcEvent("CREATE_RELATIONSHIP", { relationship: rel });
      }
    },

    deleteRelationship: (relId, options) => {
      if (!options?.remote) pushHistory();
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
      if (shouldEmit(options)) {
        signalEditing();
        emitRtcEvent("DELETE_RELATIONSHIP", { relationshipId: relId });
      }
    },

    updateRelationship: (relId, patch, options) => {
      if (!options?.remote) pushHistory();
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
      if (shouldEmit(options)) {
        signalEditing();
        emitRtcEvent("UPDATE_RELATIONSHIP", { relationshipId: relId, patch });
      }
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

    // ── Index actions ─────────────────────────────────────────────────
    addIndex: (tableId, index) => {
      pushHistory();
      set((s) => {
        const current = s.indexes[tableId] ?? [];
        return {
          indexes: { ...s.indexes, [tableId]: [...current, index] },
        };
      });
    },

    deleteIndex: (tableId, indexId) => {
      pushHistory();
      set((s) => {
        const current = s.indexes[tableId] ?? [];
        return {
          indexes: {
            ...s.indexes,
            [tableId]: current.filter((idx) => idx.id !== indexId),
          },
        };
      });
    },

    updateIndex: (tableId, indexId, patch) => {
      pushHistory();
      set((s) => {
        const current = s.indexes[tableId] ?? [];
        return {
          indexes: {
            ...s.indexes,
            [tableId]: current.map((idx) =>
              idx.id === indexId ? { ...idx, ...patch } : idx,
            ),
          },
        };
      });
    },

    getTableIndexes: (tableId) => get().indexes[tableId] ?? [],

    // ── Schema Health ─────────────────────────────────────────────────
    recomputeHealth: () => {
      const { tables, relationships, indexes } = get();
      const tablesArr = Object.values(tables);
      const relsArr = Object.values(relationships);
      const result = computeSchemaHealth(tablesArr, relsArr, indexes);
      set({ healthResult: result });
    },

    // ── Version History ───────────────────────────────────────────────
    saveVersion: (description) => {
      const {
        tables,
        relationships,
        indexes,
        schemaName,
        schemaVersions,
        healthResult,
      } = get();
      const tablesArr = Object.values(tables);
      const relsArr = Object.values(relationships);
      const health =
        healthResult ?? computeSchemaHealth(tablesArr, relsArr, indexes);
      const versionNumber = schemaVersions.length + 1;
      const version = createSchemaVersion(
        versionNumber,
        schemaName,
        tablesArr,
        relsArr,
        indexes,
        health.totalScore,
        null,
        description,
      );
      set({ schemaVersions: addVersion(schemaVersions, version) });
    },

    getVersions: () => get().schemaVersions,

    // ── Prompt Intelligence ───────────────────────────────────────────
    addPromptVersion: (version) => {
      set((s) => ({ promptHistory: [...s.promptHistory, version] }));
    },

    setPromptAnalysis: (analysis) => {
      set({ currentPromptAnalysis: analysis });
    },

    getPromptHistory: () => get().promptHistory,

    // ── Derived helpers ───────────────────────────────────────────────
    getTablesArray: () => Object.values(get().tables),
    getRelationshipsArray: () => Object.values(get().relationships),
  };
});
