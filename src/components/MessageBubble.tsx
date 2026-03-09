"use client";

import { useState, useCallback } from "react";
import { Message } from "@/lib/types";
import { toggleFavorite, mediaUrl } from "@/lib/api";

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

function PlayIcon() {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="white"
      stroke="none"
    >
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
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

function getFileName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1];
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

  const url = message.media_path ? mediaUrl(chatId, message.media_path) : null;

  const renderMedia = () => {
    if (!message.media_path && message.media_type === "text") return null;
    if (!url) return null;

    switch (message.media_type) {
      case "image":
        return (
          <button
            onClick={onMediaClick}
            className="block rounded-lg overflow-hidden mt-1 mb-1"
          >
            <img
              src={url}
              alt=""
              className="max-w-[300px] w-full rounded-lg"
              style={{ maxHeight: "400px", objectFit: "cover" }}
              loading="lazy"
            />
          </button>
        );

      case "video":
        return (
          <button
            onClick={onMediaClick}
            className="relative block rounded-lg overflow-hidden mt-1 mb-1"
          >
            <video
              src={url}
              className="max-w-[300px] w-full rounded-lg"
              style={{ maxHeight: "400px", objectFit: "cover" }}
              preload="metadata"
              muted
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: "rgba(0,0,0,0.5)" }}
              >
                <PlayIcon />
              </div>
            </div>
          </button>
        );

      case "sticker":
        return (
          <button onClick={onMediaClick} className="block mt-1 mb-1">
            <img
              src={url}
              alt=""
              className="w-[192px] h-[192px] object-contain"
              loading="lazy"
            />
          </button>
        );

      case "gif":
        return (
          <button
            onClick={onMediaClick}
            className="block rounded-lg overflow-hidden mt-1 mb-1"
          >
            <img
              src={url}
              alt=""
              className="max-w-[300px] w-full rounded-lg"
              style={{ maxHeight: "300px", objectFit: "cover" }}
              loading="lazy"
            />
          </button>
        );

      case "voice":
      case "audio":
        return (
          <div className="mt-1 mb-1">
            <audio controls preload="none" className="max-w-[260px] w-full h-10">
              <source src={url} />
            </audio>
          </div>
        );

      case "document":
        return (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 mt-1 mb-1 px-3 py-2 rounded-lg transition-colors"
            style={{
              background: "rgba(255,255,255,0.06)",
              color: "var(--text-accent)",
            }}
          >
            <DocumentIcon />
            <span className="text-sm truncate max-w-[200px]">
              {getFileName(message.media_path!)}
            </span>
          </a>
        );

      default:
        return null;
    }
  };

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
        {renderMedia()}

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
