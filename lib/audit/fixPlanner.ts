import type {
  CanvasSchemaSnapshot,
  FixPlan,
  PlannedFix,
  AiFixInput,
} from "@/lib/audit/fix-types";
import type { SchemaIssue } from "@/lib/schema-types";
import type { PerformanceSimulationResult } from "@/lib/audit/performanceSimulation";
import { computeSchemaHealth } from "@/lib/schema-health";
import { analyzeSqlSafety, deriveRiskFromSafety } from "@/lib/audit/sqlSafety";

function hashString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function makeId(prefix: string, seed: string): string {
  return `${prefix}-${hashString(seed)}`;
}

function toSnakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/\s+/g, "_")
    .replace(/__+/g, "_")
    .toLowerCase();
}

function ensureUniqueName(base: string, existing: Set<string>): string {
  let next = base;
  let counter = 2;
  while (existing.has(next)) {
    next = `${base}_${counter++}`;
  }
  return next;
}

function indexName(table: string, column: string): string {
  return `idx_${table}_${column}`.toLowerCase();
}

function buildFixFromIssue(
  issue: SchemaIssue,
  schema: CanvasSchemaSnapshot,
): PlannedFix[] {
  const table = issue.tableId
    ? schema.tables.find((t) => t.id === issue.tableId)
    : undefined;
  const column =
    issue.tableId && issue.columnId
      ? table?.columns.find((c) => c.id === issue.columnId)
      : undefined;
  const fixes: PlannedFix[] = [];

  const addFix = (
    patch: Omit<
      PlannedFix,
      "id" | "source" | "issueTitle" | "executionOrder" | "dependencies"
    > &
      Partial<
        Pick<PlannedFix, "executionOrder" | "dependencies" | "issueTitle">
      >,
  ) => {
    const sql = patch.sql?.trim();
    const rollbackSql = patch.rollbackSql?.trim() ?? "";
    const safety = analyzeSqlSafety(sql);
    const riskLevel = deriveRiskFromSafety(safety, patch.riskLevel ?? "low");
    fixes.push({
      id: makeId("fix", `${issue.id}:${issue.title}:${sql}`),
      issueId: issue.id,
      issueTitle: patch.issueTitle ?? issue.title,
      category: issue.category,
      sql,
      rollbackSql,
      riskLevel,
      safeToAutoApply: patch.safeToAutoApply ?? riskLevel === "low",
      dependencies: patch.dependencies ?? [],
      executionOrder: patch.executionOrder ?? 50,
      source: "audit",
      safetyReason: safety.reason,
    });
  };

  switch (issue.title) {
    case "Missing FK Index": {
      if (!table || !column) break;
      const name = indexName(table.name, column.name);
      addFix({
        sql: `CREATE INDEX IF NOT EXISTS ${name} ON ${table.name} (${column.name});`,
        rollbackSql: `DROP INDEX IF EXISTS ${name};`,
        riskLevel: "low",
        safeToAutoApply: true,
        executionOrder: 30,
      });
      break;
    }
    case "Missing Timestamps": {
      if (!table) break;
      const addCreated = `ALTER TABLE ${table.name} ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();`;
      const addUpdated = `ALTER TABLE ${table.name} ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();`;
      addFix({
        sql: `${addCreated}\n${addUpdated}`,
        rollbackSql: `ALTER TABLE ${table.name} DROP COLUMN IF EXISTS updated_at;\nALTER TABLE ${table.name} DROP COLUMN IF EXISTS created_at;`,
        riskLevel: "low",
        safeToAutoApply: true,
        executionOrder: 20,
      });
      break;
    }
    case "Missing Primary Key": {
      if (!table) break;
      addFix({
        sql: `ALTER TABLE ${table.name} ADD COLUMN IF NOT EXISTS id SERIAL PRIMARY KEY;`,
        rollbackSql: `ALTER TABLE ${table.name} DROP COLUMN IF EXISTS id;`,
        riskLevel: "medium",
        safeToAutoApply: false,
        executionOrder: 10,
      });
      break;
    }
    case "Duplicate Table Name": {
      if (!table) break;
      const existing = new Set(schema.tables.map((t) => t.name));
      const nextName = ensureUniqueName(`${table.name}_dedup`, existing);
      addFix({
        sql: `ALTER TABLE ${table.name} RENAME TO ${nextName};`,
        rollbackSql: `ALTER TABLE ${nextName} RENAME TO ${table.name};`,
        riskLevel: "high",
        safeToAutoApply: false,
        executionOrder: 5,
      });
      break;
    }
    case "Unreferenced Table": {
      if (!table) break;
      const target = schema.tables.find((t) => t.id !== table.id);
      if (!target) break;
      const base = target.name.replace(/s$/, "");
      const fkColumn = `${base}_id`;
      addFix({
        sql: `ALTER TABLE ${table.name} ADD COLUMN IF NOT EXISTS ${fkColumn} INT;\nALTER TABLE ${table.name} ADD CONSTRAINT fk_${table.name}_${fkColumn} FOREIGN KEY (${fkColumn}) REFERENCES ${target.name}(id) ON DELETE SET NULL;`,
        rollbackSql: `ALTER TABLE ${table.name} DROP CONSTRAINT IF EXISTS fk_${table.name}_${fkColumn};\nALTER TABLE ${table.name} DROP COLUMN IF EXISTS ${fkColumn};`,
        riskLevel: "high",
        safeToAutoApply: false,
        executionOrder: 25,
      });
      break;
    }
    case "Circular Relationship": {
      if (!table || !column) break;
      const constraint = `fk_${table.name}_${column.name}`.toLowerCase();
      addFix({
        sql: `ALTER TABLE ${table.name} DROP CONSTRAINT IF EXISTS ${constraint};`,
        rollbackSql: "",
        riskLevel: "high",
        safeToAutoApply: false,
        executionOrder: 40,
      });
      break;
    }
    case "Minimal Table": {
      if (!table) break;
      addFix({
        sql: `ALTER TABLE ${table.name} ADD COLUMN IF NOT EXISTS name VARCHAR(255) NOT NULL DEFAULT '';`,
        rollbackSql: `ALTER TABLE ${table.name} DROP COLUMN IF EXISTS name;`,
        riskLevel: "low",
        safeToAutoApply: true,
        executionOrder: 20,
      });
      break;
    }
    case "Wide Table": {
      if (!table) break;
      addFix({
        issueTitle: "Wide Table (manual split)",
        sql: `-- Manual refactor recommended for ${table.name}. Consider creating ${table.name}_details table and moving rarely used columns.`,
        rollbackSql: "",
        riskLevel: "manual_review",
        safeToAutoApply: false,
        executionOrder: 60,
      });
      break;
    }
    case "Deep FK Chain": {
      addFix({
        sql: "-- Manual review: consider denormalization or adding summary tables for deep FK chains.",
        rollbackSql: "",
        riskLevel: "manual_review",
        safeToAutoApply: false,
        executionOrder: 60,
      });
      break;
    }
    case "High FK Fan-Out": {
      addFix({
        sql: "-- Manual review: consider batching or aggregating child entities to reduce fan-out.",
        rollbackSql: "",
        riskLevel: "manual_review",
        safeToAutoApply: false,
        executionOrder: 60,
      });
      break;
    }
    case "Inconsistent Naming": {
      const existing = new Set(schema.tables.map((t) => t.name));
      const renamed: string[] = [];
      for (const t of schema.tables) {
        const next = ensureUniqueName(toSnakeCase(t.name), existing);
        if (next !== t.name) {
          renamed.push(`ALTER TABLE ${t.name} RENAME TO ${next};`);
        }
      }
      addFix({
        sql:
          renamed.join("\n") ||
          "-- Manual review: naming inconsistencies detected.",
        rollbackSql: "",
        riskLevel: "high",
        safeToAutoApply: false,
        executionOrder: 55,
      });
      break;
    }
    case "Nullable Primary Key": {
      if (!table || !column) break;
      addFix({
        sql: `ALTER TABLE ${table.name} ALTER COLUMN ${column.name} SET NOT NULL;`,
        rollbackSql: `ALTER TABLE ${table.name} ALTER COLUMN ${column.name} DROP NOT NULL;`,
        riskLevel: "medium",
        safeToAutoApply: false,
        executionOrder: 35,
      });
      break;
    }
    case "Many Nullable Columns": {
      if (!table) break;
      addFix({
        sql: `-- Manual review: ${table.name} has many nullable columns. Evaluate which columns should be NOT NULL.`,
        rollbackSql: "",
        riskLevel: "manual_review",
        safeToAutoApply: false,
        executionOrder: 60,
      });
      break;
    }
    case "Redundant Column Prefix": {
      if (!table) break;
      addFix({
        sql: `-- Manual review: rename columns in ${table.name} to remove redundant prefixes.`,
        rollbackSql: "",
        riskLevel: "manual_review",
        safeToAutoApply: false,
        executionOrder: 55,
      });
      break;
    }
    case "Vague Column Name": {
      if (!table || !column) break;
      const next = ensureUniqueName(
        `${table.name.replace(/s$/, "")}_details`,
        new Set(table.columns.map((c) => c.name)),
      );
      addFix({
        sql: `ALTER TABLE ${table.name} RENAME COLUMN ${column.name} TO ${next};`,
        rollbackSql: `ALTER TABLE ${table.name} RENAME COLUMN ${next} TO ${column.name};`,
        riskLevel: "high",
        safeToAutoApply: false,
        executionOrder: 55,
      });
      break;
    }
    default:
      break;
  }

  return fixes;
}

