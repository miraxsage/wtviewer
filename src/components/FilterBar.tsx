"use client";

import { useEffect, useRef, useState } from "react";
import { useChatViewStore } from "@/lib/store";

interface FilterBarProps {
  participants: string[];
}

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="16"
      height="16"
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

function XIcon() {
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
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function FilterBar({ participants }: FilterBarProps) {
  const { senderFilter, searchQuery, favoritesOnly, setSenderFilter, setSearchQuery, setFavoritesOnly, resolveDisplayName } =
    useChatViewStore();

  const [localSearch, setLocalSearch] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setSearchQuery(localSearch);
    }, 300);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [localSearch, setSearchQuery]);

  // Sync local state if store is reset externally
  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  return (
    <div
      className="border-b px-4 py-2 flex flex-wrap items-center gap-2"
      style={{
        background: "var(--bg-secondary)",
        borderColor: "var(--border)",
      }}
    >
      {/* Sender chips */}
      <div className="flex flex-wrap items-center gap-1.5 mr-2">
        {participants.map((p) => {
          const isActive = senderFilter === p;
          return (
            <button
              key={p}
              onClick={() => setSenderFilter(isActive ? null : p)}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
              style={{
                background: isActive ? "var(--accent)" : "var(--bg-tertiary)",
                color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                border: isActive ? "1px solid var(--accent-hover)" : "1px solid transparent",
              }}
            >
              {resolveDisplayName(p)}
              {isActive && <XIcon />}
            </button>
          );
        })}
      </div>

      {/* Search input */}
      <div className="relative flex-1 min-w-[160px] max-w-xs">
        <div
          className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "var(--text-secondary)" }}
        >
          <SearchIcon />
        </div>
        <input
          type="text"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Search messages..."
          className="w-full rounded-lg pl-8 pr-3 py-1.5 text-sm outline-none transition-colors"
          style={{
            background: "var(--bg-tertiary)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--accent)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
          }}
        />
        {localSearch && (
          <button
            onClick={() => setLocalSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-secondary)" }}
          >
            <XIcon />
          </button>
        )}
      </div>

      {/* Favorites toggle */}
      <button
        onClick={() => setFavoritesOnly(!favoritesOnly)}
        className="shrink-0 p-1.5 rounded-lg transition-colors"
        style={{
          background: favoritesOnly ? "rgba(245, 197, 66, 0.15)" : "transparent",
          color: favoritesOnly ? "#f5c542" : "var(--text-secondary)",
        }}
        title={favoritesOnly ? "Show all messages" : "Show favorites only"}
      >
        <StarIcon filled={favoritesOnly} />
      </button>
    </div>
  );
}
