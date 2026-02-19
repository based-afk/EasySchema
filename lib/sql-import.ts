import { TableSchema, Column, ColumnType } from "./schema-types";

// ─── SQL Import Parser ──────────────────────────────────────────────────────
// Parses CREATE TABLE statements from PostgreSQL / MySQL / SQLite SQL dumps.

export function importSQL(sql: string): TableSchema[] {
  const tables: TableSchema[] = [];
  // Match CREATE TABLE statements
  const createRegex =
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?\s*\(([\s\S]*?)\);/gi;

  let match: RegExpExecArray | null;
  let tableIdx = 0;

  while ((match = createRegex.exec(sql)) !== null) {
    const tableName = match[1];
    const body = match[2];
    const columns: Column[] = [];
    const pkColumns = new Set<string>();
    const uniqueColumns = new Set<string>();
    const fkRefs: { colName: string; refTable: string; refCol: string }[] = [];

    // Parse inline constraints first to gather PKs, UNIQUEs, FKs
    const constraintRegex =
      /(?:CONSTRAINT\s+\w+\s+)?PRIMARY\s+KEY\s*\(([^)]+)\)/gi;
    let cm: RegExpExecArray | null;
    while ((cm = constraintRegex.exec(body)) !== null) {
      cm[1].split(",").forEach((c) => pkColumns.add(c.trim().replace(/[`"']/g, "")));
    }

    const uniqueConstraintRegex =
      /(?:CONSTRAINT\s+\w+\s+)?UNIQUE\s*\(([^)]+)\)/gi;
    while ((cm = uniqueConstraintRegex.exec(body)) !== null) {
      cm[1].split(",").forEach((c) => uniqueColumns.add(c.trim().replace(/[`"']/g, "")));
    }

    const fkRegex =
      /(?:CONSTRAINT\s+\w+\s+)?FOREIGN\s+KEY\s*\([`"']?(\w+)[`"']?\)\s*REFERENCES\s+[`"']?(\w+)[`"']?\s*\([`"']?(\w+)[`"']?\)/gi;
    while ((cm = fkRegex.exec(body)) !== null) {
      fkRefs.push({ colName: cm[1], refTable: cm[2], refCol: cm[3] });
    }

    // Parse column definitions
    const lines = body.split(",").map((l) => l.trim()).filter(Boolean);

    for (const line of lines) {
      // Skip standalone constraints
      if (
        /^\s*(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CONSTRAINT|INDEX|CHECK)/i.test(line)
      ) {
        continue;
      }

      const colMatch = line.match(
        /^[`"']?(\w+)[`"']?\s+(\w+(?:\([^)]*\))?)/i,
      );
      if (!colMatch) continue;

      const colName = colMatch[1];
      const rawType = colMatch[2].toUpperCase();
      const colType = mapImportType(rawType);
      const upperLine = line.toUpperCase();

      const isPK =
        pkColumns.has(colName) || upperLine.includes("PRIMARY KEY");
      const isUnique =
        uniqueColumns.has(colName) ||
        (upperLine.includes("UNIQUE") && !upperLine.includes("UNIQUE("));
      const isNullable =
        !upperLine.includes("NOT NULL") && !isPK;
      const isAutoInc =
        upperLine.includes("AUTO_INCREMENT") ||
        upperLine.includes("AUTOINCREMENT") ||
        rawType === "SERIAL";

      // Default value
      let defaultValue: string | undefined;
      const defMatch = line.match(/DEFAULT\s+([^\s,]+)/i);
      if (defMatch) defaultValue = defMatch[1];

      // FK reference from inline REFERENCES
      let references: { table: string; column: string } | undefined;
      const inlineRef = line.match(
        /REFERENCES\s+[`"']?(\w+)[`"']?\s*\([`"']?(\w+)[`"']?\)/i,
      );
      if (inlineRef) {
        references = { table: inlineRef[1], column: inlineRef[2] };
      }
      // Check table-level FK
      const fk = fkRefs.find((f) => f.colName === colName);
      if (fk && !references) {
        references = { table: fk.refTable, column: fk.refCol };
      }

      const isForeignKey = !!references;

      columns.push({
        id: `imp-${tableName}-${colName}`,
        name: colName,
        type: isAutoInc && !isPK ? colType : isAutoInc ? "SERIAL" : colType,
        isPrimaryKey: isPK,
        isForeignKey,
        isNullable,
        isUnique: isUnique || isPK,
        defaultValue,
        references,
      });
    }

    if (columns.length > 0) {
      tables.push({
        id: tableName,
        name: tableName,
        columns,
        position: {
          x: 100 + (tableIdx % 3) * 350,
          y: 100 + Math.floor(tableIdx / 3) * 300,
        },
      });
      tableIdx++;
    }
  }

  return tables;
}

// ─── Map raw SQL type to our ColumnType ─────────────────────────────────────

function mapImportType(raw: string): ColumnType {
  const base = raw.replace(/\(.*\)/, "").trim();
  const map: Record<string, ColumnType> = {
    INT: "INT",
    INTEGER: "INT",
    SMALLINT: "INT",
    MEDIUMINT: "INT",
    TINYINT: "INT",
    BIGINT: "BIGINT",
    SERIAL: "SERIAL",
    TEXT: "TEXT",
    LONGTEXT: "TEXT",
    MEDIUMTEXT: "TEXT",
    TINYTEXT: "TEXT",
    VARCHAR: "VARCHAR",
    CHAR: "VARCHAR",
    BOOLEAN: "BOOLEAN",
    BOOL: "BOOLEAN",
    DATE: "DATE",
    DATETIME: "TIMESTAMP",
    TIMESTAMP: "TIMESTAMP",
    FLOAT: "FLOAT",
    DOUBLE: "FLOAT",
    REAL: "FLOAT",
    DECIMAL: "DECIMAL",
    NUMERIC: "DECIMAL",
    JSON: "JSON",
    JSONB: "JSON",
    UUID: "UUID",
  };
  return map[base] ?? "VARCHAR";
}
