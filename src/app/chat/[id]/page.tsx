"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { useParams } from "next/navigation";
import { fetchChat, fetchMessages } from "@/lib/api";
import { Chat, Message } from "@/lib/types";
import { useChatViewStore } from "@/lib/store";
import ChatHeader from "@/components/ChatHeader";
import FilterBar from "@/components/FilterBar";
import MessageBubble from "@/components/MessageBubble";
import MediaModal from "@/components/MediaModal";

const BATCH_SIZE = 200;

/* ------------------------------------------------------------------ */
/*  Date separator pill                                                */
/* ------------------------------------------------------------------ */

function DateSeparator({ date }: { date: string }) {
  const formatted = new Date(date).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <div className="flex justify-center my-3">
      <span
        className="px-4 py-1 rounded-full text-sm"
        style={{
          background: "rgba(0,0,0,0.3)",
          color: "var(--text-secondary)",
        }}
      >
        {formatted}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Two date-times fall on different calendar days? */
function isDifferentDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() !== db.getFullYear() ||
    da.getMonth() !== db.getMonth() ||
    da.getDate() !== db.getDate()
  );
}

/** Build a flat list interleaving date separators with messages. */
type RowItem =
  | { type: "date"; date: string }
  | { type: "message"; message: Message; showSender: boolean };

