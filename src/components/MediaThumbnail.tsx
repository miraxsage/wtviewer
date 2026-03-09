"use client";

import { Message } from "@/lib/types";
import { mediaUrl } from "@/lib/api";
import AudioPlayer from "./AudioPlayer";

interface MediaThumbnailProps {
  message: Message;
  chatId: string;
  onMediaClick: () => void;
}

function PlayOverlayIcon() {
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

function DownloadIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function getFileName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1];
}

export default function MediaThumbnail({
  message,
  chatId,
  onMediaClick,
}: MediaThumbnailProps) {
  if (!message.media_path && message.media_type === "text") return null;
  if (!message.media_path) return null;

  const url = mediaUrl(chatId, message.media_path);

  switch (message.media_type) {
    case "image":
      return (
        <button
          onClick={onMediaClick}
          className="block rounded-lg overflow-hidden mt-1 mb-1 cursor-pointer"
          type="button"
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
          className="relative block rounded-lg overflow-hidden mt-1 mb-1 cursor-pointer"
          type="button"
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
              <PlayOverlayIcon />
            </div>
          </div>
        </button>
      );

    case "voice":
      return <AudioPlayer src={url} />;

    case "audio":
      return (
        <div className="mt-1 mb-1">
          <div
            className="text-xs truncate max-w-[250px] mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            {getFileName(message.media_path)}
          </div>
          <AudioPlayer src={url} />
        </div>
      );

    case "sticker":
      return (
        <div className="mt-1 mb-1">
          <img
            src={url}
            alt=""
            className="w-[192px] h-[192px] object-contain"
            loading="lazy"
          />
        </div>
      );

    case "gif": {
      const isGifFile = message.media_path.toLowerCase().endsWith(".gif");
      return (
        <button
          onClick={onMediaClick}
          className="block rounded-lg overflow-hidden mt-1 mb-1 cursor-pointer"
          type="button"
        >
          {isGifFile ? (
            <img
              src={url}
              alt=""
              className="max-w-[300px] w-full rounded-lg"
              style={{ maxHeight: "300px", objectFit: "cover" }}
              loading="lazy"
            />
          ) : (
            <video
              src={url}
              className="max-w-[300px] w-full rounded-lg"
              style={{ maxHeight: "300px", objectFit: "cover" }}
              autoPlay
              loop
              muted
              playsInline
            />
          )}
        </button>
      );
    }

    case "document":
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 mt-1 mb-1 px-3 py-2 rounded-lg transition-colors hover:brightness-110"
          style={{
            background: "rgba(255,255,255,0.06)",
            color: "var(--text-accent)",
          }}
        >
          <DocumentIcon />
          <span className="text-sm truncate max-w-[180px]">
            {getFileName(message.media_path)}
          </span>
          <span className="ml-auto flex-shrink-0 opacity-60">
            <DownloadIcon />
          </span>
        </a>
      );

    default:
      return null;
  }
}
