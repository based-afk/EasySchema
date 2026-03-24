// ─── Index Suggestions ────────────────────────────────────────────────────────
//
// Analyzes schema nodes and edges to recommend database indexes that will
// improve query performance.
// ─────────────────────────────────────────────────────────────────────────────

import type { SchemaNode, SchemaEdge } from "../ai/types";

export interface IndexSuggestion {
  table: string;
  column: string;
  type: "btree" | "unique" | "composite";
  reason: string;
}

// Columns that almost always need an index
const AUTO_INDEX_PATTERNS = [
  {
    pattern: /^email$/i,
    type: "unique" as const,
    reason: "Email lookups require unique index for fast auth queries",
  },
  {
    pattern: /^username$/i,
    type: "unique" as const,
    reason: "Username lookups for login/profile require unique index",
  },
  {
    pattern: /^slug$/i,
    type: "unique" as const,
    reason: "URL slug lookups require unique index",
  },
  {
    pattern: /^status$/i,
    type: "btree" as const,
    reason: "Status filtering is a common query pattern",
  },
  {
    pattern: /^created_at$/i,
    type: "btree" as const,
    reason: "Date-range queries on created_at benefit from a btree index",
  },
  {
    pattern: /^published_at$/i,
    type: "btree" as const,
    reason: "Sorting and filtering by publish date requires index",
  },
  {
    pattern: /^starts_at$/i,
    type: "btree" as const,
    reason: "Time-based range queries need index",
  },
  {
    pattern: /^ends_at$/i,
    type: "btree" as const,
    reason: "Time-based range queries need index",
  },
  {
    pattern: /^type$/i,
    type: "btree" as const,
    reason: "Type discriminator columns are frequently filtered",
  },
  {
    pattern: /^role$/i,
    type: "btree" as const,
    reason: "Role-based filtering benefits from index",
  },
  {
    pattern: /^token$/i,
    type: "unique" as const,
    reason: "Token lookups (auth, reset) require unique index",
  },
  {
    pattern: /^sku$/i,
    type: "unique" as const,
    reason: "SKU lookups require unique index for inventory",
  },
  {
    pattern: /^barcode$/i,
    type: "unique" as const,
    reason: "Barcode scans require unique index",
  },
];

/**
 * Generate index recommendations for the schema.
 */
export function generateIndexSuggestions(
  nodes: SchemaNode[],
  edges: SchemaEdge[],
): string[] {
  const suggestions: string[] = [];

  for (const node of nodes) {
    const tableName = node.data.label;

    // 1. Foreign key columns always need indexes
    for (const col of node.data.columns) {
      if (col.isForeignKey) {
        suggestions.push(
          `CREATE INDEX idx_${node.id}_${col.name} ON ${tableName} (${col.name}); — Foreign key column needs index to speed up JOIN and CASCADE operations.`,
        );
      }
    }

    // 2. Auto-index well-known columns
    for (const col of node.data.columns) {
      if (col.isPrimaryKey || col.isForeignKey) continue;
      for (const { pattern, type, reason } of AUTO_INDEX_PATTERNS) {
        if (pattern.test(col.name)) {
          const directive =
            type === "unique" ? "CREATE UNIQUE INDEX" : "CREATE INDEX";
          suggestions.push(
            `${directive} idx_${node.id}_${col.name} ON ${tableName} (${col.name}); — ${reason}.`,
          );
          break;
        }
      }
    }

    // 3. Composite index for common filter+sort patterns
    const statusCol = node.data.columns.find((c) => /^status$/i.test(c.name));
    const createdCol = node.data.columns.find((c) =>
      /^created_at$/i.test(c.name),
    );
    if (statusCol && createdCol) {
      suggestions.push(
        `CREATE INDEX idx_${node.id}_status_created ON ${tableName} (status, created_at); — Composite index for "filter by status + sort by date" queries.`,
      );
    }

    // 4. Full-text search hints for TEXT columns
    const textCols = node.data.columns.filter(
      (c) => c.type === "TEXT" && !c.isPrimaryKey && c.name !== "body",
    );
    if (
      textCols.length > 0 &&
      ["posts", "articles", "products", "documents"].includes(node.id)
    ) {
      suggestions.push(
        `Consider a GIN index on ${tableName} for full-text search across (${textCols.map((c) => c.name).join(", ")}).`,
      );
    }
  }

  return suggestions;
}

/**
 * Returns structured index suggestions (for programmatic use).
 */
export function getStructuredIndexSuggestions(
  nodes: SchemaNode[],
  edges: SchemaEdge[],
): IndexSuggestion[] {
  const result: IndexSuggestion[] = [];

  for (const node of nodes) {
    for (const col of node.data.columns) {
      if (col.isForeignKey) {
        result.push({
          table: node.id,
          column: col.name,
          type: "btree",
          reason: "Foreign key — needed for JOIN performance",
        });
      }
      for (const { pattern, type, reason } of AUTO_INDEX_PATTERNS) {
        if (pattern.test(col.name) && !col.isPrimaryKey && !col.isForeignKey) {
          result.push({ table: node.id, column: col.name, type, reason });
          break;
        }
      }
    }
  }

  return result;
}
