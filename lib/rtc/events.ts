import type {
  Relationship,
  TableSchema,
  Column,
  TableIndex,
} from "@/lib/schema-types";

export type RtcEventType =
  | "ADD_TABLE"
  | "DELETE_TABLE"
  | "UPDATE_TABLE_NAME"
  | "ADD_COLUMN"
  | "DELETE_COLUMN"
  | "UPDATE_COLUMN"
  | "CREATE_RELATIONSHIP"
  | "DELETE_RELATIONSHIP"
  | "UPDATE_RELATIONSHIP"
  | "EDITOR_STATUS"
  | "RUN_AUDIT"
  | "AUDIT_RESULT"
  | "APPLY_FIX"
  | "APPLY_ALL_SAFE_FIXES"
  | "RTC_SNAPSHOT"
  | "RTC_REQUEST_SNAPSHOT";

export type SchemaSnapshotPayload = {
  tables: TableSchema[];
  relationships: Relationship[];
  indexes: Record<string, TableIndex[]>;
};

export type RtcPayloadMap = {
  ADD_TABLE: { table: TableSchema };
  DELETE_TABLE: { tableId: string };
  UPDATE_TABLE_NAME: { tableId: string; name: string };
  ADD_COLUMN: { tableId: string; column: Column };
  DELETE_COLUMN: { tableId: string; columnId: string };
  UPDATE_COLUMN: { tableId: string; columnId: string; patch: Partial<Column> };
  CREATE_RELATIONSHIP: { relationship: Relationship };
  DELETE_RELATIONSHIP: { relationshipId: string };
  UPDATE_RELATIONSHIP: { relationshipId: string; patch: Partial<Relationship> };
  EDITOR_STATUS: {
    scope: "schema" | "prompt";
    isEditing: boolean;
    name: string;
  };
  RUN_AUDIT: { reason?: string };
  AUDIT_RESULT: { summaryScore?: number };
  APPLY_FIX: { fixId: string; runId?: string };
  APPLY_ALL_SAFE_FIXES: { runId?: string };
  RTC_SNAPSHOT: { snapshot: SchemaSnapshotPayload };
  RTC_REQUEST_SNAPSHOT: { reason?: string };
};

export type RtcEvent = {
  [K in RtcEventType]: {
    type: K;
    payload: RtcPayloadMap[K];
    timestamp: number;
    userId: string;
  };
}[RtcEventType];

export function createRtcEvent<T extends RtcEventType>(
  type: T,
  payload: RtcPayloadMap[T],
  userId: string,
): RtcEvent {
  return {
    type,
    payload,
    timestamp: Date.now(),
    userId,
  } as RtcEvent;
}
