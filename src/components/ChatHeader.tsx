"use client";

import Link from "next/link";
import { Chat } from "@/lib/types";
import { useChatViewStore } from "@/lib/store";

interface ChatHeaderProps {
  chat: Chat | null;
}

function ArrowLeftIcon() {
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
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function UsersIcon() {
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
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export default function ChatHeader({ chat }: ChatHeaderProps) {
  const openGallery = useChatViewStore((s) => s.openGallery);
  const resolveDisplayName = useChatViewStore((s) => s.resolveDisplayName);

  if (!chat) {
    return (
      <header
        className="sticky top-0 z-40 border-b flex items-center gap-3 px-4 py-3"
        style={{
          background: "var(--bg-secondary)",
          borderColor: "var(--border)",
        }}
      >
        <div className="h-5 w-32 rounded animate-pulse" style={{ background: "var(--bg-tertiary)" }} />
      </header>
    );
  }

  const isWhatsApp = chat.source_type === "whatsapp";

  return (
    <header
      className="sticky top-0 z-40 border-b flex items-center gap-3 px-4 py-3"
      style={{
        background: "var(--bg-secondary)",
        borderColor: "var(--border)",
      }}
    >
      {/* Back button */}
      <Link
        href="/"
        className="shrink-0 p-1.5 rounded-lg transition-colors"
        style={{ color: "var(--text-accent)" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--bg-tertiary)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        <ArrowLeftIcon />
      </Link>

      {/* Chat info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <button
            onClick={openGallery}
            className="text-base font-semibold truncate text-left cursor-pointer transition-opacity hover:opacity-80"
            style={{ color: "var(--text-primary)", background: "none", border: "none", padding: 0 }}
          >
            {chat.name}
          </button>
          <span
            className="inline-flex items-center gap-1 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              background: isWhatsApp
                ? "rgba(37, 211, 102, 0.15)"
                : "rgba(42, 171, 238, 0.15)",
              color: isWhatsApp ? "var(--whatsapp)" : "var(--telegram)",
            }}
          >
            {isWhatsApp ? <WhatsAppIcon /> : <TelegramIcon />}
            {isWhatsApp ? "WhatsApp" : "Telegram"}
          </span>
        </div>
        <div
          className="flex items-center gap-1.5 mt-0.5 text-xs"
          style={{ color: "var(--text-secondary)" }}
        >
          <UsersIcon />
          <span className="truncate">
            {(() => {
              const names = chat.participants.map(resolveDisplayName);
              return names.length <= 3
                ? names.join(", ")
                : `${names.slice(0, 3).join(", ")} +${names.length - 3}`;
            })()}
          </span>
          <span className="mx-1 opacity-50">|</span>
          <span className="shrink-0">
            {chat.message_count.toLocaleString()} messages
          </span>
        </div>
      </div>
    </header>
  );
}
