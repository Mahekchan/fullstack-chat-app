import React, { useState, useRef } from "react";
import { useGroupStore } from "../store/useGroupStore";
import { useAuthStore } from "../store/useAuthStore";
import { axiosInstance } from "../lib/axios";
import { useChatStore } from "../store/useChatStore";
import toast from "react-hot-toast";

const ProfilePreview = ({ member, onClose }) => {
  if (!member) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-base-100 rounded-lg w-full max-w-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium">{member.fullName}</h3>
          <button onClick={onClose} aria-label="Close" className="btn btn-ghost btn-sm">✕</button>
        </div>
        <div className="flex flex-col items-center gap-3">
          <img src={member.profilePic || "/avatar.png"} alt={member.fullName} className="size-24 rounded-full" />
          <div className="text-sm text-base-content/80">{member.email}</div>
        </div>
        <div className="flex justify-end mt-3">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

const GroupMembersModal = ({ open, onClose, group }) => {
  const groups = useGroupStore.getState().groups || [];
  const updateGroup = useGroupStore.getState().updateGroup || (() => {});
  const { authUser } = useAuthStore();
  const [previewMember, setPreviewMember] = useState(null);
  const [isRemoving, setIsRemoving] = useState(null);
  const [confirmRemoving, setConfirmRemoving] = useState(null); // memberId waiting confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [avatarFilePreview, setAvatarFilePreview] = useState(null);

  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const fileInputRef = useRef(null);
  if (!open) return null;

  // Prefer passed group.members; fallback to group store lookup
  const currentGroup = group || groups.find((g) => g._id === group?._id);
  const members = currentGroup?.members || [];

  // avatar to display: prefer freshly selected preview, fall back to group's avatar
  const displayedAvatar = avatarFilePreview || currentGroup?.avatar || "/avatar.png";

  // determine admin from admins array (if present) fallback to creator

  const handleViewProfile = (member) => {
    setPreviewMember(member);
  };

  const handleAvatarSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUpdatingAvatar(true);
      const dataUrl = await readFileAsDataUrl(file);
      setAvatarFilePreview(dataUrl);

      const res = await axiosInstance.put(`/groups/${currentGroup._id}`, { avatar: dataUrl });
      useGroupStore.getState().updateGroup(res.data);
      toast.success("Group avatar updated");
    } catch (err) {
      console.error("Avatar upload failed:", err);
      toast.error(err?.response?.data?.message || "Update failed");
    } finally {
      setIsUpdatingAvatar(false);
      // clear the input so same file can be picked again if needed
      if (fileInputRef.current) fileInputRef.current.value = null;
    }
  };

  const readFileAsDataUrl = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  };

  // avatar uploads are handled immediately on file selection by handleAvatarSelect

  const isAdminFromList = (currentGroup?.admins || []).some((a) => String(a) === String(authUser?._id));
  const canRemove = isAdminFromList || String(currentGroup?.createdBy) === String(authUser?._id);
  const canPromote = isAdminFromList || String(currentGroup?.createdBy) === String(authUser?._id);
  const isCreator = String(currentGroup?.createdBy) === String(authUser?._id);

  const handleRemove = async (memberId) => {
    try {
      setIsRemoving(memberId);
  const res = await axiosInstance.delete(`/groups/${currentGroup._id}/members/${memberId}`);
      updateGroup(res.data);
      toast.success("Member removed");
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Remove failed");
    } finally {
      setIsRemoving(null);
      setConfirmRemoving(null);
    }
  };

  const handleDeleteGroup = async () => {
    const prevGroups = useGroupStore.getState().groups;
    console.log("Attempting to delete group", currentGroup?._id);
    try {
      setIsDeleting(true);

      // Call server to delete
      const res = await axiosInstance.delete(`/groups/${currentGroup._id}`);
      console.log("Delete response:", res?.data);

      // On success, remove from client state and close modal
      // Use both setState and getState.removeGroup to be defensive
      useGroupStore.setState((state) => ({ groups: state.groups.filter((g) => g._id !== currentGroup._id) }));
      if (typeof useGroupStore.getState().removeGroup === "function") {
        try {
          useGroupStore.getState().removeGroup(currentGroup._id);
        } catch (remErr) {
          console.error("Error calling removeGroup on store:", remErr);
        }
      }

      const selected = useChatStore.getState().selectedUser;
      if (selected && selected._id === currentGroup._id) {
        useChatStore.getState().setSelectedUser(null);
      }
      onClose();

      toast.success(res.data?.message || "Group deleted");
    } catch (err) {
      console.error("Delete group failed:", err);
      // restore groups on failure
      if (prevGroups) {
        useGroupStore.setState({ groups: prevGroups });
      }
      toast.error(err?.response?.data?.message || "Delete failed");
    } finally {
      setIsDeleting(false);
      // hide modal after operation completes
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="bg-base-100 rounded-lg w-full max-w-lg p-4 md:max-w-2xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">Group Members</h3>
            <button onClick={onClose} aria-label="Close" className="btn btn-ghost btn-sm">✕</button>
          </div>

          <div className="mb-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <img
                src={displayedAvatar}
                alt={currentGroup?.name}
                className={`size-14 rounded-full ${canRemove ? 'cursor-pointer' : ''} ${isUpdatingAvatar ? 'opacity-60 pointer-events-none' : ''}`}
                onClick={() => { if (canRemove && !isUpdatingAvatar && fileInputRef.current) fileInputRef.current.click(); }}
              />
              <div>
                <div className="font-medium">{currentGroup?.name}</div>
                <div className="text-sm text-base-content/70">{members.length} members</div>
              </div>
            </div>

            {canRemove && (
              <div className="w-full sm:w-auto">
                {/* Hidden file input: clicking the avatar opens this picker */}
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarSelect} className="hidden" />
                {/* Preview shown in the main avatar above; no separate preview here */}
              </div>
            )}
          </div>

          <div className="max-h-64 overflow-auto">
            {members.length === 0 && <div className="text-sm text-base-content/70">No members found</div>}
            {members.map((m) => {
              const isMemberAdmin = (currentGroup?.admins || []).some((a) => String(a) === String(m._id));
              const isCurrentUser = String(authUser?._id) === String(m._id);
              return (
                <div key={m._id} className="flex items-center gap-3 p-2 hover:bg-base-200 rounded">
                  <img src={m.profilePic || "/avatar.png"} alt={m.fullName} className="size-10 rounded-full" />
                  <div className="flex-1">
                    <div className="font-medium flex items-center gap-2">
                      <span>{m.fullName}</span>
                      {isMemberAdmin && (
                        <span className="text-xs px-2 py-0.5 bg-yellow-200 text-yellow-800 rounded">Admin</span>
                      )}
                    </div>
                    <div className="text-sm text-base-content/70">{m.email || ""}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Hide 'View profile' for the admin's own row, but show it for other members (including other admins) */}
                    {!(isMemberAdmin && isCurrentUser) && (
                      <button className="btn btn-ghost btn-xs" onClick={() => handleViewProfile(m)}>View profile</button>
                    )}

                    {/* Promote / Demote buttons */}
                    {canPromote && !isMemberAdmin && (
                      <button className="btn btn-secondary btn-xs" onClick={async () => {
                        try {
                          const res = await axiosInstance.post(`/groups/${currentGroup._id}/promote/${m._id}`);
                          useGroupStore.getState().updateGroup(res.data);
                          toast.success("Member promoted to admin");
                        } catch (err) {
                          console.error(err);
                          toast.error(err?.response?.data?.message || "Promote failed");
                        }
                      }}>Make admin</button>
                    )}

                    {isMemberAdmin && isCreator && (
                      <button className="btn btn-warning btn-xs" onClick={async () => {
                        try {
                          const res = await axiosInstance.post(`/groups/${currentGroup._id}/demote/${m._id}`);
                          useGroupStore.getState().updateGroup(res.data);
                          toast.success("Admin demoted");
                        } catch (err) {
                          console.error(err);
                          toast.error(err?.response?.data?.message || "Demote failed");
                        }
                      }}>Demote</button>
                    )}

                    {canRemove && (
                      <button
                        className={`btn btn-error btn-xs ${isRemoving === m._id ? 'loading' : ''}`}
                        onClick={() => setConfirmRemoving(m._id)}
                        disabled={isRemoving && isRemoving !== m._id}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between mt-3">
            <div>
              {canRemove && (
                        <button className="btn btn-error btn-sm" onClick={() => setShowDeleteConfirm(true)}>Delete group</button>
                      )}
            </div>
            <div>
              <button className="btn btn-ghost" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      </div>

      {previewMember && (
        <ProfilePreview member={previewMember} onClose={() => setPreviewMember(null)} />
      )}
      {confirmRemoving && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40">
          <div className="bg-base-100 rounded-lg w-full max-w-sm p-4">
            <h3 className="font-medium mb-2">Remove member</h3>
            <p className="text-sm text-base-content/80 mb-4">Are you sure you want to remove this member from the group? This action can be undone by adding them again.</p>
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setConfirmRemoving(null)} disabled={isRemoving}>Cancel</button>
              <button className={`btn btn-error ${isRemoving ? 'loading' : ''}`} onClick={() => handleRemove(confirmRemoving)} disabled={isRemoving}>Remove</button>
            </div>
          </div>
        </div>
      )}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40">
          <div className="bg-base-100 rounded-lg w-full max-w-sm p-4">
            <h3 className="font-medium mb-2">Delete group</h3>
            <p className="text-sm text-base-content/80 mb-4">Are you sure you want to delete this group? This will remove it for all members.</p>
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>Cancel</button>
              <button className={`btn btn-error ${isDeleting ? 'loading' : ''}`} onClick={handleDeleteGroup} disabled={isDeleting}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GroupMembersModal;
