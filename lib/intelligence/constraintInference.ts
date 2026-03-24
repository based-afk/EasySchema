// ─── Constraint Inference ─────────────────────────────────────────────────────
//
// Infers appropriate ON DELETE behaviors and column constraints
// based on table/column naming conventions.
// ─────────────────────────────────────────────────────────────────────────────

import type { SchemaNode, SchemaEdge } from "../ai/types";

export interface InferredConstraint {
  sourceTable: string;
  targetTable: string;
  onDelete: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
  reason: string;
}

// Tables where CASCADE delete is safe (child records follow parent)
const CASCADE_TARGETS = new Set([
  "order_items",
  "order_lines",
  "cart_items",
  "wishlist_items",
  "post_tags",
  "post_categories",
  "article_tags",
  "comment_votes",
  "task_assignments",
  "task_comments",
  "attachments",
  "message_reads",
  "lesson_progress",
  "course_modules",
  "medical_records",
  "reservation_guests",
  "hotel_rooms",
  "room_amenities",
  "shipment_items",
  "shipment_tracking",
  "stock_levels",
  "recipe_ingredients",
  "recipe_steps",
  "menu_items",
  "order_lines",
  "follows",
  "likes",
  "sessions",
  "notifications",
  "audit_logs",
]);

// Tables where we should SET NULL (keep the record, remove reference)
const SET_NULL_TARGETS = new Set([
  "orders",
  "invoices",
  "payments",
  "subscriptions",
  "appointments",
  "reservations",
  "bookings",
]);

// Tables where we should RESTRICT (prevent deletion)
const RESTRICT_TARGETS = new Set([
  "products",
  "users",
  "employees",
  "customers",
  "warehouses",
  "suppliers",
  "accounts",
]);

/**
 * Given the list of nodes and edges in a schema, infer constraint recommendations.
 */
export function inferConstraints(
  nodes: SchemaNode[],
  edges?: SchemaEdge[],
): InferredConstraint[] {
  const result: InferredConstraint[] = [];
  const nodeIds = new Set(nodes.map((n) => n.id));

  for (const node of nodes) {
    const tableName = node.id.toLowerCase();

    // Find FK columns in this table
    for (const col of node.data.columns) {
      if (!col.isForeignKey) continue;

      // Infer target table from FK column naming
      const refTable = col.name.replace(/_id$/, "");
      if (!nodeIds.has(refTable)) continue;

      let onDelete: InferredConstraint["onDelete"] = "NO ACTION";
      let reason = "Default behavior";

      if (CASCADE_TARGETS.has(tableName)) {
        onDelete = "CASCADE";
        reason = `${tableName} is a child/detail table — cascade deletes are appropriate`;
      } else if (SET_NULL_TARGETS.has(tableName)) {
        onDelete = "SET NULL";
        reason = `${tableName} should preserve records even when referenced entity is deleted`;
      } else if (RESTRICT_TARGETS.has(refTable)) {
        onDelete = "RESTRICT";
        reason = `${refTable} is a core entity — prevent accidental deletion`;
      } else if (tableName.endsWith("_items") || tableName.endsWith("_lines")) {
        onDelete = "CASCADE";
        reason = "Line/item tables typically cascade with their parent";
      }

      result.push({
        sourceTable: node.id,
        targetTable: refTable,
        onDelete,
        reason,
      });
    }
  }

  return result;
}

/**
 * Generate human-readable constraint suggestions for the schema health report.
 */
export function generateConstraintSuggestions(nodes: SchemaNode[]): string[] {
  const suggestions: string[] = [];

  for (const node of nodes) {
    const hasCreatedAt = node.data.columns.some((c) => c.name === "created_at");
    const hasUpdatedAt = node.data.columns.some((c) => c.name === "updated_at");

    if (!hasCreatedAt) {
      suggestions.push(
        `Table "${node.data.label}" is missing a created_at timestamp column.`,
      );
    }
    if (
      !hasUpdatedAt &&
      ["users", "products", "orders", "accounts"].includes(node.id)
    ) {
      suggestions.push(
        `Table "${node.data.label}" should include an updated_at timestamp.`,
      );
    }

    const pkCols = node.data.columns.filter((c) => c.isPrimaryKey);
    if (pkCols.length === 0) {
      suggestions.push(
        `Table "${node.data.label}" has no primary key — add an id SERIAL PRIMARY KEY.`,
      );
    }
  }

  return suggestions;
}
