import { io, Socket } from "socket.io-client";
import type { RtcEvent } from "@/lib/rtc/events";

let rtcSocket: Socket | null = null;
let rtcUserId: string | null = null;
let rtcDisplayName: string | null = null;
let rtcRoom: string | null = null;

function normalizeRoom(room?: string | null): string {
  return room && room.trim() ? room.trim() : "default";
}

export function getRtcUserId(): string {
  if (rtcUserId) return rtcUserId;
  if (typeof window === "undefined") return "server";
  const stored = window.localStorage.getItem("rtc:userId");
  if (stored) {
    rtcUserId = stored;
    return stored;
  }
  const next = `user-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem("rtc:userId", next);
  rtcUserId = next;
  return next;
}

export function getRtcDisplayNameOptional(): string | null {
  if (rtcDisplayName) return rtcDisplayName;
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem("rtc:displayName");
  if (stored) {
    rtcDisplayName = stored;
    return stored;
  }
  return null;
}

export function setRtcDisplayName(name: string): void {
  const next = name.trim();
  if (!next) return;
  rtcDisplayName = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem("rtc:displayName", next);
  }
}

export function getRtcDisplayName(): string {
  const stored = getRtcDisplayNameOptional();
  if (stored) return stored;
  if (typeof window === "undefined") return "server";
  const fallback = `User-${Math.random().toString(36).slice(2, 6)}`;
  rtcDisplayName = fallback;
  return fallback;
}

export function getRtcRoom(preferred?: string): string {
  if (typeof window === "undefined") return "default";
  if (preferred && preferred.trim()) {
    rtcRoom = preferred.trim();
    window.localStorage.setItem("rtc:room", rtcRoom);
    return rtcRoom;
  }
  if (rtcRoom) return rtcRoom;
  const stored = window.localStorage.getItem("rtc:room");
  rtcRoom = normalizeRoom(stored);
  return rtcRoom;
}

function getRtcUrl(): string {
  if (typeof window === "undefined") return "";
  const host =
    process.env.NEXT_PUBLIC_RTC_HOST ?? window.location.hostname ?? "localhost";
  const protocol = window.location.protocol === "https:" ? "https" : "http";
  const port = window.location.port || "3000";
  return `${protocol}://${host}:${port}`;
}

export function getRtcClient(options?: {
  room?: string;
  displayName?: string;
}): Socket {
  const desiredRoom = normalizeRoom(options?.room || getRtcRoom());
  const desiredName = options?.displayName || getRtcDisplayName();

  if (rtcSocket && rtcRoom === desiredRoom && rtcDisplayName === desiredName) {
    return rtcSocket;
  }
  if (rtcSocket) {
    rtcSocket.disconnect();
    rtcSocket = null;
  }
  if (typeof window === "undefined") {
    throw new Error("RTC client can only be created in the browser");
  }
  rtcRoom = desiredRoom;
  rtcDisplayName = desiredName;
  rtcSocket = io(getRtcUrl(), {
    path: "/api/socket",
    transports: ["websocket"],
    reconnection: true,
    auth: {
      room: rtcRoom,
      displayName: rtcDisplayName,
      userId: getRtcUserId(),
    },
  });
  return rtcSocket;
}

export function logRtcEvent(event: RtcEvent, direction: "sent" | "received") {
  const label = direction === "sent" ? "Event sent" : "Event received";
  console.log(`[RTC] ${label}: ${event.type}`);
}
