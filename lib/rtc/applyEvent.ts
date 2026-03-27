"use client";

import { useSchemaStore } from "@/lib/schema-store";
import type { RtcEvent } from "@/lib/rtc/events";

export function handleRtcEvent(event: RtcEvent): void {
  const store = useSchemaStore.getState();

  switch (event.type) {
    case "ADD_TABLE":
      store.addTable(event.payload.table, { remote: true });
      break;
    case "DELETE_TABLE":
      store.deleteTable(event.payload.tableId, { remote: true });
      break;
    case "UPDATE_TABLE_NAME":
      store.updateTableName(event.payload.tableId, event.payload.name, {
        remote: true,
      });
      break;
    case "ADD_COLUMN":
      store.addColumn(event.payload.tableId, event.payload.column, {
        remote: true,
      });
      break;
    case "DELETE_COLUMN":
      store.deleteColumn(event.payload.tableId, event.payload.columnId, {
        remote: true,
      });
      break;
    case "UPDATE_COLUMN":
      store.updateColumn(
        event.payload.tableId,
        event.payload.columnId,
        event.payload.patch,
        { remote: true },
      );
      break;
    case "CREATE_RELATIONSHIP":
      store.addRelationship(event.payload.relationship, { remote: true });
      break;
    case "DELETE_RELATIONSHIP":
      store.deleteRelationship(event.payload.relationshipId, { remote: true });
      break;
    case "UPDATE_RELATIONSHIP":
      store.updateRelationship(
        event.payload.relationshipId,
        event.payload.patch,
        { remote: true },
      );
      break;
    case "RTC_SNAPSHOT":
      store.setSchemaSnapshot(event.payload.snapshot, { remote: true });
      break;
    case "EDITOR_STATUS":
    case "RUN_AUDIT":
    case "AUDIT_RESULT":
    case "APPLY_FIX":
    case "APPLY_ALL_SAFE_FIXES":
    case "RTC_REQUEST_SNAPSHOT":
      break;
    default:
      break;
  }
}
