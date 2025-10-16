import React from "react";
import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

const BASE_URL = import.meta.env.MODE === "development" ? "http://localhost:5001" : "/";

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfile: false,
  isCheckingAuth: true,
  onlineUsers: [],
  socket: null,

  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");

      set({ authUser: res.data });
      get().connectSocket();
    } catch (error) {
      console.log("Error in checkAuth:", error);
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", data);
      set({ authUser: res.data });
      toast.success("Account created successfully");
      get().connectSocket();
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      set({ authUser: res.data });
      toast.success("Logged in successfully");

      get().connectSocket();
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      set({ authUser: null });
      toast.success("Logged out successfully");
      get().disconnectSocket();
    } catch (error) {
      toast.error(error.response.data.message);
    }
  },

  updateProfile: async (data) => {
    set({ isUpdatingProfile: true });
    try {
      const res = await axiosInstance.put("/auth/update-profile", data);
      set({ authUser: res.data });
      toast.success("Profile updated successfully");
    } catch (error) {
      console.log("error in update profile:", error);
      toast.error(error.response.data.message);
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  connectSocket: () => {
    const { authUser } = get();
    if (!authUser || get().socket?.connected) return;

    const socket = io(BASE_URL, {
      query: {
        userId: authUser._id,
      },
    });
    socket.connect();

    set({ socket: socket });

    socket.on("getOnlineUsers", (userIds) => {
      set({ onlineUsers: userIds });
    });

    // When a new group is created and the server emits it, show a toast and add it to the group store
    socket.on("newGroup", (group) => {
      // Notify the user briefly that they were added to a group
      try {
        const groupName = group?.name || "a group";
        // clickable toast: when clicked, select the group chat
        toast.success((t) => React.createElement(
          "div",
          {
            style: { cursor: "pointer" },
            onClick: () => {
              import("./useChatStore").then((m) => {
                const setSelectedUser = m.useChatStore?.getState().setSelectedUser;
                if (setSelectedUser) setSelectedUser({ ...group, isGroup: true });
              });
              toast.dismiss(t.id);
            },
          },
          `Added to group ${groupName} — click to open`
        ));
      } catch (e) {
        // Non-fatal: keep going to add the group to the store
        console.error("Error showing newGroup toast:", e);
      }

      // Lazy dynamic import to avoid circular deps and keep ESM-compatible
      import("./useGroupStore").then((m) => {
        try {
          const gs = m.useGroupStore.getState();
          const groups = gs.groups || [];
          const exists = groups.some((g) => String(g._id) === String(group._id));
          if (exists) return; // already present (e.g., we added it locally after create)
          const addGroup = gs.addGroup;
          if (addGroup) addGroup(group);
        } catch (err) {
          console.error("Error handling incoming group in socket handler:", err);
        }
      }).catch((e) => {
        console.error("Error adding incoming group to store:", e);
      });
    });
  },
  disconnectSocket: () => {
    if (get().socket?.connected) get().socket.disconnect();
  },
}));