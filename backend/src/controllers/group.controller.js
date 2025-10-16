import mongoose from "mongoose";
import Group from "../models/group.model.js";
import User from "../models/user.model.js";
import { io, getReceiverSocketId } from "../lib/socket.js";
import cloudinary from "../lib/cloudinary.js";

export const createGroup = async (req, res) => {
  try {
    const { name, members = [], avatar } = req.body;
    const createdBy = req.user._id;

    // Ensure creator is included and unique
    const uniqueMembers = Array.from(new Set([...members.map(String), String(createdBy)])).map((m) => m);

    // Validate member IDs exist
    const membersExist = await User.find({ _id: { $in: uniqueMembers } }).select("_id");
    if (membersExist.length !== uniqueMembers.length) {
      return res.status(400).json({ message: "One or more member IDs are invalid" });
    }

    // If avatar data is provided (data URL or image URL), upload to Cloudinary
    let avatarUrl = avatar;
    if (avatar) {
      try {
        const uploadResponse = await cloudinary.uploader.upload(avatar, {
          folder: "shieldchat/groups",
        });
        avatarUrl = uploadResponse.secure_url;
      } catch (uploadErr) {
        console.error("Cloudinary upload error:", uploadErr.message);
        // proceed without failing; keep avatar as original value or null
      }
    }

  // By default, creator is an admin
  const admins = [createdBy];
  const group = await Group.create({ name, members: uniqueMembers, avatar: avatarUrl, createdBy, admins });

    // Populate members (omit sensitive fields)
    await group.populate({ path: "members", select: "-password" });

    // Emit socket event to each member so they get real-time update
    try {
      uniqueMembers.forEach((memberId) => {
        const socketId = getReceiverSocketId(memberId);
        if (socketId) {
          io.to(socketId).emit("newGroup", group);
        }
      });
    } catch (emitErr) {
      console.error("Error emitting newGroup sockets:", emitErr.message);
    }

    res.status(201).json(group);
  } catch (err) {
    console.error("createGroup error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

export const getGroups = async (req, res) => {
  try {
    const userId = req.user._id;
    const groups = await Group.find({ members: userId }).populate({ path: "members", select: "-password" });
    res.status(200).json(groups);
  } catch (err) {
    console.error("getGroups error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

export const removeMember = async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const requesterId = String(req.user._id);

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    // Allow group creator or admins to remove members.
    const isCreator = String(group.createdBy) === requesterId;
    const isAdmin = (group.admins || []).some((a) => String(a) === requesterId);
    if (!isCreator && !isAdmin) {
      return res.status(403).json({ message: "Only group admins can remove members" });
    }

    // Prevent removing creator
    if (String(memberId) === String(group.createdBy)) {
      return res.status(400).json({ message: "Cannot remove group creator" });
    }

    // If target is an admin, only creator can remove them
    const isTargetAdmin = (group.admins || []).some((a) => String(a) === String(memberId));
    if (isTargetAdmin && !isCreator) {
      return res.status(403).json({ message: "Only group creator can remove another admin" });
    }

    // Remove member if present
    const beforeCount = group.members.length;
    group.members = group.members.filter((m) => String(m) !== String(memberId));
    if (group.members.length === beforeCount) {
      return res.status(400).json({ message: "Member not in group" });
    }

    await group.save();
    await group.populate({ path: "members", select: "-password" });

    // Notify remaining members and the removed member via sockets
    try {
      group.members.forEach((m) => {
        const socketId = getReceiverSocketId(m);
        if (socketId) io.to(socketId).emit("groupUpdated", group);
      });

      // Notify removed member specifically
      const removedSocketId = getReceiverSocketId(memberId);
      if (removedSocketId) {
        io.to(removedSocketId).emit("removedFromGroup", { groupId, groupName: group.name });
      }
    } catch (emitErr) {
      console.error("Error emitting group removal sockets:", emitErr.message);
    }

    res.status(200).json(group);
  } catch (err) {
    console.error("removeMember error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const requesterId = String(req.user._id);

    console.log(`deleteGroup requested by ${requesterId} for group ${groupId}`);

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    // Only creator or admins can delete group; prefer creator only
    const isCreator = String(group.createdBy) === requesterId;
    const isAdmin = (group.admins || []).some((a) => String(a) === requesterId);
    if (!isCreator && !isAdmin) {
      return res.status(403).json({ message: "Only group admins can delete group" });
    }

    // Delete group
    const deleted = await Group.findByIdAndDelete(groupId);
    if (!deleted) {
      console.warn(`Failed to delete group ${groupId} - not found when deleting`);
      return res.status(404).json({ message: "Group not found or already deleted" });
    }

    // Notify previous members that the group was deleted
    try {
      const allMembers = group.members || [];
      allMembers.forEach((m) => {
        const socketId = getReceiverSocketId(m);
        if (socketId) io.to(socketId).emit("groupDeleted", { groupId, groupName: group.name });
      });
    } catch (emitErr) {
      console.error("Error emitting groupDeleted sockets:", emitErr.message);
    }

    res.status(200).json({ message: "Group deleted", groupId });
  } catch (err) {
    console.error("deleteGroup error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, avatar } = req.body;
    const requesterId = String(req.user._id);

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    // Only creator or admins can update group
    const isCreator = String(group.createdBy) === requesterId;
    const isAdmin = (group.admins || []).some((a) => String(a) === requesterId);
    if (!isCreator && !isAdmin) return res.status(403).json({ message: "Only group admins can update group" });

    if (name) group.name = name;

    if (avatar) {
      // upload to cloudinary
      try {
        const uploadResponse = await cloudinary.uploader.upload(avatar, { folder: "shieldchat/groups" });
        group.avatar = uploadResponse.secure_url;
      } catch (uploadErr) {
        console.error("Cloudinary upload error on update:", uploadErr.message);
      }
    }

    await group.save();
    await group.populate({ path: "members", select: "-password" });

    // Notify members about update
    try {
      (group.members || []).forEach((m) => {
        const socketId = getReceiverSocketId(m);
        if (socketId) io.to(socketId).emit("groupUpdated", group);
      });
    } catch (emitErr) {
      console.error("Error emitting group update sockets:", emitErr.message);
    }

    res.status(200).json(group);
  } catch (err) {
    console.error("updateGroup error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

export const promoteMember = async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const requesterId = String(req.user._id);

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    // Only existing admins (or creator) can promote members
    const isAdmin = (group.admins || []).some((a) => String(a) === requesterId) || String(group.createdBy) === requesterId;
    if (!isAdmin) return res.status(403).json({ message: "Only group admins can promote members" });

    // Ensure member is in group
    if (!group.members.map(String).includes(String(memberId))) {
      return res.status(400).json({ message: "Member not in group" });
    }

    // Already admin?
    if ((group.admins || []).some((a) => String(a) === String(memberId))) {
      return res.status(400).json({ message: "Member is already an admin" });
    }

    group.admins = Array.from(new Set([...(group.admins || []), String(memberId)]));
    await group.save();
    await group.populate({ path: "members", select: "-password" });

    // Emit update
    try {
      (group.members || []).forEach((m) => {
        const socketId = getReceiverSocketId(m);
        if (socketId) io.to(socketId).emit("groupUpdated", group);
      });
    } catch (emitErr) {
      console.error("Error emitting group promote sockets:", emitErr.message);
    }

    res.status(200).json(group);
  } catch (err) {
    console.error("promoteMember error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

export const demoteMember = async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const requesterId = String(req.user._id);

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    // Only creator can demote admins (safer default)
    const isCreator = String(group.createdBy) === requesterId;
    if (!isCreator) return res.status(403).json({ message: "Only group creator can demote admins" });

    // Prevent demoting creator
    if (String(memberId) === String(group.createdBy)) {
      return res.status(400).json({ message: "Cannot demote group creator" });
    }

    const before = (group.admins || []).length;
    group.admins = (group.admins || []).filter((a) => String(a) !== String(memberId));
    if (group.admins.length === before) {
      return res.status(400).json({ message: "Member is not an admin" });
    }

    await group.save();
    await group.populate({ path: "members", select: "-password" });

    // Emit update
    try {
      (group.members || []).forEach((m) => {
        const socketId = getReceiverSocketId(m);
        if (socketId) io.to(socketId).emit("groupUpdated", group);
      });
    } catch (emitErr) {
      console.error("Error emitting group demote sockets:", emitErr.message);
    }

    res.status(200).json(group);
  } catch (err) {
    console.error("demoteMember error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

export const leaveGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = String(req.user._id);

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    // Prevent creator from leaving directly
    if (String(group.createdBy) === userId) {
      return res.status(400).json({ message: "Group creator cannot leave the group. Delete or transfer ownership instead." });
    }

    // Remove member
    const before = group.members.length;
    group.members = group.members.filter((m) => String(m) !== userId);
    if (group.members.length === before) return res.status(400).json({ message: "You are not a member of this group" });

    // Also remove from admins if present
    group.admins = (group.admins || []).filter((a) => String(a) !== userId);

    await group.save();
    await group.populate({ path: "members", select: "-password" });

    // Notify remaining members
    try {
      (group.members || []).forEach((m) => {
        const socketId = getReceiverSocketId(m);
        if (socketId) io.to(socketId).emit("groupUpdated", group);
      });

      // Notify leaver specifically
      const socketId = getReceiverSocketId(userId);
      if (socketId) io.to(socketId).emit("removedFromGroup", { groupId, groupName: group.name, by: "left" });
    } catch (emitErr) {
      console.error("Error emitting leaveGroup sockets:", emitErr.message);
    }

    res.status(200).json({ message: "Left group" });
  } catch (err) {
    console.error("leaveGroup error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};
