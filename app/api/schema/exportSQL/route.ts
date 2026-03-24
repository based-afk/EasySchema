// POST /api/schema/exportSQL
//
// Accepts a ReactFlow schema (nodes + edges) and generates a complete
// PostgreSQL DDL script. SQL is ONLY generated here, not during schema design.
// ──────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import type { SchemaNode, SchemaEdge, ColumnDef } from "@/lib/ai/types";

// ─── SQL type map ─────────────────────────────────────────────────────────────

const SQL_TYPE_MAP: Record<string, string> = {
  SERIAL: "SERIAL",
  INT: "INTEGER",
  BIGINT: "BIGINT",
  TEXT: "TEXT",
  VARCHAR: "VARCHAR(255)",
  BOOLEAN: "BOOLEAN",
  DATE: "DATE",
  TIMESTAMP: "TIMESTAMPTZ",
  FLOAT: "FLOAT",
  DECIMAL: "DECIMAL(12,2)",
  JSON: "JSONB",
  UUID: "UUID",
};

function sqlType(t: string): string {
  return SQL_TYPE_MAP[t.toUpperCase()] ?? t;
}

// ─── Column DDL ───────────────────────────────────────────────────────────────

function columnDDL(col: ColumnDef): string {
  const parts: string[] = [`  "${col.name}" ${sqlType(col.type)}`];

  if (col.isPrimaryKey) parts.push("PRIMARY KEY");
  if (!col.isNullable && !col.isPrimaryKey) parts.push("NOT NULL");
  if (col.isUnique && !col.isPrimaryKey) parts.push("UNIQUE");
  if (col.defaultValue) parts.push(`DEFAULT ${col.defaultValue}`);

  return parts.join(" ");
}

// ─── Table DDL ────────────────────────────────────────────────────────────────

function tableDDL(node: SchemaNode): string {
  const cols = node.data.columns.map(columnDDL).join(",\n");
  return `CREATE TABLE IF NOT EXISTS "${node.data.label}" (\n${cols}\n);`;
}

// ─── Foreign key constraints ──────────────────────────────────────────────────

function fkConstraints(nodes: SchemaNode[], edges: SchemaEdge[]): string[] {
  const tableIdToName = new Map(nodes.map((n) => [n.id, n.data.label]));
  const constraints: string[] = [];

  for (const edge of edges) {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);
    if (!sourceNode || !targetNode) continue;

    const sourceCol = sourceNode.data.columns.find(
      (c) => c.id === edge.sourceHandle,
    );
    const targetCol =
      targetNode.data.columns.find((c) => c.id === edge.targetHandle) ??
      targetNode.data.columns.find((c) => c.isPrimaryKey);

    if (!sourceCol || !targetCol) continue;

    const onDelete = edge.data?.onDelete ?? "NO ACTION";
    const constraintName = `fk_${sourceNode.data.label}_${sourceCol.name}`;

    constraints.push(
      `ALTER TABLE "${sourceNode.data.label}" ADD CONSTRAINT "${constraintName}"\n` +
        `  FOREIGN KEY ("${sourceCol.name}") REFERENCES "${targetNode.data.label}" ("${targetCol.name}")\n` +
        `  ON DELETE ${onDelete};`,
    );
  }

  return constraints;
}

// ─── Index DDL ────────────────────────────────────────────────────────────────

function indexDDL(nodes: SchemaNode[], edges: SchemaEdge[]): string[] {
  const indexes: string[] = [];
  const fkCols = new Set(edges.map((e) => `${e.source}:${e.sourceHandle}`));

  for (const node of nodes) {
    for (const col of node.data.columns) {
      if (col.isPrimaryKey) continue;

      const isFkCol = fkCols.has(`${node.id}:${col.id}`);

      if (isFkCol || col.isForeignKey) {
        indexes.push(
          `CREATE INDEX IF NOT EXISTS "idx_${node.data.label}_${col.name}" ON "${node.data.label}" ("${col.name}");`,
        );
      }

      const AUTO_UNIQUE = [
        "email",
        "username",
        "slug",
        "token",
        "sku",
        "barcode",
      ];
      if (AUTO_UNIQUE.includes(col.name.toLowerCase()) && !col.isPrimaryKey) {
        indexes.push(
          `CREATE UNIQUE INDEX IF NOT EXISTS "uidx_${node.data.label}_${col.name}" ON "${node.data.label}" ("${col.name}");`,
        );
      }
    }
  }

  return indexes;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nodes, edges, dialect = "postgresql" } = body;

    if (!Array.isArray(nodes) || nodes.length === 0) {
      return NextResponse.json(
        { error: "'nodes' must be a non-empty array" },
        { status: 400 },
      );
    }

    const typedNodes = nodes as SchemaNode[];
    const typedEdges = (edges ?? []) as SchemaEdge[];

    const sections: string[] = [
      "-- ═══════════════════════════════════════════════════════════════",
      "-- EasySchema — Generated SQL (PostgreSQL)",
      `-- Generated at: ${new Date().toISOString()}`,
      "-- ═══════════════════════════════════════════════════════════════",
      "",
      "-- Extensions",
      'CREATE EXTENSION IF NOT EXISTS "pgcrypto";',
      "",
      "-- ─── Tables ─────────────────────────────────────────────────────",
      "",
      ...typedNodes.map((n) => tableDDL(n) + "\n"),
    ];

    const fks = fkConstraints(typedNodes, typedEdges);
    if (fks.length > 0) {
      sections.push(
        "-- ─── Foreign Keys ───────────────────────────────────────────────",
        "",
        ...fks.map((f) => f + "\n"),
      );
    }

    const idxs = indexDDL(typedNodes, typedEdges);
    if (idxs.length > 0) {
      sections.push(
        "-- ─── Indexes ────────────────────────────────────────────────────",
        "",
        ...idxs.map((i) => i + "\n"),
      );
    }

    const sql = sections.join("\n");

    return NextResponse.json({
      sql,
      tableCount: typedNodes.length,
      edgeCount: typedEdges.length,
    });
  } catch (error) {
    console.error("[/api/schema/exportSQL] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate SQL. " + String(error) },
      { status: 500 },
    );
  }
}
