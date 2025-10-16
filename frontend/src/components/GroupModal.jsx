import { useState } from "react";
import { Users } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";

const GroupModal = ({ open, onClose }) => {
  const { users } = useChatStore();
  const { createGroup, isCreating } = useGroupStore();

  const [name, setName] = useState("");
  const [selected, setSelected] = useState([]);
  const [avatarPreview, setAvatarPreview] = useState(null);

  if (!open) return null;

  const toggleUser = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const submit = async () => {
    if (!name.trim() || selected.length < 1) return;
    try {
      const payload = { name: name.trim(), members: selected };
      if (avatarPreview) payload.avatar = avatarPreview; // data URL
      await createGroup(payload);
  setName("");
  setSelected([]);
  setAvatarPreview(null);
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  const onAvatarChange = (e) => {
  const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-base-100 rounded-lg w-full max-w-md p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium flex items-center gap-2">
            <Users /> <span>Create Group</span>
          </h3>
          <button onClick={onClose} aria-label="Close" className="btn btn-ghost btn-sm">✕</button>
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Group name"
          className="input input-bordered w-full mb-3"
        />

        <div className="mb-3">
          <label className="block mb-2 text-sm">Group avatar (optional)</label>
          <div className="flex items-center gap-3 mb-2">
            <input type="file" accept="image/*" onChange={onAvatarChange} />
            {avatarPreview && (
              <img src={avatarPreview} alt="preview" className="size-12 object-cover rounded-full" />
            )}
          </div>
        </div>

        <div className="max-h-64 overflow-auto mb-3">
          {users.map((u) => (
            <label key={u._id} className="flex items-center gap-2 p-2 hover:bg-base-200 rounded">
              <input
                type="checkbox"
                checked={selected.includes(u._id)}
                onChange={() => toggleUser(u._id)}
                className="checkbox checkbox-sm"
              />
              <img src={u.profilePic || "/avatar.png"} alt={u.fullName} className="size-8 rounded-full" />
              <div className="truncate">{u.fullName}</div>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={isCreating}>
            {isCreating ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupModal;