function buildFixesFromPerformance(
  performance: PerformanceSimulationResult | undefined,
  schema: CanvasSchemaSnapshot,
): PlannedFix[] {
  if (!performance) return [];
  const fixes: PlannedFix[] = [];

  if (performance.bottlenecks.some((b) => b.includes("unindexed"))) {
    for (const rel of schema.relationships) {
      const table = schema.tables.find((t) => t.id === rel.sourceTableId);
      const column = table?.columns.find((c) => c.id === rel.sourceColumnId);
      if (!table || !column) continue;
      const idxName = indexName(table.name, column.name);
      const sql = `CREATE INDEX IF NOT EXISTS ${idxName} ON ${table.name} (${column.name});`;
      const rollbackSql = `DROP INDEX IF EXISTS ${idxName};`;
      const safety = analyzeSqlSafety(sql);
      fixes.push({
        id: makeId("fix", `perf:${sql}`),
        issueTitle: "Performance: Missing FK Index",
        sql,
        rollbackSql,
        riskLevel: deriveRiskFromSafety(safety, "low"),
        safeToAutoApply: !safety.requiresManualReview,
        dependencies: [],
        executionOrder: 30,
        source: "performance",
      });
    }
  }

  if (performance.nPlusOneRiskCount > 0) {
    fixes.push({
      id: makeId("fix", "perf:nplusone"),
      issueTitle: "Performance: N+1 Risk",
      sql: "-- Manual review: consider composite indexes or batch fetching to mitigate N+1 risks.",
      rollbackSql: "",
      riskLevel: "manual_review",
      safeToAutoApply: false,
      dependencies: [],
      executionOrder: 60,
      source: "performance",
    });
  }

  return fixes;
}

