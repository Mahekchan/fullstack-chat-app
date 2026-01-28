import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getMessages, getUsersForSidebar, sendMessage, markDelivered, markRead, checkMessage, postFeedback, deleteMessage } from "../controllers/message.controller.js";

const router = express.Router();

router.get("/users", protectRoute, getUsersForSidebar);
router.get("/:id", protectRoute, getMessages);

router.post("/send/:id", protectRoute, sendMessage);
router.post("/check", protectRoute, checkMessage);
router.post("/:id/feedback", protectRoute, postFeedback);
router.post("/:id/delivered", protectRoute, markDelivered);
router.post("/:id/read", protectRoute, markRead);
router.delete("/:id", protectRoute, deleteMessage);

export default router;