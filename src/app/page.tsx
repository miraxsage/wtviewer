"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { fetchChats, deleteChat } from "@/lib/api";
import { Chat } from "@/lib/types";
import { useChatViewStore } from "@/lib/store";
import { isElectron, getDataPath, selectDataPath } from "@/lib/electron";
import ChatCard from "@/components/ChatCard";
import ImportDialog from "@/components/ImportDialog";
import MediaGalleryModal from "@/components/MediaGalleryModal";

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function EmptyIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-secondary)] opacity-40">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [settingsChat, setSettingsChat] = useState<Chat | null>(null);
  const { openGallery, galleryOpen, setParticipantMap } = useChatViewStore();

  // Electron settings state
  const [isElectronApp, setIsElectronApp] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dataPath, setDataPath] = useState<string | null>(null);
  const [pathChanged, setPathChanged] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    isElectron().then((val) => {
      setIsElectronApp(val);
      if (val) {
        getDataPath().then(setDataPath);
      }
    });
  }, []);

  // Close settings popover on outside click
  useEffect(() => {
    if (!settingsOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [settingsOpen]);

  async function handleChangeDataPath() {
    const newPath = await selectDataPath();
    if (newPath) {
      setDataPath(newPath);
      setPathChanged(true);
    }
  }

  const loadChats = useCallback(async () => {
    try {
      const data = await fetchChats();
      setChats(data);
    } catch {
      console.error("Failed to fetch chats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  async function handleDelete(id: string) {
    try {
      await deleteChat(id);
      await loadChats();
    } catch {
      console.error("Failed to delete chat");
    }
  }

  // Clear settingsChat when gallery closes
  useEffect(() => {
    if (!galleryOpen) setSettingsChat(null);
  }, [galleryOpen]);

  function handleSettings(chat: Chat) {
    setSettingsChat(chat);
    setParticipantMap(chat.participant_details || {});
    openGallery();
  }

  function handleImportSuccess() {
    loadChats();
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg-secondary)]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
              WTViewer
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              WhatsApp & Telegram Chat Viewer
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isElectronApp && (
              <div className="relative" ref={settingsRef}>
                <button
                  onClick={() => setSettingsOpen((v) => !v)}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition-colors"
                  title="Settings"
                >
                  <GearIcon />
                </button>
                {settingsOpen && (
                  <div className="absolute right-0 top-12 w-72 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] shadow-xl shadow-black/30 p-4 z-50">
                    <p className="text-xs font-medium text-[var(--text-secondary)] mb-1">Data folder:</p>
                    <p className="text-sm text-[var(--text-primary)] truncate mb-3" title={dataPath || ""}>
                      {dataPath || "Loading..."}
                    </p>
                    <button
                      onClick={handleChangeDataPath}
                      className="text-sm font-medium text-[var(--accent)] hover:underline"
                    >
                      Change...
                    </button>
                    {pathChanged && (
                      <p className="text-xs text-[var(--text-secondary)] mt-2">
                        Restart the app to apply changes
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-colors shadow-lg shadow-black/20"
            >
              <PlusIcon />
              <span className="hidden sm:inline">Upload New Chat</span>
              <span className="sm:hidden">Upload</span>
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          /* Loading Skeleton */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 animate-pulse"
              >
                <div className="flex justify-between mb-3">
                  <div className="h-5 bg-[var(--bg-tertiary)] rounded w-2/3" />
                  <div className="h-6 bg-[var(--bg-tertiary)] rounded-full w-20" />
                </div>
                <div className="h-4 bg-[var(--bg-tertiary)] rounded w-full mb-2" />
                <div className="h-4 bg-[var(--bg-tertiary)] rounded w-3/4 mb-4" />
                <div className="pt-3 border-t border-[var(--border)] flex justify-between">
                  <div className="h-3 bg-[var(--bg-tertiary)] rounded w-24" />
                  <div className="h-3 bg-[var(--bg-tertiary)] rounded w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : chats.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <EmptyIcon />
            <h2 className="mt-6 text-xl font-semibold text-[var(--text-primary)]">
              No chats yet
            </h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)] max-w-md">
              Import your WhatsApp or Telegram chat archives to get started.
              Upload a .zip or .rar file to begin viewing your conversations.
            </p>
            <button
              onClick={() => setImportOpen(true)}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-colors"
            >
              <PlusIcon />
              Upload Your First Chat
            </button>
          </div>
        ) : (
          /* Chat Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {chats.map((chat) => (
              <ChatCard key={chat.id} chat={chat} onDelete={handleDelete} onSettings={handleSettings} />
            ))}
          </div>
        )}
      </main>

      {/* Import Dialog */}
      <ImportDialog
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={handleImportSuccess}
      />

      {/* Settings Gallery Modal */}
      {settingsChat && (
        <MediaGalleryModal
          chatId={settingsChat.id}
          participants={settingsChat.participants}
          chatName={settingsChat.name}
          onChatNameChange={(name) => {
            setSettingsChat((prev) => prev ? { ...prev, name } : prev);
            setChats((prev) => prev.map((c) => c.id === settingsChat.id ? { ...c, name } : c));
          }}
          onNavigateToMessage={(orderIndex) => {
            router.push(`/chat/${settingsChat.id}?scrollTo=${orderIndex}`);
          }}
        />
      )}
    </div>
  );
}
