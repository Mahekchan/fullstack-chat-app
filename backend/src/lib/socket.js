import { Server } from "socket.io";
import http from "http";
import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

const app = express();
const server = http.createServer(app);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:5173", "http://localhost:3000"];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

// used to store online users
const userSocketMap = {}; // {userId: socketId}

export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  const userId = socket.handshake.query.userId;
  if (userId) userSocketMap[userId] = socket.id;

  // io.emit() is used to send events to all the connected clients
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.id);
    if (userId) delete userSocketMap[userId];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

// Moderators namespace: authenticated join -> room "alerts"
const moderatorsNs = io.of("/moderators");

moderatorsNs.on("connection", async (socket) => {
  const token = socket.handshake?.auth?.token || socket.handshake?.query?.token;
  if (!token) {
    socket.emit("error", "auth-required");
    return socket.disconnect(true);
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    socket.emit("error", "invalid-token");
    return socket.disconnect(true);
  }

  try {
    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      socket.emit("error", "user-not-found");
      return socket.disconnect(true);
    }

    const allowedRoles = ["moderator", "teacher", "admin"];
    if (!allowedRoles.includes(user.role)) {
      socket.emit("error", "not-authorized");
      return socket.disconnect(true);
    }

    socket.join("alerts");
    socket.emit("joinedAlerts", { message: "joined alerts room" });

    socket.on("leaveAlerts", () => {
      socket.leave("alerts");
    });
  } catch (err) {
    console.error("moderatorsNs auth error", err.message);
    socket.emit("error", "server-error");
    socket.disconnect(true);
  }
});

export { io, moderatorsNs, app, server };