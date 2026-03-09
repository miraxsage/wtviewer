import * as cheerio from "cheerio";
import { Message } from "../types";

export function parseTelegramChat(htmlFiles: { name: string; content: string }[]): {
  messages: Message[];
  participants: Set<string>;
} {
  // Sort files: messages.html first, then messages2, messages3, etc.
  const sorted = htmlFiles.sort((a, b) => {
    const numA = extractPageNumber(a.name);
    const numB = extractPageNumber(b.name);
    return numA - numB;
  });

  const messages: Message[] = [];
  const participants = new Set<string>();
  let orderIndex = 0;
  let lastSender = "";

  for (const file of sorted) {
    const $ = cheerio.load(file.content);

    $(".message.default").each((_, el) => {
      const $msg = $(el);

      // Sender
      const fromName = $msg.find(".from_name").first().text().trim();
      if (fromName) {
        lastSender = fromName;
      }
      const sender = lastSender;
      if (sender) participants.add(sender);

      // Date
      const dateTitle = $msg.find(".date.details").attr("title") || "";
      const datetime = parseTelegramDate(dateTitle);

      // Text content
      const text = $msg.find(".text").first().text().trim();

      // Media detection
      let mediaType: Message["media_type"] = "text";
      let mediaPath: string | null = null;

      const voiceLink = $msg.find("a.media_voice_message").attr("href");
      const photoLink = $msg.find("a.photo_wrap").attr("href");
      const videoLink = $msg.find("a.video_file_wrap").attr("href")
        || $msg.find("a.media_video_file").attr("href");
      const stickerLink = $msg.find("a.sticker_wrap").attr("href");
      const animatedLink = $msg.find("a.animated_wrap").attr("href");

      if (voiceLink) {
        mediaType = "voice";
        mediaPath = voiceLink;
      } else if (photoLink) {
        mediaType = "image";
        mediaPath = photoLink;
      } else if (stickerLink) {
        mediaType = "sticker";
        mediaPath = stickerLink;
      } else if (animatedLink) {
        mediaType = "gif";
        mediaPath = animatedLink;
      } else if (videoLink) {
        mediaType = "video";
        mediaPath = videoLink;
      }

      if (!text && !mediaPath) return; // skip empty messages

      messages.push({
        id: 0,
        order_index: orderIndex++,
        sender,
        datetime,
        content: text,
        media_type: mediaType,
        media_path: mediaPath,
        is_favorite: 0,
        is_hidden: 0,
      });
    });
  }

  return { messages, participants };
}

function extractPageNumber(filename: string): number {
  const match = filename.match(/messages(\d*)\.html/);
  if (!match) return 999;
  return match[1] ? parseInt(match[1]) : 1;
}

function parseTelegramDate(title: string): string {
  // Format: "13.11.2022 00:47:19 UTC+03:00"
  const match = title.match(/(\d{2})\.(\d{2})\.(\d{4}) (\d{2}:\d{2}:\d{2})/);
  if (!match) return new Date().toISOString();
  const [, day, month, year, time] = match;
  return `${year}-${month}-${day}T${time}`;
}
