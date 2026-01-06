import User from "../models/user.model.js";
import Message from "../models/message.model.js";

// Trust check configuration
const INTERACTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const INTERACTION_THRESHOLD = 10; // messages exchanged in window to be considered trusted

export async function isTrustedPair(senderId, receiverId) {
  if (!senderId || !receiverId) return false;

  // check friendship list quickly
  try {
    const sender = await User.findById(senderId).select("friends");
    if (sender && sender.friends && sender.friends.some(f => f.toString() === receiverId.toString())) {
      return true;
    }
  } catch (e) {
    // ignore and try interaction-based check
  }

  // check interaction history (both directions)
  try {
    const since = new Date(Date.now() - INTERACTION_WINDOW_MS);
    const count = await Message.countDocuments({
      $or: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId }
      ],
      createdAt: { $gte: since }
    }).exec();

    return count >= INTERACTION_THRESHOLD;
  } catch (e) {
    return false;
  }
}