function buildRows(messages: Message[]): RowItem[] {
  const rows: RowItem[] = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const prev = messages[i - 1];

    // Insert date separator when date changes
    if (!prev || isDifferentDay(prev.datetime, msg.datetime)) {
      rows.push({ type: "date", date: msg.datetime });
    }

    // Show sender label if first message or sender changed or date changed
    const showSender =
      !prev || prev.sender !== msg.sender || isDifferentDay(prev.datetime, msg.datetime);

    rows.push({ type: "message", message: msg, showSender });
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function ChatViewPage() {
  const params = useParams();
  const chatId = params.id as string;

  const { senderFilter, searchQuery, favoritesOnly, openMediaModal } =
    useChatViewStore();

  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadedRange, setLoadedRange] = useState({ start: 0, end: 0 });

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const loadingMore = useRef(false);
  const initialLoadDone = useRef(false);

  /* ---- load chat info ---- */
  useEffect(() => {
    fetchChat(chatId)
      .then(setChat)
      .catch(() => console.error("Failed to fetch chat"));
  }, [chatId]);

  /* ---- determine "own" sender ---- */
  const ownSender =
    chat && chat.participants.length >= 2
      ? chat.participants[1]
      : null;

  /* ---- initial message load (most recent) ---- */
  const loadInitial = useCallback(async () => {
    setLoading(true);
    initialLoadDone.current = false;

    try {
      const hasFilters = senderFilter || searchQuery || favoritesOnly;

      // First fetch to know total
      const probe = await fetchMessages(chatId, {
        offset: 0,
        limit: 1,
        sender: senderFilter || undefined,
        search: searchQuery || undefined,
        favorites: favoritesOnly || undefined,
      });

      const t = probe.total;
      setTotal(t);

      if (t === 0) {
        setMessages([]);
        setLoadedRange({ start: 0, end: 0 });
        setLoading(false);
        return;
      }

      // If filters are active, start from beginning; otherwise from end
      const startOffset = hasFilters
        ? 0
        : Math.max(0, t - BATCH_SIZE);

      const data = await fetchMessages(chatId, {
        offset: startOffset,
        limit: BATCH_SIZE,
        sender: senderFilter || undefined,
        search: searchQuery || undefined,
        favorites: favoritesOnly || undefined,
      });

      setMessages(data.messages);
      setLoadedRange({
        start: startOffset,
        end: startOffset + data.messages.length,
      });
    } catch {
      console.error("Failed to load messages");
    } finally {
      setLoading(false);
      // Mark that initial load is done so we can scroll to bottom
      setTimeout(() => {
        initialLoadDone.current = true;
      }, 100);
    }
  }, [chatId, senderFilter, searchQuery, favoritesOnly]);

  /* ---- reload when filters change ---- */
  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  /* ---- prepend older messages ---- */
  const loadOlder = useCallback(async () => {
    if (loadingMore.current || loadedRange.start <= 0) return;
    loadingMore.current = true;

    try {
      const newStart = Math.max(0, loadedRange.start - BATCH_SIZE);
      const fetchLimit = loadedRange.start - newStart;

      const data = await fetchMessages(chatId, {
        offset: newStart,
        limit: fetchLimit,
        sender: senderFilter || undefined,
        search: searchQuery || undefined,
        favorites: favoritesOnly || undefined,
      });

      if (data.messages.length > 0) {
        setMessages((prev) => [...data.messages, ...prev]);
        setLoadedRange((prev) => ({ ...prev, start: newStart }));
      }
    } catch {
      console.error("Failed to load older messages");
    } finally {
      loadingMore.current = false;
    }
  }, [chatId, loadedRange, senderFilter, searchQuery, favoritesOnly]);

  /* ---- append newer messages ---- */
  const loadNewer = useCallback(async () => {
    if (loadingMore.current || loadedRange.end >= total) return;
    loadingMore.current = true;

    try {
      const data = await fetchMessages(chatId, {
        offset: loadedRange.end,
        limit: BATCH_SIZE,
        sender: senderFilter || undefined,
        search: searchQuery || undefined,
        favorites: favoritesOnly || undefined,
      });

      if (data.messages.length > 0) {
        setMessages((prev) => [...prev, ...data.messages]);
        setLoadedRange((prev) => ({
          ...prev,
          end: prev.end + data.messages.length,
        }));
      }
    } catch {
      console.error("Failed to load newer messages");
    } finally {
      loadingMore.current = false;
    }
  }, [chatId, loadedRange, total, senderFilter, searchQuery, favoritesOnly]);

  /* ---- build rows with date separators ---- */
  const rows = buildRows(messages);

  /* ---- handle media click ---- */
  const handleMediaClick = useCallback(
    (message: Message) => {
      const mediaMessages = messages.filter(
        (m) =>
          m.media_path &&
          (m.media_type === "image" ||
            m.media_type === "video" ||
            m.media_type === "gif")
      );
      const index = mediaMessages.findIndex((m) => m.id === message.id);
      openMediaModal(mediaMessages, Math.max(0, index));
    },
    [messages, openMediaModal]
  );

  /* ---- render a single row ---- */
  const renderRow = useCallback(
    (index: number) => {
      const row = rows[index];
      if (!row) return null;

      if (row.type === "date") {
        return <DateSeparator date={row.date} />;
      }

      return (
        <MessageBubble
          message={row.message}
          chatId={chatId}
          isOwnMessage={ownSender ? row.message.sender === ownSender : false}
          showSender={row.showSender}
          onMediaClick={() => handleMediaClick(row.message)}
        />
      );
    },
    [rows, chatId, ownSender, handleMediaClick]
  );

  /* ---- loading state ---- */
  if (loading && messages.length === 0) {
    return (
      <div className="flex flex-col h-screen">
        <ChatHeader chat={chat} />
        <div
          className="flex-1 flex items-center justify-center"
          style={{ background: "var(--bg-primary)" }}
        >
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-8 h-8 border-2 rounded-full animate-spin"
              style={{
                borderColor: "var(--border)",
                borderTopColor: "var(--text-accent)",
              }}
            />
            <span
              className="text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              Loading messages...
            </span>
          </div>
        </div>
      </div>
    );
  }

  const hasFilters = !!(senderFilter || searchQuery || favoritesOnly);

  return (
    <div className="flex flex-col h-screen">
      <ChatHeader chat={chat} />
      {chat && <FilterBar participants={chat.participants} />}

      {/* Message area */}
      <div
        className="flex-1 min-h-0 chat-bg"
        style={{
          backgroundColor: "#0e1621",
          backgroundImage:
            "radial-gradient(circle at 20% 50%, rgba(43, 82, 120, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(43, 82, 120, 0.08) 0%, transparent 50%)",
        }}
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div
                className="text-4xl mb-3 opacity-30"
                style={{ color: "var(--text-secondary)" }}
              >
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mx-auto"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p
                className="text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                {hasFilters ? "No messages match your filters" : "No messages"}
              </p>
            </div>
          </div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            totalCount={rows.length}
            itemContent={renderRow}
            initialTopMostItemIndex={hasFilters ? 0 : rows.length - 1}
            followOutput={false}
            startReached={loadOlder}
            endReached={loadNewer}
            overscan={400}
            defaultItemHeight={50}
            style={{ height: "100%" }}
            atTopThreshold={200}
            atBottomThreshold={200}
            increaseViewportBy={{ top: 600, bottom: 600 }}
          />
        )}
      </div>

      {/* Media gallery modal (overlays everything) */}
      <MediaModal chatId={chatId} />
    </div>
  );
}
