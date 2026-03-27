"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  getRtcClient,
  getRtcDisplayName,
  getRtcDisplayNameOptional,
  getRtcRoom,
  getRtcUserId,
  logRtcEvent,
  setRtcDisplayName,
} from "@/lib/rtc/client";
import { handleRtcEvent } from "@/lib/rtc/applyEvent";
import { emitRtcEvent } from "@/lib/rtc/emitter";
import { extractCanvasSchema } from "@/lib/audit/schemaExtraction";
import type { RtcEvent } from "@/lib/rtc/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function RTCBridge() {
  const params = useSearchParams();
  const pathname = usePathname();
  const room = useMemo(() => params.get("room") ?? undefined, [params]);
  const shouldEnable =
    typeof window !== "undefined" &&
    (pathname?.startsWith("/Dashboard") || pathname?.startsWith("/account"));
  const [nameOpen, setNameOpen] = useState(false);
  const [displayName, setDisplayNameState] = useState("");
  const [nameReady, setNameReady] = useState(false);

  useEffect(() => {
    if (!shouldEnable) return;
    const stored = getRtcDisplayNameOptional();
    if (stored) {
      setDisplayNameState(stored);
      setNameReady(true);
      return;
    }
    const suggested = `User-${Math.random().toString(36).slice(2, 6)}`;
    setDisplayNameState(suggested);
    setNameOpen(true);
    setNameReady(false);
  }, []);

  useEffect(() => {
    if (!shouldEnable || !nameReady) return;
    let active = true;
    let socket: ReturnType<typeof getRtcClient> | null = null;
    let handleConnect: (() => void) | null = null;
    let handleDisconnect: (() => void) | null = null;
    let handleEvent: ((event: RtcEvent) => void) | null = null;
    const init = async () => {
      await fetch("/api/socket");
      const name = getRtcDisplayName();
      socket = getRtcClient({ room: getRtcRoom(room), displayName: name });
      handleConnect = () => console.log("[RTC] Connected");
      handleDisconnect = () => console.log("[RTC] Disconnected");
      socket.on("connect", handleConnect);
      socket.on("disconnect", handleDisconnect);
      emitRtcEvent("RTC_REQUEST_SNAPSHOT", { reason: "join" });
      handleEvent = (event: RtcEvent) => {
        if (!active) return;
        if (event.userId === getRtcUserId()) return;
        logRtcEvent(event, "received");
        if (event.type === "RTC_REQUEST_SNAPSHOT") {
          const snapshot = extractCanvasSchema();
          if (snapshot.tables.length > 0) {
            emitRtcEvent("RTC_SNAPSHOT", { snapshot });
          }
          return;
        }
        if (event.type === "EDITOR_STATUS") {
          window.dispatchEvent(
            new CustomEvent("rtc:editor", { detail: event }),
          );
          return;
        }
        handleRtcEvent(event);
        if (
          event.type === "RUN_AUDIT" ||
          event.type === "AUDIT_RESULT" ||
          event.type === "APPLY_FIX" ||
          event.type === "APPLY_ALL_SAFE_FIXES"
        ) {
          window.dispatchEvent(new CustomEvent("rtc:audit", { detail: event }));
        }
      };
      socket.on("rtc:event", handleEvent);
    };

    void init();

    return () => {
      active = false;
      if (socket && handleConnect) socket.off("connect", handleConnect);
      if (socket && handleDisconnect)
        socket.off("disconnect", handleDisconnect);
      if (socket && handleEvent) socket.off("rtc:event", handleEvent);
      socket?.disconnect();
    };
  }, [nameReady, room, shouldEnable]);

  const handleNameSave = () => {
    const next = displayName.trim();
    if (!next) return;
    setRtcDisplayName(next);
    window.dispatchEvent(new CustomEvent("rtc:name", { detail: next }));
    setNameOpen(false);
    setNameReady(true);
  };

  if (!shouldEnable) {
    return null;
  }

  return (
    <>
      {nameOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-background shadow-xl">
            <div className="border-b border-border px-5 py-4">
              <h3 className="text-sm font-semibold text-foreground">
                Collaboration name
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                What should others see your name as?
              </p>
            </div>
            <div className="px-5 py-4">
              <Input
                value={displayName}
                onChange={(e) => setDisplayNameState(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              <Button size="sm" onClick={handleNameSave}>
                Continue
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
