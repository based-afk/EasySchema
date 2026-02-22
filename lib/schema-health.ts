import {
  TableSchema,
  Relationship,
  TableIndex,
  SchemaHealthResult,
  SchemaIssue,
  IssueSeverity,
  IssueCategory,
} from "./schema-types";

// ─── Schema Health Rule Engine ──────────────────────────────────────────────
//
// Scoring Categories:
//   Structural (40 points) — Missing PK, duplicate names, unreferenced, circular
//   Performance (30 points) — Missing FK index, too many columns, deep chains
//   Design     (30 points) — No timestamps, inconsistent naming, nullable misuse
// ─────────────────────────────────────────────────────────────────────────────

let issueCounter = 0;
function issueId(): string {
  return `issue-${++issueCounter}`;
}

function makeIssue(
  category: IssueCategory,
  severity: IssueSeverity,
  title: string,
  description: string,
  suggestion?: string,
  tableId?: string,
  columnId?: string,
): SchemaIssue {
  return {
    id: issueId(),
    category,
    severity,
    tableId,
    columnId,
    title,
    description,
    suggestion,
  };
}

// ─── Structural Checks (max 40) ────────────────────────────────────────────

function checkStructural(
  tables: TableSchema[],
  relationships: Relationship[],
): { score: number; issues: SchemaIssue[] } {
  const issues: SchemaIssue[] = [];
  let deductions = 0;

  if (tables.length === 0) {
    return {
      score: 0,
      issues: [
        makeIssue(
          "structural",
          "info",
          "No tables",
          "Schema has no tables yet.",
        ),
      ],
    };
  }

  // 1. Missing Primary Key (−8 per table)
  for (const table of tables) {
    const hasPK = table.columns.some((c) => c.isPrimaryKey);
    if (!hasPK) {
      deductions += 8;
      issues.push(
        makeIssue(
          "structural",
          "error",
          "Missing Primary Key",
          `Table "${table.name}" has no primary key defined.`,
          "Add a primary key column (e.g., id SERIAL PRIMARY KEY).",
          table.id,
        ),
      );
    }
  }

  // 2. Duplicate table names (−10 per duplicate pair)
  const nameCounts: Record<string, string[]> = {};
  for (const table of tables) {
    const lower = table.name.toLowerCase();
    if (!nameCounts[lower]) nameCounts[lower] = [];
    nameCounts[lower].push(table.id);
  }
  for (const [name, ids] of Object.entries(nameCounts)) {
    if (ids.length > 1) {
      deductions += 10;
      issues.push(
        makeIssue(
          "structural",
          "error",
          "Duplicate Table Name",
          `Table name "${name}" is used ${ids.length} times.`,
          "Rename tables to have unique names.",
        ),
      );
    }
  }

  // 3. Unreferenced tables (island tables) (−3 per table, max −9)
  const referencedTableIds = new Set<string>();
  for (const rel of relationships) {
    referencedTableIds.add(rel.sourceTableId);
    referencedTableIds.add(rel.targetTableId);
  }
  // Also check FK references in columns
  for (const table of tables) {
    for (const col of table.columns) {
      if (col.isForeignKey && col.references) {
        referencedTableIds.add(table.id);
        referencedTableIds.add(col.references.table);
      }
    }
  }

  if (tables.length > 1) {
    let unreferencedCount = 0;
    for (const table of tables) {
      if (!referencedTableIds.has(table.id)) {
        unreferencedCount++;
        if (unreferencedCount <= 3) {
          deductions += 3;
        }
        issues.push(
          makeIssue(
            "structural",
            "warning",
            "Unreferenced Table",
            `Table "${table.name}" has no relationships to other tables.`,
            "Consider adding foreign key relationships or removing if unused.",
            table.id,
          ),
        );
      }
    }
  }

  // 4. Circular relationship chains (−5 per cycle)
  const adjacency: Record<string, Set<string>> = {};
  for (const rel of relationships) {
    if (!adjacency[rel.sourceTableId]) adjacency[rel.sourceTableId] = new Set();
    adjacency[rel.sourceTableId].add(rel.targetTableId);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();
  let hasCycle = false;

  function dfs(node: string): boolean {
    if (inStack.has(node)) return true;
    if (visited.has(node)) return false;
    visited.add(node);
    inStack.add(node);
    for (const neighbor of adjacency[node] ?? []) {
      if (dfs(neighbor)) return true;
    }
    inStack.delete(node);
    return false;
  }

  for (const tableId of Object.keys(adjacency)) {
    if (dfs(tableId)) {
      hasCycle = true;
      break;
    }
  }

  if (hasCycle) {
    deductions += 5;
    issues.push(
      makeIssue(
        "structural",
        "warning",
        "Circular Relationship",
        "Schema contains a circular FK reference chain.",
        "Review relationships to break the cycle or confirm it's intentional.",
      ),
    );
  }

  // 5. Empty tables (−2 per table, only counting columns beyond PK)
  for (const table of tables) {
    const nonPKCols = table.columns.filter((c) => !c.isPrimaryKey);
    if (nonPKCols.length === 0 && table.columns.length <= 1) {
      deductions += 2;
      issues.push(
        makeIssue(
          "structural",
          "warning",
          "Minimal Table",
          `Table "${table.name}" only has a primary key and no other columns.`,
          "Add columns that represent the entity's attributes.",
          table.id,
        ),
      );
    }
  }

  const score = Math.max(0, 40 - deductions);
  return { score, issues };
}

// ─── Performance Checks (max 30) ───────────────────────────────────────────

function checkPerformance(
  tables: TableSchema[],
  relationships: Relationship[],
  indexes: Record<string, TableIndex[]>,
): { score: number; issues: SchemaIssue[] } {
  const issues: SchemaIssue[] = [];
  let deductions = 0;

  if (tables.length === 0) {
    return { score: 0, issues: [] };
  }

  // 1. Missing index on FK columns (−4 per missing, max −16)
  let fkMissingIndex = 0;
  for (const table of tables) {
    const tableIndexes = indexes[table.id] ?? [];
    for (const col of table.columns) {
      if (col.isForeignKey) {
        const hasIndex = tableIndexes.some((idx) =>
          idx.columns.includes(col.id),
        );
        if (!hasIndex) {
          fkMissingIndex++;
          if (fkMissingIndex <= 4) {
            deductions += 4;
          }
          issues.push(
            makeIssue(
              "performance",
              "warning",
              "Missing FK Index",
              `Column "${col.name}" in "${table.name}" is a foreign key without an index.`,
              "Add an index on this column to improve JOIN performance.",
              table.id,
              col.id,
            ),
          );
        }
      }
    }
  }

  // 2. Too many columns (−5 per table with >15 columns)
  for (const table of tables) {
    if (table.columns.length > 15) {
      deductions += 5;
      issues.push(
        makeIssue(
          "performance",
          "warning",
          "Wide Table",
          `Table "${table.name}" has ${table.columns.length} columns, which may impact performance.`,
          "Consider splitting into multiple tables or using a separate details table.",
          table.id,
        ),
      );
    }
  }

  // 3. Deep relationship chains (−5 if max depth > 4)
  const maxDepth = computeMaxRelationshipDepth(tables, relationships);
  if (maxDepth > 4) {
    deductions += 5;
    issues.push(
      makeIssue(
        "performance",
        "warning",
        "Deep FK Chain",
        `Maximum relationship chain depth is ${maxDepth} (>4 hops).`,
        "Deep chains can slow queries. Consider denormalization or caching.",
      ),
    );
  }

  // 4. High fan-out (−3 per table with >5 outbound FKs)
  for (const table of tables) {
    const outbound = relationships.filter(
      (r) => r.sourceTableId === table.id,
    ).length;
    if (outbound > 5) {
      deductions += 3;
      issues.push(
        makeIssue(
          "performance",
          "info",
          "High FK Fan-Out",
          `Table "${table.name}" has ${outbound} outbound foreign keys.`,
          "Many FKs can increase write overhead. Ensure they are all necessary.",
          table.id,
        ),
      );
    }
  }

  const score = Math.max(0, 30 - deductions);
  return { score, issues };
}

function computeMaxRelationshipDepth(
  tables: TableSchema[],
  relationships: Relationship[],
): number {
  const adjacency: Record<string, string[]> = {};
  for (const rel of relationships) {
    if (!adjacency[rel.sourceTableId]) adjacency[rel.sourceTableId] = [];
    adjacency[rel.sourceTableId].push(rel.targetTableId);
  }

  let maxDepth = 0;

  function dfs(node: string, depth: number, visited: Set<string>) {
    maxDepth = Math.max(maxDepth, depth);
    for (const neighbor of adjacency[node] ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        dfs(neighbor, depth + 1, visited);
        visited.delete(neighbor);
      }
    }
  }

  for (const table of tables) {
    const visited = new Set<string>([table.id]);
    dfs(table.id, 0, visited);
  }

  return maxDepth;
}

