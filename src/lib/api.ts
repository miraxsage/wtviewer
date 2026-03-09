import { Chat, Message } from "./types";

export async function fetchChats(): Promise<Chat[]> {
  const res = await fetch("/api/chats");
  return res.json();
}

export async function fetchChat(id: string): Promise<Chat> {
  const res = await fetch(`/api/chats/${id}`);
  return res.json();
}

export async function deleteChat(id: string): Promise<void> {
  await fetch(`/api/chats/${id}`, { method: "DELETE" });
}

export async function importChatApi(formData: FormData): Promise<{ chatId: string; name: string; messageCount: number }> {
  const res = await fetch("/api/chats/import", { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Import failed");
  }
  return res.json();
}

export async function fetchMessages(
  chatId: string,
  params: { offset?: number; limit?: number; sender?: string; search?: string; favorites?: boolean }
): Promise<{ messages: Message[]; total: number; offset: number; limit: number }> {
  const url = new URL(`/api/chats/${chatId}/messages`, window.location.origin);
  if (params.offset !== undefined) url.searchParams.set("offset", String(params.offset));
  if (params.limit !== undefined) url.searchParams.set("limit", String(params.limit));
  if (params.sender) url.searchParams.set("sender", params.sender);
  if (params.search) url.searchParams.set("search", params.search);
  if (params.favorites) url.searchParams.set("favorites", "true");
  const res = await fetch(url.toString());
  return res.json();
}

export async function toggleFavorite(chatId: string, msgId: number, isFavorite: boolean): Promise<Message> {
  const res = await fetch(`/api/chats/${chatId}/messages/${msgId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_favorite: isFavorite }),
  });
  return res.json();
}

export async function toggleHidden(chatId: string, msgId: number, isHidden: boolean): Promise<Message> {
  const res = await fetch(`/api/chats/${chatId}/messages/${msgId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_hidden: isHidden }),
  });
  return res.json();
}

export function mediaUrl(chatId: string, mediaPath: string): string {
  return `/api/media/${chatId}/${mediaPath}`;
}
