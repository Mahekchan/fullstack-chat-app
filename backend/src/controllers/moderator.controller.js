import ModeratorAlert from "../models/moderatorAlert.model.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

export const listAlerts = async (req, res) => {
  try {
    const { status, limit = 50, skip = 0 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const alerts = await ModeratorAlert.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10))
      .skip(parseInt(skip, 10));
    res.status(200).json(alerts);
  } catch (e) {
    console.error("listAlerts", e.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const actOnAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // approve | dismiss | escalate
    const alert = await ModeratorAlert.findById(id);
    if (!alert) return res.status(404).json({ error: "Alert not found" });

    if (action === "approve") alert.status = "approved";
    else if (action === "dismiss") alert.status = "dismissed";
    else if (action === "escalate") alert.status = "escalated";
    else return res.status(400).json({ error: "Invalid action" });

    await alert.save();

    // notify sender if approved/escalated (optional)
    try {
      if (alert.senderId && (alert.status === "approved" || alert.status === "escalated")) {
        const sid = getReceiverSocketId(alert.senderId.toString());
        if (sid) {
          io.to(sid).emit("moderationResult", { alertId: alert._id, status: alert.status });
        }
      }
    } catch (err) {
      console.error("moderation notify error", err.message);
    }

    res.status(200).json(alert);
  } catch (e) {
    console.error("actOnAlert", e.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createAlert = async (payload) => {
  // used internally by server to persist an alert
  try {
    const a = new ModeratorAlert(payload);
    await a.save();
    return a;
  } catch (e) {
    console.error("createAlert", e.message);
    return null;
  }
};
