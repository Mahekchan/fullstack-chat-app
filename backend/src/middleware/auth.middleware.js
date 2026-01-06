import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

// simple rate-limited logger to avoid spamming the console with repeated auth logs
const lastAuthLog = new Map();
const LOG_INTERVAL_MS = 10 * 1000; // log at most once per 10s per user+route

export const protectRoute = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;

    if (!token) {
      // only log missing token when not a static asset request
      if (!req.originalUrl.startsWith("/assets")) {
        console.warn("protectRoute: no jwt cookie found on request", { url: req.originalUrl, method: req.method });
      }
      return res.status(401).json({ message: "Unauthorized - No Token Provided" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      console.warn("protectRoute: jwt verify failed", err.message);
      return res.status(401).json({ message: "Unauthorized - Invalid Token" });
    }

    // rate-limit token-decoded log entries
    try {
      const key = `${decoded?.userId}::${req.originalUrl}`;
      const now = Date.now();
      const last = lastAuthLog.get(key) || 0;
      if (now - last > LOG_INTERVAL_MS) {
        console.log("protectRoute: token decoded", { userId: decoded?.userId, url: req.originalUrl, method: req.method });
        lastAuthLog.set(key, now);
      }
    } catch (e) {
      // ignore logging errors
    }

    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    req.user = user;

    next();
  } catch (error) {
    console.error("Error in protectRoute middleware: ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};