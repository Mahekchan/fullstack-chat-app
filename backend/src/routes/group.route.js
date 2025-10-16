import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { createGroup, getGroups, removeMember, deleteGroup, updateGroup } from "../controllers/group.controller.js";
import { promoteMember, demoteMember } from "../controllers/group.controller.js";
import { leaveGroup } from "../controllers/group.controller.js";

const router = express.Router();

// Debugging middleware: log incoming requests to /api/groups
router.use((req, res, next) => {
	try {
		console.log(`[groups route] ${req.method} ${req.originalUrl} cookies=${JSON.stringify(Object.keys(req.cookies || {}))}`);
	} catch (e) {
		console.log('[groups route] logging error', e.message);
	}
	next();
});

router.get("/", protectRoute, getGroups);
router.post("/", protectRoute, createGroup);
router.delete("/:groupId/members/:memberId", protectRoute, removeMember);
router.delete("/:groupId", protectRoute, deleteGroup);
router.put("/:groupId", protectRoute, updateGroup);
router.post("/:groupId/promote/:memberId", protectRoute, promoteMember);
router.post("/:groupId/demote/:memberId", protectRoute, demoteMember);
router.post("/:groupId/leave", protectRoute, leaveGroup);

export default router;
