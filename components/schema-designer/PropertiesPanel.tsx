"use client";

import React, { useState, useEffect } from "react";
import { useSchemaStore } from "@/lib/schema-store";
import {
  ALL_COLUMN_TYPES,
  ON_DELETE_ACTIONS,
  ColumnType,
  OnDeleteAction,
  TableIndex,
  IndexType,
} from "@/lib/schema-types";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Settings2,
  X,
  KeyRound,
  Link2,
  Snowflake,
  ToggleRight,
  Trash2,
  Plus,
  Database,
  AlertCircle,
} from "lucide-react";
import { getTableIssues } from "@/lib/schema-health";

export function PropertiesPanel() {
  const selection = useSchemaStore((s) => s.selection);
  const tables = useSchemaStore((s) => s.tables);
  const relationships = useSchemaStore((s) => s.relationships);
  const updateColumn = useSchemaStore((s) => s.updateColumn);
  const updateTableName = useSchemaStore((s) => s.updateTableName);
  const deleteColumn = useSchemaStore((s) => s.deleteColumn);
  const deleteTable = useSchemaStore((s) => s.deleteTable);
  const addColumn = useSchemaStore((s) => s.addColumn);
  const updateRelationship = useSchemaStore((s) => s.updateRelationship);
  const deleteRelationship = useSchemaStore((s) => s.deleteRelationship);
  const clearSelection = useSchemaStore((s) => s.clearSelection);
  const addIndex = useSchemaStore((s) => s.addIndex);
  const deleteIndex = useSchemaStore((s) => s.deleteIndex);
  const getTableIndexes = useSchemaStore((s) => s.getTableIndexes);
  const healthResult = useSchemaStore((s) => s.healthResult);

  const { tableId, columnId, relationshipId } = selection;

  // ── Relationship selected ─────────────────────────────────────────
  if (relationshipId) {
    const rel = relationships[relationshipId];
    if (!rel) return <EmptyPanel />;

    const sourceTable = tables[rel.sourceTableId];
    const targetTable = tables[rel.targetTableId];
    const sourceCol = sourceTable?.columns.find(
      (c) => c.id === rel.sourceColumnId,
    );
    const targetCol = targetTable?.columns.find(
      (c) => c.id === rel.targetColumnId,
    );

    return (
      <aside className="w-[280px] h-full border-l border-border bg-background flex flex-col overflow-hidden">
        <PanelHeader title="Relationship" onClose={clearSelection} />
        <Separator />
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <InfoRow
            label="From"
            value={`${sourceTable?.name}.${sourceCol?.name}`}
          />
          <InfoRow
            label="To"
            value={`${targetTable?.name}.${targetCol?.name}`}
          />

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Type
            </label>
            <select
              value={rel.type}
              onChange={(e) =>
                updateRelationship(relationshipId, {
                  type: e.target.value as
                    | "one-to-one"
                    | "one-to-many"
                    | "many-to-many",
                })
              }
              className="w-full text-xs px-2 py-1.5 rounded-md border border-border bg-muted/30 outline-none focus:ring-1 focus:ring-primary/50"
            >
              <option value="one-to-one">One to One</option>
              <option value="one-to-many">One to Many</option>
              <option value="many-to-many">Many to Many</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              On Delete
            </label>
            <select
              value={rel.onDelete}
              onChange={(e) =>
                updateRelationship(relationshipId, {
                  onDelete: e.target.value as OnDeleteAction,
                })
              }
              className="w-full text-xs px-2 py-1.5 rounded-md border border-border bg-muted/30 outline-none focus:ring-1 focus:ring-primary/50"
            >
              {ON_DELETE_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="destructive"
            size="sm"
            className="w-full mt-4"
            onClick={() => {
              deleteRelationship(relationshipId);
              clearSelection();
            }}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Delete Relationship
          </Button>
        </div>
      </aside>
    );
  }

  // ── Column selected ───────────────────────────────────────────────
  if (tableId && columnId) {
    const table = tables[tableId];
    const col = table?.columns.find((c) => c.id === columnId);
    if (!table || !col) return <EmptyPanel />;

    return (
      <aside className="w-[280px] h-full border-l border-border bg-background flex flex-col overflow-hidden">
        <PanelHeader
          title={`${table.name}.${col.name}`}
          onClose={clearSelection}
        />
        <Separator />
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <ColumnNameField
            tableId={tableId}
            columnId={columnId}
            currentName={col.name}
            updateColumn={updateColumn}
          />

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Type
            </label>
            <select
              value={col.type}
              onChange={(e) =>
                updateColumn(tableId, columnId, {
                  type: e.target.value as ColumnType,
                })
              }
              className="w-full text-xs px-2 py-1.5 rounded-md border border-border bg-muted/30 outline-none focus:ring-1 focus:ring-primary/50 font-mono"
            >
              {ALL_COLUMN_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Default Value
            </label>
            <input
              type="text"
              value={col.defaultValue ?? ""}
              onChange={(e) =>
                updateColumn(tableId, columnId, {
                  defaultValue: e.target.value || undefined,
                })
              }
              placeholder="e.g., NOW(), 0, 'pending'"
              className="w-full text-xs px-2 py-1.5 rounded-md border border-border bg-muted/30 outline-none focus:ring-1 focus:ring-primary/50 font-mono placeholder:text-muted-foreground/40"
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground">
              Constraints
            </span>
            <ToggleRow
              icon={<KeyRound className="w-3.5 h-3.5" />}
              label="Primary Key"
              checked={col.isPrimaryKey}
              onChange={(v) =>
                updateColumn(tableId, columnId, {
                  isPrimaryKey: v,
                  isUnique: v ? true : col.isUnique,
                  isNullable: v ? false : col.isNullable,
                })
              }
            />
            <ToggleRow
              icon={<Snowflake className="w-3.5 h-3.5" />}
              label="Unique"
              checked={col.isUnique}
              onChange={(v) => updateColumn(tableId, columnId, { isUnique: v })}
            />
            <ToggleRow
              icon={<ToggleRight className="w-3.5 h-3.5" />}
              label="Nullable"
              checked={col.isNullable}
              onChange={(v) =>
                updateColumn(tableId, columnId, { isNullable: v })
              }
            />
          </div>

          {col.isForeignKey && col.references && (
            <>
              <Separator />
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Foreign Key
                  </span>
                </div>
                <p className="text-xs text-muted-foreground/80">
                  References{" "}
                  <span className="font-mono text-foreground">
                    {col.references.table}.{col.references.column}
                  </span>
                </p>
              </div>
            </>
          )}

          {!col.isPrimaryKey && (
            <>
              <Separator />
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => {
                  deleteColumn(tableId, columnId);
                  clearSelection();
                }}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Delete Column
              </Button>
            </>
          )}
        </div>
      </aside>
    );
  }

  // ── Table selected ────────────────────────────────────────────────
  if (tableId) {
    const table = tables[tableId];
    if (!table) return <EmptyPanel />;

    const tableRels = Object.values(relationships).filter(
      (r) => r.sourceTableId === tableId || r.targetTableId === tableId,
    );

    return (
      <aside className="w-[280px] h-full border-l border-border bg-background flex flex-col overflow-hidden">
        <PanelHeader title={table.name} onClose={clearSelection} />
        <Separator />
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <TableNameField
            tableId={tableId}
            currentName={table.name}
            updateTableName={updateTableName}
          />

          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              Columns ({table.columns.length})
            </span>
            <div className="space-y-1">
              {table.columns.map((col) => (
                <div
                  key={col.id}
                  className="flex items-center justify-between text-xs px-2 py-1 rounded bg-muted/30 border border-border"
                >
                  <div className="flex items-center gap-1.5">
                    {col.isPrimaryKey && (
                      <KeyRound className="w-3 h-3 text-primary" />
                    )}
                    {col.isForeignKey && !col.isPrimaryKey && (
                      <Link2 className="w-3 h-3 text-blue-400" />
                    )}
                    <span className="font-mono">{col.name}</span>
                  </div>
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {col.type}
                  </span>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={() => addColumn(tableId)}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add Column
            </Button>
          </div>

          {tableRels.length > 0 && (
            <>
              <Separator />
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Relationships ({tableRels.length})
                </span>
                {tableRels.map((rel) => {
                  const other =
                    rel.sourceTableId === tableId
                      ? tables[rel.targetTableId]?.name
                      : tables[rel.sourceTableId]?.name;
                  return (
                    <div
                      key={rel.id}
                      className="text-xs px-2 py-1 rounded bg-muted/30 border border-border text-muted-foreground"
                    >
                      → {other ?? "?"} ({rel.type})
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Index Management */}
          <Separator />
          <IndexManagementSection
            tableId={tableId}
            columns={table.columns}
            addIndex={addIndex}
            deleteIndex={deleteIndex}
            getTableIndexes={getTableIndexes}
          />

          {/* Table Issues */}
          {healthResult &&
            (() => {
              const issues = getTableIssues(tableId, healthResult);
              if (issues.length === 0) return null;
              return (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-yellow-500" />
                      Issues ({issues.length})
                    </span>
                    {issues.map((issue) => (
                      <div
                        key={issue.id}
                        className={`text-xs px-2 py-1.5 rounded border ${
                          issue.severity === "error"
                            ? "border-red-500/30 bg-red-500/5 text-red-400"
                            : issue.severity === "warning"
                              ? "border-yellow-500/30 bg-yellow-500/5 text-yellow-500"
                              : "border-blue-400/30 bg-blue-400/5 text-blue-400"
                        }`}
                      >
                        <div className="font-medium">{issue.title}</div>
                        {issue.suggestion && (
                          <div className="text-muted-foreground mt-0.5 text-[10px]">
                            {issue.suggestion}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}

          <Separator />
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => {
              deleteTable(tableId);
              clearSelection();
            }}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Delete Table
          </Button>
        </div>
      </aside>
    );
  }

  return <EmptyPanel />;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function EmptyPanel() {
  return (
    <aside className="w-[280px] h-full border-l border-border bg-background flex flex-col overflow-hidden">
      <div className="p-4 space-y-1">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">Properties</h2>
        </div>
      </div>
      <Separator />
      <div className="flex-1 flex items-center justify-center">
        <p className="text-xs text-muted-foreground/60 text-center px-6">
          Select a table, column, or relationship to view its properties.
        </p>
      </div>
    </aside>
  );
}

function PanelHeader({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="p-4 flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0">
        <Settings2 className="w-4 h-4 text-primary flex-shrink-0" />
        <h2 className="text-sm font-medium truncate">{title}</h2>
      </div>
      <button onClick={onClose} className="p-1 rounded hover:bg-muted">
        <X className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="text-xs font-mono text-foreground">{value}</p>
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs border transition-colors ${
        checked
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40"
      }`}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      <div
        className={`w-7 h-4 rounded-full transition-colors relative ${checked ? "bg-primary" : "bg-muted"}`}
      >
        <div
          className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-3.5" : "translate-x-0.5"
          }`}
        />
      </div>
    </button>
  );
}

function ColumnNameField({
  tableId,
  columnId,
  currentName,
  updateColumn,
}: {
  tableId: string;
  columnId: string;
  currentName: string;
  updateColumn: (tid: string, cid: string, p: { name: string }) => void;
}) {
  const [name, setName] = useState(currentName);
  useEffect(() => setName(currentName), [currentName]);

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">Name</label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          if (name.trim() && name !== currentName) {
            updateColumn(tableId, columnId, { name: name.trim() });
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) {
            updateColumn(tableId, columnId, { name: name.trim() });
          }
        }}
        className="w-full text-xs px-2 py-1.5 rounded-md border border-border bg-muted/30 outline-none focus:ring-1 focus:ring-primary/50 font-mono"
      />
    </div>
  );
}

function TableNameField({
  tableId,
  currentName,
  updateTableName,
}: {
  tableId: string;
  currentName: string;
  updateTableName: (tid: string, name: string) => void;
}) {
  const [name, setName] = useState(currentName);
  useEffect(() => setName(currentName), [currentName]);

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">
        Table Name
      </label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          if (name.trim() && name !== currentName) {
            updateTableName(tableId, name.trim());
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) {
            updateTableName(tableId, name.trim());
          }
        }}
        className="w-full text-xs px-2 py-1.5 rounded-md border border-border bg-muted/30 outline-none focus:ring-1 focus:ring-primary/50 font-mono"
      />
    </div>
  );
}

// ─── Index Management ───────────────────────────────────────────────────────

function IndexManagementSection({
  tableId,
  columns,
  addIndex,
  deleteIndex,
  getTableIndexes,
}: {
  tableId: string;
  columns: { id: string; name: string }[];
  addIndex: (tableId: string, index: TableIndex) => void;
  deleteIndex: (tableId: string, indexId: string) => void;
  getTableIndexes: (tableId: string) => TableIndex[];
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [selectedCols, setSelectedCols] = useState<string[]>([]);
  const [indexType, setIndexType] = useState<IndexType>("btree");
  const [isUniqueIdx, setIsUniqueIdx] = useState(false);

  const tableIndexes = getTableIndexes(tableId);

  const handleAddIndex = () => {
    if (selectedCols.length === 0) return;

    const colNames = selectedCols
      .map((cid) => columns.find((c) => c.id === cid)?.name ?? "col")
      .join("_");

    const newIndex: TableIndex = {
      id: `idx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `idx_${colNames}`,
      columns: selectedCols,
      type: selectedCols.length > 1 ? "composite" : indexType,
      isUnique: isUniqueIdx,
    };

    addIndex(tableId, newIndex);
    setSelectedCols([]);
    setIsUniqueIdx(false);
    setShowAdd(false);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Database className="w-3 h-3" />
          Indexes ({tableIndexes.length})
        </span>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>

      {/* Existing indexes */}
      {tableIndexes.map((idx) => (
        <div
          key={idx.id}
          className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-muted/30 border border-border"
        >
          <div className="flex-1 min-w-0">
            <div className="font-mono text-foreground truncate text-[10px]">
              {idx.name}
            </div>
            <div className="text-[9px] text-muted-foreground/70">
              {idx.isUnique ? "UNIQUE " : ""}
              {idx.type.toUpperCase()} on{" "}
              {idx.columns
                .map((cid) => columns.find((c) => c.id === cid)?.name ?? cid)
                .join(", ")}
            </div>
          </div>
          <button
            onClick={() => deleteIndex(tableId, idx.id)}
            className="p-0.5 rounded hover:bg-destructive/20 flex-shrink-0"
          >
            <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      ))}

      {/* Add index form */}
      {showAdd && (
        <div className="p-2 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">
              Columns (select one or more)
            </label>
            <div className="space-y-1">
              {columns.map((col) => (
                <label
                  key={col.id}
                  className="flex items-center gap-1.5 text-[10px] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedCols.includes(col.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedCols([...selectedCols, col.id]);
                      } else {
                        setSelectedCols(
                          selectedCols.filter((c) => c !== col.id),
                        );
                      }
                    }}
                    className="rounded border-border"
                  />
                  <span className="font-mono">{col.name}</span>
                </label>
              ))}
            </div>
          </div>

          {selectedCols.length <= 1 && (
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Type</label>
              <select
                value={indexType}
                onChange={(e) => setIndexType(e.target.value as IndexType)}
                className="w-full text-[10px] px-1.5 py-1 rounded border border-border bg-muted/30 outline-none"
              >
                <option value="btree">B-Tree</option>
                <option value="hash">Hash</option>
                <option value="unique">Unique</option>
              </select>
            </div>
          )}

          <label className="flex items-center gap-1.5 text-[10px] cursor-pointer">
            <input
              type="checkbox"
              checked={isUniqueIdx}
              onChange={(e) => setIsUniqueIdx(e.target.checked)}
              className="rounded border-border"
            />
            <span>Unique Index</span>
          </label>

          <div className="flex gap-1.5">
            <Button
              size="sm"
              className="flex-1 text-[10px] h-6"
              onClick={handleAddIndex}
              disabled={selectedCols.length === 0}
            >
              Create Index
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-[10px] h-6"
              onClick={() => {
                setShowAdd(false);
                setSelectedCols([]);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
