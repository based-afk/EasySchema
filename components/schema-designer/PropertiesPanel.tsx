"use client";

import React, { useState, useEffect } from "react";
import { useSchemaStore } from "@/lib/schema-store";
import {
  ALL_COLUMN_TYPES,
  ON_DELETE_ACTIONS,
  ColumnType,
  OnDeleteAction,
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
} from "lucide-react";

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
          <InfoRow label="From" value={`${sourceTable?.name}.${sourceCol?.name}`} />
          <InfoRow label="To" value={`${targetTable?.name}.${targetCol?.name}`} />

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Type
            </label>
            <select
              value={rel.type}
              onChange={(e) =>
                updateRelationship(relationshipId, {
                  type: e.target.value as "one-to-one" | "one-to-many" | "many-to-many",
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
              onChange={(v) =>
                updateColumn(tableId, columnId, { isUnique: v })
              }
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
