"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { useParams, useSearchParams } from "next/navigation";
import { fetchChat, fetchMessages } from "@/lib/api";
import { Chat, Message } from "@/lib/types";
import { useChatViewStore } from "@/lib/store";
import { getCurrent, registerPlaying } from "@/lib/mediaPlayback";
import ChatHeader from "@/components/ChatHeader";
import FilterBar from "@/components/FilterBar";
import MessageBubble from "@/components/MessageBubble";
import MediaModal from "@/components/MediaModal";
import MediaGalleryModal from "@/components/MediaGalleryModal";

const BATCH_SIZE = 200;
const FIRST_INDEX = 1_000_000;

/* ------------------------------------------------------------------ */
/*  Date separator pill                                                */
/* ------------------------------------------------------------------ */

function formatDateLabel(date: string): string {
  return new Date(date).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex justify-center my-3 date-separator" data-date={date}>
      <span
        className="px-4 py-1 rounded-full text-sm"
        style={{
          background: "rgba(0,0,0,0.35)",
          color: "var(--text-secondary)",
        }}
      >
        {formatDateLabel(date)}
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
  | { type: "message"; message: Message; showSender: boolean; tightSpacing: boolean };

function buildRows(messages: Message[]): RowItem[] {
  const rows: RowItem[] = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const prev = messages[i - 1];

    const dayChanged = !prev || isDifferentDay(prev.datetime, msg.datetime);

    // Insert date separator when date changes
    if (dayChanged) {
      rows.push({ type: "date", date: msg.datetime });
    }

    // Show sender label if first message or sender changed or date changed
    const showSender =
      !prev || prev.sender !== msg.sender || dayChanged;

    // Tight spacing if same sender and no date separator in between
    const tightSpacing = !!prev && prev.sender === msg.sender && !dayChanged;

    rows.push({ type: "message", message: msg, showSender, tightSpacing });
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/*  Scroll-to-bottom button                                            */
/* ------------------------------------------------------------------ */

function ScrollButton({ direction, onClick }: { direction: "up" | "down"; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-opacity duration-200 opacity-25 hover:opacity-100"
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        color: "var(--text-secondary)",
      }}
      title={direction === "up" ? "Scroll to top" : "Scroll to bottom"}
    >
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
        {direction === "up" ? (
          <>
            <polyline points="17 14 12 9 7 14" />
            <line x1="12" y1="5" x2="12" y2="5" strokeWidth="3" strokeLinecap="round" />
          </>
        ) : (
          <>
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="19" x2="12" y2="19" strokeWidth="3" strokeLinecap="round" />
          </>
        )}
      </svg>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function ChatViewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const chatId = params.id as string;

  const { senderFilter, searchQuery, favoritesOnly, openMediaModal, scrollToOrderIndex, clearScrollTarget, navigateToMessage, setParticipantMap } =
    useChatViewStore();

  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadedRange, setLoadedRange] = useState({ start: 0, end: 0 });
  const [atBottom, setAtBottom] = useState(true);
  const [atTop, setAtTop] = useState(false);
  const [firstItemIndex, setFirstItemIndex] = useState(FIRST_INDEX);

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const loadingMore = useRef(false);
  const initialLoadDone = useRef(false);
  const messagesRef = useRef<Message[]>([]);
  messagesRef.current = messages;
  const [virtuosoKey, setVirtuosoKey] = useState(0);
  const pendingInitialIndex = useRef<number | undefined>(undefined);
  const loadGeneration = useRef(0);
  const [stickyDate, setStickyDate] = useState<string | null>(null);
  const [stickyOffset, setStickyOffset] = useState(0);
  const [activeOrderIndex, setActiveOrderIndex] = useState<number | null>(null);

  /* ---- load chat info ---- */
  useEffect(() => {
    fetchChat(chatId)
      .then((c) => {
        setChat(c);
        setParticipantMap(c.participant_details || {});
      })
      .catch(() => console.error("Failed to fetch chat"));
  }, [chatId, setParticipantMap]);

  /* ---- handle scrollTo query param from external navigation ---- */
  useEffect(() => {
    const scrollTo = searchParams.get("scrollTo");
    if (scrollTo) {
      navigateToMessage(Number(scrollTo));
    }
  }, [searchParams, navigateToMessage]);

  /* ---- determine "own" sender ---- */
  const ownSender =
    chat && chat.participants.length >= 2
      ? chat.participants[1]
      : null;

  /* ---- initial message load (most recent) ---- */
  const loadInitial = useCallback(async () => {
    const gen = ++loadGeneration.current;
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

      if (gen !== loadGeneration.current) return;

      const t = probe.total;
      setTotal(t);

      if (t === 0) {
        setMessages([]);
        setFirstItemIndex(FIRST_INDEX);
        setLoadedRange({ start: 0, end: 0 });
        setLoading(false);
        return;
      }

      const anchorOI = activeRef.current;

      const data = anchorOI != null
        ? await fetchMessages(chatId, {
            limit: BATCH_SIZE,
            sender: senderFilter || undefined,
            search: searchQuery || undefined,
            favorites: favoritesOnly || undefined,
            aroundOrderIndex: anchorOI,
          })
        : await fetchMessages(chatId, {
            offset: hasFilters ? 0 : Math.max(0, t - BATCH_SIZE),
            limit: BATCH_SIZE,
            sender: senderFilter || undefined,
            search: searchQuery || undefined,
            favorites: favoritesOnly || undefined,
          });

      if (gen !== loadGeneration.current) return;

      setMessages(data.messages);
      setFirstItemIndex(FIRST_INDEX);
      setLoadedRange({
        start: data.offset,
        end: data.offset + data.messages.length,
      });

      // Scroll to active message (or nearest) after filter change
      if (anchorOI != null && data.messages.length > 0) {
        const newRows = buildRows(data.messages);
        let targetOI = anchorOI;

        if (!data.messages.some((m) => m.order_index === targetOI)) {
          // Active message filtered out — find nearest
          let nearest = data.messages[0];
          let minDist = Math.abs(nearest.order_index - targetOI);
          for (const m of data.messages) {
            const d = Math.abs(m.order_index - targetOI);
            if (d < minDist) { nearest = m; minDist = d; }
          }
          targetOI = nearest.order_index;
          setActiveOrderIndex(targetOI);
        }

        const rowIdx = newRows.findIndex(
          (r) => r.type === "message" && r.message.order_index === targetOI
        );
        if (rowIdx >= 0) {
          pendingInitialIndex.current = rowIdx;
          setVirtuosoKey((k) => k + 1);
        }
      }
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
        const currentMessages = messagesRef.current;
        const oldRowCount = buildRows(currentMessages).length;
        const combined = [...data.messages, ...currentMessages];
        const newRowCount = buildRows(combined).length;
        const addedRows = newRowCount - oldRowCount;

        setFirstItemIndex((prev) => prev - addedRows);
        setMessages(combined);
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
  const rowsRef = useRef<RowItem[]>([]);
  rowsRef.current = rows;
  const firstItemIndexRef = useRef(FIRST_INDEX);
  firstItemIndexRef.current = firstItemIndex;
  const scrollerElRef = useRef<HTMLElement | null>(null);
  const overlayContainerRef = useRef<HTMLDivElement | null>(null);

  /* ---- scroll to target message after navigateToMessage ---- */
  useEffect(() => {
    if (scrollToOrderIndex === null) return;
    const target = scrollToOrderIndex;

    // Always fetch from server to get correct unfiltered context
    const gen = ++loadGeneration.current;
    fetchMessages(chatId, { aroundOrderIndex: target, limit: BATCH_SIZE }).then((data) => {
      if (gen !== loadGeneration.current) return;

      setMessages(data.messages);
      setFirstItemIndex(FIRST_INDEX);
      setTotal(data.total);
      setLoadedRange({ start: data.offset, end: data.offset + data.messages.length });

      const newRows = buildRows(data.messages);
      const idx = newRows.findIndex(
        (r) => r.type === "message" && r.message.order_index === target
      );
      pendingInitialIndex.current = Math.max(0, idx);
      setVirtuosoKey((k) => k + 1);
      setActiveOrderIndex(target);
      setLoading(false);
      clearScrollTarget();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToOrderIndex]);

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

  /* ---- keyboard navigation ---- */
  const activeRef = useRef<number | null>(null);
  activeRef.current = activeOrderIndex;

  const scrollToRow = useCallback(
    (orderIndex: number) => {
      // Try DOM-based scroll first (works reliably for items in overscan)
      const el = document.querySelector(`[data-order-index="${orderIndex}"]`);
      if (el) {
        el.scrollIntoView({ block: "nearest", behavior: "auto" });
        return;
      }
      // Fallback to Virtuoso's scrollToIndex for items not yet rendered
      const idx = rowsRef.current.findIndex(
        (r) => r.type === "message" && r.message.order_index === orderIndex
      );
      if (idx >= 0) {
        virtuosoRef.current?.scrollToIndex({
          index: firstItemIndexRef.current + idx,
          align: "center",
          behavior: "auto",
        });
      }
    },
    []
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const { mediaModalOpen, galleryOpen } = useChatViewStore.getState();
      if (galleryOpen) return;

      // Use event.code for layout-independent keys (works with any keyboard layout)
      const code = e.code;
      const shift = e.shiftKey;

      // W/S — navigate messages (only when no modal)
      if (!mediaModalOpen && (code === "KeyW" || code === "KeyS")) {
        e.preventDefault();
        const msgs = messagesRef.current;
        if (msgs.length === 0) return;

        const curIdx = activeRef.current != null
          ? msgs.findIndex((m) => m.order_index === activeRef.current)
          : -1;

        let nextIdx: number;
        if (code === "KeyS") {
          nextIdx = curIdx < 0 ? 0 : Math.min(curIdx + 1, msgs.length - 1);
        } else {
          nextIdx = curIdx < 0 ? msgs.length - 1 : Math.max(curIdx - 1, 0);
        }

        const target = msgs[nextIdx].order_index;
        setActiveOrderIndex(target);
        scrollToRow(target);
        return;
      }

      // Space when media modal is open — close and navigate to current media's message
      if (mediaModalOpen && code === "Space") {
        e.preventDefault();
        const { mediaMessages, mediaModalIndex, closeMediaModal: closeMM, navigateToMessage: navTo } = useChatViewStore.getState();
        const msg = mediaMessages[mediaModalIndex];
        if (msg) {
          closeMM();
          navTo(msg.order_index);
        }
        return;
      }

      // Space — play/pause audio or open media (only when no modal)
      if (!mediaModalOpen && code === "Space") {
        e.preventDefault();
        const active = activeRef.current;
        if (active == null) return;
        const msg = messagesRef.current.find((m) => m.order_index === active);
        if (!msg) return;

        if (msg.media_type === "voice" || msg.media_type === "audio") {
          // Find the audio element in the active message DOM
          const el = document.querySelector<HTMLAudioElement>(
            `[data-order-index="${active}"] audio`
          );
          if (el) {
            if (el.paused) {
              registerPlaying(el);
              el.play();
            } else {
              el.pause();
            }
          }
        } else if (
          msg.media_path &&
          (msg.media_type === "image" || msg.media_type === "video" || msg.media_type === "gif")
        ) {
          handleMediaClick(msg);
        }
        return;
      }

      // A/D — seek audio (works even during playback, no modal check needed, but not when modal open)
      if (!mediaModalOpen && (code === "KeyA" || code === "KeyD")) {
        const el = getCurrent();
        if (!el) return;
        if (code === "KeyA") {
          el.currentTime = shift ? 0 : Math.max(0, el.currentTime - 5);
        } else {
          el.currentTime = shift ? el.duration : Math.min(el.duration, el.currentTime + 5);
        }
        return;
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [scrollToRow, handleMediaClick]);

  /* ---- render a single row ---- */
  const renderRow = useCallback(
    (index: number) => {
      const row = rows[index - firstItemIndex];
      if (!row) return null;

      if (row.type === "date") {
        return <DateSeparator date={row.date} />;
      }

      const oi = row.message.order_index;
      return (
        <div data-order-index={oi}>
          <MessageBubble
            message={row.message}
            chatId={chatId}
            isOwnMessage={ownSender ? row.message.sender === ownSender : false}
            showSender={row.showSender}
            onMediaClick={() => handleMediaClick(row.message)}
            onBubbleClick={favoritesOnly || searchQuery ? () => navigateToMessage(row.message.order_index) : undefined}
            onActivate={() => setActiveOrderIndex(oi)}
            isActive={activeOrderIndex === oi}
            searchQuery={searchQuery}
            tightSpacing={row.tightSpacing}
          />
        </div>
      );
    },
    [rows, firstItemIndex, chatId, ownSender, handleMediaClick, favoritesOnly, navigateToMessage, searchQuery, activeOrderIndex]
  );

  /* ---- track sticky date ---- */
  // Two sources: rangeChanged gives reliable index-based date (works even when
  // separators are virtualized away), DOM scroll check detects when an inline
  // separator is visible at the top (so we can hide the overlay to avoid duplication).
  const stickyDateFromRange = useRef<string | null>(null);
  const updateStickyRef = useRef<(() => void) | null>(null);

  const handleRangeChanged = useCallback(
    (range: { startIndex: number; endIndex: number }) => {
      const currentRows = rowsRef.current;
      const arrayIndex = range.startIndex - firstItemIndexRef.current;
      if (arrayIndex < 0 || arrayIndex >= currentRows.length) return;

      // Scan backward to find the date separator that owns this section
      for (let i = arrayIndex; i >= 0; i--) {
        const row = currentRows[i];
        if (row.type === "date") {
          stickyDateFromRange.current = row.date;
          updateStickyRef.current?.();
          return;
        }
      }
      stickyDateFromRange.current = null;
      updateStickyRef.current?.();
    },
    []
  );

  useEffect(() => {
    const scroller = scrollerElRef.current;
    if (!scroller) return;

    const updateStickyFromDOM = () => {
      const scrollerRect = scroller.getBoundingClientRect();
      const separators = scroller.querySelectorAll(".date-separator");

      if (separators.length === 0) {
        // No separators in DOM (virtualized away) — use rangeChanged value
        setStickyDate(stickyDateFromRange.current);
        setStickyOffset(0);
        return;
      }

      const STICK_Y = 12;
      // Measure the actual overlay pill height
      const pillEl = scroller.closest(".relative")?.querySelector(".sticky-date-pill");
      const PILL_H = pillEl ? pillEl.getBoundingClientRect().height : 28;

      let lastPassedDate: string | null = null;
      let lastPassedElement: Element | null = null;
      let firstBelowTop: number | null = null;

      separators.forEach((sep) => {
        const rect = sep.getBoundingClientRect();
        const top = rect.top - scrollerRect.top;

        // "Passed" = separator top has reached the stick position
        if (top <= STICK_Y) {
          lastPassedDate = sep.getAttribute("data-date");
          lastPassedElement = sep;
        } else if (firstBelowTop === null) {
          firstBelowTop = top;
        }
      });

      // Determine the overlay date
      const newDate = lastPassedDate || stickyDateFromRange.current;

      // Calculate push offset: next separator pushing current overlay up
      let offset = 0;
      if (firstBelowTop !== null) {
        const pushThreshold = STICK_Y + PILL_H;
        if (firstBelowTop < pushThreshold) {
          offset = firstBelowTop - pushThreshold; // always negative
        }
      }

      // Hide only the LAST passed separator, and only when the overlay
      // is at its stick position (not being pushed). Earlier separators
      // scroll naturally off-screen.
      separators.forEach((sep) => {
        if (sep === lastPassedElement && offset >= 0) {
          const rect = sep.getBoundingClientRect();
          const top = rect.top - scrollerRect.top;
          const inOverlayZone = top > -PILL_H && top < STICK_Y + PILL_H + 10;
          (sep as HTMLElement).style.visibility = inOverlayZone ? "hidden" : "";
        } else {
          (sep as HTMLElement).style.visibility = "";
        }
      });

      // Align overlay with scroller content area (compensate for scrollbar)
      if (overlayContainerRef.current) {
        const sw = scroller.offsetWidth - scroller.clientWidth;
        overlayContainerRef.current.style.right = sw + "px";
      }

      setStickyDate(newDate);
      setStickyOffset(offset);
    };

    updateStickyRef.current = updateStickyFromDOM;
    scroller.addEventListener("scroll", updateStickyFromDOM, { passive: true });
    updateStickyFromDOM();
    return () => {
      scroller.removeEventListener("scroll", updateStickyFromDOM);
      updateStickyRef.current = null;
      // Reset separator visibilities on cleanup
      scroller.querySelectorAll(".date-separator").forEach((sep) => {
        (sep as HTMLElement).style.visibility = "";
      });
    };
  }, [virtuosoKey, messages]);

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
        className="flex-1 min-h-0 chat-bg relative"
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
            key={virtuosoKey}
            ref={virtuosoRef}
            firstItemIndex={firstItemIndex}
            totalCount={rows.length}
            itemContent={renderRow}
            initialTopMostItemIndex={pendingInitialIndex.current ?? (hasFilters ? 0 : rows.length - 1)}
            followOutput={false}
            startReached={loadOlder}
            endReached={loadNewer}
            scrollerRef={(ref) => { scrollerElRef.current = ref as HTMLElement; }}
            rangeChanged={handleRangeChanged}
            overscan={400}
            defaultItemHeight={50}
            style={{ height: "100%" }}
            components={{ Footer: () => <div style={{ height: 18 }} /> }}
            atTopThreshold={200}
            atBottomThreshold={200}
            increaseViewportBy={{ top: 600, bottom: 600 }}
            atBottomStateChange={setAtBottom}
            atTopStateChange={setAtTop}
          />
        )}

        {/* Sticky date header */}
        {stickyDate && messages.length > 0 && (
          <div
            ref={overlayContainerRef}
            className="absolute top-0 left-0 right-0 z-10 pointer-events-none overflow-hidden"
            style={{ height: "48px" }}
          >
            <div
              className="flex justify-center"
              style={{
                paddingTop: "12px",
                transform: `translateY(${stickyOffset}px)`,
              }}
            >
              <span
                className="sticky-date-pill px-4 py-1 rounded-full text-sm"
                style={{
                  background: "rgba(0,0,0,0.35)",
                  color: "var(--text-secondary)",
                }}
              >
                {formatDateLabel(stickyDate)}
              </span>
            </div>
          </div>
        )}

        {/* Scroll navigation buttons */}
        {messages.length > 0 && (!atTop || !atBottom) && (
          <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
            {!atTop && (
              <ScrollButton
                direction="up"
                onClick={async () => {
                  const data = await fetchMessages(chatId, {
                    offset: 0,
                    limit: BATCH_SIZE,
                    sender: senderFilter || undefined,
                    search: searchQuery || undefined,
                    favorites: favoritesOnly || undefined,
                  });
                  setMessages(data.messages);
                  setFirstItemIndex(FIRST_INDEX);
                  setLoadedRange({ start: 0, end: data.messages.length });
                  setTotal(data.total);
                  pendingInitialIndex.current = 0;
                  setVirtuosoKey((k) => k + 1);
                }}
              />
            )}
            {!atBottom && (
              <ScrollButton
                direction="down"
                onClick={async () => {
                  const startOffset = Math.max(0, total - BATCH_SIZE);
                  const data = await fetchMessages(chatId, {
                    offset: startOffset,
                    limit: BATCH_SIZE,
                    sender: senderFilter || undefined,
                    search: searchQuery || undefined,
                    favorites: favoritesOnly || undefined,
                  });
                  const newRows = buildRows(data.messages);
                  setMessages(data.messages);
                  setFirstItemIndex(FIRST_INDEX);
                  setLoadedRange({ start: startOffset, end: startOffset + data.messages.length });
                  setTotal(data.total);
                  pendingInitialIndex.current = newRows.length - 1;
                  setVirtuosoKey((k) => k + 1);
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* Media modals (overlay everything) */}
      <MediaModal chatId={chatId} />
      <MediaGalleryModal
        chatId={chatId}
        participants={chat?.participants}
        chatName={chat?.name}
        onChatNameChange={(name) => setChat((prev) => prev ? { ...prev, name } : prev)}
        onParticipantsChange={(p) => setChat((prev) => prev ? { ...prev, participants: p } : prev)}
      />
    </div>
  );
}
