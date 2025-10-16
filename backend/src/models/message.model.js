import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      // optional for group messages
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
    },
    deliveredTo: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    readBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    text: {
      type: String,
      required: true,
    },
    iv: {
      type: String,
    },
    tag: {
      type: String,
    },
    isFlagged: {
      type: Boolean,
      required: true,
      default: false,
    },
    severity: {
      type: String,
      enum: ["High", "Medium", "Low"],
      default: "Low",
    },
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);

export default Message;