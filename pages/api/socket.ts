import type { NextApiRequest } from "next";
import type { NextApiResponseServerIO } from "@/types/next";
import { Server, type Socket } from "socket.io";
import type { RtcEvent, SchemaSnapshotPayload } from "@/lib/rtc/events";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(
  _req: NextApiRequest,
  res: NextApiResponseServerIO,
) {
  const socketServer = res.socket?.server;
  if (!socketServer) {
    res.status(500).end("Socket server not available");
    return;
  }

  if (!socketServer.io) {
    const io = new Server(socketServer, {
      path: "/api/socket",
      addTrailingSlash: false,
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    socketServer.io = io;

    io.on("connection", (socket: Socket) => {
      const auth = socket.handshake.auth as
        | { room?: string; displayName?: string; userId?: string }
        | undefined;
      const room = auth?.room?.trim() || "default";

      socket.data.room = room;
      socket.join(room);

      console.log("[RTC] Client connected", socket.id, room);
      const existing = socketServer.rtcSnapshots?.[room] as
        | SchemaSnapshotPayload
        | undefined;
      if (existing) {
        socket.emit("rtc:event", {
          type: "RTC_SNAPSHOT",
          payload: { snapshot: existing },
          timestamp: Date.now(),
          userId: "server",
        } satisfies RtcEvent);
      }
      socket.on("rtc:event", (event: RtcEvent) => {
        const socketRoom = (socket.data.room as string) || "default";
        if (event.type === "RTC_SNAPSHOT") {
          if (!socketServer.rtcSnapshots) {
            socketServer.rtcSnapshots = {};
          }
          socketServer.rtcSnapshots[socketRoom] = event.payload.snapshot;
        }
        if (
          event.type === "RTC_REQUEST_SNAPSHOT" &&
          !socketServer.rtcSnapshots?.[socketRoom]
        ) {
          io.to(socketRoom).emit("rtc:event", {
            type: "RTC_REQUEST_SNAPSHOT",
            payload: { reason: "server-missing" },
            timestamp: Date.now(),
            userId: "server",
          } satisfies RtcEvent);
        }
        io.to(socketRoom).emit("rtc:event", event);
      });
      socket.on("disconnect", () => {
        console.log("[RTC] Client disconnected", socket.id);
      });
    });
  }

  res.end();
}
