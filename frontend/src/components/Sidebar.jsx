import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import { Users, PlusSquare } from "lucide-react";
import GroupModal from "./GroupModal";
import { useGroupStore } from "../store/useGroupStore";

const Sidebar = () => {
  const { getUsers, users, selectedUser, setSelectedUser, isUsersLoading } = useChatStore();

  const { onlineUsers } = useAuthStore();
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);

  const { groups, fetchGroups } = useGroupStore();

  useEffect(() => {
    getUsers();
    fetchGroups();
  }, [getUsers, fetchGroups]);

  const filteredUsers = showOnlineOnly
    ? users.filter((user) => onlineUsers.includes(user._id))
    : users;

  if (isUsersLoading) return <SidebarSkeleton />;

  return (
    <>
    <aside className="h-full w-20 lg:w-72 border-r border-base-300 flex flex-col transition-all duration-200">
      <div className="border-b border-base-300 w-full p-5">
        <div className="flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <Users className="size-6" />
            <span className="font-medium hidden lg:block">Contacts</span>
          </div>

          <button
            onClick={() => setIsGroupModalOpen(true)}
            className="btn btn-ghost btn-sm hidden lg:inline-flex items-center gap-2"
            aria-label="Create group"
          >
            <PlusSquare className="size-5" />
            <span className="hidden lg:block text-sm">New Group</span>
          </button>
        </div>
        {/* TODO: Online filter toggle */}
        <div className="mt-3 hidden lg:flex items-center gap-2">
          <label className="cursor-pointer flex items-center gap-2">
            <input
              type="checkbox"
              checked={showOnlineOnly}
              onChange={(e) => setShowOnlineOnly(e.target.checked)}
              className="checkbox checkbox-sm"
            />
            <span className="text-sm">Show online only</span>
          </label>
          <span className="text-xs text-zinc-500">({onlineUsers.length - 1} online)</span>
        </div>
  </div>

      <div className="overflow-y-auto w-full py-3">
        {/* Groups list */}
        {groups && groups.length > 0 && (
          <div className="px-2">
            <div className="text-xs uppercase text-zinc-400 px-2 mb-2">Groups</div>
            {groups.map((group) => (
              <button
                key={group._id}
                onClick={() => setSelectedUser({ ...group, isGroup: true })}
                className={`w-full p-3 flex items-center gap-3 hover:bg-base-300 transition-colors ${selectedUser?._id === group._id && selectedUser?.isGroup ? "bg-base-300 ring-1 ring-base-300" : ""}`}
              >
                <div className="relative mx-auto lg:mx-0">
                  <img src={group.avatar || "/avatar.png"} alt={group.name} className="size-12 object-cover rounded-full" />
                </div>

                <div className="hidden lg:block text-left min-w-0">
                  <div className="font-medium truncate">{group.name}</div>
                  <div className="text-sm text-zinc-400">{group.members?.length || 0} members</div>
                </div>
              </button>
            ))}
            <div className="divider my-2" />
          </div>
        )}

        {filteredUsers.map((user) => (
          <button
            key={user._id}
            onClick={() => setSelectedUser(user)}
            className={`
              w-full p-3 flex items-center gap-3
              hover:bg-base-300 transition-colors
              ${selectedUser?._id === user._id ? "bg-base-300 ring-1 ring-base-300" : ""}
            `}
          >
            <div className="relative mx-auto lg:mx-0">
              <img
                src={user.profilePic || "/avatar.png"}
                alt={user.name}
                className="size-12 object-cover rounded-full"
              />
              {onlineUsers.includes(user._id) && (
                <span
                  className="absolute bottom-0 right-0 size-3 bg-green-500 
                  rounded-full ring-2 ring-zinc-900"
                />
              )}
            </div>

            {/* User info - only visible on larger screens */}
            <div className="hidden lg:block text-left min-w-0">
              <div className="font-medium truncate">{user.fullName}</div>
              <div className="text-sm text-zinc-400">
                {onlineUsers.includes(user._id) ? "Online" : "Offline"}
              </div>
            </div>
          </button>
        ))}

        {filteredUsers.length === 0 && (
          <div className="text-center text-zinc-500 py-4">No online users</div>
        )}
      </div>
    </aside>
    {/* Group creation modal */}
    <GroupModal open={isGroupModalOpen} onClose={() => setIsGroupModalOpen(false)} />
    </>
  );
};
export default Sidebar;