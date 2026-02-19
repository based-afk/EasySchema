"use client";

import { useCallback, useMemo, useEffect, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  Connection,
  BackgroundVariant,
  NodeTypes,
  EdgeTypes,
  ConnectionMode,
  MarkerType,
  NodeChange,
  applyNodeChanges,
} from "reactflow";
import "reactflow/dist/style.css";
import { TableNode } from "./TableNode";
import { RelationshipEdge } from "./RelationshipEdge";
import { useSchemaStore } from "@/lib/schema-store";
import { schemaToNodes, schemaToEdges, parseHandleId } from "@/lib/reactflow-sync";
import { validateRelationship } from "@/lib/relationship-validator";
import { Relationship } from "@/lib/schema-types";

const nodeTypes: NodeTypes = {
  tableNode: TableNode,
};

const edgeTypes: EdgeTypes = {
  relationshipEdge: RelationshipEdge,
};

export function SchemaCanvas() {
  const tables = useSchemaStore((s) => s.tables);
  const relationships = useSchemaStore((s) => s.relationships);
  const updateTablePosition = useSchemaStore((s) => s.updateTablePosition);
  const addRelationship = useSchemaStore((s) => s.addRelationship);
  const clearSelection = useSchemaStore((s) => s.clearSelection);

  const [connectionError, setConnectionError] = useState<string | null>(null);

  // ── Build nodes from store ───────────────────────────────────────────
  const flowNodes = useMemo<Node[]>(
    () =>
      schemaToNodes(tables, (_tableId, table) => ({
        tableName: table.name,
        columns: table.columns,
      })),
    [tables],
  );

  // ── Build edges from store ───────────────────────────────────────────
  const flowEdges = useMemo<Edge[]>(
    () => schemaToEdges(tables, relationships),
    [tables, relationships],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  // Sync store → ReactFlow
  useEffect(() => {
    setNodes(flowNodes);
  }, [flowNodes, setNodes]);

  useEffect(() => {
    setEdges(flowEdges);
  }, [flowEdges, setEdges]);

  // ── Handle node position changes → store ─────────────────────────────
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Apply visual changes immediately
      onNodesChange(changes);

      // Persist position changes to store
      for (const change of changes) {
        if (change.type === "position" && change.position && change.id) {
          updateTablePosition(change.id, change.position);
        }
      }
    },
    [onNodesChange, updateTablePosition],
  );

  // ── Manual connections with validation ───────────────────────────────
  const onConnect = useCallback(
    (params: Connection) => {
      const sourceParsed = parseHandleId(params.sourceHandle);
      const targetParsed = parseHandleId(params.targetHandle);

      if (!sourceParsed || !targetParsed) return;

      // Validate
      const result = validateRelationship(
        sourceParsed.tableId,
        sourceParsed.colId,
        targetParsed.tableId,
        targetParsed.colId,
        tables,
        relationships,
      );

      if (!result.valid) {
        setConnectionError(result.error ?? "Invalid connection");
        setTimeout(() => setConnectionError(null), 3000);
        return;
      }

      // Create relationship
      const newRel: Relationship = {
        id: `rel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sourceTableId: sourceParsed.tableId,
        sourceColumnId: sourceParsed.colId,
        targetTableId: targetParsed.tableId,
        targetColumnId: targetParsed.colId,
        type: "one-to-many",
        onDelete: "CASCADE",
      };

      addRelationship(newRel);
    },
    [tables, relationships, addRelationship],
  );

  // ── Pane click → deselect ────────────────────────────────────────────
  const onPaneClick = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const tableCount = Object.keys(tables).length;

  return (
    <div className="flex-1 bg-muted/30 relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        defaultEdgeOptions={{
          animated: true,
          type: "relationshipEdge",
          markerEnd: { type: MarkerType.ArrowClosed },
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          className="!bg-background"
        />
        <Controls
          position="bottom-right"
          className="!bg-card !border-border !shadow-md [&>button]:!bg-card [&>button]:!border-border [&>button]:!fill-foreground"
        />
        <MiniMap
          position="bottom-left"
          nodeClassName="!fill-primary/60"
          maskColor="rgba(0, 0, 0, 0.08)"
          className="!bg-card !border-border !shadow-md"
        />
      </ReactFlow>

      {/* Connection error toast */}
      {connectionError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-destructive/90 text-destructive-foreground text-xs shadow-lg animate-in fade-in slide-in-from-top-2">
          {connectionError}
        </div>
      )}

      {/* Empty state */}
      {tableCount === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center space-y-2 max-w-xs">
            <p className="text-lg font-light text-muted-foreground">
              No tables yet
            </p>
            <p className="text-sm text-muted-foreground/60">
              Describe your application in the sidebar and click Generate Schema
              to get started.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
