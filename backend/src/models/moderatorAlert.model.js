import mongoose from "mongoose";

const moderatorAlertSchema = new mongoose.Schema(
  {
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
    },
    text: {
      type: String,
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "low",
    },
    repetitionCount: {
      type: Number,
      default: 0,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "dismissed", "escalated"],
      default: "pending",
    },
  },
  { timestamps: true }
);

const ModeratorAlert = mongoose.model("ModeratorAlert", moderatorAlertSchema);

export default ModeratorAlert;
