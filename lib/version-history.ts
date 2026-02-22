import {
  TableSchema,
  Relationship,
  TableIndex,
  SchemaVersion,
} from "./schema-types";

// ─── Schema Version History Manager ─────────────────────────────────────────

const MAX_VERSIONS = 30;

export function createSchemaVersion(
  versionNumber: number,
  name: string,
  tables: TableSchema[],
  relationships: Relationship[],
  indexes: Record<string, TableIndex[]>,
  healthScore: number,
  promptScore: number | null,
  description?: string,
): SchemaVersion {
  return {
    id: `ver-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    versionNumber,
    name,
    tables: JSON.parse(JSON.stringify(tables)),
    relationships: JSON.parse(JSON.stringify(relationships)),
    indexes: JSON.parse(JSON.stringify(indexes)),
    healthScore,
    promptScore,
    timestamp: new Date().toISOString(),
    description,
  };
}

export function addVersion(
  versions: SchemaVersion[],
  newVersion: SchemaVersion,
): SchemaVersion[] {
  const updated = [...versions, newVersion];
  if (updated.length > MAX_VERSIONS) {
    return updated.slice(-MAX_VERSIONS);
  }
  return updated;
}

// ─── Schema Diff ────────────────────────────────────────────────────────────

export interface TableDiff {
  added: string[];
  removed: string[];
  modified: {
    tableName: string;
    addedCols: string[];
    removedCols: string[];
    modifiedCols: string[];
  }[];
}

export function diffVersions(
  older: SchemaVersion,
  newer: SchemaVersion,
): TableDiff {
  const oldTableNames = new Set(older.tables.map((t) => t.name));
  const newTableNames = new Set(newer.tables.map((t) => t.name));

  const added = newer.tables
    .filter((t) => !oldTableNames.has(t.name))
    .map((t) => t.name);

  const removed = older.tables
    .filter((t) => !newTableNames.has(t.name))
    .map((t) => t.name);

  const modified: TableDiff["modified"] = [];

  // Check tables that exist in both
  for (const newTable of newer.tables) {
    const oldTable = older.tables.find((t) => t.name === newTable.name);
    if (!oldTable) continue;

    const oldColNames = new Set(oldTable.columns.map((c) => c.name));
    const newColNames = new Set(newTable.columns.map((c) => c.name));

    const addedCols = newTable.columns
      .filter((c) => !oldColNames.has(c.name))
      .map((c) => c.name);

    const removedCols = oldTable.columns
      .filter((c) => !newColNames.has(c.name))
      .map((c) => c.name);

    const modifiedCols: string[] = [];
    for (const newCol of newTable.columns) {
      const oldCol = oldTable.columns.find((c) => c.name === newCol.name);
      if (oldCol) {
        if (
          oldCol.type !== newCol.type ||
          oldCol.isNullable !== newCol.isNullable ||
          oldCol.isUnique !== newCol.isUnique ||
          oldCol.isPrimaryKey !== newCol.isPrimaryKey ||
          oldCol.defaultValue !== newCol.defaultValue
        ) {
          modifiedCols.push(newCol.name);
        }
      }
    }

    if (
      addedCols.length > 0 ||
      removedCols.length > 0 ||
      modifiedCols.length > 0
    ) {
      modified.push({
        tableName: newTable.name,
        addedCols,
        removedCols,
        modifiedCols,
      });
    }
  }

  return { added, removed, modified };
}

// ─── Version score trend ────────────────────────────────────────────────────

export function computeScoreTrend(versions: SchemaVersion[]): {
  improving: boolean;
  delta: number;
} {
  if (versions.length < 2) return { improving: false, delta: 0 };

  const recent = versions.slice(-5);
  const first = recent[0].healthScore;
  const last = recent[recent.length - 1].healthScore;
  return {
    improving: last > first,
    delta: last - first,
  };
}
