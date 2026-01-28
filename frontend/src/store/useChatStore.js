import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data });
      // Mark messages as read for current user
      const authUser = useAuthStore.getState().authUser;
      if (authUser) {
        res.data.forEach((m) => {
          if (!m.readBy || !m.readBy.includes(authUser._id)) {
            axiosInstance.post(`/messages/${m._id}/read`).catch(() => {});
          }
        });
      }
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isMessagesLoading: false });
    }
  },
  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    try {
      // Include groupId when sending to a group
      const body = { ...messageData };
      if (selectedUser?.isGroup) body.groupId = selectedUser._id;

      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, body);
      set({ messages: [...messages, res.data] });
    } catch (error) {
      toast.error(error.response.data.message);
    }
  },

  deleteMessage: async (messageId) => {
    try {
      await axiosInstance.delete(`/messages/${messageId}`);
      // Mark message as deleted in local state instead of removing it
      set({ messages: get().messages.map(m => m._id === messageId ? { ...m, isDeleted: true } : m) });
      toast.success("Message deleted");
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to delete message");
    }
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;

    socket.on("newMessage", (newMessage) => {
      // For one-to-one chats incoming message senderId should match selected user id
      if (!selectedUser) return;

      const isDirectMessageFromSelectedUser = !newMessage.groupId && newMessage.senderId === selectedUser._id;
      const isGroupMessageForSelectedGroup = selectedUser.isGroup && newMessage.groupId === selectedUser._id;

      if (!isDirectMessageFromSelectedUser && !isGroupMessageForSelectedGroup) return;

      // Append message locally
      const updated = [...get().messages, newMessage];
      set({ messages: updated });

      // Notify backend that this user received the message (mark delivered)
      (async () => {
        try {
          await axiosInstance.post(`/messages/${newMessage._id}/delivered`);
        } catch {
          // ignore
        }
      })();
    });

    // Listen for receipt events from server to update local messages
    socket.on("messageDelivered", ({ messageId, userId }) => {
      set({ messages: get().messages.map(m => m._id === messageId ? { ...m, deliveredTo: Array.from(new Set([...(m.deliveredTo||[]), userId])) } : m) });
    });

    socket.on("messageRead", ({ messageId, userId }) => {
      set({ messages: get().messages.map(m => m._id === messageId ? { ...m, readBy: Array.from(new Set([...(m.readBy||[]), userId])) } : m) });
    });

    // Listen for message update events (e.g., deletion)
    socket.on("messageUpdated", ({ messageId, isDeleted }) => {
      set({ messages: get().messages.map(m => m._id === messageId ? { ...m, isDeleted } : m) });
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    socket.off("newMessage");
    socket.off("messageDelivered");
    socket.off("messageRead");
    socket.off("messageUpdated");
  },

  setSelectedUser: (selectedUser) => set({ selectedUser }),
}));