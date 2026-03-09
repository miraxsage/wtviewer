"use client";

import { useState, useCallback } from "react";
import { Message } from "@/lib/types";
import { toggleFavorite } from "@/lib/api";
import MediaThumbnail from "./MediaThumbnail";

interface MessageBubbleProps {
  message: Message;
  chatId: string;
  isOwnMessage: boolean;
  showSender: boolean;
  onMediaClick: () => void;
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill={filled ? "#f5c542" : "none"}
      stroke={filled ? "#f5c542" : "currentColor"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function formatTime(datetime: string): string {
  const d = new Date(datetime);
  return d.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessageBubble({
  message,
  chatId,
  isOwnMessage,
  showSender,
  onMediaClick,
}: MessageBubbleProps) {
  const [isFav, setIsFav] = useState(message.is_favorite === 1);
  const [toggling, setToggling] = useState(false);

  const handleToggleFavorite = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (toggling) return;
      setToggling(true);
      try {
        const updated = await toggleFavorite(chatId, message.id, !isFav);
        setIsFav(updated.is_favorite === 1);
      } catch {
        // revert on failure
      } finally {
        setToggling(false);
      }
    },
    [chatId, message.id, isFav, toggling]
  );

  if (message.is_hidden === 1) {
    return (
      <div
        className={`flex ${isOwnMessage ? "justify-end" : "justify-start"} px-3 py-0.5`}
      >
        <div
          className="rounded-xl px-3 py-2 text-xs italic"
          style={{
            background: "rgba(255,255,255,0.04)",
            color: "var(--text-secondary)",
            maxWidth: "70%",
          }}
        >
          Message hidden
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex ${isOwnMessage ? "justify-end" : "justify-start"} px-3 py-0.5`}
    >
      <div
        className="relative rounded-xl px-3 pt-1.5 pb-1 shadow-sm"
        style={{
          background: isOwnMessage ? "#2b5278" : "var(--bg-secondary)",
          maxWidth: "70%",
          minWidth: "80px",
          borderTopRightRadius: isOwnMessage ? "4px" : undefined,
          borderTopLeftRadius: !isOwnMessage ? "4px" : undefined,
        }}
      >
        {/* Sender name */}
        {showSender && !isOwnMessage && (
          <div
            className="text-xs font-medium mb-0.5"
            style={{ color: "var(--text-accent)" }}
          >
            {message.sender}
          </div>
        )}

        {/* Media content */}
        <MediaThumbnail
          message={message}
          chatId={chatId}
          onMediaClick={onMediaClick}
        />

        {/* Text content */}
        {message.content && (
          <div
            className="text-sm whitespace-pre-wrap break-words"
            style={{ color: "var(--text-primary)" }}
          >
            {message.content}
          </div>
        )}

        {/* Footer: time + favorite star */}
        <div className="flex items-center justify-end gap-1.5 mt-0.5 -mb-0.5">
          <button
            onClick={handleToggleFavorite}
            className="opacity-40 hover:opacity-100 transition-opacity p-0.5"
            style={{ color: isFav ? "#f5c542" : "var(--text-secondary)" }}
            title={isFav ? "Remove from favorites" : "Add to favorites"}
          >
            <StarIcon filled={isFav} />
          </button>
          <span
            className="text-[11px] leading-none select-none"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            {formatTime(message.datetime)}
          </span>
        </div>
      </div>
    </div>
  );
}
