
import mongoose from "mongoose";
import User from "../models/user.model.js";
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

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    });

    // Decrypt or send plain text based on isFlagged
    const result = messages.map(msg => {
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
      return {
        _id: msg._id,
        senderId: msg.senderId,
        receiverId: msg.receiverId,
        text,
        isFlagged: msg.isFlagged,
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt,
        __v: msg.__v,
      };
    });

    res.status(200).json(result);
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    let messageData;
    let isFlagged = false;
    if (containsBullying(text)) {
      isFlagged = true;
      messageData = {
        senderId,
        receiverId,
        text,
        isFlagged: true,
      };
    } else {
      const { ciphertext, iv, tag } = encryptMessage(text);
      messageData = {
        senderId,
        receiverId,
        text: ciphertext,
        iv,
        tag,
        isFlagged: false,
      };
    }

    const newMessage = new Message(messageData);
    await newMessage.save();

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
      receiverId: newMessage.receiverId,
      text: messageData.isFlagged ? text : text,
      isFlagged: messageData.isFlagged,
      createdAt: newMessage.createdAt,
      updatedAt: newMessage.updatedAt,
      __v: newMessage.__v,
    };

    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", responseMessage);
    }

    res.status(201).json(responseMessage);
  } catch (error) {
    console.log("Error in sendMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};