// ─── Design Checks (max 30) ────────────────────────────────────────────────

function checkDesign(tables: TableSchema[]): {
  score: number;
  issues: SchemaIssue[];
} {
  const issues: SchemaIssue[] = [];
  let deductions = 0;

  if (tables.length === 0) {
    return { score: 0, issues: [] };
  }

  // 1. No timestamps (−4 per table missing created_at/updated_at, max −12)
  let missingTimestampCount = 0;
  for (const table of tables) {
    const colNames = table.columns.map((c) => c.name.toLowerCase());
    const hasCreatedAt = colNames.some((n) =>
      ["created_at", "createdat", "created_date", "creation_date"].includes(n),
    );
    if (!hasCreatedAt) {
      missingTimestampCount++;
      if (missingTimestampCount <= 3) {
        deductions += 4;
      }
      issues.push(
        makeIssue(
          "design",
          "warning",
          "Missing Timestamps",
          `Table "${table.name}" has no created_at / timestamp column.`,
          "Add created_at and updated_at columns for audit trails.",
          table.id,
        ),
      );
    }
  }

  // 2. Inconsistent naming conventions (−5 if mixed)
  const namingStyles = new Set<"snake" | "camel" | "pascal" | "other">();
  for (const table of tables) {
    namingStyles.add(detectNamingStyle(table.name));
    for (const col of table.columns) {
      namingStyles.add(detectNamingStyle(col.name));
    }
  }
  // Remove "other" for short names
  if (
    namingStyles.size > 2 ||
    (namingStyles.size === 2 && !namingStyles.has("other"))
  ) {
    deductions += 5;
    issues.push(
      makeIssue(
        "design",
        "warning",
        "Inconsistent Naming",
        `Mixed naming conventions detected (${[...namingStyles].join(", ")}).`,
        "Stick to one convention (snake_case is standard for SQL).",
      ),
    );
  }

  // 3. Nullable primary keys (−8 — should never happen)
  for (const table of tables) {
    for (const col of table.columns) {
      if (col.isPrimaryKey && col.isNullable) {
        deductions += 8;
        issues.push(
          makeIssue(
            "design",
            "error",
            "Nullable Primary Key",
            `Column "${col.name}" in "${table.name}" is a nullable PK.`,
            "Primary keys must be NOT NULL.",
            table.id,
            col.id,
          ),
        );
      }
    }
  }

  // 4. Excessive nullable columns (−3 if >50% of non-PK columns are nullable)
  for (const table of tables) {
    const nonPKCols = table.columns.filter((c) => !c.isPrimaryKey);
    if (nonPKCols.length >= 3) {
      const nullableCount = nonPKCols.filter((c) => c.isNullable).length;
      if (nullableCount / nonPKCols.length > 0.6) {
        deductions += 3;
        issues.push(
          makeIssue(
            "design",
            "info",
            "Many Nullable Columns",
            `Table "${table.name}" has ${nullableCount}/${nonPKCols.length} nullable non-PK columns.`,
            "Consider if all nullables are intentional. Required fields should be NOT NULL.",
            table.id,
          ),
        );
      }
    }
  }

  // 5. Redundant column name patterns (−3 if table name prefix in columns)
  for (const table of tables) {
    const prefix = table.name.toLowerCase().replace(/s$/, "") + "_";
    let redundantCount = 0;
    for (const col of table.columns) {
      if (
        col.name.toLowerCase().startsWith(prefix) &&
        col.name.toLowerCase() !== prefix + "id"
      ) {
        redundantCount++;
      }
    }
    if (redundantCount >= 2) {
      deductions += 3;
      issues.push(
        makeIssue(
          "design",
          "info",
          "Redundant Column Prefix",
          `Table "${table.name}" has columns prefixed with "${prefix}".`,
          "Column context is already provided by the table name. Simplify column names.",
          table.id,
        ),
      );
    }
  }

  // 6. Generic / vague column names (−2 per occurrence, max −6)
  const vagueNames = ["data", "value", "info", "stuff", "temp", "misc"];
  let vagueCount = 0;
  for (const table of tables) {
    for (const col of table.columns) {
      if (vagueNames.includes(col.name.toLowerCase())) {
        vagueCount++;
        if (vagueCount <= 3) {
          deductions += 2;
        }
        issues.push(
          makeIssue(
            "design",
            "info",
            "Vague Column Name",
            `Column "${col.name}" in "${table.name}" is too generic.`,
            "Use descriptive names (e.g., 'profile_data' → 'bio', 'avatar_url').",
            table.id,
            col.id,
          ),
        );
      }
    }
  }

  const score = Math.max(0, 30 - deductions);
  return { score, issues };
}

