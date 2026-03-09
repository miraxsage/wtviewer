export interface ParticipantDetail {
  displayName?: string;
  phone?: string;
  showSender?: boolean;
}

export interface Chat {
  id: string;
  name: string;
  description: string;
  source_type: "whatsapp" | "telegram";
  participants: string[];
  message_count: number;
  created_at: string;
  backup_path: string;
  media_dir: string;
  participant_details: Record<string, ParticipantDetail>;
  show_own_sender: boolean;
}

export interface Message {
  id: number;
  order_index: number;
  sender: string;
  datetime: string;
  content: string;
  media_type: "text" | "image" | "video" | "audio" | "voice" | "sticker" | "gif" | "document";
  media_path: string | null;
  is_favorite: number;
  is_hidden: number;
}

export interface MessagesQuery {
  offset?: number;
  limit?: number;
  sender?: string;
  search?: string;
  favorites?: boolean;
}
