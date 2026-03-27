"use client";

import { useSchemaStore } from "@/lib/schema-store";
import type { CanvasSchemaSnapshot } from "@/lib/audit/fix-types";

export function extractCanvasSchema(): CanvasSchemaSnapshot {
  const state = useSchemaStore.getState();
  return {
    tables: Object.values(state.tables),
    relationships: Object.values(state.relationships),
    indexes: state.indexes ?? {},
  };
}