function detectNamingStyle(
  name: string,
): "snake" | "camel" | "pascal" | "other" {
  if (/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(name)) return "snake";
  if (/^[a-z][a-zA-Z0-9]*$/.test(name)) return "camel";
  if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) return "pascal";
  return "other";
}

// ─── Main: Compute Schema Health ────────────────────────────────────────────

export function computeSchemaHealth(
  tables: TableSchema[],
  relationships: Relationship[],
  indexes: Record<string, TableIndex[]> = {},
): SchemaHealthResult {
  issueCounter = 0; // reset

  const structural = checkStructural(tables, relationships);
  const performance = checkPerformance(tables, relationships, indexes);
  const design = checkDesign(tables);

  const totalScore = structural.score + performance.score + design.score;
  const allIssues = [
    ...structural.issues,
    ...performance.issues,
    ...design.issues,
  ];

  return {
    totalScore,
    maxScore: 100,
    breakdown: {
      structural: {
        score: structural.score,
        max: 40,
        issues: structural.issues,
      },
      performance: {
        score: performance.score,
        max: 30,
        issues: performance.issues,
      },
      design: { score: design.score, max: 30, issues: design.issues },
    },
    allIssues,
  };
}

// ─── Get issues for a specific table ────────────────────────────────────────

export function getTableIssues(
  tableId: string,
  healthResult: SchemaHealthResult,
): SchemaIssue[] {
  return healthResult.allIssues.filter((issue) => issue.tableId === tableId);
}

// ─── Health score to label ──────────────────────────────────────────────────

export function healthScoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Fair";
  if (score >= 30) return "Poor";
  return "Critical";
}

export function healthScoreColor(score: number): string {
  if (score >= 90) return "text-green-500";
  if (score >= 70) return "text-blue-500";
  if (score >= 50) return "text-yellow-500";
  if (score >= 30) return "text-orange-500";
  return "text-red-500";
}

export function healthScoreBgColor(score: number): string {
  if (score >= 90) return "bg-green-500";
  if (score >= 70) return "bg-blue-500";
  if (score >= 50) return "bg-yellow-500";
  if (score >= 30) return "bg-orange-500";
  return "bg-red-500";
}
