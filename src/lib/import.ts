import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import JSZip from "jszip";
import { getMainDb, getChatDb } from "./db";
import { parseWhatsAppChat } from "./parsers/whatsapp";
import { parseTelegramChat } from "./parsers/telegram";
import { Message } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

interface ImportResult {
  chatId: string;
  name: string;
  messageCount: number;
}

export async function importChat(
  archiveBuffer: Buffer,
  archiveFileName: string,
  name: string,
  description: string
): Promise<ImportResult> {
  const chatId = uuidv4();
  const backupDir = path.join(DATA_DIR, "backups");
  const mediaDir = path.join(DATA_DIR, "media", chatId);
  const tempDir = path.join(DATA_DIR, "temp", chatId);

  fs.mkdirSync(backupDir, { recursive: true });
  fs.mkdirSync(mediaDir, { recursive: true });
  fs.mkdirSync(tempDir, { recursive: true });

  // Save backup
  const backupPath = path.join(backupDir, `${chatId}_${archiveFileName}`);
  fs.writeFileSync(backupPath, archiveBuffer);

  try {
    // Extract archive
    await extractArchive(archiveBuffer, archiveFileName, tempDir);

    // Find the actual content directory (might be nested)
    const contentDir = findContentDir(tempDir);

    // Detect type and parse
    const isWhatsApp = detectWhatsApp(contentDir);
    let messages: Message[];
    let participants: Set<string>;

    if (isWhatsApp) {
      const txtFile = fs.readdirSync(contentDir).find((f) => f.endsWith(".txt"));
      if (!txtFile) throw new Error("WhatsApp text file not found");
      const text = fs.readFileSync(path.join(contentDir, txtFile), "utf-8");
      const result = parseWhatsAppChat(text);
      messages = result.messages;
      participants = result.participants;
    } else {
      const htmlFiles = fs
        .readdirSync(contentDir)
        .filter((f) => f.match(/^messages\d*\.html$/))
        .map((f) => ({
          name: f,
          content: fs.readFileSync(path.join(contentDir, f), "utf-8"),
        }));
      if (htmlFiles.length === 0) throw new Error("Telegram HTML files not found");
      const result = parseTelegramChat(htmlFiles);
      messages = result.messages;
      participants = result.participants;
    }

    // Process media files and copy to organized dirs
    processMediaFiles(messages, contentDir, mediaDir);

    // Write messages to chat DB
    const chatDb = getChatDb(chatId);
    const insert = chatDb.prepare(`
      INSERT INTO messages (order_index, sender, datetime, content, media_type, media_path, is_favorite, is_hidden)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0)
    `);

    const batchInsert = chatDb.transaction((msgs: Message[]) => {
      for (const msg of msgs) {
        insert.run(msg.order_index, msg.sender, msg.datetime, msg.content, msg.media_type, msg.media_path);
      }
    });
    batchInsert(messages);
    chatDb.close();

    // Register chat in main DB
    const mainDb = getMainDb();
    mainDb
      .prepare(
        `INSERT INTO chats (id, name, description, source_type, participants, message_count, created_at, backup_path, media_dir)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        chatId,
        name,
        description,
        isWhatsApp ? "whatsapp" : "telegram",
        JSON.stringify([...participants]),
        messages.length,
        new Date().toISOString(),
        backupPath,
        mediaDir
      );
    mainDb.close();

    return { chatId, name, messageCount: messages.length };
  } finally {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function extractArchive(buffer: Buffer, filename: string, destDir: string) {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".zip")) {
    const zip = await JSZip.loadAsync(buffer);
    for (const [relativePath, file] of Object.entries(zip.files)) {
      if (file.dir) {
        fs.mkdirSync(path.join(destDir, relativePath), { recursive: true });
        continue;
      }
      const destPath = path.join(destDir, relativePath);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      const content = await file.async("nodebuffer");
      fs.writeFileSync(destPath, content);
    }
  } else if (lower.endsWith(".rar")) {
    const tempRar = path.join(destDir, "__archive.rar");
    fs.writeFileSync(tempRar, buffer);
    const script = `
      const fs = require("fs");
      const path = require("path");
      const { createExtractorFromData } = require("node-unrar-js");
      const wasmBinary = fs.readFileSync(require.resolve("node-unrar-js/dist/js/unrar.wasm"));
      const buf = fs.readFileSync(process.argv[1]);
      const dest = process.argv[2];
      (async () => {
        const extractor = await createExtractorFromData({ wasmBinary: wasmBinary.buffer, data: buf.buffer });
        const extracted = extractor.extract();
        for (const f of extracted.files) {
          if (f.fileHeader.flags.directory) { fs.mkdirSync(path.join(dest, f.fileHeader.name), { recursive: true }); continue; }
          const dp = path.join(dest, f.fileHeader.name);
          fs.mkdirSync(path.dirname(dp), { recursive: true });
          if (f.extraction) fs.writeFileSync(dp, Buffer.from(f.extraction));
        }
      })();
    `;
    // eslint-disable-next-line no-eval
    const cp = eval('require("child_process")');
    cp.execFileSync("node", ["-e", script, tempRar, destDir], { timeout: 60000 });
    fs.unlinkSync(tempRar);
  } else {
    throw new Error(`Unsupported archive format: ${filename}`);
  }
}

function findContentDir(dir: string): string {
  const entries = fs.readdirSync(dir);
  // If there's only one subdirectory and no chat files, go deeper
  if (entries.length === 1) {
    const single = path.join(dir, entries[0]);
    if (fs.statSync(single).isDirectory()) {
      return findContentDir(single);
    }
  }
  return dir;
}

function detectWhatsApp(dir: string): boolean {
  const files = fs.readdirSync(dir);
  return files.some((f) => f.endsWith(".txt") && !f.endsWith(".html"));
}

const MEDIA_TYPE_DIRS: Record<string, string> = {
  image: "images",
  video: "video",
  audio: "audio",
  voice: "voice",
  sticker: "stickers",
  gif: "gif",
  document: "documents",
};

function processMediaFiles(messages: Message[], sourceDir: string, mediaDir: string) {
  // Create media subdirs
  for (const subdir of Object.values(MEDIA_TYPE_DIRS)) {
    fs.mkdirSync(path.join(mediaDir, subdir), { recursive: true });
  }

  for (const msg of messages) {
    if (!msg.media_path || msg.media_type === "text") continue;

    const originalPath = msg.media_path;
    // Try to find file in source directory (could be in subfolders)
    const sourcePath = findFile(sourceDir, originalPath);

    if (sourcePath && fs.existsSync(sourcePath)) {
      const typeDir = MEDIA_TYPE_DIRS[msg.media_type] || "documents";
      const filename = path.basename(originalPath);
      const destPath = path.join(mediaDir, typeDir, filename);

      fs.copyFileSync(sourcePath, destPath);
      msg.media_path = `${typeDir}/${filename}`;
    } else {
      // File not found, keep reference but mark appropriately
      msg.media_path = null;
      if (!msg.content) {
        msg.content = `[Файл не найден: ${originalPath}]`;
      }
    }
  }
}

function findFile(dir: string, relativePath: string): string | null {
  // Direct path
  const direct = path.join(dir, relativePath);
  if (fs.existsSync(direct)) return direct;

  // Just filename in root
  const filename = path.basename(relativePath);
  const inRoot = path.join(dir, filename);
  if (fs.existsSync(inRoot)) return inRoot;

  // Search in subdirectories
  const subdirs = fs.readdirSync(dir).filter((f) => {
    try {
      return fs.statSync(path.join(dir, f)).isDirectory();
    } catch {
      return false;
    }
  });

  for (const subdir of subdirs) {
    const inSub = path.join(dir, subdir, filename);
    if (fs.existsSync(inSub)) return inSub;
  }

  return null;
}
