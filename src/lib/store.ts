import { create } from "zustand";
import { Message } from "./types";

interface ChatViewState {
  senderFilter: string | null;
  searchQuery: string;
  favoritesOnly: boolean;
  mediaModalOpen: boolean;
  mediaModalIndex: number;
  mediaMessages: Message[];

  setSenderFilter: (sender: string | null) => void;
  setSearchQuery: (query: string) => void;
  setFavoritesOnly: (value: boolean) => void;
  openMediaModal: (messages: Message[], index: number) => void;
  closeMediaModal: () => void;
  nextMedia: () => void;
  prevMedia: () => void;
}

export const useChatViewStore = create<ChatViewState>((set, get) => ({
  senderFilter: null,
  searchQuery: "",
  favoritesOnly: false,
  mediaModalOpen: false,
  mediaModalIndex: 0,
  mediaMessages: [],

  setSenderFilter: (sender) => set({ senderFilter: sender }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setFavoritesOnly: (value) => set({ favoritesOnly: value }),

  openMediaModal: (messages, index) =>
    set({ mediaModalOpen: true, mediaMessages: messages, mediaModalIndex: index }),
  closeMediaModal: () => set({ mediaModalOpen: false }),
  nextMedia: () => {
    const { mediaModalIndex, mediaMessages } = get();
    if (mediaModalIndex < mediaMessages.length - 1) {
      set({ mediaModalIndex: mediaModalIndex + 1 });
    }
  },
  prevMedia: () => {
    const { mediaModalIndex } = get();
    if (mediaModalIndex > 0) {
      set({ mediaModalIndex: mediaModalIndex - 1 });
    }
  },
}));
