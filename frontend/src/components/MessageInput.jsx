import { useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { Image, Send, X } from "lucide-react";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";

const MessageInput = () => {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);
  const { sendMessage } = useChatStore();
  const { selectedUser } = useChatStore();
  const [preSendModal, setPreSendModal] = useState({ open: false, data: null });

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() && !imagePreview) return;

    try {
      // Pre-check for bullying / abuse
      try {
        const checkBody = { text: text.trim() };
        if (selectedUser?.isGroup) checkBody.groupId = selectedUser._id;
        const chk = await axiosInstance.post("/messages/check", checkBody);
        if (chk?.data?.isBullying) {
          // open modal to allow user to edit or send
          setPreSendModal({ open: true, data: chk.data });
          return;
        }
      } catch (err) {
        // if check fails, allow sending but show small toast
        toast.error("Warning: pre-send check failed; message will be sent.");
      }

      await doSend();
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
    }
  };

  const doSend = async () => {
    await sendMessage({ text: text.trim(), image: imagePreview });
    setText("");
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleModalSend = async () => {
    setPreSendModal({ open: false, data: null });
    try {
      await doSend();
    } catch (err) {
      toast.error("Failed to send message");
    }
  };

  const handleModalEdit = () => {
    setPreSendModal({ open: false, data: null });
  };

  return (
    <div className="p-4 w-full">
      {imagePreview && (
        <div className="mb-3 flex items-center gap-2">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-20 h-20 object-cover rounded-lg border border-zinc-700"
            />
            <button
              onClick={removeImage}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300
              flex items-center justify-center"
              type="button"
            >
              <X className="size-3" />
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="flex items-center gap-2">
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            className="w-full input input-bordered rounded-lg input-sm sm:input-md"
            placeholder="Type a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImageChange}
          />

          <button
            type="button"
            className={`hidden sm:flex btn btn-circle
                     ${imagePreview ? "text-emerald-500" : "text-zinc-400"}`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Image size={20} />
          </button>
        </div>
        <button
          type="submit"
          className="btn btn-sm btn-circle"
          disabled={!text.trim() && !imagePreview}
        >
          <Send size={22} />
        </button>
      </form>
      {preSendModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-base-100 rounded-md p-4 w-11/12 max-w-md">
            <h3 className="font-semibold mb-2">Warning: Message flagged</h3>
            <p className="text-sm mb-2">Severity: {preSendModal.data.severity}</p>
            <p className="text-sm mb-4">Flagged words: {preSendModal.data.flaggedWords.map(f => f.word).join(", ")}</p>
            <div className="flex gap-2 justify-end">
              <button className="btn btn-sm" onClick={handleModalEdit}>Edit</button>
              <button className="btn btn-sm btn-ghost" onClick={() => { setPreSendModal({ open: false, data: null }); }}>Cancel</button>
              <button className="btn btn-sm btn-primary" onClick={handleModalSend}>Send Anyway</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default MessageInput;