import { Message } from "../types";

const MESSAGE_REGEX = /^(\d{2}\.\d{2}\.\d{4}), (\d{2}:\d{2}) - (.+)$/;
const SENDER_REGEX = /^([^:]+): (.*)$/;
const FILE_ATTACHED_REGEX = /^\u200e?(.+?) \(файл добавлен\)$/;
const FILE_INLINE_REGEX = /^\u200e?(.+?) \(файл добавлен\)/;

export function parseWhatsAppChat(text: string): { messages: Message[]; participants: Set<string> } {
  const lines = text.split("\n");
  const messages: Message[] = [];
  const participants = new Set<string>();
  let currentMessage: { date: string; time: string; sender: string; content: string } | null = null;
  let orderIndex = 0;

  function flushMessage() {
    if (!currentMessage) return;
    const { date, time, sender, content } = currentMessage;
    if (!sender) return; // skip system messages

    participants.add(sender);
    const [day, month, year] = date.split(".");
    const datetime = `${year}-${month}-${day}T${time}:00`;

    // Check for file attachment — could be entire content or first line of multi-line message
    const fileMatch = content.match(FILE_ATTACHED_REGEX);
    let mediaType: Message["media_type"] = "text";
    let mediaPath: string | null = null;
    let messageContent = content;

    if (fileMatch) {
      // Entire content is just the file reference
      const filename = fileMatch[1];
      mediaPath = filename;
      mediaType = detectMediaType(filename);
      messageContent = "";
    } else {
      // Check first line for file reference (multi-line messages with text after attachment)
      const firstLine = content.split("\n")[0];
      const inlineMatch = firstLine.match(FILE_INLINE_REGEX);
      if (inlineMatch) {
        const filename = inlineMatch[1];
        mediaPath = filename;
        mediaType = detectMediaType(filename);
        // Keep remaining text as content (everything after the first line)
        const restLines = content.split("\n").slice(1).join("\n").trim();
        messageContent = restLines;
      }
    }

    messages.push({
      id: 0,
      order_index: orderIndex++,
      sender,
      datetime,
      content: messageContent,
      media_type: mediaType,
      media_path: mediaPath,
      is_favorite: 0,
      is_hidden: 0,
    });
  }

  for (const line of lines) {
    const msgMatch = line.match(MESSAGE_REGEX);
    if (msgMatch) {
      flushMessage();
      const [, date, time, rest] = msgMatch;
      const senderMatch = rest.match(SENDER_REGEX);
      if (senderMatch) {
        currentMessage = { date, time, sender: senderMatch[1], content: senderMatch[2] };
      } else {
        // system message
        currentMessage = { date, time, sender: "", content: rest };
      }
    } else if (currentMessage) {
      currentMessage.content += "\n" + line;
    }
  }
  flushMessage();

  return { messages, participants };
}

function detectMediaType(filename: string): Message["media_type"] {
  const lower = filename.toLowerCase();
  if (/^ptt-.*\.(opus|ogg)$/.test(lower)) return "voice";
  if (/^aud-.*\.(opus|ogg)$/.test(lower)) return "voice";
  if (/^aud-.*\.(mp3|m4a|aac|wav)$/.test(lower)) return "audio";
  if (/\.(mp3|m4a|aac|wav)$/.test(lower)) return "audio";
  if (/^stk-.*\.webp$/.test(lower)) return "sticker";
  if (/^img-.*\.(jpg|jpeg|png|webp)$/.test(lower)) return "image";
  if (/\.(jpg|jpeg|png|webp)$/.test(lower)) return "image";
  if (/\.(gif)$/.test(lower)) return "gif";
  if (/^vid-.*\.(mp4|3gp|mov|avi)$/.test(lower)) return "video";
  if (/\.(mp4|3gp|mov|avi)$/.test(lower)) return "video";
  return "document";
}
