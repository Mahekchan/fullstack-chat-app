import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";

export const useGroupStore = create((set) => ({
  groups: [],
  isCreating: false,

  fetchGroups: async () => {
    try {
      const res = await axiosInstance.get("/groups");
      set({ groups: res.data });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to fetch groups");
    }
  },

  createGroup: async (payload) => {
    set({ isCreating: true });
    try {
      const res = await axiosInstance.post("/groups", payload);
      set((state) => ({ groups: [res.data, ...state.groups], isCreating: false }));
      toast.success("Group created");
      return res.data;
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to create group");
      set({ isCreating: false });
      throw error;
    }
  },
  addGroup: (group) => set((state) => ({ groups: [group, ...state.groups] })),
  updateGroup: (group) => set((state) => ({ groups: state.groups.map((g) => (g._id === group._id ? group : g)) })),
  removeGroup: (groupId) => set((state) => ({ groups: state.groups.filter((g) => g._id !== groupId) })),
  mutedGroups: [],
  muteGroup: (groupId) => set((state) => ({ mutedGroups: Array.from(new Set([...(state.mutedGroups || []), groupId])) })),
  unmuteGroup: (groupId) => set((state) => ({ mutedGroups: (state.mutedGroups || []).filter((id) => id !== groupId) })),
  toggleMute: (groupId) => set((state) => ({ mutedGroups: (state.mutedGroups || []).includes(groupId) ? (state.mutedGroups || []).filter((id) => id !== groupId) : Array.from(new Set([...(state.mutedGroups || []), groupId])) })),
}));

export default useGroupStore;
