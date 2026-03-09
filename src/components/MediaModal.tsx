"use client";

import { useEffect, useCallback, useRef } from "react";
import { useChatViewStore } from "@/lib/store";
import { mediaUrl } from "@/lib/api";

interface MediaModalProps {
  chatId: string;
}

function CloseIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function formatDate(datetime: string): string {
  const d = new Date(datetime);
  return d.toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MediaModal({ chatId }: MediaModalProps) {
  const {
    mediaModalOpen,
    mediaModalIndex,
    mediaMessages,
    closeMediaModal,
    nextMedia,
    prevMedia,
  } = useChatViewStore();

  const backdropRef = useRef<HTMLDivElement>(null);

  /* ---- Keyboard navigation ---- */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!mediaModalOpen) return;
      switch (e.key) {
        case "Escape":
          closeMediaModal();
          break;
        case "ArrowLeft":
          prevMedia();
          break;
        case "ArrowRight":
          nextMedia();
          break;
      }
    },
    [mediaModalOpen, closeMediaModal, nextMedia, prevMedia]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  /* ---- Lock body scroll when open ---- */
  useEffect(() => {
    if (mediaModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mediaModalOpen]);

  if (!mediaModalOpen || mediaMessages.length === 0) return null;

  const current = mediaMessages[mediaModalIndex];
  if (!current || !current.media_path) return null;

  const src = mediaUrl(chatId, current.media_path);
  const isVideo = current.media_type === "video";
  const hasPrev = mediaModalIndex > 0;
  const hasNext = mediaModalIndex < mediaMessages.length - 1;

  /** Close when clicking backdrop (not the media itself). */
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) {
      closeMediaModal();
    }
  };

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0, 0, 0, 0.95)" }}
    >
      {/* Top bar: counter + close */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 py-4 z-10">
        <span
          className="text-sm font-medium select-none"
          style={{ color: "rgba(255,255,255,0.7)" }}
        >
          {mediaModalIndex + 1} / {mediaMessages.length}
        </span>
        <button
          onClick={closeMediaModal}
          className="p-1.5 rounded-full transition-colors hover:bg-white/10"
          style={{ color: "rgba(255,255,255,0.7)" }}
          aria-label="Close"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Left arrow */}
      {hasPrev && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            prevMedia();
          }}
          className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors hover:bg-white/10 z-10"
          style={{ color: "rgba(255,255,255,0.6)" }}
          aria-label="Previous"
        >
          <ChevronLeftIcon />
        </button>
      )}

      {/* Right arrow */}
      {hasNext && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            nextMedia();
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors hover:bg-white/10 z-10"
          style={{ color: "rgba(255,255,255,0.6)" }}
          aria-label="Next"
        >
          <ChevronRightIcon />
        </button>
      )}

      {/* Media content */}
      <div className="flex items-center justify-center max-w-[90vw] max-h-[80vh]">
        {isVideo ? (
          <video
            key={src}
            src={src}
            controls
            autoPlay
            className="max-w-[90vw] max-h-[80vh] rounded-lg"
            style={{ objectFit: "contain" }}
          />
        ) : (
          <img
            key={src}
            src={src}
            alt=""
            className="max-w-[90vw] max-h-[80vh] rounded-lg select-none"
            style={{ objectFit: "contain" }}
            draggable={false}
          />
        )}
      </div>

      {/* Bottom info bar */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center px-5 py-4 z-10">
        <div className="text-center">
          <div
            className="text-sm font-medium"
            style={{ color: "rgba(255,255,255,0.8)" }}
          >
            {current.sender}
          </div>
          <div
            className="text-xs mt-0.5"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            {formatDate(current.datetime)}
          </div>
        </div>
      </div>
    </div>
  );
}
