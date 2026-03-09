"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useChatViewStore } from "@/lib/store";
import { fetchMessages, mediaUrl, updateParticipantDetails, updateChatName } from "@/lib/api";
import { Message, ParticipantDetail } from "@/lib/types";

const TABS = [
  { key: "general", label: "General" },
  { key: "image", label: "Images" },
  { key: "gif", label: "GIFs" },
  { key: "video", label: "Videos" },
  { key: "voice", label: "Voice" },
  { key: "audio", label: "Audio" },
  { key: "document", label: "Documents" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const PAGE_SIZE = 50;

interface MediaGalleryModalProps {
  chatId: string;
  participants?: string[];
  chatName?: string;
  onChatNameChange?: (name: string) => void;
  onNavigateToMessage?: (orderIndex: number) => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(datetime: string): string {
  const d = new Date(datetime);
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(datetime: string): string {
  const d = new Date(datetime);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function getFileName(path: string): string {
  return path.split("/").pop() || path;
}

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
    </svg>
  );
}

function AudioIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab content renderers                                              */
/* ------------------------------------------------------------------ */

function GridItem({ message, chatId, onClick }: { message: Message; chatId: string; onClick: () => void }) {
  const resolveDisplayName = useChatViewStore((s) => s.resolveDisplayName);
  const src = mediaUrl(chatId, message.media_path!);
  const isVideo = message.media_type === "video";
  const isGif = message.media_type === "gif";

  return (
    <button
      onClick={onClick}
      className="relative aspect-square overflow-hidden rounded-lg cursor-pointer group"
      style={{ background: "var(--bg-tertiary)" }}
    >
      {isVideo ? (
        <>
          <video src={src} className="w-full h-full object-cover" preload="metadata" muted />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-black/50" style={{ color: "white" }}>
              <PlayIcon />
            </div>
          </div>
        </>
      ) : isGif && !message.media_path!.endsWith(".gif") ? (
        <video src={src} className="w-full h-full object-cover" autoPlay loop muted playsInline />
      ) : (
        <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
      )}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/60 via-transparent to-transparent">
        <div className="absolute bottom-1.5 left-2 right-2">
          <div className="text-[11px] truncate" style={{ color: "rgba(255,255,255,0.9)" }}>{resolveDisplayName(message.sender)}</div>
          <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.6)" }}>{formatDate(message.datetime)}</div>
        </div>
      </div>
    </button>
  );
}

function ListItem({ message, onClick, icon, showFilename }: { message: Message; onClick: () => void; icon: React.ReactNode; showFilename?: boolean }) {
  const resolveDisplayName = useChatViewStore((s) => s.resolveDisplayName);
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full px-4 py-3 text-left cursor-pointer transition-colors rounded-lg"
      style={{ color: "var(--text-primary)" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-tertiary)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: "var(--bg-tertiary)", color: "var(--text-accent)" }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        {showFilename && message.media_path && (
          <div className="text-sm truncate" style={{ color: "var(--text-primary)" }}>
            {getFileName(message.media_path)}
          </div>
        )}
        <div className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
          {resolveDisplayName(message.sender)}
        </div>
      </div>
      <div className="text-xs shrink-0" style={{ color: "var(--text-secondary)" }}>
        <div>{formatDate(message.datetime)}</div>
        <div className="text-right">{formatTime(message.datetime)}</div>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function MediaGalleryModal({ chatId, participants = [], chatName = "", onChatNameChange, onNavigateToMessage }: MediaGalleryModalProps) {
  const { galleryOpen, closeGallery, navigateToMessage, participantMap, setParticipantMap } = useChatViewStore();

  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const [items, setItems] = useState<Message[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadingMore = useRef(false);

  // General tab: local editing state
  const [editDetails, setEditDetails] = useState<Record<string, ParticipantDetail>>({});
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  // Sync editDetails from store when gallery opens
  useEffect(() => {
    if (galleryOpen) {
      setEditDetails({ ...participantMap });
      setEditName(chatName);
    }
  }, [galleryOpen, participantMap, chatName]);

  /* ---- Fetch items for current tab ---- */
  const loadItems = useCallback(
    async (tab: TabKey, offset: number, append: boolean) => {
      if (append) {
        if (loadingMore.current) return;
        loadingMore.current = true;
      } else {
        setLoading(true);
        setInitialLoad(true);
      }

      try {
        const data = await fetchMessages(chatId, {
          offset,
          limit: PAGE_SIZE,
          mediaType: tab,
        });
        setTotal(data.total);
        setItems((prev) => (append ? [...prev, ...data.messages] : data.messages));
      } catch {
        console.error("Failed to load gallery items");
      } finally {
        setLoading(false);
        setInitialLoad(false);
        loadingMore.current = false;
      }
    },
    [chatId]
  );

  /* ---- Reset on tab change or open ---- */
  useEffect(() => {
    if (!galleryOpen || activeTab === "general") return;
    setItems([]);
    setTotal(0);
    loadItems(activeTab, 0, false);
  }, [activeTab, galleryOpen, loadItems]);

  /* ---- Infinite scroll ---- */
  const handleScroll = useCallback(() => {
    if (activeTab === "general") return;
    const el = scrollRef.current;
    if (!el || loadingMore.current) return;
    if (items.length >= total) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight - scrollTop - clientHeight < 300) {
      loadItems(activeTab, items.length, true);
    }
  }, [activeTab, items.length, total, loadItems]);

  /* ---- Keyboard: Escape ---- */
  useEffect(() => {
    if (!galleryOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeGallery();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [galleryOpen, closeGallery]);

  /* ---- Body scroll lock ---- */
  useEffect(() => {
    if (galleryOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [galleryOpen]);

  if (!galleryOpen) return null;

  const handleItemClick = (msg: Message) => {
    closeGallery();
    if (onNavigateToMessage) {
      onNavigateToMessage(msg.order_index);
    } else {
      navigateToMessage(msg.order_index);
    }
  };

  const isGrid = activeTab === "image" || activeTab === "gif" || activeTab === "video";
  const isGeneral = activeTab === "general";

  const handleDetailChange = (participant: string, field: keyof ParticipantDetail, value: string | boolean) => {
    setEditDetails((prev) => ({
      ...prev,
      [participant]: { ...prev[participant], [field]: value },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Clean up empty entries
      const cleaned: Record<string, ParticipantDetail> = {};
      for (const [key, val] of Object.entries(editDetails)) {
        if (val.displayName || val.phone || val.showSender !== undefined) {
          cleaned[key] = val;
        }
      }
      await updateParticipantDetails(chatId, cleaned);
      setParticipantMap(cleaned);
      // Save chat name if changed
      if (editName.trim() && editName !== chatName) {
        await updateChatName(chatId, editName.trim());
        onChatNameChange?.(editName.trim());
      }
      closeGallery();
    } catch {
      console.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0, 0, 0, 0.7)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeGallery();
      }}
    >
      <div
        className="w-full max-w-2xl mx-4 flex flex-col rounded-2xl overflow-hidden"
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          maxHeight: "85vh",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Media Gallery
          </h2>
          <button
            onClick={closeGallery}
            className="p-1.5 rounded-full transition-colors cursor-pointer"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-tertiary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Tab bar */}
        <div
          className="flex overflow-x-auto shrink-0 px-2 pt-2 gap-1"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="px-3 py-2 text-sm font-medium whitespace-nowrap cursor-pointer transition-colors rounded-t-lg"
              style={{
                color: activeTab === tab.key ? "var(--text-accent)" : "var(--text-secondary)",
                background: activeTab === tab.key ? "var(--bg-tertiary)" : "transparent",
                borderBottom: activeTab === tab.key ? "2px solid var(--text-accent)" : "2px solid transparent",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 overflow-y-auto p-4"
        >
          {isGeneral ? (
            <div className="flex flex-col gap-4">
              {participants.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    No participants found
                  </span>
                </div>
              ) : (
                <>
                  {/* Chat name */}
                  <div
                    className="flex flex-col gap-2 rounded-xl p-4"
                    style={{ background: "var(--bg-tertiary)" }}
                  >
                    <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      Chat name
                    </div>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Chat name"
                      className="rounded-lg px-3 py-2 text-sm outline-none transition-colors"
                      style={{
                        background: "var(--bg-secondary)",
                        color: "var(--text-primary)",
                        border: "1px solid var(--border)",
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                    />
                  </div>

                  {participants.map((p, idx) => {
                    const isOwn = participants.length >= 2 && idx === 1;
                    const defaultShow = !isOwn;
                    const checked = editDetails[p]?.showSender ?? defaultShow;
                    return (
                      <div
                        key={p}
                        className="flex flex-col gap-2 rounded-xl p-4"
                        style={{ background: "var(--bg-tertiary)" }}
                      >
                        <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          {p}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editDetails[p]?.displayName || ""}
                            onChange={(e) => handleDetailChange(p, "displayName", e.target.value)}
                            placeholder="Display name"
                            className="flex-1 rounded-lg px-3 py-2 text-sm outline-none transition-colors"
                            style={{
                              background: "var(--bg-secondary)",
                              color: "var(--text-primary)",
                              border: "1px solid var(--border)",
                            }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                          />
                          <input
                            type="text"
                            value={editDetails[p]?.phone || ""}
                            onChange={(e) => handleDetailChange(p, "phone", e.target.value)}
                            placeholder="Phone number"
                            className="flex-1 rounded-lg px-3 py-2 text-sm outline-none transition-colors"
                            style={{
                              background: "var(--bg-secondary)",
                              color: "var(--text-primary)",
                              border: "1px solid var(--border)",
                            }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                          />
                        </div>
                        <label className="flex items-center gap-2 mt-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => handleDetailChange(p, "showSender", e.target.checked)}
                            className="w-3.5 h-3.5 accent-[var(--accent)] cursor-pointer"
                          />
                          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                            Show sender name
                          </span>
                        </label>
                      </div>
                    );
                  })}
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="self-end px-5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                    style={{
                      background: "var(--accent)",
                      color: "var(--text-primary)",
                      opacity: saving ? 0.6 : 1,
                    }}
                    onMouseEnter={(e) => { if (!saving) e.currentTarget.style.background = "var(--accent-hover)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "var(--accent)"; }}
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </>
              )}
            </div>
          ) : initialLoad && loading ? (
            <div className="flex items-center justify-center py-16">
              <div
                className="w-7 h-7 border-2 rounded-full animate-spin"
                style={{ borderColor: "var(--border)", borderTopColor: "var(--text-accent)" }}
              />
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                No items in this category
              </span>
            </div>
          ) : isGrid ? (
            <div className="grid grid-cols-3 gap-2">
              {items.map((msg) => (
                <GridItem key={msg.id} message={msg} chatId={chatId} onClick={() => handleItemClick(msg)} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {items.map((msg) => (
                <ListItem
                  key={msg.id}
                  message={msg}
                  onClick={() => handleItemClick(msg)}
                  icon={
                    activeTab === "voice" ? <MicIcon /> :
                    activeTab === "audio" ? <AudioIcon /> :
                    <DocIcon />
                  }
                  showFilename={activeTab === "audio" || activeTab === "document"}
                />
              ))}
            </div>
          )}

          {/* Loading more indicator */}
          {!isGeneral && !initialLoad && items.length < total && (
            <div className="flex justify-center py-4">
              <div
                className="w-5 h-5 border-2 rounded-full animate-spin"
                style={{ borderColor: "var(--border)", borderTopColor: "var(--text-accent)" }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
