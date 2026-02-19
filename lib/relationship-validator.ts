import { TableSchema, ColumnType, Relationship } from "./schema-types";

// ─── Validation result ──────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// ─── Compatible type groups ─────────────────────────────────────────────────

const integerTypes: ColumnType[] = ["INT", "BIGINT", "SERIAL"];
const textTypes: ColumnType[] = ["TEXT", "VARCHAR"];
const numericTypes: ColumnType[] = ["INT", "BIGINT", "SERIAL", "FLOAT", "DECIMAL"];

function areTypesCompatible(a: ColumnType, b: ColumnType): boolean {
  if (a === b) return true;
  if (integerTypes.includes(a) && integerTypes.includes(b)) return true;
  if (textTypes.includes(a) && textTypes.includes(b)) return true;
  if (numericTypes.includes(a) && numericTypes.includes(b)) return true;
  if (a === "UUID" && b === "UUID") return true;
  return false;
}

// ─── Validate a new relationship ────────────────────────────────────────────

export function validateRelationship(
  sourceTableId: string,
  sourceColumnId: string,
  targetTableId: string,
  targetColumnId: string,
  tables: Record<string, TableSchema>,
  existingRelationships: Record<string, Relationship>,
): ValidationResult {
  // 1. Self-reference check
  if (sourceTableId === targetTableId && sourceColumnId === targetColumnId) {
    return { valid: false, error: "Cannot create a relationship from a column to itself." };
  }

  // 2. Tables must exist
  const sourceTable = tables[sourceTableId];
  const targetTable = tables[targetTableId];
  if (!sourceTable) return { valid: false, error: "Source table not found." };
  if (!targetTable) return { valid: false, error: "Target table not found." };

  // 3. Columns must exist
  const sourceCol = sourceTable.columns.find((c) => c.id === sourceColumnId);
  const targetCol = targetTable.columns.find((c) => c.id === targetColumnId);
  if (!sourceCol) return { valid: false, error: "Source column not found." };
  if (!targetCol) return { valid: false, error: "Target column not found." };

  // 4. Target should be PK or UNIQUE
  if (!targetCol.isPrimaryKey && !targetCol.isUnique) {
    return {
      valid: false,
      error: `Target column "${targetCol.name}" must be a primary key or unique.`,
    };
  }

  // 5. Compatible types
  if (!areTypesCompatible(sourceCol.type, targetCol.type)) {
    return {
      valid: false,
      error: `Incompatible types: ${sourceCol.type} → ${targetCol.type}.`,
    };
  }

  // 6. Duplicate check
  for (const rel of Object.values(existingRelationships)) {
    if (
      rel.sourceTableId === sourceTableId &&
      rel.sourceColumnId === sourceColumnId &&
      rel.targetTableId === targetTableId &&
      rel.targetColumnId === targetColumnId
    ) {
      return { valid: false, error: "This relationship already exists." };
    }
  }

  // 7. Circular FK chain check (simple — prevent A→B→A)
  for (const rel of Object.values(existingRelationships)) {
    if (
      rel.sourceTableId === targetTableId &&
      rel.targetTableId === sourceTableId
    ) {
      return {
        valid: false,
        error: `Circular reference: "${targetTable.name}" already references "${sourceTable.name}".`,
      };
    }
  }

  return { valid: true };
}
