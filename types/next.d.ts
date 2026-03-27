import type { Server as HTTPServer } from "http";
import type { Socket } from "net";
import type { Server as IOServer } from "socket.io";
import type { NextApiResponse } from "next";

export type SocketServer = HTTPServer & {
  io?: IOServer;
  rtcSnapshots?: Record<string, unknown>;
};

export type SocketWithServer = Socket & {
  server: SocketServer;
};

export type NextApiResponseServerIO = NextApiResponse & {
  socket: SocketWithServer;
};
