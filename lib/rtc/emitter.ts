import {
  createRtcEvent,
  type RtcEventType,
  type RtcPayloadMap,
} from "@/lib/rtc/events";
import { getRtcClient, getRtcUserId, logRtcEvent } from "@/lib/rtc/client";

export function emitRtcEvent<T extends RtcEventType>(
  type: T,
  payload: RtcPayloadMap[T],
): void {
  if (typeof window === "undefined") return;
  const socket = getRtcClient();
  const event = createRtcEvent(type, payload, getRtcUserId());
  logRtcEvent(event, "sent");
  socket.emit("rtc:event", event);
}
