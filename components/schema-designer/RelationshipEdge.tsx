"use client";

import React from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getSmoothStepPath,
} from "reactflow";
import { useSchemaStore } from "@/lib/schema-store";
import { X } from "lucide-react";

interface RelEdgeData {
  label?: string;
  relationshipType?: string;
  onDelete?: string;
  relationshipId?: string;
}

export function RelationshipEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<RelEdgeData>) {
  const deleteRelationship = useSchemaStore((s) => s.deleteRelationship);
  const selectRelationship = useSchemaStore((s) => s.selectRelationship);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 12,
  });

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data?.relationshipId) {
      deleteRelationship(data.relationshipId);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data?.relationshipId) {
      selectRelationship(data.relationshipId);
    }
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: selected ? "hsl(var(--primary))" : "hsl(var(--primary)/0.6)",
          strokeWidth: selected ? 2.5 : 2,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-auto absolute flex items-center gap-1.5"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
          onClick={handleClick}
        >
          <span className="px-2 py-0.5 rounded-md bg-card border border-border text-[10px] text-muted-foreground shadow-sm cursor-pointer hover:border-primary/40">
            {data?.label ?? "FK"}
          </span>
          {selected && (
            <button
              onClick={handleDelete}
              className="p-0.5 rounded-full bg-destructive/10 hover:bg-destructive/20 border border-destructive/30"
              title="Delete relationship"
            >
              <X className="w-3 h-3 text-destructive" />
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
