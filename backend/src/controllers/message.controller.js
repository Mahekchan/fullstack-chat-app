
import mongoose from "mongoose";
import User from "../models/user.model.js";
import Group from "../models/group.model.js";
import Message from "../models/message.model.js";

import { getReceiverSocketId, io } from "../lib/socket.js";
import { encryptMessage, decryptMessage, isKeyConfigured } from "../lib/messageCrypto.js";
import { detectBullying } from "../lib/bullyDetector.js";
import { recordFlag, resetCounts } from "../lib/repetitionDetector.js";
import { isTrustedPair } from "../lib/trust.js";
import { createAlert } from "./moderator.controller.js";

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } }).select("-password");

    res.status(200).json(filteredUsers);
  } catch (error) {
    console.error("Error in getUsersForSidebar: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    // If the id is a group id, return group messages
    const group = await Group.findById(userToChatId);
    let messages;
    if (group) {
      messages = await Message.find({ groupId: userToChatId });
    } else {
      messages = await Message.find({
        $or: [
          { senderId: myId, receiverId: userToChatId },
          { senderId: userToChatId, receiverId: myId },
        ],
      });
    }

    // Decrypt or send plain text based on isFlagged
    const result = await Promise.all(messages.map(async (msg) => {
      let text;
      if (msg.isFlagged) {
        text = msg.text;
      } else {
        if (!msg.text || !msg.iv || !msg.tag) {
          text = "[Message corrupted or missing encryption data]";
        } else {
          try {
            text = decryptMessage(msg.text, msg.iv, msg.tag);
          } catch (e) {
            text = "[Decryption failed]";
          }
        }
      }
      const senderInfo = await User.findById(msg.senderId).select("fullName profilePic");

      return {
        _id: msg._id,
        senderId: msg.senderId,
        senderName: senderInfo?.fullName,
        senderProfilePic: senderInfo?.profilePic,
        receiverId: msg.receiverId,
        groupId: msg.groupId,
        text,
        isFlagged: msg.isFlagged,
        deliveredTo: (msg.deliveredTo || []).map(d => d.toString()),
        readBy: (msg.readBy || []).map(r => r.toString()),
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt,
        isDeleted: msg.isDeleted,
        __v: msg.__v,
      };
  }));

  res.status(200).json(result);
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, groupId } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    let messageData;
    const detection = detectBullying(text);
    let repetitionResult = null;
    if (detection.isBullying) {
      // record repetition for sender->receiver (or group)
      repetitionResult = recordFlag({ senderId, receiverId, groupId, timestamp: new Date() });
      messageData = {
        senderId,
        receiverId,
        groupId: groupId || undefined,
        text,
        isFlagged: true,
        severity: detection.severity,
        meta: { language: detection.language, matches: detection.matched, repetition: repetitionResult }
      };
    } else {
      // ensure encryption key configured before encrypting
      if (!isKeyConfigured()) {
        return res.status(400).json({ error: "Server misconfiguration: MESSAGE_SECRET_KEY not set" });
      }
      const { ciphertext, iv, tag } = encryptMessage(text);
      messageData = {
        senderId,
        receiverId,
        groupId: groupId || undefined,
        text: ciphertext,
        iv,
        tag,
        isFlagged: false,
        severity: null,
      };
    }

  const newMessage = new Message(messageData);
  await newMessage.save();

  // populate sender info for response/emit
  const sender = await User.findById(senderId).select("fullName profilePic");

    // 🧩 Automatic duplication to test.messages (only once)
    (async () => {
      try {
        const testDb = mongoose.connection.useDb("test");
        // Prepare duplicate, remove _id so MongoDB generates a new one
        const duplicate = {
          ...newMessage.toObject(),
          _id: undefined
        };
        await testDb.collection("messages").insertOne(duplicate);
      } catch (err) {
        console.error("Error duplicating message to test DB:", err.message);
      }
    })();

    // Prepare message for socket emit and response
    const responseMessage = {
      _id: newMessage._id,
      senderId: newMessage.senderId,
      senderName: sender?.fullName,
      senderProfilePic: sender?.profilePic,
      receiverId: newMessage.receiverId,
      groupId: newMessage.groupId,
      text: messageData.isFlagged ? text : text,
      isFlagged: messageData.isFlagged,
      deliveredTo: (newMessage.deliveredTo || []).map(d => d.toString()),
      readBy: (newMessage.readBy || []).map(r => r.toString()),
      createdAt: newMessage.createdAt,
      updatedAt: newMessage.updatedAt,
      __v: newMessage.__v,
    };

    // If it's a group message, emit to all group members (except sender)
    // Track delivered receipts and emit newMessage events
    if (groupId) {
      const group = await Group.findById(groupId).select("members");
      if (group && group.members && group.members.length) {
        const delivered = [];
        for (const memberId of group.members) {
          if (memberId.toString() === senderId.toString()) continue;
          const socketId = getReceiverSocketId(memberId.toString());
          if (socketId) {
            io.to(socketId).emit("newMessage", { ...responseMessage, groupId });
            delivered.push(memberId);
          }
        }
        // update deliveredTo on message
        if (delivered.length) {
          await Message.findByIdAndUpdate(newMessage._id, { $addToSet: { deliveredTo: { $each: delivered } } });
        }
      }
    } else {
      const receiverSocketId = getReceiverSocketId(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("newMessage", responseMessage);
        await Message.findByIdAndUpdate(newMessage._id, { $addToSet: { deliveredTo: receiverId } });
      }
    }

    // Post-save: handle repetition-based actions (warnings/alerts)
    try {
      if (messageData.isFlagged && messageData.meta && messageData.meta.repetition) {
        const rep = messageData.meta.repetition;

        // For one-to-one messages, check trust; for groups skip trust
        let trusted = false;
        try {
          if (!newMessage.groupId && receiverId) {
            trusted = await isTrustedPair(senderId.toString(), receiverId.toString());
          }
        } catch (e) {
          trusted = false;
        }

        // If trusted pair, suppress automated warnings/alerts for low/medium
        if (trusted && rep.severity !== "high") {
          // downgrade severity to low and do not alert
          // keep record for auditing but do not notify
        } else {
          // Medium: send a warning to the sender's socket
          if (rep.severity === "medium") {
            const senderSocket = getReceiverSocketId(senderId.toString());
            if (senderSocket) {
              io.to(senderSocket).emit("userWarning", {
                message: "Your recent messages have been flagged as potentially abusive. Please stop.",
                repetitionCount: rep.repetitionCount,
              });
            }
          }

          // High: emit a moderator/teacher alert (broadcast for now)
          if (rep.shouldAlert) {
            // persist moderator alert
            try {
              const alert = await createAlert({
                messageId: newMessage._id,
                senderId,
                receiverId,
                groupId: newMessage.groupId,
                text: newMessage.text,
                severity: rep.severity,
                repetitionCount: rep.repetitionCount,
                meta: messageData.meta,
                trustedPair: trusted,
              });
              // notify moderators in real-time (optional broadcast)
              io.emit("moderatorAlert", alert);
            } catch (err) {
              console.error("failed creating moderator alert", err.message);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error handling repetition actions:", err.message);
    }

    res.status(201).json(responseMessage);
  } catch (error) {
    console.log("Error in sendMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const markDelivered = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const userId = req.user._id;

    await Message.findByIdAndUpdate(messageId, { $addToSet: { deliveredTo: userId } });

    // notify sender about delivery
    const msg = await Message.findById(messageId);
    if (msg) {
      // If it's a group message, notify all group members so everyone can update statuses
      if (msg.groupId) {
        const group = await Group.findById(msg.groupId).select("members");
        if (group && group.members && group.members.length) {
          for (const memberId of group.members) {
            const socketId = getReceiverSocketId(memberId.toString());
            if (socketId) {
              io.to(socketId).emit("messageDelivered", { messageId, userId });
            }
          }
        }
      } else {
        // one-to-one: notify sender (and receiver if connected)
        const senderSocket = getReceiverSocketId(msg.senderId.toString());
        if (senderSocket) io.to(senderSocket).emit("messageDelivered", { messageId, userId });
        const receiverSocket = getReceiverSocketId(msg.receiverId?.toString());
        if (receiverSocket) io.to(receiverSocket).emit("messageDelivered", { messageId, userId });
      }
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false });
  }
};

export const markRead = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const userId = req.user._id;

    await Message.findByIdAndUpdate(messageId, { $addToSet: { readBy: userId } });

    // notify sender about read
    const msg = await Message.findById(messageId);
    if (msg) {
      // If it's a group message, notify all group members so everyone can update statuses
      if (msg.groupId) {
        const group = await Group.findById(msg.groupId).select("members");
        if (group && group.members && group.members.length) {
          for (const memberId of group.members) {
            const socketId = getReceiverSocketId(memberId.toString());
            if (socketId) {
              io.to(socketId).emit("messageRead", { messageId, userId });
            }
          }
        }
      } else {
        // one-to-one: notify sender (and receiver if connected)
        const senderSocket = getReceiverSocketId(msg.senderId.toString());
        if (senderSocket) io.to(senderSocket).emit("messageRead", { messageId, userId });
        const receiverSocket = getReceiverSocketId(msg.receiverId?.toString());
        if (receiverSocket) io.to(receiverSocket).emit("messageRead", { messageId, userId });
      }
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false });
  }
};