function sortFixesWithDependencies(fixes: PlannedFix[]): PlannedFix[] {
  const byId = new Map(fixes.map((fix) => [fix.id, fix]));
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const fix of fixes) {
    inDegree.set(fix.id, 0);
  }

  for (const fix of fixes) {
    for (const dep of fix.dependencies) {
      if (!byId.has(dep)) continue;
      inDegree.set(fix.id, (inDegree.get(fix.id) ?? 0) + 1);
      const list = dependents.get(dep) ?? [];
      list.push(fix.id);
      dependents.set(dep, list);
    }
  }

  const queue = fixes
    .filter((fix) => (inDegree.get(fix.id) ?? 0) === 0)
    .sort((a, b) => a.executionOrder - b.executionOrder);

  const sorted: PlannedFix[] = [];
  while (queue.length > 0) {
    const next = queue.shift()!;
    sorted.push(next);
    for (const dependent of dependents.get(next.id) ?? []) {
      const count = (inDegree.get(dependent) ?? 0) - 1;
      inDegree.set(dependent, count);
      if (count === 0) {
        const depFix = byId.get(dependent);
        if (depFix) queue.push(depFix);
      }
    }
    queue.sort((a, b) => a.executionOrder - b.executionOrder);
  }

  if (sorted.length !== fixes.length) {
    return fixes.sort((a, b) => a.executionOrder - b.executionOrder);
  }

  return sorted;
}

function normalizeAiFix(aiFix: AiFixInput): PlannedFix {
  const sql = aiFix.sql.trim();
  const rollbackSql = aiFix.rollback_sql?.trim() ?? "";
  const safety = analyzeSqlSafety(sql);
  const risk = deriveRiskFromSafety(safety, aiFix.risk ?? "medium");
  return {
    id: makeId("fix", `${aiFix.issue}:${sql}`),
    issueTitle: aiFix.issue,
    sql,
    rollbackSql,
    riskLevel: risk,
    safeToAutoApply:
      aiFix.safe_to_auto_apply ??
      (risk === "low" && !safety.requiresManualReview),
    dependencies: aiFix.dependencies ?? [],
    executionOrder: aiFix.execution_order ?? 50,
    source: "ai",
    safetyReason: safety.reason,
  };
}

export function buildFixPlan(
  schema: CanvasSchemaSnapshot,
  audit?: { health?: SchemaIssue[] },
  performance?: PerformanceSimulationResult,
  aiFixes?: AiFixInput[],
): FixPlan {
  const health = computeSchemaHealth(
    schema.tables,
    schema.relationships,
    schema.indexes,
  );
  const issues = audit?.health ?? health.allIssues;

  const issueFixes = issues.flatMap((issue) =>
    buildFixFromIssue(issue, schema),
  );
  const performanceFixes = buildFixesFromPerformance(performance, schema);
  const aiFixList = (aiFixes ?? []).map(normalizeAiFix);

  const allFixes = [...issueFixes, ...performanceFixes, ...aiFixList];

  const unsafeFixes: PlannedFix[] = [];
  const safeFixes: PlannedFix[] = [];
  for (const fix of allFixes) {
    if (fix.riskLevel === "manual_review") {
      unsafeFixes.push(fix);
      continue;
    }
    safeFixes.push(fix);
  }

  return {
    fixes: sortFixesWithDependencies(safeFixes),
    unsafeFixes,
    generatedAt: new Date().toISOString(),
    schemaSnapshot: schema,
    auditSnapshot: {
      health,
      performance,
    },
  };
}
