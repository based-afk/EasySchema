// ─── Normalization Hints ──────────────────────────────────────────────────────
//
// Analyzes schema nodes for common normalization violations and generates
// actionable hints (1NF, 2NF, 3NF violations).
// ─────────────────────────────────────────────────────────────────────────────

import type { SchemaNode } from "../ai/types";

// Patterns that suggest denormalization or 1NF violation
const MULTI_VALUE_PATTERNS = [
  /tags$/i,
  /categories$/i,
  /list$/i,
  /array$/i,
  /csv$/i,
  /ids$/i,
  /codes$/i,
  /types$/i,
];

// Column naming patterns that suggest a separate table is needed
const COMPUTED_COLUMN_PATTERNS = [
  /total_count$/i,
  /item_count$/i,
  /total_price$/i,
  /full_name$/i,
  /_percentage$/i,
  /_ratio$/i,
];

// Patterns that might indicate 2NF partial dependency
const PARTIAL_DEPENDENCY_PATTERNS = [
  { table: /order_items/, suspect: /product_name|product_price/ },
  { table: /cart_items/, suspect: /product_name|price/ },
  { table: /invoice_items/, suspect: /description|unit_price/ },
];

/**
 * Generate normalization hints for a given schema.
 */
export function generateNormalizationHints(nodes: SchemaNode[]): string[] {
  const hints: string[] = [];

  for (const node of nodes) {
    const tableName = node.id.toLowerCase();
    const colNames = node.data.columns.map((c) => c.name.toLowerCase());

    // 1NF: Check for multi-value columns
    for (const col of node.data.columns) {
      const colLower = col.name.toLowerCase();
      if (MULTI_VALUE_PATTERNS.some((p) => p.test(colLower))) {
        hints.push(
          `[1NF] "${node.data.label}.${col.name}" may store multiple values — consider a junction/child table instead.`,
        );
      }
    }

    // 1NF: Check for columns named like "address1", "address2", "phone1", "phone2"
    const numberedCols = colNames.filter((c) => /[a-z]_?[12]$/.test(c));
    if (numberedCols.length >= 2) {
      hints.push(
        `[1NF] "${node.data.label}" has numbered columns (${numberedCols.join(", ")}) — normalize into a child table.`,
      );
    }

    // 2NF: Check for partial dependencies in composite-key-prone tables
    for (const { table, suspect } of PARTIAL_DEPENDENCY_PATTERNS) {
      if (table.test(tableName)) {
        const suspected = node.data.columns.filter((c) => suspect.test(c.name));
        if (suspected.length > 0) {
          hints.push(
            `[2NF] "${node.data.label}" contains columns (${suspected.map((c) => c.name).join(", ")}) that depend on the referenced entity, not the composite key — consider denoting them via JOIN instead.`,
          );
        }
      }
    }

    // 3NF: Check for computed / derived columns
    for (const col of node.data.columns) {
      if (COMPUTED_COLUMN_PATTERNS.some((p) => p.test(col.name))) {
        hints.push(
          `[3NF] "${node.data.label}.${col.name}" appears to be a computed/derived column — remove it and compute at query time to avoid update anomalies.`,
        );
      }
    }

    // 3NF: Check for transitive dependency indicators (status_label alongside status_code)
    const hasBothCodeAndLabel =
      colNames.some((c) => c.endsWith("_code")) &&
      colNames.some((c) => c.endsWith("_label") || c.endsWith("_name"));
    if (hasBothCodeAndLabel) {
      hints.push(
        `[3NF] "${node.data.label}" may have transitive dependencies (code + label columns) — consider a lookup/reference table.`,
      );
    }

    // Missing timestamps
    const hasCreatedAt = colNames.includes("created_at");
    if (!hasCreatedAt && node.data.columns.length > 2) {
      hints.push(
        `"${node.data.label}" is missing a created_at timestamp — add one to track record creation time.`,
      );
    }
  }

  return hints;
}
