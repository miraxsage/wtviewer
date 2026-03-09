"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchChats, deleteChat } from "@/lib/api";
import { Chat } from "@/lib/types";
import ChatCard from "@/components/ChatCard";
import ImportDialog from "@/components/ImportDialog";

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
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
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);

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
          <button
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-colors shadow-lg shadow-black/20"
          >
            <PlusIcon />
            <span className="hidden sm:inline">Upload New Chat</span>
            <span className="sm:hidden">Upload</span>
          </button>
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
              <ChatCard key={chat.id} chat={chat} onDelete={handleDelete} />
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
    </div>
  );
}
