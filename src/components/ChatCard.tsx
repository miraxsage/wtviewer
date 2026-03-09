"use client";

import { useRouter } from "next/navigation";
import { Chat } from "@/lib/types";

interface ChatCardProps {
  chat: Chat;
  onDelete: (id: string) => void;
  onSettings: (chat: Chat) => void;
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

function MessageIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ChatCard({ chat, onDelete, onSettings }: ChatCardProps) {
  const router = useRouter();

  const isWhatsApp = chat.source_type === "whatsapp";

  function handleCardClick() {
    router.push(`/chat/${chat.id}`);
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    const confirmed = window.confirm(
      `Are you sure you want to delete "${chat.name}"? This action cannot be undone.`
    );
    if (confirmed) {
      onDelete(chat.id);
    }
  }

  return (
    <div
      onClick={handleCardClick}
      className="relative group cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 transition-all duration-200 hover:bg-[var(--bg-card-hover)] hover:border-[var(--accent)] hover:shadow-lg hover:shadow-black/20"
    >
      {/* Header: name + source badge */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] leading-tight line-clamp-2">
          {chat.name}
        </h3>
        <span
          className={`inline-flex items-center gap-1.5 shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            isWhatsApp
              ? "bg-[var(--whatsapp)]/15 text-[var(--whatsapp)]"
              : "bg-[var(--telegram)]/15 text-[var(--telegram)]"
          }`}
        >
          {isWhatsApp ? <WhatsAppIcon /> : <TelegramIcon />}
          {isWhatsApp ? "WhatsApp" : "Telegram"}
        </span>
      </div>

      {/* Description */}
      {chat.description && (
        <p className="text-sm text-[var(--text-secondary)] mb-4 line-clamp-2 leading-relaxed">
          {chat.description}
        </p>
      )}

      {/* Participants */}
      {chat.participants && chat.participants.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {chat.participants.slice(0, 4).map((p) => (
            <span
              key={p}
              className="inline-block rounded-md bg-[var(--bg-secondary)] px-2 py-0.5 text-xs text-[var(--text-secondary)]"
            >
              {p}
            </span>
          ))}
          {chat.participants.length > 4 && (
            <span className="inline-block rounded-md bg-[var(--bg-secondary)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">
              +{chat.participants.length - 4} more
            </span>
          )}
        </div>
      )}

      {/* Footer: message count + date */}
      <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <MessageIcon />
            {chat.message_count.toLocaleString()} messages
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <CalendarIcon />
            {formatDate(chat.created_at)}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Settings button */}
          <button
            onClick={(e) => { e.stopPropagation(); onSettings(chat); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-accent)] hover:bg-[var(--accent)]/10"
            title="Chat settings"
          >
            <GearIcon />
          </button>
          {/* Delete button */}
          <button
            onClick={handleDelete}
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10"
            title="Delete chat"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
