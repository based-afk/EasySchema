"use client";

import React, { memo, useState, useCallback } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Column, ColumnType, ALL_COLUMN_TYPES } from "@/lib/schema-types";
import { useSchemaStore } from "@/lib/schema-store";
import { KeyRound, Link2, GripVertical, Plus, Trash2, X, Pencil } from "lucide-react";

interface TableNodeData {
  tableName: string;
  columns: Column[];
}

function TableNodeComponent({ id, data, selected }: NodeProps<TableNodeData>) {
  const { tableName, columns } = data;

  // Store actions
  const addColumn = useSchemaStore((s) => s.addColumn);
  const deleteTable = useSchemaStore((s) => s.deleteTable);
  const updateColumn = useSchemaStore((s) => s.updateColumn);
  const updateTableName = useSchemaStore((s) => s.updateTableName);
  const deleteColumn = useSchemaStore((s) => s.deleteColumn);
  const selectTable = useSchemaStore((s) => s.selectTable);
  const selectColumn = useSchemaStore((s) => s.selectColumn);

  const [editingTableName, setEditingTableName] = useState(false);
  const [tableNameDraft, setTableNameDraft] = useState(tableName);
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [colNameDraft, setColNameDraft] = useState("");

  const handleTableNameSubmit = useCallback(() => {
    if (tableNameDraft.trim()) {
      updateTableName(id, tableNameDraft.trim());
    }
    setEditingTableName(false);
  }, [tableNameDraft, updateTableName, id]);

  const startEditingCol = useCallback((col: Column) => {
    setEditingColId(col.id);
    setColNameDraft(col.name);
  }, []);

  const handleColNameSubmit = useCallback(
    (colId: string) => {
      if (colNameDraft.trim()) {
        updateColumn(id, colId, { name: colNameDraft.trim() });
      }
      setEditingColId(null);
    },
    [colNameDraft, updateColumn, id],
  );

  const cancelColEdit = useCallback(() => {
    setEditingColId(null);
  }, []);

  return (
    <div
      className={`min-w-[260px] max-w-[340px] rounded-xl border bg-card text-card-foreground shadow-md ${
        selected
          ? "border-primary shadow-[0_0_20px_hsl(var(--primary)/0.2)]"
          : "border-border hover:border-primary/40"
      }`}
      onClick={() => selectTable(id)}
    >
      {/* Table Header */}
      <div className="flex items-center justify-between rounded-t-xl bg-primary/10 px-3 py-2.5 border-b border-border">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <GripVertical className="w-3.5 h-3.5 text-muted-foreground cursor-grab flex-shrink-0" />
          {editingTableName ? (
            <input
              autoFocus
              value={tableNameDraft}
              onChange={(e) => setTableNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleTableNameSubmit();
                if (e.key === "Escape") setEditingTableName(false);
              }}
              onBlur={handleTableNameSubmit}
              className="bg-card/80 text-sm font-medium px-1.5 py-0.5 rounded border border-primary/40 outline-none flex-1 min-w-0"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className="text-sm font-medium text-foreground truncate cursor-pointer hover:text-primary"
              onDoubleClick={() => {
                setTableNameDraft(tableName);
                setEditingTableName(true);
              }}
              title="Double-click to rename"
            >
              {tableName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!editingTableName && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setTableNameDraft(tableName);
                setEditingTableName(true);
              }}
              className="p-1 rounded hover:bg-primary/20"
              title="Rename table"
            >
              <Pencil className="w-3 h-3 text-muted-foreground hover:text-primary" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              addColumn(id);
            }}
            className="p-1 rounded hover:bg-primary/20"
            title="Add column"
          >
            <Plus className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteTable(id);
            }}
            className="p-1 rounded hover:bg-destructive/20"
            title="Delete table"
          >
            <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      </div>

      {/* Column grid header */}
      <div className="grid grid-cols-[16px_1fr_20px_72px_20px] gap-x-1 px-3 py-1 text-[9px] text-muted-foreground/60 uppercase tracking-wider border-b border-border/50">
        <span />
        <span>Name</span>
        <span />
        <span className="text-right">Type</span>
        <span />
      </div>

      {/* Columns */}
      <div className="divide-y divide-border/50">
        {columns.map((col) => (
          <div
            key={col.id}
            className="relative grid grid-cols-[16px_1fr_20px_72px_20px] gap-x-1 items-center px-3 py-1.5 text-xs hover:bg-muted/50 group cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              selectColumn(id, col.id);
            }}
          >
            {/* Source handle — right side */}
            <Handle
              type="source"
              position={Position.Right}
              id={`${id}-${col.id}-source`}
              className="!w-2.5 !h-2.5 !bg-primary/60 !border-primary/80 !opacity-0 group-hover:!opacity-100"
            />

            {/* Target handle — left side */}
            <Handle
              type="target"
              position={Position.Left}
              id={`${id}-${col.id}-target`}
              className="!w-2.5 !h-2.5 !bg-primary/60 !border-primary/80 !opacity-0 group-hover:!opacity-100"
            />

            {/* Key indicator — col 1 */}
            <div className="flex items-center justify-center">
              {col.isPrimaryKey ? (
                <KeyRound className="w-3 h-3 text-primary" />
              ) : col.isForeignKey ? (
                <Link2 className="w-3 h-3 text-blue-400" />
              ) : (
                <span className="w-3" />
              )}
            </div>

            {/* Column name — col 2 */}
            {editingColId === col.id ? (
              <input
                autoFocus
                value={colNameDraft}
                onChange={(e) => setColNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleColNameSubmit(col.id);
                  if (e.key === "Escape") cancelColEdit();
                }}
                onBlur={() => handleColNameSubmit(col.id)}
                className="bg-card text-xs px-1 py-0.5 rounded border border-primary/40 outline-none min-w-0 font-mono"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                className={`truncate cursor-pointer ${col.isPrimaryKey ? "font-medium text-foreground" : "text-foreground/80"}`}
                onDoubleClick={() => startEditingCol(col)}
                title="Double-click to rename"
              >
                {col.name}
              </span>
            )}

            {/* Edit button — col 3 */}
            <div className="flex items-center justify-center">
              {editingColId !== col.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditingCol(col);
                  }}
                  className="p-0.5 rounded hover:bg-primary/20 opacity-0 group-hover:opacity-100"
                  title="Rename column"
                >
                  <Pencil className="w-2.5 h-2.5 text-muted-foreground hover:text-primary" />
                </button>
              )}
            </div>

            {/* Column type dropdown — col 4 */}
            <select
              value={col.type}
              onChange={(e) => {
                updateColumn(id, col.id, {
                  type: e.target.value as ColumnType,
                });
              }}
              className="text-[10px] text-muted-foreground font-mono px-1 py-0.5 rounded bg-muted/80 border border-transparent hover:border-border focus:border-primary/40 outline-none cursor-pointer w-full text-right"
              onClick={(e) => e.stopPropagation()}
            >
              {ALL_COLUMN_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            {/* Delete column — col 5 */}
            <div className="flex items-center justify-center">
              {!col.isPrimaryKey ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteColumn(id, col.id);
                  }}
                  className="p-0.5 rounded hover:bg-destructive/20 opacity-0 group-hover:opacity-100"
                  title="Delete column"
                >
                  <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                </button>
              ) : (
                !col.isNullable &&
                !col.isPrimaryKey && (
                  <span className="text-[9px] text-primary/70">*</span>
                )
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom / Top handles for general connections */}
      <Handle
        type="source"
        position={Position.Bottom}
        id={`${id}-bottom`}
        className="!w-2 !h-2 !bg-border !border-border"
      />
      <Handle
        type="target"
        position={Position.Top}
        id={`${id}-top`}
        className="!w-2 !h-2 !bg-border !border-border"
      />
    </div>
  );
}

export const TableNode = memo(TableNodeComponent);
