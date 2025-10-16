import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef } from "react";

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
  } = useChatStore();
  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);

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
        {messages.map((message) => {
          const isMe = message.senderId === authUser._id;
          const senderName = message.senderName || (isMe ? authUser.fullName : selectedUser.fullName);
          const senderPic = message.senderProfilePic || (isMe ? authUser.profilePic : selectedUser.profilePic || "/avatar.png");

          return (
            <div
              key={message._id}
              className={`chat ${isMe ? "chat-end" : "chat-start"}`}
              ref={messageEndRef}
            >
              <div className=" chat-image avatar">
                <div className="size-10 rounded-full border">
                  <img src={senderPic} alt="profile pic" />
                </div>
              </div>
              <div className="chat-header mb-1">
                {!isMe && <div className="text-sm font-medium">{senderName}</div>}
                <div className="flex items-center gap-2">
                  <time className="text-xs opacity-50 ml-1">{formatMessageTime(message.createdAt)}</time>
                  {isMe && message.deliveredTo && (
                    <span className="text-xs opacity-60">Delivered: {message.deliveredTo.length}</span>
                  )}
                  {isMe && message.readBy && (
                    <span className="text-xs opacity-60">Read: {message.readBy.length}</span>
                  )}
                </div>
              </div>
              <div className="chat-bubble flex flex-col">
                {message.image && (
                  <img src={message.image} alt="Attachment" className="sm:max-w-[200px] rounded-md mb-2" />
                )}
                {message.text && <p>{message.text}</p>}
              </div>
            </div>
          );
        })}
      </div>

      <MessageInput />
    </div>
  );
};
export default ChatContainer;