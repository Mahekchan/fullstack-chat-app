import { X, Bell, BellOff, LogOut } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useState } from "react";
import GroupMembersModal from "./GroupMembersModal";
import { useGroupStore } from "../store/useGroupStore";
import { axiosInstance } from "../lib/axios";

const ChatHeader = () => {
  const { selectedUser, setSelectedUser } = useChatStore();
  const { onlineUsers } = useAuthStore();
  const { mutedGroups, toggleMute } = useGroupStore();
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);

  return (
    <div className="p-2.5 border-b border-base-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="avatar">
            <div className="size-10 rounded-full relative">
              <img
                src={selectedUser?.isGroup ? (selectedUser.avatar || "/avatar.png") : (selectedUser.profilePic || "/avatar.png")}
                alt={selectedUser?.isGroup ? selectedUser.name : selectedUser?.fullName}
              />
            </div>
          </div>

          {/* User info */}
          <div>
            <h3 className="font-medium flex items-center gap-2">
              {selectedUser.isGroup ? (
                <span className="cursor-pointer" onClick={() => setIsGroupModalOpen(true)}>{selectedUser.name}</span>
              ) : (
                selectedUser.fullName
              )}
              {selectedUser.isGroup && mutedGroups.includes(selectedUser._id) && (
                <span className="text-zinc-500" aria-hidden>
                  <BellOff className="w-4 h-4" />
                </span>
              )}
            </h3>
            {!selectedUser.isGroup && (
              <p className="text-sm text-base-content/70">
                {onlineUsers.includes(selectedUser._id) ? "Online" : "Offline"}
              </p>
            )}
          </div>
        </div>

        {/* Centered Group actions removed; using right-corner icon buttons only */}

        <div className="flex items-center gap-2">
          {/* Group actions (right corner) */}
          {selectedUser?.isGroup && (
            <div className="flex items-center gap-2 mr-2">
              <div className="relative">
                <button
                  className="btn btn-sm btn-outline btn-square"
                  onClick={() => toggleMute(selectedUser._id)}
                >
                  {mutedGroups.includes(selectedUser._id) ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                </button>
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-base-100 px-2 py-1 text-xs text-base-content/70 opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100">
                  {mutedGroups.includes(selectedUser._id) ? "Unmute" : "Mute"}
                </span>
              </div>
              <div className="relative">
                <button
                  className="btn btn-sm btn-ghost btn-square"
                  onClick={async () => {
                    if (!confirm("Leave this group?")) return;
                    try {
                      await axiosInstance.post(`/groups/${selectedUser._id}/leave`);
                      useGroupStore.getState().removeGroup(selectedUser._id);
                      setSelectedUser(null);
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                >
                  <LogOut className="w-4 h-4" />
                </button>
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-base-100 px-2 py-1 text-xs text-base-content/70 opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100">Leave</span>
              </div>
            </div>
          )}

          {/* Close button */}
          <button onClick={() => setSelectedUser(null)}>
            <X />
          </button>
        </div>
      </div>
      {selectedUser?.isGroup && (
        <GroupMembersModal open={isGroupModalOpen} onClose={() => setIsGroupModalOpen(false)} group={selectedUser} />
      )}
    </div>
  );
};
export default ChatHeader;