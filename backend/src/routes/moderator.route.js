import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { listAlerts, actOnAlert } from "../controllers/moderator.controller.js";

const router = express.Router();

router.get("/alerts", protectRoute, listAlerts);
router.post("/alerts/:id/action", protectRoute, actOnAlert);

export default router;