export const checkMessage = async (req, res) => {
  try {
    const { text } = req.body;
    const result = detectBullying(text);
    // normalize output to frontend spec
    const out = {
      isBullying: !!result.isBullying,
      detectedLanguage: result.detectedLanguage || (result.language ? [result.language] : []),
      flaggedWords: (result.flaggedWords || []).map(f => ({ word: f.word, language: f.language })),
      severity: (result.severity || "low").toLowerCase(),
    };
    res.status(200).json(out);
  } catch (e) {
    console.error("Error in checkMessage: ", e.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const postFeedback = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const { type } = req.body; // e.g., 'joke'
    // simple: if 'joke', dismiss related moderator alerts and reset repetition counts
    if (type === "joke") {
      // find moderator alerts for this message and mark dismissed
      try {
        const ModeratorAlert = (await import("../models/moderatorAlert.model.js")).default;
        const alerts = await ModeratorAlert.find({ messageId });
        for (const a of alerts) {
          a.status = "dismissed";
          await a.save();
        }
      } catch (e) {
        console.error("feedback dismiss alerts error", e.message);
      }

      // reset repetition counts for sender->receiver
      try {
        const msg = await Message.findById(messageId);
        if (msg) {
          await resetCounts({ senderId: msg.senderId, receiverId: msg.receiverId, groupId: msg.groupId });
        }
      } catch (e) {
        console.error("feedback resetCounts error", e.message);
      }

      return res.status(200).json({ ok: true });
    }

    res.status(400).json({ error: "Unknown feedback type" });
  } catch (e) {
    console.error("postFeedback", e.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Only the sender can delete their own message
    if (message.senderId.toString() !== userId.toString()) {
      return res.status(403).json({ error: "You can only delete your own messages" });
    }

    // Soft delete: mark as deleted
    const updatedMessage = await Message.findByIdAndUpdate(messageId, { isDeleted: true }, { new: true });

    // Notify all participants via socket with the updated message
    if (message.groupId) {
      const group = await Group.findById(message.groupId).select("members");
      if (group && group.members && group.members.length) {
        for (const memberId of group.members) {
          const socketId = getReceiverSocketId(memberId.toString());
          if (socketId) {
            io.to(socketId).emit("messageUpdated", { messageId, isDeleted: true });
          }
        }
      }
    } else {
      // one-to-one: notify both sender and receiver
      const senderSocket = getReceiverSocketId(message.senderId.toString());
      if (senderSocket) io.to(senderSocket).emit("messageUpdated", { messageId, isDeleted: true });
      const receiverSocket = getReceiverSocketId(message.receiverId?.toString());
      if (receiverSocket) io.to(receiverSocket).emit("messageUpdated", { messageId, isDeleted: true });
    }

    res.status(200).json({ ok: true, messageId });
  } catch (e) {
    console.error("Error in deleteMessage:", e.message);
    res.status(500).json({ error: "Internal server error" });
  }
};