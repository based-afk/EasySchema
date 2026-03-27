"use client";

import React, { useEffect } from "react";
import { useSchemaStore } from "@/lib/schema-store";
import {
  healthScoreLabel,
  healthScoreColor,
  healthScoreBgColor,
} from "@/lib/schema-health";
import { Separator } from "@/components/ui/separator";
import {
  Activity,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronRight,
  Shield,
  Zap,
  Palette,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { IssueSeverity, SchemaIssue } from "@/lib/schema-types";

const severityIcon: Record<IssueSeverity, React.ReactNode> = {
  error: <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />,
  warning: (
    <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
  ),
  info: <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />,
};

const severityBg: Record<IssueSeverity, string> = {
  error: "border-red-500/30 bg-red-500/5",
  warning: "border-yellow-500/30 bg-yellow-500/5",
  info: "border-blue-400/30 bg-blue-400/5",
};

export function SchemaHealthPanel() {
  const tables = useSchemaStore((s) => s.tables);
  const relationships = useSchemaStore((s) => s.relationships);
  const healthResult = useSchemaStore((s) => s.healthResult);
  const recomputeHealth = useSchemaStore((s) => s.recomputeHealth);
  const selectTable = useSchemaStore((s) => s.selectTable);
  const addIndex = useSchemaStore((s) => s.addIndex);
  const getTableIndexes = useSchemaStore((s) => s.getTableIndexes);
  const addColumn = useSchemaStore((s) => s.addColumn);
  const deleteColumn = useSchemaStore((s) => s.deleteColumn);
  const updateColumn = useSchemaStore((s) => s.updateColumn);
  const updateTableName = useSchemaStore((s) => s.updateTableName);
  const addTable = useSchemaStore((s) => s.addTable);
  const addRelationship = useSchemaStore((s) => s.addRelationship);
  const deleteRelationship = useSchemaStore((s) => s.deleteRelationship);

  const tableCount = Object.keys(tables).length;
  const tablesArray = Object.values(tables);
  const relationshipsArray = Object.values(relationships);

  // Auto-recompute on table/relationship changes
  useEffect(() => {
    if (tableCount > 0) {
      recomputeHealth();
    }
  }, [tables, tableCount, recomputeHealth]);

  if (tableCount === 0 || !healthResult) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            Schema Health
          </span>
        </div>
        <p className="text-xs text-muted-foreground/60 italic">
          Generate a schema to see health analysis.
        </p>
      </div>
    );
  }

  const { totalScore, breakdown, allIssues } = healthResult;
  const label = healthScoreLabel(totalScore);
  const color = healthScoreColor(totalScore);
  const bgColor = healthScoreBgColor(totalScore);

  const errorCount = allIssues.filter((i) => i.severity === "error").length;
  const warningCount = allIssues.filter((i) => i.severity === "warning").length;
  const infoCount = allIssues.filter((i) => i.severity === "info").length;

  const toSnakeCase = (value: string) =>
    value
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .replace(/\s+/g, "_")
      .replace(/__+/g, "_")
      .toLowerCase();

  const ensureUniqueName = (base: string, existing: Set<string>) => {
    let next = base;
    let counter = 2;
    while (existing.has(next)) {
      next = `${base}_${counter++}`;
    }
    return next;
  };

  const findPrimaryKeyColumn = (tableId: string) => {
    const table = tables[tableId];
    if (!table) return null;
    return (
      table.columns.find((c) => c.isPrimaryKey) ??
      table.columns.find((c) => c.name.toLowerCase() === "id") ??
      null
    );
  };

  const addMissingPrimaryKey = (tableId: string) => {
    const table = tables[tableId];
    if (!table) return;
    const existing = findPrimaryKeyColumn(tableId);
    if (existing) {
      updateColumn(tableId, existing.id, {
        isPrimaryKey: true,
        isNullable: false,
        isUnique: true,
      });
      return;
    }

    const newId = `col-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    addColumn(tableId, {
      id: newId,
      name: "id",
      type: "SERIAL",
      isPrimaryKey: true,
      isNullable: false,
      isUnique: true,
    });
  };

  const addMissingTimestamps = (tableId: string) => {
    const table = tables[tableId];
    if (!table) return;
    const names = new Set(table.columns.map((c) => c.name.toLowerCase()));
    if (!names.has("created_at")) {
      addColumn(tableId, {
        id: `col-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: "created_at",
        type: "TIMESTAMP",
        isNullable: false,
        isPrimaryKey: false,
        isForeignKey: false,
        isUnique: false,
        defaultValue: "NOW()",
      });
    }
    if (!names.has("updated_at")) {
      addColumn(tableId, {
        id: `col-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: "updated_at",
        type: "TIMESTAMP",
        isNullable: false,
        isPrimaryKey: false,
        isForeignKey: false,
        isUnique: false,
        defaultValue: "NOW()",
      });
    }
  };

  const addMissingFkIndex = (tableId: string, columnId: string) => {
    const table = tables[tableId];
    if (!table) return;
    const existing = getTableIndexes(tableId).some((idx) =>
      idx.columns.includes(columnId),
    );
    if (existing) return;
    const column = table.columns.find((c) => c.id === columnId);
    const colName = column?.name ?? "column";
    addIndex(tableId, {
      id: `idx-${tableId}-${columnId}-${Date.now()}`,
      name: `idx_${table.name}_${colName}`,
      columns: [columnId],
      type: "btree",
      isUnique: false,
    });
  };

  const fixDuplicateTableNames = () => {
    const existing = new Set<string>();
    const nameGroups: Record<string, string[]> = {};
    for (const table of tablesArray) {
      const lower = table.name.toLowerCase();
      if (!nameGroups[lower]) nameGroups[lower] = [];
      nameGroups[lower].push(table.id);
      existing.add(table.name);
    }

    for (const ids of Object.values(nameGroups)) {
      if (ids.length <= 1) continue;
      ids.forEach((tableId, idx) => {
        if (idx === 0) return;
        const table = tables[tableId];
        if (!table) return;
        const next = ensureUniqueName(`${table.name}_${idx + 1}`, existing);
        existing.add(next);
        updateTableName(tableId, next);
      });
    }
  };

  const fixUnreferencedTable = (tableId: string) => {
    if (tablesArray.length <= 1) return;
    const sourceTable = tables[tableId];
    if (!sourceTable) return;
    const targetTable = tablesArray.find((t) => t.id !== tableId);
    if (!targetTable) return;
    const targetPk =
      targetTable.columns.find((c) => c.isPrimaryKey) ??
      targetTable.columns.find((c) => c.name.toLowerCase() === "id");
    if (!targetPk) return;

    const base = targetTable.name.replace(/s$/, "");
    const fkName = `${base}_id`;
    const fkId = `col-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    addColumn(tableId, {
      id: fkId,
      name: fkName,
      type: "INT",
      isNullable: true,
      isPrimaryKey: false,
      isForeignKey: false,
      isUnique: false,
    });

    addRelationship({
      id: `rel-${tableId}-${fkId}`,
      sourceTableId: tableId,
      sourceColumnId: fkId,
      targetTableId: targetTable.id,
      targetColumnId: targetPk.id,
      type: "one-to-many",
      onDelete: "CASCADE",
    });
  };

  const fixCircularRelationship = () => {
    const adjacency: Record<string, string[]> = {};
    const edgeMap: Record<string, string> = {};
    for (const rel of relationshipsArray) {
      if (!adjacency[rel.sourceTableId]) adjacency[rel.sourceTableId] = [];
      adjacency[rel.sourceTableId].push(rel.targetTableId);
      edgeMap[`${rel.sourceTableId}->${rel.targetTableId}`] = rel.id;
    }

    const visited = new Set<string>();
    const stack = new Set<string>();
    let cycleEdgeId: string | null = null;

    function dfs(node: string): boolean {
      if (stack.has(node)) return true;
      if (visited.has(node)) return false;
      visited.add(node);
      stack.add(node);
      for (const neighbor of adjacency[node] ?? []) {
        if (dfs(neighbor)) {
          const edgeId = edgeMap[`${node}->${neighbor}`];
          if (edgeId && !cycleEdgeId) cycleEdgeId = edgeId;
          return true;
        }
      }
      stack.delete(node);
      return false;
    }

    for (const table of tablesArray) {
      if (dfs(table.id)) break;
    }

    if (cycleEdgeId) {
      deleteRelationship(cycleEdgeId);
    }
  };

  const fixMinimalTable = (tableId: string) => {
    addColumn(tableId, {
      id: `col-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: "name",
      type: "VARCHAR",
      isNullable: false,
      isPrimaryKey: false,
      isForeignKey: false,
      isUnique: false,
    });
  };

  const fixWideTable = (tableId: string) => {
    const table = tables[tableId];
    if (!table || table.columns.length <= 15) return;

    const nonPk = table.columns.filter((c) => !c.isPrimaryKey);
    if (nonPk.length <= 12) return;

    const overflow = nonPk.slice(12);
    if (overflow.length === 0) return;

    const newTableId = `table-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newTableName = ensureUniqueName(
      `${table.name}_details`,
      new Set(tablesArray.map((t) => t.name)),
    );
    const fkColId = `col-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const newColumns = [
      {
        id: `col-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: "id",
        type: "SERIAL" as const,
        isPrimaryKey: true,
        isForeignKey: false,
        isNullable: false,
        isUnique: true,
      },
      {
        id: fkColId,
        name: `${table.name.replace(/s$/, "")}_id`,
        type: "INT" as const,
        isPrimaryKey: false,
        isForeignKey: false,
        isNullable: false,
        isUnique: false,
      },
      ...overflow.map((col) => ({
        id: `col-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: col.name,
        type: col.type,
        isPrimaryKey: false,
        isForeignKey: false,
        isNullable: col.isNullable,
        isUnique: col.isUnique,
        defaultValue: col.defaultValue,
      })),
    ];

    addTable({
      id: newTableId,
      name: newTableName,
      columns: newColumns,
      position: { x: table.position.x + 320, y: table.position.y + 200 },
    });

    for (const col of overflow) {
      deleteColumn(tableId, col.id);
    }

    const pk = findPrimaryKeyColumn(tableId);
    if (!pk) return;

    addRelationship({
      id: `rel-${newTableId}-${fkColId}`,
      sourceTableId: newTableId,
      sourceColumnId: fkColId,
      targetTableId: tableId,
      targetColumnId: pk.id,
      type: "one-to-many",
      onDelete: "CASCADE",
    });
  };

  const fixDeepFkChain = () => {
    const adjacency: Record<string, string[]> = {};
    const edgeMap: Record<string, string> = {};
    for (const rel of relationshipsArray) {
      if (!adjacency[rel.sourceTableId]) adjacency[rel.sourceTableId] = [];
      adjacency[rel.sourceTableId].push(rel.targetTableId);
      edgeMap[`${rel.sourceTableId}->${rel.targetTableId}`] = rel.id;
    }

    let bestPath: string[] = [];

    function dfs(node: string, path: string[], visited: Set<string>) {
      if (path.length > bestPath.length) bestPath = [...path];
      for (const neighbor of adjacency[node] ?? []) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        dfs(neighbor, [...path, neighbor], visited);
        visited.delete(neighbor);
      }
    }

    for (const table of tablesArray) {
      dfs(table.id, [table.id], new Set([table.id]));
    }

    if (bestPath.length <= 4) return;
    const from = bestPath[bestPath.length - 2];
    const to = bestPath[bestPath.length - 1];
    const relId = edgeMap[`${from}->${to}`];
    if (relId) deleteRelationship(relId);
  };

  const fixHighFanOut = () => {
    const relsBySource: Record<string, string[]> = {};
    for (const rel of relationshipsArray) {
      if (!relsBySource[rel.sourceTableId])
        relsBySource[rel.sourceTableId] = [];
      relsBySource[rel.sourceTableId].push(rel.id);
    }

    for (const [tableId, relIds] of Object.entries(relsBySource)) {
      if (relIds.length <= 5) continue;
      for (const relId of relIds.slice(5)) {
        deleteRelationship(relId);
      }
    }
  };

  const fixInconsistentNaming = () => {
    const tableNameMap: Record<string, string> = {};
    const columnNameMap: Record<string, Record<string, string>> = {};

    const existingTableNames = new Set(tablesArray.map((t) => t.name));

    for (const table of tablesArray) {
      const nextName = ensureUniqueName(
        toSnakeCase(table.name),
        existingTableNames,
      );
      existingTableNames.add(nextName);
      tableNameMap[table.id] = nextName;
    }

    for (const table of tablesArray) {
      const colMap: Record<string, string> = {};
      const existingCols = new Set<string>();
      for (const col of table.columns) {
        const next = ensureUniqueName(toSnakeCase(col.name), existingCols);
        existingCols.add(next);
        colMap[col.id] = next;
      }
      columnNameMap[table.id] = colMap;
    }

    for (const table of tablesArray) {
      const nextName = tableNameMap[table.id];
      if (nextName && nextName !== table.name) {
        updateTableName(table.id, nextName);
      }
      for (const col of table.columns) {
        const nextCol = columnNameMap[table.id]?.[col.id];
        if (nextCol && nextCol !== col.name) {
          updateColumn(table.id, col.id, { name: nextCol });
        }
      }
    }
  };

  const fixNullablePrimaryKey = (tableId: string, columnId: string) => {
    updateColumn(tableId, columnId, { isNullable: false });
  };

  const fixManyNullableColumns = (tableId: string) => {
    const table = tables[tableId];
    if (!table) return;
    for (const col of table.columns) {
      if (!col.isPrimaryKey) {
        updateColumn(tableId, col.id, { isNullable: false });
      }
    }
  };

  const fixRedundantColumnPrefix = (tableId: string) => {
    const table = tables[tableId];
    if (!table) return;
    const prefix = table.name.toLowerCase().replace(/s$/, "") + "_";
    const existing = new Set(table.columns.map((c) => c.name.toLowerCase()));

    for (const col of table.columns) {
      const lower = col.name.toLowerCase();
      if (!lower.startsWith(prefix) || lower === `${prefix}id`) continue;
      const trimmed = lower.slice(prefix.length);
      const next = ensureUniqueName(trimmed, existing);
      existing.add(next);
      updateColumn(tableId, col.id, { name: next });
    }
  };

  const fixVagueColumnName = (tableId: string, columnId: string) => {
    const table = tables[tableId];
    if (!table) return;
    const existing = new Set(table.columns.map((c) => c.name.toLowerCase()));
    const base = `${table.name.replace(/s$/, "")}_details`;
    const next = ensureUniqueName(base, existing);
    updateColumn(tableId, columnId, { name: next });
  };

  const applyIssueFix = (issue: SchemaIssue) => {
    switch (issue.title) {
      case "Missing Primary Key":
        if (issue.tableId) addMissingPrimaryKey(issue.tableId);
        break;
      case "Duplicate Table Name":
        fixDuplicateTableNames();
        break;
      case "Unreferenced Table":
        if (issue.tableId) fixUnreferencedTable(issue.tableId);
        break;
      case "Circular Relationship":
        fixCircularRelationship();
        break;
      case "Minimal Table":
        if (issue.tableId) fixMinimalTable(issue.tableId);
        break;
      case "Missing FK Index":
        if (issue.tableId && issue.columnId) {
          addMissingFkIndex(issue.tableId, issue.columnId);
        }
        break;
      case "Wide Table":
        if (issue.tableId) fixWideTable(issue.tableId);
        break;
      case "Deep FK Chain":
        fixDeepFkChain();
        break;
      case "High FK Fan-Out":
        fixHighFanOut();
        break;
      case "Missing Timestamps":
        if (issue.tableId) addMissingTimestamps(issue.tableId);
        break;
      case "Inconsistent Naming":
        fixInconsistentNaming();
        break;
      case "Nullable Primary Key":
        if (issue.tableId && issue.columnId) {
          fixNullablePrimaryKey(issue.tableId, issue.columnId);
        }
        break;
      case "Many Nullable Columns":
        if (issue.tableId) fixManyNullableColumns(issue.tableId);
        break;
      case "Redundant Column Prefix":
        if (issue.tableId) fixRedundantColumnPrefix(issue.tableId);
        break;
      case "Vague Column Name":
        if (issue.tableId && issue.columnId) {
          fixVagueColumnName(issue.tableId, issue.columnId);
        }
        break;
      default:
        break;
    }
  };

  const handleFixIssue = (issueId: string) => {
    const issue = allIssues.find((i) => i.id === issueId);
    if (!issue) return;
    applyIssueFix(issue);
    recomputeHealth();
  };

  const handleFixAllIssues = () => {
    if (
      !window.confirm(
        "Apply automatic fixes for all issues? This may rename items or remove relationships.",
      )
    ) {
      return;
    }

    for (const issue of allIssues) {
      applyIssueFix(issue);
    }
    recomputeHealth();
  };

  return (
    <div className="space-y-0">
      {/* Header + Score */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium">Schema Health</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px]"
              onClick={handleFixAllIssues}
            >
              Fix all
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={recomputeHealth}
              title="Refresh health score"
            >
              <RefreshCw className="w-3 h-3 text-muted-foreground" />
            </Button>
          </div>
        </div>

        {/* Big score display */}
        <div className="flex items-center gap-3">
          <div className={`text-2xl font-bold ${color}`}>{totalScore}</div>
          <div className="flex-1">
            <div className={`text-xs font-medium ${color}`}>{label}</div>
            <div className="w-full h-2 rounded-full bg-muted mt-1 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${bgColor}`}
                style={{ width: `${totalScore}%` }}
              />
            </div>
          </div>
        </div>

        {/* Issue counts */}
        <div className="flex gap-3 text-[10px]">
          {errorCount > 0 && (
            <span className="flex items-center gap-1 text-red-500">
              <AlertCircle className="w-3 h-3" />
              {errorCount} error{errorCount !== 1 ? "s" : ""}
            </span>
          )}
          {warningCount > 0 && (
            <span className="flex items-center gap-1 text-yellow-500">
              <AlertTriangle className="w-3 h-3" />
              {warningCount} warning{warningCount !== 1 ? "s" : ""}
            </span>
          )}
          {infoCount > 0 && (
            <span className="flex items-center gap-1 text-blue-400">
              <Info className="w-3 h-3" />
              {infoCount} info
            </span>
          )}
          {allIssues.length === 0 && (
            <span className="text-green-500">No issues found!</span>
          )}
        </div>
      </div>

      <Separator />

      {/* Breakdown */}
      <div className="p-4 space-y-2.5">
        <span className="text-xs font-medium text-muted-foreground">
          Breakdown
        </span>

        <BreakdownRow
          icon={<Shield className="w-3.5 h-3.5" />}
          label="Structural"
          score={breakdown.structural.score}
          max={breakdown.structural.max}
          issueCount={breakdown.structural.issues.length}
        />
        <BreakdownRow
          icon={<Zap className="w-3.5 h-3.5" />}
          label="Performance"
          score={breakdown.performance.score}
          max={breakdown.performance.max}
          issueCount={breakdown.performance.issues.length}
        />
        <BreakdownRow
          icon={<Palette className="w-3.5 h-3.5" />}
          label="Design"
          score={breakdown.design.score}
          max={breakdown.design.max}
          issueCount={breakdown.design.issues.length}
        />
      </div>

      {/* Issues list */}
      {allIssues.length > 0 && (
        <>
          <Separator />
          <div className="p-4 space-y-2">
            <span className="text-xs font-medium text-muted-foreground">
              Issues ({allIssues.length})
            </span>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {allIssues.map((issue) => (
                <div
                  key={issue.id}
                  className={`px-3 py-2 rounded-lg border text-xs ${severityBg[issue.severity]} cursor-pointer hover:opacity-80 transition-opacity`}
                  onClick={() => {
                    if (issue.tableId) selectTable(issue.tableId);
                  }}
                >
                  <div className="flex items-start gap-2">
                    {severityIcon[issue.severity]}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground">
                        {issue.title}
                      </div>
                      <div className="text-muted-foreground mt-0.5">
                        {issue.description}
                      </div>
                      {issue.suggestion && (
                        <div className="text-primary/80 mt-1 flex items-start gap-1">
                          <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span>{issue.suggestion}</span>
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[10px]"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFixIssue(issue.id);
                      }}
                    >
                      Fix
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function BreakdownRow({
  icon,
  label,
  score,
  max,
  issueCount,
}: {
  icon: React.ReactNode;
  label: string;
  score: number;
  max: number;
  issueCount: number;
}) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  const color =
    pct >= 80
      ? "text-green-500"
      : pct >= 60
        ? "text-blue-500"
        : pct >= 40
          ? "text-yellow-500"
          : "text-red-500";
  const barColor =
    pct >= 80
      ? "bg-green-500"
      : pct >= 60
        ? "bg-blue-500"
        : pct >= 40
          ? "bg-yellow-500"
          : "bg-red-500";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {issueCount > 0 && (
            <span className="text-[10px] text-muted-foreground/60">
              {issueCount} issue{issueCount !== 1 ? "s" : ""}
            </span>
          )}
          <span className={`font-medium ${color}`}>
            {score}/{max}
          </span>
        </div>
      </div>
      <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
