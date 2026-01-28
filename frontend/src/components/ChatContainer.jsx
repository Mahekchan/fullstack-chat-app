import { useChatStore } from "../store/useChatStore";
// removed joke-feedback button; no axios/toast needed here
import { useEffect, useRef, useState } from "react";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    subscribeToMessages,
    unsubscribeFromMessages,
    deleteMessage,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [expandedMessageId, setExpandedMessageId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  useEffect(() => {
    getMessages(selectedUser._id);

    subscribeToMessages();

    return () => unsubscribeFromMessages();
  }, [selectedUser._id, getMessages, subscribeToMessages, unsubscribeFromMessages]);

  useEffect(() => {
    if (messageEndRef.current && messages) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <ChatHeader />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* End-to-End Encryption & Safety Info Banner - Theme-aware, non-dismissible */}
        <div className="bg-base-200 border border-base-300 rounded-lg px-4 py-3 flex items-start gap-3">
          <span className="text-2xl mt-0.5">🔒</span>
          <div className="flex-1">
            <p className="text-sm text-base-content/90 leading-relaxed">
              <span className="font-semibold">Messages are end-to-end encrypted.</span> Only people in this chat can read them. Bullying and harmful content is automatically detected and flagged for safety. 
              <button
                onClick={() => {
                  alert(
                    "🔒 Security & Safety Features:\n\n" +
                    "✓ End-to-End Encryption: Your messages are encrypted and can only be read by intended recipients\n" +
                    "✓ AI-Powered Bullying Detection: Detects abusive language across 11 Indian regional languages\n" +
                    "✓ Multi-Language Support: Bengali, English, Gujarati, Hindi, Hinglish, Kannada, Malayalam, Marathi, Punjabi, Tamil, Telugu\n" +
                    "✓ Automatic Moderation: Flagged messages are reviewed by moderators\n" +
                    "✓ Safe Community: Protects users from bullying, harassment, and harmful content"
                  );
                }}
                className="underline hover:no-underline cursor-pointer text-primary font-medium ml-1"
              >
                Learn more
              </button>
            </p>
          </div>
        </div>

        {messages.map((message) => {
          const isMe = message.senderId === authUser._id;
          const senderName = message.senderName || (isMe ? authUser.fullName : selectedUser.fullName);
          const senderPic = message.senderProfilePic || (isMe ? authUser.profilePic : selectedUser.profilePic || "/avatar.png");
          
          // Calculate receiver count (excluding sender)
          const deliveredCount = (message.deliveredTo || []).filter(id => id !== authUser._id).length;
          const readCount = (message.readBy || []).filter(id => id !== authUser._id).length;

          return (
            <div
              key={message._id}
              className={`chat ${isMe ? "chat-end" : "chat-start"}`}
              ref={messageEndRef}
              onMouseEnter={() => setHoveredMessageId(message._id)}
              onMouseLeave={() => setHoveredMessageId(null)}
            >
              <div className=" chat-image avatar">
                <div className="size-10 rounded-full border">
                  <img src={senderPic} alt="profile pic" />
                </div>
              </div>
              <div className="chat-header mb-1">
                {!isMe && selectedUser?.isGroup && <div className="text-sm font-medium">{senderName}</div>}
                <div className="flex items-center gap-2">
                  <time className="text-xs opacity-50 ml-1">{formatMessageTime(message.createdAt)}</time>
                  {/* Show dropdown only to sender on hover */}
                  {isMe && hoveredMessageId === message._id && (
                    <div className="relative">
                      <button
                        onClick={() => setExpandedMessageId(expandedMessageId === message._id ? null : message._id)}
                        className="text-xs opacity-60 hover:opacity-80 cursor-pointer"
                        title="Message options"
                      >
                        ▼
                      </button>
                      {expandedMessageId === message._id && (
                        <div className="absolute top-6 right-0 bg-white border border-gray-200 rounded shadow-lg z-10 whitespace-nowrap">
                          <div className="p-3 text-xs border-b border-gray-100">
                            {readCount > 0 ? (
                              <div className="opacity-80 font-semibold">✓✓ Seen {readCount}</div>
                            ) : deliveredCount > 0 ? (
                              <div className="opacity-80 font-semibold">✓ Delivered {deliveredCount}</div>
                            ) : (
                              <div className="opacity-60">Sending...</div>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setDeleteConfirmId(message._id);
                              setExpandedMessageId(null);
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="chat-bubble flex flex-col relative group">
                {message.isDeleted ? (
                  <p className="italic text-gray-400">This message was deleted</p>
                ) : (
                  <>
                    {message.image && (
                      <img src={message.image} alt="Attachment" className="sm:max-w-[200px] rounded-md mb-2" />
                    )}
                    {message.text && <p>{message.text}</p>}
                  </>
                )}
                {/* joke feedback removed per request */}
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-xs">
            <h3 className="text-lg font-semibold mb-2">Delete Message?</h3>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to delete this message? This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteMessage(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <MessageInput />
    </div>
  );
};
export default ChatContainer;