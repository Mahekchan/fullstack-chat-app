
import mongoose from "mongoose";
import User from "../models/user.model.js";
import Group from "../models/group.model.js";
import Message from "../models/message.model.js";

import { getReceiverSocketId, io } from "../lib/socket.js";
import { containsBullying, encryptMessage, decryptMessage } from "../lib/messageCrypto.js";

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
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt,
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
    let isFlagged = false;
    let severity = "Low";
    const lower = text.toLowerCase();
    // High severity: threats, hate speech, suicide, violence
    const highKeywords = [
      "kill", "dead", "die", "suicide", "hurt", "smash", "beat", "terrorist", "racist", "slave", "nazi", "hitler", "hate", "drop dead", "go die", "watch your back", "regret", "break your face", "break you", "smash your head", "beat you up",
      // Threats
      "i will hurt you", "i will kill you", "kill your self", "watch your back", "you'll regret this",
      "you're dead", "i'll beat you", "i'll smash you", "break your face",
      "i'll break you", "beat you up", "smash your head",
            // Hate speech: religion
      "islamophobe", "muslim terrorist", "fake jew", "christfag", "catholic dog",
      "infidel", "heathen scum",
    ];
    // Medium severity: insults, profanity, harassment, body shaming
    const mediumKeywords = [
      "idiot", "stupid", "loser", "dumb", "moron", "fool", "clown", "jerk", "useless", "pathetic", "worthless", "failure", "trash", "garbage", "crybaby", "weakling", "coward", "pig", "dog", "rat", "snake", "fatty", "ugly", "mad", "obese", "disgusting", "gross", "fatso", "skinny", "toothpick", "stick", "string bean", "bony", "skeleton", "brain dead", "slow", "retard", "retarded", "dimwit", "halfwit", "simpleton", "pea brain", "empty head", "blockhead", "airhead", "bitch", "bastard", "asshole", "dick", "prick", "slut", "whore", "hoe", "tramp", "skank", "scumbag", "jackass", "punk", "douche", "douchebag"
      // Profanity / derogatory terms
      ,"bitch", "bastard", "asshole", "dick", "prick", "slut", "whore", "hoe",
      "tramp", "skank", "scumbag", "jackass", "punk", "douche", "douchebag",
    ];
    // Low severity: school-specific, mild teasing, annoying
    const lowKeywords = [
      "nerd", "geek", "teacher's pet", "loser face", "four eyes", "know-it-all", "brown noser", "tattletale", "crybaby", "mad", "annoying", "no one cares", "get lost", "go away forever"
        // Bullying
      ,"idiot", "stupid", "loser", "dumb", "moron", "fool", "clown", "jerk", "useless", 
      "kill yourself", "pathetic", "worthless", "failure", "trash", "garbage", "nerd", "geek", 
      "crybaby", "weakling", "coward", "fatty", "ugly", "mad",
    ];

    // Check for severity and flag only if keyword matches
    let matchedSeverity = null;
    if (highKeywords.some(word => lower.includes(word))) {
      matchedSeverity = "High";
    } else if (mediumKeywords.some(word => lower.includes(word))) {
      matchedSeverity = "Medium";
    } else if (lowKeywords.some(word => lower.includes(word))) {
      matchedSeverity = "Low";
    }

    if (matchedSeverity) {
      // Store flagged (bully) message as plaintext
      messageData = {
        senderId,
        receiverId,
        groupId: groupId || undefined,
        text,
        isFlagged: true,
        severity: matchedSeverity,
      };
    } else {
      // Store normal message as encrypted
      const { ciphertext, iv, tag } = encryptMessage(text);
      messageData = {
        senderId,
        receiverId,
        groupId: groupId || undefined,
        text: ciphertext,
        iv,
        tag,
        isFlagged: false,
        severity: "Low",
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
      const senderSocket = getReceiverSocketId(msg.senderId.toString());
      if (senderSocket) {
        io.to(senderSocket).emit("messageDelivered", { messageId, userId });
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
      const senderSocket = getReceiverSocketId(msg.senderId.toString());
      if (senderSocket) {
        io.to(senderSocket).emit("messageRead", { messageId, userId });
      }
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false });
  }
};