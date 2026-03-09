import { create } from "zustand";
import { Message, ParticipantDetail } from "./types";

interface ChatViewState {
  senderFilter: string | null;
  searchQuery: string;
  favoritesOnly: boolean;
  mediaModalOpen: boolean;
  mediaModalIndex: number;
  mediaMessages: Message[];
  scrollToOrderIndex: number | null;
  galleryOpen: boolean;
  participantMap: Record<string, ParticipantDetail>;

  setSenderFilter: (sender: string | null) => void;
  setSearchQuery: (query: string) => void;
  setFavoritesOnly: (value: boolean) => void;
  openMediaModal: (messages: Message[], index: number) => void;
  closeMediaModal: () => void;
  nextMedia: () => void;
  prevMedia: () => void;
  navigateToMessage: (orderIndex: number) => void;
  clearScrollTarget: () => void;
  openGallery: () => void;
  closeGallery: () => void;
  setParticipantMap: (map: Record<string, ParticipantDetail>) => void;
  resolveDisplayName: (sender: string) => string;
  isSenderVisible: (sender: string) => boolean | undefined;
}

export const useChatViewStore = create<ChatViewState>((set, get) => ({
  senderFilter: null,
  searchQuery: "",
  favoritesOnly: false,
  mediaModalOpen: false,
  mediaModalIndex: 0,
  mediaMessages: [],
  scrollToOrderIndex: null,
  galleryOpen: false,
  participantMap: {},

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
  navigateToMessage: (orderIndex) =>
    set({ favoritesOnly: false, searchQuery: "", senderFilter: null, scrollToOrderIndex: orderIndex }),
  clearScrollTarget: () => set({ scrollToOrderIndex: null }),
  openGallery: () => set({ galleryOpen: true }),
  closeGallery: () => set({ galleryOpen: false }),
  setParticipantMap: (map) => set({ participantMap: map }),
  resolveDisplayName: (sender) => {
    const detail = get().participantMap[sender];
    return detail?.displayName || sender;
  },
  isSenderVisible: (sender) => {
    return get().participantMap[sender]?.showSender;
  },
}));
